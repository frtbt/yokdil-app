import React, { useRef, useCallback } from 'react';
import { TouchableWithoutFeedback, View, StyleSheet, Animated, Easing } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const PARTICLE_COUNT = 6;
const BURST_RADIUS   = 18;

interface HeartButtonProps {
  isFavorite: boolean;
  onPress: () => void;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
  style?: ViewStyle;
}

export default function HeartButton({
  isFavorite,
  onPress,
  size          = 18,
  activeColor   = '#F5576C',
  inactiveColor = '#9CA3AF',
  hitSlop,
  style,
}: HeartButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    if (!isFavorite) {
      // Favoriting: hızlı büyü → spring ile geri gel
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.4,
          duration: 110,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1.0,
          bounciness: 10,
          speed: 14,
          useNativeDriver: true,
        }),
      ]).start();

      // Parçacık patlaması
      burst.stopAnimation();
      burst.setValue(0);
      Animated.timing(burst, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) burst.setValue(0);
      });
    } else {
      // Unfavoriting: küçül → spring ile geri gel
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.75,
          duration: 80,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1.0,
          bounciness: 8,
          speed: 16,
          useNativeDriver: true,
        }),
      ]).start();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [isFavorite, onPress, scale, burst]);

  // Her parçacığın fırlatma açısı ve mesafesi
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * 2 * Math.PI - Math.PI / 2;
    return {
      tx: Math.cos(angle) * BURST_RADIUS,
      ty: Math.sin(angle) * BURST_RADIUS,
    };
  });

  return (
    <TouchableWithoutFeedback onPress={handlePress} hitSlop={hitSlop}>
      <View style={[styles.wrapper, style]}>

        {/* Parçacıklar */}
        {particles.map(({ tx, ty }, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { alignItems: 'center', justifyContent: 'center' },
              {
                opacity: burst.interpolate({
                  inputRange:  [0, 0.1, 0.65, 1],
                  outputRange: [0, 1,   0.85, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    translateX: burst.interpolate({
                      inputRange: [0, 1], outputRange: [0, tx], extrapolate: 'clamp',
                    }),
                  },
                  {
                    translateY: burst.interpolate({
                      inputRange: [0, 1], outputRange: [0, ty], extrapolate: 'clamp',
                    }),
                  },
                  {
                    scale: burst.interpolate({
                      inputRange:  [0,   0.3, 1  ],
                      outputRange: [0.3, 1.1, 0.4],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: activeColor }]} />
          </Animated.View>
        ))}

        {/* Kalp ikonu */}
        <Animated.View style={{ transform: [{ scale }] }}>
          <Feather
            name="heart"
            size={size}
            color={isFavorite ? activeColor : inactiveColor}
          />
        </Animated.View>

      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dot:     { width: 5, height: 5, borderRadius: 2.5 },
});
