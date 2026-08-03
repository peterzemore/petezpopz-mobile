// PetezPopz — Product Detail Page (PDP)
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator, Alert, FlatList, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
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
import { isMember, applyMemberDiscount, resolveMembership } from '../../src/api/queries/customer';
import { hasTag, VIP_ONLY_TAG, LAUNCH_TIME_PREFIX } from '../../src/api/taxonomy';

const { width: W } = Dimensions.get('window');

export default function ProductDetailPage() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
// Consolidate your store hooks into ONE block
  const addToCart = useCartStore((s) => s.addItem);
  const cartQuantity = useCartStore((s) => s.totalQuantity());
  const { addItem: addWishlist, removeItem: removeWishlist, hasItem } = useWishlistStore();
  const { membershipTier } = useAuthStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);

  const toggleWishlist = () => {
    if (!product) return;
    if (hasItem(product.id)) {
      removeWishlist(product.id);
    } else {
      addWishlist(product);
    }
  };

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
    setAddingToCart(true);
    try {
      await addToCart(selectedVariant.id, 1, { product: product ?? undefined });
      // The upsell sheet confirms the add itself, so only fall back to an alert
      // when there's no companion product to offer — otherwise they stack.
      if (!useCartStore.getState().pendingUpsell) {
        Alert.alert('✅ Added to Cart', `${product?.title} is in your cart!`, [
          { text: 'Keep Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => router.push('/checkout') },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Could not add to cart.');
    } finally {
      setAddingToCart(false);
    }
  }, [selectedVariant, product, addToCart, router]);

  const handleNotifyMe = useCallback(() => {
    if (!product) return;
    Alert.alert(
      'Notify Me When Available',
      `We'll open your email app with a message to our team asking to be notified when "${product.title}" is back in stock.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email Us',
          onPress: () => {
            const subject = `Notify me when back in stock: ${product.title}`;
            const body =
              `Hi PetezPopz team,\n\n` +
              `Please notify me when this item is back in stock:\n\n` +
              `${product.title}\n` +
              `https://www.petezpopz.com/products/${product.handle}\n\n` +
              `Thanks!`;
            const url = `mailto:support@petezpopz.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Could not open email', 'Please reach out to support@petezpopz.com directly.');
            });
          },
        },
      ],
    );
  }, [product]);

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color={Colors.brand.violet} /></View>;
  if (!product) return <View style={styles.loader}><Text>Product not found</Text></View>;

  const isAvailable = product.variants.nodes.some(v => v.availableForSale);
  const price = parseFloat(selectedVariant?.price.amount ?? product.priceRange.minVariantPrice.amount);
  const memberIsVIP = isMember(membershipTier);
  const displayPrice = applyMemberDiscount(price, membershipTier);
  const membership = resolveMembership(membershipTier);
  const isVIPOnly = hasTag(product.tags, VIP_ONLY_TAG);
  const launchTag = product.tags.find((t) =>
    t.toLowerCase().startsWith(LAUNCH_TIME_PREFIX.toLowerCase()),
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: '',
          headerRight: () => (
            <Pressable style={styles.headerCartBtn} onPress={() => router.push('/checkout')}>
              <Text style={styles.headerCartIcon}>🛒</Text>
              {cartQuantity > 0 && (
                <View style={styles.headerCartBadge}>
                  <Text style={styles.headerCartBadgeText}>
                    {cartQuantity > 99 ? '99+' : cartQuantity}
                  </Text>
                </View>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.scroll}>
        <View style={styles.gallery}>
          <FlatList
            data={product.images.nodes}
            keyExtractor={(img) => img.url}
            horizontal  
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => 
              setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / W))
            }
            renderItem={({ item }) => (
              <Image 
                source={{ uri: item.url }} 
                style={{ width: W, height: W * 0.9 }} 
                contentFit="contain" 
              />
            )}
          />
  
          {/* Optional: Add dot indicators if you have them */}
          <View style={styles.imageDots}>
            {product.images.nodes.map((_, index) => (
              <View 
                key={index} 
                style={[styles.dot, index === activeImageIndex && styles.dotActive]} 
              />
            ))}
          </View>

          <ScarcityBadge quantity={Math.min(...product.variants.nodes.map(v => v.quantityAvailable ?? 999))} />
        </View>
        
        <View style={styles.infoContainer}>
          {/* 1. OUT OF STOCK BANNER */}
          {!isAvailable && (
            <View style={styles.outOfStockBanner}>
              <Text style={styles.outOfStockTitle}>Currently Out of Stock</Text>
              <Pressable style={styles.notifyBtn} onPress={handleNotifyMe}>
                <Text style={styles.notifyText}>Notify Me When Available</Text>
              </Pressable>
            </View>
          )}

          <VIPLockOverlay membershipTier={membershipTier} isVIPOnly={isVIPOnly} launchTimeTag={launchTag}>
            <Text style={styles.vendor}>{product.vendor}</Text>
            <Text style={styles.productTitle}>{product.title}</Text>

            {/* 2. PRICE & ACTION BAR */}
            <View style={styles.actionContainer}>
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>{memberIsVIP ? '✨ VIP PRICE' : 'Price'}</Text>
                <View style={styles.priceRow}>
                  {memberIsVIP && (
                    <Text style={styles.compareAt}>${price.toFixed(2)}</Text>
                  )}
                  <Text style={styles.priceAmount}>${displayPrice.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.row}>
                {isAvailable && (
                  <Pressable
                    style={[styles.primaryBtn, addingToCart && { opacity: 0.6 }]}
                    onPress={handleAddToCart}
                    disabled={addingToCart}
                  >
                    {addingToCart ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <Text style={styles.btnText}>Add to Cart</Text>
                    )}
                  </Pressable>
                )}
                <Pressable style={styles.wishlistBtn} onPress={toggleWishlist}>
                  <Text style={styles.heart}>{hasItem(product.id) ? "❤️" : "🤍"}</Text>
                </Pressable>
              </View>
            </View>
            
            <Text style={styles.description}>{product.description}</Text>
          </VIPLockOverlay>
        </View>

        <CrossMerchShelf currentProduct={product} />
        <View style={{ height: 120 }} />
      </ScrollView>
    </>
  ); //
} //

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
  outOfStockBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: Spacing[4],
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  outOfStockTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: '#ef4444',
    marginBottom: Spacing[2],
  },
  notifyBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full,
  },
  notifyText: {
    color: Colors.white,
    fontFamily: FontFamily.interBold,
  },
  actionContainer: { 
  marginVertical: Spacing[4], 
  paddingVertical: Spacing[4],
  borderTopWidth: 1, 
  borderColor: Colors.border.default,
  gap: Spacing[3] 
  },
  priceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontFamily: FontFamily.interBold, fontSize: FontSize.sm, color: Colors.text.muted },
  priceAmount: { fontFamily: FontFamily.outfitBlack, fontSize: FontSize.lg, color: Colors.brand.violet },
  row: { flexDirection: 'row', gap: Spacing[3] },
  primaryBtn: { flex: 1, backgroundColor: Colors.brand.violet, padding: Spacing[4], borderRadius: BorderRadius.lg, alignItems: 'center' },
  wishlistBtn: { padding: Spacing[4], backgroundColor: Colors.bg.secondary, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: Colors.white, fontFamily: FontFamily.interBold },
  heart: { fontSize: 22 },
  headerCartBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: Spacing[3],
    backgroundColor: 'rgba(10,10,18,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCartIcon: { fontSize: 20 },
  headerCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.brand.rose,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerCartBadgeText: {
    fontFamily: FontFamily.interBold,
    fontSize: 9,
    color: Colors.white,
  },
});