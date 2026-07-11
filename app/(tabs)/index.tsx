// PetezPopz — Home / Fandom Hub Screen (Tab 1)
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../src/theme/spacing';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { PromoCarousel } from '../../src/components/ui/PromoCarousel';
import { LoyaltyGauge } from '../../src/components/ui/LoyaltyGauge';
import { useAuthStore } from '../../src/store/authStore';

export default function HomeScreen() {
  const router = useRouter();
  const { customer, loyaltyPoints, isAuthenticated, fetchProfile } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.brand.violet}
          />
        }
      >
        {/* ── Top Bar ──────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <View style={styles.logoArea}>
            <Text style={styles.logoText}>🎯 PetezPopz</Text>
          </View>

          <Pressable
            style={styles.profileBtn}
            onPress={() =>
              isAuthenticated ? router.push('/(tabs)/rewards') : router.push('/auth/login')
            }
          >
            {isAuthenticated && customer ? (
              <View style={styles.avatarBox}>
                <Text style={styles.avatarInitial}>
                  {customer.firstName?.[0] ?? customer.emailAddress?.emailAddress[0] ?? '?'}
                </Text>
              </View>
            ) : (
              <View style={styles.signInBtn}>
                <Text style={styles.signInText}>Sign In</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Greeting ─────────────────────────────────────────── */}
        {isAuthenticated && customer && (
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>
              {greeting()},{' '}
              <Text style={{ color: Colors.brand.violet }}>
                {customer.firstName ?? 'Collector'}!
              </Text>
            </Text>
          </View>
        )}

        {/* ── Search Bar ───────────────────────────────────────── */}
        <View style={styles.searchContainer}>
          <SearchBar />
        </View>

        {/* ── Promo Banner Carousel ─────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>🔥 APP EXCLUSIVE DROPS</Text>
        </View>
        <PromoCarousel />

        {/* ── Loyalty Gauge ─────────────────────────────────────── */}
        {isAuthenticated ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>⭐ YOUR COLLECTOR STATUS</Text>
            </View>
            <LoyaltyGauge points={loyaltyPoints} />
          </View>
        ) : (
          <Pressable style={styles.loyaltyTeaser} onPress={() => router.push('/auth/login')}>
            <LinearGradient
              colors={[Colors.brand.violetDark, Colors.bg.card]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.teaserIcon}>⭐</Text>
            <View style={styles.teaserText}>
              <Text style={styles.teaserTitle}>Join the Rewards Hub</Text>
              <Text style={styles.teaserSub}>
                Sign in to earn points, unlock VIP drops & redeem rewards.
              </Text>
            </View>
            <Text style={styles.teaserArrow}>›</Text>
          </Pressable>
        )}

        {/* ── The Split Store Fork ──────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>🛒 SHOP BY BRAND</Text>
          </View>

          <View style={styles.forkRow}>
            {/* Funko Pops */}
            <Pressable
              style={styles.forkCard}
              onPress={() => router.push('/collection/funko-pops-all')}
            >
              <LinearGradient
                colors={['#1A0066', '#0A0A12']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.forkIcon}>🎭</Text>
              <Text style={styles.forkTitle}>SHOP ALL{'\n'}FUNKO POPS</Text>
              <View style={styles.forkCountBadge}>
                <Text style={styles.forkCount}>3,500+ items</Text>
              </View>
            </Pressable>

            {/* Loungefly */}
            <Pressable
              style={styles.forkCard}
              onPress={() => router.push('/collection/loungefly-all')}
            >
              <LinearGradient
                colors={['#3D0044', '#0A0A12']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.forkIcon}>👜</Text>
              <Text style={styles.forkTitle}>SHOP ALL{'\n'}LOUNGEFLY</Text>
              <View style={[styles.forkCountBadge, { backgroundColor: Colors.brand.rose }]}>
                <Text style={styles.forkCount}>100+ items</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Bottom padding for tab bar */}
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
  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing[4] },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    marginBottom: Spacing[3],
  },
  logoArea: {},
  logoText: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize.xl,
    color: Colors.text.primary,
  },
  profileBtn: {},
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brand.violet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.brand.violetLight,
  },
  avatarInitial: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.white,
    textTransform: 'uppercase',
  },
  signInBtn: {
    backgroundColor: Colors.brand.violet,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full,
  },
  signInText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },

  // Greeting
  greetingRow: {
    paddingHorizontal: Spacing[4],
    marginBottom: Spacing[3],
  },
  greeting: {
    fontFamily: FontFamily.outfitSemiBold,
    fontSize: FontSize.lg,
    color: Colors.text.primary,
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing[4],
    marginBottom: Spacing[2],
  },

  // Sections
  sectionBlock: { marginTop: Spacing[6] },
  sectionHeader: {
    paddingHorizontal: Spacing[4],
    marginBottom: Spacing[2],
  },
  sectionLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.brand.violet,
    letterSpacing: 2,
  },

  // Loyalty teaser (unauthenticated)
  loyaltyTeaser: {
    marginHorizontal: Spacing[4],
    marginTop: Spacing[6],
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.accent,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[5],
    gap: Spacing[4],
    ...Shadow.violet,
  },
  teaserIcon: { fontSize: 36 },
  teaserText: { flex: 1, gap: 4 },
  teaserTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
  teaserSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  teaserArrow: {
    fontFamily: FontFamily.outfitBold,
    fontSize: 28,
    color: Colors.brand.violet,
  },

  // Fork cards
  forkRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },
  forkCard: {
    flex: 1,
    height: 180,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    ...Shadow.lg,
  },
  forkIcon: { fontSize: 44 },
  forkTitle: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize.md,
    color: Colors.white,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  forkCountBadge: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  forkCount: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
});
