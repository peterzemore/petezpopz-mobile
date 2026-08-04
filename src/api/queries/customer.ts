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
      birthday: metafield(namespace: "custom", key: "birthday") {
        value
        type
      }
      birthdayGiftCode: metafield(namespace: "custom", key: "birthday_gift_code") {
        value
        type
      }
      birthdayGiftExpires: metafield(namespace: "custom", key: "birthday_gift_expires") {
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
  // "MM-DD" — month and day only, no year.
  birthday: AppMetafieldValue | null;
  // Set by the birthday cron; the code expires, so both are read together.
  birthdayGiftCode: AppMetafieldValue | null;
  birthdayGiftExpires: AppMetafieldValue | null;
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

// Where a paid tier is actually bought. These open Shopify's hosted checkout
// rather than an in-app purchase: Apple requires IAP for digital content but
// forbids it for physical goods and real-world services, and this membership
// is discounts and protectors on physical merchandise. Routing through the
// same checkout the app already uses for orders keeps that unambiguous.
const STORE_URL = process.env.EXPO_PUBLIC_STORE_WEB_URL ?? 'https://petezpopz.com';
const SELLING_PLAN = process.env.EXPO_PUBLIC_MEMBERSHIP_SELLING_PLAN ?? '972193856';

// Membership variants and their selling plan.
//
// Two approaches were tried and both failed, which is worth recording:
//
//   /products/x?selling_plan=y  only preselects the plan on the product page.
//   The theme still has to carry it into the add-to-cart, and this theme has
//   no selling-plan support, so checkout rejected the line with "Variant can
//   only be purchased with a selling plan".
//
//   /cart/<variant>:1?selling_plan=y  returns 410. Cart permalinks can't carry
//   a selling plan, so a subscription-only product can't be added that way at
//   all — with or without the parameter.
//
// So the cart is built through the Storefront API with sellingPlanId on the
// line, and the customer is sent to that cart's checkoutUrl.
export const GOLD_VARIANT_ID =
  process.env.EXPO_PUBLIC_GOLD_VARIANT_ID ?? '41324862210112';
export const PLATINUM_VARIANT_ID =
  process.env.EXPO_PUBLIC_PLATINUM_VARIANT_ID ?? '41324862603328';
export const MEMBERSHIP_SELLING_PLAN_ID = SELLING_PLAN;

export const MEMBERSHIP_VARIANT: Record<'gold' | 'platinum', string> = {
  gold: `gid://shopify/ProductVariant/${GOLD_VARIANT_ID}`,
  platinum: `gid://shopify/ProductVariant/${PLATINUM_VARIANT_ID}`,
};

export const MEMBERSHIP_SELLING_PLAN_GID = `gid://shopify/SellingPlan/${SELLING_PLAN}`;

// Shopify's customer account area, where subscriptions, payment methods and
// cancellation live. /account on the store just redirects here, so this points
// straight at it. Note this is a separate web session from the app's OAuth
// token — the customer signs in again when they open it, which Shopify's
// hosted account area requires and the app can't bypass.
export const MANAGE_MEMBERSHIP_URL =
  process.env.EXPO_PUBLIC_CUSTOMER_ACCOUNT_URL ?? 'https://account.petezpopz.com';

/** Monthly price shown in the app. Kept alongside the tier table so the two can't drift. */
export const MEMBERSHIP_PRICE: Record<'gold' | 'platinum', string> = {
  gold: '$14.99',
  platinum: '$24.99',
};

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

// ── Points progress ───────────────────────────────────────────────────────────
//
// The old Common/Exclusive/Chase/Vaulted point ladder was retired on
// 2026-08-03. It ran alongside the membership tiers and meant a customer could
// be "Chase tier, Platinum member" — two ladders, neither explaining the other,
// with "Chase" also meaning a Funko chase variant.
//
// Membership is the status now. Points are simply the currency you redeem for
// coupons, so progress is measured toward the next redemption rather than
// toward a tier that conferred nothing.

export interface RedemptionProgress {
  /** The next reward they can work toward, or null once every tier is affordable. */
  next: { points: number; discountUSD: number } | null;
  /** 0–1 against the largest redemption, for the progress bar. */
  progress: number;
  /** Points still needed for `next`; 0 when maxed. */
  pointsNeeded: number;
  /** True when the balance covers the largest reward. */
  maxed: boolean;
}

export function getRedemptionProgress(points: number): RedemptionProgress {
  const top = REDEMPTION_TIERS[REDEMPTION_TIERS.length - 1];
  const next = REDEMPTION_TIERS.find((t) => points < t.points) ?? null;

  if (!next) {
    return { next: null, progress: 1, pointsNeeded: 0, maxed: true };
  }
  return {
    next: { points: next.points, discountUSD: next.discountUSD },
    // Scaled against the top tier so the bar and its markers share one axis.
    progress: Math.min(points / top.points, 1),
    pointsNeeded: next.points - points,
    maxed: false,
  };
}

export function calculatePointsForPurchase(totalAmountUSD: number): number {
  return Math.round(totalAmountUSD * LOYALTY_EARN_RATE);
}

// No `code` field. These were REWARDS100/200/400 — shared static codes that
// worked for anyone with zero points. Redemption now mints a unique single-use
// code per customer server-side, so nothing here should name a code.
// Values must stay in step with TIERS in barcode-proxy/lib/redeem.js, which is
// what actually enforces them.
export const REDEMPTION_TIERS = [
  { points: 100, discountUSD: 5,  label: '100 Points = $5 Off' },
  { points: 200, discountUSD: 10, label: '200 Points = $10 Off' },
  { points: 400, discountUSD: 20, label: '400 Points = $20 Off' },
] as const;
