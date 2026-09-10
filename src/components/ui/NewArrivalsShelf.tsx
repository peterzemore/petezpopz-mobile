// PetezPopz — NewArrivalsShelf Component
// Horizontal shelf of this month's new products, sourced from the "New Arrivals"
// tag. Took the VIP Drops slot on the home screen on 2026-09-09: paid-tier early
// access does not exist yet, so a VIP shelf there was a promise the store can't
// keep. VIPDropsShelf stays in the tree for when member early access ships.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { fetchNewArrivals } from '../../api/queries/collections';
import { Product } from '../../api/shopify-storefront';
import { ProductCard } from './ProductCard';

const CARD_WIDTH = 160;

export function NewArrivalsShelf() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNewArrivals()
      .then((res) => setProducts(res.data.products?.nodes ?? []))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  // Render nothing when nothing is tagged, so the home screen never shows an
  // empty section between the loyalty block and Shop by Brand.
  if (loading || !products.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>🆕 NEW ARRIVALS</Text>
        <Text style={styles.sub}>Fresh in the store this month.</Text>
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
