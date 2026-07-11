// PetezPopz — GraphQL Queries: Products
import { storefrontFetch, type Product } from '../shopify-storefront';

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

// ── Search by SKU (barcode scanner) ───────────────────────────────────────────

export const SEARCH_BY_SKU = `
  ${PRODUCT_CARD_FRAGMENT}
  query SearchBySKU($query: String!) {
    products(first: 1, query: $query) {
      nodes {
        ...ProductCard
      }
    }
  }
`;

export async function searchProductBySKU(sku: string) {
  return storefrontFetch<{ products: { nodes: Product[] } }>(SEARCH_BY_SKU, {
    query: `sku:${sku}`,
  });
}

// ── Predictive search (text search bar) ───────────────────────────────────────

export const PREDICTIVE_SEARCH = `
  ${PRODUCT_CARD_FRAGMENT}
  query PredictiveSearch($query: String!, $first: Int!) {
    products(first: $first, query: $query, sortKey: RELEVANCE) {
      nodes {
        ...ProductCard
      }
    }
  }
`;

export async function searchProducts(query: string, first = 20) {
  return storefrontFetch<{ products: { nodes: Product[] } }>(PREDICTIVE_SEARCH, {
    query,
    first,
  });
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
 * Parses the tags array for a franchise tag (e.g. "Franchise:Stitch")
 * and queries for products of a different type carrying that same franchise tag.
 */
export function parseFranchiseTag(tags: string[]): string | null {
  const franchiseTag = tags.find((t) => t.toLowerCase().startsWith('franchise:'));
  return franchiseTag ?? null;
}

export async function fetchCrossMerchProducts(franchiseTag: string, excludeProductId: string) {
  // Query by franchise tag across all product types
  const gqlQuery = `tag:${franchiseTag}`;
  const result = await storefrontFetch<{ products: { nodes: Product[] } }>(CROSS_MERCH_QUERY, {
    query: gqlQuery,
    excludeId: excludeProductId,
  });
  // Filter out the current product client-side
  result.data.products.nodes = result.data.products.nodes.filter(
    (p) => p.id !== excludeProductId,
  );
  return result;
}
