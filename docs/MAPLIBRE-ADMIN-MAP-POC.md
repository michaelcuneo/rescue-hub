# MapLibre mapping proof of concept

## Branch

`feature/maplibre-admin-map-poc`, branched from `feature/rescue-queue-register-organisation`.

Only **Administration → Rescues → Map** is converted. Do not modify or deploy
the operational desktop map or the React Native mobile map in this experiment.

## Implementation

- MapLibre GL JS v6.18.0 loaded **only in the browser** from a pinned ESM bundle
  (`https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.mjs`).
- Matching browser CSS from
  `https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.css`.
- OpenFreeMap `liberty` (light) and `dark` styles at
  `https://tiles.openfreemap.org/styles/{liberty|dark}`.
- **No Mapbox public token** or Mapbox tile URLs for this admin map.
- MapLibre native GeoJSON clustering retains the rescue-category colours, smaller
  status dots, case selection and zooming clusters.
- The existing `/api/admin/rescues/map` endpoint continues serving
  permission-scoped all-time, single-day and date-range rescue history.
- The existing `/api/operating-areas` remains the authoritative source for
  NSW GIS polygons, boundaries and labels.
- Light/dark theme changes reset the basemap style and reinstall the GeoJSON
  overlays. Theme handling has no effect on the existing desktop Operations map.
- The map and the resize observer are cleaned up on unmount.

This is deliberately a disposable test integration, not the intended
production packaging. We should move to an npm-installed, lockfile-pinned
`maplibre-gl` dependency and self-hosted/vector basemaps if the proof of
concept proves stable and suitable.

**Note:** The browser needs access to `unpkg.com` and `tiles.openfreemap.org`
for this prototype. If either endpoint is unavailable, the basemap might
not render; this does not imply that MapLibre itself is unusable. The
OpenFreeMap public tile service remains a third-party dependency, and its
uptime/terms/usage should be evaluated before national rollout.

## Local trial

```bash
git fetch origin
git switch feature/maplibre-admin-map-poc
npm install
npm run check --workspace=website
npm run build --workspace=website
npx sst dev
```

Use the same environment and AWS stage as your existing local Rescue Hub
instance. This does not require a new API key.

1. Open **Administration → Rescues → Map**. Confirm the basemap displays
   without `PUBLIC_MAPBOX_ACCESS_TOKEN` **for this map**.
2. Confirm NSW operating-area boundaries load, and the sidebar reports a
   positive boundary feature count.
3. Switch among **All rescues**, **Specific day**, and **Date range**.
   Confirm pins and clusters update, and click a cluster, then an individual
   rescue to inspect its case details.
4. Test Today / Previous / Next and switching light/dark theme without
   losing rescue pins or operating-area boundaries.
5. Resize the window and test narrow desktop layouts.
6. Confirm the **Operations** map and **mobile** map are unchanged and still
   use their original Mapbox configuration.
7. Review browser network requests: the admin map should not request
   `api.mapbox.com` for its own tiles or scripts. Other Rescue Hub components
   still use Mapbox until separately migrated.

## Decision gates

Compare basemap clarity in NSW regional areas, accessibility, labels,
geographic marker accuracy, boundary overlay performance, tile-loading
reliability, mobile browser performance and costs. Do not migrate the other
maps until this first experiment passes interactive inspection.

The project isn't Mapbox-free until remaining Mapbox map rendering, forward
and reverse geocoding and native mobile paths are migrated separately.
