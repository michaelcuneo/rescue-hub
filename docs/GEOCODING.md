# Independent geocoding (G-NAF Core prototype)

## What changed

Rescue Hub desktop address search, reverse-geocoded rescue cards, and Expo rescue address views no longer query Mapbox Geocoding. The web server exposes **authenticated** `/api/geocoding/search?q=...` and existing authorised `/api/mobile/rescues/[id]/address`, both backed by an optional private G-NAF service. The browser never sees the geocoder secret. Both clients deduplicate and reuse short-lived hints in memory. The API remains `private, no-store` because incident locations are sensitive.

**Incident GPS coordinates always remain authoritative.** An address within 300 metres is labelled **nearby/approximate**, never substituted for the rescue or directions pin. An address further away is suppressed. With no provider configured, the UI falls back to GPS and the stored reporter-provided location; there is deliberately **no Mapbox fallback**.

This is a **working prototype**, not a production migration. Existing rescue records with Mapbox-derived location text have not been automatically scrubbed, and the existing Mapbox-based Expo *basemap* is a separate migration.

## Dataset

Use the current **open G-NAF Core** release rather than the multi-table full G-NAF Standard release. Core includes `ADDRESS_LABEL`, `ADDRESS_DETAIL_PID`, `STATE`, `LATITUDE`, and `LONGITUDE`, so no per-state join pipeline is required. Download/unzip from the Geoscape G-NAF Core open-data release. Do **not** import `GNAF_CORE_RETIRED`.

- Official schema: https://docs.geoscape.com.au/projects/gnafcore_info/en/stable/
- Government open-data information: https://www.industry.gov.au/publications/geocoded-national-address-file-g-naf-and-administrative-boundaries-ab-data

The importer reads PSV, builds a SQLite FTS5 address search index and an RTree spatial index, and replaces the database **only after successful processing**. The service reads the resulting index in read-only mode.

## Local setup

Requires Python 3.12+ with SQLite FTS5 and RTree (standard Python builds). No Pip dependencies.

```bash
# First try NSW only; omit --states to index all eight jurisdictions.
python3 services/gnaf-geocoder/import_gnaf.py \
  --input /path/to/extracted/GNAF_CORE.psv \
  --output /data/gnaf/gnaf.sqlite \
  --edition 2026-08 --states NSW

export GNAF_DB=/data/gnaf/gnaf.sqlite
export GNAF_TOKEN="$(openssl rand -hex 32)"
python3 services/gnaf-geocoder/geocoder.py --host 127.0.0.1 --port 8765

# In another shell (same bearer secret):
curl -H "Authorization: Bearer $GNAF_TOKEN" \
  "http://127.0.0.1:8765/search?q=hunter&limit=5"
curl -H "Authorization: Bearer $GNAF_TOKEN" \
  "http://127.0.0.1:8765/reverse?latitude=-32.929&longitude=151.779"
```

`services/gnaf-geocoder/compose.yaml` optionally runs the API as an unprivileged, read-only Docker service bound to **127.0.0.1** on the host. Set `GNAF_DATA_DIR` to the directory containing `gnaf.sqlite` and set `GNAF_TOKEN` to the same secret. To connect the SST Lambda, expose the geocoder over **HTTPS with access controls**, not an unauthenticated public port.

Set these **server-only** environment variables for SST stages after that service is reachable:

```dotenv
RESCUE_GEOCODER_URL=https://internal-geocoder.example.org
RESCUE_GEOCODER_TOKEN=<same-long-random-secret>
```

Do not set them for demo until the service is deployed, secured and smoke-tested. There is no automatic infrastructure provisioning or production/demo deployment in this branch.

## Testing

```bash
python3 -m unittest discover -s services/gnaf-geocoder -p 'test_*.py' -v
node --experimental-strip-types --test packages/core/geocoding.test.mjs
```

The Python tests import **synthetic fixture data** and validate autocomplete, reverse lookup, state filtering, JWT-independent bearer authentication, and refusal to search retired files. Real-data coverage, import duration, memory/disk use, accuracy benchmarks and AWS connectivity remain to be verified.

## Licence, attribution and migration

G-NAF Core's open EULA is based on CC BY 4.0 with a restriction on using unverified addresses to send physical mail. Follow its specific attribution wording and user-data/privacy requirements. See the official G-NAF Core documentation above. The UI displays a concise Geoscape attribution where results are shown.

**Before production:** audit stored `rescue.location` data and identify whether text came from Mapbox temporary geocoding, user entry, or other sources. Do not bulk-copy Mapbox-derived addresses into the G-NAF index. Replace suspect geocoder-derived strings with fresh independently sourced results **from original, independently collected GPS pins**, preserving user-entered text. Verify source licensing and review with counsel if uncertain.

Quarterly updates: import a fresh G-NAF Core edition into a separate SQLite file, check record counts and sample queries, then atomically swap the file in the mounted **directory**. Monitor `/healthz`, response time, errors, reverse coverage and empty address results. Add per-user rate limiting and production load tests before wider rollout.
