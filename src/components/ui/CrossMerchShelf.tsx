// PetezPopz — CrossMerchShelf Component ("Complete the Set")
// Fetches products by franchise tag and renders a horizontal scrollable shelf
// with independent Quick Add buttons that mutate cart without navigation.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import {
  fetchCrossMerchProducts,
  parseFranchiseTag,
} from '../../api/queries/products';
import { Product } from '../../api/shopify-storefront';
import { useCartStore } from '../../store/cartStore';
import { filterVisibleProducts } from '../../utils/productFilters';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  currentProduct: Product;
}

function CrossMerchCard({ product }: { product: Product }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);

  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const variant = product.variants.nodes[0];
  const image = product.images.nodes[0];
  const price = parseFloat(product.priceRange.minVariantPrice.amount);

  const handleQuickAdd = async () => {
    if (!variant) return;
    scale.value = withSequence(withSpring(0.9), withSpring(1.05), withSpring(1));
    await addItem(variant.id, 1, { product });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <Pressable onPress={() => router.push(`/product/${product.handle}`)}>
        <Image
          source={{ uri: image?.url }}
          style={styles.cardImage}
          contentFit="contain"
          transition={200}
          placeholder={Colors.bg.elevated}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{product.title}</Text>
          <Text style={styles.cardPrice}>${price.toFixed(2)}</Text>
        </View>
      </Pressable>

      <Pressable
        style={[styles.quickAdd, added && styles.quickAddDone]}
        onPress={handleQuickAdd}
      >
        <Text style={styles.quickAddText}>{added ? '✅ Added!' : '➕ Quick Add'}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function CrossMerchShelf({ currentProduct }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [franchiseTag, setFranchiseTag] = useState<string | null>(null);

  useEffect(() => {
    const tag = parseFranchiseTag(currentProduct.tags);
    setFranchiseTag(tag);
    if (!tag) {
      setLoading(false);
      return;
    }

    fetchCrossMerchProducts(tag, currentProduct.id)
      .then((res) => setProducts(filterVisibleProducts(res.data.products?.nodes ?? [])))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [currentProduct.id]);

  if (!franchiseTag || (!loading && !products.length)) return null;

  const franchise = franchiseTag.replace(/^franchise:/i, '');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.label}>COMPLETE THE SET</Text>
          <Text style={styles.title}>More {franchise} items</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✨</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.brand.violet} style={{ marginVertical: Spacing[5] }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: Spacing[3], paddingHorizontal: Spacing[4] }}
          renderItem={({ item }) => <CrossMerchCard product={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing[6],
    paddingTop: Spacing[5],
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    marginBottom: Spacing[4],
  },
  headerLeft: { gap: 2 },
  label: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.brand.violet,
    letterSpacing: 2,
  },
  title: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.xl,
    color: Colors.text.primary,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.accent,
  },
  badgeText: { fontSize: 20 },
  card: {
    width: 150,
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
    ...Shadow.sm,
  },
  cardImage: {
    width: 150,
    height: 150,
    backgroundColor: Colors.bg.elevated,
  },
  cardInfo: {
    padding: Spacing[2.5],
    gap: 3,
  },
  cardTitle: {
    fontFamily: FontFamily.outfitMedium,
    fontSize: FontSize.xs,
    color: Colors.text.primary,
    lineHeight: 16,
  },
  cardPrice: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  quickAdd: {
    backgroundColor: Colors.brand.violet,
    paddingVertical: Spacing[2],
    alignItems: 'center',
    marginHorizontal: Spacing[2],
    marginBottom: Spacing[2],
    borderRadius: BorderRadius.sm,
  },
  quickAddDone: {
    backgroundColor: Colors.success,
  },
  quickAddText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.xs,
    color: Colors.white,
  },
});
