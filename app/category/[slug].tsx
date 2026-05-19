import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  useColorScheme, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../store/useAppStore';
import type { ApiDocument } from '../../store/useAppStore';
import { Colors, CategoryColors } from '../../constants/Colors';
import { EXAM_TYPES } from '../../constants/Data';
import type { ExamType } from '../../constants/Data';
import { ENDPOINTS } from '../../constants/Api';
import RecentDocCard from '../../components/RecentDocCard';
import type { ComponentProps } from 'react';

type FeatherName = ComponentProps<typeof Feather>['name'];

const ICON_MAP: Record<string, FeatherName> = {
  konu:     'book-open',
  deneme:   'file-text',
  strateji: 'target',
  kelime:   'list',
  ceviri:   'refresh-cw',
  poster:   'layout',
};

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const systemScheme = useColorScheme();
  const { isDarkMode, categories, selectedExam } = useAppStore();
  const dark = isDarkMode ?? systemScheme === 'dark';
  const c = dark ? Colors.dark : Colors.light;

  const [activeExam, setActiveExam] = useState<ExamType>(selectedExam);
  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const category  = categories.find((cat) => cat.slug === slug);
  const catColors = CategoryColors[slug as keyof typeof CategoryColors] ?? CategoryColors.konu;
  const iconName  = ICON_MAP[slug ?? ''] ?? 'folder';

  const fetchDocs = useCallback(async (exam: ExamType) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category_slug: slug ?? '', exam_type: exam });
      const res    = await fetch(`${ENDPOINTS.documents}?${params}`);
      const json   = await res.json();
      if (json.success) setDocs(json.data as ApiDocument[]);
    } catch {}
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchDocs(activeExam); }, [activeExam]);

  const handleExamChange = (exam: ExamType) => {
    Haptics.selectionAsync();
    setActiveExam(exam);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <LinearGradient
        colors={catColors.gradient as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); router.push('/search' as any); }}
                style={styles.headerIconWrap}
              >
                <Feather name="search" size={18} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerIconWrap}>
                <Feather name={iconName} size={18} color="#fff" />
              </View>
            </View>
          </View>

          <Text style={styles.headerTitle}>{category?.name ?? slug}</Text>
          <Text style={styles.headerSub}>{category?.subtitle ?? ''}</Text>

          <View style={styles.pillRow}>
            {EXAM_TYPES.map((exam) => (
              <TouchableOpacity
                key={exam}
                onPress={() => handleExamChange(exam)}
                style={[styles.pill, activeExam === exam ? styles.pillActive : styles.pillInactive]}
              >
                <Text style={[
                  styles.pillText,
                  { color: activeExam === exam ? catColors.accent : 'rgba(255,255,255,0.75)' },
                ]}>
                  {exam}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={catColors.accent} />
        </View>
      ) : docs.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Feather name="inbox" size={44} color={c.textTertiary} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>Doküman Bulunamadı</Text>
          <Text style={[styles.emptySub, { color: c.textSecondary }]}>
            Bu kategoride {activeExam} için henüz doküman yok.
          </Text>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <RecentDocCard
              doc={item}
              isDark={dark}
              index={index}
              onPress={() => router.push(`/pdf/${item.id}`)}
            />
          )}
          ListHeaderComponent={
            <Text style={[styles.countLabel, { color: c.textSecondary }]}>
              {docs.length} doküman
            </Text>
          }
          ListFooterComponent={<View style={{ height: 24 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  header:   { paddingBottom: 20 },
  safeHeader: { paddingHorizontal: 20, paddingTop: 8, gap: 6 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 4 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  pillActive:   { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'transparent' },
  pillInactive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' },
  pillText: { fontSize: 13, fontWeight: '700' },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: {
    margin: 24, borderRadius: 22, borderWidth: 1,
    padding: 48, alignItems: 'center', gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  list:       { padding: 16 },
  countLabel: { fontSize: 12, fontWeight: '600', marginBottom: 10, letterSpacing: 0.3 },
});
