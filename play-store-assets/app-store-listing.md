# App Store Connect listing — PetezPopz (com.petezpopz.app)

Drafted 2026-09-06 for the first iOS submission. Paste into App Store Connect;
edit freely. Apple Team Q62G243P6Q (Peter Zemore, Individual).

## App Information
- Name: PetezPopz
- Subtitle (30 chars max): Funko Pop & Loungefly Store
- Primary category: Shopping
- Secondary category: Entertainment
- Age rating: 4+ (no objectionable content; answer "No" to every questionnaire item)
- Privacy Policy URL: https://petezpopz.com/policies/privacy-policy
- Support URL: https://petezpopz.com/pages/contact
- Marketing URL (optional): https://www.petezpopz.com
- Copyright: 2026 PeteZ PopZ LLC
- Content rights: does not contain, show, or access third-party content
- Export compliance: uses only standard HTTPS encryption (ITSAppUsesNonExemptEncryption
  is already false in app.json, so ASC will not ask)

## Promotional text (170 chars max, editable without a new build)
Shop 3,500+ Funko Pops and Loungefly bags from Dayton's collectibles store. Earn a point per dollar, unlock rewards, and scan barcodes in-store.

## Description (4,000 chars max)
PetezPopz is the official app for PeteZ PopZ, a Funko Pop and Loungefly collectibles store in Dayton, Ohio. Browse our live inventory, build your Toy Box wishlist, earn rewards on every order, and check out with Apple Pay.

BROWSE BY FANDOM
Explore thousands of Funko Pops and Loungefly bags organized by universe: Anime, Animation, Disney, DC Comics, Horror, Chase Variants, and more. Sort by newest, best selling, or price, and search inside any fandom.

KNOW BEFORE YOU BUY
Every product page shows live stock counts, so you can see when only a few are left. "Complete the Set" suggests matching figures from the same franchise.

EARN REWARDS
Sign in with your PetezPopz store account and earn 1 point for every dollar you spend. Redeem 100 points for $5 off, 200 for $10, or 400 for $20 at checkout. Your balance and order history live in the Rewards tab.

MEMBERSHIP TIERS
Silver is free. Gold and Platinum members save 10% or 12% on every order, get free shipping over $79, and receive protectors every month. Platinum members get early access to every drop and a birthday gift.

SCAN IN STORE
Visiting the shop? Point the barcode scanner at any box to pull up the product, price, and stock instantly.

TOY BOX WISHLIST
Save the figures you're hunting for and share your list with friends and family.

FAST CHECKOUT
Secure checkout powered by Shopify, with Apple Pay and Shop Pay supported.

PeteZ PopZ is an independent, family-run store. Questions? Reach us at support@petezpopz.com.

## Keywords (100 chars max, comma separated, no spaces after commas)
funko,pop,loungefly,collectibles,vinyl figures,anime,disney,toys,collector,funko pop,backpack,rewards

## What's New (version 1.0.0)
First release of the PetezPopz app: browse live inventory, earn rewards, scan barcodes in store, and check out with Apple Pay.

## Screenshots
- 6.9-inch iPhone (required): `app-store-6.9in/ios-1..5.png`, 1320x2868, upload in numeric order.
- 6.5-inch: not needed; ASC scales the 6.9-inch set.
- iPad: required only while `ios.supportsTablet` is true in app.json (see open decision below).

## App Privacy (nutrition labels)
Answer "Yes, we collect data from this app". Data types, all linked to the user's identity
unless noted, none used for tracking, none for third-party advertising:

| Data type | Purpose | Notes |
|---|---|---|
| Name | App functionality | Shopify customer profile |
| Email address | App functionality | Shopify customer profile, sign-in |
| Phone number | App functionality | Shopify customer profile, optional |
| Physical address | App functionality | Default shipping address from Shopify |
| Purchase history | App functionality | Order history + loyalty points |
| Product interaction | App functionality | Wishlist (stored on device only) |
| Crash data | App functionality | Sentry, not linked to identity |
| Performance data | App functionality | Sentry traces, not linked to identity |
| Device ID | App functionality | Sentry device identifier, not linked to identity |

Not collected: precise/coarse location, contacts, photos (camera is used live for
barcode scanning only; no images are stored or uploaded), health, financial info
(payment details are entered inside Shopify's checkout sheet, never seen by the app),
browsing/search history, advertising data.

Tracking: No. Account deletion: available in-app (Rewards tab) and at
https://petezpopz.com/pages/delete-your-petezpopz-account.

## App Review Information
- Contact: Peter Zemore, petezpopz@gmail.com, [phone number]
- Sign-in required: No. All browsing, cart, and checkout work without an account.
- Demo account: sign-in uses Shopify Customer Accounts, which emails a one-time code
  (no password exists). Provide a real store customer email the reviewer can use only if
  Apple insists; otherwise state that sign-in is optional and used solely for
  rewards/order history.
- Notes for the reviewer:
  "PetezPopz is the companion app for a physical retail store (PeteZ PopZ, Dayton, Ohio)
  and its Shopify web store. No sign-in is needed to browse, add to cart, or check out.
  Signing in (Rewards tab) uses Shopify's passwordless customer accounts: enter an email,
  receive a 6-digit code by email, enter it. The barcode scanner (Shop tab, camera icon)
  looks up products by UPC against live inventory; any Funko Pop box barcode will work.
  Gold/Platinum memberships are physical-goods subscriptions (monthly protectors + store
  discounts) billed through Shopify checkout, not in-app purchase, per guideline 3.1.3(e)
  for goods consumed outside the app. Account deletion is in Rewards > Account."

## Status 2026-09-06
Everything above was entered into App Store Connect (app record 6809233073). Decided: iPhone-only, US-only availability, Free, age 4+, content rights = yes with rights, review phone = Peter's cell. Screenshots actually used: `app-store-6.5in/` (ASC asked for the 6.5-inch slot, 1284x2778). Remaining: upload build 9 via `eas submit`, attach it, Add for Review.

## Open decisions (Peter) — resolved, kept for history
1. iPad: app.json has `ios.supportsTablet: true`, so ASC will require 13-inch iPad
   screenshots and reviewers will test on iPad. The UI is phone-designed. Recommend
   setting supportsTablet to false (iPhone-only) before the submitted build.
2. Support URL: confirm https://petezpopz.com/pages/contact exists, or use
   mailto-free page https://www.petezpopz.com.
3. Review contact phone number.
