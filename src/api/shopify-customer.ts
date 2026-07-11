// PetezPopz — Customer Account API: PKCE OAuth + Token Management
//
// This file handles ONLY the OAuth lifecycle:
//   useShopifyAuth()         → PKCE auth request hook
//   exchangeCodeForTokens()  → authorization code → access + refresh tokens
//   refreshAccessToken()     → silent refresh
//   saveTokens / getStoredTokens / clearTokens / isTokenExpired
//
// The GraphQL transport (customerFetch) lives in shopify-storefront.ts.
// The client secret is NOT present — PKCE is the correct flow for public clients.
// There are no static storefront tokens anywhere in this file.

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

// ── Config ─────────────────────────────────────────────────────────────────────

const CLIENT_ID =
  process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID ?? '';
const STORE_DOMAIN =
  process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN ?? 'gemcitytoyco.myshopify.com';
const REDIRECT_URI =
  process.env.EXPO_PUBLIC_SHOPIFY_OAUTH_REDIRECT_URI ?? 'petezpopz://auth/callback';
const AUTH_BASE =
  process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_API_URL ??
  `https://shopify.com/authentication/${STORE_DOMAIN}/oauth`;

// ── PKCE Discovery Document (2026-04) ─────────────────────────────────────────

const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${AUTH_BASE}/authorize`,
  tokenEndpoint:         `${AUTH_BASE}/token`,
  revocationEndpoint:    `${AUTH_BASE}/revoke`,
};

// ── Secure token storage ───────────────────────────────────────────────────────

const KEYS = {
  ACCESS:  'ppz_access_token',
  REFRESH: 'ppz_refresh_token',
  EXPIRY:  'ppz_token_expiry',
} as const;

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): Promise<void> {
  const expiry = Date.now() + expiresIn * 1000;
  await Promise.all([
    SecureStore.setItemAsync(KEYS.ACCESS,  accessToken),
    SecureStore.setItemAsync(KEYS.REFRESH, refreshToken),
    SecureStore.setItemAsync(KEYS.EXPIRY,  String(expiry)),
  ]);
}

export async function getStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}> {
  const [accessToken, refreshToken, expiryStr] = await Promise.all([
    SecureStore.getItemAsync(KEYS.ACCESS),
    SecureStore.getItemAsync(KEYS.REFRESH),
    SecureStore.getItemAsync(KEYS.EXPIRY),
  ]);
  return {
    accessToken,
    refreshToken,
    expiresAt: expiryStr ? Number(expiryStr) : null,
  };
}

export async function clearTokens(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
}

export function isTokenExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - 60_000; // 60 s pre-expiry buffer
}

// ── OAuth 2.0 PKCE Hook ────────────────────────────────────────────────────────
// Scopes: openid + email for identity, customer-account-api:full for all
// customer data access (orders, addresses, metafields via appMetafields API).

export function useShopifyAuth() {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId:            CLIENT_ID,
      redirectUri:         REDIRECT_URI,
      scopes:              ['openid', 'email', 'customer-account-api:full'],
      responseType:        AuthSession.ResponseType.Code,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    },
    DISCOVERY,
  );
  return { request, response, promptAsync };
}

// ── Authorization code → tokens ────────────────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    code,
    code_verifier: codeVerifier,
  });

  const res = await fetch(DISCOVERY.tokenEndpoint!, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PKCE token exchange failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return {
    accessToken:  json.access_token,
    refreshToken: json.refresh_token,
    expiresIn:    json.expires_in ?? 3600,
  };
}

// ── Silent refresh ─────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     CLIENT_ID,
    refresh_token: refreshToken,
  });

  const res = await fetch(DISCOVERY.tokenEndpoint!, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    throw new Error(`PKCE token refresh failed (${res.status})`);
  }

  const json = await res.json();
  return {
    accessToken:  json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresIn:    json.expires_in ?? 3600,
  };
}
