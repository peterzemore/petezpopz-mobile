// Diagnostic — confirms this proxy can reach the Shopify Admin API.
//
// The customer-facing endpoints all validate the caller's token first, so a
// misconfigured Admin credential stays invisible until a real customer tries
// to delete their account or redeem points and gets a 500. This surfaces it
// on demand instead.

import { adminGraphQL, getAccessToken } from '../lib/shopify-admin.js';

// What each endpoint here actually needs.
const REQUIRED_SCOPES = {
  write_customers: 'delete-account, redeem-points (debit loyalty_points)',
  read_customers: 'redeem-points (read balance)',
  write_discounts: 'redeem-points (mint the discount code)',
};

const SCOPES_QUERY = `
  query { currentAppInstallation { accessScopes { handle } } }
`;

export default async function handler(req, res) {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const report = { store: process.env.SHOPIFY_STORE || null, auth: null, scopes: {}, ok: false };

  try {
    await getAccessToken();
    report.auth = process.env.SHOPIFY_ADMIN_TOKEN
      ? 'static SHOPIFY_ADMIN_TOKEN'
      : 'client credentials grant';
  } catch (err) {
    report.auth = `FAILED: ${err.message}`;
    return res.status(500).json(report);
  }

  try {
    const data = await adminGraphQL(SCOPES_QUERY);
    const granted = (data?.currentAppInstallation?.accessScopes ?? []).map((s) => s.handle);
    const missing = Object.keys(REQUIRED_SCOPES).filter((s) => !granted.includes(s));
    report.scopes = {
      required: Object.keys(REQUIRED_SCOPES),
      missing,
      missingImpact: missing.map((s) => `${s} — breaks: ${REQUIRED_SCOPES[s]}`),
      grantedCount: granted.length,
    };
    report.customerApiConfigured = Boolean(process.env.SHOPIFY_CUSTOMER_GRAPHQL_URL);
    report.ok = missing.length === 0 && report.customerApiConfigured;
  } catch (err) {
    report.scopes = { error: err.message };
    return res.status(500).json(report);
  }

  return res.status(200).json(report);
}
