/** Visible-tab, connection-aware backstop for Rescue Hub chat realtime.
 * Realtime invalidation drives fresh views; polling is ONLY a safety net.
 */
export const CHAT_REFRESH_CONNECTED_MS = 120_000;
export const CHAT_REFRESH_DISCONNECTED_MS = 20_000;
export const CHAT_MEMBER_REFRESH_MS = 90_000;
export const CHAT_EVENT_COALESCE_MS = 500;

export function shouldPollChat(input: {
  visible: boolean; realtimeConnected: boolean;
  now: number; lastSnapshotAt: number;
}): boolean {
  if (!input.visible) return false;
  const interval = input.realtimeConnected
    ? CHAT_REFRESH_CONNECTED_MS : CHAT_REFRESH_DISCONNECTED_MS;
  return input.now - input.lastSnapshotAt >= interval;
}
