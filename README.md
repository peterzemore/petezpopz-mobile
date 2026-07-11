# PetezPopz — Custom Shopify Mobile App

A production-grade React Native + Expo mobile app for **[PetezPopz](https://www.petezpopz.com)** — a Funko Pop and Loungefly retail store.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo 52 |
| Routing | Expo Router v4 (file-based) |
| Shopify (Products/Cart) | Storefront API GraphQL |
| Shopify (Auth/Loyalty) | Customer Account API (PKCE OAuth) |
| Checkout | `@shopify/checkout-sheet-kit` |
| State | Zustand (auth, cart, wishlist) |
| Animation | React Native Reanimated v3 |
| Barcode Scanner | `react-native-vision-camera` |
| Fonts | Outfit + Inter via `expo-google-fonts` |
| Biometrics | `expo-local-authentication` |
| Token Storage | `expo-secure-store` |

---

## Project Structure

```
pp_app/
├── app/
│   ├── _layout.tsx              # Root layout (fonts, session init)
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab bar with blur
│   │   ├── index.tsx            # 🏠 Home / Fandom Hub
│   │   ├── shop.tsx             # 🛍️ Fandom Grid (categories)
│   │   ├── toybox.tsx           # 🧸 Wishlist + Share
│   │   └── rewards.tsx          # ⭐ Rewards Hub
│   ├── product/[handle].tsx     # PDP with cross-merch
│   ├── collection/[handle].tsx  # Paginated collection grid
│   ├── scanner.tsx              # 📷 Barcode scanner
│   ├── auth/login.tsx           # OAuth + biometric login
│   └── checkout.tsx             # Cart + BOPIS + Checkout Sheet
└── src/
    ├── api/
    │   ├── shopify-storefront.ts # GraphQL client
    │   ├── shopify-customer.ts   # PKCE OAuth client
    │   └── queries/              # All typed queries & mutations
    ├── store/
    │   ├── authStore.ts          # Zustand auth store
    │   ├── cartStore.ts          # Zustand cart store
    │   └── wishlistStore.ts      # Zustand wishlist store
    ├── components/ui/            # All UI components
    └── theme/                    # Colors, typography, spacing
```

---

## Setup

### 1. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in the Storefront API token:
```
EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=your_token_here
```

> **How to get the Storefront token**: Shopify Admin → Apps → Develop Apps → Create App → API credentials → Configure Storefront API scopes → Generate token

The Customer Account API credentials are already filled in:
- Client ID: `b2686c7d161c4dd5e2b99337d214e56b`
- Store: `gemcitytoyco.myshopify.com`

### 2. Register OAuth Redirect URI

In your Shopify Partner Dashboard → App settings → URL Settings:
- Add redirect URI: `petezpopz://auth/callback`

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development Server

```bash
npx expo start
```

> **Note:** Features requiring native modules (camera scanner, biometrics, Apple/Google Pay) need an **Expo Development Build**, not Expo Go:
> ```bash
> npx eas build --profile development --platform ios
> # or
> npx eas build --profile development --platform android
> ```

---

## Shopify Setup Checklist

### Required Collections (create in Shopify Admin)
| Collection Handle | Purpose |
|---|---|
| `app-exclusive-promo` | Hero banner carousel on Home |
| `funko-pops-all` | All Funko Pops |
| `loungefly-all` | All Loungefly |
| `funko-anime` | Anime Funko category |
| `funko-disney-marvel-starwars` | Disney/Marvel/SW Funko |
| `funko-tv-movies` | TV & Movies Funko |
| `funko-animation` | Animation Funko |
| `funko-music-sports` | Music & Sports Funko |
| `funko-exclusives-grails` | Exclusives Funko |
| `loungefly-disney-pixar` | Disney & Pixar Loungefly |
| `loungefly-anime-gaming` | Anime & Gaming Loungefly |
| `loungefly-pop-culture` | Pop Culture Loungefly |
| `loungefly-seasonal` | Seasonal Loungefly |
| `loungefly-mini-backpacks` | Mini Backpacks Loungefly |
| `loungefly-crossbody-wallets` | Crossbody & Wallets Loungefly |

### Required Product Tags
| Tag | Purpose |
|---|---|
| `Franchise:Stitch` | Cross-merch grouping (replace Stitch with any franchise name) |
| `VIP_Only:True` | Marks a product as VIP-gated |
| `Launch_Time:2026-07-15-10:00` | Sets countdown for VIP drop |
| `App-Exclusive` | Shows "📱 APP EXCLUSIVE" pill on promo banner |

### Required Customer Metafield
| Namespace | Key | Type | Purpose |
|---|---|---|---|
| `custom` | `loyalty_points` | `number_integer` | Current points balance |

### Loyalty Points Write-Back (Shopify Flow)
Create a Flow triggered on **Order Paid**:
1. Trigger: Order status changes to `paid`
2. Action: Update customer metafield `custom.loyalty_points`
3. Formula: `customer.metafield.custom.loyalty_points + round(order.total_price)`

---

## Features Implemented

- [x] 🏠 **Home / Fandom Hub** — promo carousel, loyalty gauge, split store fork
- [x] 🛍️ **Fandom Grid** — Funko/Loungefly toggle, 2-column category grid
- [x] 🧸 **Toy Box Wishlist** — AsyncStorage persistence, native Share sheet
- [x] ⭐ **Rewards Hub** — tier display, redemption tiles, order history
- [x] 📱 **Product Detail Page** — image gallery, scarcity badge, BNPL, loyalty hook, variants
- [x] 🔄 **Complete the Set** — cross-merch shelf by franchise tag with Quick Add
- [x] 🔒 **VIP Gate** — lock overlay with countdown timer for non-VIP users
- [x] 📷 **Barcode Scanner** — Vision Camera + SKU GraphQL lookup
- [x] 🔐 **PKCE OAuth** — Shopify Customer Account API login
- [x] 💳 **Checkout Sheet** — `@shopify/checkout-sheet-kit` with Apple/Google Pay
- [x] 🏪 **BOPIS Toggle** — In-store pickup vs. shipping switch
- [x] 🌑 **Dark Mode First** — full dark design system
