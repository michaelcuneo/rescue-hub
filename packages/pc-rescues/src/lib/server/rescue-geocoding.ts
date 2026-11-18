import { AwsClient } from 'aws4fetch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import {
  buildAwsSearchTextRequest, parseAwsReverse, parseAwsSearchText, type AddressSuggestion
} from '../../../../core/geocoding';
import {
  validRescueCoordinates, type MappedAddress, type RescueCoordinates
} from '../../../../core/rescue-location';

// This module is part of the existing SvelteKit AWS Lambda, not a new server.
// AWS Location Places v2 is the initial provider; the API contract is provider independent.
// Deliberately use Storage for SearchText and ReverseGeocode: AWS requires it
// whenever results may be saved, even temporarily. No Mapbox calls or data.
const dynamo = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(dynamo, {
  marshallOptions: { removeUndefinedValues: true }
});
const unavailable: MappedAddress = { address: null, precision: 'UNAVAILABLE' };
const POSITIVE_TTL_SECONDS = 30 * 24 * 3600;
const NEGATIVE_TTL_SECONDS = 6 * 3600;

function enabled(): boolean {
  // Opt-in: leave the demo untouched until geocoder permissions are deployed.
  return process.env.RESCUE_GEOCODING_ENABLED === 'true';
}

async function placesRequest(
  operation: 'reverse-geocode' | 'search-text',
  parameters: Record<string, unknown>,
  eventFetch: typeof fetch
): Promise<unknown | null> {
  if (!enabled()) return null;
  try {
    // The DynamoDB SDK resolves IAM role / SSO credentials using the standard
    // AWS provider chain, including short-lived Lambda credentials.
    const [region, creds] = await Promise.all([dynamo.config.region(), dynamo.config.credentials()]);
    const client = new AwsClient({
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
      service: 'geo-places',
      region,
      retries: 0
    });
    const signed = await client.sign(
      `https://places.geo.${region}.amazonaws.com/v2/${operation}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ ...parameters, IntendedUse: 'Storage', Language: 'en' })
      }
    );
    const response = await eventFetch(signed, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`AWS Location Places HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    // Never log coordinates, queried addresses, request bodies or AWS credentials.
    console.warn('AWS Location Places unavailable; original rescue GPS remains available.',
      error instanceof Error ? error.message : 'Unknown upstream error');
    return null;
  }
}

function reverseCacheKey(coords: RescueCoordinates) {
  // Six decimals means independent locations within about 0.1 m aren't conflated.
  return {
    pk: `REVERSE#${coords.latitude.toFixed(6)}#${coords.longitude.toFixed(6)}`,
    sk: 'AWS_LOCATION_V2'
  };
}

async function cachedReverse(coords: RescueCoordinates): Promise<MappedAddress | null> {
  try {
    const result = await db.send(new GetCommand({
      TableName: Resource.RescueHubGeocodingCache.name,
      Key: reverseCacheKey(coords)
    }));
    const item = result.Item;
    if (item?.source !== 'AWS_LOCATION' || !(Number(item.expiresAt) > Date.now() / 1000))
      return null;
    if (typeof item.address !== 'string' && item.address !== null) return null;
    if (!['NEARBY_ADDRESS', 'STREET', 'AREA', 'UNAVAILABLE'].includes(String(item.precision)))
      return null;
    return { address: item.address as string | null, precision: item.precision as MappedAddress['precision'] };
  } catch (error) {
    console.warn('Geocoding cache read failed; continuing without cache.',
      error instanceof Error ? error.name : 'Error');
    return null;
  }
}

async function saveReverse(coords: RescueCoordinates, result: MappedAddress): Promise<void> {
  try {
    const ttlSeconds = result.address ? POSITIVE_TTL_SECONDS : NEGATIVE_TTL_SECONDS;
    await db.send(new PutCommand({
      TableName: Resource.RescueHubGeocodingCache.name,
      Item: {
        ...reverseCacheKey(coords),
        source: 'AWS_LOCATION',
        address: result.address,
        precision: result.precision,
        expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds
      }
    }));
  } catch (error) {
    console.warn('Geocoding cache write failed; live result is still usable.',
      error instanceof Error ? error.name : 'Error');
  }
}

export async function reverseRescueAddress(
  coords: RescueCoordinates, eventFetch: typeof fetch = fetch
): Promise<MappedAddress> {
  if (!validRescueCoordinates(coords) || !enabled()) return unavailable;
  const stored = await cachedReverse(coords);
  if (stored) return stored;

  const response = await placesRequest('reverse-geocode', {
    QueryPosition: [coords.longitude, coords.latitude],
    QueryRadius: 300,
    MaxResults: 5
  }, eventFetch);
  if (response === null) return unavailable; // Never cache upstream failures.
  const result = parseAwsReverse(response, coords);
  await saveReverse(coords, result);
  return result;
}

export async function searchRescueAddresses(
  term: string, eventFetch: typeof fetch = fetch, bias?: RescueCoordinates
): Promise<AddressSuggestion[]> {
  if (!enabled() || term.trim().length < 3 || term.length > 120) return [];
  const response = await placesRequest('search-text',
    buildAwsSearchTextRequest(term, bias), eventFetch);
  return parseAwsSearchText(response);
}
