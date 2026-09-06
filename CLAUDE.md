# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PetezPopz App

Companion mobile app (Expo / React Native) for the PetezPopz Shopify store (Funko Pop / Loungefly collectibles). Talks to Shopify via the Storefront API (catalog, cart) and the Customer Account API (auth, profile, orders). This repo also contains `barcode-proxy/`, a separate Vercel-deployed serverless service the app calls for anything that needs the Shopify Admin API (never embedded in the mobile app itself).

## Commands

Camera scanner and Apple/Google Pay require a **Development Build**, not Expo Go:
```bash
npx eas build --profile development --platform ios
```

There is currently no test suite despite the `jest-expo` preset being configured — `npm test` will report no tests found. Do not assume coverage exists for a file just because it doesn't error.

To connect Peter's iPhone (or another device) to the dev server, use the `connect-dev-device` skill.

No lint script is defined in `package.json`; TypeScript checking is via `tsc` (strict mode, see `tsconfig.json`) but there's no wired `npm run typecheck` — run `npx tsc --noEmit` directly if you need it.

### barcode-proxy (separate deployable, own directory)

```bash
cd barcode-proxy
vercel --prod           # deploy
vercel dev              # local dev server for the serverless functions
```

It has its own `package.json` (ESM, `"type": "module"`) and is deployed independently of the Expo app — changes here don't ship via EAS and aren't picked up by `npm start` in the root.

## Architecture

### Two Shopify APIs, one client file

`src/api/shopify-storefront.ts` exposes two fetchers hitting **different Shopify APIs with different auth models** — mixing them up is the most common way to break something here:

- `storefrontFetch` → the classic public Storefront API (`https://{store}.myshopify.com/api/{version}/graphql.json`), token-based, used for products/collections/cart.
- `customerFetch` → the Customer Account API (`https://shopify.com/api/{version}/graphql`), OAuth-token-based, used for the signed-in customer's profile/orders/metafields. Requires `Shopify-Store-Domain` + `Shopify-Client-Id` headers plus an `Authorization` header that is the raw `shcat_...` token with **no `Bearer` prefix** (see the comment in `customerHeaders()` — this bit already caused a real, confusing bug).

Everything else in `src/api/queries/*.ts` builds typed GraphQL operations on top of these two fetchers. `src/api/shopify-customer.ts` owns the PKCE OAuth flow (login, token refresh, secure storage via `expo-secure-store`) plus calls out to `barcode-proxy`'s Admin-API-backed endpoints (account deletion, points redemption, marketing opt-in, birthday) — the app itself never holds an Admin API credential.

### Why there's a proxy service at all

Some operations are only possible via the Shopify Admin API (barcode lookup by UPC, account deletion, writing loyalty-point redemptions/marketing consent/birthday to customer metafields) — but an Admin token must never live in the mobile app bundle. `barcode-proxy/` is the trust boundary: it holds the Admin API client-credentials secret server-side (`barcode-proxy/lib/shopify-admin.js`, same 24h-token-exchange pattern as the membership service) and exposes narrow, purpose-built endpoints the app calls with the customer's own Customer Account API token, which the proxy verifies belongs to the caller before acting.

### State: Zustand stores + AsyncStorage/SecureStore persistence

`src/store/{authStore,cartStore,wishlistStore}.ts` are the only client state. Pattern to follow when extending them: mutate via an async action that first updates local persisted state (AsyncStorage for cart ID / wishlist, SecureStore for tokens), then calls the Shopify API, then reconciles `set()` with the server response — never trust optimistic local state as the source of truth for cart contents or auth. `app/_layout.tsx` bootstraps both `authStore.loadSession()` and `cartStore.initCart()` in parallel before hiding the splash screen.

Notable non-obvious behavior in `cartStore.addItem`: on success it may resolve a companion-product "upsell" offer (`resolveUpsell`, `src/api/queries/upsell.ts`) and set `pendingUpsell`, rendered globally by `<UpsellModal />` in the root layout (so it can fire from any add-to-cart surface — PDP, cross-merch shelf, quick add). Upsell resolution errors are swallowed by design — a failed suggestion must never surface as a cart error, and each product is only offered once per session (`offeredProductIds`).

### Routing: Expo Router, file-based

`app/` mirrors the URL structure directly (Expo Router v4 conventions — `(tabs)` for the tab bar, `[handle]`/`[tag]` for dynamic routes). `app/_layout.tsx` is the single place that declares the Stack, global providers (Sentry, fonts, GestureHandlerRootView), and the global `UpsellModal`. `app/callback.tsx` is a fallback OAuth redirect route — see the standalone-Android gotcha below.

### Product taxonomy: tags, not collections

