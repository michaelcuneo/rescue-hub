<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  type Animal = { id: string; species: string; status: string; currentCustodianUserId?: string; currentLocation?: string; pendingTransferId?: string };
  type Event = { id: string; type: string; notes?: string; actorUserId?: string; createdAt: string; occurredAt?: string; reportedByName?: string; source?: string };
  let animals = $state<Animal[]>([]);
  let selected = $state<Animal | null>(null);
  let events = $state<Event[]>([]);
  let species = $state('');
  let description = $state('');
  let note = $state('');
  let sourceName = $state('');
  let eventType = $state('OBSERVATION');
  let recipientId = $state('');
  let location = $state('');
  let outcome = $state('RELEASED');
  let errorMessage = $state('');
  let busy = $state(false);
  const canCoordinate = $derived(data.roles.some((role) => ['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role)));
  const isCustodian = $derived(selected?.currentCustodianUserId === data.userId);
  const final = $derived(selected ? ['RELEASED', 'EUTHANISED', 'DECEASED'].includes(selected.status) : false);
  async function api(path: string, body?: Record<string, unknown>) {
    const response = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed');
    return result;
  }
  async function refresh() {
    const result = await api(`/api/mobile/rescues/${data.rescue.id}/animals`);
    animals = result.items;
    if (selected) {
      const detail = await api(`/api/mobile/animals/${selected.id}`);
      selected = detail.animal;
      events = detail.events;
    }
  }
  onMount(() => { void refresh().catch((error) => errorMessage = String(error)); });
  async function openAnimal(animal: Animal) {
    selected = animal;
    try { await refresh(); } catch (error) { errorMessage = String(error); }
  }
  async function submit(action: () => Promise<unknown>) {
    busy = true; errorMessage = '';
    try { await action(); await refresh(); note = ''; }
    catch (error) { errorMessage = error instanceof Error ? error.message : 'Unable to save'; }
    finally { busy = false; }
  }
</script>

<svelte:head><title>Animal care · Rescue Hub</title></svelte:head>
<main class="care">
  <a href="/">← Rescue queue</a>
  <header>
    <div><p class="eyebrow">RESCUE HUB · ANIMAL CARE</p><h1>{data.rescue.type}</h1><p>{data.rescue.location || 'Location not recorded'} · Response: {data.rescue.status}</p></div>
    <span class="tag">{animals.length} animal{animals.length === 1 ? '' : 's'}</span>
  </header>
  {#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
  <div class="layout">
    <aside class="panel">
      <h2>Animal records</h2>
      {#each animals as animal (animal.id)}
        <button class:active={selected?.id === animal.id} class="animal-row" onclick={() => openAnimal(animal)}>
          <strong>{animal.species}</strong><small>{animal.status.replaceAll('_', ' ')}</small>
        </button>
      {/each}
      {#if !animals.length}<p>No animals registered yet.</p>{/if}
      {#if data.rescue.assignedUserId === data.userId}
        <form onsubmit={(event) => { event.preventDefault(); void submit(async () => { await api(`/api/mobile/rescues/${data.rescue.id}/animals`, { species, description }); species = ''; description = ''; }); }}>
          <h3>Register animal</h3>
          <label>Species<input required maxlength="120" bind:value={species}/></label>
          <label>Description<textarea maxlength="2000" bind:value={description}></textarea></label>
          <button class="primary" disabled={busy || !species.trim()}>Register animal</button>
        </form>
      {/if}
    </aside>
    <section class="panel">
      {#if selected}
        <div class="record-head"><div><p class="eyebrow">PERMANENT ANIMAL RECORD</p><h2>{selected.species}</h2></div><span class="tag">{selected.status.replaceAll('_', ' ')}</span></div>
        <dl><div><dt>Custodian</dt><dd>{isCustodian ? 'You' : selected.currentCustodianUserId || 'Not recorded'}</dd></div><div><dt>Location</dt><dd>{selected.currentLocation || 'Not recorded'}</dd></div></dl>
        {#if selected.pendingTransferId}<p class="notice">Custody handover awaiting acknowledgement.</p>{/if}
        <h3>Care timeline</h3>
        <ol class="timeline">
          {#each events as event (event.id)}
            <li><strong>{event.type.replaceAll('_', ' ')}</strong><small>{new Date(event.occurredAt || event.createdAt).toLocaleString()}</small>{#if event.notes}<p>{event.notes}</p>{/if}{#if event.source}<small>Source: {event.source} · {event.reportedByName || 'Not specified'}</small>{/if}</li>
          {/each}
        </ol>
        {#if !final}
          <form onsubmit={(e) => { e.preventDefault(); void submit(() => api(`/api/mobile/animals/${selected!.id}/events`, { kind: 'NOTE', type: eventType, notes: note, ...(canCoordinate && sourceName.trim() ? { reportedByName: sourceName.trim(), source: 'PHONE' } : {}) })); }}>
            <h3>Record care update</h3>
            <label>Update type<select bind:value={eventType}>{#each ['OBSERVATION', 'VET_ASSESSMENT', 'TREATMENT', 'FEEDING', 'WEIGHT', 'REVIEW'] as type}<option value={type}>{type.replaceAll('_', ' ')}</option>{/each}</select></label>
            {#if canCoordinate}<label>Information provided by (telephone)<input placeholder="Caller name or role" bind:value={sourceName}/></label>{/if}
            <label>Notes<textarea required maxlength="4000" bind:value={note}></textarea></label>
            <button class="primary" disabled={busy || !note.trim() || (!isCustodian && !canCoordinate)}>Save update</button>
          </form>
          {#if isCustodian && !selected.pendingTransferId}
            <form onsubmit={(e) => { e.preventDefault(); void submit(() => api(`/api/mobile/animals/${selected!.id}/events`, { kind: 'TRANSFER', recipientUserId: recipientId, location })); }}>
              <h3>Request handover</h3><label>Receiving member ID<input required bind:value={recipientId}/></label><label>Destination<input maxlength="250" bind:value={location}/></label><button class="primary" disabled={busy}>Request custody transfer</button>
            </form>
            <form onsubmit={(e) => { e.preventDefault(); void submit(() => api(`/api/mobile/animals/${selected!.id}/events`, { kind: 'OUTCOME', status: outcome, notes: note })); }}>
              <h3>Final outcome</h3><label>Outcome<select bind:value={outcome}>{#each ['RELEASED', 'EUTHANISED', 'DECEASED'] as value}<option value={value}>{value}</option>{/each}</select></label><label>Reason / details<textarea required bind:value={note}></textarea></label><button class="primary" disabled={busy || !note.trim()}>Record final outcome</button>
            </form>
          {:else if selected.pendingTransferId && !isCustodian}
            <button class="primary" disabled={busy} onclick={() => void submit(() => api(`/api/mobile/animals/${selected!.id}/events`, { kind: 'ACCEPT_TRANSFER' }))}>Accept custody (nominated recipient only)</button>
          {/if}
        {/if}
      {:else}<h2>Select an animal</h2><p>Choose an animal to see its location, current custodian and full care history.</p>{/if}
    </section>
  </div>
</main>
<style>
  :global(body){margin:0;background:#f1f4f1;color:#1b2d24;font-family:system-ui,sans-serif}
  .care{max-width:1250px;margin:auto;padding:32px 22px 80px}.care>a{color:#24583f;font-weight:700}header,.record-head{display:flex;justify-content:space-between;align-items:center;gap:16px}header{margin:22px 0}.eyebrow{font-size:11px;font-weight:800;letter-spacing:1.3px;color:#648074}h1{font-size:32px;margin:4px 0}h2{margin:0 0 14px}h3{margin:22px 0 12px}p{line-height:1.5;color:#52655a}.layout{display:grid;grid-template-columns:minmax(260px,1fr) minmax(0,2fr);gap:18px}.panel{background:white;border:1px solid #dce5df;border-radius:16px;padding:22px;min-width:0}.tag{background:#e1eee6;border-radius:20px;padding:8px 12px;font-size:12px;font-weight:800}.animal-row{display:flex;flex-direction:column;align-items:flex-start;width:100%;background:white;border:1px solid #dce5df;border-radius:10px;padding:12px;margin:8px 0;cursor:pointer}.animal-row.active{background:#e1eee6;border-color:#24583f}small{display:block;color:#6a7c70;margin-top:5px}form{border-top:1px solid #e3e9e5;margin-top:22px;padding-top:4px}label{display:block;font-size:13px;font-weight:700;margin:12px 0}input,textarea,select{box-sizing:border-box;display:block;width:100%;margin-top:7px;padding:11px;border:1px solid #cbd9d0;border-radius:9px;font:inherit}textarea{min-height:90px}.primary{background:#173d2c;color:white;border:0;border-radius:9px;padding:12px 16px;font-weight:700;cursor:pointer}.primary:disabled{opacity:.5;cursor:not-allowed}dl{display:flex;gap:24px;flex-wrap:wrap}dt{font-size:12px;color:#6a7c70}dd{margin:5px 0;font-weight:700}.timeline{padding-left:24px}.timeline li{border-left:2px solid #bdd2c4;padding:0 0 18px 16px;margin-left:-4px}.timeline p{margin:6px 0}.notice{color:#805a12;background:#fff6dc;padding:12px;border-radius:9px}.error{color:#a23f35;font-weight:700}@media(max-width:750px){.layout{grid-template-columns:1fr}.care{padding:18px 12px}header{align-items:flex-start}}
</style>
