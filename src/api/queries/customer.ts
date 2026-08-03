// PetezPopz — GraphQL Queries: Customer Account API
//
// Metafield access: each metafield read here (custom.loyalty_points,
// custom.loyalty_lifetime_earned, custom.loyalty_tier, custom.lifetime_spend)
// must have "Customer accounts" read access explicitly enabled on its own
// definition in Shopify Admin → Metafields and metaobjects → Customers.
// That's a per-definition Admin setting, unrelated to anything in this repo —
// there is no app-level config file that grants it. Without it, these queries
// silently return null regardless of whether the value was written correctly
// (e.g. via Shopify Flow). A newly-added metafield (like lifetime_spend) needs
// this enabled separately — it does not inherit from any other metafield.
//
// Transport: customerFetch() from shopify-storefront (unified endpoint,
// Bearer token set by the PKCE flow, no static storefront token).

import { customerFetch } from '../shopify-storefront';

// ── Customer profile + all loyalty metafields ──────────────────────────────────

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
      lifetimeSpend: metafield(namespace: "custom", key: "lifetime_spend") {
        value
        type
      }
      membershipTier: metafield(namespace: "custom", key: "membership_tier") {
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
  // GraphQL aliases for the custom.loyalty_points / loyalty_lifetime_earned / loyalty_tier / lifetime_spend metafields
  loyaltyPoints: AppMetafieldValue | null;
  loyaltyLifetime: AppMetafieldValue | null;
  loyaltyTierLabel: AppMetafieldValue | null;
  // Kept for display and history. No longer gates any perk — membership
  // replaced the spend-based VIP tier on 2026-08-03.
  lifetimeSpend: AppMetafieldValue | null;
  // "silver" | "gold" | "platinum", written by the membership service
  // (~/Desktop/petezpopz-membership) when a subscription bills or cancels.
  membershipTier: AppMetafieldValue | null;
}

export async function fetchCustomer(accessToken: string) {
  return customerFetch<{ customer: CustomerProfile }>(GET_CUSTOMER, accessToken);
}

// ── Customer orders (points transaction history) ──────────────────────────────
// points_earned per order is written by the Shopify Flow workflow onto the
// order's custom.points_earned metafield; read here for the app's order history.

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
// ── Membership tiers ──────────────────────────────────────────────────────────
//
// Replaced the old spend-based VIP tier on 2026-08-03. Perks are now bought,
// not earned: a paid monthly subscription writes custom.membership_tier, and
// matching Shopify customer segments drive the real discounts at checkout.
//
// These percentages MUST stay in sync with the Shopify automatic discounts
// (Gold Member 10% / Platinum Member 12%) and with lib/tiers.js in the
// membership service. This table only decides what price the app *shows* —
// Shopify decides what the customer is actually charged, so a mismatch here
// means the app quotes a price checkout won't honour.

// "none" = has an account but hasn't opted into email or SMS marketing.
// Silver is the reward for subscribing, so it can't be the default.
export type MembershipTier = 'none' | 'silver' | 'gold' | 'platinum';

export interface MembershipInfo {
  tier: MembershipTier;
  label: string;
  emoji: string;
  /** Fraction off, e.g. 0.10 for 10%. */
  discountRate: number;
  /** True for the paid tiers. */
  paid: boolean;
  /** True once the customer has at least the free tier (i.e. subscribed). */
  enrolled: boolean;
  /** Free shipping threshold in USD; null when the tier has no member rate. */
  freeShippingOver: number | null;
}

export const MEMBERSHIPS: Record<MembershipTier, MembershipInfo> = {
  none: { tier: 'none', label: 'Guest', emoji: '👋', discountRate: 0, paid: false, enrolled: false, freeShippingOver: null },
  silver: { tier: 'silver', label: 'Silver', emoji: '🥈', discountRate: 0, paid: false, enrolled: true, freeShippingOver: null },
  gold: { tier: 'gold', label: 'Gold', emoji: '🥇', discountRate: 0.10, paid: true, enrolled: true, freeShippingOver: 79 },
  platinum: { tier: 'platinum', label: 'Platinum', emoji: '👑', discountRate: 0.12, paid: true, enrolled: true, freeShippingOver: 79 },
};

/** Free shipping threshold for everyone else. */
export const STANDARD_FREE_SHIPPING_OVER = 99;

/**
 * Normalise whatever is in the metafield to a known tier.
 *
 * Unrecognised or missing values fall back to Guest, not Silver — a customer
 * with no record hasn't opted into marketing, so hasn't earned the free tier.
 */
export function resolveMembership(raw?: string | null): MembershipInfo {
  const key = String(raw ?? '').trim().toLowerCase() as MembershipTier;
  return MEMBERSHIPS[key] ?? MEMBERSHIPS.none;
}

/** True once the customer has subscribed and holds at least Silver. */
export function isEnrolled(tier?: string | null): boolean {
  return resolveMembership(tier).enrolled;
}

/** True when the customer is on a paid tier. */
export function isMember(tier?: string | null): boolean {
  return resolveMembership(tier).paid;
}

/** Price after the member discount for this tier. */
export function applyMemberDiscount(price: number, tier?: string | null): number {
  return price * (1 - resolveMembership(tier).discountRate);
}

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
  // Progress is measured against the top tier's threshold (not the current
  // tier's own range) to match how LoyaltyGauge draws its tier markers —
  // both need to share the same 0-to-max-tier scale for the bar and the
  // markers to actually line up.
  const maxTierThreshold = LOYALTY_TIERS[LOYALTY_TIERS.length - 1].minPoints;
  if (!next) return { current, next: null, progress: 1, pointsNeeded: 0 };
  return {
    current,
    next,
    progress: Math.min(points / maxTierThreshold, 1),
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
