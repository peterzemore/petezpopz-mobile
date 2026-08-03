// Vercel serverless function — stores a customer's birthday.
//
// Shopify has no native birthday field, so it lives in custom.birthday. Only
// month and day are kept: the year isn't needed to send a birthday gift, and
// storing a full date of birth is more personal data than this feature
// justifies holding.
//
// Written with the Admin API (metafields can't be set by the customer's own
// token), so this follows the same pattern as the other endpoints here: take
// the customer's access token, resolve *their* id from it, write only that
// record.
//
// Required Vercel environment variables:
//   SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET,
//   SHOPIFY_CUSTOMER_GRAPHQL_URL

import { adminGraphQL } from '../lib/shopify-admin.js';

const WHOAMI_QUERY = `query { customer { id } }`;

const SET_BIRTHDAY = `
  mutation SetBirthday($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key value }
      userErrors { field message }
    }
  }
`;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

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

  const month = Number(req.body?.month);
  const day = Number(req.body?.day);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'month must be 1-12' });
  }
  // Feb 29 is allowed; the cron treats it as Feb 28 in non-leap years so those
  // customers still get a gift every year.
  if (!Number.isInteger(day) || day < 1 || day > DAYS_IN_MONTH[month - 1]) {
    return res.status(400).json({ error: `day must be 1-${DAYS_IN_MONTH[month - 1]} for that month` });
  }

  try {
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

    // Stored as MM-DD so the cron can match on a plain string compare.
    const value = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const out = await adminGraphQL(SET_BIRTHDAY, {
      metafields: [
        {
          ownerId: customerId,
          namespace: 'custom',
          key: 'birthday',
          type: 'single_line_text_field',
          value,
        },
      ],
    });

    const errs = out?.metafieldsSet?.userErrors ?? [];
    if (errs.length) return res.status(400).json({ error: errs[0].message });

    return res.status(200).json({ ok: true, birthday: value });
  } catch (err) {
    console.error('[save-birthday]', err);
    return res.status(500).json({ error: err.message || 'Could not save birthday' });
  }
}
