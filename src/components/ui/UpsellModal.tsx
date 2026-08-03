// PetezPopz — Add-to-cart upsell sheet
//
// Fires once an item lands in the cart, offering the single best companion
// product (matching-franchise Pop for a bag, size-matched protector for a Pop).
// Purely a suggestion surface — any bundle pricing is a Shopify automatic
// discount that applies itself at checkout.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { useCartStore } from '../../store/cartStore';

export function UpsellModal() {
  const offer = useCartStore((s) => s.pendingUpsell);
  const dismissUpsell = useCartStore((s) => s.dismissUpsell);
  const addItem = useCartStore((s) => s.addItem);
  const [adding, setAdding] = useState(false);

  if (!offer) return null;

  const { suggestion, eyebrow, headline, blurb } = offer;
  const variant = suggestion.variants.nodes.find((v) => v.availableForSale);
  const image = suggestion.images.nodes[0];
  const price = parseFloat(suggestion.priceRange.minVariantPrice.amount);

  const handleAdd = async () => {
    if (!variant || adding) return;
    setAdding(true);
    // skipUpsell stops the companion product from triggering its own offer.
    await addItem(variant.id, 1, { skipUpsell: true });
    setAdding(false);
    dismissUpsell();
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={dismissUpsell}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={dismissUpsell}>
        {/* Swallow taps on the sheet so they don't dismiss it. */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />

          <Text style={styles.addedNote}>✅ Added to cart</Text>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.blurb}>{blurb}</Text>

          <View style={styles.product}>
            <Image
              source={{ uri: image?.url }}
              style={styles.thumb}
              contentFit="contain"
              transition={200}
              placeholder={Colors.bg.elevated}
            />
            <View style={styles.productInfo}>
              <Text style={styles.productTitle} numberOfLines={3}>
                {suggestion.title}
              </Text>
              <Text style={styles.productPrice}>${price.toFixed(2)}</Text>
            </View>
          </View>

          <Pressable
            style={[styles.cta, (!variant || adding) && styles.ctaDisabled]}
            onPress={handleAdd}
            disabled={!variant || adding}
            accessibilityRole="button"
            accessibilityLabel={`Add ${suggestion.title} to cart`}
          >
            {adding ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.ctaText}>
                {variant ? `Add for $${price.toFixed(2)}` : 'Out of stock'}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.dismiss}
            onPress={dismissUpsell}
            accessibilityRole="button"
          >
            <Text style={styles.dismissText}>No thanks</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[8],
    borderTopWidth: 1,
    borderColor: Colors.border.accent,
    ...Shadow.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.text.muted,
    marginBottom: Spacing[4],
  },
  addedNote: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.xs,
    color: Colors.success,
    marginBottom: Spacing[3],
  },
  eyebrow: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.brand.violet,
    letterSpacing: 2,
  },
  headline: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.xl,
    color: Colors.text.primary,
    marginTop: 2,
  },
  blurb: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing[2],
    lineHeight: 20,
  },
  product: {
    flexDirection: 'row',
    gap: Spacing[3],
    alignItems: 'center',
    backgroundColor: Colors.bg.elevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing[3],
    marginTop: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bg.card,
  },
  productInfo: { flex: 1, gap: 4 },
  productTitle: {
    fontFamily: FontFamily.outfitMedium,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  productPrice: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  cta: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    marginTop: Spacing[5],
  },
  ctaDisabled: { backgroundColor: Colors.bg.elevated },
  ctaText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  dismiss: {
    alignItems: 'center',
    paddingVertical: Spacing[3],
    marginTop: Spacing[1],
  },
  dismissText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.muted,
  },
});
