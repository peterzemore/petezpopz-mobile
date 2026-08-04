// Vercel serverless function — redeems loyalty points for the mobile app.
//
// Authenticates the caller with their own Customer Account API token, resolves
// their customer id from it, then hands off to the shared redemption core.
// The website does the same thing via api/app-proxy.js, authenticated by
// Shopify's signed proxy request instead — both go through lib/redeem.js so
// the rules can't drift between surfaces.
//
// Required Vercel environment variables:
//   SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET,
//   SHOPIFY_CUSTOMER_GRAPHQL_URL

import { redeemPoints, cancelRedemption, RedeemError } from '../lib/redeem.js';

const WHOAMI_QUERY = `query { customer { id } }`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'Missing bearer token' });

  const customerGraphqlUrl = process.env.SHOPIFY_CUSTOMER_GRAPHQL_URL;
  if (!process.env.SHOPIFY_STORE || !customerGraphqlUrl) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    // Resolve the caller from their own token — never take an id from the body.
    const whoami = await fetch(customerGraphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: WHOAMI_QUERY }),
    }).then((r) => r.json());

    const customerId = whoami?.data?.customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }

    // The app can cancel too, so an unused code isn't stranded there either.
    if (req.body?.cancel) {
      const cancelled = await cancelRedemption(customerId, req.body.cancel);
      return res.status(200).json(cancelled);
    }

    const result = await redeemPoints(customerId, Number(req.body?.points));
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof RedeemError) {
      return res.status(err.status).json({ error: err.message, ...err.extra });
    }
    console.error('[redeem-points]', err);
    return res.status(500).json({ error: 'Redemption failed' });
  }
}
