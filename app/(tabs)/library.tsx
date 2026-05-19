import React, { useState } from 'react';
import type { ComponentProps } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import type { ApiDocument } from '../../store/useAppStore';
import { Colors } from '../../constants/Colors';
import RecentDocCard from '../../components/RecentDocCard';

type Tab = 'downloads' | 'favorites';

export default function LibraryScreen() {
  const systemScheme = useColorScheme();
  const { isDarkMode, downloadedIds, downloadedDocs, favoriteIds, favoriteDocs } = useAppStore();
  const dark = isDarkMode ?? systemScheme === 'dark';
  const c = dark ? Colors.dark : Colors.light;
  const [activeTab, setActiveTab] = useState<Tab>('downloads');

  const downloaded = downloadedIds.map((id) => downloadedDocs[id]).filter(Boolean) as ApiDocument[];
  const favorites  = favoriteIds.map((id) => favoriteDocs[id]).filter(Boolean) as ApiDocument[];
  const list       = activeTab === 'downloads' ? downloaded : favorites;

  const emptyIcon: ComponentProps<typeof Feather>['name'] =
    activeTab === 'downloads' ? 'download-cloud' : 'heart';
  const emptyTitle =
    activeTab === 'downloads' ? 'İndirilmiş PDF Yok' : 'Favori PDF Yok';
  const emptySub =
    activeTab === 'downloads'
      ? 'Ana sayfadan PDF\'leri indirerek offline okuyabilirsin.'
      : 'PDF görüntülerken kalp ikonuna basarak favorilerine ekleyebilirsin.';

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <LinearGradient colors={['#0F0F1A', '#1A1A3E']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <Text style={styles.headerTitle}>Kütüphanem</Text>

          <View style={styles.tabBar}>
            <TabButton
              label="İndirilenler"
              icon="download"
              count={downloaded.length}
              active={activeTab === 'downloads'}
              onPress={() => setActiveTab('downloads')}
            />
            <TabButton
              label="Favoriler"
              icon="heart"
              count={favorites.length}
              active={activeTab === 'favorites'}
              onPress={() => setActiveTab('favorites')}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {list.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Feather name={emptyIcon} size={48} color={c.textTertiary} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>{emptyTitle}</Text>
          <Text style={[styles.emptySub, { color: c.textSecondary }]}>{emptySub}</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <RecentDocCard
              doc={item}
              isDark={dark}
              index={index}
              onPress={() => router.push(`/pdf/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

interface TabButtonProps {
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  count: number;
  active: boolean;
  onPress: () => void;
}

function TabButton({ label, icon, count, active, onPress }: TabButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Feather name={icon} size={14} color={active ? '#fff' : 'rgba(255,255,255,0.5)'} />
      <Text style={[styles.tabLabel, { color: active ? '#fff' : 'rgba(255,255,255,0.5)' }]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.badge, active ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={[styles.badgeText, { color: active ? '#6C63FF' : 'rgba(255,255,255,0.6)' }]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingBottom: 20 },
  safeHeader: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tabBar: { flexDirection: 'row', gap: 10 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tabActive: {
    backgroundColor: 'rgba(108,99,255,0.35)',
    borderColor: 'rgba(108,99,255,0.6)',
  },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeActive: { backgroundColor: '#fff' },
  badgeInactive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  list: { padding: 20 },
  empty: {
    margin: 24, borderRadius: 22, borderWidth: 1,
    padding: 48, alignItems: 'center', gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
