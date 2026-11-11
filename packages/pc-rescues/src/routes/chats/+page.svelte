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
  type Organisation = { id: string; name: string };
  let organisations = $state<Organisation[]>([]);
  let organisationId = $state('');
  let channels = $state<Channel[]>([]);
  let selectedId = $state('');
  let messages = $state<Message[]>([]);
  let cursor = $state<string | null>(null);
  let draft = $state('');
  let busy = $state(false);
  let error = $state('');
  let loading = $state(true);
  let messagePanel = $state<HTMLElement | undefined>(undefined);
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
  const chatUrl = (path: string, before?: string) => {
    const params = new URLSearchParams();
    if (organisationId) params.set('organisationId', organisationId);
    if (before) params.set('before', before);
    return path + (params.size ? '?' + params.toString() : '');
  };
  async function refreshChannels() {
    const response = await api<{ channels: Channel[]; organisations: Organisation[]; organisationId: string }>(
      chatUrl('/api/mobile/chats')
    );
    if (!organisationId) organisationId = response.organisationId;
    organisations = response.organisations;
    channels = response.channels;
    if (selectedId && !channels.some(channel => channel.id === selectedId)) {
      selectedId = ''; messages = [];
    }
  }
  async function refreshMessages(id = selectedId) {
    if (!id) return;
    const response = await api<{ items: Message[]; nextCursor: string | null }>(
      chatUrl(`/api/mobile/chats/${encodeURIComponent(id)}`)
    );
    if (id !== selectedId) return;
    const oldLatest = messages.at(-1)?.id;
    messages = response.items; cursor = response.nextCursor;
    const last = response.items.at(-1);
    if (last) {
      void api(chatUrl(`/api/mobile/chats/${encodeURIComponent(id)}`), 'PATCH', { messageId: last.id }).catch(() => {});
      channels = channels.map(channel => channel.id === id ? { ...channel, unread: false } : channel);
    }
    if (last?.id !== oldLatest) {
      await tick();
      messagePanel?.scrollTo({ top: messagePanel.scrollHeight, behavior: 'smooth' });
    }
  }
  async function selectOrganisation(id: string) {
    if (id === organisationId) return;
    organisationId = id;
    selectedId = ''; messages = []; cursor = null; draft = ''; error = ''; loading = true;
    try { await refreshChannels(); }
    catch (e) { error = e instanceof Error ? e.message : 'Could not load organisation chats.'; }
    finally { loading = false; }
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
        chatUrl(`/api/mobile/chats/${encodeURIComponent(selectedId)}`, cursor)
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
      await api(chatUrl(`/api/mobile/chats/${encodeURIComponent(selectedId)}`), 'POST', { text: draft });
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
  <div class="chat-heading"><h1>Chats</h1><p>Organisation conversations and care groups</p></div>
  {#if data.canSelectOrganisation}
    <div class="org-selector">
      <label for="chat-organisation">Viewing organisation chats</label>
      <select id="chat-organisation" value={organisationId}
        onchange={(event) => void selectOrganisation(event.currentTarget.value)}>
        {#each organisations as organisation (organisation.id)}
          <option value={organisation.id}>{organisation.name}</option>
        {/each}
      </select>
      <span>Platform oversight · organisation-scoped messages</span>
    </div>
  {/if}
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
  :global(body){margin:0;background:var(--rh-t44, #f1f5f2);color:var(--rh-t3, #173d2c);font-family:system-ui,sans-serif}
  .page{max-width:1350px;padding:calc(var(--rh-content-top) + 16px) 24px 40px;margin:auto}
  .org-selector{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:16px}
  .org-selector label{font-weight:750;font-size:14px}
  .org-selector select{min-height:44px;min-width:220px;max-width:100%;border:1px solid var(--rh-t159, #b7c8bd);border-radius:10px;background:var(--rh-t6, white);color:var(--rh-t3, #173d2c);padding:8px 12px;font:inherit}
  .org-selector span{font-size:12px;color:var(--rh-t160, #718077)}
  .chat-heading{display:flex;flex-direction:column;gap:3px;margin-bottom:16px;}
  .chat-heading h1{font-size:27px;margin:0;color:var(--rh-text)}
  .chat-heading p{font-size:13px;margin:0;color:var(--rh-muted)}
  .chat-layout{display:grid;grid-template-columns:minmax(260px,350px) minmax(0,1fr);height:min(78vh,850px);min-height:530px;background:var(--rh-t6, white);border:1px solid var(--rh-t162, #dce6df);border-radius:18px;overflow:hidden}
  aside{overflow-y:auto;border-right:1px solid var(--rh-t163, #e2e9e4);padding:14px 9px}
  aside h2{font-size:14px;padding:4px 12px 10px;color:var(--rh-t164, #6d7a70)}
  aside button{display:flex;align-items:center;gap:12px;padding:12px;width:100%;border:0;background:var(--rh-t6, white);border-radius:12px;text-align:left;cursor:pointer;color:inherit}
  aside button:hover,aside button.active{background:var(--rh-t165, #eff6f1)}
  .avatar{height:42px;width:42px;border-radius:50%;display:grid;place-items:center;background:var(--rh-t166, #dcebe0);font-size:18px;font-weight:800}
  .channel-detail{min-width:0;flex:1;display:grid;gap:3px}
  .channel-detail strong{font-size:14px}
  .channel-detail small{font-size:12px;color:var(--rh-t167, #738379);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dot{height:9px;width:9px;border-radius:50%;background:#26724f}
  .conversation{display:flex;flex-direction:column;min-width:0;min-height:0}
  .conversation-header{padding:17px 22px;border-bottom:1px solid var(--rh-t163, #e2e9e4);display:flex;align-items:center;gap:12px}
  .conversation-header h2{margin:0;font-size:18px}
  .conversation-header small{color:var(--rh-t168, #79877d)}
  .messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:24px}
  article{align-self:flex-start;background:var(--rh-t169, #eff3f0);border-radius:14px 14px 14px 4px;max-width:min(82%,610px);padding:11px 15px;overflow-wrap:anywhere}
  article.mine{align-self:flex-end;background:var(--rh-t170, #dbefe0);border-radius:14px 14px 4px 14px}
  article strong{font-size:12px;color:var(--rh-t171, #286343)}article p{margin:5px 0 3px;white-space:pre-wrap;line-height:1.5;font-size:14px}
  article time{font-size:11px;color:var(--rh-t172, #7d8b81);display:block;text-align:right}
  .animal-ref{color:var(--rh-t173, #3c6950);font-size:11px}
  form{border-top:1px solid var(--rh-t163, #e2e9e4);padding:12px;display:flex;align-items:end;gap:9px}
  textarea{resize:vertical;flex:1;min-width:0;padding:12px 15px;border:1px solid var(--rh-t174, #d9e3dc);border-radius:15px;font:inherit}
  .send{padding:13px 22px;border:0;border-radius:12px;background:#173d2c;color:white;font-weight:800;cursor:pointer}
  button:disabled{opacity:.5}.error{padding:8px 18px;color:var(--rh-t69, #a23f35)}
  .muted{color:var(--rh-t175, #77887a)}.older{align-self:center;background:transparent;border:0;padding:12px;color:var(--rh-t176, #276e4c);font-weight:750;cursor:pointer}
  .placeholder{margin:auto;padding:30px;text-align:center;color:var(--rh-t177, #687b6d)}
  .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  .mobile-back{display:none}
  @media(max-width:680px){.page{padding:calc(var(--rh-content-top) + 6px) 8px 8px}.chat-heading{margin-bottom:8px}.chat-layout{display:block;height:calc(100dvh - var(--rh-content-top) - 90px);min-height:350px;border-radius:12px}.chat-layout aside,.chat-layout section{height:100%;border:0}.hide-mobile{display:none!important}.mobile-back{display:block;background:transparent;border:0;font-size:30px;color:var(--rh-t171, #286343);cursor:pointer}.messages{padding:12px}article{max-width:88%}}
</style>
