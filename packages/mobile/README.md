# Rescue Hub Mobile (Expo SDK 58)

Rescuer app with Mapbox rescue map, self-claim, animal care, and seven-day availability settings.

## Setup on a physical phone

```bash
cd ~/rescue-hub
git pull --ff-only origin deploy/rescue-demo-domain
npm install
cd packages/mobile
npx expo install --fix
npx expo-doctor
npm run check
npx expo start --clear
```

Set both public environment variables in the **existing** `packages/mobile/.env` file:

```dotenv
EXPO_PUBLIC_RESCUE_HUB_API_URL=https://rescue.michaelcuneo.com.au
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_existing_mapbox_token
```

Use the same public Mapbox token as the web portal (from the root `.env`, if configured there). Expo substitutes `EXPO_PUBLIC_*` values when Metro bundles the app. Restart Expo with `npx expo start --clear` after changing this file. This HTTPS origin must be the **deployed backend containing the new mobile API routes**. Changes to server code also require `npx sst deploy --stage demo` from the repository root before the deployed iPhone app can use them.

## Mapbox

Uses the **existing public Mapbox token** provided to Expo as `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, and the custom Mapbox style from the SvelteKit dashboard. The app does not request its token from a backend API. The mobile map renders with Mapbox GL JS in an Expo Go-compatible `react-native-webview` (SDK 58 recommends version 14.0.1), so a custom development build is **not needed for this map**.

Map rendering needs network access to `api.mapbox.com`. Rescue pins and qualification filtering are based on the authenticated `GET /api/mobile/rescues` endpoint. GeoJSON boundaries are optional; if unavailable, rescue pins still render.

## End-to-end dispatch and push test (physical iPhone)

The Mapbox WebView works in Expo Go, but **remote push notifications do not**. Use a development build with a configured EAS project and APNs credentials. Expo Go is not a valid test for receiving remote push.

1. Configure EAS once in `packages/mobile` using `npx eas-cli init` (sign into your Expo account when requested). This supplies `extra.eas.projectId` in the Expo app configuration.
2. Install an iOS development build (`npx expo run:ios --device` for local native builds, or an EAS development build). Ensure notification entitlements/APNs credentials are configured for the installed app.
3. On the phone, open **Settings → Push notification readiness** and tap **Check push registration**. It must say the device is registered, and the registered device count must be at least one. A successful permission prompt alone is not enough.
4. In the Rescue Hub app Settings, select **Override** and switch availability **ON** (or follow a schedule whose current period is active).
5. In a browser, log into the same NATF organisation at `https://rescue.michaelcuneo.com.au`, click **New rescue**, set a location, and create a **Blue-tongue lizard** rescue (a non-venomous reptile). Use a clearly fictional test description.
6. The dispatcher now shows the number of qualified users, registered devices, and accepted/rejected Expo push tickets. **Accepted by Expo is not proof of delivery**; observe the notification arriving on the device to complete the test. The app polls the GraphQL-backed rescue feed while foregrounded, independently of push.

If the map remains empty, the mobile feed now displays whether there are no open cases, no cases matching assigned teams, or no browser access under the current role. A backend redeployment is required for the feed diagnostics, registration count and dispatcher push-result panel.

## Availability

Modes: `ON` always available, `OFF` unavailable, `SCHEDULE` follow weekday and time windows in configured IANA timezone. Server evaluates effective availability at request/notification/claim time; no background timer is necessary. Mobile app can save up to eight non-overlapping windows per day including overnight windows. Previously configured legacy manual status is preserved until a policy is saved.

Push notifications need physical iOS/Android device and Expo/EAS project ID. The admin portal's user records show the effective availability as loaded; they do not currently auto-update in real time when a schedule boundary passes.
