import React, { useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import type { ApiCategory } from '../../store/useAppStore';
import { Colors, CategoryColors } from '../../constants/Colors';
import { useTheme } from '../../store/useTheme';
import type { ComponentProps } from 'react';
import type { CategoryType } from '../../constants/Data';

type FeatherName = ComponentProps<typeof Feather>['name'];

const ICON_MAP: Record<string, FeatherName> = {
  konu:     'book-open',
  deneme:   'file-text',
  strateji: 'target',
  kelime:   'list',
  ceviri:   'refresh-cw',
  poster:   'layout',
};

function AnimatedCard({
  item,
  index,
  isDark,
  onPress,
}: {
  item: ApiCategory;
  index: number;
  isDark: boolean;
  onPress: (slug: string) => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const colors = CategoryColors[item.slug as keyof typeof CategoryColors] ?? CategoryColors.konu;
  const iconName = ICON_MAP[item.slug] ?? 'folder';

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: true }),
      ]).start();
    }, index * 80);
    return () => clearTimeout(timer);
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  }, []);
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item.slug);
  }, [item.slug, onPress]);

  return (
    <Animated.View style={[styles.cardWrap, { opacity, transform: [{ scale }, { translateY }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <LinearGradient
          colors={colors.gradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.iconWrap}>
            <Feather name={iconName} size={26} color="#fff" />
          </View>

          <View style={styles.countRow}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{item.count ?? 0}</Text>
            </View>
            <Text style={styles.countLabel}>Doküman</Text>
          </View>

          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>{item.subtitle}</Text>

          <View style={styles.arrowBtn}>
            <Feather name="arrow-right" size={14} color="rgba(255,255,255,0.8)" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CategoriesScreen() {
  const { colors: c, dark, gradients } = useTheme();
  const { categories, isLoadingCategories, fetchCategories } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (categories.length === 0) fetchCategories();
  }, []);

  const handleCategoryPress = useCallback((slug: string) => {
    router.push(`/category/${slug}` as any);
  }, [router]);

  const handleSearchPress = useCallback(() => {
    Haptics.selectionAsync();
    router.push('/search' as any);
  }, [router]);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <LinearGradient colors={gradients.header} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Kategoriler</Text>
              <Text style={styles.headerSub}>Tüm çalışma materyalleri · {categories.length} kategori</Text>
            </View>
            <TouchableOpacity onPress={handleSearchPress} style={styles.searchIconBtn} activeOpacity={0.8}>
              <Feather name="search" size={20} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {isLoadingCategories ? (
        <View style={[styles.loadingBox, { backgroundColor: c.background }]}>
          <Text style={[styles.loadingText, { color: c.textSecondary }]}>Yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <AnimatedCard item={item} index={index} isDark={dark} onPress={handleCategoryPress} />
          )}
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingBottom: 24 },
  safeHeader: { paddingHorizontal: 20, paddingTop: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '500', marginTop: 2 },
  searchIconBtn: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, fontWeight: '500' },
  list: { padding: 16, gap: 12 },
  row: { gap: 12 },
  cardWrap: { flex: 1 },
  card: {
    borderRadius: 22,
    padding: 20,
    minHeight: 190,
    justifyContent: 'flex-end',
    gap: 4,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  countText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  countLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff', lineHeight: 21 },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 15 },
  arrowBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
