// PetezPopz — Auth Zustand Store
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearTokens,
  deleteAccountFromShopify,
  getStoredTokens,
  isTokenExpired,
  logoutFromShopify,
  refreshAccessToken,
  saveTokens,
} from '../api/shopify-customer';
import { fetchCustomer, CustomerProfile } from '../api/queries/customer';
import { useCartStore } from './cartStore';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  customer: CustomerProfile | null;
  loyaltyPoints: number;
  // Lifetime order spend — VIP status is based on this, NOT loyaltyPoints,
  // so redeeming points for a discount never costs someone VIP status.
  lifetimeSpend: number;
  /** "silver" | "gold" | "platinum" — from custom.membership_tier. */
  membershipTier: string;

  // Actions
  setTokens: (
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    idToken?: string | null,
  ) => Promise<void>;
  loadSession: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  fetchProfile: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

// On Android, the OAuth redirect can be caught by two independent listeners
// at once — expo-web-browser's in-app auth-session completion (app/auth/login.tsx)
// and expo-router's normal deep-link routing to app/callback.tsx (added because
// the former is unreliable in standalone Android builds). Both may try to
// exchange the same single-use authorization code; whichever loses that race
// gets an already-used-code error even though the other one is signing in
// successfully. Losers call this instead of treating that as a real failure.
export function waitForAuthenticated(timeoutMs = 8000): Promise<boolean> {
  if (useAuthStore.getState().isAuthenticated) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.isAuthenticated) {
        clearTimeout(timer);
        unsubscribe();
        resolve(true);
      }
    });
  });
}

/**
 * Everything on the device that could carry one customer into the next one's
 * session: the cart (and its buyer identity) and the checkout sheet's preload
 * cache. The checkout web view's own cookies are outside the kit's API, which
 * is why the cart is re-created rather than reused.
 */
async function forgetCustomerOnDevice(): Promise<void> {
  await useCartStore.getState().resetForSignOut().catch(() => {});
  try {
    // Required lazily: instantiating the kit at module scope in a route file
    // breaks Expo Router's route discovery (see app/checkout.tsx).
    const { ShopifyCheckoutSheet } = require('@shopify/checkout-sheet-kit');
    new ShopifyCheckoutSheet().invalidate();
  } catch {
    // Not fatal; the cart reset alone already breaks the association.
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
      refreshToken: null,
      customer: null,
      loyaltyPoints: 0,
      lifetimeSpend: 0,
      membershipTier: 'silver',

      setTokens: async (accessToken, refreshToken, expiresIn, idToken = null) => {
        await saveTokens(accessToken, refreshToken, expiresIn, idToken);
        set({ accessToken, refreshToken, isAuthenticated: true });
        // Checkout should open as this customer, not as whoever the web view
        // last remembered.
        useCartStore.getState().setBuyer(accessToken).catch(() => {});
        await get().fetchProfile();
      },

      loadSession: async () => {
        set({ isLoading: true });
        try {
          const { accessToken, refreshToken, expiresAt } = await getStoredTokens();

          if (!accessToken || !refreshToken) {
            set({ isAuthenticated: false, isLoading: false });
            return;
          }

          if (isTokenExpired(expiresAt)) {
            const success = await get().refreshSession();
            if (!success) {
              set({ isAuthenticated: false, isLoading: false });
              return;
            }
          } else {
            set({ accessToken, refreshToken, isAuthenticated: true });
            await get().fetchProfile();
          }
        } catch (err) {
          // If anything fails, simply ensure we are logged out
          set({ isAuthenticated: false, isLoading: false });
        } finally {
          set({ isLoading: false });
        }
      },

      refreshSession: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        try {
          const tokens = await refreshAccessToken(refreshToken);
          await saveTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
          set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
          await get().fetchProfile();
          return true;
        } catch {
          await clearTokens();
          set({ isAuthenticated: false, accessToken: null, refreshToken: null, customer: null });
          return false;
        }
      },

      fetchProfile: async () => {
        const { accessToken } = get();
        if (!accessToken) return;
        try {
          const result = await fetchCustomer(accessToken);
          const customer = result.data.customer;
          // customer.loyaltyPoints is a GraphQL alias for the custom.loyalty_points metafield
          const rawPoints = Number(customer.loyaltyPoints?.value ?? 0);
          // Kept for display only — perks are driven by membershipTier now.
          const spend = Number(customer.lifetimeSpend?.value ?? 0);
          // Written by the membership service on subscription billing/cancel.
          // Null means "never subscribed", which resolves to Silver downstream.
          const membership = String(customer.membershipTier?.value ?? 'silver').toLowerCase();
          set({
            customer,
            loyaltyPoints: rawPoints,
            lifetimeSpend: spend,
            membershipTier: membership,
          });
        } catch (err) {
          console.warn('Failed to fetch customer profile:', err);
        }
      },

      logout: async () => {
        await logoutFromShopify();
        await clearTokens();
        await forgetCustomerOnDevice();
        set({
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          customer: null,
          loyaltyPoints: 0,
              lifetimeSpend: 0,
          membershipTier: 'silver',
        });
      },

      deleteAccount: async () => {
        const { accessToken } = get();
        if (!accessToken) throw new Error('Not signed in');
        await deleteAccountFromShopify(accessToken);
        await clearTokens();
        await forgetCustomerOnDevice();
        set({
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          customer: null,
          loyaltyPoints: 0,
              lifetimeSpend: 0,
          membershipTier: 'silver',
        });
      },
    }),
    {
      name: 'ppz-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // isAuthenticated is deliberately NOT persisted — it must always be
        // freshly derived from whether a real token exists in SecureStore
        // (via loadSession() on every launch), never trusted from a cached
        // flag. A stale `true` here with no matching valid token is exactly
        // what produces "looks signed in but sign in/out don't work."
        customer: state.customer,
        loyaltyPoints: state.loyaltyPoints,
        lifetimeSpend: state.lifetimeSpend,
        membershipTier: state.membershipTier,
      }),
    },
  ),
);
