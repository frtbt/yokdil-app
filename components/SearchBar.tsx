import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  isDark: boolean;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChangeText,
  isDark,
  placeholder = 'PDF, konu veya kelime ara...',
}: Props) {
  const c = isDark ? Colors.dark : Colors.light;

  return (
    <View style={[styles.container, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
      <Feather name="search" size={18} color={c.textTertiary} style={styles.icon} />
      <TextInput
        style={[styles.input, { color: c.text }]}
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={[styles.clearBtn, { backgroundColor: c.textTertiary }]}>
            <Feather name="x" size={12} color={isDark ? '#0F0F1A' : '#fff'} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  icon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
