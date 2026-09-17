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
- **App display name changed 2026-09-16** from `PetezPopz` (one word) to `PeteZ PopZ` (two words) — customers were searching for the two-word form and not finding the app. Changed in `app.json`'s `name` (drives the home-screen icon label on both platforms) and `ios.infoPlist.NSCameraUsageDescription`, plus 10 user-facing UI strings: `app/auth/login.tsx` logo, `app/(tabs)/index.tsx` home header logo, `app/callback.tsx` back-link, `app/checkout.tsx` pickup message, `src/api/queries/cart.ts`'s `pickup_location` cart-attribute fallback (shows in Shopify order notes), `src/store/wishlistStore.ts` share text (x2), `app/(tabs)/toybox.tsx` share title, `app/(tabs)/rewards.tsx` delete-account alert, `app/product/[handle].tsx` back-in-stock email template. Source-code header comments (`// PetezPopz — ...`, ~40 files) were deliberately left one-word — not user-facing, out of scope for this pass; don't take their presence as a sign the rename was missed.

## iOS / App Store (set up 2026-09-06)

- **Chrome session for App Store Connect logs out silently — verify before trusting any automated
  check.** Found 2026-09-10: a scheduled morning check navigated straight to a TestFlight builds
  URL and got redirected to `appstoreconnect.apple.com/login?...&authResult=FAILED` with no obvious
  error in a quick glance — `get_page_text` on that page still returns real-looking text ("Apple.com
  / Copyright...") which can look like a legitimate (if sparse) result if you don't check the URL
  the navigation actually landed on. **Any Chrome-driven ASC check must confirm the resulting URL
  still starts with `appstoreconnect.apple.com` (not `/login`) before reading or reporting the page
  content** — a login redirect is a hard stop, not a page to scrape, and should be reported to
  Peter as "you need to sign back in," never silently retried or guessed around. This session has no
  standing credential to re-authenticate with, and must not attempt to.
- App Store Connect record: **"PeteZ PopZ"**, Apple ID `6809233073`, SKU `petezpopz-ios`, bundle `com.petezpopz.app`, team `Q62G243P6Q` (individual Apple Developer membership, personal Apple ID; a conversion to an organization membership under the LLC is planned but not started). Version 1.0 / build 9 was the first submission.
- `eas submit --platform ios --latest` is **non-interactive** now: `eas.json` carries `ascAppId` + `appleTeamId`, and an App Store Connect API key ("[Expo] EAS Submit") lives on EAS servers. If it ever asks to log in again, the Apple ID is Peter's personal address, not the store Gmail — the API key may have been revoked in ASC under Users and Access → Integrations.
- iOS runs **natively on iPad since build 10** (`ios.supportsTablet: true`, `ios.requireFullScreen: true`
  so portrait-only stays legal on iPad). Build 9 was iPhone-only and App Review tested it on an
  iPad anyway, where iPhone-compatibility mode broke the sign-in keyboard (see review history).
  The layouts adapt with `src/utils/useGridColumns.ts` (2/3/4 product columns by window width),
  a capped product gallery, and a phone-width login card; everything else stretches. App Store
  Connect now requires 13-inch iPad screenshots (2064x2752 or 2048x2732) alongside the iPhone set.
  **Do not toggle `requireFullScreen` to `false` to chase the App Store's "Designed for iPad" vs.
  "Designed for iPhone" label** — tried and reverted 2026-09-16. That flag is load-bearing: it's
  what lets the app stay portrait-only on iPad without having to implement full Split View/Slide
  Over multitasking. Turning it off for a cosmetic label change risks Apple's binary validation
  or App Review flagging the missing multitasking support, or resurfacing a layout bug at
  arbitrary iPad window sizes the app was never built to handle.
- Availability is **United States only**. Adding EU countries requires filing the Digital Services Act trader status in ASC first, or Apple removes the app from EU storefronts.
- Store listing source of truth is `play-store-assets/app-store-listing.md` (description, keywords, privacy-label answers, review notes). ASC's iPhone slot wanted 6.5-inch screenshots (1284x2778) → `play-store-assets/app-store-6.5in/`; the `app-store-6.9in/` set is unused but kept. Both are resized from the raw `IMG_58xx.PNG` iPhone captures.
- App Review notes state that sign-in is optional and passwordless (Shopify one-time email code), so there is no demo account; Gold/Platinum are physical-goods subscriptions billed via Shopify checkout (guideline 3.1.3(e)), not in-app purchase. Keep the app consistent with that or the next review will flag it.
- **App Review history:** build 9 was rejected 2026-09-06 under Guideline 2.1 *Information Needed*
  (the standard new-developer-account request, not a defect). Answered the same night with a
  2m34s device recording (Drive link) plus written answers; the reply text and recording shot
  list live in `../app-store-review/` (outside this public repo). Resubmitted 2026-09-06 23:07,
  status Waiting for Review. Lessons for the next recording: clear Safari data for
  **petezpopz.com** (the login lives at account.petezpopz.com, not a shopify domain), delete and
  reinstall the app to clear the checkout sheet's cookies, use a fresh Gmail plus-address per
  attempt because Shopify throttles one-time codes per email, and install the reviewed build via
  TestFlight (internal tester = yourself), never the dev server.
  **Second rejection 2026-09-09 09:47, Guideline 2.1(a):** reviewed on an iPad Air 11-inch
  (M3), iPadOS 26.6.1: "no keyboard shown in order to input verification code". The code is
  typed on Shopify's hosted login page inside the system auth sheet; in iPhone-compatibility
  mode on iPadOS 26 that sheet shows no keyboard (Apple forum thread 811744, unresolved).
  Reviewers test iPhone-only apps on iPad regardless. Decision the same day: make it a real
  iPad app (build 10) rather than argue. Notes and a draft reply in
  `../app-store-review/2026-09-09-guideline-2.1a-ipad-keyboard.md`.
  **Build 10 (2026-09-09, commit f7a9ff5)**: native iPad, uploaded via `eas submit`, processed
  15:07. TestFlight: the Internal group is Peter's personal Apple ID only; Peter's iPad Pro 12.9 (6th gen,
  2048x2732, valid 13-inch screenshot size as-is) runs the store's Apple ID, so an **external
  group "iPad"** was created with that address and build 10 assigned, which put it through Beta
  App Review (Test Information filled: beta description, feedback/contact pete@petezpopz.com,
  no demo account). External testers get no invite email until Beta App Review approves. Apple
  also warned ITMS-90683 (location purpose string) on build 10: react-native-vision-camera compiles
  in CLLocation unless the plugin gets `enableLocation: false`; fixed in commit 13ba472, ships in
  build 11. Plan: iPad test on build 10, then build 11 with any layout fixes, iPad screenshots
  into ASC, attach build 11, send the drafted reply, resubmit.
  **Beta App Review rejected build 10 the same evening (2026-09-09 20:12, Guideline 2.1(a)
  Information Needed)**: the beta reviewer could not get past sign-in and wants a user name and
  password under TestFlight > Test Information > Beta App Review Information. There is no
  password (Shopify Customer Accounts are passwordless), so an external TestFlight group will
  hit this every time. Route around it: add the iPad's Apple ID as an App Store Connect user
  (Users and Access, any minimal role such as Customer Support), put that user in the
  **Internal** group, and the build is testable immediately with no Beta App Review. Keep
  external groups for the day there is a real demo account. Thread id
  e5c241bb-4e97-304f-825b-46f716fadb35 under Distribution > App Review. Done that evening:
  the store's Apple ID is now an ASC user (Customer Support) in the Internal group and build 10
  installed on the iPad. Gotcha: the tester sat at "No Builds Available" with TestFlight showing
  only a Redeem button until the tester was removed from the group and re-added, which flipped it
  to "Invited" and sent the TestFlight email. TestFlight uses the App Store (Media & Purchases)
  Apple ID, not the iCloud one. **iPad test of build 10 (2026-09-09 evening, iPad Pro 12.9):** the
  sign-in keyboard appears on Shopify's code page and sign-out then sign-in as another address
  works, so the 2.1(a) defect is gone on the native iPad build. Found and fixed for build 11
  (commit c35a1e8): iPadOS 26 letterboxes the portrait-only app in landscape (iPad now allows all
  orientations), and the home VIP Drops shelf now shows New Arrivals.
  **Build 11 (2026-09-09 22:29, commit 79bd190)**: submitted 22:32 via `eas submit`. Carries the
  ITMS-90683 fix, iPad landscape, New Arrivals shelf, gallery-below-header fix, width-scaled hero
  banner (contain on wide screens), and the scarcity pill on the product page.
  **Resubmitted 2026-09-12**: 5 iPad 13-inch screenshots added to ASC (`play-store-assets/app-store-13in/`,
  matching the iPhone set — Fandom Grid, product page, cart, rewards, membership), build 11 attached
  to version 1.0, the reply in `../app-store-review/2026-09-09-guideline-2.1a-ipad-keyboard.md` sent
  to Apple with the keyboard screenshot attached. Submission `ded539bc-4d3c-4abd-af6d-9d10dc76a1f8`
  now Waiting for Review.
- **In-app account deletion never worked before 2026-09-06**: barcode-proxy sent the Customer
  Account API `Authorization: Bearer shcat_...`; the API wants the raw token plus
  `Shopify-Store-Domain`/`Shopify-Client-Id` (see `barcode-proxy/lib/customer-account.js`, which
  mirrors `customerHeaders()` in the app). Fixed in all four customer-token proxy endpoints and
  deployed; Vercel env `SHOPIFY_CUSTOMER_CLIENT_ID` added.
- `ios.buildNumber` auto-increments on every production build (`autoIncrement: true`, `appVersionSource: local`) and EAS edits `app.json` locally — commit that bump after each build so the repo matches what was uploaded.
- **Version 1.0.1, builds 12/13 (2026-09-16):** the app-name rename above required a new build.
  Build 12 (`expo.version` still `1.0.0`) uploaded fine via `eas submit` but was then **rejected
  by Apple's binary validation** (before App Review even sees it) with ITMS errors 90062/90186:
  "CFBundleShortVersionString [1.0.0] must contain a higher version than the previously approved
  version [1.0.0]" / "Invalid Pre-Release Train. The train version '1.0.0' is closed for new build
  submissions." Once a marketing version is approved and live, that version train is closed for
  good — bumping `ios.buildNumber` alone is not enough for a new build to be accepted. Fix: bump
  `expo.version` too (`1.0.0` → `1.0.1`), rebuild (→ build 13), resubmit — uploaded successfully,
  processed and showed up in TestFlight ~10 minutes later. **Lesson: any future rebuild of an
  already-approved version needs `expo.version` bumped, not just the build number, or the upload
  gets rejected at this stage.** Uploading to App Store Connect via `eas submit` is not the same as
  submitting for App Review — that's still a separate manual step in ASC (create the new version,
  attach the build, click Submit for Review); auto-release is on, so it ships live once approved.

