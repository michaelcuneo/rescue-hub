import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { createPublicReporterSession } from './auth';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = Resource.RescueHubData.name;

export async function createMobileAuthHandoff(userId: string, challenge: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new Error('Invalid mobile PKCE challenge.');
  const code = randomBytes(32).toString('base64url');
  const digest = createHash('sha256').update(code).digest('hex');
  const now = Math.floor(Date.now() / 1000);
  await db.send(new PutCommand({
    TableName: table,
    Item: {
      pk: `MOBILE_OAUTH#${digest}`, sk: 'META', entity: 'mobile_oauth_code',
      userId, challenge, createdAt: now, ttl: now + 90
    }, ConditionExpression: 'attribute_not_exists(pk)'
  }));
  // The token is NOT in the deep link. Only the one-time 90-second handoff
  // code travels through the OS URL handler; redemption requires PKCE proof.
  return `rescuehub://auth?code=${encodeURIComponent(code)}`;
}

export async function redeemMobileAuthHandoff(code: string, verifier: string) {
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(code) || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) {
    throw new Error('Invalid mobile sign-in response.');
  }
  const digest = createHash('sha256').update(code).digest('hex');
  const result = await db.send(new DeleteCommand({
    TableName: table,
    Key: { pk: `MOBILE_OAUTH#${digest}`, sk: 'META' },
    ConditionExpression: 'attribute_exists(pk)', ReturnValues: 'ALL_OLD'
  }));
  const entry = result.Attributes;
  if (!entry || Number(entry.ttl ?? 0) <= Math.floor(Date.now() / 1000)) {
    throw new Error('Mobile sign-in code expired.');
  }
  const actual = createHash('sha256').update(verifier).digest('base64url');
  const expected = String(entry.challenge ?? '');
  const a = Buffer.from(actual), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Mobile sign-in verification failed.');
  return createPublicReporterSession(String(entry.userId));
}
