import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

// ── Config ─────────────────────────────────────────────────────────────────────
const CLIENT_ID = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID ?? '';

// Base URL for the Customer Account API's OAuth endpoints, e.g.
// https://account.petezpopz.com/authentication/oauth
const OAUTH_BASE = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_API_URL ?? '';

// Must exactly match the "Callback URI" configured in the Customer Account API
// credentials (a custom scheme, not a web URL) — e.g. shop.55261102144.app://callback
const REDIRECT_URI = process.env.EXPO_PUBLIC_SHOPIFY_OAUTH_REDIRECT_URI ?? '';

const LOGOUT_ENDPOINT = process.env.EXPO_PUBLIC_SHOPIFY_LOGOUT_ENDPOINT ?? '';

const DELETE_ACCOUNT_URL = process.env.EXPO_PUBLIC_DELETE_ACCOUNT_URL ?? '';
const REDEEM_POINTS_URL = process.env.EXPO_PUBLIC_REDEEM_POINTS_URL ?? '';
const SUBSCRIBE_URL = process.env.EXPO_PUBLIC_SUBSCRIBE_MARKETING_URL ?? '';
const SAVE_BIRTHDAY_URL = process.env.EXPO_PUBLIC_SAVE_BIRTHDAY_URL ?? '';

// The Customer Account API endpoints are fixed and provided directly by the
// Shopify admin (Headless app → Customer Account API credentials), so we build
// the discovery document manually rather than relying on autodiscovery against
// the storefront domain, which does not serve this app's OAuth metadata.
const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${OAUTH_BASE}/authorize`,
  tokenEndpoint: `${OAUTH_BASE}/token`,
  revocationEndpoint: LOGOUT_ENDPOINT || undefined,
};

// ── Secure token storage ───────────────────────────────────────────────────────

const KEYS = {
  ACCESS: 'ppz_access_token',
  REFRESH: 'ppz_refresh_token',
  EXPIRY: 'ppz_token_expiry',
  PKCE_VERIFIER: 'ppz_pkce_verifier',
} as const;

// expo-auth-session's redirect completion is unreliable in standalone Android
// builds (works in a dev client, breaks in a real APK) — the deep link arrives
// but WebBrowser's auth-session interception doesn't catch it, so it falls
// through to normal app routing instead. The PKCE code_verifier otherwise only
// lives in-memory on the AuthRequest object tied to the screen that started
// the flow, so it must be persisted here for a fallback route (app/callback.tsx)
// to be able to complete the token exchange when that happens.
export async function savePendingVerifier(verifier: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.PKCE_VERIFIER, verifier);
}

export async function getAndClearPendingVerifier(): Promise<string | null> {
  const verifier = await SecureStore.getItemAsync(KEYS.PKCE_VERIFIER);
  await SecureStore.deleteItemAsync(KEYS.PKCE_VERIFIER);
  return verifier;
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): Promise<void> {
  const expiry = Date.now() + expiresIn * 1000;
  await Promise.all([
    SecureStore.setItemAsync(KEYS.ACCESS, accessToken),
    SecureStore.setItemAsync(KEYS.REFRESH, refreshToken),
    SecureStore.setItemAsync(KEYS.EXPIRY, String(expiry)),
  ]);
}

export async function getStoredTokens() {
  const [accessToken, refreshToken, expiryStr] = await Promise.all([
    SecureStore.getItemAsync(KEYS.ACCESS),
    SecureStore.getItemAsync(KEYS.REFRESH),
    SecureStore.getItemAsync(KEYS.EXPIRY),
  ]);
  return { accessToken, refreshToken, expiresAt: expiryStr ? Number(expiryStr) : null };
}

export async function clearTokens(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
}

// Treat tokens as expired slightly early to avoid using one that dies mid-request
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

export function isTokenExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return true;
  return Date.now() + EXPIRY_SAFETY_MARGIN_MS >= expiresAt;
}

// ── OAuth 2.0 PKCE Hook ────────────────────────────────────────────────────────

export function useShopifyAuth() {
  // If this config is missing (e.g. a build's environment variables weren't
  // set), expo-auth-session silently falls back to auto-generating its own
  // redirect URI from the app's first registered URL scheme — which doesn't
  // match what's registered with Shopify. That produces a confusing
  // "Unmatched Route" 404 *after* the user has already gone through Shopify's
  // sign-in flow, instead of failing clearly up front. Fail loudly instead.
  if (!CLIENT_ID || !REDIRECT_URI || !OAUTH_BASE) {
    throw new Error(
      'Shopify OAuth is misconfigured: missing EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID, ' +
      'EXPO_PUBLIC_SHOPIFY_OAUTH_REDIRECT_URI, or EXPO_PUBLIC_SHOPIFY_CUSTOMER_API_URL. ' +
      'Check this build\'s environment variables.',
    );
  }

  return AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scopes: ['openid', 'email', 'customer-account-api:full'],
      responseType: AuthSession.ResponseType.Code,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    },
    DISCOVERY,
  );
}
// ── Authorization code → tokens ────────────────────────────────────────────────

export async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: codeVerifier,
  });

  const res = await fetch(DISCOVERY.tokenEndpoint!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`PKCE token exchange failed: ${await res.text()}`);

  const json = await res.json();

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 3600,
  };
}

// ── Refresh access token ───────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  });

  const res = await fetch(DISCOVERY.tokenEndpoint!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);

  const json = await res.json();

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresIn: json.expires_in ?? 3600,
  };
}

// ── Delete account (via barcode-proxy's delete-account endpoint) ─────────────
// The Customer Account API access token can't delete the account itself —
// only the Admin API can, and that token must never live in the mobile app.
// This calls the server-side proxy, which verifies the token belongs to the
// caller before deleting. See barcode-proxy/api/delete-account.js.

export async function deleteAccountFromShopify(accessToken: string): Promise<void> {
  if (!DELETE_ACCOUNT_URL) {
    throw new Error(
      'Account deletion is misconfigured: missing EXPO_PUBLIC_DELETE_ACCOUNT_URL. ' +
      'Check this build\'s environment variables.',
    );
  }

  const res = await fetch(DELETE_ACCOUNT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Account deletion failed: ${await res.text()}`);
}

