// PetezPopz — RewardTile Component
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';

export interface RedemptionTier {
  points: number;
  discountUSD: number;
  label: string;
  code: string;
}

interface Props {
  tier: RedemptionTier;
  userPoints: number;
  redeemed: boolean;
  onRedeem?: (tier: RedemptionTier) => Promise<void>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function RewardTile({ tier, userPoints, redeemed, onRedeem }: Props) {
  const [loading, setLoading] = useState(false);

  const canRedeem = userPoints >= tier.points && !redeemed;
  const progress = Math.min(userPoints / tier.points, 1);

  const scale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleRedeem = async () => {
    if (!canRedeem || !onRedeem) return;
    scale.value = withSequence(withSpring(0.95), withSpring(1.02), withSpring(1));
    setLoading(true);
    try {
      await onRedeem(tier);
      Alert.alert('🎉 Reward Unlocked!', `Your code ${tier.code} has been applied to your cart.`);
    } catch {
      Alert.alert('Error', 'Could not apply reward. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.tile, !canRedeem && styles.tileDisabled]}>
      <LinearGradient
        colors={
          canRedeem
            ? [Colors.brand.violet, Colors.brand.violetDark]
            : [Colors.bg.elevated, Colors.bg.card]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* Star icon */}
        <View style={styles.iconBox}>
          <Text style={styles.icon}>{redeemed ? '✅' : '⭐'}</Text>
        </View>

        <View style={styles.info}>
          <Text style={[styles.label, !canRedeem && styles.labelDisabled]}>{tier.label}</Text>
          <Text style={[styles.value, !canRedeem && styles.labelDisabled]}>
            ${tier.discountUSD} Off Your Order
          </Text>

          {/* Mini progress bar */}
          <View style={styles.miniBarTrack}>
            <View style={[styles.miniBarFill, { width: `${progress * 100}%` }]} />
          </View>

          {!canRedeem && !redeemed && (
            <Text style={styles.needed}>
              {tier.points - userPoints} more points needed
            </Text>
          )}
        </View>

        <AnimatedPressable
          style={[styles.btn, !canRedeem && styles.btnDisabled, btnStyle]}
          onPress={handleRedeem}
          disabled={!canRedeem || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.btnText}>{redeemed ? 'Applied!' : 'Redeem'}</Text>
          )}
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.accent,
    ...Shadow.violet,
    marginBottom: Spacing[4],
  },
  tileDisabled: {
    borderColor: Colors.border.default,
    ...Shadow.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[4],
    gap: Spacing[4],
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26 },
  info: { flex: 1, gap: 4 },
  label: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
  labelDisabled: { color: Colors.text.secondary },
  value: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  miniBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: Spacing[2],
  },
  miniBarFill: {
    height: '100%',
    backgroundColor: Colors.tier.vaulted,
    borderRadius: 2,
  },
  needed: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginTop: 2,
  },
  btn: {
    backgroundColor: Colors.tier.vaulted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2.5],
    minWidth: 80,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: Colors.bg.elevated,
  },
  btnText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.sm,
    color: Colors.text.inverse,
  },
});
