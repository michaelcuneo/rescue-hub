<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  type Message = { id: string; senderRole: 'REPORTER' | 'RESCUER'; text: string; createdAt: string };
  let items = $state<Message[]>([]);
  let text = $state('');
  let role = $state<'REPORTER' | 'RESCUER'>('REPORTER');
  let phone = $state<string | null>(null);
  let error = $state('');
  let busy = $state(false);
  const reportId = $derived(page.params.id);

  async function refresh() {
    const response = await fetch(`/api/public/reports/${encodeURIComponent(reportId)}/messages`, { cache: 'no-store' });
    const data = await response.json() as { items?: Message[]; role?: 'REPORTER' | 'RESCUER'; contactPhone?: string | null; error?: string };
    if (!response.ok) throw new Error(data.error || 'Conversation unavailable');
    items = data.items ?? [];
    role = data.role ?? 'REPORTER';
    phone = data.contactPhone ?? null;
    error = '';
  }
  onMount(() => {
    void refresh().catch(e => error = e instanceof Error ? e.message : 'Unable to open messages');
    const timer = setInterval(() => void refresh().catch(() => {}), 15000);
    return () => clearInterval(timer);
  });
  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    busy = true;
    try {
      const response = await fetch(`/api/public/reports/${encodeURIComponent(reportId)}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Message could not be sent');
      text = '';
      await refresh();
    } catch (e) { error = e instanceof Error ? e.message : 'Unable to send message'; }
    finally { busy = false; }
  }
</script>
<svelte:head><title>Wildlife rescue messages — Rescue Hub</title></svelte:head>
<main>
  <nav><a href={role === 'REPORTER' ? '/report' : '/'}>← Back to Rescue Hub</a></nav>
  <h1>{role === 'REPORTER' ? 'Your rescue conversation' : 'Contact the wildlife reporter'}</h1>
  <p>Messages are visible only to the reporter and assigned rescuer when the reporter has opted in. For emergencies, contact local emergency services.</p>
  {#if phone}<p><a href={`tel:${phone}`}>Call reporter: {phone}</a></p>{/if}
  {#if error}<p role="alert" class="error">{error}</p>{/if}
  <section aria-label="Conversation messages">
    {#each items as item (item.id)}
      <article><strong>{item.senderRole === 'REPORTER' ? 'Reporter' : 'Rescuer'}</strong>
        <time datetime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-AU')}</time>
        <p>{item.text}</p></article>
    {/each}
    {#if items.length === 0}<p>No messages yet.</p>{/if}
  </section>
  <form onsubmit={send}>
    <label for="message">Send a message</label>
    <textarea id="message" bind:value={text} maxlength="1500" required rows="3"></textarea>
    <button disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
  </form>
</main>
<style>
  :global(body){margin:0;background:#f1f5f2;font-family:system-ui,sans-serif;color:#173d2c}
  main{max-width:740px;margin:0 auto;padding:28px 18px}nav a,a{color:#24583f;font-weight:800}h1{font-size:26px}
  section{background:#fff;border:1px solid #dce5df;padding:18px;border-radius:12px;min-height:140px;display:grid;gap:10px}
  article{padding:12px;border-radius:10px;background:#eef5f0}article time{font-size:12px;color:#66786b;margin-left:10px}
  article p{margin-bottom:0}form{display:grid;gap:8px;margin-top:18px}
  textarea{font:inherit;padding:12px;border:1px solid #cbd9d0;border-radius:8px}button{background:#173d2c;color:white;border:0;border-radius:8px;padding:12px;font-weight:800}
  button:disabled{opacity:.5}.error{color:#a23f35}
</style>