Every category card in the app (Fandom Grid, `src/api/queries/collections.ts`) browses by **Shopify product tag**, not collection handle — collections on this store are hand-curated and lag badly behind tag data. Full rationale, the card→tag mapping, and known gotchas (word-level tag matching, AND-only tag queries, alphabetical-sort surprises) are written up in `direction.md` — read it before touching anything in the Fandom Grid or adding a new category card.

### Entry point patches (don't remove without understanding why)

- `index.js` is deliberately `require()`-based, not `import`, and patches `Event.prototype`'s phase constants *before* `expo-router/entry` loads — Babel hoists `import`s above synchronous code, which would run too late. Without this patch every `fetch()` call throws under Hermes.
- `src/polyfills.ts` is imported first-line in `app/_layout.tsx` for the same class of Hermes compatibility issue.
- `patches/react-native+0.81.5.patch` (applied via `patch-package` on `postinstall`) and the `overrides` block in `babel.config.js` (forcing private-class-field transforms through `@egjs`, `react-native-worklets`, `react-native-reanimated`) exist for similar Hermes-parsing reasons — if a fresh `npm install` starts throwing syntax errors from inside those packages, check these first before adding new fixes.

## Shopify API — 2026 rules (this store's setup; don't relitigate)

- Admin API custom apps created via the Shopify admin UI were **deprecated 2026-01-01**. There is no more long-lived `shpat_` token to copy from the admin UI for new apps. Current auth is the **client credentials grant**: exchange `client_id` + `client_secret` for an access token that **expires in 24 hours** (`expires_in` is always `86399`) — fetch and cache it at runtime with a refresh buffer, it can't be a static env var. A `SHOPIFY_ADMIN_TOKEN` override still works for legacy apps created before that date.
- Admin API version is pinned explicitly in this store's services (e.g. `2026-07`), not left to default.
- **Storefront API** (public catalog/cart) and **Customer Account API** (authenticated shopper profile/orders) are different APIs with different capabilities. The Customer Account API does **not** reliably expose customer tags — only metafields. Discount **segments**, conversely, can only match on **tags**, never metafields. That's why any tier/loyalty write always touches both a tag and a metafield together.
- Subscription / selling-plan products (`requiresSellingPlan: true`) cannot be added to a cart via a cart permalink — `/cart/<variant>:1?selling_plan=<id>` returns **410 Gone**, with or without the param. Use the Storefront `cartCreate` mutation with `sellingPlanId` on the line (app-side), or `/cart/add.js` with `selling_plan` in the POST body (theme-side).
- Webhook payload shape is **not uniform** across topics for the same resource. Example: `subscription_billing_attempts/success` sends only `{subscription_contract_id, order_id, ready}` — no customer or line data at all — while `subscription_contracts/cancel` sends the full contract resource. Always confirm the actual payload for the specific topic before writing a handler; don't assume it matches a sibling topic. A handler that silently returns `200` on a payload shape it can't parse will never surface as an error and Shopify will never retry it.
- Theme deploys: small/targeted fixes go straight to the **live** Zemore theme (`shopify theme push --allow-live`). Large/substantial theme changes must be built on a **duplicate/copy theme first** — never push a large change directly live. When a section's schema gains new settings, push the section and the template that uses those settings in **two separate commands** — pushing both together validates the template against the pre-push schema and silently drops the new values.

## Conventions / gotchas specific to this app

