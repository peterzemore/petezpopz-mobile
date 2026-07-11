// PetezPopz — LoyaltyGauge Component
// Animated progress ring with tier markers and glow effects
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import {
  getProgressToNextTier,
  getLoyaltyTier,
  LOYALTY_TIERS,
} from '../../api/queries/customer';

interface Props {
  points: number;
}

export function LoyaltyGauge({ points }: Props) {
  const { current, next, progress, pointsNeeded } = getProgressToNextTier(points);
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withTiming(progress, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.tierEmoji}>{current.emoji}</Text>
          <Text style={[styles.tierName, { color: current.color }]}>{current.name} Collector</Text>
        </View>
        <View style={styles.pointsBox}>
          <Text style={styles.pointsValue}>{points.toLocaleString()}</Text>
          <Text style={styles.pointsLabel}>Points</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, barStyle]}>
          <LinearGradient
            colors={[current.color, next?.color ?? current.color]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Tier markers */}
        {LOYALTY_TIERS.slice(1).map((tier) => {
          const markerPos = tier.minPoints / (LOYALTY_TIERS[LOYALTY_TIERS.length - 1].minPoints);
          return (
            <View
              key={tier.name}
              style={[styles.tierMarker, { left: `${Math.min(markerPos * 100, 95)}%` }]}
            />
          );
        })}
      </View>

      {/* Footer */}
      {next ? (
        <Text style={styles.progressText}>
          <Text style={{ color: next.color }}>{pointsNeeded} more points</Text>
          {' to reach '}
          <Text style={{ color: next.color, fontFamily: FontFamily.interSemiBold }}>
            {next.emoji} {next.name}
          </Text>
        </Text>
      ) : (
        <Text style={[styles.progressText, { color: Colors.tier.vaulted }]}>
          🏆 Maximum Tier Reached — You're a Legend!
        </Text>
      )}

      {/* Tier icons row */}
      <View style={styles.tiersRow}>
        {LOYALTY_TIERS.map((tier) => (
          <View key={tier.name} style={styles.tierBadge}>
            <View
              style={[
                styles.tierDot,
                {
                  backgroundColor: points >= tier.minPoints ? tier.color : Colors.bg.elevated,
                  borderColor: tier.color,
                },
              ]}
            >
              <Text style={styles.tierDotText}>{tier.emoji}</Text>
            </View>
            <Text style={[styles.tierBadgeLabel, { color: points >= tier.minPoints ? tier.color : Colors.text.muted }]}>
              {tier.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: Colors.border.accent,
    marginHorizontal: Spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  tierEmoji: {
    fontSize: 28,
  },
  tierName: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.lg,
    marginTop: 2,
  },
  pointsBox: {
    alignItems: 'flex-end',
    backgroundColor: Colors.bg.elevated,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.lg,
  },
  pointsValue: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize['2xl'],
    color: Colors.tier.vaulted,
  },
  pointsLabel: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  barTrack: {
    height: 12,
    backgroundColor: Colors.bg.elevated,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing[2],
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  tierMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.bg.primary,
  },
  progressText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing[4],
  },
  tiersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing[2],
  },
  tierBadge: {
    alignItems: 'center',
    gap: 4,
  },
  tierDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierDotText: {
    fontSize: 18,
  },
  tierBadgeLabel: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.xs,
  },
});
