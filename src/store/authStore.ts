// PetezPopz — Auth Zustand Store
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearTokens,
  getStoredTokens,
  isTokenExpired,
  refreshAccessToken,
  saveTokens,
} from '../api/shopify-customer';
import { fetchCustomer, CustomerProfile, getLoyaltyTier, LoyaltyTier } from '../api/queries/customer';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  customer: CustomerProfile | null;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;

  // Actions
  setTokens: (accessToken: string, refreshToken: string, expiresIn: number) => Promise<void>;
  loadSession: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  fetchProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const DEFAULT_TIER: LoyaltyTier = {
  name: 'Common',
  minPoints: 0,
  maxPoints: 299,
  color: '#9CA3AF',
  emoji: '⚪',
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
      refreshToken: null,
      customer: null,
      loyaltyPoints: 0,
      loyaltyTier: DEFAULT_TIER,

      setTokens: async (accessToken, refreshToken, expiresIn) => {
        await saveTokens(accessToken, refreshToken, expiresIn);
        set({ accessToken, refreshToken, isAuthenticated: true });
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
        } catch {
          set({ isAuthenticated: false });
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
          // Read via named aliases that mirror [[extensions.metafields]] declarations
          const rawPoints = Number(customer.loyaltyPoints?.value ?? 0);
          const tier = getLoyaltyTier(rawPoints);
          set({ customer, loyaltyPoints: rawPoints, loyaltyTier: tier });
        } catch (err) {
          console.warn('Failed to fetch customer profile:', err);
        }
      },

      logout: async () => {
        await clearTokens();
        set({
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          customer: null,
          loyaltyPoints: 0,
          loyaltyTier: DEFAULT_TIER,
        });
      },
    }),
    {
      name: 'ppz-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist non-sensitive state — actual tokens live in SecureStore
        isAuthenticated: state.isAuthenticated,
        customer: state.customer,
        loyaltyPoints: state.loyaltyPoints,
        loyaltyTier: state.loyaltyTier,
      }),
    },
  ),
);
