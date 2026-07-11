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
}

export function ScarcityBadge({ quantity }: Props) {
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
    <Animated.View style={[styles.badge, isCritical && styles.critical, animStyle]}>
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
