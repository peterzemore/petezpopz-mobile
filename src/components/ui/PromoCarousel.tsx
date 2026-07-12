// PetezPopz — PromoCarousel Component
// Auto-scrolling hero banner pulling from App-Exclusive-Promo collection.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { fetchPromoBanners } from '../../api/queries/collections';
import { Product } from '../../api/shopify-storefront';
import { filterVisibleProducts } from '../../utils/productFilters';

const { width: SCREEN_W } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_W - Spacing[8];
const AUTO_SCROLL_MS = 4000;

export function PromoCarousel() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchPromoBanners()
      .then((res) => {
        const nodes = (res.data.collection?.products.nodes ?? []) as Product[];
        setProducts(filterVisibleProducts(nodes));
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!products.length) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % products.length;
        flatRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_SCROLL_MS);
    return () => { if (timerRef.current !== null) clearInterval(timerRef.current); };
  }, [products.length]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.brand.violet} />
      </View>
    );
  }

  if (!products.length) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatRef}
        data={products}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={BANNER_WIDTH + Spacing[4]}
        decelerationRate="fast"
        contentContainerStyle={{ gap: Spacing[4], paddingHorizontal: Spacing[4] }}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / (BANNER_WIDTH + Spacing[4]));
          setActiveIndex(newIndex);
        }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.banner}
            onPress={() => router.push(`/product/${item.handle}`)}
          >
            <Image
              source={{ uri: item.images.nodes[0]?.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient
              colors={['transparent', 'rgba(10,10,18,0.85)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.bannerContent}>
              {item.tags.includes('App-Exclusive') && (
                <View style={styles.exclusivePill}>
                  <Text style={styles.exclusiveText}>📱 APP EXCLUSIVE</Text>
                </View>
              )}
              <Text style={styles.bannerTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.bannerPrice}>
                From ${parseFloat(item.priceRange.minVariantPrice.amount).toFixed(2)}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {/* Dot indicators */}
      <View style={styles.dots}>
        {products.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: Spacing[4] },
  loader: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    width: BANNER_WIDTH,
    height: 220,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bannerContent: {
    padding: Spacing[5],
    gap: Spacing[2],
  },
  exclusivePill: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  exclusiveText: {
    fontFamily: FontFamily.interBold,
    fontSize: 9,
    color: Colors.white,
    letterSpacing: 1.2,
  },
  bannerTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.xl,
    color: Colors.white,
    lineHeight: 26,
  },
  bannerPrice: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.md,
    color: Colors.tier.vaulted,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing[3],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border.default,
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.brand.violet,
  },
});
