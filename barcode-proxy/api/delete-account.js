// Vercel serverless function — deletes a Shopify customer account.
// Deploy alongside barcode-lookup.js (same project).
//
// The customer's own Customer Account API access token can't delete their
// account — only the Admin API's customerDelete mutation can, and that
// requires the privileged Admin token, which must never live in the mobile
// app. So this endpoint takes the customer's access token, uses it to look
// up *their own* customer id via the Customer Account API (proving the
// caller genuinely owns that account), then uses the Admin token server-side
// to delete exactly that id.
//
// Required Vercel environment variables (same project as barcode-lookup.js):
//   SHOPIFY_STORE                  → your-store.myshopify.com
//   SHOPIFY_CLIENT_ID              → Dev Dashboard app client id
//   SHOPIFY_CLIENT_SECRET          → Dev Dashboard app client secret
//   SHOPIFY_CUSTOMER_GRAPHQL_URL   → https://account.yourdomain.com/customer/api/2026-07/graphql

import { adminGraphQL } from '../lib/shopify-admin.js';
import { customerAuthHeaders } from '../lib/customer-account.js';

const WHOAMI_QUERY = `query { customer { id } }`;

const DELETE_MUTATION = `
  mutation CustomerDelete($id: ID!) {
    customerDelete(input: { id: $id }) {
      deletedCustomerId
      userErrors { field message }
    }
  }
`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'Missing bearer token' });

  // Admin credentials are validated inside adminGraphQL, which resolves them
  // via the client credentials grant.
  const customerGraphqlUrl = process.env.SHOPIFY_CUSTOMER_GRAPHQL_URL;
  if (!process.env.SHOPIFY_STORE || !customerGraphqlUrl) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    // Step 1: resolve the caller's own customer id from their token — never
    // trust an id passed in the request body, or any caller could delete
    // any other customer's account.
    const whoamiRes = await fetch(customerGraphqlUrl, {
      method: 'POST',
      headers: customerAuthHeaders(accessToken),
      body: JSON.stringify({ query: WHOAMI_QUERY }),
    });
    const whoamiJson = await whoamiRes.json();
    const customerId = whoamiJson?.data?.customer?.id;
    if (!whoamiRes.ok || !customerId) {
      console.error('[delete-account] whoami failed', whoamiRes.status,
        JSON.stringify(whoamiJson?.errors ?? whoamiJson).slice(0, 300));
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }

    // Step 2: delete exactly that customer via the Admin API.
    const deleteData = await adminGraphQL(DELETE_MUTATION, { id: customerId });
    const userErrors = deleteData?.customerDelete?.userErrors;
    if (userErrors && userErrors.length > 0) {
      console.error('[delete-account] Shopify error:', userErrors);
      return res.status(502).json({ error: 'Shopify error' });
    }

    return res.json({ deletedCustomerId: deleteData.customerDelete.deletedCustomerId });
  } catch (err) {
    console.error('[delete-account]', err);
    return res.status(500).json({ error: 'Delete failed' });
  }
}
