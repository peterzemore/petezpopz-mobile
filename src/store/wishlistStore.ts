// PetezPopz — Wishlist Zustand Store
// Saves to AsyncStorage locally; syncs to customer metafield when authenticated.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../api/shopify-storefront';

export interface WishlistItem {
  id: string;
  // The variant to add to cart. Shopify's cart API requires a ProductVariant
  // ID, not a Product ID (`id` above) — these are different object types, so
  // "Add to Cart" here must never use `id` directly. May be missing on items
  // saved before this field existed; toybox.tsx falls back to re-fetching the
  // product by handle in that case.
  variantId: string | null;
  handle: string;
  title: string;
  imageUrl: string | null;
  price: string;
  currencyCode: string;
  vendor: string;
  addedAt: string;
}

interface WishlistState {
  items: WishlistItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  hasItem: (productId: string) => boolean;
  clearAll: () => void;
  toShareText: () => string;
}

function productToWishlistItem(product: Product): WishlistItem {
  return {
    id: product.id,
    variantId: product.variants.nodes[0]?.id ?? null,
    handle: product.handle,
    title: product.title,
    imageUrl: product.images.nodes[0]?.url ?? null,
    price: product.priceRange.minVariantPrice.amount,
    currencyCode: product.priceRange.minVariantPrice.currencyCode,
    vendor: product.vendor,
    addedAt: new Date().toISOString(),
  };
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        const item = productToWishlistItem(product);
        set((state) => ({
          items: state.items.some((i) => i.id === item.id)
            ? state.items
            : [item, ...state.items],
        }));
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== productId),
        }));
      },

      hasItem: (productId) => {
        return get().items.some((i) => i.id === productId);
      },

      clearAll: () => set({ items: [] }),

      toShareText: () => {
        const { items } = get();
        if (!items.length) return 'My PetezPopz Wish List is empty!';

        const lines = [
          '🎁 My PetezPopz Wish List',
          '━━━━━━━━━━━━━━━━━━━━━━━━',
          ...items.map(
            (item, i) =>
              `${i + 1}. ${item.title} — $${Number(item.price).toFixed(2)}\n   https://www.petezpopz.com/products/${item.handle}`,
          ),
          '',
          '✨ Shop at www.petezpopz.com',
        ];
        return lines.join('\n');
      },
    }),
    {
      name: 'ppz-wishlist',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
