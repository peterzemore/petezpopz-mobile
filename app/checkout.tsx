// PetezPopz — Checkout Screen
// Uses @shopify/checkout-sheet-kit to open Shopify's native checkout sheet.
// Exposes BOPIS toggle above the express checkout buttons.
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';
import { Colors } from '../src/theme/colors';
import { FontFamily, FontSize } from '../src/theme/typography';
import { Spacing, BorderRadius, Shadow } from '../src/theme/spacing';
import { useCartStore } from '../src/store/cartStore';
import { useAuthStore } from '../src/store/authStore';

export default function CheckoutScreen() {
  const router = useRouter();
  // Instantiate inside the component — avoids crashing Expo Router's route discovery
  const shopifyCheckoutRef = useRef<ShopifyCheckoutSheet | null>(null);
  if (!shopifyCheckoutRef.current) {
    shopifyCheckoutRef.current = new ShopifyCheckoutSheet();
  }
  const shopifyCheckout = shopifyCheckoutRef.current;
  const {
    cart,
    isBOPIS,
    toggleBOPIS,
    removeItem,
    updateItem,
    isLoading,
  } = useCartStore();
  const { loyaltyPoints } = useAuthStore();

  const [launching, setLaunching] = useState(false);

  const handleOpenCheckout = async () => {
    if (!cart?.checkoutUrl) {
      Alert.alert('Error', 'No checkout URL available. Please try again.');
      return;
    }
    setLaunching(true);
    try {
      shopifyCheckout.present(cart.checkoutUrl);
    } catch (err) {
      console.warn('Checkout sheet error:', err);
    } finally {
      setLaunching(false);
    }
  };

  if (!cart || cart.lines.nodes.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyCart}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Add some items before checking out!</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={styles.shopBtnText}>Browse the Store →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const subtotal = parseFloat(cart.cost.subtotalAmount.amount);
  const total = parseFloat(cart.cost.totalAmount.amount);
  const tax = cart.cost.totalTaxAmount ? parseFloat(cart.cost.totalTaxAmount.amount) : 0;
  const currencyCode = cart.cost.totalAmount.currencyCode;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Your Cart</Text>
        <Text style={styles.subtitle}>
          {cart.totalQuantity} item{cart.totalQuantity !== 1 ? 's' : ''}
        </Text>

        {/* Cart line items */}
        {cart.lines.nodes.map((line) => (
          <View key={line.id} style={styles.lineItem}>
            <Image
              source={{ uri: line.merchandise.image?.url }}
              style={styles.lineImage}
              contentFit="contain"
              placeholder={Colors.bg.elevated}
            />
            <View style={styles.lineInfo}>
              <Text style={styles.lineName} numberOfLines={2}>
                {line.merchandise.product.title}
              </Text>
              <Text style={styles.lineVariant}>{line.merchandise.title}</Text>
              <Text style={styles.linePrice}>
                ${parseFloat(line.merchandise.price.amount).toFixed(2)}
              </Text>

              {/* Quantity controls */}
              <View style={styles.qtyRow}>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => updateItem(line.id, line.quantity - 1)}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{line.quantity}</Text>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => updateItem(line.id, line.quantity + 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
                <Pressable onPress={() => removeItem(line.id)}>
                  <Text style={styles.removeText}>🗑️</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.lineTotal}>
              ${parseFloat(line.cost.totalAmount.amount).toFixed(2)}
            </Text>
          </View>
        ))}

        {/* ── BOPIS Toggle ──────────────────────────────────── */}
        <View style={styles.bopisCard}>
          <View style={styles.bopisLeft}>
            <Text style={styles.bopisIcon}>{isBOPIS ? '🏪' : '📦'}</Text>
            <View style={styles.bopisText}>
              <Text style={styles.bopisTitle}>
                {isBOPIS ? 'In-Store Pickup' : 'Standard Shipping'}
              </Text>
              <Text style={styles.bopisSub}>
                {isBOPIS
                  ? 'Pick up at PetezPopz — we\'ll have it ready!'
                  : 'Delivered to your door'}
              </Text>
            </View>
          </View>
          <Switch
            value={isBOPIS}
            onValueChange={(val) => toggleBOPIS(val)}
            trackColor={{ false: Colors.bg.elevated, true: Colors.brand.violet }}
            thumbColor={Colors.white}
          />
        </View>

        {/* ── Order Summary ─────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)} {currencyCode}</Text>
          </View>
          {tax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Est. Tax</Text>
              <Text style={styles.summaryValue}>${tax.toFixed(2)}</Text>
            </View>
          )}
          {isBOPIS && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pickup</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>FREE</Text>
            </View>
          )}
          {cart.discountCodes.filter((d) => d.applicable).map((d) => (
            <View key={d.code} style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: Colors.success }]}>
                🎟️ {d.code}
              </Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>Applied</Text>
            </View>
          ))}
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>${total.toFixed(2)} {currencyCode}</Text>
          </View>

          {/* Loyalty earn preview */}
          <View style={styles.loyaltyPreview}>
            <Text style={styles.loyaltyPreviewText}>
              ⭐ You'll earn{' '}
              <Text style={{ color: Colors.tier.vaulted, fontFamily: FontFamily.outfitBold }}>
                {Math.round(total)} points
              </Text>{' '}
              on this order
            </Text>
          </View>
        </View>

        {/* ── Express Checkout ──────────────────────────────── */}
        <View style={styles.expressSection}>
          <Text style={styles.expressLabel}>EXPRESS CHECKOUT</Text>

          {/* Apple Pay / Google Pay via Checkout Sheet Kit */}
          <Pressable
            style={styles.checkoutBtn}
            onPress={handleOpenCheckout}
            disabled={launching || isLoading}
          >
            <LinearGradient
              colors={[Colors.brand.violet, Colors.brand.rose]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {launching ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.checkoutBtnText}>
                🛒 Checkout — ${total.toFixed(2)}
              </Text>
            )}
          </Pressable>

          <Text style={styles.expressNote}>
            Apple Pay, Google Pay, and all major cards accepted at checkout
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[5],
    gap: Spacing[4],
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
    marginTop: -Spacing[2],
  },

  // Line items
  lineItem: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    gap: Spacing[3],
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  lineImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bg.elevated,
  },
  lineInfo: { flex: 1, gap: 4 },
  lineName: {
    fontFamily: FontFamily.outfitSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  lineVariant: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  linePrice: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  qtyBtnText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  qtyValue: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    minWidth: 20,
    textAlign: 'center',
  },
  removeText: { fontSize: 18, marginLeft: Spacing[2] },
  lineTotal: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },

  // BOPIS
  bopisCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.accent,
  },
  bopisLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], flex: 1 },
  bopisIcon: { fontSize: 28 },
  bopisText: { gap: 3 },
  bopisTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  bopisSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },

  // Summary
  summaryCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    gap: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  summaryTitle: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.md,
    color: Colors.text.primary,
    marginBottom: Spacing[1],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  summaryValue: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
    paddingTop: Spacing[3],
    marginTop: Spacing[1],
  },
  summaryTotalLabel: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.lg,
    color: Colors.text.primary,
  },
  summaryTotalValue: {
    fontFamily: FontFamily.outfitBlack,
    fontSize: FontSize.xl,
    color: Colors.text.primary,
  },
  loyaltyPreview: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  loyaltyPreviewText: {
    fontFamily: FontFamily.interMedium,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Express checkout
  expressSection: { gap: Spacing[3] },
  expressLabel: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    letterSpacing: 2,
    textAlign: 'center',
  },
  checkoutBtn: {
    height: 60,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.violet,
  },
  checkoutBtnText: {
    fontFamily: FontFamily.outfitBold,
    fontSize: FontSize.lg,
    color: Colors.white,
    zIndex: 1,
  },
  expressNote: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    textAlign: 'center',
  },

  // Empty cart
  emptyCart: {
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
  },
  emptySub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  shopBtn: {
    backgroundColor: Colors.brand.violet,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
  },
  shopBtnText: {
    fontFamily: FontFamily.interBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
