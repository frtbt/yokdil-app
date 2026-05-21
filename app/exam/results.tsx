import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useExamStore } from '../../store/useExamStore';
import type { QuestionCorrection } from '../../store/useExamStore';
import { useTheme } from '../../store/useTheme';

function formatTime(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
}

function getScoreColor(pct: number): string {
  if (pct >= 70) return '#43E97B';
  if (pct >= 50) return '#FF9A3C';
  return '#F5576C';
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// ─── QuestionRow ──────────────────────────────────────────────────────────────
interface QuestionRowProps {
  correction: QuestionCorrection;
  index: number;
}

function QuestionRow({ correction, index }: QuestionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { colors: c, dark } = useTheme();

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded((v) => !v);
  };

  const openVideo = () => {
    if (!correction.video_url) return;
    const ytId = extractYouTubeId(correction.video_url);
    const url  = ytId
      ? `https://www.youtube.com/watch?v=${ytId}`
      : correction.video_url;
    Linking.openURL(url);
  };

  const rowBg = correction.is_correct
    ? (dark ? '#0E2217' : '#F0FFF5')
    : correction.your_answer === null
      ? (dark ? '#1A1A2E' : '#F3F4F6')
      : (dark ? '#2A1A1E' : '#FFF0F2');

  const statusColor = correction.is_correct ? '#43E97B'
                    : correction.your_answer === null ? '#9CA3AF'
                    : '#F5576C';

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.85}
      style={[styles.qRow, { backgroundColor: rowBg, borderColor: c.border }]}
    >
      {/* Collapsed header */}
      <View style={styles.qRowHeader}>
        <View style={[styles.qNum, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.qNumText, { color: statusColor }]}>{index + 1}</Text>
        </View>
        <Text style={[styles.qSummaryText, { color: c.text }]} numberOfLines={1}>
          {correction.question_text}
        </Text>
        <Feather
          name={correction.is_correct ? 'check-circle' : correction.your_answer === null ? 'minus-circle' : 'x-circle'}
          size={18}
          color={statusColor}
        />
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.textTertiary} />
      </View>

      {/* Expanded content */}
      {expanded && (
        <View style={[styles.qExpanded, { borderTopColor: c.border }]}>
          <Text style={[styles.qFullText, { color: c.text }]}>{correction.question_text}</Text>

          <View style={styles.optionsList}>
            {Object.entries(correction.options).map(([letter, text]) => {
              const isCorrect  = letter === correction.correct_answer;
              const isYourWrong = letter === correction.your_answer && !correction.is_correct;
              const bg = isCorrect  ? (dark ? '#0E2217' : '#F0FFF5')
                       : isYourWrong ? (dark ? '#2A1A1E' : '#FFF0F2')
                       : 'transparent';
              const borderClr = isCorrect ? '#43E97B' : isYourWrong ? '#F5576C' : c.border;
              const txtColor  = isCorrect ? '#43E97B' : isYourWrong ? '#F5576C' : c.textSecondary;

              return (
                <View
                  key={letter}
                  style={[styles.optionExpRow, { backgroundColor: bg, borderColor: borderClr }]}
                >
                  <View style={[styles.optionLetterBadge, { backgroundColor: borderClr + '33' }]}>
                    <Text style={[styles.optionLetter, { color: borderClr }]}>{letter}</Text>
                  </View>
                  <Text style={[styles.optionText, { color: txtColor }]}>{text}</Text>
                  {isCorrect   && <Feather name="check"  size={14} color="#43E97B" />}
                  {isYourWrong && <Feather name="x"      size={14} color="#F5576C" />}
                </View>
              );
            })}
          </View>

          {/* Answer summary */}
          <View style={styles.answerSummary}>
            <Text style={[styles.answerSummaryText, { color: c.textSecondary }]}>
              Cevabınız:{' '}
              <Text style={{ color: correction.your_answer === null ? '#9CA3AF' : correction.is_correct ? '#43E97B' : '#F5576C', fontWeight: '700' }}>
                {correction.your_answer ?? 'Boş'}
              </Text>
              {'  '}Doğru cevap:{' '}
              <Text style={{ color: '#43E97B', fontWeight: '700' }}>{correction.correct_answer}</Text>
            </Text>
          </View>

          {/* Explanation */}
          {correction.explanation ? (
            <View style={[styles.explanationBox, { backgroundColor: dark ? '#1E1C3A' : '#EEF0FF', borderColor: c.primary + '44' }]}>
              <Feather name="info" size={14} color="#7C73FF" style={{ marginTop: 2 }} />
              <Text style={[styles.explanationText, { color: dark ? '#C4C0FF' : '#4A47A3' }]}>
                {correction.explanation}
              </Text>
            </View>
          ) : null}

          {/* Video button */}
          {correction.video_url ? (
            <TouchableOpacity
              onPress={openVideo}
              activeOpacity={0.85}
              style={styles.videoBtn}
            >
              <Feather name="youtube" size={16} color="#fff" />
              <Text style={styles.videoBtnText}>Video Çözüm</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────
export default function ResultsScreen() {
  const { colors: c, dark, gradients } = useTheme();

  const router      = useRouter();
  const { lastResult, activeExam } = useExamStore();

  if (!lastResult) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <Feather name="alert-circle" size={48} color="#F5576C" />
        <Text style={[styles.noResultTitle, { color: c.text }]}>Sonuç bulunamadı</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)' as never)} style={[styles.homeBtn, { backgroundColor: c.primary }]}>
          <Text style={styles.homeBtnText}>Ana Sayfaya Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { score, total, percentage, time_spent_seconds, corrections } = lastResult;
  const wrong   = corrections.filter((c) => !c.is_correct && c.your_answer !== null).length;
  const empty   = corrections.filter((c) => c.your_answer === null).length;
  const correct = score;
  const scoreColor = getScoreColor(percentage);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <LinearGradient colors={gradients.header} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)' as never)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={22} color="#9CA3AF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sonuçlar</Text>
            <View style={{ width: 30 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Score card */}
        <View style={[styles.scoreCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
            <Text style={[styles.scorePercent, { color: scoreColor }]}>
              {percentage.toFixed(0)}%
            </Text>
            <Text style={[styles.scoreLabel, { color: c.textSecondary }]}>başarı</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Feather name="check-circle" size={20} color="#43E97B" />
              <Text style={[styles.statValue, { color: '#43E97B' }]}>{correct}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Doğru</Text>
            </View>
            <View style={styles.statBox}>
              <Feather name="x-circle" size={20} color="#F5576C" />
              <Text style={[styles.statValue, { color: '#F5576C' }]}>{wrong}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Yanlış</Text>
            </View>
            <View style={styles.statBox}>
              <Feather name="minus-circle" size={20} color="#9CA3AF" />
              <Text style={[styles.statValue, { color: '#9CA3AF' }]}>{empty}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Boş</Text>
            </View>
            <View style={styles.statBox}>
              <Feather name="clock" size={20} color="#7C73FF" />
              <Text style={[styles.statValue, { color: '#7C73FF' }]}>{formatTime(time_spent_seconds)}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Süre</Text>
            </View>
          </View>

          <View style={[styles.totalRow, { borderTopColor: c.border }]}>
            <Text style={[styles.totalText, { color: c.textSecondary }]}>
              {score} / {total} soru doğru
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {activeExam ? (
            <TouchableOpacity
              onPress={() => router.replace(`/exam/${activeExam.id}` as never)}
              activeOpacity={0.85}
              style={[styles.actionBtn, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Feather name="refresh-cw" size={16} color={c.primary} />
              <Text style={[styles.actionBtnText, { color: c.primary }]}>Tekrar Çöz</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)' as never)}
            activeOpacity={0.85}
            style={[styles.actionBtn, { backgroundColor: c.primary }]}
          >
            <Feather name="home" size={16} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Ana Sayfaya Dön</Text>
          </TouchableOpacity>
        </View>

        {/* Section header */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>Soru Çözümleri</Text>

        {/* Questions list */}
        {corrections.map((correction, idx) => (
          <QuestionRow
            key={correction.question_id}
            correction={correction}
            index={idx}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  noResultTitle: { fontSize: 18, fontWeight: '700' },
  homeBtn:   { backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  homeBtnText: { color: '#fff', fontWeight: '700' },

  header: {},
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#F0F2FF' },

  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },

  scoreCard: {
    borderRadius: 20, borderWidth: 1, padding: 24,
    alignItems: 'center', gap: 20,
  },
  scoreCircle: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  scorePercent: { fontSize: 30, fontWeight: '800' },
  scoreLabel:   { fontSize: 12, marginTop: 2 },

  statsGrid: { flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'space-around' },
  statBox:   { alignItems: 'center', gap: 4, flex: 1 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500' },

  totalRow: { width: '100%', paddingTop: 16, borderTopWidth: 1, alignItems: 'center' },
  totalText: { fontSize: 14 },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 4, marginBottom: 2 },

  qRow:    { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  qRowHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
  },
  qNum: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  qNumText: { fontSize: 12, fontWeight: '700' },
  qSummaryText: { flex: 1, fontSize: 13, fontWeight: '500' },

  qExpanded: { borderTopWidth: 1, padding: 14, gap: 12 },
  qFullText: { fontSize: 14, lineHeight: 22, fontWeight: '500' },

  optionsList: { gap: 6 },
  optionExpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 10, borderWidth: 1.5,
  },
  optionLetterBadge: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  optionLetter: { fontSize: 13, fontWeight: '700' },
  optionText:   { flex: 1, fontSize: 13, lineHeight: 18 },

  answerSummary: { paddingTop: 4 },
  answerSummaryText: { fontSize: 13, lineHeight: 20 },

  explanationBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  explanationText: { flex: 1, fontSize: 13, lineHeight: 20 },

  videoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#FF0000', paddingVertical: 10, borderRadius: 10,
  },
  videoBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
