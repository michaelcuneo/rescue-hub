# Rescue Hub geocoding — AWS-native adapter

## Decision

Use the existing **SST SvelteKit Lambda** for both authenticated HTTP endpoints:
- `GET /api/geocoding/search?q=...&lat=...&lon=...` (dispatchers)
- `GET /api/mobile/rescues/[id]/address` (rescue-visibility checks)

The initial provider is **Amazon Location Service Places v2** (SearchText and
ReverseGeocode). It is not an independent G-NAF data index and does not imply
that AWS Places uses G-NAF. The provider-neutral interface stays intact so we
can later import G-NAF into AWS-native indexing services, if needed.

No Python, SQLite, sidecar container, external geocoder token, or manual PSV
import is required for the initial provider. Lambda uses its standard IAM role
credentials and SigV4; clients never receive AWS credentials. The existing
`aws4fetch` dependency signs AWS Places requests, using AWS SDK credentials.

## Architecture

```text
MapLibre desktop / Expo
  -> existing authenticated SvelteKit API (AWS Lambda)
       -> Amazon Location Service Places v2
       -> RescueHubGeocodingCache (DynamoDB, TTL)
  -> existing rescue GPS coordinates remain authoritative
```

The separate `RescueHubGeocodingCache` table is linked only to the web
Lambda. Repeated reverse lookups of the same coordinates are stored for 30 days,
with 6-hour negative-result caching and expiry by DynamoDB TTL. The browser
and Expo also deduplicate in-flight lookups for 2 minutes in memory.

Address search is biased toward the dispatch map centre and filtered to
Australia. If no map centre is available, use an Australia-wide bounding box
so AWS SearchText still receives the geographically constrained request it
requires. The search endpoint is restricted to authenticated dispatchers. SearchText returns usable coordinates, unlike Autocomplete. Each
SearchText and ReverseGeocode call sets `IntendedUse: 'Storage'`, allowing
results to be cached or saved at the **higher AWS Stored pricing tier**.
Do not replace this with single-use mode while caching.

The rescue GPS pin and Directions link use only the original coordinates.
Nearby property numbers are *always approximate*, even at the pin. No geocoded
property may silently move a rescue location.

## Activation

AWS Places is enabled by default **only on developer SST stages**.
The `demo` and `production` stages default to disabled and must be explicitly
enabled when ready. Override any stage with:

```dotenv
RESCUE_GEOCODING_ENABLED=true
```

Deploy the feature branch to a developer stage only to exercise real Places calls.
The map and GPS directions still work when geocoding is disabled or unavailable.
AWS Places calls incur usage fees; the feature can be disabled per stage by setting
`RESCUE_GEOCODING_ENABLED=false`.

SST gives the web Lambda scoped `geo-places:SearchText` and
`geo-places:ReverseGeocode` permissions for the Sydney regional provider
(`arn:aws:geo-places:ap-southeast-2::provider/default`) and links the new
DynamoDB TTL cache.
Region defaults to the SST AWS region (`ap-southeast-2`, Sydney). No public
Places API key is needed.

Do **not** deploy to `demo` or `production` as part of this prototype.
Before rollout: verify a small set of urban/rural Australian coordinates,
AWS Location source attribution and provider terms for wildlife operations,
SvelteKit performance, latency, search-result relevance, and Stored API costs.
Amazon Location is an AWS service, but still uses data providers and has its own
license and data-processing terms.

## Future G-NAF option

If owning the address dataset is essential, replace only the provider adapter.
Store quarterly licensed **G-NAF Core** files in S3; run ETL in Lambda / Batch
or Step Functions, index text in OpenSearch or an appropriate DynamoDB search
projection, and keep reverse spatial cells in an AWS-managed index. Select
the technology based on **actual** national scale and autocomplete requirements.
DynamoDB alone does not provide arbitrary full-text search or native nearest
neighbour queries, and an entire national G-NAF copy should not be placed in
the operational rescue data table.

G-NAF licence: https://docs.geoscape.com.au/projects/gnafcore_info/en/stable/
AWS storage terms: https://docs.aws.amazon.com/location/latest/developerguide/places-intended-use.html
AWS MapLibre: https://docs.aws.amazon.com/location/latest/developerguide/dev-maplibre.html
AWS source attribution: https://docs.aws.amazon.com/location/latest/developerguide/data-attribution.html

AWS requires a conspicuous link to its source-attribution information. The
address and intake results link to this official page, not merely an unlinked
brand name. Keep this attribution in web and mobile views.

## Tests

```bash
node --experimental-strip-types --test packages/core/geocoding.test.mjs packages/core/rescue-location.test.mjs
npm run check
npm run build --workspace=website
```

The contract tests use synthetic AWS Places v2 responses, not live API access.
A real AWS deployment and E2E geocoding test are still required.

## Existing stored data

No automatic migration of old `rescue.location` strings was performed.
Before production, audit whether any existing text was derived from temporary
Mapbox geocoding. Replace those values with independently sourced results
using the original incident GPS coordinates where permitted. User-entered
locations must be preserved. Existing Expo *Mapbox maps* are a separate
dependency and have not been changed in this branch.