## Android / Play Store

- Play Console developer account: **"ZemoreIQ"**, package `com.petezpopz.app`. **Claude cannot
  reach this account through Claude-in-Chrome** — it lives in a Chrome profile separate from the
  two Google accounts (`petezpopz@gmail.com`, `peter@zemoanalytics.com`) visible to Claude's tab
  group. This is profile isolation, not a login problem, and doesn't resolve by retrying or trying
  other `/u/N/` indexes — Peter has to drive Play Console himself; Claude can advise from a
  screenshot but not navigate it directly.
- No automated submit is configured for Android — `eas.json`'s `submit.production` only has `ios`
  credentials, no Google service-account key. `eas submit --platform android` needs one set up
  first (create a service account in Play Console, grant release permissions, wire the key into
  `eas.json`) — not done as of 2026-09-16. Until then: get the `.aab` download URL from
  `eas build:list --platform android --json` (`applicationArchiveUrl`), download it, and upload
  manually in Play Console under **Release → Production → Create new release**.
- Production and Internal testing tracks can drift independently: as of 2026-09-16, Production
  was on versionCode 4 (shipped 2026-08-31) while Internal testing was still stranded on
  versionCode 3 (from 2026-08-22) — nobody had pushed a release to that track since. Check both
  tracks, not just Production, when auditing what testers actually have installed.
