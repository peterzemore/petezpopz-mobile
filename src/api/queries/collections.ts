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

// Fetches both candidate collections in one round trip. The hero shows
// App Exclusive Drops whenever that collection has in-stock products, and
// silently falls back to New Arrivals when it's empty — so an exclusive drop
// selling out can never leave the top of the home screen blank.
export const GET_PROMO_BANNERS = `
  fragment PromoCollectionFields on Collection {
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
        # Required: these run through filterVisibleProducts, which reads
        # variant availability. Without this the nodes are cast to Product
        # but have no variants, and the filter throws at runtime.
        variants(first: 1) {
          nodes { id availableForSale }
        }
      }
    }
  }
  query GetPromoBanners {
    exclusive: collection(handle: "app-exclusive-drops") {
      ...PromoCollectionFields
    }
    newArrivals: collection(handle: "new-arrivals") {
      ...PromoCollectionFields
    }
  }
`;

export interface PromoFeed {
  /** Collection title straight from Shopify, so renaming there renames the app heading. */
  title: string;
  products: Product[];
  /** True when the App Exclusive collection supplied these products. */
  isExclusive: boolean;
}

export async function fetchPromoBanners(): Promise<PromoFeed> {
  const res = await storefrontFetch<{
    exclusive: Collection | null;
    newArrivals: Collection | null;
  }>(GET_PROMO_BANNERS);

  const exclusive = filterVisibleProducts(
    (res.data.exclusive?.products.nodes ?? []) as Product[],
  );
  if (exclusive.length) {
    return {
      title: res.data.exclusive?.title ?? 'App Exclusive Drops',
      products: exclusive,
      isExclusive: true,
    };
  }

  return {
    title: res.data.newArrivals?.title ?? 'New Arrivals',
    products: filterVisibleProducts(
      (res.data.newArrivals?.products.nodes ?? []) as Product[],
    ),
    isExclusive: false,
  };
}

// ── New Releases / VIP drops ───────────────────────────────────────────────────

export const GET_VIP_RELEASES = `
  ${PRODUCT_CARD_FRAGMENT}
  query GetVIPReleases {
    # Keep in sync with VIP_ONLY_TAG in ../taxonomy.
    products(first: 20, query: "tag:'VIP_Only'", sortKey: CREATED_AT, reverse: true) {
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
    $reverse: Boolean
  ) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { url altText width height }
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
        nodes { ...ProductCard }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

// Real enum values (confirmed via schema introspection against the live store —
// note it's "CREATED", not "CREATED_AT" as used by the top-level products query).
export type CollectionSortKey = 'COLLECTION_DEFAULT' | 'BEST_SELLING' | 'CREATED' | 'TITLE' | 'PRICE';

export interface SortChoice<K extends string> {
  label: string;
  sortKey: K;
  reverse: boolean;
}

export const COLLECTION_SORT_OPTIONS: SortChoice<CollectionSortKey>[] = [
  { label: 'Featured', sortKey: 'COLLECTION_DEFAULT', reverse: false },
  { label: 'Best Selling', sortKey: 'BEST_SELLING', reverse: false },
  { label: 'Newest', sortKey: 'CREATED', reverse: true },
  { label: 'A → Z', sortKey: 'TITLE', reverse: false },
  { label: 'Z → A', sortKey: 'TITLE', reverse: true },
  { label: 'Price: Low to High', sortKey: 'PRICE', reverse: false },
  { label: 'Price: High to Low', sortKey: 'PRICE', reverse: true },
];

export async function fetchCollection(
  handle: string,
  first = 24,
  after?: string,
  sortKey: CollectionSortKey = 'COLLECTION_DEFAULT',
  reverse = false,
) {
  return storefrontFetch<{ collection: Collection | null }>(GET_COLLECTION, {
    handle,
    first,
    after,
    sortKey,
    reverse,
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

// Every category card browses by product tag rather than by Shopify collection.
// Collections on this store are curated subsets and run well behind the tag data
// (e.g. the Disney collection holds 242 products against 808 Disney-tagged), so
// the tag is the more complete source of truth and the one the storefront
// taxonomy is maintained against.
//
// Contract: `tag` is the exact Shopify product tag the card queries. A card
// shows nothing until that tag exists on the products it should surface.

// Both lists are ordered alphabetically by label.

// Tags below are the exact strings that exist in the store today, verified
// live against the Storefront API. Note: "Music & Pop Culture Icons" is a
// single tag, so Music and Icons remain one card for now.
export const FUNKO_CATEGORIES = [
  { label: 'Animation', handle: 'animation', emoji: '📺', tag: 'Animation' },
  { label: 'Anime', handle: 'anime', emoji: '⛩️', tag: 'Anime' },
  { label: 'Chase Variants', handle: 'chase', emoji: '💎', tag: 'Chase' },
  { label: 'DC Comics', handle: 'dc-comics', emoji: '🦇', tag: 'DC Comics' },
  { label: 'Disney', handle: 'disney', emoji: '🏰', tag: 'Disney' },
  { label: 'Horror', handle: 'horror', emoji: '💀', tag: 'Horror' },
  { label: 'Marvel Universe', handle: 'marvel', emoji: '🦸', tag: 'Marvel' },
  { label: 'Movies & TV', handle: 'movies', emoji: '🎬', tag: 'Movies & TV' },
  { label: 'Music & Icons', handle: 'music-pop-culture-icons', emoji: '🎸', tag: 'Music & Pop Culture Icons' },
  { label: 'Sports', handle: 'sports', emoji: '🏈', tag: 'Sports' },
  { label: 'Video Games', handle: 'video-games', emoji: '🎮', tag: 'Video Games' },
] as const;

// "Matching Sets" is deliberately absent: no product carries that tag and the
// matching-sets collection is empty, so the card could only ever render an
// empty screen. Add it back once the store tags those products.
export const LOUNGEFLY_CATEGORIES = [
  { label: 'Backpacks', handle: 'backpacks', emoji: '🎒', tag: 'Backpacks' },
  { label: 'Crossbody Bags', handle: 'crossbody-bags', emoji: '👝', tag: 'Crossbody' },
  { label: 'Wallets', handle: 'wallet', emoji: '👛', tag: 'Wallet' },
] as const;
