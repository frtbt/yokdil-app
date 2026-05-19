import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type FeatherName = ComponentProps<typeof Feather>['name'];

interface Props {
  icon: FeatherName;
  value: string;
  label: string;
  gradient: readonly [string, string];
}

export default function StatsCard({ icon, value, label, gradient }: Props) {
  return (
    <LinearGradient
      colors={gradient as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.iconWrap}>
        <Feather name={icon} size={18} color="rgba(255,255,255,0.9)" />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    lineHeight: 16,
  },
});
