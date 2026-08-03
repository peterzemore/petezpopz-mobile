// PetezPopz — Reusable sort-pill bar for product listing screens
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';

interface Option<K extends string> {
  label: string;
  sortKey: K;
  reverse: boolean;
}

interface Props<K extends string> {
  options: Option<K>[];
  value: Option<K>;
  onChange: (option: Option<K>) => void;
}

export function SortBar<K extends string>({ options, value, onChange }: Props<K>) {
  return (
    <View style={styles.bar}>
      {options.map((opt) => {
        const active = opt.sortKey === value.sortKey && opt.reverse === value.reverse;
        return (
          <Pressable
            key={`${opt.sortKey}-${opt.reverse}`}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[2],
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  pill: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bg.elevated,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  pillActive: {
    backgroundColor: Colors.brand.violet,
    borderColor: Colors.brand.violet,
  },
  text: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  textActive: { color: Colors.white },
});
