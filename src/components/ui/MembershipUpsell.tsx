// PetezPopz — MembershipUpsell
//
// The upgrade path for Gold and Platinum. Opens Shopify's hosted checkout in
// an in-app browser rather than using StoreKit: Apple mandates in-app purchase
// for digital content but forbids it for physical goods and real-world
// services, and this membership is discounts, protectors and early access on
// physical merchandise. It's also the same checkout the app already uses for
// orders, so payment never touches the app.
//
// Renders nothing for customers already on a paid tier — they get a manage
// link instead, since subscription changes live in Shopify's account area.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import {
  MEMBERSHIPS,
  MEMBERSHIP_CHECKOUT_URL,
  MEMBERSHIP_PRICE,
  MANAGE_MEMBERSHIP_URL,
  resolveMembership,
} from '../../api/queries/customer';

interface Props {
  membershipTier: string;
  /** Called after the browser closes, so a fresh tier can be pulled in. */
  onReturn?: () => void;
}

const PERKS: Record<'gold' | 'platinum', string[]> = {
  gold: ['10% off every order', 'Free shipping over $79', '2 protectors a month'],
  platinum: [
    '12% off every order',
    'Free shipping over $79',
    '2 protectors a month, plus an acrylic every 3 months',
    'Early access to every drop',
    '$20 birthday gift every year',
  ],
};

export function MembershipUpsell({ membershipTier, onReturn }: Props) {
  const current = resolveMembership(membershipTier);
  const [opening, setOpening] = useState<string | null>(null);

  const open = useCallback(
    async (url: string, key: string) => {
      if (opening) return;
      setOpening(key);
      try {
        await WebBrowser.openBrowserAsync(url);
        // The subscription is created by Shopify and the tier written by a
        // webhook, so there's nothing to read immediately — but refetching on
        // return means the screen updates without the customer relaunching.
        onReturn?.();
      } finally {
        setOpening(null);
      }
    },
    [opening, onReturn],
  );

  if (current.paid) {
    return (
      <Pressable
        style={styles.manageRow}
        onPress={() => open(MANAGE_MEMBERSHIP_URL, 'manage')}
      >
        <Text style={styles.manageText}>
          Manage membership, payment method, or cancel ›
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>⬆️ UPGRADE YOUR MEMBERSHIP</Text>
      <Text style={styles.sectionSub}>
        Save on every order, every month. Cancel any time.
      </Text>

      {(['gold', 'platinum'] as const).map((key) => {
        const tier = MEMBERSHIPS[key];
        const busy = opening === key;
        return (
          <View key={key} style={[styles.card, key === 'gold' && styles.cardFeatured]}>
            {key === 'gold' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>MOST POPULAR</Text>
              </View>
            )}

            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>
                {tier.emoji} {tier.label}
              </Text>
              <Text style={styles.cardPrice}>
                {MEMBERSHIP_PRICE[key]}
                <Text style={styles.cardCadence}>/mo</Text>
              </Text>
            </View>

            {PERKS[key].map((perk) => (
              <View key={perk} style={styles.perkRow}>
                <Text style={styles.perkTick}>✓</Text>
                <Text style={styles.perkText}>{perk}</Text>
              </View>
            ))}

            <Pressable
              style={[styles.cta, busy && styles.ctaBusy]}
              onPress={() => open(MEMBERSHIP_CHECKOUT_URL[key], key)}
              disabled={!!opening}
            >
              <LinearGradient
                colors={
                  key === 'platinum'
                    ? [Colors.brand.violet, Colors.brand.rose]
                    : [Colors.tier.vaulted, '#B8860B']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {busy ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.ctaText}>Join {tier.label}</Text>
              )}
            </Pressable>
          </View>
        );
      })}

      <Text style={styles.fineprint}>
        Billed monthly through our store. Your discount applies automatically at
        checkout once active.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing[6], paddingHorizontal: Spacing[4], gap: Spacing[2] },
  sectionLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.brand.violet,
    letterSpacing: 2,
  },
  sectionSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing[2],
  },
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing[5],
    marginBottom: Spacing[3],
    gap: Spacing[2],
  },
  cardFeatured: { borderColor: Colors.tier.vaulted, borderWidth: 2 },
  badge: {
    position: 'absolute',
    top: -9,
    right: Spacing[5],
    backgroundColor: Colors.tier.vaulted,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: FontFamily.interBold,
    fontSize: 9,
    color: '#3A2A00',
    letterSpacing: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing[1],
  },
  cardTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  cardPrice: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  cardCadence: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
  },
  perkRow: { flexDirection: 'row', gap: Spacing[2], alignItems: 'flex-start' },
  perkTick: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.sm,
    color: Colors.success,
  },
  perkText: {
    flex: 1,
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  cta: {
    marginTop: Spacing[3],
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.sm,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  fineprint: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    lineHeight: 16,
  },
  manageRow: {
    marginTop: Spacing[5],
    marginHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  manageText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.brand.violet,
  },
});
