import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Animated, Dimensions, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppStore } from '../../store/useAppStore';
import type { ApiDocument, RecentHistoryItem } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../store/useTheme';
import { EXAM_TYPES, DIFFICULTY_LEVELS } from '../../constants/Data';
import type { ExamType, Difficulty } from '../../constants/Data';
import RecentDocCard from '../../components/RecentDocCard';
import StatsCard from '../../components/StatsCard';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Greeting ────────────────────────────────────────────────────────────────
function getGreeting(name: string): string {
  const h = new Date().getHours();
  const g = h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
  return `${g}, ${name}`;
}

// ─── Animation hook ───────────────────────────────────────────────────────────
function useFadeIn(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 16, stiffness: 130, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ─── ExamPill ─────────────────────────────────────────────────────────────────
function ExamPill({ label, active, onPress }: { label: ExamType; active: boolean; onPress: () => void }) {
  const { colors: c } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 80 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[styles.pill, active
          ? { backgroundColor: c.primary, borderColor: c.primary }
          : styles.pillInactive]}
      >
        <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── FilterBottomSheet ────────────────────────────────────────────────────────
const DIFF_COLORS: Record<string, string> = {
  'Başlangıç': '#059669', 'Orta': '#D97706', 'İleri': '#DC2626',
};

interface FilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedDifficulty: Difficulty | null;
  onSelectDifficulty: (d: Difficulty | null) => void;
}
function FilterBottomSheet({ visible, onClose, selectedDifficulty, onSelectDifficulty }: FilterBottomSheetProps) {
  const { colors: c } = useTheme();
  const slideY   = useRef(new Animated.Value(400)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY,    { toValue: 0,   damping: 22, stiffness: 180, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,    { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const [localDiff, setLocalDiff] = useState<Difficulty | null>(selectedDifficulty);
  useEffect(() => { setLocalDiff(selectedDifficulty); }, [selectedDifficulty, visible]);

  function apply() {
    Haptics.selectionAsync();
    onSelectDifficulty(localDiff);
    onClose();
  }
  function reset() {
    setLocalDiff(null);
    onSelectDifficulty(null);
    onClose();
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.bsBackdrop, { opacity: bgOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.bsSheet, { backgroundColor: c.surface, transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={[styles.bsHandle, { backgroundColor: c.border }]} />
        <Text style={[styles.bsTitle, { color: c.text }]}>Filtreler</Text>

        {/* Zorluk */}
        <Text style={[styles.bsLabel, { color: c.textSecondary }]}>Zorluk Seviyesi</Text>
        <View style={styles.bsChips}>
          {/* Tümü */}
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setLocalDiff(null); }}
            style={[styles.bsChip, localDiff === null && { backgroundColor: c.primary, borderColor: c.primary }]}
          >
            <Text style={[styles.bsChipText, { color: localDiff === null ? '#fff' : c.textSecondary }]}>
              Tümü
            </Text>
          </TouchableOpacity>
          {(DIFFICULTY_LEVELS as Difficulty[]).map((d) => {
            const col    = DIFF_COLORS[d] ?? '#6C63FF';
            const active = localDiff === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => { Haptics.selectionAsync(); setLocalDiff(d); }}
                style={[styles.bsChip, active && { backgroundColor: col, borderColor: col }]}
              >
                <View style={[styles.bsDot, { backgroundColor: col }]} />
                <Text style={[styles.bsChipText, { color: active ? '#fff' : c.text }]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Butonlar */}
        <View style={styles.bsActions}>
          <TouchableOpacity onPress={reset} style={[styles.bsResetBtn, { borderColor: c.border }]}>
            <Text style={[styles.bsResetText, { color: c.textSecondary }]}>Temizle</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={apply} style={styles.bsApplyBtn}>
            <LinearGradient colors={gradients.btn} style={styles.bsApplyGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.bsApplyText}>Uygula</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── DailyGoalCard ────────────────────────────────────────────────────────────
function DailyGoalCard({
  streakDays, todayStudySec, goalMin, c,
}: {
  streakDays: number; todayStudySec: number; goalMin: number; c: typeof Colors.dark;
}) {
  const { gradients: g, colors: t } = useTheme();
  const todayMin   = Math.floor(todayStudySec / 60);
  const goalSec    = goalMin * 60;
  const progress   = goalSec > 0 ? Math.min(todayStudySec / goalSec, 1) : 0;
  const done       = progress >= 1;

  const MOTIVATE = [
    'Harika gidiyorsun, devam et!',
    'Küçük adımlar büyük başarılara yol açar.',
    'Her gün biraz daha iyi!',
    'Konsantre kal, hedefe yaklaşıyorsun.',
  ];
  const tip = MOTIVATE[Math.floor(Date.now() / 86_400_000) % MOTIVATE.length];

  return (
    <LinearGradient colors={g.card} style={styles.goalCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      {/* Streak + title row */}
      <View style={styles.goalHeader}>
        <View>
          <Text style={styles.goalTitle}>{done ? '🎉 Hedefe ulaştın!' : 'Günlük Hedef'}</Text>
          <Text style={styles.goalSub}>
            {todayMin} dk / {goalMin} dk tamamlandı
          </Text>
        </View>
        {streakDays > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{streakDays}</Text>
            <Text style={styles.streakUnit}>gün</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: t.primary }]} />
      </View>
      <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>

      {!done && <Text style={styles.goalTip}>{tip}</Text>}
    </LinearGradient>
  );
}

// ─── StreakOnlyCard ───────────────────────────────────────────────────────────
function StreakOnlyCard({ streakDays, c }: { streakDays: number; c: typeof Colors.dark }) {
  const { gradients: g } = useTheme();
  return (
    <LinearGradient colors={g.card} style={[styles.goalCard, { paddingVertical: 18 }]}>
      <View style={styles.goalHeader}>
        <View>
          <Text style={styles.goalTitle}>Çalışma Serisi</Text>
          <Text style={styles.goalSub}>Tutarlılık başarının anahtarı.</Text>
        </View>
        <View style={styles.streakBadge}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>{streakDays}</Text>
          <Text style={styles.streakUnit}>gün</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

// ─── ContinueCard ─────────────────────────────────────────────────────────────
function ContinueCard({ item, onPress }: { item: RecentHistoryItem; onPress: () => void }) {
  const durationMin = Math.round(item.duration_sec / 60);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.continueCard}>
      <LinearGradient
        colors={[item.thumbnail_color, item.thumbnail_color + 'CC']}
        style={styles.continueGrad}
      >
        <View style={styles.continueIconWrap}>
          <Feather name="book-open" size={22} color="rgba(255,255,255,0.7)" />
        </View>
        <Text style={styles.continueTitle} numberOfLines={3}>{item.title}</Text>
        <View style={styles.continueMeta}>
          <Feather name="clock" size={11} color="rgba(255,255,255,0.6)" />
          <Text style={styles.continueMetaText}>{durationMin} dk</Text>
        </View>
        <View style={styles.continueBtn}>
          <Text style={styles.continueBtnText}>Devam Et</Text>
          <Feather name="arrow-right" size={12} color="#fff" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { colors: c, dark, gradients } = useTheme();
  const {
    selectedExam, selectedDifficulty,
    setSelectedExam, setSelectedDifficulty, toggleDarkMode,
    studyMinutes, todayStudySec, openedDocs, streakDays, recentHistory, downloadedIds,
    documents,
    isLoadingDocuments,
    fetchCategories, fetchDocuments, fetchUserStats, fetchFavorites,
  } = useAppStore();
  const { token, user } = useAuthStore();
  const router = useRouter();

  const [filterVisible, setFilterVisible] = useState(false);

  const headerAnim   = useFadeIn(0);
  const goalAnim     = useFadeIn(120);
  const continueAnim = useFadeIn(200);
  const statsAnim    = useFadeIn(280);
  const recentAnim   = useFadeIn(360);

  // İlk açılışta kategori + dokümanları yükle (bir kez)
  useEffect(() => {
    fetchCategories();
    fetchDocuments(selectedExam, selectedDifficulty);
  }, []);

  // Her ana sayfaya dönüşte istatistikleri ve favorileri tazala
  // 800ms gecikme: PDF kapatılınca study_history POST ateşleniyor; DB yazımı
  // tamamlanmadan önce stats sorgusu çekilirse eski veri gelir.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      const t = setTimeout(() => {
        fetchUserStats(token);
        fetchFavorites(token);
      }, 800);
      return () => clearTimeout(t);
    }, [token])
  );


  // Kişiselleştirilmiş öneriler
  const targetScore = user?.target_score ?? null;

  const recommendedDifficulty: Difficulty | null = useMemo(() => {
    if (targetScore === null) return null;
    if (targetScore >= 80) return 'İleri';
    if (targetScore >= 65) return 'Orta';
    return 'Başlangıç';
  }, [targetScore]);

  const recommendedDocs = useMemo<ApiDocument[]>(() => {
    if (!recommendedDifficulty) return [];
    const openedIds = new Set(recentHistory.map(h => h.document_id));

    // Hedef zorluk seviyesi, açılmayanlar önce
    const primary = documents.filter(
      d => d.difficulty === recommendedDifficulty && !openedIds.has(d.id)
    );
    if (primary.length >= 4) return primary.slice(0, 4);

    // Yeterli değilse komşu zorluk seviyesinden tamamla
    const fallback: Difficulty = recommendedDifficulty === 'Başlangıç' ? 'Orta'
      : recommendedDifficulty === 'İleri' ? 'Orta' : 'Başlangıç';
    const extra = documents.filter(
      d => d.difficulty === fallback && !openedIds.has(d.id)
    );
    return [...primary, ...extra].slice(0, 4);
  }, [documents, recentHistory, recommendedDifficulty]);

  const handleDocPress = useCallback((doc: ApiDocument) => {
    router.push(`/pdf/${doc.id}`);
  }, [router]);

  const hours = Math.floor(studyMinutes / 60);
  const mins  = studyMinutes % 60;
  const studyLabel = studyMinutes > 0 ? `${hours}sa ${mins}dk` : '—';

  const goalMin      = user?.daily_goal_min ?? 0;
  const showGoalCard = goalMin > 0;
  const showStreak   = streakDays > 0 && !showGoalCard;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* ── HEADER ── */}
      <LinearGradient colors={gradients.header} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <Animated.View style={[styles.headerTop, headerAnim]}>
            <Text style={styles.greeting}>{getGreeting(user?.name ?? 'Öğrenci')}</Text>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleDarkMode(); }}
              style={styles.themeBtn}
            >
              <Feather name={dark ? 'sun' : 'moon'} size={19} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={headerAnim}>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); router.push('/search'); }}
              activeOpacity={0.85}
              style={styles.searchBtn}
            >
              <Feather name="search" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.searchBtnText}>PDF, konu veya kelime ara...</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.pillRow, headerAnim]}>
            {EXAM_TYPES.map((exam) => (
              <ExamPill key={exam} label={exam} active={selectedExam === exam} onPress={() => setSelectedExam(exam)} />
            ))}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); setFilterVisible(true); }}
              style={[styles.filterBtn, selectedDifficulty && { backgroundColor: c.primary, borderColor: c.primary }]}
              activeOpacity={0.8}
            >
              <Feather name="sliders" size={13} color={selectedDifficulty ? '#fff' : 'rgba(255,255,255,0.75)'} />
              <Text style={[styles.filterBtnText, selectedDifficulty && { color: '#fff' }]}>
                {selectedDifficulty ?? 'Filtrele'}
              </Text>
              {selectedDifficulty && (
                <TouchableOpacity
                  hitSlop={8}
                  onPress={(e) => { e.stopPropagation(); Haptics.selectionAsync(); setSelectedDifficulty(null); }}
                >
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>

      <FilterBottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedDifficulty={selectedDifficulty}
        onSelectDifficulty={setSelectedDifficulty}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── GÜNLÜK HEDEF / SERİ ── */}
        {(showGoalCard || showStreak) && (
          <Animated.View style={goalAnim}>
            {showGoalCard
              ? <DailyGoalCard streakDays={streakDays} todayStudySec={todayStudySec} goalMin={goalMin} c={c} />
              : <StreakOnlyCard streakDays={streakDays} c={c} />
            }
          </Animated.View>
        )}

        {/* ── KALDIQIN YERDEN DEVAM ET ── */}
        {recentHistory.length > 0 && (
          <Animated.View style={continueAnim}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Kaldığın Yerden Devam Et</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
              {recentHistory.map((item) => (
                <ContinueCard
                  key={item.document_id}
                  item={item}
                  onPress={() => router.push(`/pdf/${item.document_id}`)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── İSTATİSTİKLER ── */}
        <Animated.View style={statsAnim}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>İstatistikler</Text>
          <View style={styles.statsRow}>
            <StatsCard icon="clock"     value={studyLabel}                   label="Toplam Çalışma" gradient={['#667EEA', '#764BA2']} />
            <View style={{ width: 12 }} />
            <StatsCard icon="file-text" value={String(openedDocs)}           label="Açılan Doküman" gradient={['#F093FB', '#F5576C']} />
            <View style={{ width: 12 }} />
            <StatsCard icon="download"  value={String(downloadedIds.length)} label="İndirilen PDF"  gradient={['#4ECDC4', '#2BAE9E']} />
          </View>
        </Animated.View>

        {/* ── SANA ÖZEL ── */}
        {recommendedDifficulty !== null && (
          <Animated.View style={recentAnim}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Sana Özel</Text>
              <View style={[styles.recoBadge, { backgroundColor: c.primary + '22' }]}>
                <Feather name="target" size={12} color={c.primary} />
                <Text style={[styles.recoBadgeText, { color: c.primary }]}>{recommendedDifficulty} · {targetScore} hedef</Text>
              </View>
            </View>
            {recommendedDocs.length > 0 ? (
              recommendedDocs.map((doc, i) => (
                <RecentDocCard key={doc.id} doc={doc} isDark={dark} index={i} onPress={() => handleDocPress(doc)} />
              ))
            ) : (
              <View style={[styles.recoAllDoneBox, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={styles.recoAllDoneEmoji}>🎉</Text>
                <Text style={[styles.recoAllDoneTitle, { color: c.text }]}>
                  Bu seviyedeki tüm dokümanları açtın!
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/categories' as any)}
                  style={[styles.recoAllDoneBtn, { backgroundColor: c.primary + '22' }]}
                >
                  <Text style={[styles.recoAllDoneBtnText, { color: c.primary }]}>Diğer kategorilere bak →</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── TÜM DOKÜMANLAR ── */}
        <Animated.View style={recentAnim}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              {recommendedDocs.length > 0 ? 'Tüm Dokümanlar' : 'Son Eklenenler'}
            </Text>
            <View style={[styles.examTag, { backgroundColor: c.primary + '22' }]}>
              <Text style={[styles.examTagText, { color: c.primary }]}>{selectedExam}</Text>
            </View>
          </View>

          {isLoadingDocuments ? (
            <View style={[styles.emptyBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>Yükleniyor...</Text>
            </View>
          ) : documents.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Feather name="inbox" size={32} color={c.textTertiary} />
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>Henüz doküman yok</Text>
            </View>
          ) : (
            documents.map((doc, i) => (
              <RecentDocCard key={doc.id} doc={doc} isDark={dark} index={i} onPress={() => handleDocPress(doc)} />
            ))
          )}
        </Animated.View>

        {/* ── FEATURED BANNER ── */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        >
          <LinearGradient colors={gradients.btn} style={styles.banner}>
            <View style={styles.bannerDecor} />
            <View style={styles.bannerDecor2} />
            <View style={styles.bannerContent}>
              <View style={styles.bannerBadge}>
                <Feather name="zap" size={13} color="#fff" />
                <Text style={styles.bannerBadgeText}>YENİ</Text>
              </View>
              <Text style={styles.bannerTitle}>YÖKDİL 2025{'\n'}Hazırlık Paketi</Text>
              <Text style={styles.bannerSub}>120+ soru, 8 tam deneme, kapsamlı konu anlatımları</Text>
              <View style={styles.bannerBtn}>
                <Text style={[styles.bannerBtnText, { color: c.primary }]}>Keşfet</Text>
                <Feather name="arrow-right" size={14} color={c.primary} />
              </View>
            </View>
            <View style={styles.bannerRight}>
              <View style={styles.bannerIconBig}>
                <Feather name="book-open" size={36} color="rgba(255,255,255,0.35)" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:           { flex: 1 },
  header:         { paddingBottom: 14 },
  safeHeader:     { paddingHorizontal: 20, gap: 10 },
  headerTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  greeting:       { fontSize: 16, color: '#FFFFFF', fontWeight: '700', flex: 1 },
  headerTitle:    { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  themeBtn:       { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  pillRow:        { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pill:           { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 50, borderWidth: 1 },
  pillActive:     { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  pillInactive:   { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' },
  pillText:       { fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  pillTextInactive:{ color: 'rgba(255,255,255,0.7)' },
  searchBtn:      { flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14 },
  searchBtnText:  { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  filterBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)' },
  filterBtnActive:{ backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  filterBtnText:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },

  scroll:         { flex: 1 },
  scrollContent:  { paddingHorizontal: 20, paddingTop: 24, gap: 24 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:   { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, marginBottom: 14 },
  seeAll:         { fontSize: 13, color: '#6C63FF', fontWeight: '600', marginBottom: 14 },
  examTag:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 14 },
  examTagText:    { fontSize: 11, fontWeight: '700', color: '#6C63FF', letterSpacing: 0.5 },
  recoBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 14 },
  recoBadgeText:  { fontSize: 11, fontWeight: '700', color: '#6C63FF' },
  recoAllDoneBox: { borderRadius: 18, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  recoAllDoneEmoji: { fontSize: 32 },
  recoAllDoneTitle: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  recoAllDoneBtn:   { marginTop: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#6C63FF22' },
  recoAllDoneBtnText: { fontSize: 13, fontWeight: '700', color: '#6C63FF' },
  statsRow:       { flexDirection: 'row' },
  emptyBox:       { alignItems: 'center', justifyContent: 'center', padding: 40, borderRadius: 18, borderWidth: 1, gap: 12 },
  emptyText:      { fontSize: 14, fontWeight: '500' },

  // Daily Goal Card
  goalCard:       { borderRadius: 20, padding: 20, gap: 12 },
  goalHeader:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  goalTitle:      { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 3 },
  goalSub:        { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  streakBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  streakEmoji:    { fontSize: 18, lineHeight: 22 },
  streakText:     { fontSize: 20, fontWeight: '800', color: '#fff' },
  streakUnit:     { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  progressTrack:  { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 4, backgroundColor: '#6C63FF', minWidth: 8 },
  progressPct:    { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textAlign: 'right' },
  goalTip:        { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' },

  // Bottom Sheet
  bsBackdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 100 },
  bsSheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, zIndex: 101, gap: 16 },
  bsHandle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  bsTitle:       { fontSize: 18, fontWeight: '800' },
  bsLabel:       { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  bsChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bsChip:        { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)', backgroundColor: 'rgba(108,99,255,0.08)' },
  bsChipActiveNeutral: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  bsChipText:    { fontSize: 14, fontWeight: '600' },
  bsDot:         { width: 8, height: 8, borderRadius: 4 },
  bsActions:     { flexDirection: 'row', gap: 12, marginTop: 8 },
  bsResetBtn:    { flex: 1, paddingVertical: 14, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bsResetText:   { fontSize: 15, fontWeight: '600' },
  bsApplyBtn:    { flex: 2, borderRadius: 16, overflow: 'hidden' },
  bsApplyGrad:   { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  bsApplyText:   { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Continue Card
  continueCard:   { width: (SCREEN_W - 64) / 2.2, borderRadius: 18, overflow: 'hidden' },
  continueGrad:   { padding: 16, minHeight: 180, justifyContent: 'space-between' },
  continueIconWrap:{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  continueTitle:  { fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 19, flex: 1 },
  continueMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  continueMetaText:{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  continueBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginTop: 10 },
  continueBtnText:{ fontSize: 12, fontWeight: '700', color: '#fff' },

  // Banner
  banner:         { borderRadius: 22, padding: 22, flexDirection: 'row', overflow: 'hidden', minHeight: 150 },
  bannerDecor:    { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -30 },
  bannerDecor2:   { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, right: 60 },
  bannerContent:  { flex: 1, gap: 8 },
  bannerBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 2 },
  bannerBadgeText:{ fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  bannerTitle:    { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 26 },
  bannerSub:      { fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 17 },
  bannerBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 6 },
  bannerBtnText:  { fontSize: 13, fontWeight: '700', color: '#6C63FF' },
  bannerRight:    { justifyContent: 'center', paddingLeft: 10 },
  bannerIconBig:  { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
});
