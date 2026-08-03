// Shared Shopify Admin API access for this proxy's endpoints.
//
// AUTH: client credentials grant, not a static token.
//
// Admin-created custom apps were deprecated on 2026-01-01 and no longer issue
// a long-lived shpat_ token. Apps hold a client id + secret and exchange them
// for a token that expires after 24 hours, so there is nothing stable to store
// in an env var.
//
// This matters retroactively: delete-account and redeem-points were written
// against a static SHOPIFY_ADMIN_TOKEN that never had customer scopes, so
// neither has ever actually worked against the live store.
//
// Docs: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant

const ADMIN_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2026-07';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

let cachedToken = null;
let cachedExpiryMs = 0;

/**
 * Current Admin API access token, exchanging credentials when needed.
 * A legacy SHOPIFY_ADMIN_TOKEN still wins if one is set.
 */
export async function getAccessToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;

  if (cachedToken && Date.now() < cachedExpiryMs - EXPIRY_BUFFER_MS) {
    return cachedToken;
  }

  const { SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env;
  if (!SHOPIFY_STORE || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error('Missing SHOPIFY_STORE / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET');
  }

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
    }),
  });

  // Text first: Shopify returns HTML for some rejections, and .json() throwing
  // would hide the actual reason (this cost real debugging time once already).
  const raw = await res.text();
  let json = {};
  try {
    json = JSON.parse(raw);
  } catch {
    /* reported via raw below */
  }

  if (!res.ok || !json.access_token) {
    const detail = json.error_description || json.error || raw.slice(0, 200) || 'empty';
    throw new Error(`Token exchange failed (${res.status}): ${detail}`);
  }

  cachedToken = json.access_token;
  cachedExpiryMs = Date.now() + Number(json.expires_in ?? 86399) * 1000;
  return cachedToken;
}

/** POST a GraphQL query to the Admin API, throwing on GraphQL errors. */
export async function adminGraphQL(query, variables = {}) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const json = await res.json();
  if (json.errors) throw new Error(`Admin API: ${JSON.stringify(json.errors)}`);
  return json.data;
}
