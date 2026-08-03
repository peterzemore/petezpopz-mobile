// PetezPopz — ProductCard Component
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { Product } from '../../api/shopify-storefront';
import { ScarcityBadge } from './ScarcityBadge';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { useAuthStore } from '../../store/authStore';
import { isMember, applyMemberDiscount, resolveMembership } from '../../api/queries/customer';
import { hasTag, VIP_ONLY_TAG } from '../../api/taxonomy';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  product: Product;
  showQuickAdd?: boolean;
  onQuickAdd?: (product: Product) => void;
}

export function ProductCard({ product, showQuickAdd = false, onQuickAdd }: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const hasItem = useWishlistStore((s) => s.hasItem);
  const membershipTier = useAuthStore((s) => s.membershipTier);

  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const image = product.images.nodes[0];
  const variant = product.variants.nodes[0];
  const price = parseFloat(product.priceRange.minVariantPrice.amount);
  const compareAt = variant?.compareAtPrice ? parseFloat(variant.compareAtPrice.amount) : null;
  const discount = compareAt ? Math.round(((compareAt - price) / compareAt) * 100) : null;
  const minInventory = Math.min(...product.variants.nodes.map((v) => v.quantityAvailable ?? 999));
  const isPaidMember = isMember(membershipTier);
  const memberPrice = applyMemberDiscount(price, membershipTier);
  const membership = resolveMembership(membershipTier);
  const isVIP = hasTag(product.tags, VIP_ONLY_TAG);
  const isWishlisted = hasItem(product.id);

  const handlePress = () => {
    router.push(`/product/${product.handle}`);
  };

  const handleQuickAdd = () => {
    if (onQuickAdd) {
      onQuickAdd(product);
    } else if (variant) {
      addItem(variant.id, 1, { product });
    }
  };

  return (
    <AnimatedPressable
      style={[styles.card, cardStyle]}
      onPressIn={() => { scale.value = withSpring(0.97); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={handlePress}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: image?.url }}
          style={styles.image}
          contentFit="contain"
          transition={200}
          placeholder={Colors.bg.elevated}
        />

        {/* Badges */}
        <View style={styles.badgeRow}>
          {isVIP && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipBadgeText}>✨ VIP</Text>
            </View>
          )}
          {discount && discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
        </View>

        {/* Scarcity */}
        {minInventory < 10 && <ScarcityBadge quantity={minInventory} />}

        {/* Wishlist indicator */}
        {isWishlisted && (
          <View style={styles.wishlistDot}>
            <Text>❤️</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.vendor} numberOfLines={1}>{product.vendor}</Text>
        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>

        <View style={styles.priceRow}>
          {isPaidMember ? (
            <>
              <Text style={styles.price}>${memberPrice.toFixed(2)}</Text>
              <Text style={styles.compareAt}>${price.toFixed(2)}</Text>
            </>
          ) : (
            <>
              <Text style={styles.price}>${price.toFixed(2)}</Text>
              {compareAt && (
                <Text style={styles.compareAt}>${compareAt.toFixed(2)}</Text>
              )}
            </>
          )}
        </View>
        {isPaidMember && (
          <Text style={styles.vipLabel}>{membership.emoji} {membership.label} Price</Text>
        )}

        {showQuickAdd && (
          <Pressable style={styles.quickAddBtn} onPress={handleQuickAdd}>
            <Text style={styles.quickAddText}>➕ Quick Add</Text>
          </Pressable>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
    ...Shadow.sm,
  },
  imageContainer: {
    aspectRatio: 1,
    backgroundColor: Colors.bg.elevated,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
    position: 'absolute',
    top: Spacing[2],
    left: Spacing[2],
    flexDirection: 'column',
    gap: 4,
  },
  vipBadge: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vipBadgeText: {
    fontFamily: FontFamily.interBold,
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  discountBadge: {
    backgroundColor: Colors.brand.rose,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountText: {
    fontFamily: FontFamily.interBold,
    fontSize: 9,
    color: Colors.white,
  },
  wishlistDot: {
    position: 'absolute',
    top: Spacing[2],
    right: Spacing[2],
  },
  info: {
    padding: Spacing[3],
    gap: 3,
  },
  vendor: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: FontFamily.outfitSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  price: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  compareAt: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    textDecorationLine: 'line-through',
  },
  vipLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: 10,
    color: Colors.tier.vaulted,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  quickAddBtn: {
    marginTop: Spacing[2],
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing[1.5],
    alignItems: 'center',
  },
  quickAddText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.xs,
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
