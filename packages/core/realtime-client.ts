/**
 * AppSync GraphQL realtime subscription transport for both browsers and
 * React Native. This API emits only opaque invalidation revisions.
 * Never transport animal/rescue records or use the server's data API key.
 */
export type RealtimeConfig = { url: string; apiKey: string };
export type RealtimeOptions = {
  onChange: () => void;
  onConnected?: () => void;
  onStatus?: (connected: boolean) => void;
};

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64Ascii(input: string): string {
  // AppSync authentication headers contain ASCII-only hostname and API key.
  const bytes = Array.from(input, c => c.charCodeAt(0));
  if (bytes.some(byte => byte > 127)) throw new Error('Unexpected non-ASCII realtime authentication header.');
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    output += BASE64.charAt((n >>> 18) & 63) + BASE64.charAt((n >>> 12) & 63) +
      (i + 1 < bytes.length ? BASE64.charAt((n >>> 6) & 63) : '=') +
      (i + 2 < bytes.length ? BASE64.charAt(n & 63) : '=');
  }
  return output;
}

export function subscribeRescueChanges(config: RealtimeConfig, options: RealtimeOptions): () => void {
  const http = new URL(config.url);
  if (http.protocol !== 'https:' || !http.hostname.includes('.appsync-api.')) {
    throw new Error('Invalid AppSync realtime endpoint.');
  }
  const auth = { host: http.hostname, 'x-api-key': config.apiKey };
  const realtimeHostname = http.hostname.replace('.appsync-api.', '.appsync-realtime-api.');
  const wsUrl = `wss://${realtimeHostname}/graphql?header=${encodeURIComponent(base64Ascii(JSON.stringify(auth)))}&payload=e30=`;
  let closed = false;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  const subscriptionId = 'rescue-feed';

  function connect() {
    if (closed) return;
    const ws = new WebSocket(wsUrl, 'graphql-ws');
    socket = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'connection_init' }));
    };
    ws.onmessage = (event: { data: unknown }) => {
      if (closed || socket !== ws || typeof event.data !== 'string') return;
      let frame: { type?: string; id?: string; payload?: unknown };
      try { frame = JSON.parse(event.data); } catch { return; }
      if (frame.type === 'connection_ack') {
        attempts = 0;
        options.onStatus?.(true);
        // Server filtered authorization is not used for this data-free
        // stream: all record access happens through authenticated HTTP APIs.
        ws.send(JSON.stringify({
          id: subscriptionId,
          type: 'start',
          payload: {
            data: JSON.stringify({ query: 'subscription RescueFeed { onChange { revision } }' }),
            extensions: { authorization: auth }
          }
        }));
        return;
      }
      if (frame.type === 'start_ack') {
        options.onConnected?.();
      } else if (frame.type === 'data' && frame.id === subscriptionId) {
        options.onChange();
      } else if (frame.type === 'error' || frame.type === 'connection_error') {
        options.onStatus?.(false);
        ws.close();
      } else if (frame.type === 'complete' && frame.id === subscriptionId) {
        ws.close();
      }
      // 'ka' is AppSync's keepalive. Do not close or reconnect on it.
    };
    ws.onerror = () => options.onStatus?.(false);
    ws.onclose = () => {
      if (socket === ws) socket = null;
      options.onStatus?.(false);
      if (closed) return;
      const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(attempts++, 5)));
      retry = setTimeout(connect, delay);
    };
  }

  connect();
  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: subscriptionId, type: 'stop' }));
    }
    socket?.close();
    socket = null;
  };
}
