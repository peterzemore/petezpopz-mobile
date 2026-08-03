// Vercel serverless function — redeems loyalty points for a discount code.
// Deploy alongside delete-account.js / barcode-lookup.js (same project).
//
// WHY THIS EXISTS
// The app used to ship three static codes (REWARDS100/200/400) and simply
// applied them at checkout. Verified against the live store on 2026-08-02:
// those codes worked for an anonymous shopper with zero points, repeatedly,
// and the app never deducted a balance. Any shared code is only as strong as
// its Shopify-side restrictions, because the "you have enough points" check
// lived in the app — on the customer's own phone.
//
// So redemption happens here instead: the caller's balance is verified and
// debited server-side, and the code minted is unique, single-use, and locked
// to that one customer. A leaked code is then worthless to anyone else.
//
// Required Vercel environment variables (same project as delete-account.js):
//   SHOPIFY_STORE                  → your-store.myshopify.com
//   SHOPIFY_CLIENT_ID              → Dev Dashboard app client id
//   SHOPIFY_CLIENT_SECRET          → Dev Dashboard app client secret
//                                    (app needs write_discounts + write_customers)
//   SHOPIFY_CUSTOMER_GRAPHQL_URL   → https://account.yourdomain.com/customer/api/2026-07/graphql

import { adminGraphQL } from '../lib/shopify-admin.js';

// Authoritative tier table. Deliberately duplicated from the app's
// REDEMPTION_TIERS rather than imported: the client must never be able to
// define what a given number of points is worth.
const TIERS = {
  100: 5,
  200: 10,
  400: 20,
};

const CODE_TTL_DAYS = 30;

const WHOAMI_QUERY = `query { customer { id } }`;

const GET_POINTS_QUERY = `
  query GetPoints($id: ID!) {
    customer(id: $id) {
      metafield(namespace: "custom", key: "loyalty_points") { value type }
    }
  }
`;

const SET_POINTS_MUTATION = `
  mutation SetPoints($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key value }
      userErrors { field message }
    }
  }
`;

const CREATE_DISCOUNT_MUTATION = `
  mutation CreateDiscount($discount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $discount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }
`;

// Five digits, so a customer can read it out at the register and staff can
// key it straight into POS. Digits only — no letters to mishear over a counter.
//
// A short code is safe here specifically because every code is locked to one
// customer via customerSelection, single-use, and expires in 30 days. Guessing
// someone else's code gains nothing: it won't apply to anyone but them.
const CODE_MIN = 10000;
const CODE_MAX = 99999;

// 90k possible codes against a small pool of live ones, but collisions still
// happen (birthday problem), and Shopify rejects a duplicate code outright.
// Retrying with a fresh number is cheaper than widening the format.
const MAX_CODE_ATTEMPTS = 8;

function randomCode() {
  return String(CODE_MIN + Math.floor(Math.random() * (CODE_MAX - CODE_MIN + 1)));
}

/** True when Shopify rejected the mutation because the code already exists. */
function isDuplicateCodeError(errors) {
  return errors.some((e) => /already|taken|exists|unique/i.test(e.message || ''));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'Missing bearer token' });

  // Admin credentials are resolved inside adminGraphQL via client credentials.
  const customerGraphqlUrl = process.env.SHOPIFY_CUSTOMER_GRAPHQL_URL;
  if (!process.env.SHOPIFY_STORE || !customerGraphqlUrl) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const points = Number(req.body?.points);
  const discountUSD = TIERS[points];
  if (!discountUSD) {
    return res.status(400).json({ error: 'Invalid redemption tier' });
  }

  try {
    // ── Step 1: identify the caller from their own token ─────────────────
    // Never accept a customer id from the request body — that would let any
    // caller spend anyone else's points.
    const whoamiJson = await fetch(customerGraphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: WHOAMI_QUERY }),
    }).then((r) => r.json());

    const customerId = whoamiJson?.data?.customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }

    // ── Step 2: read the authoritative balance from Shopify ──────────────
    const pointsJson = await adminGraphQL(GET_POINTS_QUERY, {
      id: customerId,
    });
    const metafield = pointsJson?.customer?.metafield;
    const balance = Number(metafield?.value ?? 0);

    if (!Number.isFinite(balance) || balance < points) {
      return res.status(400).json({
        error: 'Insufficient points',
        balance: Number.isFinite(balance) ? balance : 0,
        required: points,
      });
    }

    // ── Step 3: debit BEFORE minting the code ────────────────────────────
    // Ordering matters. Debit-then-mint can at worst lose a customer points
    // if step 4 fails (recoverable, and we refund below). Mint-then-debit
    // could hand out a live discount and then fail to charge for it, which
    // is not recoverable.
    const newBalance = balance - points;
    const setJson = await adminGraphQL(SET_POINTS_MUTATION, {
      metafields: [
        {
          ownerId: customerId,
          namespace: 'custom',
          key: 'loyalty_points',
          type: metafield?.type || 'number_integer',
          value: String(newBalance),
        },
      ],
    });
    const setErrors = setJson?.metafieldsSet?.userErrors ?? [];
    if (setErrors.length) {
      return res.status(500).json({ error: setErrors[0].message });
    }

    // ── Step 4: mint a unique code locked to this one customer ───────────
    const now = new Date();
    const endsAt = new Date(now.getTime() + CODE_TTL_DAYS * 86400_000);

    let code = null;
    let discountErrors = [];
    let discountJson = null;

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const candidate = randomCode();
      discountJson = await adminGraphQL(CREATE_DISCOUNT_MUTATION, {
        discount: {
          title: `Loyalty redemption — ${points} pts (${customerId})`,
          code: candidate,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
          // Locked to the redeeming customer, so a leaked or guessed code is
          // useless to anyone else — the failure mode the old shared codes had,
          // and what makes a 5-digit code acceptable.
          customerSelection: { customers: { add: [customerId] } },
          customerGets: {
            value: {
              discountAmount: {
                amount: discountUSD.toFixed(2),
                appliesOnEachItem: false,
              },
            },
            items: { all: true },
          },
          appliesOncePerCustomer: true,
          usageLimit: 1,
        },
      });

      discountErrors = discountJson?.discountCodeBasicCreate?.userErrors ?? [];
      if (discountJson?.discountCodeBasicCreate?.codeDiscountNode) {
        code = candidate;
        break;
      }
      // Anything other than a collision is a real failure — stop retrying.
      if (!isDuplicateCodeError(discountErrors)) break;
    }

    if (!code) {
      // Refund the debit so a failed mint never silently costs the customer.
      await adminGraphQL(SET_POINTS_MUTATION, {
        metafields: [
          {
            ownerId: customerId,
            namespace: 'custom',
            key: 'loyalty_points',
            type: metafield?.type || 'number_integer',
            value: String(balance),
          },
        ],
      });
      return res.status(500).json({
        error: discountErrors[0]?.message || 'Could not create discount code',
      });
    }

    return res.status(200).json({
      code,
      discountUSD,
      pointsSpent: points,
      newBalance,
      expiresAt: endsAt.toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Redemption failed' });
  }
}
