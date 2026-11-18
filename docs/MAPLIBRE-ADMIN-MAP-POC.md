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

## Persistent historical rescue pins and custody journey

Administration → Rescues → Map uses the full paginated rescue archive, not
the live-dispatch map visibility helper. **Pending, Assigned and Completed
rescue locations stay plotted at their original report coordinates**, even
after collection, treatment, transfer or final outcome. Selecting a specific
day or range still filters by the **original report date**; `All rescues · any
dates` includes the whole retained archive.

Selecting a pin or using **View pin** opens an accessible case modal with
status, assigned responder, reported injury, collection timestamp and a
separately loaded, organisation-authorised journey timeline. The timeline
includes recorded collection, transport, handover, veterinary milestones and
final outcome events, naming the recorded actor/recipient where known.
Destination names remain text unless verified coordinates were actually
captured. The current pickup workflow timestamps physical collection but does
**not** independently capture the GPS point of pickup: this is explicitly
disclosed rather than pretending the original incident pin proves collection
occurred there.

For final wildlife releases, each recorded off-site release with valid GPS
coordinates gets a **purple release pin** when its case is selected. Original
report pins are never moved or removed; releases at their original site have
the same GPS location and do not need a second overlapping pin. Existing
synthetic relocation pins still render in the archive for stress testing.
All case-history requests go through
`GET /api/admin/rescues/[id]/journey`, which enforces administrative roles
and the actor's organisation boundary, and are made only when a case is opened.

Operations retains its separate live-dispatch pin rules. An animal picked up
is removed from the operational response map while remaining fully accessible
in the historical Administration map.

Manual browser checks: select a Pending, an Assigned and an old Completed
rescue; verify all three pins persist after a date-filter change back to
All. Open cases with and without linked animal records; confirm no invented
destination pins for free-text addresses, and verify an actual off-site
release draws a purple pin. Close with Escape or the X and ensure map camera
and pins are retained.

## Original report, physical pickup and release location switcher

The historic archive remains status-inclusive: its query explicitly uses
`status=all` (Pending, Assigned and Completed are kept regardless of physical
pickup). Open **All rescues · any dates**, then inspect the Pending / Assigned /
Completed counters in the map's right rail to distinguish an archive query
returning no records from a map rendering problem. A specific-day filter uses
the **original report date**, not the date of later assignment or completion.
Large pin concentrations cluster until zoomed in.

The rescue detail modal now has **Reported / pickup area**, **Release site**,
and **Show both pins** controls, plus an animal-specific release selector
when multiple destination records exist. The original reported coordinate
does not necessarily equal the actual physical collection location: the
present pickup workflow stores collection time and user, not a second pickup
GPS position. The distinction is explained in the modal.

New release outcomes atomically append actual GPS coordinates to
`RESCUE#.../META.releaseSites` in addition to storing them in the permanent
animal record and append-only outcome event. This allows the archive map to
draw real purple release pins across the entire selected historical date
range without querying every animal individually. A release back at the
original site does not duplicate the original rescue pin. The older synthetic
fixtures continue to use their retained historical release fields.

**Older real releases:** cases finalised before this projection existed
may have release GPS in `ANIMAL#.../META` but none on their rescue archive
projection. To inspect and optionally repair the projection without modifying
animal histories, use the stage-guarded script:

```bash
npx sst shell --stage michael -- node packages/pc-rescues/scripts/backfill-release-map-pins.mjs --stage michael
# After reviewing the dry-run:
npx sst shell --stage michael -- node packages/pc-rescues/scripts/backfill-release-map-pins.mjs --stage michael --write
```

For the demo stage, replace both occurrences of `michael` with `demo`.
Write confirmation is `BACKFILL RELEASES michael` (or `demo`).
The script only reads source GPS in real finalised animal records and
conditionally fills a missing archive projection. No source animal/care
records are changed and no location is geocoded or guessed. It is not
run by `sst deploy`.

No actual DynamoDB stage was accessed from GitHub, so the app must still be
tested against the selected stage after deploying/pulling the updated code.

## Compact case card and opt-in animal GPS journey (18 November 2026)

**Administration → Rescues → Map** now behaves like desktop Operations:
selecting a pin shows a compact, bottom-right card **inside the map**, not a
centred modal or a long detail panel. It shows the animal, brief rescue status,
original rescue location, optional GPS checkpoint count and an
**Animal Records & Phone Updates** button. There is **no Directions link** in
the Administration card. All animal care and movement details remain in the
full animal record.

**Never discard a reported rescue pin on pickup.** The original Pending /
Assigned incident coordinate is fixed and remains on Operations throughout
collection, travel, veterinary handover and care, while cases completed today
remain on Operations for that NSW day. All historical original points persist
in Administration for all dates. The latest *measured animal location*, when
available, is a **separate blue marker**; it never mutates the original report
coordinate. Relocation destinations still have separate purple markers.

The mobile animal-care screen can now **opt in to foreground GPS tracking**
for a selected animal while the signed-in person is the current custodian.
It saves an initial position and sampled route checkpoints (at least 12 seconds
apart; mobile location watcher requests 30-metre displacement / 15-second
interval) as immutable `GPS_CHECKPOINT` animal events with precise GPS,
accuracy, timestamp, actor and phase. There is also a manual
**Save current GPS checkpoint** button. Tracking stops if the user leaves the
screen, backgrounds the mobile app, transfers custody, or finalises care.
It is **not background tracking**, and must not be described as continuous
or complete if the app is closed, offline, or GPS permission is denied.
A phone carried by a rescuer is not evidence of an animal's location once
physical veterinary custody has been transferred; vet-held animals do not
accept custodian-phone GPS checkpoints.

