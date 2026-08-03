// PetezPopz — SearchBar Component with Barcode Camera Button
import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { searchProducts } from '../../api/queries/products';

interface Props {
  onResultsChange?: (query: string) => void;
  autoFocus?: boolean;
}

export function SearchBar({ onResultsChange, autoFocus }: Props) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  const focusAnim = useSharedValue(0);
  const containerStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [Colors.border.default, Colors.brand.violet],
    ),
  }));

  const handleFocus = () => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 200 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 200 });
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    onResultsChange?.(text);
  };

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push({ pathname: '/search', params: { q: trimmed } });
  };

  const handleScannerOpen = () => {
    router.push('/scanner');
  };

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Search icon */}
      <Text style={styles.searchIcon}>🔍</Text>

      <TextInput
        style={styles.input}
        placeholder="Search 3,500+ items..."
        placeholderTextColor={Colors.text.muted}
        value={query}
        onChangeText={handleSearch}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={handleSubmit}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Clear button */}
      {query.length > 0 && (
        <Pressable onPress={() => { setQuery(''); onResultsChange?.(''); }} style={styles.clearBtn}>
          <Text style={styles.clearText}>✕</Text>
        </Pressable>
      )}

      {/* Barcode Scanner button */}
      <Pressable style={styles.scannerBtn} onPress={handleScannerOpen}>
        <Text style={styles.scannerIcon}>⬛</Text>
        <Text style={styles.scannerLabel}>SCAN</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    paddingHorizontal: Spacing[4],
    paddingVertical: Platform.OS === 'ios' ? Spacing[3] : Spacing[1.5],
    gap: Spacing[2],
  },
  searchIcon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  clearBtn: {
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[1],
  },
  clearText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
  },
  scannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
  },
  scannerIcon: {
    fontSize: 12,
  },
  scannerLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: 10,
    color: Colors.white,
    letterSpacing: 1,
  },
});
