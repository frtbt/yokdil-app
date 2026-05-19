import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  useColorScheme, ActivityIndicator, TextInput, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import type { ApiDocument } from '../store/useAppStore';
import { Colors } from '../constants/Colors';
import { EXAM_TYPES } from '../constants/Data';
import type { ExamType } from '../constants/Data';
import { ENDPOINTS } from '../constants/Api';
import RecentDocCard from '../components/RecentDocCard';
import type { Exam } from '../store/useExamStore';

type ExamFilter = ExamType | 'Tümü';
type SearchTab  = 'docs' | 'exams';

export default function SearchScreen() {
  const router = useRouter();
  const systemScheme = useColorScheme();
  const { isDarkMode } = useAppStore();
  const { token } = useAuthStore();
  const dark = isDarkMode ?? systemScheme === 'dark';
  const c = dark ? Colors.dark : Colors.light;

  const [query, setQuery]           = useState('');
  const [tab, setTab]               = useState<SearchTab>('docs');
  const [examFilter, setExamFilter] = useState<ExamFilter>('Tümü');
  const [docResults, setDocResults] = useState<ApiDocument[] | null>(null);
  const [examResults, setExamResults] = useState<Exam[] | null>(null);
  const [loading, setLoading]       = useState(false);
  const inputRef    = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  const doSearch = useCallback(async (q: string, exam: ExamFilter, activeTab: SearchTab) => {
    if (q.trim().length < 2) {
      setDocResults(null);
      setExamResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (activeTab === 'docs') {
        const params = new URLSearchParams({ search: q.trim() });
        if (exam !== 'Tümü') params.set('exam_type', exam);
        const res  = await fetch(`${ENDPOINTS.documents}?${params}`);
        const json = await res.json();
        setDocResults(json.success ? (json.data as ApiDocument[]) : []);
      } else {
        const params = new URLSearchParams({ search: q.trim() });
        if (exam !== 'Tümü') params.set('exam_type', exam);
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res  = await fetch(`${ENDPOINTS.exams}?${params}`, { headers });
        const json = await res.json();
        setExamResults(json.success ? (json.data as Exam[]) : []);
      }
    } catch {
      if (activeTab === 'docs') setDocResults([]);
      else setExamResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setDocResults(null);
      setExamResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(query, examFilter, tab), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, examFilter, tab]);

  const results    = tab === 'docs' ? docResults : examResults;
  const hasQuery   = query.trim().length >= 2;
  const isEmpty    = hasQuery && !loading && results !== null && results.length === 0;
  const showResult = hasQuery && !loading && results !== null && results.length > 0;

  const handleTabChange = (t: SearchTab) => {
    Haptics.selectionAsync();
    setTab(t);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* ── Başlık ── */}
      <SafeAreaView
        edges={['top']}
        style={[styles.header, { backgroundColor: dark ? '#0F0F1A' : '#fff', borderBottomColor: c.border }]}
      >
        {/* Arama satırı */}
        <View style={styles.searchRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-left" size={22} color={dark ? '#fff' : '#0F0F1A'} />
          </TouchableOpacity>

          <View style={[styles.inputWrap, { backgroundColor: dark ? '#1A1A3E' : '#F0F2FF', borderColor: c.border }]}>
            <Feather name="search" size={16} color={c.textTertiary} />
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: c.text }]}
              placeholder="Başlık, konu veya kelime ara..."
              placeholderTextColor={c.textTertiary}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => { setQuery(''); setDocResults(null); setExamResults(null); inputRef.current?.focus(); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.clearBtn, { backgroundColor: c.textTertiary }]}>
                  <Feather name="x" size={11} color={dark ? '#0A0A14' : '#fff'} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Dokümanlar / Denemeler sekmeleri */}
        <View style={[styles.tabRow, { borderBottomColor: c.border }]}>
          {(['docs', 'exams'] as SearchTab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => handleTabChange(t)}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            >
              <Feather
                name={t === 'docs' ? 'file-text' : 'clipboard'}
                size={14}
                color={tab === t ? '#6C63FF' : c.textTertiary}
              />
              <Text style={[styles.tabText, { color: tab === t ? '#6C63FF' : c.textTertiary }]}>
                {t === 'docs' ? 'Dokümanlar' : 'Denemeler'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sınav tipi pilleri */}
        <View style={styles.pillRow}>
          {(['Tümü', ...EXAM_TYPES] as ExamFilter[]).map((exam) => (
            <TouchableOpacity
              key={exam}
              onPress={() => { Haptics.selectionAsync(); setExamFilter(exam); }}
              style={[
                styles.pill,
                examFilter === exam
                  ? styles.pillActive
                  : { backgroundColor: dark ? '#1A1A3E' : '#F0F2FF', borderColor: c.border },
              ]}
            >
              <Text style={[styles.pillText, { color: examFilter === exam ? '#fff' : c.textSecondary }]}>
                {exam}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {/* ── İçerik ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : !hasQuery ? (
        <View style={styles.center}>
          <View style={[styles.hintIcon, { backgroundColor: dark ? '#1A1A3E' : '#F0F2FF' }]}>
            <Feather name="search" size={32} color="#6C63FF" />
          </View>
          <Text style={[styles.hintTitle, { color: c.text }]}>Ne aramak istiyorsun?</Text>
          <Text style={[styles.hintSub, { color: c.textSecondary }]}>
            {tab === 'docs'
              ? 'Başlık, konu, kelime veya sınav adıyla doküman arayabilirsin.'
              : 'Deneme adı veya konusuyla test arayabilirsin.'}
          </Text>
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <View style={[styles.hintIcon, { backgroundColor: dark ? '#1A1A3E' : '#F0F2FF' }]}>
            <Feather name="inbox" size={32} color={c.textTertiary} />
          </View>
          <Text style={[styles.hintTitle, { color: c.text }]}>Sonuç bulunamadı</Text>
          <Text style={[styles.hintSub, { color: c.textSecondary }]}>
            "{query}"{examFilter !== 'Tümü' ? ` · ${examFilter}` : ''} için eşleşen{' '}
            {tab === 'docs' ? 'doküman' : 'deneme'} yok.
          </Text>
        </View>
      ) : showResult && tab === 'docs' ? (
        <FlatList
          data={docResults!}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: c.textSecondary }]}>
              {docResults!.length} doküman bulundu{examFilter !== 'Tümü' ? ` · ${examFilter}` : ''}
            </Text>
          }
          renderItem={({ item, index }) => (
            <RecentDocCard
              doc={item}
              isDark={dark}
              index={index}
              onPress={() => { Keyboard.dismiss(); router.push(`/pdf/${item.id}`); }}
            />
          )}
          ListFooterComponent={<View style={{ height: 32 }} />}
        />
      ) : showResult && tab === 'exams' ? (
        <FlatList
          data={examResults!}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: c.textSecondary }]}>
              {examResults!.length} deneme bulundu{examFilter !== 'Tümü' ? ` · ${examFilter}` : ''}
            </Text>
          }
          renderItem={({ item }) => (
            <ExamCard exam={item} isDark={dark} c={c} onPress={() => { Keyboard.dismiss(); router.push(`/exam/${item.id}`); }} />
          )}
          ListFooterComponent={<View style={{ height: 32 }} />}
        />
      ) : null}
    </View>
  );
}

// ─── ExamCard ─────────────────────────────────────────────────────────────────

const EXAM_COLORS: Record<string, string> = {
  'YÖKDİL': '#6C63FF',
  'YDS':    '#F5576C',
  'YDT':    '#4ECDC4',
};
const DIFF_COLORS: Record<string, string> = {
  'Başlangıç': '#43E97B',
  'Orta':      '#F7971E',
  'İleri':     '#F5576C',
};

function ExamCard({
  exam, isDark, c, onPress,
}: {
  exam: Exam;
  isDark: boolean;
  c: typeof Colors.dark;
  onPress: () => void;
}) {
  const examColor  = EXAM_COLORS[exam.exam_type] ?? '#6C63FF';
  const diffColor  = DIFF_COLORS[exam.difficulty]  ?? '#6C63FF';
  const completed  = exam.user_completed;
  const pct        = exam.user_best_pct;
  const scoreColor = pct !== null
    ? (pct >= 70 ? '#43E97B' : pct >= 50 ? '#FF9A3C' : '#F5576C')
    : '#43E97B';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[examCardStyles.card, { backgroundColor: c.surface, borderColor: completed ? scoreColor + '55' : c.border }]}
    >
      <View style={[examCardStyles.iconWrap, { backgroundColor: (completed ? scoreColor : examColor) + '20' }]}>
        <Feather name={completed ? 'check-circle' : 'clipboard'} size={20} color={completed ? scoreColor : examColor} />
      </View>

      <View style={{ flex: 1, gap: 5 }}>
        <View style={examCardStyles.badgeRow}>
          <View style={[examCardStyles.badge, { backgroundColor: examColor + '20' }]}>
            <Text style={[examCardStyles.badgeText, { color: examColor }]}>{exam.exam_type}</Text>
          </View>
          <View style={[examCardStyles.badge, { backgroundColor: diffColor + '20' }]}>
            <Text style={[examCardStyles.badgeText, { color: diffColor }]}>{exam.difficulty}</Text>
          </View>
          {completed && (
            <View style={[examCardStyles.badge, { backgroundColor: scoreColor + '20' }]}>
              <Text style={[examCardStyles.badgeText, { color: scoreColor }]}>
                ✓{pct !== null ? ` %${pct}` : ' Çözüldü'}
              </Text>
            </View>
          )}
        </View>

        <Text style={[examCardStyles.title, { color: c.text }]} numberOfLines={2}>
          {exam.title}
        </Text>

        <View style={examCardStyles.meta}>
          <Feather name="help-circle" size={11} color={c.textTertiary} />
          <Text style={[examCardStyles.metaText, { color: c.textTertiary }]}>
            {exam.question_count} soru
          </Text>
          <Text style={[examCardStyles.dot, { color: c.textTertiary }]}>·</Text>
          <Feather name="clock" size={11} color={c.textTertiary} />
          <Text style={[examCardStyles.metaText, { color: c.textTertiary }]}>
            {exam.duration_minutes} dk
          </Text>
        </View>
      </View>

      <View style={[examCardStyles.startBtn, { backgroundColor: completed ? scoreColor + '22' : examColor }]}>
        <Text style={[examCardStyles.startText, { color: completed ? scoreColor : '#fff' }]}>
          {completed ? 'Tekrar' : 'Başla'}
        </Text>
        <Feather name={completed ? 'refresh-cw' : 'arrow-right'} size={13} color={completed ? scoreColor : '#fff'} />
      </View>
    </TouchableOpacity>
  );
}

const examCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  iconWrap:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeRow:  { flexDirection: 'row', gap: 6 },
  badge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  title:     { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  meta:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:  { fontSize: 11 },
  dot:       { fontSize: 11 },
  startBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  startText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 0, gap: 10 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, height: 46,
  },
  input:    { flex: 1, fontSize: 15 },
  clearBtn: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  tabRow:    { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: -16 },
  tabBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#6C63FF' },
  tabText:   { fontSize: 13, fontWeight: '600' },

  pillRow: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  pill:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  pillText: { fontSize: 12, fontWeight: '700' },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  hintIcon:  { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  hintTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  hintSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  list:        { padding: 16 },
  resultCount: { fontSize: 12, fontWeight: '600', marginBottom: 10, letterSpacing: 0.3 },
});
