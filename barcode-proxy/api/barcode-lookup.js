// Vercel serverless function — proxies Shopify Admin API barcode lookups.
// Deploy this folder to Vercel (free), set two env vars in the dashboard.
//
// Required Vercel environment variables:
//   SHOPIFY_STORE        → sugarcreektoys.myshopify.com
//   SHOPIFY_ADMIN_TOKEN  → shpat_xxxx  (Shopify Admin → Settings → Apps → PetezPopz → API credentials)

const QUERY = `
  query BarcodeSearch($q: String!) {
    products(first: 1, query: $q) {
      nodes { handle title status }
    }
  }
`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { upc } = req.query;
  if (!upc) return res.status(400).json({ error: 'upc param required' });

  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!store || !token) return res.status(500).json({ error: 'Server not configured' });

  try {
    const r = await fetch(`https://${store}/admin/api/2026-04/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query: QUERY, variables: { q: `barcode:${upc}` } }),
    });

    const json = await r.json();
    if (json.errors) return res.status(502).json({ error: 'Shopify error' });

    const product = json.data?.products?.nodes?.[0] ?? null;
    // Only return handle if product is Active (not draft/archived)
    const handle = product?.status === 'ACTIVE' ? product.handle : null;
    return res.json({ handle });
  } catch (err) {
    console.error('[barcode-lookup]', err);
    return res.status(500).json({ error: 'Lookup failed' });
  }
}
