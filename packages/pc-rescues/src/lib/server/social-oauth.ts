import { createHash, randomBytes, randomUUID, sign } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Resource } from 'sst';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = Resource.RescueHubData.name;
export type SocialProvider = 'google' | 'apple' | 'facebook';
export const isSocialProvider = (value: string): value is SocialProvider =>
  ['google', 'apple', 'facebook'].includes(value);

function settings(provider: SocialProvider): { clientId: string; clientSecret?: string } | null {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }
  if (provider === 'facebook') {
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }
  const clientId = process.env.APPLE_SERVICE_ID;
  return clientId && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY
    ? { clientId }
    : null;
}

export function configuredSocialProviders(): SocialProvider[] {
  return (['google','apple','facebook'] as const).filter(provider => settings(provider) !== null);
}

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const urlSafe = (bytes: Buffer) => bytes.toString('base64url');
function callbackUrl(origin: string, provider: SocialProvider) {
  return `${origin}/auth/social/${provider}/callback`;
}
function tokenString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
async function oauthJson(url: string, data: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: data.toString(), signal: AbortSignal.timeout(15000)
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof body.error === 'string') {
    throw new Error('The sign-in provider rejected the authentication code.');
  }
  return body;
}

export async function startSocialOAuth(provider: SocialProvider, origin: string, mobileChallenge?: string) {
  if (mobileChallenge !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(mobileChallenge)) {
    throw new Error('Invalid mobile authentication challenge.');
  }
  const config = settings(provider);
  if (!config) throw new Error(`${provider} sign-in has not been configured yet.`);
  const state = urlSafe(randomBytes(32));
  const nonce = urlSafe(randomBytes(24));
  const verifier = urlSafe(randomBytes(32));
  const redirect = callbackUrl(origin, provider);
  const now = Math.floor(Date.now() / 1000);
  await db.send(new PutCommand({
    TableName: table,
    Item: {
      pk: `OAUTH#STATE#${hash(state)}`, sk: 'META', entity: 'social_oauth_state',
      provider, nonce, verifier, redirect, mobileChallenge,
      createdAt: now, ttl: now + 600
    }, ConditionExpression: 'attribute_not_exists(pk)'
  }));
  const authorize = provider === 'google'
    ? 'https://accounts.google.com/o/oauth2/v2/auth'
    : provider === 'apple'
      ? 'https://appleid.apple.com/auth/authorize'
      : 'https://www.facebook.com/v23.0/dialog/oauth';
  const query = new URLSearchParams({
    client_id: config.clientId, redirect_uri: redirect, response_type: 'code', state
  });
  if (provider === 'google') {
    query.set('scope', 'openid email profile');
    query.set('nonce', nonce);
    query.set('code_challenge', urlSafe(createHash('sha256').update(verifier).digest()));
    query.set('code_challenge_method', 'S256');
  }
  if (provider === 'apple') {
    query.set('scope', 'name email');
    query.set('nonce', nonce);
    query.set('response_mode', 'form_post');
  }
  if (provider === 'facebook') query.set('scope', 'email,public_profile');
  return `${authorize}?${query}`;
}

function appleClientSecret(clientId: string) {
  const team = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!team || !keyId || !privateKey) throw new Error('Apple sign-in configuration is unavailable.');
  const now = Math.floor(Date.now() / 1000);
  const header = urlSafe(Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })));
  const payload = urlSafe(Buffer.from(JSON.stringify({
    iss: team, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId
  })));
  const signingInput = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: privateKey, dsaEncoding: 'ieee-p1363'
  });
  return `${signingInput}.${urlSafe(signature)}`;
}

