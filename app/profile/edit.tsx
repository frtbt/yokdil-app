import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../store/useTheme';
import type { ComponentProps } from 'react';
import DatePickerField from '../../components/DatePickerField';

type FeatherName = ComponentProps<typeof Feather>['name'];

// YÖKDİL / YDS → 0-100; YDT → 0-500
const SCORE_OPTIONS_100 = [60, 65, 70, 75, 80, 85, 90, 95];
const SCORE_OPTIONS_500 = [300, 350, 375, 400, 425, 450, 475, 500];

function scoreOptionsFor(type: 'YÖKDİL' | 'YDS' | 'YDT' | null) {
  return type === 'YDT' ? SCORE_OPTIONS_500 : SCORE_OPTIONS_100;
}

const GOAL_OPTIONS  = [
  { label: '30 dk', value: 30 },
  { label: '1 sa',  value: 60 },
  { label: '1.5 sa', value: 90 },
  { label: '2 sa',  value: 120 },
];
const EXAM_TYPE_OPTIONS: Array<{ label: 'YÖKDİL' | 'YDS' | 'YDT'; color: string }> = [
  { label: 'YÖKDİL', color: '#6C63FF' },
  { label: 'YDS',    color: '#F5576C' },
  { label: 'YDT',    color: '#4ECDC4' },
];

