// Keep address hints separate from operational rescue records.
// DynamoDB TTL removes stale reverse-geocoding entries automatically.
export const geocodingCache = new sst.aws.Dynamo('RescueHubGeocodingCache', {
  fields: {
    pk: 'string',
    sk: 'string',
    expiresAt: 'number'
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  ttl: 'expiresAt'
});
