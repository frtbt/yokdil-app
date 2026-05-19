import React, { useRef, useEffect, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { CategoryColors } from '../constants/Colors';
import type { Category, CategoryType } from '../constants/Data';
import type { ComponentProps } from 'react';

type FeatherName = ComponentProps<typeof Feather>['name'];

const ICON_MAP: Record<CategoryType, FeatherName> = {
  konu:     'book-open',
  deneme:   'file-text',
  strateji: 'target',
  kelime:   'list',
  ceviri:   'refresh-cw',
  poster:   'layout',
};

interface Props {
  category: Category;
  isDark: boolean;
  index: number;
  onPress: (id: CategoryType) => void;
}

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

export default function CategoryCard({ category, isDark, index, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const colors = CategoryColors[category.id as keyof typeof CategoryColors] ?? CategoryColors.konu;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
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
    onPress(category.id as CategoryType);
  }, [category.id, onPress]);

  const iconName = ICON_MAP[category.id as CategoryType] ?? 'file';

  return (
    <Animated.View style={[{ width: CARD_W, opacity, transform: [{ scale }, { translateY }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <LinearGradient
          colors={colors.gradient as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.iconContainer}>
            <Feather name={iconName} size={24} color="#fff" />
          </View>
          <Text style={styles.count}>{category.count} Doküman</Text>
          <Text style={styles.title}>{category.title}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>{category.subtitle}</Text>
          <View style={styles.arrow}>
            <Feather name="arrow-right" size={16} color="rgba(255,255,255,0.7)" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    minHeight: 160,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  count: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    lineHeight: 15,
  },
  arrow: {
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
