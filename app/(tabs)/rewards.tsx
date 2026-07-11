// PetezPopz — Rewards Hub Screen (Tab 4)
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../src/theme/spacing';
import { LoyaltyGauge } from '../../src/components/ui/LoyaltyGauge';
import { RewardTile } from '../../src/components/ui/RewardTile';
import { useAuthStore } from '../../src/store/authStore';
import { useCartStore } from '../../src/store/cartStore';
import {
  fetchCustomerOrders,
  CustomerOrder,
  REDEMPTION_TIERS,
  getProgressToNextTier,
} from '../../src/api/queries/customer';

export default function RewardsScreen() {
  const router = useRouter();
  const { isAuthenticated, accessToken, customer, loyaltyPoints, loyaltyTier } = useAuthStore();
  const applyCode = useCartStore((s) => s.applyCode);

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (!accessToken || !isAuthenticated) return;
    setLoadingOrders(true);
    fetchCustomerOrders(accessToken, 10)
      .then((res) => setOrders(res.data.customer.orders.nodes))
      .catch(console.warn)
      .finally(() => setLoadingOrders(false));
  }, [accessToken, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.unauthContainer}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.unauthTitle}>Rewards Hub</Text>
          <Text style={styles.unauthSub}>
            Sign in to view your collector status, points history, and redeem rewards.
          </Text>
          <Pressable style={styles.signInBtn} onPress={() => router.push('/auth/login')}>
            <Text style={styles.signInBtnText}>Sign In / Create Account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { current, next, pointsNeeded } = getProgressToNextTier(loyaltyPoints);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>COLLECTOR STATUS</Text>
            <Text style={styles.headerTitle}>
              {loyaltyTier.emoji} {loyaltyTier.name} Tier
            </Text>
          </View>
          <View style={styles.pointsChip}>
            <Text style={styles.pointsChipValue}>{loyaltyPoints.toLocaleString()}</Text>
            <Text style={styles.pointsChipLabel}>pts</Text>
          </View>
        </View>

        {/* VIP Status Banner */}
        {loyaltyPoints >= 500 ? (
          <LinearGradient
            colors={[Colors.brand.violet, Colors.brand.rose]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.vipBanner}
          >
            <Text style={styles.vipBannerText}>✨ VIP STATUS ACTIVE</Text>
            <Text style={styles.vipBannerSub}>You have early access to all VIP drops!</Text>
          </LinearGradient>
        ) : (
          <View style={styles.vipProgressBanner}>
            <Text style={styles.vipProgressText}>
              🔒 Earn{' '}
              <Text style={{ color: Colors.tier.vaulted, fontFamily: FontFamily.outfitBold }}>
                {500 - loyaltyPoints} more points
              </Text>{' '}
              to unlock VIP status & exclusive drops
            </Text>
          </View>
        )}

        {/* Loyalty Progress */}
        <LoyaltyGauge points={loyaltyPoints} />

        {/* ── Redemption Tiles ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>💫 REDEEM YOUR POINTS</Text>
          <Text style={styles.sectionSubtitle}>
            Use your points for discount codes at checkout
          </Text>
          {REDEMPTION_TIERS.map((tier) => (
            <RewardTile
              key={tier.code}
              tier={tier}
              userPoints={loyaltyPoints}
              onRedeem={async (t) => {
                await applyCode(t.code);
              }}
            />
          ))}
        </View>

        {/* ── How to Earn ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>⭐ HOW TO EARN POINTS</Text>
          {[
            { icon: '🛍️', text: '$1 spent = 1 point (rounded to nearest dollar)' },
            { icon: '📦', text: 'Points credited automatically after order fulfillment' },
            { icon: '🔄', text: 'Returns reduce your point balance accordingly' },
            { icon: '✨', text: '500+ points unlocks VIP early access to new drops' },
          ].map((item, i) => (
            <View key={i} style={styles.earnRow}>
              <Text style={styles.earnIcon}>{item.icon}</Text>
              <Text style={styles.earnText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Recent Orders / Points History ───────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>📋 POINTS HISTORY</Text>
          {loadingOrders ? (
            <ActivityIndicator color={Colors.brand.violet} style={{ marginTop: Spacing[5] }} />
          ) : orders.length === 0 ? (
            <Text style={styles.noOrders}>No orders yet. Start shopping to earn points!</Text>
          ) : (
            orders.map((order) => {
              const pts = order.pointsEarned?.value
                ? Number(order.pointsEarned.value)
                : Math.round(parseFloat(order.totalPrice.amount));
              return (
                <View key={order.id} style={styles.orderRow}>
                  <View style={styles.orderLeft}>
                    <Text style={styles.orderName}>{order.name}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(order.processedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.orderStatus}>
                      {order.financialStatus === 'PAID' ? '✅ Paid' : order.financialStatus}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderTotal}>
                      ${parseFloat(order.totalPrice.amount).toFixed(2)}
                    </Text>
                    <View style={styles.pointsEarned}>
                      <Text style={styles.pointsEarnedText}>+{pts} pts</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  scroll: {
    paddingTop: Spacing[5],
    gap: Spacing[4],
  },
  unauthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
    gap: Spacing[4],
  },
  lockIcon: { fontSize: 48 },
  unauthTitle: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize['3xl'],
    color: Colors.text.primary,
    textAlign: 'center',
  },
  unauthSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  signInBtn: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
    ...Shadow.violet,
    marginTop: Spacing[2],
  },
  signInBtnText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[5],
  },
  headerLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.brand.violet,
    letterSpacing: 2,
  },
  headerTitle: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize['2xl'],
    color: Colors.text.primary,
    marginTop: 2,
  },
  pointsChip: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.tier.vaulted + '40',
  },
  pointsChipValue: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize['2xl'],
    color: Colors.tier.vaulted,
  },
  pointsChipLabel: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    textTransform: 'uppercase',
  },

  // VIP banners
  vipBanner: {
    marginHorizontal: Spacing[4],
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    alignItems: 'center',
  },
  vipBannerText: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.white,
    letterSpacing: 1,
  },
  vipBannerSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  vipProgressBanner: {
    marginHorizontal: Spacing[4],
    backgroundColor: Colors.bg.elevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  vipProgressText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },
  sectionLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.brand.violet,
    letterSpacing: 2,
  },
  sectionSubtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: -Spacing[1],
  },

  // Earn info
  earnRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    alignItems: 'flex-start',
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.md,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  earnIcon: { fontSize: 20, marginTop: 1 },
  earnText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 22,
  },

  // Order rows
  noOrders: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    textAlign: 'center',
    paddingVertical: Spacing[5],
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  orderLeft: { gap: 3 },
  orderName: {
    fontFamily: FontFamily.outfitSemiBold,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  orderDate: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  orderStatus: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.xs,
    color: Colors.success,
  },
  orderRight: { alignItems: 'flex-end', gap: 6 },
  orderTotal: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  pointsEarned: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pointsEarnedText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
});
