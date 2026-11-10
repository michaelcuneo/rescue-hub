<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { subscribeRescueChanges, type RealtimeConfig } from '../../../../core/realtime-client';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  type Channel = {
    id: string; name: string; description: string; unread: boolean;
    latest?: { senderName: string; text: string; createdAt: string };
  };
  type Message = {
    id: string; channelId: string; senderUserId: string; senderName: string;
    text: string; createdAt: string; animalId?: string;
  };
  let channels = $state<Channel[]>([]);
  let selectedId = $state('');
  let messages = $state<Message[]>([]);
  let cursor = $state<string | null>(null);
  let draft = $state('');
  let busy = $state(false);
  let error = $state('');
  let loading = $state(true);
  let messagePanel: HTMLElement;
  const selected = $derived(channels.find(channel => channel.id === selectedId));

  async function api<T>(url: string, method = 'GET', body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(url, {
      method, cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? 'Unable to load chat.');
    return payload;
  }
  async function refreshChannels() {
    const response = await api<{ channels: Channel[] }>('/api/mobile/chats');
    channels = response.channels;
    if (selectedId && !channels.some(channel => channel.id === selectedId)) {
      selectedId = ''; messages = [];
    }
  }
  async function refreshMessages(id = selectedId) {
    if (!id) return;
    const response = await api<{ items: Message[]; nextCursor: string | null }>(
      `/api/mobile/chats/${encodeURIComponent(id)}`
    );
    if (id !== selectedId) return;
    const oldLatest = messages.at(-1)?.id;
    messages = response.items; cursor = response.nextCursor;
    const last = response.items.at(-1);
    if (last) {
      void api(`/api/mobile/chats/${encodeURIComponent(id)}`, 'PATCH', { messageId: last.id }).catch(() => {});
      channels = channels.map(channel => channel.id === id ? { ...channel, unread: false } : channel);
    }
    if (last?.id !== oldLatest) {
      await tick();
      messagePanel?.scrollTo({ top: messagePanel.scrollHeight, behavior: 'smooth' });
    }
  }
  async function selectChannel(id: string) {
    selectedId = id; messages = []; cursor = null; error = '';
    try { await refreshMessages(id); } catch (e) {
      error = e instanceof Error ? e.message : 'Chat unavailable.';
    }
  }
  async function loadOlder() {
    if (!selectedId || !cursor || busy) return;
    busy = true;
    try {
      const result = await api<{ items: Message[]; nextCursor: string | null }>(
        `/api/mobile/chats/${encodeURIComponent(selectedId)}?before=${encodeURIComponent(cursor)}`
      );
      messages = [...result.items.filter(item => !messages.some(existing => existing.id === item.id)), ...messages];
      cursor = result.nextCursor;
    } catch (e) { error = e instanceof Error ? e.message : 'Could not load earlier messages.'; }
    finally { busy = false; }
  }
  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedId || busy || !draft.trim()) return;
    busy = true; error = '';
    try {
      await api(`/api/mobile/chats/${encodeURIComponent(selectedId)}`, 'POST', { text: draft });
      draft = '';
      await refreshMessages();
      await refreshChannels();
    } catch (e) { error = e instanceof Error ? e.message : 'Could not send message.'; }
    finally { busy = false; }
  }
  onMount(() => {
    let disposed = false;
    let stop: (() => void) | null = null;
    void refreshChannels().catch(e => { if (!disposed) error = String(e); })
      .finally(() => loading = false);
    void fetch('/api/realtime', { cache: 'no-store' }).then(async response => {
      if (!response.ok) return;
      const config = await response.json() as RealtimeConfig;
      if (disposed) return;
      stop = subscribeRescueChanges(config, { onChange: () => {
        void refreshChannels().catch(() => {});
        if (selectedId) void refreshMessages(selectedId).catch(() => {});
      } });
    }).catch(() => {});
    const interval = setInterval(() => {
      if (disposed) return;
      void refreshChannels().catch(() => {});
      if (selectedId) void refreshMessages(selectedId).catch(() => {});
    }, 15000);
    return () => { disposed = true; stop?.(); clearInterval(interval); };
  });
</script>

