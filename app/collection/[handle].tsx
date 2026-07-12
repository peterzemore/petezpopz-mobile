// PetezPopz — Collection Grid Screen
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing, BorderRadius } from '../../src/theme/spacing';
import { ProductCard } from '../../src/components/ui/ProductCard';
import { fetchCollection } from '../../src/api/queries/collections';
import { Product } from '../../src/api/shopify-storefront';
import { filterVisibleProducts } from '../../src/utils/productFilters';

type SortKey = 'COLLECTION_DEFAULT' | 'PRICE' | 'BEST_SELLING' | 'CREATED_AT';

const SORT_OPTIONS: { label: string; key: SortKey }[] = [
  { label: 'Featured', key: 'COLLECTION_DEFAULT' },
  { label: 'Best Selling', key: 'BEST_SELLING' },
  { label: 'Newest', key: 'CREATED_AT' },
  { label: 'Price', key: 'PRICE' },
];

export default function CollectionScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('COLLECTION_DEFAULT');

  const loadProducts = useCallback(
    async (sort: SortKey, after?: string) => {
      if (!handle) return;
      if (!after) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await fetchCollection(handle, 24, after, sort);
        const col = res.data.collection;
        if (!col) return;

        setTitle(col.title);
        setHasNextPage(col.products.pageInfo.hasNextPage);
        setCursor(col.products.pageInfo.endCursor);

        const visible = filterVisibleProducts(col.products.nodes);
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
    [handle],
  );

  useEffect(() => {
    loadProducts(sortKey);
  }, [handle, sortKey]);

  const handleLoadMore = () => {
    if (hasNextPage && cursor && !loadingMore) {
      loadProducts(sortKey, cursor);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: title || 'Collection' }} />

      {/* Sort bar */}
      <View style={styles.sortBar}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.sortPill, sortKey === opt.key && styles.sortPillActive]}
            onPress={() => setSortKey(opt.key)}
          >
            <Text style={[styles.sortText, sortKey === opt.key && styles.sortTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator
          color={Colors.brand.violet}
          size="large"
          style={{ flex: 1 }}
        />
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
              <Text style={styles.emptyText}>No products found in this collection.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  sortBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[2],
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  sortPill: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bg.elevated,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  sortPillActive: {
    backgroundColor: Colors.brand.violet,
    borderColor: Colors.brand.violet,
  },
  sortText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  sortTextActive: { color: Colors.white },
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
