// PetezPopz — Cart Zustand Store
import { create } from 'zustand';
import {
  Cart,
  CartLine,
  Product,
} from '../api/shopify-storefront';
import {
  createCart,
  addCartLines,
  updateCartLines,
  removeCartLines,
  applyDiscountCode,
  removeDiscountCode,
  setBOPISPickup,
  fetchCart,
} from '../api/queries/cart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveUpsell, type UpsellOffer } from '../api/queries/upsell';

const CART_ID_KEY = 'ppz_cart_id';

interface AddItemOptions {
  /**
   * The product the variant belongs to. Callers already hold it, so passing it
   * avoids a variant→product lookup round trip. Omit it and no offer is made.
   */
  product?: Product;
  /** Skip the companion-product offer — set when adding the offer itself. */
  skipUpsell?: boolean;
}

interface CartState {
  cart: Cart | null;
  cartId: string | null;
  isLoading: boolean;
  isBOPIS: boolean;
  error: string | null;
  /** Companion product to offer for the item just added, if any. */
  pendingUpsell: UpsellOffer | null;
  /** Products already offered this session, so a decline isn't re-asked. */
  offeredProductIds: string[];

  // Actions
  initCart: () => Promise<void>;
  addItem: (
    merchandiseId: string,
    quantity?: number,
    options?: AddItemOptions,
  ) => Promise<void>;
  dismissUpsell: () => void;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  applyCode: (code: string) => Promise<void>;
  removeCode: () => Promise<void>;
  toggleBOPIS: (isPickup: boolean) => Promise<void>;
  clearCart: () => Promise<void>;
  totalQuantity: () => number;
}

export const useCartStore = create<CartState>()((set, get) => ({
  cart: null,
  cartId: null,
  isLoading: false,
  isBOPIS: false,
  error: null,
  pendingUpsell: null,
  offeredProductIds: [],

  initCart: async () => {
    const storedId = await AsyncStorage.getItem(CART_ID_KEY);
    if (storedId) {
      try {
        const result = await fetchCart(storedId);
        if (result.data.cart) {
          set({ cart: result.data.cart, cartId: storedId });
          return;
        }
      } catch {
        // Cart expired or invalid — create a new one
      }
    }
    // Create a fresh cart
    const result = await createCart();
    const cart = result.data.cartCreate.cart;
    await AsyncStorage.setItem(CART_ID_KEY, cart.id);
    set({ cart, cartId: cart.id });
  },

  addItem: async (merchandiseId, quantity = 1, options = {}) => {
    set({ isLoading: true, error: null });
    try {
      let { cartId } = get();
      if (!cartId) {
        const result = await createCart([{ merchandiseId, quantity }]);
        const cart = result.data.cartCreate.cart;
        await AsyncStorage.setItem(CART_ID_KEY, cart.id);
        set({ cart, cartId: cart.id, isLoading: false });
      } else {
        const result = await addCartLines(cartId, [{ merchandiseId, quantity }]);
        set({ cart: result.data.cartLinesAdd.cart, isLoading: false });
      }
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
      return; // Nothing was added, so there's nothing to upsell against.
    }

    // Offer resolution is deliberately after the add has succeeded and outside
    // the try above: a failed suggestion must never surface as a cart error.
    const { product, skipUpsell } = options;
    if (skipUpsell || !product) return;
    if (get().offeredProductIds.includes(product.id)) return;

    const offer = await resolveUpsell(product);
    if (!offer) return;

    set((state) => ({
      pendingUpsell: offer,
      offeredProductIds: [...state.offeredProductIds, product.id],
    }));
  },

  dismissUpsell: () => set({ pendingUpsell: null }),

  updateItem: async (lineId, quantity) => {
    const { cartId } = get();
    if (!cartId) return;
    set({ isLoading: true });
    try {
      if (quantity <= 0) {
        await get().removeItem(lineId);
        return;
      }
      const result = await updateCartLines(cartId, [{ id: lineId, quantity }]);
      set({ cart: result.data.cartLinesUpdate.cart, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  removeItem: async (lineId) => {
    const { cartId } = get();
    if (!cartId) return;
    set({ isLoading: true });
    try {
      const result = await removeCartLines(cartId, [lineId]);
      set({ cart: result.data.cartLinesRemove.cart, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  applyCode: async (code) => {
    const { cartId } = get();
    if (!cartId) return;
    set({ isLoading: true });
    try {
      const result = await applyDiscountCode(cartId, code);
      set({ cart: result.data.cartDiscountCodesUpdate.cart, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  removeCode: async () => {
    const { cartId } = get();
    if (!cartId) return;
    set({ isLoading: true });
    try {
      const result = await removeDiscountCode(cartId);
      set({ cart: result.data.cartDiscountCodesUpdate.cart, isLoading: false });
    } catch (err: unknown) {
      set({ error: String(err), isLoading: false });
    }
  },

  toggleBOPIS: async (isPickup) => {
    const { cartId } = get();
    if (!cartId) return;
    set({ isBOPIS: isPickup });
    try {
      await setBOPISPickup(cartId, isPickup);
    } catch {
      // Non-critical — just log
    }
  },

  clearCart: async () => {
    await AsyncStorage.removeItem(CART_ID_KEY);
    set({
      cart: null,
      cartId: null,
      isBOPIS: false,
      pendingUpsell: null,
      offeredProductIds: [],
    });
  },

  totalQuantity: () => get().cart?.totalQuantity ?? 0,
}));
