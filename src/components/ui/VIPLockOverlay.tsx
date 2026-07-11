// PetezPopz — VIPLockOverlay Component
// Semi-translucent lock overlay with countdown for non-VIP users.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { VIP_THRESHOLD, getLoyaltyTier } from '../../api/queries/customer';
import { useRouter } from 'expo-router';

interface Props {
  loyaltyPoints: number;
  launchTimeTag?: string; // e.g. "Launch_Time:2026-07-15-10:00"
  isVIPOnly: boolean;
  children: React.ReactNode;
}

function parseCountdown(launchTimeTag?: string): Date | null {
  if (!launchTimeTag) return null;
  const match = launchTimeTag.match(/Launch_Time:(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})/);
  if (!match) return null;
  return new Date(`${match[1]}T${match[2]}:00`);
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function VIPLockOverlay({ loyaltyPoints, launchTimeTag, isVIPOnly, children }: Props) {
  const isVIP = loyaltyPoints >= VIP_THRESHOLD;
  const router = useRouter();

  const [countdown, setCountdown] = useState<string>('');
  const launchDate = parseCountdown(launchTimeTag);

  const glowOpacity = useSharedValue(0.3);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  useEffect(() => {
    if (!isVIPOnly || isVIP) return;

    // Pulsing glow
    glowOpacity.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 1000 }), withTiming(0.3, { duration: 1000 })),
      -1,
      true,
    );

    // Countdown tick
    if (launchDate) {
      const tick = () => {
        const ms = launchDate.getTime() - Date.now();
        setCountdown(ms <= 0 ? 'Launching soon!' : formatCountdown(ms));
      };
      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
    }
  }, [isVIPOnly, isVIP, launchDate]);

  // VIP user — show full content with badge
  if (!isVIPOnly || isVIP) {
    return (
      <View style={{ position: 'relative' }}>
        {isVIPOnly && (
          <View style={styles.vipActiveBadge}>
            <Text style={styles.vipActiveText}>✨ VIP PRE-ORDER</Text>
          </View>
        )}
        {children}
      </View>
    );
  }

  const pointsNeeded = VIP_THRESHOLD - loyaltyPoints;

  // Non-VIP — show locked overlay
  return (
    <View style={styles.wrapper}>
      <View style={styles.childWrap}>{children}</View>

      {/* Semi-transparent overlay */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]}>
        <LinearGradient
          colors={['rgba(10,10,18,0.7)', 'rgba(10,10,18,0.95)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Glowing lock icon */}
        <Animated.View style={[styles.glowCircle, glowStyle]} />

        <View style={styles.lockContent}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>VIP Early Access</Text>

          {launchDate && countdown ? (
            <>
              <Text style={styles.countdownLabel}>Unlocks for VIPs in</Text>
              <View style={styles.countdownBox}>
                <Text style={styles.countdown}>{countdown}</Text>
              </View>
              <Text style={styles.publicLabel}>Public access tomorrow</Text>
            </>
          ) : null}

          <View style={styles.earnBox}>
            <Text style={styles.earnText}>
              Earn{' '}
              <Text style={{ color: Colors.tier.vaulted, fontFamily: FontFamily.outfitBold }}>
                {pointsNeeded} more points
              </Text>
              {'\n'}to unlock first dibs
            </Text>
          </View>

          <Pressable style={styles.earnBtn} onPress={() => router.push('/(tabs)/rewards')}>
            <Text style={styles.earnBtnText}>⭐ View Rewards Hub</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', overflow: 'hidden', borderRadius: BorderRadius.lg },
  childWrap: { opacity: 0.4 },
  overlay: {
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.brand.violet,
    top: '30%',
  },
  lockContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing[6],
    zIndex: 2,
  },
  lockIcon: { fontSize: 40, marginBottom: Spacing[2] },
  lockTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.xl,
    color: Colors.white,
    marginBottom: Spacing[3],
  },
  countdownLabel: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  countdownBox: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
    marginVertical: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.border.accent,
  },
  countdown: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize['3xl'],
    color: Colors.brand.violet,
    letterSpacing: 2,
  },
  publicLabel: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    marginBottom: Spacing[4],
  },
  earnBox: {
    backgroundColor: 'rgba(123,47,255,0.15)',
    borderRadius: BorderRadius.md,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.accent,
    marginBottom: Spacing[4],
  },
  earnText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  earnBtn: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
  },
  earnBtnText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  vipActiveBadge: {
    position: 'absolute',
    top: Spacing[3],
    left: Spacing[3],
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    zIndex: 10,
  },
  vipActiveText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.white,
    letterSpacing: 1,
  },
});
