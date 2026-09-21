# Rescue Hub Mobile

React Native / Expo client for wildlife rescuers and transport volunteers.

## Development

Set the HTTPS Rescue Hub origin visible to the physical device:

```bash
export EXPO_PUBLIC_RESCUE_HUB_API_URL="https://your-rescue-hub-host"
npm run start --workspace=@rescue-hub/mobile
```

Push notifications require a physical iOS or Android device and an Expo/EAS project ID.

Dispatch eligibility is decided server-side from organisation membership, membership type, team assignment, availability and rescue capability. A transport team may be configured with `receivesAllRescues: true`.
