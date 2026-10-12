const logger = require('../../logger');

// OAuth2 endpoints live on the same host as the API (sandbox.zeevou.com).
// Verified: POST {base}/oauth2-token returns Bearer JWT (expires_in 1209600 = 14 days).
// hub.zeevou.com is the PRODUCTION host — sandbox creds are rejected there (401 invalid_client).
const OAUTH_BASE =
  process.env.ZEEVOU_BASE_URL ||
  process.env.ZEEVOU_SANDBOX_URL ||
  'https://sandbox.zeevou.com';
const TOKEN_URL = OAUTH_BASE + '/oauth2-token';
const AUTHORIZE_URL = OAUTH_BASE + '/oauth2-token/authorize';

// In-memory token store (per task: process memory, not DB).
let tokenState = null; // { access_token, refresh_token|null, expires_at, grant_type, client_id, client_secret }

function storeToken(json, grantType, clientId, clientSecret) {
  tokenState = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || null,
    expires_at: Date.now() + (json.expires_in || 0) * 1000,
    grant_type: grantType,
    client_id: clientId,
    client_secret: clientSecret,
  };
  logger.info(
    { grant_type: grantType, expires_in: json.expires_in },
    'zeevou oauth token obtained'
  );
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      'Zeevou OAuth token request failed: ' + res.status + ' ' + (parsed.error_description || parsed.message || text.slice(0, 200))
    );
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

function getAuthPair() {
  const id = process.env.ZEEVOU_OAUTH_AUTH_CLIENT_ID;
  const secret = process.env.ZEEVOU_OAUTH_AUTH_CLIENT_SECRET;
  if (!id || !secret) throw new Error('ZEEVOU_OAUTH_AUTH_CLIENT_ID/SECRET missing');
  return { id, secret };
}

function getCredPair() {
  const id = process.env.ZEEVOU_OAUTH_CRED_CLIENT_ID;
  const secret = process.env.ZEEVOU_OAUTH_CRED_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

function buildAuthorizeUrl(redirectUri, state) {
  const { id } = getAuthPair();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', id);
  url.searchParams.set('redirect_uri', redirectUri);
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCode(code, redirectUri) {
  const { id, secret } = getAuthPair();
  const json = await tokenRequest({
    grant_type: 'authorization_code',
    client_id: id,
    client_secret: secret,
    code,
    redirect_uri: redirectUri,
  });
  storeToken(json, 'authorization_code', id, secret);
  return tokenState;
}

async function clientCredentials() {
  const pair = getCredPair();
  if (!pair) throw new Error('ZEEVOU_OAUTH_CRED_CLIENT_ID/SECRET missing');
  const json = await tokenRequest({
    grant_type: 'client_credentials',
    client_id: pair.id,
    client_secret: pair.secret,
  });
  storeToken(json, 'client_credentials', pair.id, pair.secret);
  return tokenState;
}

async function refresh() {
  if (!tokenState || !tokenState.refresh_token) return null;
  const json = await tokenRequest({
    grant_type: 'refresh_token',
    client_id: tokenState.client_id,
    client_secret: tokenState.client_secret,
    refresh_token: tokenState.refresh_token,
  });
  const prev = tokenState;
  storeToken(json, prev.grant_type, prev.client_id, prev.client_secret);
  if (!tokenState.refresh_token) tokenState.refresh_token = prev.refresh_token;
  return tokenState;
}

/**
 * Returns a valid access token. Order of attempts:
 * 1) live token in memory, 2) refresh_token, 3) client_credentials grant (server-to-server).
 * If none works — throws with instructions for the authorization_code flow.
 */
async function getAccessToken() {
  if (tokenState && tokenState.expires_at - 60 * 1000 > Date.now()) {
    return tokenState.access_token;
  }
  if (tokenState && tokenState.refresh_token) {
    try {
      await refresh();
      return tokenState.access_token;
    } catch (e) {
      logger.warn({ err: e.message }, 'zeevou token refresh failed');
      tokenState = null;
    }
  }
  if (getCredPair()) {
    await clientCredentials();
    return tokenState.access_token;
  }
  throw new Error(
    'Zeevou not authorized. Open /admin/zeevou/oauth/start (authorization_code flow) or set ZEEVOU_OAUTH_CRED_* env vars.'
  );
}

function getStatus() {
  const authorized = !!(tokenState && tokenState.expires_at > Date.now());
  return {
    authorized,
    grant_type: tokenState ? tokenState.grant_type : null,
    expires_at: tokenState ? new Date(tokenState.expires_at).toISOString() : null,
    expires_in_sec: tokenState ? Math.max(0, Math.floor((tokenState.expires_at - Date.now()) / 1000)) : 0,
    has_refresh_token: !!(tokenState && tokenState.refresh_token),
    oauth_base: OAUTH_BASE,
  };
}

module.exports = {
  OAUTH_BASE,
  buildAuthorizeUrl,
  exchangeCode,
  clientCredentials,
  getAccessToken,
  getStatus,
};
