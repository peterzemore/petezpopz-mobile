// PetezPopz — ScarcityBadge Component
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { BorderRadius, Spacing } from '../../theme/spacing';

interface Props {
  quantity: number;
  /**
   * 'band' (default) stretches across the bottom of a product card image.
   * 'pill' is a small rounded tag for the product page gallery, where the
   * band overlapped the page dots and ran edge to edge (2026-09-09).
   */
  variant?: 'band' | 'pill';
}

export function ScarcityBadge({ quantity, variant = 'band' }: Props) {
  if (quantity <= 0) return null;
  if (quantity >= 10) return null;

  const opacity = useSharedValue(1);

  useEffect(() => {
    if (quantity <= 3) {
      // Pulse animation for critically low stock
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1,
        true,
      );
    }
  }, [quantity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const isCritical = quantity <= 3;

  return (
    <Animated.View style={[styles.badge, variant === 'pill' && styles.pill, isCritical && styles.critical, animStyle]}>
      <Text style={styles.text}>
        {isCritical ? `🔴 Only ${quantity} Left!` : `⚠️ Low Stock: ${quantity}`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(234, 67, 53, 0.85)',
    paddingVertical: Spacing[1],
    alignItems: 'center',
  },
  pill: {
    left: Spacing[4],
    right: undefined,
    bottom: Spacing[8],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full,
  },
  critical: {
    backgroundColor: 'rgba(234, 67, 53, 0.95)',
  },
  text: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
