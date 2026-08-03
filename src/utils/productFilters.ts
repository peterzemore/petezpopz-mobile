// PetezPopz — Product Visibility Rules
//
// Rule: Show a product if it has at least one available-for-sale variant
//       OR if it is tagged "Coming Soon" or "Pre-Order" (regardless of stock).
//
// Tag matching is case-insensitive and handles common variants:
//   "Coming Soon", "coming soon", "Pre-Order", "pre order", "Preorder", etc.

import { Product } from '../api/shopify-storefront';

/** Lowercase tag strings that exempt an out-of-stock product from being hidden. */
const OOS_EXEMPT_TAGS = ['coming soon', 'pre-order', 'pre order', 'preorder'];

/**
 * Products kept out of every browse, search and recommendation surface.
 *
 * Memberships are real, purchasable products, so Shopify happily returns them
 * alongside the Funko Pops — someone searching "gold" would otherwise get a
 * $14.99 subscription in the grid. They're reachable only from the rewards /
 * membership screens, which link to them directly by handle.
 *
 * Checked as a whole-tag match, so a Pop tagged "Gold Label" is unaffected.
 */
const HIDDEN_FROM_CATALOG_TAGS = ['membership'];

/** True when a product should never surface in catalog listings at all. */
export function isHiddenFromCatalog(product: Product): boolean {
  const tags = product.tags?.map((t) => t.toLowerCase().trim()) ?? [];
  return HIDDEN_FROM_CATALOG_TAGS.some((hidden) => tags.includes(hidden));
}

/**
 * Returns true if the product should appear in any listing.
 *
 * A product is shown when:
 *  - It is not hidden from the catalog outright (memberships), AND
 *  - At least one variant is availableForSale, OR
 *  - It carries a "Coming Soon" / "Pre-Order" tag (future inventory signal).
 */
export function shouldShowProduct(product: Product): boolean {
  // Checked before the exemptions below: a hidden product stays hidden even if
  // it also carries a Pre-Order tag.
  if (isHiddenFromCatalog(product)) return false;

  const tags = product.tags?.map((t) => t.toLowerCase().trim()) ?? [];
  const isExempt = OOS_EXEMPT_TAGS.some((exempt) => tags.includes(exempt));
  if (isExempt) return true;

  // Not every query selects variants, and callers cast those partial results to
  // Product — so this is legitimately undefined at runtime even though the type
  // says otherwise. With no availability data the honest answer is "unknown",
  // and hiding would silently empty whichever surface fetched it, so fail open.
  const variants = product.variants?.nodes;
  if (!variants) return true;

  return variants.some((v) => v.availableForSale);
}

/**
 * Filters an array of products according to visibility rules.
 * Convenience wrapper around shouldShowProduct for use at call sites.
 */
export function filterVisibleProducts(products: Product[]): Product[] {
  return products.filter(shouldShowProduct);
}
