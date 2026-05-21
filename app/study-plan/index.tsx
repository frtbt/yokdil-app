import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Platform, ActivityIndicator,
  Modal, TouchableWithoutFeedback, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../store/useTheme';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/Colors';
import type { ExamType, Difficulty } from '../../constants/Data';
import type { ApiDocument, ApiCategory } from '../../store/useAppStore';
import DatePickerField from '../../components/DatePickerField';

// ── Sabitler ─────────────────────────────────────────────────────────────────

const PLAN_STORAGE_KEY = 'yokdil_weekly_plan';

const EXAM_OPTIONS: { label: ExamType; color: string; desc: string }[] = [
  { label: 'YÖKDİL', color: '#6C63FF', desc: 'Akademik İngilizce' },
  { label: 'YDS',    color: '#F5576C', desc: 'Yabancı Dil Sınavı' },
  { label: 'YDT',    color: '#4ECDC4', desc: 'Yabancı Dil Testi' },
];

const LEVEL_OPTIONS: { label: Difficulty; color: string; desc: string; icon: string }[] = [
  { label: 'Başlangıç', color: '#43E97B', desc: 'Temel gramer ve kelime',  icon: 'sunrise' },
  { label: 'Orta',      color: '#F7971E', desc: 'Okuma ve anlama odaklı', icon: 'sun'     },
  { label: 'İleri',     color: '#F5576C', desc: 'İleri metin analizi',     icon: 'zap'     },
];

const GOAL_OPTIONS = [
  { label: '30 dk', value: 30  },
  { label: '1 sa',  value: 60  },
  { label: '1.5 sa',value: 90  },
  { label: '2 sa',  value: 120 },
  { label: '3 sa+', value: 180 },
];

const DAYS_TR    = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const EXAM_COLOR: Record<string, string> = {
  'YÖKDİL': '#6C63FF', 'YDS': '#F5576C', 'YDT': '#4ECDC4',
};

export interface DayPlan {
  dayIndex: number;
  category: ApiCategory | null;
  documents: ApiDocument[];
  targetMinutes: number;
  isRestDay: boolean;
}

// ── Geliştirilmiş plan üretici ────────────────────────────────────────────────

function buildAutoPlan(
  categories: ApiCategory[],
  documents: ApiDocument[],
  examType: ExamType,
  level: Difficulty,
  dailyMin: number,
  daysLeft: number | null,
): DayPlan[] {
  // sort_order'a göre sırala (pedagojik sıra)
  let cats = [...categories]
    .filter((c) => c.count > 0)
    .sort((a, b) => a.sort_order - b.sort_order);

  // Sınav yakınsa (< 30 gün) zor konular önce
  if (daysLeft !== null && daysLeft < 30) cats = cats.reverse();

  const docs = documents.filter(
    (d) => d.exam_type === examType && (!d.difficulty || d.difficulty === level),
  );

  // Hafta sonu daha az süre
  const targetMins = (i: number) => {
    if (i === 6) return Math.round(dailyMin * 0.5);  // Pazar: yarı
    if (i === 5) return Math.round(dailyMin * 0.75); // Cumartesi: 3/4
    return dailyMin;
  };

  return Array.from({ length: 7 }, (_, i) => {
    const cat     = cats.length > 0 ? cats[i % cats.length] : null;
    const catDocs = cat
      ? docs.filter((d) => d.category_slug === cat.slug).slice(0, 2)
      : docs.slice(i * 2, i * 2 + 2);

    return {
      dayIndex:      i,
      category:      cat,
      documents:     catDocs,
      targetMinutes: targetMins(i),
      isRestDay:     false,
    };
  });
}

function buildEmptyPlan(dailyMin: number): DayPlan[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayIndex:      i,
    category:      null,
    documents:     [],
    targetMinutes: dailyMin,
    isRestDay:     false,
  }));
}

// ── Ana ekran ─────────────────────────────────────────────────────────────────