- `.env` is gitignored. EAS cloud builds do **not** inherit it automatically — after any `.env` change, run `eas env:push <profile> --path .env --force` for every affected profile (development/preview/production), or builds silently ship with missing or stale config.
- Peter's own test device is iOS only. Android testers are remote, not on his LAN — they need an installable build (`eas build --profile preview`, APK), not `expo start` + same-Wi-Fi.
- The BOPIS (buy-online-pickup-in-store) toggle in the UI is intentionally decorative. Shopify's checkout already handles Ship vs. Pickup natively, so it's deliberately not wired to anything.
- Barcode scanning matches on SKU == barcode. Confirmed reliable on real products, not guaranteed catalog-wide without the barcode-proxy service normalizing lookups.
- Reward redemption codes are minted server-side, per redemption, single-use, never shown to the UI layer ahead of time. (Do not reintroduce static shared codes — an earlier REWARDS100/200/400 scheme was redeemable by anyone with zero points and has been fully removed.)
- `expo-auth-session`'s redirect completion is unreliable in standalone Android builds (works in a dev client, breaks in a real APK): the deep link arrives but `WebBrowser`'s auth-session interception doesn't catch it, falling through to normal app routing instead. `app/callback.tsx` plus `savePendingVerifier`/`getAndClearPendingVerifier` in `src/api/shopify-customer.ts` exist as the fallback route that completes the PKCE exchange in that case — don't remove either half independently.
- `sugarcreektoys.myshopify.com` is the current permanent store domain; `gemcitytoyco.myshopify.com` is a legacy alias that still resolves but shouldn't be introduced into new code.
- Store listing marketing assets (feature graphic, resized icons, raw phone screenshots for Play/App Store submissions) live in the sibling `play-store-assets/` folder, not `assets/`. This is just organizational hygiene, not a build-size concern — Metro only bundles files actually `require()`'d/imported somewhere in `app/`/`src/`, so unreferenced files sitting in `assets/` are never embedded in the binary regardless of `assetBundlePatterns`. Still, keep `assets/` to files the app code actually uses so it stays obvious what's live vs. one-off exports.
- The Play Store "delete account" URL (`EXPO_PUBLIC_DELETE_ACCOUNT_URL` calls the in-app deletion flow) has a public-facing companion page that lives on the Shopify site, **not in this repo**: `petezpopz.com/pages/delete-your-petezpopz-account`. If the deletion flow's behavior changes (what's deleted, what's retained), that page's copy needs a matching update or it'll misrepresent the actual process to both users and Play Store reviewers.
- `tsconfig.json` declares path aliases (`@/*`, `@theme/*`, `@components/*`, `@api/*`, `@store/*`) but they are **not wired up for Metro** — there's no `babel-plugin-module-resolver` in `babel.config.js` and no `resolver.alias` in `metro.config.js`. Every file in `app/` and `src/` uses relative imports (`../../src/theme/colors`) instead. An `@/`-style import will type-check fine (tsc honors the alias) but fail to bundle at runtime — if you see that split (green in the editor, red in Metro), this is why. Either wire up the alias resolver properly or keep using relative imports; don't assume the aliases work as-is.

## iOS / App Store (set up 2026-09-06)

- App Store Connect record: **"PeteZ PopZ"**, Apple ID `6809233073`, SKU `petezpopz-ios`, bundle `com.petezpopz.app`, team `Q62G243P6Q` (individual Apple Developer membership, personal Apple ID; a conversion to an organization membership under the LLC is planned but not started). Version 1.0 / build 9 was the first submission.
- `eas submit --platform ios --latest` is **non-interactive** now: `eas.json` carries `ascAppId` + `appleTeamId`, and an App Store Connect API key ("[Expo] EAS Submit") lives on EAS servers. If it ever asks to log in again, the Apple ID is Peter's personal address, not the store Gmail — the API key may have been revoked in ASC under Users and Access → Integrations.
- iOS is **iPhone-only** (`ios.supportsTablet: false`) on purpose: the UI is phone-designed and iPad support would require iPad screenshots plus an iPad review pass. Don't flip it back without regenerating iPad screenshots.
- Availability is **United States only**. Adding EU countries requires filing the Digital Services Act trader status in ASC first, or Apple removes the app from EU storefronts.
- Store listing source of truth is `play-store-assets/app-store-listing.md` (description, keywords, privacy-label answers, review notes). ASC's iPhone slot wanted 6.5-inch screenshots (1284x2778) → `play-store-assets/app-store-6.5in/`; the `app-store-6.9in/` set is unused but kept. Both are resized from the raw `IMG_58xx.PNG` iPhone captures.
- App Review notes state that sign-in is optional and passwordless (Shopify one-time email code), so there is no demo account; Gold/Platinum are physical-goods subscriptions billed via Shopify checkout (guideline 3.1.3(e)), not in-app purchase. Keep the app consistent with that or the next review will flag it.
- `ios.buildNumber` auto-increments on every production build (`autoIncrement: true`, `appVersionSource: local`) and EAS edits `app.json` locally — commit that bump after each build so the repo matches what was uploaded.

## Membership tiers (Silver / Gold / Platinum)

Defined once in `petezpopz-membership/lib/tiers.js` (a separate repo, not here) — Silver is free, Gold is $14.99/mo (10% off), Platinum is $24.99/mo (12% off). This app reads the customer's tier from the `custom.membership_tier` metafield. Don't hardcode tier names or rates here without checking that file first — it's the contract all three PetezPopz repos share.

## Checkout UI extension: loyalty points on the Thank You page

For deploying or troubleshooting `checkout-rewards-extension/` (a separate nested git repo), use the `checkout-rewards-extension` skill.

## Related repos (not in this checkout)

- `~/Projects/business/PeteZ PopZ/petezpopz-membership` — separate git repo, deployed on Vercel at `https://petezpopz-membership.vercel.app`. Webhook-driven Silver/Gold/Platinum membership tier sync (grants/revokes the customer tag + the `custom.membership_tier` metafield). This is the single source of truth for tier names, prices, and discount rates — check `lib/tiers.js` there before changing anything tier-related here.
- `~/Projects/business/PeteZ PopZ/website/zemore_theme_2Aug` — separate git repo, the Shopify theme ("Zemore"). Membership tier cards, rewards dashboard, and site nav live here.
