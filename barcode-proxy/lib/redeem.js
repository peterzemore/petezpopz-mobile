// Loyalty redemption core.
//
// Shared by both surfaces so they can't drift:
//   api/redeem-points.js  — the mobile app, authenticated by the customer's
//                           own Customer Account API token
//   api/app-proxy.js      — the website, authenticated by Shopify's signed
//                           App Proxy request
//
// Both arrive knowing a customer id and nothing else that matters. Everything
// that decides what a redemption costs and is worth lives here, server-side,
// because the caller is either a phone or a browser and neither can be trusted
// to say what 100 points is worth.

import { adminGraphQL } from './shopify-admin.js';

// Authoritative tier table. Deliberately duplicated from the app's
// REDEMPTION_TIERS rather than imported: the client must never be able to
// define what a given number of points is worth.
export const TIERS = {
  100: 5,
  200: 10,
  400: 20,
};

const CODE_TTL_DAYS = 30;

// Five digits, so a customer can read it out at the register and staff can key
// it straight into POS. Safe at this length because every code is locked to one
// customer, single-use, and expires — guessing someone else's gains nothing.
const CODE_MIN = 10000;
const CODE_MAX = 99999;
const MAX_CODE_ATTEMPTS = 8;

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

function randomCode() {
  return String(CODE_MIN + Math.floor(Math.random() * (CODE_MAX - CODE_MIN + 1)));
}

function isDuplicateCodeError(errors) {
  return errors.some((e) => /already|taken|exists|unique/i.test(e.message || ''));
}

/** Thrown for conditions the caller should surface to the customer verbatim. */
export class RedeemError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/**
 * Debits points and mints a unique single-use code for that customer.
 *
 * @param customerId  gid://shopify/Customer/... — must already be verified as
 *                    belonging to the caller. This function trusts it.
 * @param points      100 | 200 | 400
 */
export async function redeemPoints(customerId, points) {
  const discountUSD = TIERS[points];
  if (!discountUSD) {
    throw new RedeemError('Invalid redemption tier', 400, { validTiers: Object.keys(TIERS) });
  }

  // ── Read the authoritative balance ──────────────────────────────────────
  const pointsJson = await adminGraphQL(GET_POINTS_QUERY, { id: customerId });
  const metafield = pointsJson?.customer?.metafield;
  const balance = Number(metafield?.value ?? 0);

  if (!Number.isFinite(balance) || balance < points) {
    throw new RedeemError('Insufficient points', 400, {
      balance: Number.isFinite(balance) ? balance : 0,
      required: points,
    });
  }

  // ── Debit BEFORE minting ────────────────────────────────────────────────
  // Ordering matters. Debit-then-mint can at worst lose a customer points if
  // minting fails (recoverable, and refunded below). Mint-then-debit could
  // hand out a live discount and then fail to charge for it, which isn't.
  const newBalance = balance - points;
  const mfType = metafield?.type || 'number_integer';

  const setJson = await adminGraphQL(SET_POINTS_MUTATION, {
    metafields: [
      {
        ownerId: customerId,
        namespace: 'custom',
        key: 'loyalty_points',
        type: mfType,
        value: String(newBalance),
      },
    ],
  });
  const setErrors = setJson?.metafieldsSet?.userErrors ?? [];
  if (setErrors.length) throw new RedeemError(setErrors[0].message, 500);

  // ── Mint a code locked to this one customer ─────────────────────────────
  const now = new Date();
  const endsAt = new Date(now.getTime() + CODE_TTL_DAYS * 86400_000);
  let code = null;
  let discountErrors = [];

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const candidate = randomCode();
    const out = await adminGraphQL(CREATE_DISCOUNT_MUTATION, {
      discount: {
        title: `Loyalty redemption — ${points} pts (${customerId})`,
        code: candidate,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        customerSelection: { customers: { add: [customerId] } },
        customerGets: {
          value: {
            discountAmount: { amount: discountUSD.toFixed(2), appliesOnEachItem: false },
          },
          items: { all: true },
        },
        appliesOncePerCustomer: true,
        usageLimit: 1,
      },
    });
    discountErrors = out?.discountCodeBasicCreate?.userErrors ?? [];
    if (out?.discountCodeBasicCreate?.codeDiscountNode) { code = candidate; break; }
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
          type: mfType,
          value: String(balance),
        },
      ],
    });
    throw new RedeemError(
      discountErrors[0]?.message || 'Could not create discount code',
      500,
    );
  }

  return {
    code,
    discountUSD,
    pointsSpent: points,
    newBalance,
    expiresAt: endsAt.toISOString(),
  };
}

/** Current balance, for surfaces that render before a redemption. */
export async function getPointsBalance(customerId) {
  const json = await adminGraphQL(GET_POINTS_QUERY, { id: customerId });
  return Number(json?.customer?.metafield?.value ?? 0);
}
