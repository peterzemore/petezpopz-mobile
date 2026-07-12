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
 * Returns true if the product should appear in any listing.
 *
 * A product is shown when:
 *  - At least one variant is availableForSale, OR
 *  - It carries a "Coming Soon" / "Pre-Order" tag (future inventory signal).
 */
export function shouldShowProduct(product: Product): boolean {
  const tags = product.tags.map((t) => t.toLowerCase().trim());
  const isExempt = OOS_EXEMPT_TAGS.some((exempt) => tags.includes(exempt));
  if (isExempt) return true;

  const isAvailable = product.variants.nodes.some((v) => v.availableForSale);
  return isAvailable;
}

/**
 * Filters an array of products according to visibility rules.
 * Convenience wrapper around shouldShowProduct for use at call sites.
 */
export function filterVisibleProducts(products: Product[]): Product[] {
  return products.filter(shouldShowProduct);
}
