# Expo rescue pin map anchoring

The Expo map renders all rescue locations as **Mapbox GL GeoJSON point features** with [longitude, latitude] geometry. The rescue circle, initials, status dot and selection halo are Mapbox-native layers, sharing the same geographic projection as the basemap. No rescue pin is a DOM marker or applies CSS `transform` animation.

This fixes a previous error: DOM rescue markers used `transition:transform` and `.pin.selected {transform:scale(...)}` on the element whose root transform Mapbox also updates to position the marker. During gestures, the rendered marker could interpolate behind the camera or override the map position.

The incoming rescue feed remains the source of truth. `createRescuePinCollection` checks latitude (-90 to 90) and longitude (-180 to 180), preserves original values, and removes duplicate IDs; points with invalid coordinates are not displayed. A status change only updates feature properties and cannot change geometry. Updating the feed only sets GeoJSON source data and does not reset manual camera movements. User-location indicator is separate from rescue pins.

## Physical-device acceptance test

1. In Expo on iOS and Android, open Rescues > Map and choose a distinctive rescue location near a road or known landmark. Let the map settle.
2. Zoom repeatedly between neighbourhood and regional scales. Pan rapidly, reverse direction, pinch and rotate. After every gesture, the rescue point must remain over the **same geographic feature**. A pin must not animate away or lag behind its intended location.
3. Tap a rescue pin. It must select the correct rescue and maintain its coordinate after the automatic camera zoom. Repeat on densely grouped pins.
4. Leave the map open during incoming rescue/transport events or feed refresh; new or changed pins must update without changing the user's current pan/zoom.
5. Repeat on the final installed iOS/Android build, not only Metro TypeScript compilation. CI cannot exercise an interactive Mapbox WebView or the actual GPU projection.
6. If a pin is stationary during pan/zoom but placed at the wrong **real-world** location, inspect the recorded `latitude` and `longitude` in the rescue API and intake form. That is a separate source-coordinate issue, not rendering drift.

Automated tests run in `packages/core/rescue-pin-geojson.test.mjs`.
