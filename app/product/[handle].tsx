// PetezPopz — Product Detail Page (PDP)
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../src/theme/spacing';
import { fetchProductByHandle } from '../../src/api/queries/products';
import { Product, ProductVariant } from '../../src/api/shopify-storefront';
import { CrossMerchShelf } from '../../src/components/ui/CrossMerchShelf';
import { VIPLockOverlay } from '../../src/components/ui/VIPLockOverlay';
import { ScarcityBadge } from '../../src/components/ui/ScarcityBadge';
import { useCartStore } from '../../src/store/cartStore';
import { useWishlistStore } from '../../src/store/wishlistStore';
import { useAuthStore } from '../../src/store/authStore';
import { calculatePointsForPurchase } from '../../src/api/queries/customer';

const { width: W } = Dimensions.get('window');

export default function ProductDetailPage() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const { addItem: addWishlist, removeItem: removeWishlist, hasItem } = useWishlistStore();
  const { loyaltyPoints } = useAuthStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);

  const isWishlisted = product ? hasItem(product.id) : false;

  // Bounce animation for Add to Cart
  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  useEffect(() => {
    if (!handle) return;
    fetchProductByHandle(handle)
      .then((res) => {
        const p = res.data.product;
        setProduct(p);
        if (p) setSelectedVariant(p.variants.nodes[0] ?? null);
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [handle]);

  const handleAddToCart = useCallback(async () => {
    if (!selectedVariant) return;
    btnScale.value = withSequence(withSpring(0.92), withSpring(1.05), withSpring(1));
    setAddingToCart(true);
    try {
      await addItem(selectedVariant.id);
      Alert.alert('✅ Added to Cart', `${product?.title} is in your cart!`, [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'View Cart', onPress: () => router.push('/checkout') },
      ]);
    } catch {
      Alert.alert('Error', 'Could not add to cart. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  }, [selectedVariant, product]);

  const toggleWishlist = () => {
    if (!product) return;
    if (isWishlisted) {
      removeWishlist(product.id);
    } else {
      addWishlist(product);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.brand.violet} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loader}>
        <Text style={styles.notFoundText}>Product not found</Text>
      </View>
    );
  }

  const images = product.images.nodes;
  const price = parseFloat(selectedVariant?.price.amount ?? product.priceRange.minVariantPrice.amount);
  const compareAt = selectedVariant?.compareAtPrice
    ? parseFloat(selectedVariant.compareAtPrice.amount)
    : null;
  const pointsEarned = calculatePointsForPurchase(price);
  const minInventory = Math.min(
    ...product.variants.nodes.map((v) => v.quantityAvailable ?? 999),
  );

  const isVIPOnly = product.tags.some((t) => t === 'VIP_Only:True');
  const launchTag = product.tags.find((t) => t.startsWith('Launch_Time:'));

  // BNPL installment (Afterpay / Klarna style — 4 payments)
  const installmentAmt = (price / 4).toFixed(2);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerTintColor: Colors.white,
          headerRight: () => (
            <Pressable onPress={toggleWishlist} style={{ marginRight: Spacing[4] }}>
              <Text style={{ fontSize: 24 }}>{isWishlisted ? '❤️' : '🤍'}</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Image Gallery ──────────────────────────────────── */}
        <View style={styles.gallery}>
          <FlatList
            data={images}
            keyExtractor={(img) => img.url}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / W));
            }}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item.url }}
                style={{ width: W, height: W * 0.9 }}
                contentFit="contain"
              />
            )}
          />

          {/* Dot indicators */}
          {images.length > 1 && (
            <View style={styles.imageDots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeImageIndex && styles.dotActive]} />
              ))}
            </View>
          )}

          {/* Scarcity overlay */}
          <ScarcityBadge quantity={minInventory} />
        </View>

        {/* ── Product Info ───────────────────────────────────── */}
        <View style={styles.infoContainer}>
          {/* VIP Gate Wrapper */}
          <VIPLockOverlay
            loyaltyPoints={loyaltyPoints}
            isVIPOnly={isVIPOnly}
            launchTimeTag={launchTag}
          >
            {/* Vendor + Title */}
            <Text style={styles.vendor}>{product.vendor}</Text>
            <Text style={styles.productTitle}>{product.title}</Text>

            {/* Price row */}
            <View style={styles.priceRow}>
              <Text style={styles.price}>${price.toFixed(2)}</Text>
              {compareAt && (
                <Text style={styles.compareAt}>${compareAt.toFixed(2)}</Text>
              )}
              {compareAt && (
                <View style={styles.discountPill}>
                  <Text style={styles.discountPillText}>
                    -{Math.round(((compareAt - price) / compareAt) * 100)}%
                  </Text>
                </View>
              )}
            </View>

            {/* BNPL */}
            <View style={styles.bnplRow}>
              <Text style={styles.bnplText}>
                💳 Or 4 payments of ${installmentAmt} with{' '}
                <Text style={{ color: Colors.brand.rose }}>Afterpay</Text>
              </Text>
            </View>

            {/* Loyalty earn hook */}
            <View style={styles.loyaltyHook}>
              <Text style={styles.loyaltyHookText}>
                ⭐ Earn{' '}
                <Text style={{ color: Colors.tier.vaulted, fontFamily: FontFamily.outfitBold }}>
                  {pointsEarned} Reward Points
                </Text>{' '}
                on this item
              </Text>
            </View>

            {/* Variant selector */}
            {product.variants.nodes.length > 1 && (
              <View style={styles.variantSection}>
                <Text style={styles.variantLabel}>Select Option:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.variantRow}>
                    {product.variants.nodes.map((variant) => (
                      <Pressable
                        key={variant.id}
                        style={[
                          styles.variantPill,
                          selectedVariant?.id === variant.id && styles.variantPillActive,
                          !variant.availableForSale && styles.variantPillSoldOut,
                        ]}
                        onPress={() => variant.availableForSale && setSelectedVariant(variant)}
                      >
                        <Text
                          style={[
                            styles.variantPillText,
                            selectedVariant?.id === variant.id && styles.variantPillTextActive,
                          ]}
                        >
                          {variant.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Add to Cart button */}
            <Animated.View style={[btnStyle, styles.ctaRow]}>
              <Pressable
                style={[
                  styles.addToCartBtn,
                  !selectedVariant?.availableForSale && styles.addToCartBtnDisabled,
                ]}
                onPress={handleAddToCart}
                disabled={addingToCart || !selectedVariant?.availableForSale}
              >
                <LinearGradient
                  colors={[Colors.brand.violet, Colors.brand.rose]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                {addingToCart ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.addToCartText}>
                    {selectedVariant?.availableForSale ? '🛒 Add to Cart' : '⛔ Sold Out'}
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.wishlistBtn}
                onPress={toggleWishlist}
              >
                <Text style={styles.wishlistBtnText}>{isWishlisted ? '❤️' : '🤍'}</Text>
              </Pressable>
            </Animated.View>

            {/* Checkout shortcut */}
            <Pressable
              style={styles.checkoutNowBtn}
              onPress={() => {
                handleAddToCart().then(() => router.push('/checkout'));
              }}
            >
              <Text style={styles.checkoutNowText}>⚡ Buy Now</Text>
            </Pressable>

            {/* Description */}
            <View style={styles.descriptionSection}>
              <Text style={styles.descLabel}>PRODUCT DETAILS</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          </VIPLockOverlay>
        </View>

        {/* ── Cross-Merchandising Shelf ──────────────────────── */}
        <CrossMerchShelf currentProduct={product} />

        <View style={{ height: 120 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.primary,
  },
  notFoundText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.md,
    color: Colors.text.secondary,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  gallery: {
    position: 'relative',
    backgroundColor: Colors.bg.secondary,
  },
  imageDots: {
    position: 'absolute',
    bottom: Spacing[3],
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.brand.violet,
  },
  infoContainer: {
    padding: Spacing[5],
    gap: Spacing[3],
  },
  vendor: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.brand.violet,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  productTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize['2xl'],
    color: Colors.text.primary,
    lineHeight: 32,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    flexWrap: 'wrap',
  },
  price: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize['3xl'],
    color: Colors.text.primary,
  },
  compareAt: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.lg,
    color: Colors.text.muted,
    textDecorationLine: 'line-through',
  },
  discountPill: {
    backgroundColor: Colors.brand.rose,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  discountPillText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  bnplRow: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: BorderRadius.md,
    padding: Spacing[3],
  },
  bnplText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  loyaltyHook: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  loyaltyHookText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  variantSection: { gap: Spacing[2] },
  variantLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  variantRow: { flexDirection: 'row', gap: Spacing[2] },
  variantPill: {
    borderWidth: 1.5,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  variantPillActive: {
    borderColor: Colors.brand.violet,
    backgroundColor: 'rgba(123,47,255,0.15)',
  },
  variantPillSoldOut: { opacity: 0.4 },
  variantPillText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  variantPillTextActive: { color: Colors.brand.violet },
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginTop: Spacing[2],
  },
  addToCartBtn: {
    flex: 1,
    height: 56,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.violet,
  },
  addToCartBtnDisabled: { opacity: 0.5 },
  addToCartText: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.white,
    zIndex: 1,
  },
  wishlistBtn: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  wishlistBtnText: { fontSize: 24 },
  checkoutNowBtn: {
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  checkoutNowText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  descriptionSection: { gap: Spacing[2], marginTop: Spacing[2] },
  descLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  description: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
});
