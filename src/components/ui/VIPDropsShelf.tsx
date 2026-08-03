// PetezPopz — VIPDropsShelf Component
// Horizontal shelf of VIP-only drops, sourced from the VIP_Only product tag.
//
// Shown to everyone on purpose, signed out included: seeing the drops you
// can't buy yet is what makes the membership worth paying for. Access is gated
// on the product page by VIPLockOverlay, not by hiding the shelf.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { fetchVIPReleases } from '../../api/queries/collections';
import { Product } from '../../api/shopify-storefront';
import { ProductCard } from './ProductCard';

const CARD_WIDTH = 160;

interface Props {
  /** True when the signed-in shopper is on a paid tier. */
  memberIsVIP?: boolean;
}

export function VIPDropsShelf({ memberIsVIP = false }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVIPReleases()
      .then((res) => setProducts(res.data.products?.nodes ?? []))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  // Render nothing at all when there are no VIP drops, so an untagged catalog
  // leaves no empty section behind on the home screen.
  if (loading || !products.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>✨ VIP DROPS</Text>
        <Text style={styles.sub}>
          {memberIsVIP
            ? 'Your early access — grab them before general release.'
            : 'Early access for Platinum members. Join to shop these first.'}
        </Text>
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing[3], paddingHorizontal: Spacing[4] }}
        renderItem={({ item }) => (
          <View style={{ width: CARD_WIDTH }}>
            <ProductCard product={item} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: Spacing[6] },
  header: { paddingHorizontal: Spacing[4], marginBottom: Spacing[3], gap: 4 },
  label: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.brand.violet,
    letterSpacing: 2,
  },
  sub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
});
