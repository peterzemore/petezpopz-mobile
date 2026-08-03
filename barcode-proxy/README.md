# PetezPopz Barcode Proxy

A one-file Vercel serverless function that resolves a UPC barcode to a Shopify product handle
using the Admin API (which supports `barcode:VALUE` filtering — the Storefront API does not).

## Deploy in 5 minutes

### 1. Install Vercel CLI (once)
```
npm i -g vercel
```

### 2. Deploy
```
cd barcode-proxy
vercel --prod
```

Follow the prompts — create a new project called `petezpopz-barcode-proxy`.
Vercel gives you a URL like `https://petezpopz-barcode-proxy.vercel.app`

### 3. Set environment variables in Vercel dashboard
Go to your project → Settings → Environment Variables, add:

| Name | Value |
|------|-------|
| `SHOPIFY_STORE` | `sugarcreektoys.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | `shpat_xxxxxxxxxxxx` |

**To get your Admin token:**
Shopify Admin → Settings → Apps and sales channels → Develop apps →
PetezPopz → API credentials → "Admin API access token" (reveal and copy it)

### 4. Add to your Expo .env
```
EXPO_PUBLIC_BARCODE_API_URL=https://petezpopz-barcode-proxy.vercel.app/api/barcode-lookup
```

### 5. Test the endpoint manually
```
curl "https://petezpopz-barcode-proxy.vercel.app/api/barcode-lookup?upc=889698759380"
# Should return: {"handle":"your-product-handle"}
```

## How it works
Mobile app → Vercel function → Shopify Admin API (`barcode:VALUE`) → returns handle
Mobile app then fetches full product via Storefront API using the handle.

The Admin API token lives only on Vercel's servers — never in the mobile app.
