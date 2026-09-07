// Vercel serverless function — opts a customer into email marketing.
//
// Silver membership is earned by subscribing to email or SMS, so the app needs
// a way to let someone opt in without leaving for the website. Marketing
// consent can only be written with the Admin API, which must never live in the
// app — so this takes the customer's own access token, resolves *their* id
// from it, and updates exactly that record.
//
// Consent is recorded as SINGLE_OPT_IN with the current timestamp, which is
// what an explicit in-app "subscribe" tap actually represents. Nothing here
// subscribes anyone implicitly.
//
// Once consent lands, Shopify fires customers/update, and the membership
// service's consent webhook promotes them to Silver. This endpoint doesn't
// write the tier itself — one system owns that decision.
//
// Required Vercel environment variables:
//   SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET,
//   SHOPIFY_CUSTOMER_GRAPHQL_URL

import { adminGraphQL } from '../lib/shopify-admin.js';
import { customerAuthHeaders } from '../lib/customer-account.js';

const WHOAMI_QUERY = `query { customer { id } }`;

const EMAIL_CONSENT = `
  mutation EmailConsent($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer { id emailMarketingConsent { marketingState } }
      userErrors { field message }
    }
  }
`;

const SMS_CONSENT = `
  mutation SmsConsent($input: CustomerSmsMarketingConsentUpdateInput!) {
    customerSmsMarketingConsentUpdate(input: $input) {
      customer { id smsMarketingConsent { marketingState } }
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

  const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'Missing bearer token' });

  const customerGraphqlUrl = process.env.SHOPIFY_CUSTOMER_GRAPHQL_URL;
  if (!process.env.SHOPIFY_STORE || !customerGraphqlUrl) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  // "email" (default) or "sms". SMS also needs a phone number on the record,
  // so the app only offers it when one exists.
  const channel = String(req.body?.channel ?? 'email').toLowerCase();
  if (channel !== 'email' && channel !== 'sms') {
    return res.status(400).json({ error: 'channel must be "email" or "sms"' });
  }

  try {
    // Resolve the caller from their own token — never take an id from the body.
    const whoami = await fetch(customerGraphqlUrl, {
      method: 'POST',
      headers: customerAuthHeaders(accessToken),
      body: JSON.stringify({ query: WHOAMI_QUERY }),
    }).then((r) => r.json());

    const customerId = whoami?.data?.customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }

    const consentUpdatedAt = new Date().toISOString();

    if (channel === 'sms') {
      const out = await adminGraphQL(SMS_CONSENT, {
        input: {
          customerId,
          smsMarketingConsent: {
            marketingState: 'SUBSCRIBED',
            marketingOptInLevel: 'SINGLE_OPT_IN',
            consentUpdatedAt,
          },
        },
      });
      const errs = out?.customerSmsMarketingConsentUpdate?.userErrors ?? [];
      if (errs.length) return res.status(400).json({ error: errs[0].message });
      return res.status(200).json({
        ok: true,
        channel: 'sms',
        state: out.customerSmsMarketingConsentUpdate.customer?.smsMarketingConsent?.marketingState,
      });
    }

    const out = await adminGraphQL(EMAIL_CONSENT, {
      input: {
        customerId,
        emailMarketingConsent: {
          marketingState: 'SUBSCRIBED',
          marketingOptInLevel: 'SINGLE_OPT_IN',
          consentUpdatedAt,
        },
      },
    });
    const errs = out?.customerEmailMarketingConsentUpdate?.userErrors ?? [];
    if (errs.length) return res.status(400).json({ error: errs[0].message });

    return res.status(200).json({
      ok: true,
      channel: 'email',
      state: out.customerEmailMarketingConsentUpdate.customer?.emailMarketingConsent?.marketingState,
    });
  } catch (err) {
    console.error('[subscribe-marketing]', err);
    return res.status(500).json({ error: err.message || 'Subscribe failed' });
  }
}
