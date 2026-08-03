// PetezPopz — Search Results Screen
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Colors } from '../src/theme/colors';
import { FontFamily, FontSize } from '../src/theme/typography';
import { Spacing } from '../src/theme/spacing';
import { ProductCard } from '../src/components/ui/ProductCard';
import { SortBar } from '../src/components/ui/SortBar';
import { searchProducts, PRODUCT_SORT_OPTIONS, ProductSortKey, SortChoice } from '../src/api/queries/products';
import { Product } from '../src/api/shopify-storefront';

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sort, setSort] = useState<SortChoice<ProductSortKey>>(PRODUCT_SORT_OPTIONS[0]); // Featured/Relevance

  const loadResults = useCallback(
    async (choice: SortChoice<ProductSortKey>, after?: string) => {
      if (!q) return;
      if (!after) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await searchProducts(q, 24, after, choice.sortKey, choice.reverse);
        const nodes = res.data.products?.nodes ?? [];
        const pageInfo = res.data.products?.pageInfo;
        setHasNextPage(pageInfo?.hasNextPage ?? false);
        setCursor(pageInfo?.endCursor ?? null);
        setProducts((prev) => (after ? [...prev, ...nodes] : nodes));
      } catch (err) {
        console.warn('Search fetch error:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [q],
  );

  useEffect(() => {
    loadResults(sort);
  }, [q, sort]);

  const handleLoadMore = () => {
    if (hasNextPage && cursor && !loadingMore) {
      loadResults(sort, cursor);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: q ? `"${q}"` : 'Search' }} />

      <SortBar options={PRODUCT_SORT_OPTIONS} value={sort} onChange={setSort} />

      {loading ? (
        <ActivityIndicator color={Colors.brand.violet} size="large" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard product={item} />
            </View>
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={Colors.brand.violet} style={{ marginVertical: Spacing[5] }} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No results for "{q}".</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  grid: {
    padding: Spacing[4],
    paddingBottom: 100,
    gap: Spacing[3],
  },
  row: { gap: Spacing[3] },
  cardWrapper: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing[20],
  },
  emptyText: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: Colors.text.muted,
  },
});