- The **Play Store listing title** (Grow → Store presence → Main store listing) and the
  **on-device label under the app icon** are two separate settings, same split as iOS: the listing
  title is metadata, editable in Play Console with no rebuild; the on-device label comes from
  `app.json`'s `name` field, baked into the binary, needs a new build. Found 2026-09-16: the Play
  Store listing title was "PeteZPopZ" (one word, mixed caps) — separate bug from the on-device
  label also being one word pre-rename; both needed fixing, only one needed a rebuild.
- A "DEX code optimization is below our threshold" warning (R8/ProGuard obfuscation not
  configured) shows on the Production release dashboard with a **Fix by Feb 2027** deadline —
  informational, does not block releases, not addressed as of 2026-09-16.

## Sign-out and customer identity (fixed in code 2026-09-07, ships in build 10)

Two build-9 bugs, both found while recording the App Review video, both platform-neutral:

- **Sign-out did not end Shopify's browser session.** `logoutFromShopify()` used to `fetch()` the
  logout endpoint with the *client id* as `id_token_hint`, so it did nothing; the system browser
  sheet kept the session cookie and the next sign-in silently resumed the previous account. Now
  the code exchange stores the OpenID `id_token` (`KEYS.ID_TOKEN`) and sign-out calls the logout
  endpoint with it as `id_token_hint`, as a plain request. Shopify documents that for a public
  (mobile) client the endpoint is called as an API returning 200, and that the Headless channel's
  Logout URI setting does not apply to mobile public clients; the storefront's Customer Account
  API page indeed has no such field (checked 2026-09-09), so **no Shopify configuration is
  needed**. An earlier version of this fix opened the logout URL in the auth sheet and waited for
  a redirect that a mobile client never gets. Sessions signed in before this change have no
  stored id_token and skip the call (tokens still cleared). Verify on device: sign in, sign out,
  Sign in again must ask for an email.
