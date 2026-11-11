/**
 * Organisation invitations are one-time bearer links, never six-digit login codes.
 * The URL identifies the pending user and carries a cryptographically random secret.
 * DynamoDB stores only the SHA-256 hash of that secret.
 */
export const INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const INVITATION_RESEND_SECONDS = 60;

const CREDENTIAL = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;

export function parseInvitationCredential(raw: string | undefined | null):
  { userId: string; secret: string } | null {
  if (!raw || raw.length > 90) return null;
  const match = CREDENTIAL.exec(raw);
  return match ? { userId: match[1].toLowerCase(), secret: match[2] } : null;
}

export function makeInvitationUrl(origin: string, credential: string): string {
  if (!parseInvitationCredential(credential)) throw new Error('Invalid invitation credential.');
  const url = new URL(origin);
  const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if ((url.protocol !== 'https:' && !(localhost && url.protocol === 'http:')) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invitation origin must be a trusted HTTPS website origin.');
  }
  url.pathname = '/activate';
  url.searchParams.set('invite', credential);
  return url.toString();
}

export function invitationNotExpired(expiresAt: unknown, nowSeconds: number): boolean {
  return typeof expiresAt === 'number' && Number.isSafeInteger(expiresAt) && expiresAt > nowSeconds;
}
