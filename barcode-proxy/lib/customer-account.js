// Headers for calling the Shopify Customer Account API with a customer's own
// access token. The API wants the raw shcat_ token as the ENTIRE Authorization
// value (no "Bearer " prefix — sending one makes Shopify report "missing prefix
// shcat_" even though the token has it), plus the store domain and the Customer
// Account API client id. This mirrors customerHeaders() in the app
// (src/api/shopify-storefront.ts); keep the two in step.
export function customerAuthHeaders(accessToken) {
  const token = accessToken.startsWith('shcat_') ? accessToken : `shcat_${accessToken}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: token,
  };
  if (process.env.SHOPIFY_STORE) headers['Shopify-Store-Domain'] = process.env.SHOPIFY_STORE;
  if (process.env.SHOPIFY_CUSTOMER_CLIENT_ID) {
    headers['Shopify-Client-Id'] = process.env.SHOPIFY_CUSTOMER_CLIENT_ID;
  }
  return headers;
}
