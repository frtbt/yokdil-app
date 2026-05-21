import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Switch, Animated, ScrollView, Alert, Dimensions, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../store/useTheme';
import type { ComponentProps } from 'react';
import type { RecentHistoryItem } from '../../store/useAppStore';
import {
  loadPrefs, savePrefs, scheduleDailyReminder, cancelReminder, requestPermission,
  type NotificationPrefs,
} from '../../services/notifications';

const SCREEN_W = Dimensions.get('window').width;

function isoToDisplay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }
  return iso;
}

type FeatherName = ComponentProps<typeof Feather>['name'];

export default function ProfileScreen() {
  const { colors: c, dark, isFuatBaskanMode, gradients } = useTheme();
  const { toggleDarkMode, toggleFuatBaskanMode,
          studyMinutes, todayStudySec, openedDocs, downloadedIds,
          favoriteIds, streakDays, recentHistory, isLoadingStats,
          fetchUserStats, weeklyData, examBreakdown, diffBreakdown,
          examsTaken, bestScore, avgScore, totalQuestionsAnswered } = useAppStore();
  const { user, token, logout, fetchProfile } = useAuthStore();
  const hours = Math.floor(studyMinutes / 60);

  useEffect(() => {
    if (token) {
      fetchUserStats(token);
      fetchProfile();
    }
  }, [token]);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({ enabled: false, hour: 20, minute: 0 });

  useEffect(() => {
    loadPrefs().then(setNotifPrefs);
  }, []);

  const toggleNotifications = async (val: boolean) => {
    const newPrefs = { ...notifPrefs, enabled: val };
    if (val) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('İzin Gerekli', 'Bildirimlere izin vermek için ayarları aç.');
        return;
      }
      await scheduleDailyReminder(newPrefs, user?.daily_goal_min ?? 0);
    } else {
      await cancelReminder();
    }
    await savePrefs(newPrefs);
    setNotifPrefs(newPrefs);
  };

  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  const avatarLetter = user?.name?.[0]?.toUpperCase() ?? '?';
  const displayName  = user?.name  ?? 'Kullanıcı';
  const displayEmail = user?.email ?? '';

  function handleLogout() {
    Alert.alert('Çıkış Yap', 'Hesabından çıkmak istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: () => { logout(); router.replace('/(auth)'); },
      },
    ]);
  }

  // Daily goal progress (0–1)
  const goalMin      = user?.daily_goal_min ?? 0;
  const todayMin     = Math.round(todayStudySec / 60);
  const goalProgress = goalMin > 0 ? Math.min(todayMin / goalMin, 1) : 0;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* ── Header ── */}
      <LinearGradient colors={gradients.header} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.avatar}>
            <LinearGradient colors={gradients.btn} style={styles.avatarGrad}>
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            </LinearGradient>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          {!!displayEmail && <Text style={styles.email}>{displayEmail}</Text>}

          <View style={styles.statRow}>
            {[
              { label: 'Saat',    value: String(hours) },
              { label: 'Doküman', value: String(openedDocs) },
              { label: 'Favori',  value: String(favoriteIds.length) },
              { label: 'İndirilen', value: String(downloadedIds.length) },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
          {streakDays > 0 && (
            <View style={styles.streakRow}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakCount}>{streakDays}</Text>
              <Text style={styles.streakLabel}>günlük seri</Text>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>

          {/* ── Profil Kartı ── */}
          <View style={[styles.profileCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.profileCardHeader}>
              <Text style={[styles.profileCardTitle, { color: c.text }]}>Profil Bilgileri</Text>
              <TouchableOpacity
                onPress={() => router.push('/profile/edit')}
                style={[styles.editBtn, { backgroundColor: c.primary + '15' }]}
                activeOpacity={0.75}
              >
                <Feather name="edit-2" size={14} color={c.primary} />
                <Text style={[styles.editBtnText, { color: c.primary }]}>Düzenle</Text>
              </TouchableOpacity>
            </View>

            <InfoRow icon="home" label="Üniversite / Kurum" value={user?.university || null} c={c} />
            <InfoRow
              icon="book-open"
              label="Sınav Türü"
              value={user?.target_exam_type || null}
              c={c}
            />
            <InfoRow
              icon="target"
              label="Hedef Puan"
              value={user?.target_score
                ? `${user.target_score} / ${user.target_exam_type === 'YDT' ? '500' : '100'}`
                : null}
              c={c}
            />
            <InfoRow icon="calendar" label="Sınav Tarihi" value={isoToDisplay(user?.target_exam_date)} c={c} />

            {/* Daily goal + progress */}
            <View style={[styles.infoRow, { borderTopColor: c.border }]}>
              <View style={[styles.infoIcon, { backgroundColor: c.primary + '15' }]}>
                <Feather name="clock" size={16} color={c.primary} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.infoRowTop}>
                  <Text style={[styles.infoLabel, { color: c.textSecondary }]}>Günlük Hedef</Text>
                  <Text style={[styles.infoValue, { color: user?.daily_goal_min ? c.text : c.textTertiary }]}>
                    {user?.daily_goal_min ? formatGoal(user.daily_goal_min) : 'Belirtilmedi'}
                  </Text>
                </View>
                {goalMin > 0 && (
                  <View style={[styles.progressBar, { backgroundColor: c.border }]}>
                    <View style={[styles.progressFill, { width: `${goalProgress * 100}%`, backgroundColor: c.primary }]} />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ── Son Çalışılanlar ── */}
          {recentHistory.length > 0 && (
            <RecentHistorySection history={recentHistory} c={c} />
          )}

          {/* ── Grafikler ── */}
          {isLoadingStats ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator color={c.primary} />
              <Text style={[styles.statsLoadingText, { color: c.textSecondary }]}>İstatistikler yükleniyor…</Text>
            </View>
          ) : (
            <StatsCharts weeklyData={weeklyData} examBreakdown={examBreakdown} diffBreakdown={diffBreakdown} isDark={dark} c={c} />
          )}

          {/* ── Deneme İstatistikleri ── */}
          {examsTaken > 0 && (
            <ExamStatsCard
              examsTaken={examsTaken}
              bestScore={bestScore}
              avgScore={avgScore}
              totalQuestions={totalQuestionsAnswered}
              c={c}
              dark={dark}
            />
          )}

          {/* ── Çalışma Planı ── */}
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); router.push('/study-plan'); }}
            activeOpacity={0.85}
            style={styles.planCard}
          >
            <LinearGradient
              colors={gradients.btn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.planCardInner}
            >
              <View style={styles.planCardLeft}>
                <Text style={styles.planCardTitle}>Haftalık Çalışma Planı</Text>
                <Text style={styles.planCardSub}>
                  Hedefe göre kişisel plan oluştur
                </Text>
              </View>
              <View style={styles.planCardIcon}>
                <Feather name="calendar" size={22} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Ayarlar ── */}
          <Text style={[styles.sectionTitle, { color: c.textSecondary, marginTop: 28 }]}>AYARLAR</Text>
          <View style={styles.group}>
            <SettingRow
              icon="moon" label="Karanlık Mod"
              hasToggle toggleValue={dark}
              onToggle={() => { Haptics.selectionAsync(); toggleDarkMode(); }}
              isDark={dark}
            />
            <SettingRow
              icon="star" label="Fuat Başkan Modu"
              hasToggle toggleValue={isFuatBaskanMode}
              onToggle={() => { Haptics.selectionAsync(); toggleFuatBaskanMode(); }}
              isDark={dark} accent="#e67e22"
            />
            <SettingRow
              icon="bell" label="Günlük Hatırlatıcı"
              hasToggle toggleValue={notifPrefs.enabled}
              onToggle={toggleNotifications}
              isDark={dark} accent="#F5576C"
            />
            <SettingRow icon="download" label="Offline Depolama"   value={`${downloadedIds.length} PDF`} isDark={dark} accent="#4ECDC4" />
            <SettingRow icon="info"     label="Uygulama Hakkında"  value="v1.0.0" isDark={dark} accent="#43E97B" />
          </View>

          {/* ── Hesap ── */}
          <Text style={[styles.sectionTitle, { color: c.textSecondary, marginTop: 28 }]}>HESAP</Text>
          <View style={styles.group}>
            <SettingRow icon="log-out" label="Çıkış Yap" onPress={handleLogout} isDark={dark} danger />
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── RecentHistorySection ────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)}g önce`;
}

function RecentHistorySection({ history, c }: { history: RecentHistoryItem[]; c: typeof Colors.dark }) {
  return (
    <View style={{ marginTop: 28 }}>
      <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>SON ÇALIŞILANLAR</Text>
      <View style={{ gap: 8 }}>
        {history.slice(0, 5).map((item) => {
          const durationMin = Math.round(item.duration_sec / 60);
          return (
            <TouchableOpacity
              key={item.document_id}
              onPress={() => { Haptics.selectionAsync(); router.push(`/pdf/${item.document_id}` as never); }}
              activeOpacity={0.8}
              style={[recentStyles.row, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <View style={[recentStyles.thumb, { backgroundColor: (item.thumbnail_color ?? c.primary) + '25' }]}>
                <Feather name="file-text" size={16} color={item.thumbnail_color ?? c.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[recentStyles.title, { color: c.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={recentStyles.meta}>
                  <Feather name="clock" size={10} color={c.textTertiary} />
                  <Text style={[recentStyles.metaText, { color: c.textTertiary }]}>
                    {durationMin > 0 ? `${durationMin} dk` : '< 1 dk'}
                  </Text>
                  <Text style={[recentStyles.dot, { color: c.textTertiary }]}>·</Text>
                  <Text style={[recentStyles.metaText, { color: c.textTertiary }]}>
                    {timeAgo(item.opened_at)}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={c.textTertiary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const recentStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  thumb: {
    width: 40, height: 40, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { fontSize: 13, fontWeight: '600' },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  dot:      { fontSize: 11 },
});

// ─── StatsCharts ─────────────────────────────────────────────────────────────

const EXAM_COLORS: Record<string, string> = {
  'YÖKDİL': '#6C63FF',
  'YDS':    '#F5576C',
  'YDT':    '#4ECDC4',
};
const DIFF_COLORS_MAP: Record<string, string> = {
  'Başlangıç': '#43E97B',
  'Orta':      '#F7971E',
  'İleri':     '#F5576C',
};
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

interface ChartProps {
  weeklyData: import('../../store/useAppStore').WeeklyDataItem[];
  examBreakdown: import('../../store/useAppStore').ExamBreakdownItem[];
  diffBreakdown: import('../../store/useAppStore').DiffBreakdownItem[];
  isDark: boolean;
  c: typeof Colors.dark;
}

function StatsCharts({ weeklyData, examBreakdown, diffBreakdown, isDark, c }: ChartProps) {
  const { colors: t } = useTheme();
  const chartW = SCREEN_W - 40;
  const hasWeekly = weeklyData.some(d => d.minutes > 0);
  const hasExam   = examBreakdown.length > 0;
  const hasDiff   = diffBreakdown.length > 0;

  if (!hasWeekly && !hasExam && !hasDiff) {
    return (
      <View style={[chartStyles.emptyBox, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Feather name="bar-chart-2" size={32} color={c.textTertiary} />
        <Text style={[chartStyles.emptyText, { color: c.textSecondary }]}>
          Henüz çalışma verisi yok.{'\n'}PDF okumaya başlayınca grafikler burada görünecek.
        </Text>
      </View>
    );
  }

  // Bar chart verisi: 7 gün
  const barData = weeklyData.map((d) => {
    const dayIndex = new Date(d.date).getDay(); // 0=Sun
    const label = DAYS_TR[dayIndex === 0 ? 6 : dayIndex - 1];
    return {
      value:        d.minutes,
      label,
      frontColor:   d.minutes > 0 ? t.primary : (isDark ? '#2A2A3E' : '#E5E7EB'),
      topLabelComponent: d.minutes > 0
        ? () => <Text style={{ color: t.primary, fontSize: 9, fontWeight: '700' }}>{d.minutes}dk</Text>
        : undefined,
    };
  });

  // Pie chart: sınav tipi
  const examPieData = examBreakdown.map((e) => ({
    value:  e.minutes,
    color:  EXAM_COLORS[e.exam_type] ?? '#999',
    text:   e.exam_type,
  }));

  // Pie chart: zorluk
  const diffPieData = diffBreakdown.map((d) => ({
    value:  d.doc_count,
    color:  DIFF_COLORS_MAP[d.difficulty] ?? '#999',
    text:   d.difficulty,
  }));

  return (
    <View style={{ gap: 24, marginTop: 28 }}>
      <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>İSTATİSTİKLER</Text>

      {/* ── Haftalık çalışma bar grafiği ── */}
      {hasWeekly && (
        <View style={[chartStyles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[chartStyles.cardTitle, { color: c.text }]}>Haftalık Çalışma</Text>
          <Text style={[chartStyles.cardSub, { color: c.textSecondary }]}>Son 7 gün (dakika)</Text>
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <BarChart
              data={barData}
              width={chartW - 48}
              height={160}
              barWidth={28}
              spacing={12}
              roundedTop
              hideRules
              xAxisThickness={1}
              xAxisColor={c.border}
              yAxisThickness={0}
              yAxisTextStyle={{ color: c.textTertiary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: c.textTertiary, fontSize: 10 }}
              noOfSections={4}
              isAnimated
            />
          </View>
        </View>
      )}

      {/* ── Sınav tipi dağılımı ── */}
      {hasExam && (
        <View style={[chartStyles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[chartStyles.cardTitle, { color: c.text }]}>Sınav Tipi Dağılımı</Text>
          <Text style={[chartStyles.cardSub, { color: c.textSecondary }]}>Toplam çalışma süresine göre</Text>
          <View style={chartStyles.pieRow}>
            <PieChart
              data={examPieData}
              donut
              radius={70}
              innerRadius={44}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>Toplam</Text>
                  <Text style={{ color: t.primary, fontSize: 13, fontWeight: '800' }}>
                    {examBreakdown.reduce((s, e) => s + e.minutes, 0)}dk
                  </Text>
                </View>
              )}
              isAnimated
            />
            <View style={chartStyles.legend}>
              {examBreakdown.map((e) => (
                <View key={e.exam_type} style={chartStyles.legendItem}>
                  <View style={[chartStyles.legendDot, { backgroundColor: EXAM_COLORS[e.exam_type] ?? '#999' }]} />
                  <Text style={[chartStyles.legendText, { color: c.text }]}>{e.exam_type}</Text>
                  <Text style={[chartStyles.legendVal, { color: c.textSecondary }]}>{e.minutes}dk</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ── Zorluk dağılımı ── */}
      {hasDiff && (
        <View style={[chartStyles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[chartStyles.cardTitle, { color: c.text }]}>Zorluk Dağılımı</Text>
          <Text style={[chartStyles.cardSub, { color: c.textSecondary }]}>Okunan doküman sayısına göre</Text>
          <View style={chartStyles.pieRow}>
            <PieChart
              data={diffPieData}
              donut
              radius={70}
              innerRadius={44}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>Doküman</Text>
                  <Text style={{ color: '#43E97B', fontSize: 13, fontWeight: '800' }}>
                    {diffBreakdown.reduce((s, d) => s + d.doc_count, 0)}
                  </Text>
                </View>
              )}
              isAnimated
            />
            <View style={chartStyles.legend}>
              {diffBreakdown.map((d) => (
                <View key={d.difficulty} style={chartStyles.legendItem}>
                  <View style={[chartStyles.legendDot, { backgroundColor: DIFF_COLORS_MAP[d.difficulty] ?? '#999' }]} />
                  <Text style={[chartStyles.legendText, { color: c.text }]}>{d.difficulty}</Text>
                  <Text style={[chartStyles.legendVal, { color: c.textSecondary }]}>{d.doc_count} doküman</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  card:       { borderRadius: 20, borderWidth: 1, padding: 18 },
  cardTitle:  { fontSize: 15, fontWeight: '700' },
  cardSub:    { fontSize: 12, marginTop: 2 },
  pieRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 20 },
  legend:     { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontSize: 13, fontWeight: '600' },
  legendVal:  { fontSize: 12 },
  emptyBox:   { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12, marginTop: 28 },
  emptyText:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGoal(min: number): string {
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InfoRowProps {
  icon: FeatherName;
  label: string;
  value: string | null;
  c: typeof Colors.dark;
}
function InfoRow({ icon, label, value, c }: InfoRowProps) {
  const { colors: t } = useTheme();
  return (
    <View style={[styles.infoRow, { borderTopColor: c.border }]}>
      <View style={[styles.infoIcon, { backgroundColor: t.primary + '15' }]}>
        <Feather name={icon} size={16} color={t.primary} />
      </View>
      <View style={styles.infoRowTop}>
        <Text style={[styles.infoLabel, { color: c.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: value ? c.text : c.textTertiary }]}>
          {value ?? 'Belirtilmedi'}
        </Text>
      </View>
    </View>
  );
}

interface SettingRowProps {
  icon: FeatherName;
  label: string;
  value?: string;
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  isDark: boolean;
  accent?: string;
  danger?: boolean;
}
function SettingRow({ icon, label, value, hasToggle, toggleValue, onToggle, onPress, isDark, accent, danger }: SettingRowProps) {
  const { colors: c } = useTheme();
  const defaultAccent = c.primary;
  const color = danger ? '#F5576C' : (accent ?? defaultAccent);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.row, { backgroundColor: c.surface, borderColor: danger ? '#F5576C30' : c.border }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: color + '20' }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? '#F5576C' : c.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: c.textSecondary }]}>{value}</Text> : null}
        {hasToggle ? (
          <Switch
            value={toggleValue}
            onValueChange={onToggle}
            trackColor={{ false: c.border, true: c.primary }}
            thumbColor="#fff"
          />
        ) : onPress ? (
          <Feather name="chevron-right" size={18} color={danger ? '#F5576C80' : c.textTertiary} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── ExamStatsCard ────────────────────────────────────────────────────────────

interface ExamStatsCardProps {
  examsTaken: number;
  bestScore: number;
  avgScore: number;
  totalQuestions: number;
  c: typeof Colors.dark;
  dark: boolean;
}

function ExamStatsCard({ examsTaken, bestScore, avgScore, totalQuestions, c }: ExamStatsCardProps) {
  const { colors: t } = useTheme();
  const scoreColor = bestScore >= 70 ? '#43E97B' : bestScore >= 50 ? '#FF9A3C' : '#F5576C';

  const items = [
    { icon: 'clipboard' as FeatherName, label: 'Çözülen',   value: String(examsTaken),     color: t.primary },
    { icon: 'award'     as FeatherName, label: 'En Yüksek',  value: `%${bestScore}`,        color: scoreColor },
    { icon: 'bar-chart-2' as FeatherName, label: 'Ortalama', value: `%${avgScore}`,         color: '#F7971E' },
    { icon: 'check-square' as FeatherName, label: 'Soru',    value: String(totalQuestions), color: '#4ECDC4' },
  ];

  return (
    <View style={[examCardStyles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={examCardStyles.header}>
        <View style={examCardStyles.headerLeft}>
          <View style={[examCardStyles.iconWrap, { backgroundColor: t.primary + '20' }]}>
            <Feather name="clipboard" size={16} color={t.primary} />
          </View>
          <Text style={[examCardStyles.title, { color: c.text }]}>Deneme İstatistikleri</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/exams' as never)}>
          <Text style={[examCardStyles.link, { color: t.primary }]}>Tümü →</Text>
        </TouchableOpacity>
      </View>
      <View style={examCardStyles.grid}>
        {items.map((item) => (
          <View key={item.label} style={[examCardStyles.cell, { borderColor: c.border }]}>
            <View style={[examCardStyles.cellIcon, { backgroundColor: item.color + '20' }]}>
              <Feather name={item.icon} size={14} color={item.color} />
            </View>
            <Text style={[examCardStyles.cellValue, { color: c.text }]}>{item.value}</Text>
            <Text style={[examCardStyles.cellLabel, { color: c.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const examCardStyles = StyleSheet.create({
  card:       { borderRadius: 20, borderWidth: 1, padding: 18, marginTop: 20 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap:   { width: 28, height: 28, borderRadius: 8, backgroundColor: '#6C63FF20', alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 15, fontWeight: '700' },
  link:       { fontSize: 12, fontWeight: '600', color: '#6C63FF' },
  grid:       { flexDirection: 'row', gap: 10 },
  cell:       { flex: 1, alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, gap: 6 },
  cellIcon:   { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cellValue:  { fontSize: 17, fontWeight: '800' },
  cellLabel:  { fontSize: 11, fontWeight: '500' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { paddingBottom: 32 },
  safeHeader:   { alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, gap: 6 },
  avatar:       { marginBottom: 4 },
  avatarGrad:   { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name:         { fontSize: 20, fontWeight: '700', color: '#fff' },
  email:        { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  statRow:      { flexDirection: 'row', gap: 24, marginTop: 16 },
  statItem:     { alignItems: 'center', gap: 2 },
  statValue:    { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  streakRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  streakFire:   { fontSize: 14 },
  streakCount:  { fontSize: 15, fontWeight: '800', color: '#fff' },
  streakLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  statsLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 32 },
  statsLoadingText: { fontSize: 13, fontWeight: '500' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  profileCard:       { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  profileCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  profileCardTitle:  { fontSize: 15, fontWeight: '700' },
  editBtn:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#6C63FF15' },
  editBtnText:       { fontSize: 13, fontWeight: '600', color: '#6C63FF' },

  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  infoRowTop: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoIcon:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoLabel:  { fontSize: 13, fontWeight: '500' },
  infoValue:  { fontSize: 14, fontWeight: '600' },

  progressBar:  { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#6C63FF' },

  planCard:       { marginTop: 28, borderRadius: 20, overflow: 'hidden' },
  planCardInner:  { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 },
  planCardLeft:   { flex: 1 },
  planCardTitle:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  planCardSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  planCardIcon:   { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  group:        { gap: 10 },
  row:          { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, gap: 12 },
  rowIcon:      { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel:     { flex: 1, fontSize: 15, fontWeight: '500' },
  rowRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue:     { fontSize: 13 },
});
