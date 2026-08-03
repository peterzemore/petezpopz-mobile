// PetezPopz — Add-to-cart upsell resolution
//
// Two offers, decided by what was just added:
//
//   Loungefly bag  → a Funko Pop from the same franchise ("complete the look")
//   Funko Pop      → a vinyl protector matched to that Pop's display size
//
// Money is never handled here. Discounts are configured as Shopify automatic
// discounts in admin so they apply themselves at checkout and can't desync from
// cart contents — this module only decides what to *show*.

import { storefrontFetch, type Product } from '../shopify-storefront';
import { PRODUCT_CARD_FRAGMENT } from './products';
import { filterVisibleProducts } from '../../utils/productFilters';
import {
  BRAND_TAG,
  hasTag,
  resolveFranchise,
  resolvePopSize,
  type PopSize,
} from '../taxonomy';

export type UpsellKind = 'themed-pop' | 'protector';

export interface UpsellOffer {
  kind: UpsellKind;
  /** The product that triggered the offer. */
  trigger: Product;
  /** What we're suggesting they add. */
  suggestion: Product;
  eyebrow: string;
  headline: string;
  blurb: string;
}

const UPSELL_QUERY = `
  ${PRODUCT_CARD_FRAGMENT}
  query UpsellCandidates($query: String!, $first: Int!) {
    products(first: $first, query: $query, sortKey: BEST_SELLING) {
      nodes { ...ProductCard }
    }
  }
`;

async function search(query: string, first = 12): Promise<Product[]> {
  const res = await storefrontFetch<{ products: { nodes: Product[] } }>(UPSELL_QUERY, {
    query,
    first,
  });
  return filterVisibleProducts(res.data.products?.nodes ?? []);
}

function inStock(p: Product): boolean {
  return p.variants?.nodes?.some((v) => v.availableForSale) ?? false;
}

/** Protector size tags, most specific first so a 10-inch Pop never gets a 6-inch box. */
const PROTECTOR_QUERY_BY_SIZE: Record<PopSize, string[]> = {
  '10-inch': [`tag:'${BRAND_TAG.protector}' AND 10-inch`, `tag:'${BRAND_TAG.protector}'`],
  '6-inch': [`tag:'${BRAND_TAG.protector}' AND 6-inch`, `tag:'${BRAND_TAG.protector}'`],
  standard: [`tag:'${BRAND_TAG.protector}'`],
};

async function resolveProtector(trigger: Product): Promise<UpsellOffer | null> {
  const size = resolvePopSize(trigger.tags, trigger.title);

  for (const query of PROTECTOR_QUERY_BY_SIZE[size]) {
    const candidates = (await search(query)).filter(
      (p) => p.id !== trigger.id && inStock(p),
    );
    if (!candidates.length) continue;

    // Cheapest protector converts best — this is an impulse add, not a considered purchase.
    const suggestion = candidates.sort(
      (a, b) =>
        parseFloat(a.priceRange.minVariantPrice.amount) -
        parseFloat(b.priceRange.minVariantPrice.amount),
    )[0];

    return {
      kind: 'protector',
      trigger,
      suggestion,
      eyebrow: 'PROTECT YOUR POP',
      headline: 'Keep it mint',
      blurb: 'Box damage is what kills resale value. Add a protector and it stays collection-grade.',
    };
  }
  return null;
}

async function resolveThemedPop(trigger: Product): Promise<UpsellOffer | null> {
  const franchise = resolveFranchise(trigger.tags);
  if (!franchise) return null;

  const candidates = (
    await search(`tag:'${franchise}' AND tag:'${BRAND_TAG.funko}'`)
  ).filter(
    (p) =>
      p.id !== trigger.id &&
      inStock(p) &&
      // Never suggest another bag as a "matching Pop".
      !hasTag(p.tags, BRAND_TAG.loungefly),
  );
  if (!candidates.length) return null;

  return {
    kind: 'themed-pop',
    trigger,
    suggestion: candidates[0],
    eyebrow: 'COMPLETE THE LOOK',
    headline: `Matching ${franchise} Pop`,
    blurb: `Pairs with the bag you just added. Bundle pricing applies automatically at checkout.`,
  };
}

/**
 * Decides which offer (if any) to surface for a product that was just added.
 *
 * Returns null rather than throwing on any failure — an upsell is never worth
 * interrupting a successful add-to-cart over.
 */
export async function resolveUpsell(trigger: Product): Promise<UpsellOffer | null> {
  try {
    if (hasTag(trigger.tags, BRAND_TAG.loungefly)) return await resolveThemedPop(trigger);
    if (hasTag(trigger.tags, BRAND_TAG.funko)) {
      // Don't offer a protector for a protector.
      if (hasTag(trigger.tags, BRAND_TAG.protector)) return null;
      return await resolveProtector(trigger);
    }
    return null;
  } catch (err) {
    console.warn('Upsell resolution failed:', err);
    return null;
  }
}
