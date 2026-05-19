import React, { useRef, useEffect, useCallback } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Colors, DifficultyColors } from '../constants/Colors';
import { useAppStore } from '../store/useAppStore';
import type { ApiDocument } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import type { Difficulty } from '../constants/Data';
import HeartButton from './HeartButton';

const EXAM_COLORS: Record<string, string> = {
  'YÖKDİL': '#6C63FF',
  'YDS':    '#F5576C',
  'YDT':    '#4ECDC4',
};

export interface DocItem {
  id: number | string;
  title: string;
  subtitle?: string;
  exam_type?: string;
  examType?: string;
  pages: number;
  file_size?: string;
  size?: string;
  thumbnail_color?: string;
  thumbnailColor?: string;
  is_new?: boolean;
  isNew?: boolean;
  isDownloaded?: boolean;
  addedAt?: string;
  created_at?: string;
  difficulty?: Difficulty;
  video_url?: string | null;
  has_video?: boolean;
  view_count?: number;
}

interface Props {
  doc: DocItem;
  isDark: boolean;
  index: number;
  onPress: (doc: DocItem) => void;
}

export default function RecentDocCard({ doc, isDark, index, onPress }: Props) {
  const c = isDark ? Colors.dark : Colors.light;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(20)).current;

  const { favoriteIds, toggleFavorite } = useAppStore();
  const { token } = useAuthStore();
  const docId = Number(doc.id);
  const isFavorite = favoriteIds.includes(docId);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, damping: 14, useNativeDriver: true }),
      ]).start();
    }, 300 + index * 60);
    return () => clearTimeout(timer);
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  }, []);
  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress(doc);
  }, [doc, onPress]);

  const handleFavoritePress = useCallback(() => {
    toggleFavorite(docId, token ?? undefined, doc as unknown as ApiDocument);
  }, [docId, token, doc, toggleFavorite]);

  const examType   = doc.exam_type  ?? doc.examType  ?? 'YÖKDİL';
  const isNew      = doc.is_new     ?? doc.isNew     ?? false;
  const hasVideo   = doc.has_video  ?? (!!doc.video_url) ?? false;
  const thumbColor = doc.thumbnail_color ?? doc.thumbnailColor ?? '#6C63FF';
  const examColor  = EXAM_COLORS[examType] || '#6C63FF';
  const difficulty = doc.difficulty;
  const viewCount  = doc.view_count ?? 0;
  const diffColors = difficulty ? DifficultyColors[difficulty] : null;

  return (
    <Animated.View style={{ opacity, transform: [{ scale }, { translateX }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.shadow }]}
      >
        {/* Thumbnail */}
        <View style={[styles.thumb, { backgroundColor: thumbColor + '22' }]}>
          <Feather name={hasVideo ? 'play-circle' : 'file-text'} size={22} color={thumbColor} />
          {isNew && (
            <View style={[styles.newBadge, { backgroundColor: examColor }]}>
              <Text style={styles.newText}>YENİ</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          {/* Top row: exam badge + difficulty + video */}
          <View style={styles.topRow}>
            <View style={[styles.examBadge, { backgroundColor: examColor + '22' }]}>
              <Text style={[styles.examText, { color: examColor }]}>{examType}</Text>
            </View>
            {diffColors && (
              <View style={[
                styles.diffBadge,
                { backgroundColor: isDark ? diffColors.darkBg : diffColors.bg },
              ]}>
                <Text style={[styles.diffText, { color: isDark ? diffColors.darkText : diffColors.text }]}>
                  {difficulty}
                </Text>
              </View>
            )}
            {hasVideo && (
              <View style={styles.videoBadge}>
                <Feather name="youtube" size={10} color="#FF0000" />
                <Text style={styles.videoText}>Video</Text>
              </View>
            )}
          </View>

          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
            {doc.title}
          </Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>
            {doc.subtitle}
          </Text>

          {/* Meta: pages + view count */}
          <View style={styles.meta}>
            <Feather name="file-text" size={10} color={c.textTertiary} />
            <Text style={[styles.metaText, { color: c.textTertiary }]}>{doc.pages} sayfa</Text>
            {viewCount > 0 && (
              <>
                <Text style={[styles.dot, { color: c.textTertiary }]}>·</Text>
                <Feather name="eye" size={10} color={c.textTertiary} />
                <Text style={[styles.metaText, { color: c.textTertiary }]}>{viewCount}</Text>
              </>
            )}
            {doc.file_size && (
              <>
                <Text style={[styles.dot, { color: c.textTertiary }]}>·</Text>
                <Text style={[styles.metaText, { color: c.textTertiary }]}>{doc.file_size}</Text>
              </>
            )}
          </View>
        </View>

        {/* Right: favorite + chevron */}
        <View style={styles.rightCol}>
          <HeartButton
            isFavorite={isFavorite}
            onPress={handleFavoritePress}
            size={16}
            inactiveColor={c.textTertiary}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          />
          <Feather name="chevron-right" size={16} color={c.textTertiary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  newText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  info: { flex: 1, gap: 3 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  examBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  examText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  diffBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  diffText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#FFF0F0',
  },
  videoText: { fontSize: 9, fontWeight: '700', color: '#FF0000' },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  subtitle: { fontSize: 12, lineHeight: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 11 },
  dot: { fontSize: 11 },
  rightCol: { alignItems: 'center', gap: 8 },
});
