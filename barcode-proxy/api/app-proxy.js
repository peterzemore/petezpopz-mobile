// Shopify App Proxy — lets the storefront redeem points without leaving the site.
//
// THE PROBLEM THIS SOLVES
// Minting a discount code needs the Admin API, which a Liquid theme can't call
// and a browser must never hold credentials for. The first version dodged that
// by telling web customers to go and use the mobile app, which is a terrible
// thing to say to someone who already has items in their cart.
//
// HOW IT WORKS
// Shopify forwards storefront requests from /apps/<subpath> to this endpoint,
// appending logged_in_customer_id and signing the whole query string with the
// app's client secret. Verifying that signature proves both that the request
// came from Shopify and which customer is signed in — so the browser never
// sends a customer id we'd have to trust.
//
// Configure in the Dev Dashboard: App proxy → subpath prefix "apps",
// subpath "rewards", URL https://barcode-proxy-sigma.vercel.app/api/app-proxy
//
//   GET  /apps/rewards                     → balance and redemption tiers
//   POST /apps/rewards?points=100          → redeem, returns a code
//   POST /apps/rewards?cancel=<code>       → destroy the code, return the points

import crypto from 'node:crypto';
import { redeemPoints, cancelRedemption, getPointsBalance, listCustomerCodes, TIERS, RedeemError } from '../lib/redeem.js';

/**
 * Verify Shopify's App Proxy signature.
 *
 * Every query param except `signature` is sorted, joined as key=value with no
 * separator, and HMAC-SHA256'd with the client secret. Without this check the
 * endpoint would accept a customer id from anyone who found the URL.
 */
export function verifyProxySignature(query, secret) {
  const { signature, ...rest } = query ?? {};
  if (!signature || !secret) return false;

  const message = Object.keys(rest)
    .sort()
    .map((k) => {
      const v = Array.isArray(rest[k]) ? rest[k].join(',') : rest[k];
      return `${k}=${v}`;
    })
    .join('');

  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const a = Buffer.from(digest);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  // Responses are rendered by the storefront's own JS, so JSON is fine, but
  // Shopify proxies this under the shop's domain — no CORS needed.
  res.setHeader('Content-Type', 'application/json');

  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  if (!verifyProxySignature(req.query, secret)) {
    return res.status(401).json({ error: 'Invalid proxy signature' });
  }

  // Shopify only sets this when a customer is signed in. Absent means logged
  // out, which is a prompt to sign in rather than an error.
  const rawId = req.query?.logged_in_customer_id;
  if (!rawId) {
    return res.status(401).json({ error: 'not_signed_in' });
  }
  const customerId = `gid://shopify/Customer/${rawId}`;

  try {
    if (req.method === 'GET') {
      const [balance, codes] = await Promise.all([
        getPointsBalance(customerId),
        listCustomerCodes(customerId),
      ]);
      return res.status(200).json({
        balance,
        codes,
        tiers: Object.entries(TIERS).map(([points, discountUSD]) => ({
          points: Number(points),
          discountUSD,
          affordable: balance >= Number(points),
        })),
      });
    }

    if (req.method === 'POST') {
      // Cancelling deletes the code as well as returning the points — see
      // cancelRedemption. Refunding without deleting would let someone redeem,
      // cancel, and keep a live code.
      const cancel = req.query?.cancel ?? req.body?.cancel;
      if (cancel) {
        const result = await cancelRedemption(customerId, cancel);
        return res.status(200).json({ ok: true, ...result });
      }

      const points = Number(req.query?.points ?? req.body?.points);
      const result = await redeemPoints(customerId, points);
      return res.status(200).json({ ok: true, ...result });
    }

    return res.status(405).json({ error: 'GET or POST only' });
  } catch (err) {
    if (err instanceof RedeemError) {
      return res.status(err.status).json({ error: err.message, ...err.extra });
    }
    console.error('[app-proxy]', err);
    return res.status(500).json({ error: 'Redemption failed' });
  }
}
