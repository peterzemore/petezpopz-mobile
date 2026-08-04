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

// ── Cancelling a redemption ──────────────────────────────────────────────────

// No server-side search filter anywhere in this file.
//
// codeDiscountNodes' `query:` argument does not match these records — neither
// `code:12345` nor `title:'Loyalty redemption'` returns anything, because the
// titles contain an em dash and parentheses. It fails silently by returning an
// empty list, which reads as "that code doesn't exist" rather than "the query
// is wrong" — it cost a customer-facing bug once already. Scan and filter in
// JS instead; the code volume here is small.
const SCAN_CODES = `
  query ScanCodes($cursor: String) {
    codeDiscountNodes(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        codeDiscount {
          __typename
          ... on DiscountCodeBasic {
            title
            status
            asyncUsageCount
            endsAt
            codes(first: 5) { nodes { code } }
          }
        }
      }
    }
  }
`;

const REDEMPTION_TITLE_RE =
  /Loyalty redemption — (\d+) pts \((gid:\/\/shopify\/Customer\/\d+)\)/;

/** Every loyalty code on the store, parsed. Shared by listing and cancelling. */
async function scanRedemptionCodes() {
  const out = [];
  let cursor = null;
  let hasNext = true;
  let pages = 0;
  while (hasNext && pages < 6) {
    const page = (await adminGraphQL(SCAN_CODES, { cursor }))?.codeDiscountNodes;
    pages += 1;
    for (const n of page?.nodes ?? []) {
      const d = n.codeDiscount ?? {};
      const m = REDEMPTION_TITLE_RE.exec(d.title ?? '');
      if (!m) continue;
      out.push({
        id: n.id,
        code: d.codes?.nodes?.[0]?.code ?? null,
        points: Number(m[1]),
        ownerId: m[2],
        used: (d.asyncUsageCount ?? 0) > 0,
        endsAt: d.endsAt ? String(d.endsAt).slice(0, 10) : null,
      });
    }
    hasNext = page?.pageInfo?.hasNextPage ?? false;
    cursor = page?.pageInfo?.endCursor ?? null;
  }
  return out;
}

const DELETE_CODE = `
  mutation DeleteCode($id: ID!) {
    discountCodeDelete(id: $id) {
      deletedCodeDiscountId
      userErrors { field message }
    }
  }
`;

/**
 * Cancels a reward code and credits the points back.
 *
 * Removing a code from the cart is NOT this. The code survives that and stays
 * valid for 30 days, so refunding on cart-removal alone would let someone
 * redeem, remove, get refunded, and repeat — accumulating live codes for free.
 * A refund therefore has to delete the code, making it a real cancellation.
 *
 * Three things are checked before any points move:
 *   - the code is one of ours (the title records which redemption it was)
 *   - it belongs to this customer (the title records who)
 *   - it has never been used (a spent code can't be handed back)
 */
export async function cancelRedemption(customerId, code) {
  const clean = String(code ?? '').trim();
  if (!clean) throw new RedeemError('No code provided', 400);

  const all = await scanRedemptionCodes();
  const match = all.find(
    (c) => String(c.code ?? '').toLowerCase() === clean.toLowerCase(),
  );
  if (!match) throw new RedeemError('That code was not found', 404);

  if (match.ownerId !== customerId) {
    // Deliberately identical to "not found": confirming a code exists but
    // belongs to someone else would let a caller probe for other people's.
    throw new RedeemError('That code was not found', 404);
  }

  if (match.used) {
    throw new RedeemError('That code has already been used on an order', 400);
  }

  // Delete first. If crediting then failed, the customer is short points but
  // holds no live code — recoverable by hand. The reverse would hand out
  // points while the code still worked.
  const del = await adminGraphQL(DELETE_CODE, { id: match.id });
  const delErrs = del?.discountCodeDelete?.userErrors ?? [];
  if (delErrs.length) throw new RedeemError(delErrs[0].message, 500);

  const balance = await getPointsBalance(customerId);
  const newBalance = balance + match.points;

  const set = await adminGraphQL(SET_POINTS_MUTATION, {
    metafields: [
      {
        ownerId: customerId,
        namespace: 'custom',
        key: 'loyalty_points',
        type: 'number_integer',
        value: String(newBalance),
      },
    ],
  });
  const setErrs = set?.metafieldsSet?.userErrors ?? [];
  if (setErrs.length) throw new RedeemError(setErrs[0].message, 500);

  return { cancelled: clean, pointsReturned: match.points, newBalance };
}

/**
 * A customer's unused reward codes.
 *
 * Needed because removing a code at Shopify's checkout doesn't cancel it —
 * that happens on Shopify's side and fires no webhook we can act on. Without
 * this list a customer who backed out has spent points, holds a code they
 * can't see, and no way to convert it back.
 */
export async function listCustomerCodes(customerId) {
  const all = await scanRedemptionCodes();
  return all
    .filter((c) => c.ownerId === customerId && !c.used)
    .map((c) => ({
      code: c.code,
      points: c.points,
      discountUSD: TIERS[c.points] ?? null,
      expiresAt: c.endsAt,
    }));
}
