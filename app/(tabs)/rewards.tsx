// PetezPopz — Rewards Hub Screen (Tab 4)
import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../src/theme/spacing';
import { LoyaltyGauge } from '../../src/components/ui/LoyaltyGauge';
import { RewardTile } from '../../src/components/ui/RewardTile';
import { MembershipUpsell } from '../../src/components/ui/MembershipUpsell';
import { BirthdayCard } from '../../src/components/ui/BirthdayCard';
import { useAuthStore } from '../../src/store/authStore';
import { useCartStore } from '../../src/store/cartStore';
import type { Cart } from '../../src/api/shopify-storefront';
import { redeemPointsForCode, subscribeToMarketing } from '../../src/api/shopify-customer';
import {
  fetchCustomerOrders,
  CustomerOrder,
  REDEMPTION_TIERS,
  calculatePointsForPurchase,
  isMember,
  isEnrolled,
  resolveMembership,
} from '../../src/api/queries/customer';

// The Customer Account API's exact fulfillmentStatus enum values aren't
// pinned down here (unverified), so this matches loosely/case-insensitively
// on common substrings rather than an exact enum list, and falls back to
// just humanizing whatever string comes back.
function humanizeFulfillmentStatus(status?: string | null): { label: string; color: string } | null {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s.includes('FULFILL') && !s.includes('UN') && !s.includes('PARTIAL')) {
    return { label: '✅ Shipped', color: Colors.success };
  }
  if (s.includes('PARTIAL')) {
    return { label: '📦 Partially Shipped', color: Colors.tier.vaulted };
  }
  if (s.includes('CANCEL') || s.includes('RESTOCK')) {
    return { label: '↩️ Cancelled', color: Colors.text.muted };
  }
  return { label: `📋 ${status.replace(/_/g, ' ').toLowerCase()}`, color: Colors.text.muted };
}

// Hoisted so the selector below returns a stable reference when the cart has no
// codes. Zustand snapshots are compared with Object.is, so a `?? []` literal
// inside the selector allocates a fresh array every read, reads as "changed"
// every time, and drives an infinite render loop.
const NO_DISCOUNT_CODES: NonNullable<Cart['discountCodes']> = [];

