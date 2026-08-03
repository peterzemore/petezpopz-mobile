// PetezPopz — Products-by-Tag Grid Screen
// Used for brand lines (e.g. "Loungefly") that are identified by a product tag
// rather than curated into a single Shopify collection.
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
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing } from '../../src/theme/spacing';
import { ProductCard } from '../../src/components/ui/ProductCard';
import { SortBar } from '../../src/components/ui/SortBar';
import { InlineSearchBar } from '../../src/components/ui/InlineSearchBar';
import { fetchProductsByTag, PRODUCT_SORT_OPTIONS, ProductSortKey, SortChoice } from '../../src/api/queries/products';
import { Product } from '../../src/api/shopify-storefront';

const SEARCH_DEBOUNCE_MS = 400;

export default function TagBrowseScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sort, setSort] = useState<SortChoice<ProductSortKey>>(PRODUCT_SORT_OPTIONS[1]); // Best Selling
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadProducts = useCallback(
    async (choice: SortChoice<ProductSortKey>, after?: string) => {
      if (!tag) return;
      if (!after) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await fetchProductsByTag(tag, 24, after, choice.sortKey, choice.reverse, searchQuery);
        const nodes = res.data.products?.nodes ?? [];
        const pageInfo = res.data.products?.pageInfo;
        setHasNextPage(pageInfo?.hasNextPage ?? false);
        setCursor(pageInfo?.endCursor ?? null);
        setProducts((prev) => (after ? [...prev, ...nodes] : nodes));
      } catch (err) {
        console.warn('Tag browse fetch error:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tag, searchQuery],
  );

  useEffect(() => {
    loadProducts(sort);
  }, [tag, sort, searchQuery]);

  const handleLoadMore = () => {
    if (hasNextPage && cursor && !loadingMore) {
      loadProducts(sort, cursor);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: tag ?? 'Browse' }} />

      <SortBar options={PRODUCT_SORT_OPTIONS} value={sort} onChange={setSort} />
      <InlineSearchBar
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder={`Search ${tag ?? 'this section'}…`}
      />

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
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `No matches for "${searchQuery}" in ${tag}.`
                  : `No products found for "${tag}".`}
              </Text>
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
