# Rescue Hub realtime delivery (desktop and React Native)

**Implementation:** `deploy/rescue-demo-domain`, 10 November 2026.

## Architecture

- The existing data AppSync API, DynamoDB and SvelteKit server APIs remain authoritative.
- `packages/infra/realtime.ts` creates a **separate** AppSync GraphQL API:
  - AWS IAM is the default authorization mode. Only the server's Lambda role may call `Mutation.publishChange`.
  - The secondary API key enables `Subscription.onChange` on an **opaque revision**. It cannot write rescue records.
  - The payload contains only a random revision ID. No organisation ID, animal details, private address, identity, or location crosses the public subscription stream.
- `packages/pc-rescues/src/lib/server/realtime.ts` issues an IAM-signed mutation **after** successful rescue/custody writes, including:
  - Create rescue, status changes and assignment
  - Atomic self-claim and claim release
  - Animal registration, care events, vet milestones, custody requests/acceptance and outcomes
- Notification publish failures are logged separately and do **not** negate completed DynamoDB transactions.
- Both clients request `GET /api/realtime` with their existing authenticated session. They receive the **subscription-only** endpoint/key, never the server's data-GraphQL key.
- The shared subscription transport is `packages/core/realtime-client.ts`, using AppSync's `graphql-ws` protocol.
- **Desktop** (`/ `) responds to invalidations by reloading `GET /api/rescues/feed` through its authenticated cookie and organisation/demo scope.
- **Mobile** responds by reloading `GET /api/mobile/rescues` and availability through its existing bearer-token session; capability, organisation and custody filters still apply.
- Both clients refresh upon reconnection and recheck shortly after a change to allow DynamoDB secondary indexes to propagate. While disconnected, a 30-second fallback refresh keeps the UI usable. Mobile closes the socket in the background and reconnects when foregrounded.
- **Remote iPhone push notifications are separate from AppSync subscriptions**. The former requires a native development build and configured APNs/Expo delivery. A live open app can receive GraphQL subscriptions without APNs.

## Manual verification after deployment

1. Deploy the **demo** stage so the new AppSync API, schema, resolver, IAM permission and Web link exist. Pull and install workspace dependencies first.
2. Open desktop Rescue Hub and the signed-in iPhone app. Create a **fictional** blue-tongue rescue via desktop intake. Verify the pin appears in mobile without manual refresh.
3. Claim it on mobile. Verify the desktop pending queue loses it and the assigned queue gains it immediately.
4. Release the claim before animal registration. Verify it reappears as pending on desktop and other qualified accounts.
5. Claim again, register an animal, record vet drop-off and assessment, then request a transport/care handover. Verify desktop/mobile refresh after each change.
6. Accept custody using a **second account**. Verify the original volunteer's active queue drops the case when no animals remain in their custody; the recipient's feed now includes it.
7. Turn off Wi-Fi temporarily and restore connectivity. Verify both clients reconnect and re-fetch. Turn the iPhone screen off and on; verify a fresh authenticated snapshot when returning to the foreground.
8. Check the browser network inspector for the separate `appsync-realtime-api` websocket; the browser/mobile should **never** receive `RescueHubGraphQL.apiKey`.
9. Confirm `npm run check` and the GitHub Actions websocket handshake test both pass.

## Limitations

A successful typecheck or GraphQL handshake unit test does **not** prove an AWS subscription was delivered. The physical desktop+iPhone test above is required after the new infrastructure is deployed. The subscription carries invalidation-only events, not trusted details; the authenticated snapshot remains the source of truth.

Organisation-specific push routing, location privacy and dispatch team matching continue to be enforced by the existing backend endpoints. The opaque stream intentionally does not expose tenant membership.
