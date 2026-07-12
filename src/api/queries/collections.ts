// PetezPopz — GraphQL Queries: Collections
import { storefrontFetch, Collection, Product } from '../shopify-storefront';
import { PRODUCT_CARD_FRAGMENT } from './products';
import { filterVisibleProducts } from '../../utils/productFilters';

// ── Collection fragment ────────────────────────────────────────────────────────

export const COLLECTION_FRAGMENT = `
  ${PRODUCT_CARD_FRAGMENT}
  fragment CollectionFields on Collection {
    id
    handle
    title
    description
    image { url altText width height }
    products(first: $first, after: $after, sortKey: $sortKey) {
      nodes { ...ProductCard }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// ── Promo banners: App-Exclusive-Promo collection ─────────────────────────────

export const GET_PROMO_BANNERS = `
  query GetPromoBanners {
    collection(handle: "new-arrivals") {
      id
      title
      products(first: 10, sortKey: MANUAL) {
        nodes {
          id
          handle
          title
          tags
          images(first: 1) { nodes { url altText width height } }
          priceRange {
            minVariantPrice { amount currencyCode }
          }
        }
      }
    }
  }
`;

export async function fetchPromoBanners() {
  return storefrontFetch<{ collection: Collection | null }>(GET_PROMO_BANNERS);
}

// ── New Releases / VIP drops ───────────────────────────────────────────────────

export const GET_VIP_RELEASES = `
  ${PRODUCT_CARD_FRAGMENT}
  query GetVIPReleases {
    products(first: 20, query: "tag:VIP_Only:True", sortKey: CREATED_AT, reverse: true) {
      nodes { ...ProductCard }
    }
  }
`;

export async function fetchVIPReleases() {
  const res = await storefrontFetch<{ products: { nodes: Product[] } }>(GET_VIP_RELEASES);
  res.data.products.nodes = filterVisibleProducts(res.data.products.nodes);
  return res;
}

// ── Collection by handle (paginated) ──────────────────────────────────────────

export const GET_COLLECTION = `
  ${PRODUCT_CARD_FRAGMENT}
  query GetCollection(
    $handle: String!
    $first: Int!
    $after: String
    $sortKey: ProductCollectionSortKeys
  ) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { url altText width height }
      products(first: $first, after: $after, sortKey: $sortKey) {
        nodes { ...ProductCard }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export async function fetchCollection(
  handle: string,
  first = 24,
  after?: string,
  sortKey = 'COLLECTION_DEFAULT',
) {
  return storefrontFetch<{ collection: Collection | null }>(GET_COLLECTION, {
    handle,
    first,
    after,
    sortKey,
  });
}

// ── All collections (Fandom Grid) ─────────────────────────────────────────────

export const GET_ALL_COLLECTIONS = `
  query GetAllCollections($first: Int!) {
    collections(first: $first, sortKey: TITLE) {
      nodes {
        id
        handle
        title
        image { url altText width height }
      }
    }
  }
`;

export async function fetchAllCollections(first = 50) {
  return storefrontFetch<{
    collections: { nodes: Array<Pick<Collection, 'id' | 'handle' | 'title' | 'image'>> };
  }>(GET_ALL_COLLECTIONS, { first });
}

// ── Category handle mappings ───────────────────────────────────────────────────

export const FUNKO_CATEGORIES = [
  { label: 'Anime', handle: 'anime', emoji: '⛩️' },
  { label: 'Disney', handle: 'disney', emoji: '🏰' },
  { label: 'Marvel', handle: 'marvel', emoji: '🦸' },
  { label: 'Star Wars', handle: 'star-wars', emoji: '⚔️' },
  { label: 'Movies', handle: 'movies', emoji: '🎬' },
  { label: 'Horror', handle: 'horror', emoji: '💀' },
  { label: 'Sports', handle: 'sports', emoji: '🎸' },
  { label: 'Chase Variants', handle: 'chase', emoji: '💎' },
] as const;

export const LOUNGEFLY_CATEGORIES = [
  { label: 'Loungefly & Bioworld', handle: 'loungefly', emoji: '👜' },
  { label: 'Backpacks', handle: 'backpacks', emoji: '🎒' },
  { label: 'Disney', handle: 'disney', emoji: '✨' },
  { label: 'Anime', handle: 'anime', emoji: '🎮' },
  { label: 'Marvel', handle: 'marvel', emoji: '⭐' },
  { label: 'Best Sellers', handle: 'best-sellers-1', emoji: '🔥' },
] as const;
