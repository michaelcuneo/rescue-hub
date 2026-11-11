import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  INVITATION_TTL_SECONDS, INVITATION_RESEND_SECONDS,
  parseInvitationCredential, makeInvitationUrl, invitationNotExpired
} from './invitation-links.ts';

const userId = randomUUID();
const secret = randomBytes(32).toString('base64url');
const credential = `${userId}.${secret}`;

test('a single 256-bit secret and user UUID form a valid invitation', () => {
  assert.deepEqual(parseInvitationCredential(credential), { userId, secret });
  assert.equal(secret.length, 43);
});

test('guessable codes and malformed links never identify an invitation', () => {
  for (const input of [
    null, '', '123456', `${userId}.123456`,
    `${userId}.invalid-value`, `${userId}.${secret}extra`,
    `${userId}.${secret}?redirect=https://attacker.example`,
    `${userId}.${secret}/other`, 'x'.repeat(10000)
  ]) assert.equal(parseInvitationCredential(input), null);
});

test('invitation URL points to the configured site and needs no email parameter', () => {
  const href = makeInvitationUrl('https://rescue.michaelcuneo.com.au', credential);
  const url = new URL(href);
  assert.equal(url.pathname, '/activate');
  assert.equal(url.searchParams.get('invite'), credential);
  assert.equal(url.searchParams.get('email'), null);
});

test('untrusted origins and credential-injection origins are rejected', () => {
  for (const origin of [
    'http://example.org', 'https://someone:password@example.org',
    'https://example.org/path', 'https://example.org?redirect=abc',
    'javascript:alert(1)'
  ]) assert.throws(() => makeInvitationUrl(origin, credential));
  assert.equal(new URL(makeInvitationUrl('http://localhost:3000', credential)).host, 'localhost:3000');
});

test('invite validity uses server-side expiry and one-week window', () => {
  assert.equal(INVITATION_TTL_SECONDS, 604800);
  assert.equal(INVITATION_RESEND_SECONDS, 60);
  assert.equal(invitationNotExpired(200, 199), true);
  assert.equal(invitationNotExpired(200, 200), false);
  assert.equal(invitationNotExpired('200', 199), false);
  assert.equal(invitationNotExpired(undefined, 199), false);
});
