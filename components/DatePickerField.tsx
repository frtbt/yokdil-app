import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../store/useTheme';

const ITEM_H = 50;
const VISIBLE = 5;

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function daysInMonth(month1: number, year: number): number {
  return new Date(year, month1, 0).getDate();
}

// ─── WheelColumn ──────────────────────────────────────────────────────────────
interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  colWidth: number;
}

function WheelColumn({ items, selectedIndex, onSelect, colWidth }: WheelColumnProps) {
  const { colors: c } = useTheme();
  const ref = useRef<ScrollView>(null);
  const [local, setLocal] = useState(selectedIndex);
  const momentumRef = useRef(false);

  useEffect(() => {
    setLocal(selectedIndex);
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  }, [selectedIndex]);

  const commit = useCallback((y: number) => {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    setLocal(idx);
    onSelect(idx);
    ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
  }, [items.length, onSelect]);

  const onScrollBeginDrag = () => { momentumRef.current = false; };
  const onMomentumScrollBegin = () => { momentumRef.current = true; };
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!momentumRef.current) commit(e.nativeEvent.contentOffset.y);
  };
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    momentumRef.current = false;
    commit(e.nativeEvent.contentOffset.y);
  };

  return (
    <View style={{ width: colWidth, height: ITEM_H * VISIBLE }}>
      {/* selection highlight */}
      <View pointerEvents="none" style={[styles.highlight, { top: ITEM_H * 2, backgroundColor: c.primary + '18', borderColor: c.primary + '33' }]} />
      <ScrollView
        ref={ref}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => {
              setLocal(i);
              onSelect(i);
              ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
            }}
            activeOpacity={0.6}
          >
            <Text style={[
              styles.wheelItem,
              local === i ? [styles.wheelItemSel, { color: c.primary }] : styles.wheelItemDim,
            ]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── DatePickerField ──────────────────────────────────────────────────────────
interface DatePickerFieldProps {
  value: string;            // "GG.AA.YYYY" or ""
  onChange: (v: string) => void;
  textColor: string;
  placeholderColor: string;
  style?: object;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR + i));

function parseValue(v: string) {
  const parts = v.split('.');
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    const yIdx = YEARS.indexOf(String(y));
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && yIdx >= 0) {
      return { dayIdx: d - 1, monthIdx: m - 1, yearIdx: yIdx };
    }
  }
  const today = new Date();
  const yIdx = YEARS.indexOf(String(today.getFullYear()));
  return { dayIdx: today.getDate() - 1, monthIdx: today.getMonth(), yearIdx: Math.max(0, yIdx) };
}

export default function DatePickerField({ value, onChange, textColor, placeholderColor, style }: DatePickerFieldProps) {
  const { colors: c } = useTheme();
  const [visible, setVisible] = useState(false);

  const initial = parseValue(value);
  const [dayIdx,   setDayIdx]   = useState(initial.dayIdx);
  const [monthIdx, setMonthIdx] = useState(initial.monthIdx);
  const [yearIdx,  setYearIdx]  = useState(initial.yearIdx);

  // recompute day list when month/year changes
  const maxDays = daysInMonth(monthIdx + 1, parseInt(YEARS[yearIdx], 10));
  const days    = Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, '0'));

  const clampedDayIdx = Math.min(dayIdx, maxDays - 1);

  const openPicker = () => {
    const parsed = parseValue(value);
    setDayIdx(parsed.dayIdx);
    setMonthIdx(parsed.monthIdx);
    setYearIdx(parsed.yearIdx);
    setVisible(true);
  };

  const confirm = () => {
    const d = clampedDayIdx + 1;
    const m = monthIdx + 1;
    const y = parseInt(YEARS[yearIdx], 10);
    const formatted = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
    onChange(formatted);
    setVisible(false);
  };

  const clear = () => {
    onChange('');
    setVisible(false);
  };

  const displayText = value || '';

  return (
    <>
      <TouchableOpacity onPress={openPicker} activeOpacity={0.7} style={[styles.trigger, style]}>
        {displayText ? (
          <Text style={[styles.triggerText, { color: textColor }]}>{displayText}</Text>
        ) : (
          <Text style={[styles.triggerText, { color: placeholderColor }]}>Tarih Seç</Text>
        )}
        <Feather name="calendar" size={16} color={displayText ? c.primary : placeholderColor} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={clear} hitSlop={8}>
              <Text style={styles.clearBtn}>Temizle</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Tarih Seç</Text>
            <TouchableOpacity onPress={confirm} hitSlop={8}>
              <Text style={[styles.confirmBtn, { color: c.primary }]}>Tamam</Text>
            </TouchableOpacity>
          </View>

          {/* Wheels */}
          <View style={styles.wheels}>
            <WheelColumn
              items={days}
              selectedIndex={clampedDayIdx}
              onSelect={(i) => { setDayIdx(i); }}
              colWidth={72}
            />
            <View style={styles.wheelDivider} />
            <WheelColumn
              items={TR_MONTHS}
              selectedIndex={monthIdx}
              onSelect={(i) => { setMonthIdx(i); if (dayIdx >= daysInMonth(i + 1, parseInt(YEARS[yearIdx], 10))) setDayIdx(daysInMonth(i + 1, parseInt(YEARS[yearIdx], 10)) - 1); }}
              colWidth={68}
            />
            <View style={styles.wheelDivider} />
            <WheelColumn
              items={YEARS}
              selectedIndex={yearIdx}
              onSelect={(i) => { setYearIdx(i); if (dayIdx >= daysInMonth(monthIdx + 1, parseInt(YEARS[i], 10))) setDayIdx(daysInMonth(monthIdx + 1, parseInt(YEARS[i], 10)) - 1); }}
              colWidth={80}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  triggerText: { fontSize: 15, fontWeight: '500', flex: 1 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: '#F0F2FF' },
  clearBtn:    { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  confirmBtn:  { fontSize: 14, color: '#6C63FF', fontWeight: '700' },

  wheels: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 0,
  },
  wheelDivider: { width: 1, height: ITEM_H, backgroundColor: '#2A2A3E' },

  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_H,
    backgroundColor: '#6C63FF18',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6C63FF33',
  },

  wheelItem:    { fontSize: 18, fontWeight: '500' },
  wheelItemSel: { color: '#6C63FF', fontWeight: '700', fontSize: 20 },
  wheelItemDim: { color: '#4A4A6A' },
});
