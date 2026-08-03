# Direction

Working notes on how the storefront taxonomy, the Fandom Grid, and the
add-to-cart upsells fit together. Written after the July 2026 tagging pass.

---

## 1. The core idea: tags are the source of truth, not collections

Every category card in the app browses by **product tag**, not by Shopify
collection handle.

This was a deliberate switch. The collections on this store are hand-curated
subsets and run well behind the tag data:

| Category | Collection | Tag |
|---|---:|---:|
| Disney | 242 | **808** |
| Marvel | 228 | **781** |
| DC | 19 | **152** |
| Anime | 323 | **1000** |
| Horror | 107 | **294** |
| Sports | 103 | **184** |
| Backpacks | 82 | **407** |
| Wallets | 11 | **82** |
| Music | **0** (empty) | 188 |
| Animation | *no collection exists* | 836 |

Routing by collection would have hidden most of the catalog and left two cards
permanently blank.

**The contract:** each card declares a `tag` in `src/api/queries/collections.ts`.
A card shows exactly the products carrying that tag, and shows nothing until the
tag exists. Adding a card is a two-line change; no routing code involved.

### Gotcha: Shopify `tag:` matching is word-level, not exact

`tag:'Backpacks'` also matches the tag `Other Backpacks and Purses`, because the
word "Backpacks" appears in it. This is why the Backpacks card reports 385 while
the exact `Backpack` tag has 407 — they are different sets.

Worst case to be aware of: a card tagged `Pop` would return **6,763** products,
since it matches `Funko Pop`, `Pop Icons`, and so on. Keep card tags distinctive.

---

## 2. Card → tag mapping

Both lists are ordered alphabetically by label. Note `Animation` sorts *before*
`Anime` — they share `Anim`, then `a` < `e`. Correct, just counterintuitive.

### Funko Pops

| Card | Tag | Status |
|---|---|---|
| Animation | `Animation` | live |
| Anime | `Anime` | live |
| Chase Variants | `Chase` | live |
| DC | `DC` | live |
| Disney | `Disney` | live |
| Horror | `Horror` | live |
| Icons | `Icons` | live |
| Marvel | `Marvel` | live |
| Movies & TV | `Movies & TV` | **needs creating** |
| Music | `Music` | live |
| Sports | `Sports` | live |
| Video Games | `Video Games` | **needs creating** |

`Marvel & DC` and `Music & Pop Culture Icons` are single items in the Shopify
nav but are **split into separate cards** here. The tag query only supports AND
(intersection), not OR, so one card cannot pull `Marvel` OR `DC`. Splitting was
chosen over extending the query layer.

`Chase Variants` is app-only — it has no equivalent in the website nav. A `chase`
collection does exist (30 products) but the `Chase` tag has 205, so the card uses
the tag.

### Loungefly

| Card | Tag | Status |
|---|---|---|
| Backpacks | `Backpacks` | needs splitting out of legacy tag |
| Crossbody Bags | `Crossbody Bags` | **needs creating** |
| Matching Sets | `Matching Sets` | **needs creating** |
| Wallets | `Wallets` | needs consolidating |

Loungefly children are **product types**, not franchises. Earlier the app mixed
in Disney / Anime / Marvel / Best Sellers cards here; those were removed because
they cut across the section rather than dividing it.

Crossbody Bags was added on the data: ~103 crossbody products had no card at all
and were reachable only via Browse All. It also makes the grid a clean 2×2.

Deliberately *not* given cards, too small to justify one:
- Card Holders (6) → fold into **Wallets**
- Purses / Handbags / Totes (13) → fold into **Crossbody Bags**

---

## 3. Add-to-cart upsells

Two offers, chosen by what was just added:

- **Loungefly bag → matching-franchise Funko Pop** ("complete the look")
- **Funko Pop → size-matched vinyl protector** ("keep it mint")

### Architecture

```
addItem(variantId, qty, { product })      src/store/cartStore.ts
  └─ on success → resolveUpsell(product)  src/api/queries/upsell.ts
       └─ sets pendingUpsell
            └─ <UpsellModal /> renders     mounted in app/_layout.tsx
```

Every add-to-cart surface (PDP button, CrossMerchShelf quick add, ProductCard
quick add) funnels through `cartStore.addItem`, so intercepting that one function
covers all of them.

**Why the modal is mounted globally:** checkout is `@shopify/checkout-sheet-kit`,
a native Shopify sheet. Nothing can be injected once the user is inside it. The
offer therefore has to fire at add-to-cart time, inside the app.

**Why `product` is passed rather than looked up:** every caller already holds the
`Product`, so passing it avoids a variant→product round trip. Omit it and no
offer is made — this is intentional, not a bug.

### Design decisions worth preserving

- **Offer resolution runs after the add succeeds, outside its try/catch.** A
  failed suggestion must never surface to the user as a cart error.
- **`skipUpsell: true`** is passed when adding the suggested item, so accepting
  an offer can't trigger another offer.
- **`offeredProductIds`** tracks what's been shown this session, so declining
  isn't re-asked on every add.
- **Cheapest protector wins.** This is an impulse add, not a considered purchase.
- **Catch-all franchises are excluded from matching.** Two products both tagged
  `More Great Horror` share a bucket, not a theme — pairing them would produce
  nonsense recommendations. See `SPECIFIC_FRANCHISES` in `src/api/taxonomy.ts`.
