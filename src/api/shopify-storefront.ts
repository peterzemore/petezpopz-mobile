// PetezPopz — Unified Shopify GraphQL Client (API 2026-04)
//
// Architecture:
// ─────────────────────────────────────────────────────────────────────────────
// Public catalog calls (products, collections, cart) use the classic per-store
// Storefront API endpoint with no access token — the store has public storefront
// access enabled.
//
//  Public catalog:
//    POST https://{store}.myshopify.com/api/2026-04/graphql.json
//    Headers: Content-Type, Accept  (no token required)
//
//  Authenticated customer (profile, orders, loyalty metafields):
//    POST https://shopify.com/api/2026-04/graphql   (Customer Account API)
//    Headers: (above) + Authorization: Bearer <pkce_access_token>
//             + Shopify-Store-Domain, Shopify-Client-Id
// ─────────────────────────────────────────────────────────────────────────────

// The store's permanent domain. "gemcitytoyco.myshopify.com" is a legacy
// alias from before the store was renamed — it still resolves to the same
// shop, but the current permanent domain is the one to rely on.
const STORE_DOMAIN =
  process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN ?? 'sugarcreektoys.myshopify.com';
const CLIENT_ID =
  process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID ?? '';
const STOREFRONT_TOKEN =
  process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? '';
const API_VERSION =
  process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_API_VERSION ?? '2026-04';

// Public storefront (products, collections, cart)
const STOREFRONT_ENDPOINT = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;

// Customer Account API (authenticated profile/orders)
const CUSTOMER_API_ENDPOINT =
  process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_URL ??
  `https://shopify.com/api/${API_VERSION}/graphql`;

// ── Base headers ──────────────────────────────────────────────────────────────
function storefrontHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
  };
}
function customerHeaders(accessToken: string): Record<string, string> {
  // The Customer Account API requires the token itself (with its shcat_
  // prefix) as the ENTIRE Authorization header value — no "Bearer " prefix.
  // Confirmed against Shopify's own docs/dev community (2026-07-17): sending
  // "Bearer shcat_..." makes the raw header value start with "Bearer", which
  // is why the API's error message ("missing prefix shcat_") kept firing even
  // though the token itself genuinely had the prefix — the check is on the
  // full header value, not just the token substring.
  const formattedToken = accessToken.startsWith('shcat_')
    ? accessToken
    : `shcat_${accessToken}`;

  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Shopify-Store-Domain': STORE_DOMAIN,
    'Shopify-Client-Id': CLIENT_ID,
    Authorization: formattedToken,
  };
}
// ── Error types ───────────────────────────────────────────────────────────────

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: Record<string, unknown>;
}

export class ShopifyGraphQLError extends Error {
  constructor(
    public readonly errors: GraphQLError[],
    public readonly operationName?: string,
  ) {
    super(
      `[Shopify GraphQL${operationName ? ` / ${operationName}` : ''}] ` +
      errors.map((e) => e.message).join(' | '),
    );
    this.name = 'ShopifyGraphQLError';
  }
}

export class ShopifyHTTPError extends Error {
  constructor(public readonly status: number, body: string) {
    super(`[Shopify HTTP ${status}] ${body}`);
    this.name = 'ShopifyHTTPError';
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function graphqlFetch<T = unknown>(
  endpoint: string,
  headers: Record<string, string>,
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string,
): Promise<{ data: T }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables, operationName }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ShopifyHTTPError(response.status, body);
  }

  const json = (await response.json()) as { data?: T; errors?: GraphQLError[] };

  if (json.errors?.length) {
    throw new ShopifyGraphQLError(json.errors, operationName);
  }

  return { data: json.data as T };
}

// ── Public storefront client — products, collections, cart ────────────────────
// Uses the classic per-store endpoint; no access token required.

export async function storefrontFetch<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string,
): Promise<{ data: T }> {
  return graphqlFetch<T>(STOREFRONT_ENDPOINT, storefrontHeaders(), query, variables, operationName);
}

// ── Authenticated Customer Account API client ─────────────────────────────────
// Use for: customer profile, orders, loyalty metafields

export async function customerFetch<T = unknown>(
  query: string,
  accessToken: string,
  variables?: Record<string, unknown>,
  operationName?: string,
): Promise<{ data: T }> {
  return graphqlFetch<T>(CUSTOMER_API_ENDPOINT, customerHeaders(accessToken), query, variables, operationName);
}

// ── Shared domain types ────────────────────────────────────────────────────────

export interface MoneyV2 {
  amount: string;
  currencyCode: string;
}

export interface Image {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: MoneyV2;
  compareAtPrice: MoneyV2 | null;
  selectedOptions: Array<{ name: string; value: string }>;
}

export interface AppMetafield {
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  tags: string[];
  vendor: string;
  productType: string;
  priceRange: {
    minVariantPrice: MoneyV2;
    maxVariantPrice: MoneyV2;
  };
  images: { nodes: Image[] };
  variants: { nodes: ProductVariant[] };
  metafields?: Array<AppMetafield | null>;
}

export interface Collection {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: Image | null;
  products: {
    nodes: Product[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: Pick<Product, 'id' | 'handle' | 'title'>;
    image: Image | null;
    price: MoneyV2;
  };
  cost: {
    totalAmount: MoneyV2;
  };
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: MoneyV2;
    totalAmount: MoneyV2;
    totalTaxAmount: MoneyV2 | null;
  };
  lines: { nodes: CartLine[] };
  discountCodes: Array<{ code: string; applicable: boolean }>;
  note: string | null;
  attributes: Array<{ key: string; value: string }>;
}
