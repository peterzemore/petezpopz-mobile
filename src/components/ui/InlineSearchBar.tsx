// PetezPopz — Lightweight search input for filtering within a product listing screen
import React from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function InlineSearchBar({ value, onChangeText, placeholder = 'Search this section…' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.text.muted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} style={styles.clearBtn}>
          <Text style={styles.clearText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: Spacing[3],
    marginHorizontal: Spacing[4],
    marginTop: Spacing[3],
    gap: Spacing[2],
  },
  icon: { fontSize: 14 },
  input: {
    flex: 1,
    paddingVertical: Spacing[2.5],
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  clearBtn: { padding: Spacing[1] },
  clearText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
  },
});
