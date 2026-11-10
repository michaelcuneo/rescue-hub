import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribeRescueChanges } from './realtime-client.ts';

test('AppSync websocket handshake, subscription, invalidation and teardown', () => {
  const sockets = [];
  class FakeWebSocket {
    static OPEN = 1;
    readyState = 1;
    messages = [];
    constructor(url, protocol) {
      this.url = url;
      this.protocol = protocol;
      sockets.push(this);
    }
    send(message) { this.messages.push(JSON.parse(message)); }
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
  }
  const previous = globalThis.WebSocket;
  globalThis.WebSocket = FakeWebSocket;
  try {
    let updated = 0;
    let connected = 0;
    const stop = subscribeRescueChanges({
      url: 'https://example.appsync-api.ap-southeast-2.amazonaws.com/graphql',
      apiKey: 'test-public-subscription-key'
    }, {
      onChange: () => updated++,
      onConnected: () => connected++
    });

    const socket = sockets[0];
    assert.ok(socket);
    const url = new URL(socket.url);
    assert.equal(url.protocol, 'wss:');
    assert.equal(url.hostname, 'example.appsync-realtime-api.ap-southeast-2.amazonaws.com');
    assert.equal(socket.protocol, 'graphql-ws');
    const auth = JSON.parse(Buffer.from(url.searchParams.get('header'), 'base64').toString());
    assert.deepEqual(auth, {
      host: 'example.appsync-api.ap-southeast-2.amazonaws.com',
      'x-api-key': 'test-public-subscription-key'
    });
    socket.onopen();
    assert.deepEqual(socket.messages[0], { type: 'connection_init' });
    socket.onmessage({ data: JSON.stringify({ type: 'connection_ack' }) });
    assert.equal(socket.messages[1].type, 'start');
    assert.equal(socket.messages[1].payload.extensions.authorization.host, auth.host);
    assert.equal(socket.messages[1].payload.extensions.authorization['x-api-key'], auth['x-api-key']);
    assert.equal(JSON.parse(socket.messages[1].payload.data).query,
      'subscription RescueFeed { onChange { revision } }');
    socket.onmessage({ data: JSON.stringify({ type: 'start_ack', id: 'rescue-feed' }) });
    assert.equal(connected, 1);
    socket.onmessage({ data: JSON.stringify({ type: 'data', id: 'rescue-feed',
      payload: { data: { onChange: { revision: 'opaque-test-revision' } } } }) });
    assert.equal(updated, 1);
    socket.onmessage({ data: JSON.stringify({ type: 'data', id: 'another-subscription' }) });
    assert.equal(updated, 1);
    stop();
    assert.equal(socket.messages.at(-1).type, 'stop');
    assert.equal(socket.readyState, 3);
  } finally {
    globalThis.WebSocket = previous;
  }
});