// GG.AA.YYYY ↔ YYYY-MM-DD dönüşüm yardımcıları
function toDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }
  return iso; // zaten GG.AA.YYYY ise olduğu gibi bırak
}
function toIsoDate(display: string): string | null {
  if (!display.trim()) return null;
  const p = display.split('.');
  if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1]}-${p[0]}`;
  return null;
}

export default function ProfileEditScreen() {
  const { colors: c, gradients } = useTheme();
  const { user, saveProfile } = useAuthStore();

  const [name,        setName]        = useState(user?.name ?? '');
  const [university,  setUniversity]  = useState(user?.university ?? '');
  const [targetScore, setTargetScore] = useState<number | null>(user?.target_score ?? null);
  const [dailyGoal,   setDailyGoal]   = useState<number | null>(user?.daily_goal_min ?? null);
  const [examDate,    setExamDate]    = useState(() => toDisplayDate(user?.target_exam_date));
  const [examType,    setExamType]    = useState<'YÖKDİL' | 'YDS' | 'YDT' | null>(user?.target_exam_type ?? null);
  const [saving,      setSaving]      = useState(false);

  async function handleSave() {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Hata', 'İsim en az 2 karakter olmalı.');
      return;
    }
    setSaving(true);
    const ok = await saveProfile({
      name:              name.trim(),
      university:        university.trim() || null,
      target_score:      targetScore,
      daily_goal_min:    dailyGoal,
      target_exam_date:  toIsoDate(examDate),
      target_exam_type:  examType,
    });
    setSaving(false);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      Alert.alert('Hata', 'Profil kaydedilemedi. İnternet bağlantını kontrol et.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <LinearGradient colors={gradients.header} style={styles.header}>
          <SafeAreaView edges={['top']} style={styles.safeHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
              <Feather name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profili Düzenle</Text>
            <View style={{ width: 46 }} />
          </SafeAreaView>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 60 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Kişisel Bilgiler */}
          <SectionTitle label="KİŞİSEL BİLGİLER" c={c} />
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <FieldRow icon="user" label="İsim" c={c}>
              <TextInput
                style={[styles.input, { color: c.text }]}
                value={name}
                onChangeText={setName}
                placeholder="Adın Soyadın"
                placeholderTextColor={c.textTertiary}
                returnKeyType="next"
              />
            </FieldRow>
            <RowDivider c={c} />
            <FieldRow icon="home" label="Üniversite / Kurum" c={c}>
              <TextInput
                style={[styles.input, { color: c.text }]}
                value={university}
                onChangeText={setUniversity}
                placeholder="Örn: Ankara Üniversitesi"
                placeholderTextColor={c.textTertiary}
                returnKeyType="done"
              />
            </FieldRow>
          </View>

          {/* Sınav Hedefleri */}
          <SectionTitle label="SINAV HEDEFLERİ" c={c} style={{ marginTop: 28 }} />
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <FieldRow icon="book-open" label="Sınav Türü" c={c} alignTop>
              <View style={styles.chips}>
                {EXAM_TYPE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    onPress={() => {
                      Haptics.selectionAsync();
                      const next = examType === opt.label ? null : opt.label;
                      setExamType(next);
                      // Seçilen puan yeni ölçeğe uymuyorsa sıfırla
                      if (targetScore !== null && !scoreOptionsFor(next).includes(targetScore)) {
                        setTargetScore(null);
                      }
                    }}
                    activeOpacity={0.75}
                    style={[
                      styles.chip,
                      examType === opt.label
                        ? { backgroundColor: opt.color, borderColor: opt.color }
                        : { backgroundColor: opt.color + '18', borderColor: opt.color + '44' },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: examType === opt.label ? '#fff' : opt.color }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FieldRow>

            <RowDivider c={c} />

            <FieldRow
              icon="target"
              label={examType === 'YDT' ? 'Hedef Puan  (/ 500)' : 'Hedef Puan  (/ 100)'}
              c={c}
              alignTop
            >
              <View style={styles.chips}>
                {scoreOptionsFor(examType).map((s) => (
                  <Chip
                    key={s}
                    label={String(s)}
                    active={targetScore === s}
                    onPress={() => { Haptics.selectionAsync(); setTargetScore(targetScore === s ? null : s); }}
                  />
                ))}
              </View>
            </FieldRow>

            <RowDivider c={c} />

            <FieldRow icon="clock" label="Günlük Hedef" c={c} alignTop>
              <View style={styles.chips}>
                {GOAL_OPTIONS.map((g) => (
                  <Chip
                    key={g.value}
                    label={g.label}
                    active={dailyGoal === g.value}
                    onPress={() => { Haptics.selectionAsync(); setDailyGoal(dailyGoal === g.value ? null : g.value); }}
                  />
                ))}
              </View>
            </FieldRow>

            <RowDivider c={c} />

            <FieldRow icon="calendar" label="Sınav Tarihi" c={c}>
              <DatePickerField
                value={examDate}
                onChange={setExamDate}
                textColor={c.text}
                placeholderColor={c.textTertiary}
              />
            </FieldRow>
          </View>

          {/* Kaydet */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            style={styles.saveWrap}
          >
            <LinearGradient
              colors={gradients.btn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Kaydet</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────────

function SectionTitle({ label, c, style }: { label: string; c: typeof Colors.dark; style?: object }) {
  return (
    <Text style={[styles.sectionTitle, { color: c.textSecondary }, style]}>
      {label}
    </Text>
  );
}

function RowDivider({ c }: { c: typeof Colors.dark }) {
  return <View style={[styles.divider, { backgroundColor: c.border }]} />;
}

interface FieldRowProps {
  icon: FeatherName;
  label: string;
  c: typeof Colors.dark;
  children: React.ReactNode;
  alignTop?: boolean;
}
function FieldRow({ icon, label, c, children, alignTop }: FieldRowProps) {
  return (
    <View style={[styles.fieldRow, alignTop && { alignItems: 'flex-start' }]}>
      <View style={[styles.fieldIconWrap, { backgroundColor: c.primary + '20' }]}>
        <Feather name={icon} size={16} color={c.primary} />
      </View>
      <View style={styles.fieldContent}>
        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors: c } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        { backgroundColor: c.primary + '15', borderColor: c.primary + '30' },
        active && { backgroundColor: c.primary, borderColor: c.primary },
      ]}
    >
      <Text style={[styles.chipText, { color: c.primary }, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:        { flex: 1 },
  header:      { paddingBottom: 20 },
  safeHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  backBtn:     { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll:      { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle:{ fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  card:        { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  fieldRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  fieldIconWrap:{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fieldContent:{ flex: 1, gap: 4 },
  fieldLabel:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input:       { fontSize: 15, fontWeight: '500', paddingVertical: 0 },
  divider:     { height: 1, marginHorizontal: 16 },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#6C63FF15', borderWidth: 1, borderColor: '#6C63FF30' },
  chipActive:  { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  chipText:    { fontSize: 13, fontWeight: '600', color: '#6C63FF' },
  chipTextActive:{ color: '#fff' },
  saveWrap:    { marginTop: 32, borderRadius: 18, overflow: 'hidden' },
  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