export async function finishSocialOAuth(input: {
  provider: SocialProvider; origin: string; state: string; code: string;
  appleUser?: string;
}): Promise<{ provider: SocialProvider; subject: string; email: string; name: string; mobileChallenge?: string }> {
  const { provider, origin, state, code } = input;
  if (!state || !code || state.length > 300 || code.length > 4096) throw new Error('Invalid sign-in response.');
  const consumed = await db.send(new DeleteCommand({
    TableName: table,
    Key: { pk: `OAUTH#STATE#${hash(state)}`, sk: 'META' },
    ConditionExpression: 'attribute_exists(pk)',
    ReturnValues: 'ALL_OLD'
  }));
  const record = consumed.Attributes;
  if (!record || record.provider !== provider || record.redirect !== callbackUrl(origin, provider) ||
      Number(record.ttl ?? 0) <= Math.floor(Date.now() / 1000)) {
    throw new Error('Sign-in request expired. Please try again.');
  }
  const config = settings(provider);
  if (!config) throw new Error('Sign-in provider is unavailable.');
  const mobileChallenge = typeof record.mobileChallenge === 'string' ? record.mobileChallenge : undefined;
  const common = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: String(record.redirect),
    code, grant_type: 'authorization_code'
  });

  if (provider === 'google') {
    common.set('client_secret', config.clientSecret ?? '');
    common.set('code_verifier', String(record.verifier));
    const token = await oauthJson('https://oauth2.googleapis.com/token', common);
    const idToken = tokenString(token.id_token);
    if (!idToken) throw new Error('Google did not supply an identity token.');
    const verified = await jwtVerify(idToken, createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')), {
      audience: config.clientId, issuer: ['https://accounts.google.com', 'accounts.google.com'],
      maxTokenAge: '10m'
    });
    const claims = verified.payload;
    if (claims.nonce !== record.nonce || claims.email_verified !== true ||
        !tokenString(claims.email) || !tokenString(claims.sub)) {
      throw new Error('Google identity verification failed.');
    }
    return { provider, subject: String(claims.sub), email: String(claims.email),
      name: tokenString(claims.name) ?? 'Wildlife reporter', mobileChallenge };
  }

  if (provider === 'apple') {
    common.set('client_secret', appleClientSecret(config.clientId));
    const token = await oauthJson('https://appleid.apple.com/auth/token', common);
    const idToken = tokenString(token.id_token);
    if (!idToken) throw new Error('Apple did not supply an identity token.');
    const verified = await jwtVerify(idToken, createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')), {
      audience: config.clientId, issuer: 'https://appleid.apple.com', maxTokenAge: '10m'
    });
    const claims = verified.payload;
    if (claims.nonce !== record.nonce || !(claims.email_verified === true || claims.email_verified === 'true') ||
        !tokenString(claims.email) || !tokenString(claims.sub)) {
      throw new Error('Apple identity verification failed.');
    }
    let appleName = 'Wildlife reporter';
    if (input.appleUser) {
      try {
        const details = JSON.parse(input.appleUser) as { name?: { firstName?: string; lastName?: string } };
        appleName = [details.name?.firstName, details.name?.lastName].filter(Boolean).join(' ').trim() || appleName;
      } catch { /* Apple supplies optional name only on the first authorisation. */ }
    }
    return { provider, subject: String(claims.sub), email: String(claims.email), name: appleName, mobileChallenge };
  }

  common.set('client_secret', config.clientSecret ?? '');
  const token = await oauthJson('https://graph.facebook.com/v23.0/oauth/access_token', common);
  const accessToken = tokenString(token.access_token);
  if (!accessToken) throw new Error('Facebook did not supply an access token.');
  const proof = new URLSearchParams({
    input_token: accessToken, access_token: `${config.clientId}|${config.clientSecret}`
  });
  const debug = await fetch(`https://graph.facebook.com/debug_token?${proof}`, { signal: AbortSignal.timeout(15000) });
  if (!debug.ok) throw new Error('Unable to verify Facebook authentication.');
  const verification = await debug.json() as { data?: { is_valid?: boolean; app_id?: string } };
  if (!verification.data?.is_valid || verification.data.app_id !== config.clientId) {
    throw new Error('Facebook account verification failed.');
  }
  const meQuery = new URLSearchParams({ fields: 'id,name,email', access_token: accessToken });
  const response = await fetch(`https://graph.facebook.com/me?${meQuery}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Facebook account details were unavailable.');
  const profile = await response.json() as { id?: string; email?: string; name?: string };
  const fbId = tokenString(profile.id);
  const fbEmail = tokenString(profile.email);
  if (!fbId || !fbEmail) {
    throw new Error('Facebook did not provide an email address. Use another sign-in method.');
  }
  return { provider, subject: fbId, email: fbEmail, name: profile.name || 'Wildlife reporter', mobileChallenge };
}
