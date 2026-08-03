// PetezPopz — LoyaltyGauge Component
//
// Progress toward the next reward redemption. Previously this tracked the
// Common/Exclusive/Chase/Vaulted point ladder, which was retired on
// 2026-08-03 — membership is the status now, and points are just the currency
// you spend on coupons. Markers sit at the redemption thresholds, so the bar
// answers the only question the number actually raises: what can I claim next?
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { getRedemptionProgress, REDEMPTION_TIERS } from '../../api/queries/customer';

interface Props {
  points: number;
}

export function LoyaltyGauge({ points }: Props) {
  const { next, progress, pointsNeeded, maxed } = getRedemptionProgress(points);
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

  const topPoints = REDEMPTION_TIERS[REDEMPTION_TIERS.length - 1].points;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pointsValue}>{points.toLocaleString()}</Text>
          <Text style={styles.pointsLabel}>POINTS</Text>
        </View>
        <View style={styles.nextBox}>
          {maxed ? (
            <Text style={styles.nextText}>All rewards unlocked 🎉</Text>
          ) : (
            <Text style={styles.nextText}>
              <Text style={styles.nextStrong}>{pointsNeeded}</Text> more to $
              {next?.discountUSD} off
            </Text>
          )}
        </View>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle]}>
          <LinearGradient
            colors={[Colors.brand.violet, Colors.brand.rose]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Markers at each redemption threshold. The last sits at 100%, so it's
            skipped — it would render half off the end of the track. */}
        {REDEMPTION_TIERS.slice(0, -1).map((tier) => (
          <View
            key={tier.points}
            style={[styles.marker, { left: `${(tier.points / topPoints) * 100}%` }]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        {REDEMPTION_TIERS.map((tier) => {
          const unlocked = points >= tier.points;
          return (
            <View key={tier.points} style={styles.legendItem}>
              <Text style={[styles.legendIcon, !unlocked && styles.legendDim]}>
                {unlocked ? '✅' : '🔒'}
              </Text>
              <Text style={[styles.legendValue, !unlocked && styles.legendDim]}>
                ${tier.discountUSD}
              </Text>
              <Text style={[styles.legendCost, !unlocked && styles.legendDim]}>
                {tier.points} pts
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing[4],
    padding: Spacing[5],
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: Spacing[4],
  },
  pointsValue: {
    fontFamily: FontFamily.outfitBold,
    fontSize: 34,
    color: Colors.brand.violet,
    lineHeight: 38,
  },
  pointsLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: 10,
    color: Colors.text.muted,
    letterSpacing: 2,
  },
  nextBox: { alignItems: 'flex-end', flexShrink: 1 },
  nextText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  nextStrong: {
    fontFamily: FontFamily.outfitBold,
    color: Colors.tier.vaulted,
  },
  track: {
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bg.elevated,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.bg.card,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing[4],
  },
  legendItem: { alignItems: 'center', gap: 2 },
  legendIcon: { fontSize: 13 },
  legendValue: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  legendCost: {
    fontFamily: FontFamily.interRegular,
    fontSize: 10,
    color: Colors.text.muted,
  },
  legendDim: { opacity: 0.45 },
});
