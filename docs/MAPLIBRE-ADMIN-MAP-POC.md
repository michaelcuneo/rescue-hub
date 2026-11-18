# MapLibre mapping proof of concept — Administration and Operations

## Branch

`feature/maplibre-admin-map-poc`, branched from `feature/rescue-queue-register-organisation`.

Both desktop maps are converted on the experimental branch:
**Administration → Rescues → Map** and **Operations → Rescue Queue**.
The **React Native mobile map and geocoding are deliberately untouched**.

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

### Operations map

- Replaces the former `MapBox.svelte` Mapbox wrapper with a MapLibre instance.
- Retains the same `mapRef.getMap()` interface for dispatch selection, address-search centring and new rescue intake.
- Pending/Assigned pins now use geographic GeoJSON **GPU layers**, not one HTML marker per animal. The same species colours, initials, selected-case halo and workflow-status indicator are represented in those layers.
- The map uses the existing `shouldShowRescuePin` policy: a physically collected animal or case awaiting a carer is no longer plotted, but its underlying rescue record is unchanged.
- Clicking an individual rescue pin selects that case in the dispatch panel. Clicking an empty location while a new rescue intake is open drops a draft pin; a selected address also moves the draft pin correctly.
- Uses MapLibre navigation, scale and secure-context geolocation controls. The current location coordinates continue updating the shared `coords` store.
- Loads the same DCCEEW NSW operating-area polygons, outlines and labels, with a clickable area summary.
- Keeps the existing fixed and responsive panel layout, with canvas resizing via `ResizeObserver`.

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
6. Visit **Operations**. Confirm Pending and Assigned pins appear at the correct GPS coordinates, with species colours and status dots. Clicking a pin should select its rescue, while clicking a rescue in the queue should fly the map to it.
7. Open **New rescue**; click an empty area of the map and verify a draft pin appears at the chosen location. Use the address search or **Use current map position** and verify the marker moves. Cancel and confirm it disappears. Do not submit a live rescue just to test this.
8. Click a NSW operating area and confirm the selection summary; zoom, pan, switch themes and resize to narrow layouts.
9. Confirm the mobile Expo map is **unchanged** and still uses its original Mapbox configuration. The Operations address autocomplete and reverse lookup still use Mapbox; do not remove the token from the entire dev stage yet.
10. Review browser network requests: neither **desktop map** should request `api.mapbox.com` for its own tiles or scripts. Geocoding may still request Mapbox endpoints.

## Decision gates

Compare basemap clarity in NSW regional areas, accessibility, labels,
geographic marker accuracy, boundary overlay performance, tile-loading
reliability, mobile browser performance and costs. Do not migrate **mobile** or **geocoding** until both desktop maps pass interactive inspection.

The project isn't Mapbox-free until forward and reverse geocoding plus the mobile map are migrated separately.

## Operations completed-case pin restoration (18 November 2026)

The first Operations MapLibre migration accidentally omitted `COMPLETED` from its GeoJSON source and click handler even though the sidebar's Completed tab still showed today's completed cases. This has been corrected: **Pending and Assigned** remain subject to the existing physical-pickup hiding rule, while **Completed today (Australia/Sydney)** appears as a completed-status pin at the **original incident location**, even if the animal was picked up earlier. Clicking a completed pin opens the existing rescue detail card. Completed cases from earlier days are available on **Administration → Rescues → Map** rather than the live Operations map. A time-based refresh removes yesterday's completed pins after NSW midnight; no animal or rescue records are deleted. The repair adds unit coverage in `rescue-operations-date.test.mjs`.