// ── Redeem loyalty points for a discount code ────────────────────────────────

export interface RedemptionResult {
  /** Unique, single-use code locked to this customer. */
  code: string;
  discountUSD: number;
  pointsSpent: number;
  /** Authoritative balance after the debit, straight from Shopify. */
  newBalance: number;
  expiresAt: string;
}

/**
 * Spends points server-side and returns a freshly minted discount code.
 *
 * The balance check and the debit both happen on the server — the app can't
 * be trusted with either, since it runs on the customer's phone. See
 * barcode-proxy/api/redeem-points.js for why the old shared REWARDS* codes
 * were replaced.
 */
export async function redeemPointsForCode(
  accessToken: string,
  points: number,
): Promise<RedemptionResult> {
  if (!REDEEM_POINTS_URL) {
    throw new Error(
      'Rewards redemption is misconfigured: missing EXPO_PUBLIC_REDEEM_POINTS_URL. ' +
      'Check this build\'s environment variables.',
    );
  }

  const res = await fetch(REDEEM_POINTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ points }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Redemption failed');
  return body as RedemptionResult;
}

// ── Sign out (revoke session at the Customer Account API) ────────────────────

export async function logoutFromShopify(): Promise<void> {
  if (!LOGOUT_ENDPOINT || !CLIENT_ID) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(`${LOGOUT_ENDPOINT}?id_token_hint=${encodeURIComponent(CLIENT_ID)}`, {
      method: 'GET',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch {
    // Non-critical (including a timeout) — local tokens are cleared regardless
  }
}

// ── Marketing opt-in (unlocks the free Silver tier) ──────────────────────────

/**
 * Opts the signed-in customer into email or SMS marketing.
 *
 * Consent can only be written with the Admin API, so this goes through the
 * proxy, which resolves the customer from their own token. It does not set the
 * membership tier — Shopify fires customers/update, and the membership
 * service promotes them to Silver. Keeping that decision in one place stops
 * the app and the service disagreeing about who qualifies.
 */
export async function subscribeToMarketing(
  accessToken: string,
  channel: 'email' | 'sms' = 'email',
): Promise<{ ok: boolean; channel: string; state?: string }> {
  if (!SUBSCRIBE_URL) {
    throw new Error(
      'Subscribing is misconfigured: missing EXPO_PUBLIC_SUBSCRIBE_MARKETING_URL. ' +
      'Check this build\'s environment variables.',
    );
  }

  const res = await fetch(SUBSCRIBE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Could not subscribe');
  return body;
}

// ── Birthday (Platinum members get a gift code on the day) ───────────────────

/**
 * Stores the customer's birthday as month and day.
 *
 * Only MM-DD is sent — the year isn't needed to send a birthday gift, and
 * holding a full date of birth is more personal data than the feature
 * justifies. Written server-side because metafields need the Admin API.
 */
export async function saveBirthday(
  accessToken: string,
  month: number,
  day: number,
): Promise<{ ok: boolean; birthday: string }> {
  if (!SAVE_BIRTHDAY_URL) {
    throw new Error(
      'Saving a birthday is misconfigured: missing EXPO_PUBLIC_SAVE_BIRTHDAY_URL. ' +
      'Check this build\'s environment variables.',
    );
  }

  const res = await fetch(SAVE_BIRTHDAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ month, day }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Could not save birthday');
  return body;
}
