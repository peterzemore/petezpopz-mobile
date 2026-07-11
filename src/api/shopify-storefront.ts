// PetezPopz — Unified Shopify GraphQL Client (API 2026-04)
//
// Architecture — Modern Headless (2026-04):
// ─────────────────────────────────────────────────────────────────────────────
// ONE endpoint handles both public catalog access AND authenticated customer
// requests. Token-based storefront access has been deprecated; identification
// is now header-driven using the public Client ID and store domain.
//
//  Public catalog (products, collections, cart mutations):
//    POST https://shopify.com/api/2026-04/graphql
//    Headers:
//      Shopify-Store-Domain: gemcitytoyco.myshopify.com
//      Shopify-Client-Id:    <EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID>
//
//  Authenticated customer (profile, orders, metafields, loyalty):
//    POST https://shopify.com/api/2026-04/graphql
//    Headers:  (same as above, plus)
//      Authorization: Bearer <pkce_access_token>
//
// There is NO static storefront token. NO unauthenticated_* scopes.
// Access is governed entirely by shopify.app.toml + shopify.extension.toml.
// ─────────────────────────────────────────────────────────────────────────────

const STORE_DOMAIN =
  process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN ?? 'gemcitytoyco.myshopify.com';
const CLIENT_ID =
  process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID ?? '';
const GRAPHQL_ENDPOINT =
  process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_URL ??
  'https://shopify.com/api/2026-04/graphql';

// ── Base headers (public, no auth) ────────────────────────────────────────────

function baseHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Shopify-Store-Domain': STORE_DOMAIN,
    'Shopify-Client-Id': CLIENT_ID,
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
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

async function shopifyFetch<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  accessToken?: string,
  operationName?: string,
): Promise<{ data: T }> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: baseHeaders(accessToken),
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

// ── Public client — no auth token required ────────────────────────────────────
// Use for: products, collections, cart mutations (pre-checkout)

export async function storefrontFetch<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string,
): Promise<{ data: T }> {
  return shopifyFetch<T>(query, variables, undefined, operationName);
}

// ── Authenticated client — requires PKCE access token ─────────────────────────
// Use for: customer profile, orders, loyalty metafields, cart buyer identity

export async function customerFetch<T = unknown>(
  query: string,
  accessToken: string,
  variables?: Record<string, unknown>,
  operationName?: string,
): Promise<{ data: T }> {
  return shopifyFetch<T>(query, variables, accessToken, operationName);
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
