import { AwsClient } from 'aws4fetch';
import { Resource } from 'sst';

// Rescue Hub's normal GraphQL API key remains SERVER ONLY. The dedicated
// realtime API accepts AWS_IAM for publishing but API_KEY for subscriptions.
// Never put a rescue or animal record (or an organisation identifier) here.
export async function publishRescueChange(): Promise<void> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    console.warn('Realtime publish unavailable: runtime AWS credentials missing');
    return;
  }
  const url = Resource.RescueHubRealtime.url;
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    region: process.env.AWS_REGION || 'ap-southeast-2',
    service: 'appsync',
    retries: 1,
  });
  try {
    const result = await client.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation Signal($revision: ID!) { publishChange(revision: $revision) { revision } }',
        variables: { revision: crypto.randomUUID() }
      })
    });
    if (!result.ok) throw new Error(`Realtime publish HTTP ${result.status}`);
    const body = await result.json() as { errors?: Array<{ message: string }> };
    if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join('; '));
  } catch (error) {
    // Persisted writes must not be rolled back or incorrectly reported as
    // failures because notification infrastructure is temporarily unavailable.
    console.error('Realtime invalidation failed; clients reconnect and re-fetch:', error);
  }
}