export default function StudyPlanScreen() {
  const { colors: c, dark, gradients } = useTheme();
  const { categories, documents, fetchDocuments, fetchCategories, selectedExam } = useAppStore();
  const { user } = useAuthStore();

  const [step,     setStep]     = useState(0);
  const [examType, setExamType] = useState<ExamType>(selectedExam);
  const [level,    setLevel]    = useState<Difficulty>(
    user?.target_score && user.target_score >= 80 ? 'İleri'
    : user?.target_score && user.target_score >= 65 ? 'Orta'
    : 'Başlangıç',
  );
  const [dailyMin, setDailyMin] = useState(user?.daily_goal_min ?? 60);
  const [examDate, setExamDate] = useState(user?.target_exam_date ?? '');
  const [planMode, setPlanMode] = useState<'auto' | 'manual'>('auto');
  const [plan,     setPlan]     = useState<DayPlan[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [activeDay, setActiveDay] = useState(0);
  const [editingDay, setEditingDay] = useState<number | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const TOTAL_WIZARD_STEPS = 5; // 0-4 wizard, 5 plan

  const daysLeft = useMemo(() => {
    if (!examDate) return null;
    const p = examDate.split('.');
    if (p.length !== 3) return null;
    const d = new Date(`${p[2]}-${p[1]}-${p[0]}`);
    const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
    return diff > 0 ? diff : null;
  }, [examDate]);

  const animateStep = useCallback((toStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 170, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -28, duration: 170, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(28);
      setStep(toStep);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 210, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 210, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const goNext = useCallback(async () => {
    Haptics.selectionAsync();
    if (step === 4) {
      // Plan oluştur
      setLoading(true);
      animateStep(5);
      if (!categories.length || documents[0]?.exam_type !== examType) {
        await Promise.all([fetchCategories(), fetchDocuments(examType, null)]);
      }
      const generated = planMode === 'auto'
        ? buildAutoPlan(categories, documents, examType, level, dailyMin, daysLeft)
        : buildEmptyPlan(dailyMin);
      setPlan(generated);
      setLoading(false);
    } else {
      animateStep(step + 1);
    }
  }, [step, planMode, examType, level, dailyMin, daysLeft,
      categories, documents, animateStep, fetchCategories, fetchDocuments]);

  const goBack = useCallback(() => {
    Haptics.selectionAsync();
    if (step === 0) { router.back(); return; }
    animateStep(step - 1);
  }, [step, animateStep]);

  const savePlan = useCallback(async () => {
    await AsyncStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [plan]);

  const updateDay = useCallback((dayIndex: number, updated: DayPlan) => {
    setPlan((prev) => prev.map((d) => d.dayIndex === dayIndex ? updated : d));
  }, []);

  const progress = step / TOTAL_WIZARD_STEPS;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>

      {/* Header */}
      <LinearGradient colors={gradients.header} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {step < 5 ? 'Çalışma Planı' : 'Haftalık Planın'}
            </Text>
            {step < 5 && (
              <Text style={styles.headerSub}>Adım {step + 1} / {TOTAL_WIZARD_STEPS}</Text>
            )}
          </View>
          <View style={{ width: 40 }} />
        </SafeAreaView>
        {step < 5 && (
          <View style={styles.progressWrap}>
            <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: c.primary }]} />
            </View>
          </View>
        )}
      </LinearGradient>

      {/* İçerik */}
      <Animated.View style={[styles.content, {
        opacity: fadeAnim, transform: [{ translateX: slideAnim }],
      }]}>
        {step === 0 && <StepExam  examType={examType} onSelect={setExamType} c={c} />}
        {step === 1 && <StepLevel level={level}       onSelect={setLevel}    c={c} />}
        {step === 2 && <StepGoal  dailyMin={dailyMin} onSelect={setDailyMin} c={c} />}
        {step === 3 && (
          <StepDate examDate={examDate} onChange={setExamDate} daysLeft={daysLeft} c={c} />
        )}
        {step === 4 && <StepMode mode={planMode} onSelect={setPlanMode} c={c} />}
        {step === 5 && (
          <StepPlan
            plan={plan}
            loading={loading}
            activeDay={activeDay}
            onDaySelect={setActiveDay}
            onEditDay={setEditingDay}
            examType={examType}
            dailyMin={dailyMin}
            daysLeft={daysLeft}
            planMode={planMode}
            onSave={savePlan}
            c={c}
          />
        )}
      </Animated.View>

      {/* Alt buton (wizard adımları) */}
      {step < 5 && (
        <View style={[styles.footer, { backgroundColor: c.background, borderTopColor: c.border }]}>
          <TouchableOpacity onPress={goNext} activeOpacity={0.85} style={styles.nextWrap}>
            <LinearGradient
              colors={gradients.btn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.nextBtn}
            >
              <Text style={styles.nextBtnText}>
                {step === 4 ? 'Planı Oluştur' : 'Devam Et'}
              </Text>
              <Feather name={step === 4 ? 'check' : 'arrow-right'} size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Gün düzenleyici */}
      {editingDay !== null && (
        <DayEditor
          dayIndex={editingDay}
          dayPlan={plan[editingDay]}
          categories={categories}
          documents={documents}
          examType={examType}
          onClose={() => setEditingDay(null)}
          onSave={(updated) => { updateDay(editingDay, updated); setEditingDay(null); }}
          c={c}
          dark={dark}
        />
      )}
    </View>
  );
}

// ── Adım 0: Sınav Tipi ────────────────────────────────────────────────────────

function StepExam({ examType, onSelect, c }: {
  examType: ExamType; onSelect: (e: ExamType) => void; c: typeof Colors.dark;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { color: c.text }]}>Hangi sınava hazırlanıyorsun?</Text>
      <Text style={[styles.stepSub, { color: c.textSecondary }]}>
        Planın tamamen bu sınava özel oluşturulacak.
      </Text>
      <View style={styles.bigCards}>
        {EXAM_OPTIONS.map((opt) => {
          const active = examType === opt.label;
          return (
            <TouchableOpacity
              key={opt.label}
              onPress={() => { onSelect(opt.label); Haptics.selectionAsync(); }}
              activeOpacity={0.8}
              style={[
                styles.bigCard,
                { backgroundColor: c.surface, borderColor: active ? opt.color : c.border },
                active && { backgroundColor: opt.color + '18' },
              ]}
            >
              <LinearGradient colors={[opt.color + '30', opt.color + '10']} style={styles.bigCardIcon}>
                <Text style={styles.bigCardEmoji}>📖</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bigCardLabel, { color: active ? opt.color : c.text }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.bigCardDesc, { color: c.textSecondary }]}>{opt.desc}</Text>
              </View>
              {active && (
                <View style={[styles.checkCircle, { backgroundColor: opt.color }]}>
                  <Feather name="check" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Adım 1: Seviye ────────────────────────────────────────────────────────────

function StepLevel({ level, onSelect, c }: {
  level: Difficulty; onSelect: (l: Difficulty) => void; c: typeof Colors.dark;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { color: c.text }]}>Mevcut seviyeni seç</Text>
      <Text style={[styles.stepSub, { color: c.textSecondary }]}>
        Planın bu seviyeye uygun dokümanlar içerecek.
      </Text>
      <View style={styles.levelCards}>
        {LEVEL_OPTIONS.map((opt) => {
          const active = level === opt.label;
          return (
            <TouchableOpacity
              key={opt.label}
              onPress={() => { onSelect(opt.label); Haptics.selectionAsync(); }}
              activeOpacity={0.8}
              style={[
                styles.levelCard,
                { backgroundColor: c.surface, borderColor: active ? opt.color : c.border },
                active && { backgroundColor: opt.color + '15' },
              ]}
            >
              <View style={[styles.levelIcon, { backgroundColor: opt.color + '25' }]}>
                <Feather name={opt.icon as any} size={22} color={opt.color} />
              </View>
              <View style={styles.levelInfo}>
                <Text style={[styles.levelLabel, { color: active ? opt.color : c.text }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.levelDesc, { color: c.textSecondary }]}>{opt.desc}</Text>
              </View>
              {active && (
                <View style={[styles.checkCircle, { backgroundColor: opt.color }]}>
                  <Feather name="check" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Adım 2: Günlük Hedef ──────────────────────────────────────────────────────

function StepGoal({ dailyMin, onSelect, c }: {
  dailyMin: number; onSelect: (m: number) => void; c: typeof Colors.dark;
}) {
  return (
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { color: c.text }]}>Günlük kaç çalışabilirsin?</Text>
      <Text style={[styles.stepSub, { color: c.textSecondary }]}>
        Tutarlı çalışmak, uzun ama seyrek seanslardan çok daha etkili.
      </Text>
      <View style={styles.goalGrid}>
        {GOAL_OPTIONS.map((opt) => {
          const active = dailyMin === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => { onSelect(opt.value); Haptics.selectionAsync(); }}
              activeOpacity={0.8}
              style={[
                styles.goalChip,
                { backgroundColor: c.surface, borderColor: active ? c.primary : c.border },
                active && { backgroundColor: c.primary },
              ]}
            >
              <Feather name="clock" size={16} color={active ? '#fff' : c.primary} />
              <Text style={[styles.goalLabel, { color: active ? '#fff' : c.text }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[styles.tipCard, { backgroundColor: c.primary + '15', borderColor: c.primary + '30' }]}>
        <Feather name="info" size={15} color={c.primary} />
        <Text style={[styles.tipText, { color: c.primary }]}>
          Günde {dailyMin} dakika → haftalık {dailyMin * 7} dakika birikim.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Adım 3: Sınav Tarihi ──────────────────────────────────────────────────────

function StepDate({ examDate, onChange, daysLeft, c }: {
  examDate: string; onChange: (d: string) => void;
  daysLeft: number | null; c: typeof Colors.dark;
}) {
  const { gradients } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { color: c.text }]}>Sınav tarihin ne zaman?</Text>
      <Text style={[styles.stepSub, { color: c.textSecondary }]}>
        İsteğe bağlı — plan yoğunluğunu ayarlamak için kullanılır.
      </Text>
      <View style={[styles.dateCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.dateIcon, { backgroundColor: c.primary + '20' }]}>
          <Feather name="calendar" size={22} color={c.primary} />
        </View>
        <DatePickerField
          value={examDate}
          onChange={onChange}
          textColor={c.text}
          placeholderColor={c.textTertiary}
          style={styles.dateInput}
        />
      </View>
      {daysLeft !== null && (
        <LinearGradient colors={gradients.btn} style={styles.countdownCard}>
          <Text style={styles.countdownNum}>{daysLeft}</Text>
          <Text style={styles.countdownLabel}>gün kaldı</Text>
          <Text style={styles.countdownSub}>
            {daysLeft >= 90
              ? 'Harika! Yeterli zamanın var.'
              : daysLeft >= 30
              ? 'Düzenli çalışmayı ihmal etme.'
              : 'Son sprint — yoğun çalışma zamanı!'}
          </Text>
        </LinearGradient>
      )}
      <TouchableOpacity
        onPress={() => onChange('')}
        style={[styles.skipBtn, { borderColor: c.border }]}
      >
        <Text style={[styles.skipText, { color: c.textSecondary }]}>Tarihi bilmiyorum, atla</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Adım 4: Plan Modu ─────────────────────────────────────────────────────────

function StepMode({ mode, onSelect, c }: {
  mode: 'auto' | 'manual'; onSelect: (m: 'auto' | 'manual') => void; c: typeof Colors.dark;
}) {
  const opts = [
    {
      value: 'auto' as const,
      icon: 'cpu',
      color: c.primary,
      title: 'Otomatik Oluştur',
      desc: 'Sistem, seçtiğin sınav tipine, seviyene ve kalan süreye göre en uygun haftalık planı oluşturur. Sonradan düzenleyebilirsin.',
    },
    {
      value: 'manual' as const,
      icon: 'edit-3',
      color: '#F7971E',
      title: 'Kendim Oluşturacağım',
      desc: 'Haftanın her günü için kategori, doküman ve süreyi kendin seçersin. Tam kontrol sende.',
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { color: c.text }]}>Planı nasıl oluşturalım?</Text>
      <Text style={[styles.stepSub, { color: c.textSecondary }]}>
        İstediğin zaman düzenleyebilirsin.
      </Text>
      <View style={styles.modeCards}>
        {opts.map((opt) => {
          const active = mode === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => { onSelect(opt.value); Haptics.selectionAsync(); }}
              activeOpacity={0.8}
              style={[
                styles.modeCard,
                { backgroundColor: c.surface, borderColor: active ? opt.color : c.border },
                active && { backgroundColor: opt.color + '12' },
              ]}
            >
              <View style={[styles.modeIcon, { backgroundColor: opt.color + '22' }]}>
                <Feather name={opt.icon as any} size={26} color={opt.color} />
              </View>
              <Text style={[styles.modeTitle, { color: active ? opt.color : c.text }]}>
                {opt.title}
              </Text>
              <Text style={[styles.modeDesc, { color: c.textSecondary }]}>{opt.desc}</Text>
              {active && (
                <View style={[styles.modeCheck, { backgroundColor: opt.color }]}>
                  <Feather name="check" size={13} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Adım 5: Plan Görünümü ─────────────────────────────────────────────────────

function StepPlan({ plan, loading, activeDay, onDaySelect, onEditDay,
  examType, dailyMin, daysLeft, planMode, onSave, c }: {
  plan: DayPlan[]; loading: boolean;
  activeDay: number; onDaySelect: (i: number) => void;
  onEditDay: (i: number) => void;
  examType: ExamType; dailyMin: number; daysLeft: number | null;
  planMode: 'auto' | 'manual'; onSave: () => void;
  c: typeof Colors.dark;
}) {
  const examColor  = EXAM_COLOR[examType] ?? '#6C63FF';
  const activePlan = plan[activeDay];

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>Plan oluşturuluyor…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.planScroll} showsVerticalScrollIndicator={false}>

      {/* Özet */}
      <LinearGradient
        colors={[examColor + 'CC', examColor + '88']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.summaryCard}
      >
        <View style={styles.summaryTop}>
          <Text style={styles.summaryTitle}>{examType} Planın Hazır!</Text>
          <View style={[styles.modeBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Feather name={planMode === 'auto' ? 'cpu' : 'edit-3'} size={11} color="#fff" />
            <Text style={styles.modeBadgeText}>
              {planMode === 'auto' ? 'Otomatik' : 'Manuel'}
            </Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <SummaryItem icon="clock"      value={`${dailyMin} dk/gün`} label="Hedef"     />
          <SummaryItem icon="bar-chart-2" value="7 gün"               label="Süre"      />
          {daysLeft && <SummaryItem icon="calendar" value={`${daysLeft}g`}   label="Kalan"   />}
        </View>
      </LinearGradient>

      {/* Gün seçici */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.dayStrip} contentContainerStyle={styles.dayStripContent}
      >
        {DAYS_SHORT.map((d, i) => {
          const active    = activeDay === i;
          const isRest    = plan[i]?.isRestDay;
          const hasDocs   = (plan[i]?.documents.length ?? 0) > 0;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => { onDaySelect(i); Haptics.selectionAsync(); }}
              style={[
                styles.dayChip,
                { backgroundColor: c.surface, borderColor: active ? examColor : c.border },
                active && { backgroundColor: examColor },
                isRest && !active && { opacity: 0.5 },
              ]}
            >
              <Text style={[styles.dayChipText, { color: active ? '#fff' : c.textSecondary }]}>{d}</Text>
              {isRest && !active && (
                <Feather name="moon" size={9} color={c.textTertiary} />
              )}
              {hasDocs && !active && !isRest && (
                <View style={[styles.dayDot, { backgroundColor: examColor }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Seçili gün */}
      {activePlan && (
        <View style={styles.dayDetail}>
          <View style={styles.dayDetailHeader}>
            <Text style={[styles.dayDetailTitle, { color: c.text }]}>{DAYS_TR[activeDay]}</Text>
            <View style={styles.dayDetailRight}>
              {!activePlan.isRestDay && (
                <View style={[styles.minuteBadge, { backgroundColor: examColor + '20' }]}>
                  <Feather name="clock" size={12} color={examColor} />
                  <Text style={[styles.minuteText, { color: examColor }]}>
                    {activePlan.targetMinutes} dk
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => onEditDay(activeDay)}
                style={[styles.editDayBtn, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Feather name="edit-2" size={14} color={c.primary} />
                <Text style={[styles.editDayText, { color: c.primary }]}>Düzenle</Text>
              </TouchableOpacity>
            </View>
          </View>

          {activePlan.isRestDay ? (
            <View style={[styles.restCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 28 }}>😴</Text>
              <Text style={[styles.restText, { color: c.textSecondary }]}>Dinlenme Günü</Text>
              <Text style={[styles.restSub, { color: c.textTertiary }]}>
                Zihnin de dinlenmeye ihtiyaç duyar.
              </Text>
            </View>
          ) : (
            <>
              {activePlan.category ? (
                <View style={[styles.catRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <View style={[styles.catIcon, { backgroundColor: examColor + '20' }]}>
                    <Feather name="bookmark" size={16} color={examColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.catName, { color: c.text }]}>
                      {activePlan.category.name}
                    </Text>
                    <Text style={[styles.catSub, { color: c.textSecondary }]}>
                      {activePlan.category.count} doküman mevcut
                    </Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => onEditDay(activeDay)}
                  style={[styles.addDayBtn, { borderColor: examColor + '50', backgroundColor: examColor + '10' }]}
                >
                  <Feather name="plus-circle" size={20} color={examColor} />
                  <Text style={[styles.addDayText, { color: examColor }]}>
                    Bu güne içerik ekle
                  </Text>
                </TouchableOpacity>
              )}

              {activePlan.documents.length > 0 && (
                <>
                  <Text style={[styles.docsLabel, { color: c.textSecondary }]}>
                    Önerilen Dokümanlar
                  </Text>
                  {activePlan.documents.map((doc) => (
                    <TouchableOpacity
                      key={doc.id}
                      onPress={() => router.push(`/pdf/${doc.id}`)}
                      activeOpacity={0.8}
                      style={[styles.docCard, { backgroundColor: c.surface, borderColor: c.border }]}
                    >
                      <View style={[styles.docThumb, {
                        backgroundColor: (doc.thumbnail_color ?? examColor) + '22',
                      }]}>
                        <Feather name="file-text" size={18} color={doc.thumbnail_color ?? examColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docTitle, { color: c.text }]} numberOfLines={1}>
                          {doc.title}
                        </Text>
                        <Text style={[styles.docSub, { color: c.textSecondary }]} numberOfLines={1}>
                          {doc.subtitle}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={c.textTertiary} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}
        </View>
      )}

      {/* Kaydet */}
      <TouchableOpacity onPress={onSave} activeOpacity={0.85} style={styles.saveWrap}>
        <LinearGradient
          colors={[examColor, examColor + 'AA']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.saveBtn}
        >
          <Feather name="check-circle" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>Planı Kaydet</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SummaryItem({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.summaryItem}>
      <Feather name={icon} size={13} color="rgba(255,255,255,0.8)" />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ── Gün Düzenleyici Bottom Sheet ──────────────────────────────────────────────

interface DayEditorProps {
  dayIndex: number;
  dayPlan: DayPlan;
  categories: ApiCategory[];
  documents: ApiDocument[];
  examType: ExamType;
  onClose: () => void;
  onSave: (updated: DayPlan) => void;
  c: typeof Colors.dark;
  dark: boolean;
}

function DayEditor({ dayIndex, dayPlan, categories, documents, examType,
  onClose, onSave, c, dark }: DayEditorProps) {
  const examColor = EXAM_COLOR[examType] ?? '#6C63FF';

  const [isRestDay,  setIsRestDay]  = useState(dayPlan.isRestDay);
  const [selectedCat, setSelectedCat] = useState<ApiCategory | null>(dayPlan.category);
  const [targetMin,  setTargetMin]  = useState(dayPlan.targetMinutes);

  // Seçili kategoriye ait dokümanlar
  const catDocs = useMemo(() => {
    if (!selectedCat) return [];
    return documents
      .filter((d) => d.exam_type === examType && d.category_slug === selectedCat.slug)
      .slice(0, 3);
  }, [selectedCat, documents, examType]);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({
      dayIndex,
      category:      isRestDay ? null : selectedCat,
      documents:     isRestDay ? [] : catDocs,
      targetMinutes: targetMin,
      isRestDay,
    });
  }, [dayIndex, isRestDay, selectedCat, catDocs, targetMin, onSave]);

  const availableCats = categories.filter((c) => c.count > 0);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={edStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[edStyles.sheet, { backgroundColor: c.surface }]}>
              <View style={[edStyles.handle, { backgroundColor: c.border }]} />

              <View style={edStyles.sheetHeader}>
                <Text style={[edStyles.sheetTitle, { color: c.text }]}>
                  {DAYS_TR[dayIndex]}'i Düzenle
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Feather name="x" size={20} color={c.textTertiary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>

                {/* Dinlenme günü toggle */}
                <View style={[edStyles.row, { borderColor: c.border }]}>
                  <View style={[edStyles.rowIcon, { backgroundColor: '#9B59B620' }]}>
                    <Text style={{ fontSize: 16 }}>😴</Text>
                  </View>
                  <Text style={[edStyles.rowLabel, { color: c.text }]}>Dinlenme Günü</Text>
                  <Switch
                    value={isRestDay}
                    onValueChange={(v) => { setIsRestDay(v); Haptics.selectionAsync(); }}
                    trackColor={{ false: c.border, true: '#9B59B6' }}
                    thumbColor="#fff"
                  />
                </View>

                {!isRestDay && (
                  <>
                    {/* Kategori seç */}
                    <Text style={[edStyles.sectionLabel, { color: c.textSecondary }]}>KATEGORİ</Text>
                    <ScrollView
                      horizontal showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 16 }}
                      contentContainerStyle={edStyles.chipRow}
                    >
                      {availableCats.map((cat) => {
                        const active = selectedCat?.slug === cat.slug;
                        return (
                          <TouchableOpacity
                            key={cat.slug}
                            onPress={() => { setSelectedCat(cat); Haptics.selectionAsync(); }}
                            style={[
                              edStyles.chip,
                              { borderColor: active ? examColor : c.border, backgroundColor: c.surfaceSecondary },
                              active && { backgroundColor: examColor },
                            ]}
                          >
                            <Text style={[edStyles.chipText, { color: active ? '#fff' : c.text }]}>
                              {cat.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Önerilen dokümanlar önizleme */}
                    {catDocs.length > 0 && (
                      <>
                        <Text style={[edStyles.sectionLabel, { color: c.textSecondary }]}>
                          EKLENECEK DOKÜMANLAR ({catDocs.length})
                        </Text>
                        {catDocs.map((doc) => (
                          <View
                            key={doc.id}
                            style={[edStyles.docPreview, { backgroundColor: c.background, borderColor: c.border }]}
                          >
                            <View style={[edStyles.docThumb, {
                              backgroundColor: (doc.thumbnail_color ?? examColor) + '22',
                            }]}>
                              <Feather name="file-text" size={14} color={doc.thumbnail_color ?? examColor} />
                            </View>
                            <Text style={[edStyles.docTitle, { color: c.text }]} numberOfLines={1}>
                              {doc.title}
                            </Text>
                          </View>
                        ))}
                      </>
                    )}

                    {/* Süre seç */}
                    <Text style={[edStyles.sectionLabel, { color: c.textSecondary }]}>HEDEF SÜRE</Text>
                    <View style={edStyles.chipRow}>
                      {GOAL_OPTIONS.map((opt) => {
                        const active = targetMin === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => { setTargetMin(opt.value); Haptics.selectionAsync(); }}
                            style={[
                              edStyles.chip,
                              { borderColor: active ? examColor : c.border, backgroundColor: c.surfaceSecondary },
                              active && { backgroundColor: examColor },
                            ]}
                          >
                            <Text style={[edStyles.chipText, { color: active ? '#fff' : c.text }]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </ScrollView>

              {/* Kaydet */}
              <TouchableOpacity onPress={handleSave} activeOpacity={0.85} style={edStyles.saveWrap}>
                <LinearGradient
                  colors={[examColor, examColor + 'AA']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={edStyles.saveBtn}
                >
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={edStyles.saveBtnText}>Günü Kaydet</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:       { flex: 1 },
  header:     { paddingBottom: 16 },
  safeHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, gap: 8,
  },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  progressWrap: { paddingHorizontal: 20, paddingBottom: 4 },
  progressTrack:{ height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6C63FF', borderRadius: 2 },

  content: { flex: 1 },
  footer: {
    paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  nextWrap:    { borderRadius: 16, overflow: 'hidden' },
  nextBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 8 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  stepScroll: { padding: 24, paddingBottom: 40 },
  stepTitle:  { fontSize: 22, fontWeight: '800', marginBottom: 8, lineHeight: 28 },
  stepSub:    { fontSize: 14, lineHeight: 20, marginBottom: 28 },

  bigCards:     { gap: 14 },
  bigCard: {
    borderRadius: 18, borderWidth: 2, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  bigCardIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bigCardEmoji: { fontSize: 22 },
  bigCardLabel: { fontSize: 17, fontWeight: '800' },
  bigCardDesc:  { fontSize: 12, marginTop: 3 },
  checkCircle:  { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  levelCards:  { gap: 14 },
  levelCard: {
    borderRadius: 18, borderWidth: 2, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  levelIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  levelInfo:  { flex: 1 },
  levelLabel: { fontSize: 16, fontWeight: '700' },
  levelDesc:  { fontSize: 12, marginTop: 3 },

  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  goalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: 16, borderWidth: 2, minWidth: '44%', flex: 1,
  },
  goalLabel: { fontSize: 15, fontWeight: '700' },
  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },

  dateCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 20,
  },
  dateIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateInput: { flex: 1, fontSize: 18, fontWeight: '600' },
  countdownCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  countdownNum:   { fontSize: 52, fontWeight: '900', color: '#fff' },
  countdownLabel: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: -4 },
  countdownSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 8, textAlign: 'center' },
  skipBtn:  { alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1 },
  skipText: { fontSize: 14, fontWeight: '500' },

  // Mod seçimi
  modeCards: { gap: 16 },
  modeCard: {
    borderRadius: 20, borderWidth: 2, padding: 20, gap: 10,
  },
  modeIcon:  { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: 17, fontWeight: '800' },
  modeDesc:  { fontSize: 13, lineHeight: 19 },
  modeCheck: { position: 'absolute', top: 16, right: 16, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Plan
  loadingBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 15 },
  planScroll:  { padding: 20, paddingBottom: 48 },

  summaryCard: { borderRadius: 20, padding: 20, marginBottom: 20 },
  summaryTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  summaryTitle:{ fontSize: 18, fontWeight: '800', color: '#fff' },
  modeBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  modeBadgeText:{ fontSize: 11, fontWeight: '700', color: '#fff' },
  summaryRow:  { flexDirection: 'row', gap: 20 },
  summaryItem: { alignItems: 'center', gap: 3 },
  summaryValue:{ fontSize: 13, fontWeight: '700', color: '#fff' },
  summaryLabel:{ fontSize: 10, color: 'rgba(255,255,255,0.7)' },

  dayStrip:        { marginBottom: 20 },
  dayStripContent: { gap: 8, paddingHorizontal: 2 },
  dayChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    borderWidth: 2, alignItems: 'center', gap: 3,
  },
  dayChipText: { fontSize: 12, fontWeight: '700' },
  dayDot:      { width: 5, height: 5, borderRadius: 2.5 },

  dayDetail:       { gap: 12 },
  dayDetailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayDetailTitle:  { fontSize: 20, fontWeight: '800' },
  dayDetailRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  minuteBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  minuteText:      { fontSize: 12, fontWeight: '700' },
  editDayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
  },
  editDayText:     { fontSize: 12, fontWeight: '600', color: '#6C63FF' },

  restCard: {
    padding: 32, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', gap: 8,
  },
  restText: { fontSize: 16, fontWeight: '700' },
  restSub:  { fontSize: 13 },

  addDayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 18, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
  },
  addDayText:  { fontSize: 15, fontWeight: '600' },

  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 15, fontWeight: '700' },
  catSub:  { fontSize: 12, marginTop: 2 },

  docsLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  docThumb: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontSize: 14, fontWeight: '600' },
  docSub:   { fontSize: 12, marginTop: 2 },

  saveWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 24 },
  saveBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

const edStyles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle:  { fontSize: 18, fontWeight: '800' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, marginBottom: 20,
  },
  rowIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  chipText:    { fontSize: 13, fontWeight: '600' },
  docPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 6,
  },
  docThumb: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  docTitle: { flex: 1, fontSize: 13, fontWeight: '500' },
  saveWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 16 },
  saveBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