The secure `POST /api/mobile/animals/[id]/gps` endpoint requires active
organisation membership and ownership of current physical custody. It
atomically appends the checkpoint to the permanent animal history and
updates last-known position projections on the original rescue and, when
different, its active transport job. The realtime feed notifies desktop
Operations, where blue current-position pins update independently of the
original rescue pins.

When an authorised administrator selects a rescue, the private journey
endpoint loads all recorded checkpoint events for the linked animals.
**Blue lines join consecutive measured GPS points** and blue dots show the
samples; lines are **approximations between samples**, not proof of the
exact road or walking route. The map frames the reported original point
and measured journey on first selection, then refreshes the one selected case
every 20 seconds while visible. No public reporting route exposes volunteer
movement or sensitive release-site coordinates.

**Production readiness follow-ups:** explicitly decide whether real
background tracking is required; it needs platform permission/UI disclosure,
opt-in controls, battery optimisation and a privacy policy before enabling.
Set organisation-specific GPS retention and access-audit policies, choose
frequency thresholds per transport phase, add offline buffering with secure
retries, and test sampling on real iOS/Android devices. No GPS path should be
fabricated for historic events that only recorded an address, nor should
the app infer custody or veterinary approval from a phone location.

## Single current animal marker and clickable historical milestones (18 November 2026)

**Operations:** Pending, Assigned and today's Completed cases display one case-level marker at the last recorded animal GPS checkpoint. A final release overrides older GPS; without any valid post-report location, the original incident coordinate remains the explicit fallback (not proof of current whereabouts). A separate blue overlay that duplicated markers has been removed.

**Administration:** Archived rescue cases plot the same projected latest position. Selecting a case opens a compact card with chronological, clickable **injury, pickup, vet, care and release** milestones when their actual GPS coordinates are available. Selecting a milestone flies the MapLibre view to it. Earlier mobile GPS checkpoint events and release-point storage are retained. The old blue line connecting sparse checkpoint samples is removed because a straight line is not evidence of the route travelled.

**Synthetic fixtures only:** `packages/core/demo-animal-milestones.mjs` provides deterministic fictional Hunter-area carers, clinics and pickup locations. It includes an explicit presenter demo address placeholder of 28 Mitchell St, Stockton NSW 2295; its illustrative coordinates are not a verified house position. All such records have demo/historical-seed markers, and must never be confused with actual wildlife incidents or real carers' private home addresses. The existing historical fixture generator now emits a linked series of GPS_CHECKPOINT milestones and a current-location projection.

Run a dry-run in development:

```bash
npx sst shell --stage michael -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage michael
```

To insert the missing historical and completed-today fixtures, rerun with `--write` and type the interactive confirmation. To add checkpoint events to **already seeded synthetic** records, rerun with `--write --enrich`; this refuses non-seed records and never overwrites unrelated records.

Change both stage names to `demo` for the public demonstration only once the development data has been reviewed. No seeding runs on deployment or from ordinary application requests. These are historical milestone changes, not a background vehicle animation; adding simulated progressive time-lapse playback is separate work.

## Dispatch location entry: draggable intake pin

The Operations **New rescue** intake is a persistent side panel, not a backdrop-dismissed modal. Clicking outside the panel must not close it. The underlying MapLibre map remains available for panning, zooming and placing a draft pin. While intake is open, clicking **anywhere** on the map (even an existing rescue or operating-area polygon) moves the **draft** pin rather than changing the selected rescue. Only the panel's Close/Cancel buttons or a successful submit dismiss intake.

Draft pins are draggable MapLibre markers. Dropping the marker updates the shared `draftLocation` state and the rescue's submitted latitude/longitude. Focus the marker and use the arrow keys to make fine position adjustments; holding Shift moves in larger steps. A manually moved pin clears any previously selected address input so stale geocoded text is never submitted for a new coordinate. Address-search results still set a pin at the chosen coordinates, and the operator can then drag it to refine the report.

Manual verification: open intake, click the map, verify the panel remains open and pin appears; click on an existing rescue pin while intake is open; drag the draft marker and verify its coordinates change in the panel; choose an address, drag the marker and verify the old address is cleared; use arrow keys on the focused marker; Cancel and verify the marker disappears. Check both dark and light styles. The Expo map and its release picker are unaffected.


## Low-saturation light-mode basemap

The Operations, Administration rescue-history map and desktop release
location picker use OpenFreeMap's **Positron** basemap in light mode
(`https://tiles.openfreemap.org/styles/positron`). This has a restrained
neutral-grey aesthetic so species category markers and operational status
pins remain the colourful focus. The existing dark-mode map continues to
use `https://tiles.openfreemap.org/styles/dark`. The desktop theme's
light-mode UI palette and the Expo/Mapbox-based mobile map are unchanged.
Check label legibility, NSW boundary overlays and the pin palette in both
themes before release.


## Subdued organisation boundary overlays

Desktop Operations, Administration → Operating Areas, and Administration →
Rescue map share `packages/core/operating-area-visual.ts`. Organisation
polygons use low-opacity fills (Hunter 5.5%, other groups 2.5%) and faint
outlines (Hunter 42%, other groups 28%). Slightly stronger Hunter boundaries
help with geographic orientation, but the animals and dispatch-status pins
remain the foreground. Region hit-testing/selection and GIS routing are
unaffected; visibility is a rendering choice only.

Mobile Expo/Mapbox map paint settings have **not** been changed. Validate
light and dark desktop basemaps visually after deploying, especially where
different organisations overlap and where maps have dense animal pins.
