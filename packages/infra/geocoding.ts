// Keep address hints separate from operational rescue records.
// DynamoDB TTL removes stale reverse-geocoding entries automatically.
export const geocodingCache = new sst.aws.Dynamo('RescueHubGeocodingCache', {
  // SST Dynamo "fields" are only for primary/secondary index attributes.
  // DynamoDB TTL does not require an index or a key declaration.
  fields: {
    pk: 'string',
    sk: 'string'
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  ttl: 'expiresAt'
});
