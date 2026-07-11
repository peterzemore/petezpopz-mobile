// PetezPopz — Wishlist "Toy Box" Screen (Tab 3)
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeOutRight } from 'react-native-reanimated';
import { Colors } from '../../src/theme/colors';
import { FontFamily, FontSize } from '../../src/theme/typography';
import { Spacing, BorderRadius, Shadow } from '../../src/theme/spacing';
import { useWishlistStore, WishlistItem } from '../../src/store/wishlistStore';
import { useCartStore } from '../../src/store/cartStore';

function WishlistCard({ item, onRemove }: { item: WishlistItem; onRemove: () => void }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutRight} style={styles.card}>
      <Pressable
        style={styles.cardInner}
        onPress={() => router.push(`/product/${item.handle}`)}
      >
        <Image
          source={{ uri: item.imageUrl ?? undefined }}
          style={styles.cardImage}
          contentFit="contain"
          placeholder={Colors.bg.elevated}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.cardVendor} numberOfLines={1}>{item.vendor}</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardPrice}>
            ${parseFloat(item.price).toFixed(2)} {item.currencyCode}
          </Text>
          <Text style={styles.cardDate}>
            Added {new Date(item.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </Pressable>

      <View style={styles.cardActions}>
        <Pressable style={styles.addToCartBtn} onPress={() => addItem(item.id)}>
          <Text style={styles.addToCartText}>🛒 Add to Cart</Text>
        </Pressable>
        <Pressable style={styles.removeBtn} onPress={onRemove}>
          <Text style={styles.removeText}>✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function ToyBoxScreen() {
  const { items, removeItem, clearAll, toShareText } = useWishlistStore();
  const router = useRouter();

  const handleShare = async () => {
    try {
      await Share.share({
        message: toShareText(),
        title: 'My PetezPopz Wish List',
      });
    } catch (err) {
      console.warn('Share failed:', err);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Toy Box?',
      'This will remove all items from your wish list.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearAll },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🧸 Toy Box</Text>
          <Text style={styles.subtitle}>
            {items.length} item{items.length !== 1 ? 's' : ''} saved
          </Text>
        </View>
        <View style={styles.headerActions}>
          {items.length > 0 && (
            <>
              <Pressable style={styles.shareBtn} onPress={handleShare}>
                <Text style={styles.shareBtnText}>Share 🔗</Text>
              </Pressable>
              <Pressable style={styles.clearBtn} onPress={handleClearAll}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧸</Text>
          <Text style={styles.emptyTitle}>Your Toy Box is empty</Text>
          <Text style={styles.emptySub}>
            Tap the ❤️ on any product to save it here for later.
          </Text>
          <Pressable style={styles.shopBtn} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={styles.shopBtnText}>Browse the Store →</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Share info */}
          <Pressable style={styles.shareBanner} onPress={handleShare}>
            <Text style={styles.shareBannerIcon}>📤</Text>
            <Text style={styles.shareBannerText}>
              Share your gift list via SMS, AirDrop, or Email
            </Text>
            <Text style={styles.shareBannerArrow}>›</Text>
          </Pressable>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <WishlistCard item={item} onRemove={() => removeItem(item.id)} />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: Spacing[3] }} />}
            ListFooterComponent={<View style={{ height: 100 }} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[5],
    paddingBottom: Spacing[3],
  },
  title: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize['2xl'],
    color: Colors.text.primary,
  },
  subtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  shareBtn: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  shareBtnText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  clearBtn: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  clearBtnText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },

  // Share banner
  shareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing[4],
    marginBottom: Spacing[4],
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    gap: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.border.accent,
  },
  shareBannerIcon: { fontSize: 24 },
  shareBannerText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    flex: 1,
  },
  shareBannerArrow: {
    fontFamily: FontFamily.outfitBold,
    fontSize: 22,
    color: Colors.brand.violet,
  },

  // List
  list: {
    paddingHorizontal: Spacing[4],
  },
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
    ...Shadow.sm,
  },
  cardInner: {
    flexDirection: 'row',
    padding: Spacing[3],
    gap: Spacing[3],
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bg.elevated,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
    paddingVertical: Spacing[1],
  },
  cardVendor: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontFamily: FontFamily.outfitSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  cardPrice: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  cardDate: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  addToCartBtn: {
    flex: 1,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border.subtle,
  },
  addToCartText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.sm,
    color: Colors.brand.violet,
  },
  removeBtn: {
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.md,
    color: Colors.text.muted,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
    gap: Spacing[4],
  },
  emptyIcon: { fontSize: 64 },
  emptyTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.xl,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  shopBtn: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
    marginTop: Spacing[2],
  },
  shopBtnText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