- **Bags never suggest other bags.** The themed-Pop query filters out anything
  tagged `Loungefly`.

### Discounts are Shopify's job, not the app's

Bundle pricing is configured as a **Shopify automatic discount (Buy X Get Y)** in
admin. It applies itself at checkout, can never desync from cart contents, and
behaves identically on web and app. The app contains **no discount logic** — the
modal is purely a suggestion surface.

`cartStore.applyCode()` exists and works, but is not used by the upsell flow. It
is there if an app-exclusive code is ever wanted instead.

> **The modal copy already says "Bundle pricing applies automatically at
> checkout." Until the automatic discount is created in Shopify admin, that is a
> promise with nothing behind it.**

---

## 4. `CrossMerchShelf` was dead code — now fixed

`parseFranchiseTag` looked for tags prefixed `franchise:`. **No product in the
store has ever used that convention** — franchises are stored as bare tags
(`Lilo & Stitch`, `Jujutsu Kaisen`). It returned `null` for every product, so the
"Complete the Set" shelf on the product page rendered nothing and always had.

It now resolves against `SPECIFIC_FRANCHISES` in `src/api/taxonomy.ts`. Longest
match wins, so a product tagged both `Batman` and `Batman: Gotham Knights`
resolves to the more specific one.

Expect this shelf to start appearing on product pages. That is the fix working,
not a regression.

---

## 5. Known data problems

1. **`Other Backpacks and Purses` (385) conflates two product types.** It needs
   *splitting* into `Backpacks` vs `Crossbody Bags`, not renaming.
2. **`Wallet` (82) and `Wallets` (18) are separate tags.** Consolidate onto the
   plural.
3. **Non-Loungefly product is tagged `Loungefly`.** Currently sitting in that 584:
   - `Star Wars The Vintage Collection Yoda 3¾-Inch Action Figure`
   - Several `Mobile Suit Gundam` / `Bandai HG` model kits
   - `Stranger Things: Demogorgon Backpack (Funko Limited Edition Sticker)` — a Funko item

   The Yoda figure surfaced as a "bag" during upsell testing.
4. **Protectors are not identifiable by title.** Searching "case" returns actual
   Funko Pops such as `Black Panther Pop! Comic Cover Figure with Case`. A
   dedicated `Protector` tag is required — offering someone a Pop as a protector
   would be a bad bug.
5. **~60% of Loungefly bags have no franchise tag**, so no themed offer resolves
   for them. Measured hit rate at time of writing: 24/60 sampled.

---

## 6. Remaining work

### Blocking — nothing works without these
- [ ] Create tags `Video Games`, `Movies & TV`, `Crossbody Bags`, `Matching Sets`
- [ ] Tag the ~8 protector SKUs with `Protector` (protector upsell is inert until then)
- [ ] Create the Shopify automatic Buy X Get Y discount for bag + Pop

### Data cleanup
- [ ] Split `Other Backpacks and Purses` → `Backpacks` / `Crossbody Bags`
- [ ] Merge `Wallet` → `Wallets`; fold in `Card Holder`, `ID Card Holder`, `Credit Card Holder`
- [ ] Untag the mislabelled `Loungefly` items listed in §5
- [ ] Add franchise tags to bags currently missing them

### Carried over from the CSV work
- [ ] **`27Jul_inv_tagged.csv` has never been imported.** None of that pass is
      live — every new tag (`Other Great Disney Movies`, `More Marvel Comics`,
      `More Great Horror`, …) currently returns 0 products.
- [ ] 5,153 products carry a `Ronin` tag, flagging tags that needed manual triage
- [ ] The export→import template conversion is unfinished, blocked on how to
      populate `Inventory quantity` — the export contains no stock data at all

### Minor
- [ ] "Browse All Funko Pops" still routes to a *collection* while every card
      above it routes by tag
- [ ] The `3,500+` / `100+` counts on the brand toggle are hardcoded

**Fastest path to seeing everything work:** create the four card tags and the
`Protector` tag. Every card and both upsells light up with no code changes.

---

## 7. File map

| File | Role |
|---|---|
| `src/api/taxonomy.ts` | Franchise vocabulary, `resolveFranchise`, `resolvePopSize`, brand tags |
| `src/api/queries/collections.ts` | `FUNKO_CATEGORIES` / `LOUNGEFLY_CATEGORIES` — the card definitions |
| `src/api/queries/upsell.ts` | Decides which companion product to offer |
| `src/api/queries/products.ts` | `fetchProductsByTag` (AND semantics), `parseFranchiseTag` |
| `src/store/cartStore.ts` | Cart state, upsell trigger, `pendingUpsell` |
| `src/components/ui/UpsellModal.tsx` | The add-to-cart bottom sheet |
| `src/components/ui/CategoryIconCard.tsx` | Grid card; `tagOnly` routes to `/tag/[tag]` |
| `src/components/ui/CrossMerchShelf.tsx` | "Complete the Set" shelf on the PDP |
| `app/(tabs)/shop.tsx` | The Fandom Grid |
| `app/tag/[tag].tsx` | Tag browse screen — where every card lands |
| `app/collection/[handle].tsx` | Collection browse; still used by Browse All |
