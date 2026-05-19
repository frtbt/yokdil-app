import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  useColorScheme, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { useAppStore } from '../../store/useAppStore';
import { useExamStore } from '../../store/useExamStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Exam } from '../../store/useExamStore';
import { Colors } from '../../constants/Colors';
import type { ExamType } from '../../constants/Data';

const EXAM_TYPES: ExamType[] = ['YÖKDİL', 'YDS', 'YDT'];

const TR_MONTHS = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function formatExamDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const m = parseInt(parts[1], 10);
  const y = parts[0];
  return `${TR_MONTHS[m] ?? ''} ${y}`;
}

const EXAM_TYPE_COLORS: Record<ExamType, string> = {
  'YÖKDİL': '#6C63FF',
  'YDS':    '#F5576C',
  'YDT':    '#4ECDC4',
};

const DIFF_COLORS: Record<string, string> = {
  'Başlangıç': '#43E97B',
  'Orta':      '#FF9A3C',
  'İleri':     '#F5576C',
};

// ─── ExamPill ─────────────────────────────────────────────────────────────────
interface PillProps { label: ExamType; active: boolean; onPress: () => void }
function ExamPill({ label, active, onPress }: PillProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = EXAM_TYPE_COLORS[label];

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
        style={[
          styles.pill,
          active
            ? { backgroundColor: color, borderColor: color }
            : { backgroundColor: '#13131F', borderColor: '#2A2A3E' },
        ]}
      >
        <Text style={[styles.pillText, { color: active ? '#fff' : '#9CA3AF' }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── ExamCard ─────────────────────────────────────────────────────────────────
interface CardProps { exam: Exam; isDark: boolean; onPress: () => void }
function ExamCard({ exam, isDark, onPress }: CardProps) {
  const c         = isDark ? Colors.dark : Colors.light;
  const color     = EXAM_TYPE_COLORS[exam.exam_type] ?? '#6C63FF';
  const diffColor = DIFF_COLORS[exam.difficulty] ?? '#FF9A3C';
  const completed = exam.user_completed;
  const pct       = exam.user_best_pct;
  const scoreColor = pct !== null
    ? (pct >= 70 ? '#43E97B' : pct >= 50 ? '#FF9A3C' : '#F5576C')
    : '#43E97B';

  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.88}
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: completed ? scoreColor + '55' : c.border },
      ]}
    >
      {/* Top accent */}
      <View style={[styles.cardAccent, { backgroundColor: completed ? scoreColor : color }]} />

      <View style={styles.cardBody}>
        {/* Badges row */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.badgeText, { color }]}>{exam.exam_type}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: diffColor + '22' }]}>
            <Text style={[styles.badgeText, { color: diffColor }]}>{exam.difficulty}</Text>
          </View>
          {completed && (
            <View style={[styles.badge, { backgroundColor: scoreColor + '22', marginLeft: 'auto' }]}>
              <Text style={[styles.badgeText, { color: scoreColor }]}>
                ✓ Çözüldü{pct !== null ? `  %${pct}` : ''}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
          {exam.title}
        </Text>

        {exam.description ? (
          <Text style={[styles.cardDesc, { color: c.textSecondary }]} numberOfLines={1}>
            {exam.description}
          </Text>
        ) : null}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="help-circle" size={13} color={c.textTertiary} />
            <Text style={[styles.statText, { color: c.textSecondary }]}>
              {exam.question_count} soru
            </Text>
          </View>
          <View style={styles.statItem}>
            <Feather name="clock" size={13} color={c.textTertiary} />
            <Text style={[styles.statText, { color: c.textSecondary }]}>
              {exam.duration_minutes} dk
            </Text>
          </View>
          {exam.exam_date ? (
            <View style={styles.statItem}>
              <Feather name="calendar" size={13} color={c.textTertiary} />
              <Text style={[styles.statText, { color: c.textSecondary }]}>
                {formatExamDate(exam.exam_date)}
              </Text>
            </View>
          ) : null}
          {completed && exam.user_attempt_count > 1 && (
            <View style={styles.statItem}>
              <Feather name="refresh-cw" size={13} color={c.textTertiary} />
              <Text style={[styles.statText, { color: c.textSecondary }]}>
                {exam.user_attempt_count}x çözüldü
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
          activeOpacity={0.85}
          style={[styles.startBtn, { backgroundColor: completed ? c.surfaceSecondary : color }]}
        >
          {completed && <Feather name="refresh-cw" size={15} color={completed ? scoreColor : '#fff'} />}
          <Text style={[styles.startBtnText, { color: completed ? scoreColor : '#fff' }]}>
            {completed ? 'Tekrar Çöz' : 'Başla'}
          </Text>
          {!completed && <Feather name="arrow-right" size={15} color="#fff" />}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ExamsScreen() {
  const systemScheme = useColorScheme();
  const { isDarkMode } = useAppStore();
  const dark = isDarkMode ?? systemScheme === 'dark';
  const c    = dark ? Colors.dark : Colors.light;

  const router = useRouter();
  const { token } = useAuthStore();
  const { exams, loadingExams, fetchExams } = useExamStore();

  const [selectedType, setSelectedType] = useState<ExamType>('YÖKDİL');

  useFocusEffect(
    useCallback(() => {
      fetchExams(selectedType, token ?? undefined);
    }, [selectedType, token]),
  );

  const handleTypeChange = (type: ExamType) => {
    setSelectedType(type);
    fetchExams(type, token ?? undefined);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header gradient */}
      <LinearGradient colors={['#0F0F1A', '#1A1A3E']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerInner}>
            <View>
              <Text style={styles.headerTitle}>Denemeler</Text>
              <Text style={styles.headerSub}>Cevap anahtarlı, açıklamalı sınavlar</Text>
            </View>
            <View style={[styles.headerIcon, { backgroundColor: '#6C63FF22' }]}>
              <Feather name="clipboard" size={22} color="#6C63FF" />
            </View>
          </View>

          {/* Exam type pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            {EXAM_TYPES.map((type) => (
              <ExamPill
                key={type}
                label={type}
                active={selectedType === type}
                onPress={() => handleTypeChange(type)}
              />
            ))}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loadingExams ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text style={[styles.loadingText, { color: c.textSecondary }]}>
              Yükleniyor...
            </Text>
          </View>
        ) : exams.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: '#1E1C3A' }]}>
              <Feather name="inbox" size={36} color="#6C63FF" />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              Henüz deneme yok
            </Text>
            <Text style={[styles.emptyDesc, { color: c.textSecondary }]}>
              {selectedType} için aktif deneme bulunmuyor.
            </Text>
          </View>
        ) : (
          exams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              isDark={dark}
              onPress={() => router.push(`/exam/${exam.id}` as never)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingBottom: 16 },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#F0F2FF', letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  headerIcon:  { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  pillsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  pillText: { fontSize: 13, fontWeight: '700' },

  scrollContent: { padding: 16, paddingBottom: 32, gap: 14 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardAccent: { height: 3 },
  cardBody:   { padding: 16, gap: 10 },
  badgeRow:   { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  cardTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  cardDesc:  { fontSize: 13, lineHeight: 18 },

  statsRow: { flexDirection: 'row', gap: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 12, fontWeight: '500' },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  loadingText: { fontSize: 14 },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 14 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc:  { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