- **Checkout opened as whoever the checkout web view last remembered.** Shopify's checkout sheet
  keeps its own cookie store inside the app; the kit exposes no cookie clearing. Mitigation in two
  halves: while signed in, the customer's access token is attached to the cart as
  `buyerIdentity.customerAccessToken` (on sign-in via `cartStore.setBuyer`, and on any cart
  created while signed in), so checkout opens as the right customer; on sign-out / delete,
  `forgetCustomerOnDevice()` drops the cart, creates a fresh one, and calls the kit's
  `invalidate()`. Known residual: Shop Pay device recognition inside that web view can still
  prefill an email for a *signed-out* user until the app is reinstalled. Only a native
  `WKWebsiteDataStore` / `CookieManager` clear would remove it; not done.

To reproduce the old symptoms for verification: sign in, sign out, tap Sign in again -- it must
ask for an email. Then add to cart and open checkout -- the contact field must be empty (signed
out) or the signed-in customer's email (signed in).

## Membership tiers (Silver / Gold / Platinum)

Defined once in `petezpopz-membership/lib/tiers.js` (a separate repo, not here) — Silver is free, Gold is $14.99/mo (10% off), Platinum is $24.99/mo (12% off). This app reads the customer's tier from the `custom.membership_tier` metafield. Don't hardcode tier names or rates here without checking that file first — it's the contract all three PetezPopz repos share.

## Checkout UI extension: loyalty points on the Thank You page

For deploying or troubleshooting `checkout-rewards-extension/` (a separate nested git repo), use the `checkout-rewards-extension` skill.

## Related repos (not in this checkout)

- `~/Projects/business/PeteZ PopZ/petezpopz-membership` — separate git repo, deployed on Vercel at `https://petezpopz-membership.vercel.app`. Webhook-driven Silver/Gold/Platinum membership tier sync (grants/revokes the customer tag + the `custom.membership_tier` metafield). This is the single source of truth for tier names, prices, and discount rates — check `lib/tiers.js` there before changing anything tier-related here.
- `~/Projects/business/PeteZ PopZ/website/zemore_theme_2Aug` — separate git repo, the Shopify theme ("Zemore"). Membership tier cards, rewards dashboard, and site nav live here.
