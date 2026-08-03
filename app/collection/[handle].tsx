// PetezPopz — Collection Grid Screen
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
import { fetchCollection, COLLECTION_SORT_OPTIONS, CollectionSortKey, SortChoice } from '../../src/api/queries/collections';
import { Product } from '../../src/api/shopify-storefront';
import { filterVisibleProducts } from '../../src/utils/productFilters';

function matchesSearch(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    product.title.toLowerCase().includes(q) ||
    product.vendor.toLowerCase().includes(q) ||
    product.tags.some((t) => t.toLowerCase().includes(q))
  );
}

export default function CollectionScreen() {
  const { handle, requireTag } = useLocalSearchParams<{ handle: string; requireTag?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sort, setSort] = useState<SortChoice<CollectionSortKey>>(COLLECTION_SORT_OPTIONS[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadProducts = useCallback(
    async (choice: SortChoice<CollectionSortKey>, after?: string) => {
      if (!handle) return;
      if (!after) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await fetchCollection(handle, 24, after, choice.sortKey, choice.reverse);
        const col = res.data.collection;
        if (!col) return;

        setTitle(col.title);
        setHasNextPage(col.products.pageInfo.hasNextPage);
        setCursor(col.products.pageInfo.endCursor);

        let visible = filterVisibleProducts(col.products.nodes);
        // Some collections (e.g. franchise/character collections) mix products
        // across brand lines — requireTag narrows to just the brand this
        // collection was reached under (e.g. only Loungefly-tagged items).
        if (requireTag) {
          visible = visible.filter((p) =>
            p.tags.some((t) => t.toLowerCase() === requireTag.toLowerCase()),
          );
        }

        if (after) {
          setProducts((prev) => [...prev, ...visible]);
        } else {
          setProducts(visible);
        }
      } catch (err) {
        console.warn('Collection fetch error:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [handle, requireTag],
  );

  useEffect(() => {
    loadProducts(sort);
  }, [handle, requireTag, sort]);

  const handleLoadMore = () => {
    if (hasNextPage && cursor && !loadingMore) {
      loadProducts(sort, cursor);
    }
  };

  // Shopify's Collection.products field has no free-text search argument —
  // only faceted filters (tag/price/etc). So search here filters what's
  // already loaded; a short/empty filtered list naturally sits at "the end"
  // of the FlatList, which keeps triggering onEndReached to pull in more of
  // the real collection until it's fully exhausted or matches turn up.
  const displayed = searchQuery
    ? products.filter((p) => matchesSearch(p, searchQuery))
    : products;

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: title || 'Collection' }} />

      <SortBar options={COLLECTION_SORT_OPTIONS} value={sort} onChange={setSort} />
      <InlineSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={title ? `Search in ${title}…` : 'Search this section…'}
      />

      {loading ? (
        <ActivityIndicator
          color={Colors.brand.violet}
          size="large"
          style={{ flex: 1 }}
        />
      ) : (
        <FlatList
          data={displayed}
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
              {searchQuery && hasNextPage ? (
                <ActivityIndicator color={Colors.brand.violet} />
              ) : (
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? `No matches for "${searchQuery}" in this collection.`
                    : 'No products found in this collection.'}
                </Text>
              )}
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
