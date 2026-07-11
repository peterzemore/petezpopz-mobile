// PetezPopz — GraphQL Queries: Customer Account API
//
// Metafield access architecture (2026-04):
// ─ All metafields read here correspond to [[extensions.metafields]] entries
//   in shopify.extension.toml — the shopify.appMetafields API declaration.
// ─ Transport: customerFetch() from shopify-storefront (unified endpoint,
//   Bearer token set by the PKCE flow, no static storefront token).

import { customerFetch } from '../shopify-storefront';

// ── Customer profile + all loyalty metafields ──────────────────────────────────
// Reads the three metafields declared in shopify.extension.toml:
//   custom.loyalty_points | custom.loyalty_lifetime_earned | custom.loyalty_tier

export const GET_CUSTOMER = `
  query GetCustomer {
    customer {
      id
      firstName
      lastName
      emailAddress { emailAddress }
      phoneNumber { phoneNumber }
      imageUrl
      defaultAddress {
        address1
        address2
        city
        province
        zip
        country
      }
      loyaltyPoints: metafield(namespace: "custom", key: "loyalty_points") {
        value
        type
      }
      loyaltyLifetime: metafield(namespace: "custom", key: "loyalty_lifetime_earned") {
        value
        type
      }
      loyaltyTierLabel: metafield(namespace: "custom", key: "loyalty_tier") {
        value
        type
      }
    }
  }
`;

export interface AppMetafieldValue {
  value: string;
  type: string;
}

export interface CustomerProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddress: { emailAddress: string } | null;
  phoneNumber: { phoneNumber: string } | null;
  imageUrl: string | null;
  defaultAddress: {
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    zip: string;
    country: string;
  } | null;
  // Named aliases matching [[extensions.metafields]] declarations
  loyaltyPoints: AppMetafieldValue | null;
  loyaltyLifetime: AppMetafieldValue | null;
  loyaltyTierLabel: AppMetafieldValue | null;
}

export async function fetchCustomer(accessToken: string) {
  return customerFetch<{ customer: CustomerProfile }>(GET_CUSTOMER, accessToken);
}

// ── Customer orders (points transaction history) ──────────────────────────────
// points_earned per order is written by the Shopify Flow webhook; we read it here
// as an appMetafield (declared in shopify.extension.toml → custom.points_earned).

export const GET_CUSTOMER_ORDERS = `
  query GetCustomerOrders($first: Int!, $after: String) {
    customer {
      orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          processedAt
          financialStatus
          fulfillmentStatus
          totalPrice { amount currencyCode }
          lineItems(first: 20) {
            nodes {
              title
              quantity
              price { amount currencyCode }
            }
          }
          pointsEarned: metafield(namespace: "custom", key: "points_earned") {
            value
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export interface CustomerOrder {
  id: string;
  name: string;
  processedAt: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalPrice: { amount: string; currencyCode: string };
  lineItems: {
    nodes: Array<{
      title: string;
      quantity: number;
      price: { amount: string; currencyCode: string };
    }>;
  };
  pointsEarned: { value: string } | null;
}

export async function fetchCustomerOrders(
  accessToken: string,
  first = 20,
  after?: string,
) {
  return customerFetch<{
    customer: {
      orders: {
        nodes: CustomerOrder[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
  }>(GET_CUSTOMER_ORDERS, accessToken, { first, after });
}

// ── Loyalty calculation helpers ────────────────────────────────────────────────

export const LOYALTY_EARN_RATE = Number(
  process.env.EXPO_PUBLIC_LOYALTY_EARN_RATE ?? 1,
);
export const REDEMPTION_POINTS = Number(
  process.env.EXPO_PUBLIC_LOYALTY_REDEMPTION_POINTS ?? 100,
);
export const REDEMPTION_VALUE = Number(
  process.env.EXPO_PUBLIC_LOYALTY_REDEMPTION_VALUE ?? 5,
);
export const VIP_THRESHOLD = Number(
  process.env.EXPO_PUBLIC_VIP_THRESHOLD_POINTS ?? 500,
);

export interface LoyaltyTier {
  name: 'Common' | 'Exclusive' | 'Chase' | 'Vaulted';
  minPoints: number;
  maxPoints: number;
  color: string;
  emoji: string;
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  { name: 'Common',    minPoints: 0,    maxPoints: 299,      color: '#9CA3AF', emoji: '⚪' },
  { name: 'Exclusive', minPoints: 300,  maxPoints: 699,      color: '#60A5FA', emoji: '🔵' },
  { name: 'Chase',     minPoints: 700,  maxPoints: 1499,     color: '#A78BFA', emoji: '💜' },
  { name: 'Vaulted',   minPoints: 1500, maxPoints: Infinity, color: '#FFD700', emoji: '🏆' },
];

export function getLoyaltyTier(points: number): LoyaltyTier {
  return (
    LOYALTY_TIERS.slice()
      .reverse()
      .find((t) => points >= t.minPoints) ?? LOYALTY_TIERS[0]
  );
}

export function getNextTier(points: number): LoyaltyTier | null {
  return LOYALTY_TIERS.find((t) => t.minPoints > points) ?? null;
}

export function getProgressToNextTier(points: number): {
  current: LoyaltyTier;
  next: LoyaltyTier | null;
  progress: number;
  pointsNeeded: number;
} {
  const current = getLoyaltyTier(points);
  const next = getNextTier(points);
  if (!next) return { current, next: null, progress: 1, pointsNeeded: 0 };
  const tierRange = next.minPoints - current.minPoints;
  const pointsInTier = points - current.minPoints;
  return {
    current,
    next,
    progress: Math.min(pointsInTier / tierRange, 1),
    pointsNeeded: next.minPoints - points,
  };
}

export function calculatePointsForPurchase(totalAmountUSD: number): number {
  return Math.round(totalAmountUSD * LOYALTY_EARN_RATE);
}

export const REDEMPTION_TIERS = [
  { points: 100,  discountUSD: 5,  label: '100 Points = $5 Off',  code: 'REWARDS100' },
  { points: 200,  discountUSD: 10, label: '200 Points = $10 Off', code: 'REWARDS200' },
  { points: 400,  discountUSD: 20, label: '400 Points = $20 Off', code: 'REWARDS400' },
] as const;