export default function RewardsScreen() {
  const router = useRouter();
  const { isAuthenticated, accessToken, customer, loyaltyPoints, membershipTier, fetchProfile } = useAuthStore();
  const applyCode = useCartStore((s) => s.applyCode);
  const appliedCodes = useCartStore((s) => s.cart?.discountCodes ?? NO_DISCOUNT_CODES);

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  // Maps a tier's point cost → the unique code minted for it this session,
  // so the tile can tell "you redeemed this" from "this code is in the cart".
  const [issuedCodes, setIssuedCodes] = useState<Record<number, string>>({});
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  // Opting in is what unlocks Silver. The tier itself is set by the membership
  // service once Shopify records the consent, so this refetches after a short
  // beat rather than assuming the promotion has already landed.
  const handleSubscribe = useCallback(async () => {
    if (!accessToken || subscribing) return;
    setSubscribing(true);
    try {
      await subscribeToMarketing(accessToken, 'email');
      await new Promise((r) => setTimeout(r, 1500));
      await fetchProfile();
      Alert.alert(
        'You\'re in',
        'Silver unlocked — you\'ll earn a point for every $1 you spend.',
      );
    } catch (err) {
      Alert.alert(
        'Could not subscribe',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSubscribing(false);
    }
  }, [accessToken, subscribing, fetchProfile]);

  // Points are debited server-side; the app only reports the outcome. A
  // client-side balance check here would be advisory at best, so the server's
  // "Insufficient points" response is the authority.
  const handleRedeem = useCallback(
    async (points: number) => {
      if (!accessToken || redeeming !== null) return;
      setRedeeming(points);
      try {
        const result = await redeemPointsForCode(accessToken, points);
        setIssuedCodes((prev) => ({ ...prev, [points]: result.code }));
        await applyCode(result.code);
        // Pull the debited balance back from Shopify rather than trusting a
        // locally-decremented number.
        await fetchProfile();
        Alert.alert(
          'Reward unlocked',
          `$${result.discountUSD} off has been applied to your cart.\n\n` +
            `Code: ${result.code}\n` +
            `Points remaining: ${result.newBalance}`,
        );
      } catch (err) {
        Alert.alert(
          'Could not redeem',
          err instanceof Error ? err.message : 'Please try again.',
        );
      } finally {
        setRedeeming(null);
      }
    },
    [accessToken, redeeming, applyCode, fetchProfile],
  );

  // Re-fetch the customer profile (loyalty points, tier) and order history
  // every time this tab gains focus — e.g. right after checkout — so a
  // recently-earned balance shows up without needing an app restart.
  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !isAuthenticated) return;

      fetchProfile();

      setLoadingOrders(true);
      fetchCustomerOrders(accessToken, 10)
        .then((res) => {
          const nodes = res?.data?.customer?.orders?.nodes;
          setOrders(Array.isArray(nodes) ? nodes : []);
        })
        .catch((err) => {
          console.warn('Order fetch failed:', err);
          setOrders([]);
        })
        .finally(() => setLoadingOrders(false));
    }, [accessToken, isAuthenticated]),
  );

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


  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>MEMBERSHIP</Text>
            <Text style={styles.headerTitle}>
              {resolveMembership(membershipTier).emoji}{' '}
              {resolveMembership(membershipTier).label}
            </Text>
          </View>
          <View style={styles.pointsChip}>
            <Text style={styles.pointsChipValue}>{loyaltyPoints.toLocaleString()}</Text>
            <Text style={styles.pointsChipLabel}>pts</Text>
          </View>
        </View>

        {/* Membership banner. Perks are bought now, not earned by spending —
            so this reports the tier rather than progress toward one. */}
        {isMember(membershipTier) ? (
          <LinearGradient
            colors={[Colors.brand.violet, Colors.brand.rose]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.vipBanner}
          >
            <Text style={styles.vipBannerText}>
              {resolveMembership(membershipTier).emoji}{' '}
              {resolveMembership(membershipTier).label.toUpperCase()} MEMBER
            </Text>
            <Text style={styles.vipBannerSub}>
              {(resolveMembership(membershipTier).discountRate * 100).toFixed(0)}% off every order,
              applied automatically at checkout
            </Text>
          </LinearGradient>
        ) : isEnrolled(membershipTier) ? (
          <View style={styles.vipProgressBanner}>
            <Text style={styles.vipProgressText}>
              {resolveMembership(membershipTier).emoji}{' '}
              <Text style={{ color: Colors.tier.vaulted, fontFamily: FontFamily.outfitBold }}>
                {resolveMembership(membershipTier).label}
              </Text>{' '}
              — earning points on every order. Upgrade for 10–12% off and early access.
            </Text>
          </View>
        ) : (
          /* Guest: has an account but hasn't opted in, so isn't earning yet. */
          <View style={styles.subscribeCard}>
            <Text style={styles.subscribeTitle}>🥈 Unlock Silver — free</Text>
            <Text style={styles.subscribeBody}>
              Subscribe to our emails and start earning a point for every $1 you
              spend. Turn 100 points into $5 off. Unsubscribe any time.
            </Text>
            <Pressable
              style={[styles.subscribeBtn, subscribing && styles.subscribeBtnBusy]}
              onPress={handleSubscribe}
              disabled={subscribing}
            >
              {subscribing ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.subscribeBtnText}>Subscribe & unlock Silver</Text>
              )}
            </Pressable>
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
              // A redeemed tier is one whose freshly minted code is sitting in
              // the cart. Codes are now unique per redemption, so match on the
              // issued code rather than the old static tier.code.
              redeemed={
                !!issuedCodes[tier.points] &&
                appliedCodes.some(
                  (d) => d.code === issuedCodes[tier.points] && d.applicable,
                )
              }
              onRedeem={() => handleRedeem(tier.points)}
            />
          ))}
        </View>

        {/* ── Birthday (Platinum perk) ───────────────────────── */}
        {resolveMembership(membershipTier).tier === 'platinum' && (
          <BirthdayCard
            accessToken={accessToken}
            birthday={customer?.birthday?.value}
            giftCode={customer?.birthdayGiftCode?.value}
            giftExpires={customer?.birthdayGiftExpires?.value}
            onSaved={fetchProfile}
          />
        )}

        {/* ── Membership upgrade / manage ────────────────────── */}
        <MembershipUpsell membershipTier={membershipTier} onReturn={fetchProfile} />

        {/* ── How to Earn ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>⭐ HOW TO EARN POINTS</Text>
          {[
            { icon: '🛍️', text: '$1 spent = 1 point (rounded to nearest dollar)' },
            { icon: '📦', text: 'Points credited automatically after order fulfillment' },
            { icon: '🔄', text: 'Returns reduce your point balance accordingly' },
            // Early access is a Platinum perk now, not a points threshold.
            { icon: '🥈', text: 'Subscribe to emails to unlock Silver and start earning' },
            { icon: '👑', text: 'Early access to drops comes with Platinum membership' },
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
          ) : (
            // Use optional chaining and a fallback array to stop the crash
            (orders && Array.isArray(orders) ? orders : []).map((order) => {
              // Safely parse price, defaulting to 0 if missing
              const amount = order?.totalPrice?.amount ? parseFloat(order.totalPrice.amount) : 0;
              const price = amount.toFixed(2);
              // Prefer the real value your Flow writes to the order; fall back
              // to an estimate from the order total if that metafield isn't set.
              const pointsEarned = order?.pointsEarned?.value
                ? Number(order.pointsEarned.value)
                : calculatePointsForPurchase(amount);

              const fulfillment = humanizeFulfillmentStatus(order?.fulfillmentStatus);

              return (
                <View key={order?.id ?? Math.random().toString()} style={styles.orderRow}>
                  <View style={styles.orderLeft}>
                    <Text style={styles.orderName}>{order?.name ?? 'Unknown Order'}</Text>
                    <Text style={styles.orderDate}>
                      {order?.processedAt ? new Date(order.processedAt).toLocaleDateString() : 'Date N/A'}
                    </Text>
                    {fulfillment && (
                      <Text style={[styles.orderStatus, { color: fulfillment.color }]}>
                        {fulfillment.label}
                      </Text>
                    )}
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderTotal}>${price}</Text>
                    <View style={styles.pointsEarned}>
                      <Text style={styles.pointsEarnedText}>+{pointsEarned} pts</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
          
          {/* Show this only if not loading AND the array is empty */}
          {!loadingOrders && (!orders || orders.length === 0) && (
            <Text style={styles.noOrders}>No orders yet. Start shopping to earn points!</Text>
          )}
        </View>
        
          {/* ── SIGN OUT BUTTON ───────────────────────────────── */}
          <Pressable
            style={styles.signOutBtn}
            onPress={async () => {
              await useAuthStore.getState().logout();
              router.replace('/auth/login');
            }}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>

          {/* ── DELETE ACCOUNT ────────────────────────────────── */}
          <Pressable
            style={styles.deleteAccountBtn}
            disabled={deletingAccount}
            onPress={() => {
              Alert.alert(
                'Delete Account?',
                'This permanently deletes your PetezPopz account and order history. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      setDeletingAccount(true);
                      try {
                        await useAuthStore.getState().deleteAccount();
                        router.replace('/auth/login');
                      } catch (err) {
                        console.error('Account deletion failed:', err);
                        Alert.alert('Error', 'Could not delete your account. Please try again.');
                      } finally {
                        setDeletingAccount(false);
                      }
                    },
                  },
                ],
              );
            }}
          >
            {deletingAccount ? (
              <ActivityIndicator color={Colors.danger} />
            ) : (
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            )}
          </Pressable>

          {/* TEMP — remove after confirming events land in Sentry */}
          <Pressable
            style={styles.deleteAccountBtn}
            onPress={() => Sentry.captureException(new Error('Sentry test event from PetezPopz'))}
          >
            <Text style={styles.deleteAccountText}>🐛 Send Sentry Test Event</Text>
          </Pressable>

          <View style={{ height: 100 }} />
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  subscribeCard: {
    marginHorizontal: Spacing[4],
    marginBottom: Spacing[4],
    padding: Spacing[5],
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.accent,
    gap: Spacing[2],
  },
  subscribeTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
  subscribeBody: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  subscribeBtn: {
    marginTop: Spacing[2],
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  subscribeBtnBusy: { opacity: 0.7 },
  subscribeBtnText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
    letterSpacing: 0.3,
  },
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
  signOutBtn: {
    marginHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bg.elevated,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  signOutText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
  },
  deleteAccountBtn: {
    marginHorizontal: Spacing[4],
    marginTop: Spacing[2],
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  deleteAccountText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
});
