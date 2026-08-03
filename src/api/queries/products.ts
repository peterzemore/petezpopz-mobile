// PetezPopz — GraphQL Queries: Products
import { storefrontFetch, type Product } from '../shopify-storefront';
import { filterVisibleProducts } from '../../utils/productFilters';
import { resolveFranchise } from '../taxonomy';

// ── Fragments ──────────────────────────────────────────────────────────────────

export const PRODUCT_CARD_FRAGMENT = `
  fragment ProductCard on Product {
    id
    handle
    title
    tags
    vendor
    productType
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    images(first: 1) {
      nodes { url altText width height }
    }
    variants(first: 3) {
      nodes {
        id
        title
        availableForSale
        quantityAvailable
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        selectedOptions { name value }
      }
    }
  }
`;

export const PRODUCT_FULL_FRAGMENT = `
  fragment ProductFull on Product {
    id
    handle
    title
    description
    descriptionHtml
    tags
    vendor
    productType
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    images(first: 20) {
      nodes { url altText width height }
    }
    variants(first: 100) {
      nodes {
        id
        title
        availableForSale
        quantityAvailable
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        selectedOptions { name value }
      }
    }
  }
`;

// ── Search by handle (PDP) ─────────────────────────────────────────────────────

export const GET_PRODUCT_BY_HANDLE = `
  ${PRODUCT_FULL_FRAGMENT}
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...ProductFull
    }
  }
`;

export async function fetchProductByHandle(handle: string) {
  return storefrontFetch<{ product: Product | null }>(GET_PRODUCT_BY_HANDLE, { handle });
}

// Backend proxy URL — set EXPO_PUBLIC_BARCODE_API_URL in .env once the
// barcode-lookup endpoint (see barcode-proxy/) is deployed to Vercel.
// The Storefront API has no dedicated barcode filter (confirmed against the
// live store — an unrecognized filter key like "barcode:" is silently ignored
// rather than erroring). Only the Admin API (used by barcode-proxy) supports
// filtering by barcode directly and reliably, regardless of catalog setup.
const BARCODE_API_URL = process.env.EXPO_PUBLIC_BARCODE_API_URL ?? '';

// ── Search by barcode (barcode scanner) ────────────────────────────────────────
// Fallback text search used only when BARCODE_API_URL isn't configured. This
// doesn't search by barcode directly — it's a generic text search over the
// scanned digits. In practice this DOES find the right product when a
// product's SKU is set to match its barcode/UPC (a common merchant
// convention, and confirmed working against two real items in this store's
// catalog) — Shopify's default search indexes SKU. It's not guaranteed for
// every product though: any item whose SKU doesn't match its barcode won't be
// found this way, only via barcode-proxy.
export const SEARCH_BY_BARCODE = `
  ${PRODUCT_CARD_FRAGMENT}
  query SearchByBarcode($query: String!) {
    products(first: 1, query: $query) {
      nodes {
        ...ProductCard
      }
    }
  }
`;

export async function searchProductBySKU(barcode: string) {
  const normalized = barcode.length === 13 && barcode.startsWith('0')
    ? barcode.slice(1)
    : barcode;

  if (BARCODE_API_URL) {
    const res = await fetch(`${BARCODE_API_URL}?upc=${encodeURIComponent(normalized)}`);
    const json = await res.json() as { handle: string | null };
    if (json.handle) {
      const product = await storefrontFetch<{ product: Product | null }>(
        GET_PRODUCT_BY_HANDLE,
        { handle: json.handle },
      );
      const node = product.data.product;
      return { data: { products: { nodes: node ? [node as unknown as Product] : [] } } };
    }
    return { data: { products: { nodes: [] } } };
  }

  if (__DEV__) {
    console.log(
      '[searchProductBySKU] EXPO_PUBLIC_BARCODE_API_URL is not set — using text-search ' +
      'fallback (works if SKU matches barcode; deploy barcode-proxy for guaranteed matching ' +
      'across the whole catalog — see barcode-proxy/README.md).',
    );
  }

  const res = await storefrontFetch<{ products: { nodes: Product[] } }>(
    SEARCH_BY_BARCODE,
    { query: normalized },
  );

  res.data.products.nodes = filterVisibleProducts(res.data.products.nodes);
  return res;
}

// Real enum values (confirmed via schema introspection against the live store).
export type ProductSortKey = 'RELEVANCE' | 'BEST_SELLING' | 'CREATED_AT' | 'PRICE' | 'TITLE';

export interface SortChoice<K extends string> {
  label: string;
  sortKey: K;
  reverse: boolean;
}

