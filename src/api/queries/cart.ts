// PetezPopz — GraphQL Queries: Cart (Storefront API)
import { storefrontFetch, Cart } from '../shopify-storefront';

// ── Fragments ─────────────────────────────────────────────────────────────────

export const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    note
    attributes { key value }
    discountCodes { code applicable }
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
      totalTaxAmount { amount currencyCode }
    }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost { totalAmount { amount currencyCode } }
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount currencyCode }
            image { url altText width height }
            product {
              id
              handle
              title
            }
          }
        }
      }
    }
  }
`;

// ── Create cart ───────────────────────────────────────────────────────────────

export const CART_CREATE = `
  ${CART_FRAGMENT}
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

/**
 * Cart line, optionally on a subscription selling plan.
 *
 * sellingPlanId matters for the memberships: they're subscription-only, and a
 * line without a plan is rejected at checkout with "Variant can only be
 * purchased with a selling plan". Cart permalinks (/cart/<variant>:1) can't
 * carry one at all — they return 410 for these products — so the plan has to
 * be attached here, when the cart is built.
 */
export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
  sellingPlanId?: string;
}

export async function createCart(
  lines: CartLineInput[] = [],
  customerAccessToken: string | null = null,
) {
  const input: Record<string, unknown> = { lines };
  if (customerAccessToken) input.buyerIdentity = { customerAccessToken };
  return storefrontFetch<{
    cartCreate: { cart: Cart; userErrors: Array<{ field: string; message: string }> };
  }>(CART_CREATE, { input });
}

// ── Buyer identity ────────────────────────────────────────────────────────────
//
// Attaching the signed-in customer's access token to the cart makes checkout
// open as that customer (prefilled contact, saved addresses) instead of
// whatever the checkout web view last remembered. Passing null detaches it.
export const CART_BUYER_IDENTITY_UPDATE = `
  ${CART_FRAGMENT}
  mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

export async function updateCartBuyerIdentity(cartId: string, customerAccessToken: string | null) {
  return storefrontFetch<{
    cartBuyerIdentityUpdate: { cart: Cart; userErrors: Array<{ field: string; message: string }> };
  }>(CART_BUYER_IDENTITY_UPDATE, { cartId, buyerIdentity: { customerAccessToken } });
}

// ── Add lines to cart ─────────────────────────────────────────────────────────

export const CART_LINES_ADD = `
  ${CART_FRAGMENT}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

export async function addCartLines(
  cartId: string,
  lines: Array<{ merchandiseId: string; quantity: number }>,
) {
  return storefrontFetch<{
    cartLinesAdd: { cart: Cart; userErrors: Array<{ field: string; message: string }> };
  }>(CART_LINES_ADD, { cartId, lines });
}

// ── Update line quantities ────────────────────────────────────────────────────

export const CART_LINES_UPDATE = `
  ${CART_FRAGMENT}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

export async function updateCartLines(
  cartId: string,
  lines: Array<{ id: string; quantity: number }>,
) {
  return storefrontFetch<{
    cartLinesUpdate: { cart: Cart; userErrors: Array<{ field: string; message: string }> };
  }>(CART_LINES_UPDATE, { cartId, lines });
}

// ── Remove lines ──────────────────────────────────────────────────────────────

export const CART_LINES_REMOVE = `
  ${CART_FRAGMENT}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

export async function removeCartLines(cartId: string, lineIds: string[]) {
  return storefrontFetch<{
    cartLinesRemove: { cart: Cart; userErrors: Array<{ field: string; message: string }> };
  }>(CART_LINES_REMOVE, { cartId, lineIds });
}

// ── Apply discount code ───────────────────────────────────────────────────────

export const CART_DISCOUNT_CODES_UPDATE = `
  ${CART_FRAGMENT}
  mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

export async function applyDiscountCode(cartId: string, code: string) {
  return storefrontFetch<{
    cartDiscountCodesUpdate: { cart: Cart; userErrors: Array<{ field: string; message: string }> };
  }>(CART_DISCOUNT_CODES_UPDATE, { cartId, discountCodes: [code] });
}

export async function removeDiscountCode(cartId: string) {
  return storefrontFetch<{
    cartDiscountCodesUpdate: { cart: Cart; userErrors: Array<{ field: string; message: string }> };
  }>(CART_DISCOUNT_CODES_UPDATE, { cartId, discountCodes: [] });
}

// ── Update cart note + attributes (BOPIS) ─────────────────────────────────────

export const CART_NOTE_UPDATE = `
  ${CART_FRAGMENT}
  mutation CartNoteUpdate($cartId: ID!, $note: String!) {
    cartNoteUpdate(cartId: $cartId, note: $note) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

export const CART_ATTRIBUTES_UPDATE = `
  ${CART_FRAGMENT}
  mutation CartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) {
    cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
      cart { ...CartFields }
      userErrors { field message }
    }
  }
`;

/**
 * Sets the BOPIS pickup flag as a cart attribute.
 * Shopify Order notes will show this to the merchant.
 */
export async function setBOPISPickup(cartId: string, isPickup: boolean, locationName?: string) {
  return storefrontFetch<{
    cartAttributesUpdate: { cart: Cart; userErrors: Array<{ field: string; message: string }> };
  }>(CART_ATTRIBUTES_UPDATE, {
    cartId,
    attributes: [
      { key: 'fulfillment_method', value: isPickup ? 'in_store_pickup' : 'shipping' },
      { key: 'pickup_location', value: locationName ?? 'PetezPopz Store' },
    ],
  });
}

// ── Fetch cart by ID ──────────────────────────────────────────────────────────

export const GET_CART = `
  ${CART_FRAGMENT}
  query GetCart($cartId: ID!) {
    cart(id: $cartId) {
      ...CartFields
    }
  }
`;

export async function fetchCart(cartId: string) {
  return storefrontFetch<{ cart: Cart | null }>(GET_CART, { cartId });
}
