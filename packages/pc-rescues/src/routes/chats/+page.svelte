<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { subscribeRescueChanges, type RealtimeConfig } from '../../../../core/realtime-client';
  import type { PageData } from './$types';
  import { shouldSendChatOnKey } from '../../../../core/chat-composer-keyboard';
  let { data }: { data: PageData } = $props();
  type Channel = {
    id: string; name: string; description: string; unread: boolean;
    recipientUserId?: string; recipientAvailability?: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
    latest?: { senderName: string; text: string; createdAt: string };
  };
  type Message = {
    id: string; channelId: string; senderUserId: string; senderName: string;
    text: string; createdAt: string; animalId?: string;
  };
  type Organisation = { id: string; name: string };
  type Member = {
    id: string; name: string; availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
    labels: string[]; positionTitle?: string;
  };
  let members = $state<Member[]>([]);
  let searchMembers = $state('');
  let channelMembers = $state<Member[]>([]);
  let showChannelMembers = $state(false);
  let listMode = $state<'channels' | 'people'>('channels');
  const membersVisible = $derived(members.filter(member => member.id !== data.userId &&
    [member.name, ...member.labels].join(' ').toLowerCase().includes(searchMembers.toLowerCase()))
    .sort((a,b) => ({ AVAILABLE: 0, BUSY: 1, OFFLINE: 2 })[a.availability] -
      ({ AVAILABLE: 0, BUSY: 1, OFFLINE: 2 })[b.availability] || a.name.localeCompare(b.name)));
  const selectedRecipient = $derived(members.find(member => member.id === selected?.recipientUserId));
  const busyRecipient = $derived(selected?.recipientAvailability === 'BUSY' || selectedRecipient?.availability === 'BUSY');

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
  async function refreshMembers() {
    const scope = organisationId;
    const result = await api<{ members: Member[] }>(chatUrl('/api/mobile/chats/members'));
    if (scope !== organisationId) return;
    members = result.members;
  }
  async function refreshChannelMembers(id = selectedId) {
    if (!id) return;
    const params = new URLSearchParams();
    if (organisationId) params.set('organisationId', organisationId);
    params.set('channelId', id);
    const result = await api<{ members: Member[] }>(`/api/mobile/chats/members?${params.toString()}`);
    if (id === selectedId) channelMembers = result.members;
  }
  async function openDirect(recipientId: string) {
    busy = true; error = '';
    try {
      const response = await api<{ channelId: string }>(chatUrl('/api/mobile/chats/direct'), 'POST', { recipientUserId: recipientId });
      await refreshChannels();
      await selectChannel(response.channelId);
    } catch (e) { error = e instanceof Error ? e.message : 'Could not open direct conversation.'; }
    finally { busy = false; }
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
    selectedId = ''; messages = []; channelMembers = []; showChannelMembers = false; cursor = null; draft = ''; error = ''; loading = true;
    try { await Promise.all([refreshChannels(), refreshMembers()]); }
    catch (e) { error = e instanceof Error ? e.message : 'Could not load organisation chats.'; }
    finally { loading = false; }
  }
  async function selectChannel(id: string) {
    selectedId = id; messages = []; cursor = null; channelMembers = []; showChannelMembers = false; error = '';
    try { await Promise.all([refreshMessages(id), refreshChannelMembers(id)]); } catch (e) {
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
  function onChatKeydown(event: KeyboardEvent) {
    if (!shouldSendChatOnKey(event)) return;
    event.preventDefault();
    if (event.target instanceof HTMLTextAreaElement && event.target.form) {
      event.target.form.requestSubmit();
    }
  }
  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedId || busy || busyRecipient || !draft.trim()) return;
    busy = true; error = '';
    try {
      await api(chatUrl(`/api/mobile/chats/${encodeURIComponent(selectedId)}`), 'POST', { text: draft });
      draft = '';
      await refreshMessages();
      await Promise.all([refreshChannels(), refreshMembers()]);
    } catch (e) { error = e instanceof Error ? e.message : 'Could not send message.'; }
    finally { busy = false; }
  }
  onMount(() => {
    let disposed = false;
    let stop: (() => void) | null = null;
    void Promise.all([refreshChannels(), refreshMembers()]).catch(e => { if (!disposed) error = String(e); })
      .finally(() => loading = false);
    void fetch('/api/realtime', { cache: 'no-store' }).then(async response => {
      if (!response.ok) return;
      const config = await response.json() as RealtimeConfig;
      if (disposed) return;
      stop = subscribeRescueChanges(config, { onChange: () => {
        void Promise.all([refreshChannels(), refreshMembers()]).catch(() => {});
        if (selectedId) { void refreshMessages(selectedId).catch(() => {}); void refreshChannelMembers(selectedId).catch(() => {}); }
      } });
    }).catch(() => {});
    const interval = setInterval(() => {
      if (disposed) return;
      void Promise.all([refreshChannels(), refreshMembers()]).catch(() => {});
      if (selectedId) { void refreshMessages(selectedId).catch(() => {}); void refreshChannelMembers(selectedId).catch(() => {}); }
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
    <aside class:hide-mobile={Boolean(selectedId)} aria-label="Chats and member directory">
      <div class="chat-list-tabs" role="group" aria-label="Chat list view">
        <button class:active-tab={listMode === 'channels'} onclick={() => listMode = 'channels'}>Conversations</button>
        <button class:active-tab={listMode === 'people'} onclick={() => listMode = 'people'}>People</button>
      </div>
      {#if listMode === 'channels'}
        {#if loading}<p class="muted">Loading conversations…</p>{/if}
        {#each channels as channel (channel.id)}
          <button class:active={selectedId === channel.id} onclick={() => void selectChannel(channel.id)}>
            <span class="avatar" aria-hidden="true">{channel.name.slice(0,1)}</span>
            <span class="channel-detail">
              <strong>{channel.name}</strong>
              <small>{channel.latest ? `${channel.latest.senderName}: ${channel.latest.text}` : channel.description}</small>
            </span>
            {#if channel.recipientUserId}
              <span class="presence" data-status={channel.recipientAvailability ?? 'OFFLINE'} aria-label={channel.recipientAvailability ?? 'Offline'} title={channel.recipientAvailability ?? 'Offline'}></span>
            {/if}
            {#if channel.unread}<span class="dot" aria-label="Unread messages"></span>{/if}
          </button>
        {:else}<p class="muted">No conversations yet. Select People to start a private chat.</p>{/each}
      {:else}
        <label for="chat-member-search" class="sr-only">Find a person</label>
        <input id="chat-member-search" type="search" bind:value={searchMembers} placeholder="Find members by name or role" class="member-search" />
        <p class="directory-hint">Availability reflects members' rescue schedules and overrides. Busy members cannot receive new private messages.</p>
        {#each membersVisible as member (member.id)}
          <button onclick={() => void openDirect(member.id)} disabled={busy}
            aria-label={`Chat with ${member.name}, ${member.availability.toLowerCase()}, ${member.labels.join(', ')}`}>
            <span class="avatar" aria-hidden="true">{member.name.slice(0,1)}</span>
            <span class="channel-detail">
              <strong>{member.name}</strong>
              <small>{member.labels.join(' · ') || 'Organisation member'}</small>
            </span>
            <span class="presence" data-status={member.availability} title={member.availability} aria-label={member.availability}></span>
          </button>
        {:else}<p class="muted">No matching members.</p>{/each}
      {/if}
    </aside>
    <section class:hide-mobile={!selectedId} class="conversation" aria-label="Messages">
      {#if selectedId}
        <div class="conversation-header">
          <button class="mobile-back" onclick={() => { selectedId = ''; showChannelMembers = false; }} aria-label="Back to channels">‹</button>
          <div><h2>{selected?.name ?? 'Channel'}</h2>
            <small>{selected?.recipientUserId ? `${selectedRecipient?.labels.join(' · ') || 'Organisation member'} · ${(selectedRecipient?.availability ?? selected?.recipientAvailability ?? 'OFFLINE').toLowerCase()}` : selected?.description ?? ''}</small>
          </div>
          <button class="members-trigger" onclick={() => showChannelMembers = !showChannelMembers}
            aria-expanded={showChannelMembers} aria-label="Show people in this channel">
            People ({channelMembers.length})
          </button>
        </div>
        {#if showChannelMembers}
          <div class="channel-people" aria-label="Channel members">
            {#each channelMembers as member (member.id)}
              <button disabled={member.id === data.userId || busy}
                onclick={() => void openDirect(member.id)} title={member.labels.join(' · ')}>
                <span class="presence" data-status={member.availability} aria-label={member.availability}></span>
                <strong>{member.name}</strong>
                <small>{member.labels.join(' · ')}</small>
              </button>
            {:else}<p class="muted">No active members.</p>{/each}
          </div>
        {/if}
        {#if error}<p role="alert" class="error">{error}</p>{/if}
        {#if cursor}<button class="older" onclick={() => void loadOlder()} disabled={busy}>Load earlier messages</button>{/if}
        <div class="messages" bind:this={messagePanel}>
          {#each messages as item (item.id)}
            <article class:mine={item.senderUserId === data.userId}>
              {#if item.senderUserId !== data.userId}
                <button class="sender-name" onclick={() => void openDirect(item.senderUserId)}
                  title="Start a private conversation with {item.senderName}">{item.senderName}</button>
              {/if}
              <p>{item.text}</p>
              <time datetime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-AU', { hour: 'numeric', minute: '2-digit', day:'numeric', month:'short' })}</time>
              {#if item.animalId}<p class="animal-ref">Animal reference: {item.animalId}</p>{/if}
            </article>
          {:else}<p class="muted">Start a conversation with this group.</p>{/each}
        </div>
        {#if busyRecipient}
          <p class="busy-explanation" role="status">This member is busy. You can read the conversation, but new private messages are paused until they're available.</p>
        {/if}
        <form onsubmit={send}>
          <label class="sr-only" for="chat-message">Message to {selected?.name ?? 'channel'}</label>
          <textarea id="chat-message" maxlength="2000" rows="2" bind:value={draft}
            onkeydown={onChatKeydown} placeholder={selected?.recipientUserId ? "Write a private message…" : "Message your group…"}
            aria-describedby="chat-compose-shortcut"></textarea>
          <span id="chat-compose-shortcut" class="sr-only">Press Enter to send. Press Shift and Enter to start a new line.</span>
          <button class="send" disabled={busy || busyRecipient || !draft.trim()}>Send</button>
        </form>
      {:else}
        <div class="placeholder"><h2>Stay connected</h2><p>Select a channel to coordinate rescues, transport and day-to-day care.</p></div>
      {/if}
    </section>
  </div>
</main>
<style>
  :global(body){margin:0;background:var(--rh-background);color:var(--rh-text);font-family:system-ui,sans-serif}
  .page{min-height:100dvh;width:100%;padding:var(--rh-content-top) var(--rh-gutter) var(--rh-gutter);background:var(--rh-background);color:var(--rh-text)}
  .org-selector{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:16px}
  .org-selector label{font-weight:750;font-size:14px}
  .org-selector select{min-height:44px;min-width:220px;max-width:100%;border:1px solid var(--rh-t159, #b7c8bd);border-radius:10px;background:var(--rh-t6, white);color:var(--rh-t3, #173d2c);padding:8px 12px;font:inherit}
  .org-selector span{font-size:12px;color:var(--rh-t160, #718077)}
  .chat-heading{display:flex;flex-direction:column;gap:3px;margin-bottom:16px;}
  .chat-heading h1{font-size:27px;margin:0;color:var(--rh-text)}
  .chat-heading p{font-size:13px;margin:0;color:var(--rh-muted)}
  .chat-layout{display:grid;grid-template-columns:minmax(260px,350px) minmax(0,1fr);height:calc(100dvh - var(--rh-content-top) - 84px);min-height:430px;background:var(--rh-surface);color:var(--rh-text);border:1px solid var(--rh-border);box-shadow:var(--rh-shadow);border-radius:16px;overflow:hidden}
  .chat-list-tabs{display:flex;gap:5px;padding:6px 8px 12px}
  .chat-list-tabs button{justify-content:center;width:50%;min-height:40px;font-weight:750;border:1px solid var(--rh-border)}
  .chat-list-tabs button.active-tab{background:var(--rh-nav-active);color:var(--rh-text)}
  .member-search{width:calc(100% - 16px);margin:0 8px 10px;min-height:42px;padding:9px 12px;border:1px solid var(--rh-border);border-radius:10px;background:var(--rh-surface);color:var(--rh-text);font:inherit}
  .directory-hint{font-size:11px;line-height:1.5;color:var(--rh-muted);padding:0 12px 10px}
  .presence{flex-shrink:0;width:11px;height:11px;border-radius:50%;background:#7c8580;border:1px solid var(--rh-border)}
  .presence[data-status='AVAILABLE']{background:#17854c}
  .presence[data-status='BUSY']{background:#bd7121}
  .members-trigger{margin-left:auto;background:var(--rh-surface-soft);border:1px solid var(--rh-border);border-radius:9px;padding:9px 13px;color:var(--rh-text);cursor:pointer;font-weight:700;white-space:nowrap}
  .channel-people{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px;background:var(--rh-surface-soft);border-bottom:1px solid var(--rh-border);max-height:150px;overflow:auto}
  .channel-people button{display:flex;align-items:center;gap:7px;border:1px solid var(--rh-border);background:var(--rh-surface);color:var(--rh-text);border-radius:9px;padding:8px 10px;cursor:pointer}
  .channel-people small{font-size:11px;color:var(--rh-muted)}
  .sender-name{display:block;border:0;padding:0;background:none;color:var(--rh-primary);font:inherit;font-size:12px;font-weight:800;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
  .busy-explanation{padding:10px 20px;margin:0;border-top:1px solid var(--rh-border);color:var(--rh-text);background:var(--rh-surface-soft);font-size:12px}
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
  article{align-self:flex-start;background:var(--rh-surface-soft);border-radius:14px 14px 14px 4px;max-width:min(82%,610px);padding:11px 15px;overflow-wrap:anywhere}
  article.mine{align-self:flex-end;background:var(--rh-raised);border-radius:14px 14px 4px 14px}
  article strong{font-size:12px;color:var(--rh-t171, #286343)}article p{margin:5px 0 3px;white-space:pre-wrap;line-height:1.5;font-size:14px}
  article time{font-size:11px;color:var(--rh-t172, #7d8b81);display:block;text-align:right}
  .animal-ref{color:var(--rh-t173, #3c6950);font-size:11px}
  form{border-top:1px solid var(--rh-t163, #e2e9e4);padding:12px;display:flex;align-items:end;gap:9px}
  textarea{resize:vertical;flex:1;min-width:0;padding:12px 15px;border:1px solid var(--rh-t174, #d9e3dc);border-radius:15px;font:inherit}
  .send{padding:13px 22px;border:0;border-radius:12px;background:var(--rh-primary);color:var(--rh-on-primary);font-weight:800;cursor:pointer}
  button:disabled{opacity:.5}.error{padding:8px 18px;color:var(--rh-t69, #a23f35)}
  .muted{color:var(--rh-t175, #77887a)}.older{align-self:center;background:transparent;border:0;padding:12px;color:var(--rh-t176, #276e4c);font-weight:750;cursor:pointer}
  .placeholder{margin:auto;padding:30px;text-align:center;color:var(--rh-t177, #687b6d)}
  .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  .mobile-back{display:none}
  @media(max-width:680px){.page{padding:var(--rh-content-top) var(--rh-gutter) var(--rh-gutter)}.chat-heading{margin-bottom:8px}.chat-layout{display:block;height:calc(100dvh - var(--rh-content-top) - 80px);min-height:350px;border-radius:12px}.chat-layout aside,.chat-layout section{height:100%;border:0}.hide-mobile{display:none!important}.mobile-back{display:block;background:transparent;border:0;font-size:30px;color:var(--rh-t171, #286343);cursor:pointer}.messages{padding:12px}article{max-width:88%}}
</style>