export const PRODUCT_SORT_OPTIONS: SortChoice<ProductSortKey>[] = [
  { label: 'Featured', sortKey: 'RELEVANCE', reverse: false },
  { label: 'Best Selling', sortKey: 'BEST_SELLING', reverse: false },
  { label: 'Newest', sortKey: 'CREATED_AT', reverse: true },
  { label: 'A → Z', sortKey: 'TITLE', reverse: false },
  { label: 'Z → A', sortKey: 'TITLE', reverse: true },
  { label: 'Price: Low to High', sortKey: 'PRICE', reverse: false },
  { label: 'Price: High to Low', sortKey: 'PRICE', reverse: true },
];

// ── Predictive search (text search bar) ───────────────────────────────────────

export const PREDICTIVE_SEARCH = `
  ${PRODUCT_CARD_FRAGMENT}
  query PredictiveSearch(
    $query: String!
    $first: Int!
    $after: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
  ) {
    products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
      nodes { ...ProductCard }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export async function searchProducts(
  query: string,
  first = 20,
  after?: string,
  sortKey: ProductSortKey = 'RELEVANCE',
  reverse = false,
) {
  const res = await storefrontFetch<{
    products: { nodes: Product[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
  }>(PREDICTIVE_SEARCH, { query, first, after, sortKey, reverse });
  res.data.products.nodes = filterVisibleProducts(res.data.products.nodes);
  return res;
}

// ── Cross-merchandising: fetch by franchise tag ────────────────────────────────

export const CROSS_MERCH_QUERY = `
  ${PRODUCT_CARD_FRAGMENT}
  query CrossMerch($query: String!, $excludeId: String!) {
    products(first: 12, query: $query, sortKey: BEST_SELLING) {
      nodes {
        ...ProductCard
      }
    }
  }
`;

/**
 * Resolves the franchise a product belongs to, for cross-merchandising.
 *
 * This previously looked for a `franchise:`-prefixed tag, but no product in the
 * store has ever used that convention — franchises are stored as bare tags
 * ("Lilo & Stitch", "Jujutsu Kaisen"). It therefore returned null for every
 * product, and CrossMerchShelf silently rendered nothing. Matching against the
 * real storefront taxonomy is what makes that shelf work.
 */
export function parseFranchiseTag(tags: string[]): string | null {
  return resolveFranchise(tags);
}

// ── Browse by tag (e.g. brand tags like "Loungefly") ───────────────────────────

export const GET_PRODUCTS_BY_TAG = `
  ${PRODUCT_CARD_FRAGMENT}
  query GetProductsByTag(
    $query: String!
    $first: Int!
    $after: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
  ) {
    products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
      nodes { ...ProductCard }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

/**
 * Fetches products carrying ALL of the given tags (AND semantics) — e.g.
 * ['Loungefly', 'Disney'] only returns products tagged with both, so browsing
 * a franchise within the Loungefly tab doesn't pull in Funko or other brands
 * that happen to share the same franchise tag.
 */
export async function fetchProductsByTag(
  tags: string | string[],
  first = 24,
  after?: string,
  sortKey: ProductSortKey = 'BEST_SELLING',
  reverse = false,
  searchText = '',
) {
  const tagList = Array.isArray(tags) ? tags : [tags];
  const clauses = tagList.map((t) => `tag:'${t}'`);
  // Verified live against the store: combining a tag filter with bare free
  // text via AND (e.g. tag:'Loungefly' AND Aquaman) correctly narrows results
  // server-side rather than just being ignored.
  if (searchText.trim()) clauses.push(searchText.trim());
  const query = clauses.join(' AND ');
  const res = await storefrontFetch<{
    products: { nodes: Product[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
  }>(GET_PRODUCTS_BY_TAG, { query, first, after, sortKey, reverse });
  res.data.products.nodes = filterVisibleProducts(res.data.products.nodes);
  return res;
}

export async function fetchCrossMerchProducts(franchiseTag: string, excludeProductId: string) {
  // Query by franchise tag across all product types. franchiseTag already
  // includes its own "Franchise:" prefix (e.g. "Franchise:Stitch"), so it must
  // be quoted as a single tag value — unquoted, the embedded colon makes
  // "tag:Franchise:Stitch" a malformed search query.
  const gqlQuery = `tag:'${franchiseTag}'`;
  const result = await storefrontFetch<{ products: { nodes: Product[] } }>(CROSS_MERCH_QUERY, {
    query: gqlQuery,
    excludeId: excludeProductId,
  });
  // Filter out the current product client-side
  const nodes = (result.data.products?.nodes ?? []).filter(
    (p) => p.id !== excludeProductId,
  );
  result.data.products = { nodes };
  return result;
}
