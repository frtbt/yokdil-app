import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useExamStore } from '../../store/useExamStore';
import type { Question } from '../../store/useExamStore';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../store/useTheme';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/Colors';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

function getOptionText(q: Question, label: string): string | null {
  switch (label) {
    case 'A': return q.option_a;
    case 'B': return q.option_b;
    case 'C': return q.option_c;
    case 'D': return q.option_d;
    case 'E': return q.option_e ?? null;
    default:  return null;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ExamScreen() {
  const { id }        = useLocalSearchParams<{ id: string }>();
  const examId        = parseInt(id ?? '0', 10);

  const { colors: c, dark, gradients } = useTheme();

  const router        = useRouter();
  const { token }     = useAuthStore();
  const { activeExam, activeQuestions, loadingDetail, fetchExamDetail, submitExam } = useExamStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft]         = useState<number | null>(null);
  const [submitting, setSubmitting]     = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch exam on mount
  useEffect(() => {
    if (examId > 0) fetchExamDetail(examId);
  }, [examId]);

  // Set up timer once exam loads
  useEffect(() => {
    if (activeExam && timeLeft === null) {
      setTimeLeft(activeExam.duration_minutes * 60);
    }
  }, [activeExam]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const totalTime    = activeExam ? activeExam.duration_minutes * 60 : 1;
  const timeSpentSec = activeExam ? totalTime - (timeLeft ?? totalTime) : 0;

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (submitting) return;

    const doSubmit = async () => {
      stopTimer();
      setSubmitting(true);
      if (!token) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı.');
        setSubmitting(false);
        return;
      }
      const result = await submitExam(examId, answers, timeSpentSec, token);
      setSubmitting(false);
      if (result) {
        router.replace('/exam/results' as never);
      } else {
        Alert.alert('Hata', 'Sonuçlar gönderilemedi. Lütfen tekrar dene.');
      }
    };

    if (autoSubmit) {
      doSubmit();
      return;
    }

    const unanswered = activeQuestions.length - Object.keys(answers).length;
    const msg = unanswered > 0
      ? `${unanswered} soru boş bırakıldı. Yine de teslim etmek istiyor musun?`
      : 'Sınavı teslim etmek istiyor musun?';

    Alert.alert('Sınavı Bitir', msg, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Teslim Et', style: 'default', onPress: doSubmit },
    ]);
  }, [submitting, answers, activeQuestions, token, examId, timeSpentSec]);

  const handleExit = useCallback(() => {
    Alert.alert(
      'Sınavdan Çık',
      'Sınavdan çıkmak istediğine emin misin? İlerlemeniz kaybolacak.',
      [
        { text: 'Kal', style: 'cancel' },
        { text: 'Çık', style: 'destructive', onPress: () => { stopTimer(); router.back(); } },
      ],
    );
  }, [stopTimer]);

  const selectAnswer = (questionId: number, letter: string) => {
    Haptics.selectionAsync();
    setAnswers((prev) => ({ ...prev, [questionId]: letter }));
  };

  const goNext = () => {
    if (currentIndex < activeQuestions.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIndex(currentIndex + 1);
    }
  };
  const goPrev = () => {
    if (currentIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const isLast        = currentIndex === activeQuestions.length - 1;
  const question      = activeQuestions[currentIndex] ?? null;

  const examColor = activeExam
    ? ({ 'YÖKDİL': '#6C63FF', 'YDS': '#F5576C', 'YDT': '#4ECDC4' }[activeExam.exam_type] ?? '#6C63FF')
    : '#6C63FF';

  // Timer warning color
  const timerColor = timeLeft !== null && timeLeft < 60 ? '#F5576C'
                   : timeLeft !== null && timeLeft < 300 ? '#FF9A3C'
                   : '#4ECDC4';

  if (loadingDetail || !activeExam) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>Sınav yükleniyor...</Text>
      </View>
    );
  }

  if (activeQuestions.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <Feather name="alert-circle" size={48} color="#F5576C" />
        <Text style={[styles.emptyTitle, { color: c.text }]}>Soru bulunamadı</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: c.primary }]}>
          <Text style={styles.backBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Submitting overlay */}
      {submitting && (
        <View style={styles.submittingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.submittingText}>Sonuçlar hesaplanıyor...</Text>
        </View>
      )}

      {/* Header */}
      <LinearGradient colors={gradients.header} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleExit} style={styles.exitBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>{activeExam.title}</Text>
              <Text style={styles.headerProgress}>
                {answeredCount}/{activeQuestions.length} cevaplandı
              </Text>
            </View>

            <View style={[styles.timerBadge, { borderColor: timerColor + '44' }]}>
              <Feather name="clock" size={13} color={timerColor} />
              <Text style={[styles.timerText, { color: timerColor }]}>
                {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: examColor,
                  width: `${((currentIndex + 1) / activeQuestions.length) * 100}%`,
                },
              ]}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Question area */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.questionScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Question number + text */}
        <View style={[styles.questionCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.questionNumBadge, { backgroundColor: examColor + '22' }]}>
            <Text style={[styles.questionNumText, { color: examColor }]}>
              Soru {currentIndex + 1} / {activeQuestions.length}
            </Text>
          </View>
          <Text style={[styles.questionText, { color: c.text }]}>
            {question.question_text}
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsWrap}>
          {OPTION_LABELS.map((label) => {
            const text = getOptionText(question, label);
            if (!text) return null;
            const selected = answers[question.id] === label;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => selectAnswer(question.id, label)}
                activeOpacity={0.8}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: selected ? examColor + '22' : c.surface,
                    borderColor:     selected ? examColor : c.border,
                  },
                ]}
              >
                <View style={[styles.optionLabel, { backgroundColor: selected ? examColor : c.surfaceSecondary }]}>
                  <Text style={[styles.optionLabelText, { color: selected ? '#fff' : c.textSecondary }]}>
                    {label}
                  </Text>
                </View>
                <Text style={[styles.optionText, { color: selected ? c.text : c.textSecondary }]}>
                  {text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom navigation */}
      <SafeAreaView edges={['bottom']} style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <TouchableOpacity
          onPress={goPrev}
          disabled={currentIndex === 0}
          style={[styles.navBtn, { opacity: currentIndex === 0 ? 0.35 : 1, backgroundColor: c.surfaceSecondary, borderColor: c.border }]}
        >
          <Feather name="chevron-left" size={20} color={c.textSecondary} />
          <Text style={[styles.navBtnText, { color: c.textSecondary }]}>Önceki</Text>
        </TouchableOpacity>

        {isLast ? (
          <TouchableOpacity
            onPress={() => handleSubmit(false)}
            style={[styles.finishBtn, { backgroundColor: examColor }]}
          >
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.finishBtnText}>Bitir</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={goNext}
            style={[styles.navBtn, { backgroundColor: examColor }]}
          >
            <Text style={[styles.navBtnText, { color: '#fff' }]}>Sonraki</Text>
            <Feather name="chevron-right" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 14, marginTop: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  backBtn:    { backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  backBtnText:{ color: '#fff', fontWeight: '700' },

  submittingOverlay: {
    position: 'absolute', inset: 0, zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  submittingText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  header: { paddingBottom: 0 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10,
  },
  exitBtn:  { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 15, fontWeight: '700', color: '#F0F2FF', textAlign: 'center' },
  headerProgress: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  timerText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  progressBar:  { height: 3, backgroundColor: '#1E1E30', marginTop: 2 },
  progressFill: { height: 3, borderRadius: 2 },

  questionScroll: { padding: 16, paddingBottom: 24, gap: 12 },
  questionCard: {
    borderRadius: 14, borderWidth: 1, padding: 18, gap: 12,
  },
  questionNumBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  questionNumText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  questionText:    { fontSize: 15, lineHeight: 24, fontWeight: '500' },

  optionsWrap: { gap: 8 },
  optionCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 12, borderWidth: 1.5, padding: 12,
  },
  optionLabel: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  optionLabelText: { fontSize: 14, fontWeight: '700' },
  optionText:      { flex: 1, fontSize: 14, lineHeight: 20, paddingTop: 6 },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
    borderTopWidth: 1, gap: 12,
  },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1,
  },
  navBtnText: { fontSize: 14, fontWeight: '600' },
  finishBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 12,
  },
  finishBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