<svelte:head><title>Organisation Chats · Rescue Hub</title></svelte:head>
<main class="page">
  <header class="topbar">
    <a href="/" class="back">← Rescues</a>
    <div><h1>Chats</h1><p>Organisation conversations and care groups</p></div>
    <span class="signed">{data.name}</span>
  </header>
  <div class="chat-layout">
    <aside class:hide-mobile={Boolean(selectedId)} aria-label="Chat channels">
      <h2>Channels</h2>
      {#if loading}<p class="muted">Loading channels…</p>{/if}
      {#each channels as channel (channel.id)}
        <button class:active={selectedId === channel.id} onclick={() => void selectChannel(channel.id)}>
          <span class="avatar" aria-hidden="true">{channel.name.slice(0,1)}</span>
          <span class="channel-detail">
            <strong>{channel.name}</strong>
            <small>{channel.latest ? `${channel.latest.senderName}: ${channel.latest.text}` : channel.description}</small>
          </span>
          {#if channel.unread}<span class="dot" aria-label="Unread messages"></span>{/if}
        </button>
      {:else}<p class="muted">No chats assigned to your membership.</p>{/each}
    </aside>
    <section class:hide-mobile={!selectedId} class="conversation" aria-label="Messages">
      {#if selectedId}
        <div class="conversation-header">
          <button class="mobile-back" onclick={() => selectedId = ''} aria-label="Back to channels">‹</button>
          <div><h2>{selected?.name ?? 'Channel'}</h2><small>{selected?.description ?? ''}</small></div>
        </div>
        {#if error}<p role="alert" class="error">{error}</p>{/if}
        {#if cursor}<button class="older" onclick={() => void loadOlder()} disabled={busy}>Load earlier messages</button>{/if}
        <div class="messages" bind:this={messagePanel}>
          {#each messages as item (item.id)}
            <article class:mine={item.senderUserId === data.userId}>
              {#if item.senderUserId !== data.userId}<strong>{item.senderName}</strong>{/if}
              <p>{item.text}</p>
              <time datetime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-AU', { hour: 'numeric', minute: '2-digit', day:'numeric', month:'short' })}</time>
              {#if item.animalId}<p class="animal-ref">Animal reference: {item.animalId}</p>{/if}
            </article>
          {:else}<p class="muted">Start a conversation with this group.</p>{/each}
        </div>
        <form onsubmit={send}>
          <label class="sr-only" for="chat-message">Message to {selected?.name ?? 'channel'}</label>
          <textarea id="chat-message" maxlength="2000" rows="2" bind:value={draft} placeholder="Message your group…"></textarea>
          <button class="send" disabled={busy || !draft.trim()}>Send</button>
        </form>
      {:else}
        <div class="placeholder"><h2>Stay connected</h2><p>Select a channel to coordinate rescues, transport and day-to-day care.</p></div>
      {/if}
    </section>
  </div>
</main>
<style>
  :global(body){margin:0;background:#f1f5f2;color:#173d2c;font-family:system-ui,sans-serif}
  .page{max-width:1350px;padding:18px 24px 40px;margin:auto}
  .topbar{display:flex;align-items:center;gap:25px;padding-bottom:16px}
  .topbar h1{font-size:27px;margin:0}.topbar p{font-size:13px;color:#718077;margin:3px 0}
  .back{color:#24583f;text-decoration:none;font-weight:750}
  .signed{margin-left:auto;color:#718077;font-size:12px}
  .chat-layout{display:grid;grid-template-columns:minmax(260px,350px) minmax(0,1fr);height:min(78vh,850px);min-height:530px;background:white;border:1px solid #dce6df;border-radius:18px;overflow:hidden}
  aside{overflow-y:auto;border-right:1px solid #e2e9e4;padding:14px 9px}
  aside h2{font-size:14px;padding:4px 12px 10px;color:#6d7a70}
  aside button{display:flex;align-items:center;gap:12px;padding:12px;width:100%;border:0;background:white;border-radius:12px;text-align:left;cursor:pointer;color:inherit}
  aside button:hover,aside button.active{background:#eff6f1}
  .avatar{height:42px;width:42px;border-radius:50%;display:grid;place-items:center;background:#dcebe0;font-size:18px;font-weight:800}
  .channel-detail{min-width:0;flex:1;display:grid;gap:3px}
  .channel-detail strong{font-size:14px}
  .channel-detail small{font-size:12px;color:#738379;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dot{height:9px;width:9px;border-radius:50%;background:#26724f}
  .conversation{display:flex;flex-direction:column;min-width:0;min-height:0}
  .conversation-header{padding:17px 22px;border-bottom:1px solid #e2e9e4;display:flex;align-items:center;gap:12px}
  .conversation-header h2{margin:0;font-size:18px}
  .conversation-header small{color:#79877d}
  .messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:24px}
  article{align-self:flex-start;background:#eff3f0;border-radius:14px 14px 14px 4px;max-width:min(82%,610px);padding:11px 15px;overflow-wrap:anywhere}
  article.mine{align-self:flex-end;background:#dbefe0;border-radius:14px 14px 4px 14px}
  article strong{font-size:12px;color:#286343}article p{margin:5px 0 3px;white-space:pre-wrap;line-height:1.5;font-size:14px}
  article time{font-size:11px;color:#7d8b81;display:block;text-align:right}
  .animal-ref{color:#3c6950;font-size:11px}
  form{border-top:1px solid #e2e9e4;padding:12px;display:flex;align-items:end;gap:9px}
  textarea{resize:vertical;flex:1;min-width:0;padding:12px 15px;border:1px solid #d9e3dc;border-radius:15px;font:inherit}
  .send{padding:13px 22px;border:0;border-radius:12px;background:#173d2c;color:white;font-weight:800;cursor:pointer}
  button:disabled{opacity:.5}.error{padding:8px 18px;color:#a23f35}
  .muted{color:#77887a}.older{align-self:center;background:transparent;border:0;padding:12px;color:#276e4c;font-weight:750;cursor:pointer}
  .placeholder{margin:auto;padding:30px;text-align:center;color:#687b6d}
  .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  .mobile-back{display:none}
  @media(max-width:680px){.page{padding:6px}.topbar{padding:12px}.signed{display:none}.chat-layout{display:block;height:calc(100dvh - 115px);min-height:350px;border-radius:12px}.chat-layout aside,.chat-layout section{height:100%;border:0}.hide-mobile{display:none!important}.mobile-back{display:block;background:transparent;border:0;font-size:30px;color:#286343;cursor:pointer}.messages{padding:12px}article{max-width:88%}}
</style>
