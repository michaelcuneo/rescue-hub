<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  type Animal = { id: string; species: string; status: string; currentCustodianUserId?: string; currentLocation?: string; pendingTransferId?: string; activeTransportRescueId?: string };
  type Event = { id: string; type: string; notes?: string; actorUserId?: string; createdAt: string; occurredAt?: string; reportedByName?: string; source?: string };
  let animals = $state<Animal[]>([]);
  let selected = $state<Animal | null>(null);
  let events = $state<Event[]>([]);
  let species = $state('');
  let description = $state('');
  let incidentSpecies = $state('');
  let incidentCondition = $state('');
  let correctedSpecies = $state('');
  let correctedDescription = $state('');
  let note = $state('');
  type PhoneEvent = { id: string; callerName: string; callerRole: string; notes: string; finalOutcome?: string; callbackPermitted?: boolean; callbackPhone?: string; createdAt: string; actorUserId: string; transportRescueId?: string };
  let phoneEvents = $state<PhoneEvent[]>([]);
  let phoneCaller = $state('');
  let phoneRole = $state('VET');
  let phoneOutcome = $state('');
  let phoneNotes = $state('');
  let callbackAllowed = $state(false);
  let callbackNumber = $state('');
  let requestTransport = $state(false);
  let phoneSaved = $state('');
  type PickupPlace = { id: string; label: string; latitude: number; longitude: number };
  const mapboxToken = env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
  let pickupAddress = $state('');
  let pickupLatitude = $state<number | null>(null);
  let pickupLongitude = $state<number | null>(null);
  let pickupOptions = $state<PickupPlace[]>([]);
  let pickupSearching = $state(false);
  let pickupError = $state('');
  async function searchPickup() {
    if (!mapboxToken || pickupAddress.trim().length < 3) {
      pickupError = 'Enter a veterinary pickup address and configure the Mapbox search token.';
      return;
    }
    pickupSearching = true; pickupError = ''; pickupOptions = [];
    try {
      const params = new URLSearchParams({ q: pickupAddress.trim(), access_token: mapboxToken, country: 'au', limit: '5' });
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
      if (!response.ok) throw new Error('Address lookup unavailable.');
      const payload = await response.json() as {
        features?: Array<{ id: string; geometry: { coordinates: [number, number] }; properties?: { full_address?: string; name?: string; place_formatted?: string } }>
      };
      pickupOptions = (payload.features ?? []).map(feature => ({
        id: feature.id,
        label: feature.properties?.full_address ||
          [feature.properties?.name, feature.properties?.place_formatted].filter(Boolean).join(', ') ||
          'Vet pickup location',
        longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1]
      }));
      if (!pickupOptions.length) pickupError = 'No matching addresses. Add the exact pickup coordinates manually.';
    } catch (error) {
      pickupError = error instanceof Error ? error.message : 'Pickup address search failed.';
    } finally { pickupSearching = false; }
  }
  function choosePickup(place: PickupPlace) {
    pickupAddress = place.label;
    pickupLatitude = place.latitude;
    pickupLongitude = place.longitude;
    pickupOptions = [];
    pickupError = '';
  }
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
    // Open the first linked animal immediately, including in completed demo
    // cases, so the history is visible without a second unexplained click.
    const active = animals.find(animal => animal.id === selected?.id) ?? animals[0];
    if (active) {
      selected = active;
      const animalId = active.id;
      const detail = await api(`/api/mobile/animals/${animalId}`);
      selected = detail.animal;
      correctedSpecies = detail.animal.species;
      correctedDescription = detail.animal.description ?? '';
      events = detail.events;
      const calls = await api(`/api/mobile/animals/${animalId}/phone-updates`);
      phoneEvents = calls.items;
    }
  }
  onMount(() => {
    incidentSpecies = data.rescue.type;
    incidentCondition = data.rescue.injury ?? '';
    void refresh().catch((error) => errorMessage = String(error));
  });
  async function openAnimal(animal: Animal) {
    selected = animal;
    phoneEvents = [];
    phoneSaved = '';
    requestTransport = false;
    phoneOutcome = '';
    pickupAddress = animal.currentLocation ?? '';
    pickupLatitude = null;
    pickupLongitude = null;
    pickupOptions = [];
    pickupError = '';
    correctedSpecies = animal.species;
    correctedDescription = '';
    try { await refresh(); } catch (error) { errorMessage = String(error); }
  }
  async function savePhoneUpdate(event: SubmitEvent) {
    event.preventDefault();
    if (!selected || busy || !canCoordinate) return;
    busy = true; errorMessage = ''; phoneSaved = '';
    try {
      const result = await api(`/api/mobile/animals/${selected.id}/phone-updates`, {
        callerName: phoneCaller, callerRole: phoneRole, notes: phoneNotes,
        animalId: selected.id, requestTransport,
        ...(phoneRole === 'VET' && phoneOutcome ? { finalOutcome: phoneOutcome } : {}),
        ...(requestTransport ? { pickupLocation: pickupAddress, pickupLatitude, pickupLongitude } : {}),
        callbackPermitted: callbackAllowed,
        ...(callbackAllowed ? { callbackPhone: callbackNumber } : {})
      });
      phoneNotes = '';
      callbackNumber = '';
      pickupOptions = [];
      callbackAllowed = false;
      requestTransport = false;
      phoneOutcome = '';
      phoneSaved = result.update.finalOutcome
        ? `Veterinary outcome ${result.update.finalOutcome.toLowerCase()} recorded. Animal care is complete and remains in historical records.`
        : result.update.transportRescueId
          ? 'Telephone update saved. Animal offered to qualified carers; transport becomes available when one claims the animal and chooses a destination.'
          : 'Telephone update saved to this animal’s permanent history.';
      await refresh();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unable to save telephone update.';
    } finally { busy = false; }
  }
  async function submit(action: () => Promise<unknown>) {
    busy = true; errorMessage = '';
    try { await action(); await refresh(); note = ''; }
    catch (error) { errorMessage = error instanceof Error ? error.message : 'Unable to save'; }
    finally { busy = false; }
  }
</script>

<svelte:head><title>Animal Records &amp; Phone Updates · Rescue Hub</title></svelte:head>
<main class="care">
  <a href="/">← Rescue queue</a>
  <header>
    <div><p class="eyebrow">RESCUE HUB · ANIMAL RECORDS &amp; PHONE UPDATES</p><h1>{data.rescue.type}</h1><p>{data.rescue.location || 'Location not recorded'} · Response: {data.rescue.status}</p></div>
    <span class="tag">{animals.length} animal{animals.length === 1 ? '' : 's'}</span>
  </header>
  {#if data.rescue.transportAnimalId}
    <p class="notice"><strong>Volunteer transport pickup</strong> · This is a separate, self-claimable transport job for an existing animal. Claiming this job does not transfer animal custody; confirm the physical pickup and arrange an acknowledged handover.</p>
    {#if data.rescue.transportSourceRescueId}
      <p><a href="/rescues/{data.rescue.transportSourceRescueId}/care">View original animal record and incident</a></p>
    {/if}
  {/if}
  {#if data.reporterContact?.allowMessages}
    <p><a href="/report/messages/{data.reporterContact.reportId}">Message the person who reported this rescue</a></p>
  {/if}
  {#if data.reporterContact?.contactPhone}
    <p><a href="tel:{data.reporterContact.contactPhone}">Call consenting reporter: {data.reporterContact.contactPhone}</a></p>
  {/if}
  {#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
  <div class="layout">
    <aside class="panel">
      <h2>Animal records</h2>
      {#if data.rescue.assignedUserId === data.userId && data.rescue.status === 'ASSIGNED'}
        <form onsubmit={(event) => { event.preventDefault(); void submit(async () => {
          const response = await fetch(`/api/mobile/rescues/${data.rescue.id}/correction`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type: incidentSpecies, injury: incidentCondition })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Correction failed');
        }); }}>
          <h3>Correct public observations</h3>
          <p>The person's original report is preserved. Record what you actually found.</p>
          <label>Verified animal<input required maxlength="120" bind:value={incidentSpecies}/></label>
          <label>Verified condition<textarea maxlength="2000" bind:value={incidentCondition}></textarea></label>
          <button class="primary" disabled={busy || incidentSpecies.trim().length < 2}>Save verified observation</button>
        </form>
      {/if}
      {#each animals as animal (animal.id)}
        <button class:active={selected?.id === animal.id} class="animal-row" onclick={() => openAnimal(animal)}>
          <strong>{animal.species}</strong><small>{animal.status.replaceAll('_', ' ')}</small>
        </button>
      {/each}
      {#if !animals.length}
        <p>No individual animals registered yet. The rescuer registers each collected animal. Phone notes about its veterinary care become available here once the animal has an individual record.</p>
      {/if}
      {#if data.rescue.assignedUserId === data.userId && !data.rescue.transportAnimalId}
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
        {#if !final && (isCustodian || canCoordinate)}
          <form onsubmit={(e) => { e.preventDefault(); void submit(async () => {
            const response = await fetch(`/api/mobile/animals/${selected!.id}`, {
              method: 'PATCH', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ species: correctedSpecies, description: correctedDescription })
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Correction failed');
          }); }}>
            <h3>Correct animal identification</h3>
            <p>Public observations are preserved. Corrections are added to the animal audit trail.</p>
            <label>Confirmed animal/species<input required maxlength="120" bind:value={correctedSpecies}/></label>
            <label>Identifying details<textarea maxlength="2000" bind:value={correctedDescription}></textarea></label>
            <button class="primary" disabled={busy || !correctedSpecies.trim()}>Save corrected details</button>
          </form>
        {/if}
        <h3>Phone updates</h3>
        <p>Telephone records are part of this animal's permanent history. They record the caller's account, not a confirmed finding. Dispatch can enter updates from veterinarians, rescuers or carers even when those people cannot use Rescue Hub.</p>
        {#if canCoordinate && !final}
          <form onsubmit={savePhoneUpdate}>
            <label>Who called?<input required maxlength="120" bind:value={phoneCaller} placeholder="Name or identifying role" /></label>
            <label>Caller type<select bind:value={phoneRole}>
              <option value="VET">Veterinarian or clinic</option>
              <option value="REPORTER">Person who reported the animal</option>
              <option value="RESCUER">Rescuer</option>
              <option value="CARER">Wildlife carer</option>
              <option value="OTHER">Other</option>
            </select></label>
            <label>Information provided<textarea required maxlength="4000" bind:value={phoneNotes} placeholder="Document the exact details reported by the caller."></textarea></label>
            {#if phoneRole === 'VET' && selected.status === 'AT_VET'}
              <label for="vet-call-outcome">Veterinarian reported outcome
                <select id="vet-call-outcome" bind:value={phoneOutcome} onchange={() => { if (phoneOutcome) requestTransport = false; }}>
                  <option value="">No final outcome (animal remains in care)</option>
                  <option value="EUTHANISED">Euthanised — close this animal's care record</option>
                  <option value="DECEASED">Died — close this animal's care record</option>
                </select>
              </label>
              {#if phoneOutcome}<p class="notice">This is a permanent final outcome. Confirm the veterinarian and details before saving. Any outstanding transport pickup request will be cancelled.</p>{/if}
            {/if}
            <label class="inline-check"><input type="checkbox" bind:checked={callbackAllowed} /> Caller permits a callback</label>
            {#if callbackAllowed}<label>Callback number<input required type="tel" maxlength="25" bind:value={callbackNumber} /></label>{/if}
            {#if selected.status === 'AT_VET' && !phoneOutcome}
              <label class="inline-check"><input type="checkbox" bind:checked={requestTransport} disabled={!!selected.activeTransportRescueId} />
                Offer this animal to carers, then open transport once a carer claims it
              </label>
              {#if requestTransport && !selected.activeTransportRescueId}
                <label for="vet-pickup-address">Veterinary pickup address
                  <input id="vet-pickup-address" required bind:value={pickupAddress}
                    oninput={() => { pickupLatitude = null; pickupLongitude = null; }}
                    maxlength="250" placeholder="Search for the veterinary clinic or enter its precise address" />
                </label>
                <button type="button" class="primary" onclick={() => void searchPickup()} disabled={pickupSearching || !mapboxToken}>
                  {pickupSearching ? 'Searching…' : 'Find veterinary pickup address'}
                </button>
                {#if pickupError}<p class="error" role="alert">{pickupError}</p>{/if}
                {#if pickupOptions.length}
                  <ul aria-label="Matching veterinary pickup addresses">
                    {#each pickupOptions as place (place.id)}
                      <li><button type="button" onclick={() => choosePickup(place)}>{place.label}</button></li>
                    {/each}
                  </ul>
                {/if}
                <div class="phone-coordinates">
                  <label for="vet-pickup-latitude">Pickup latitude
                    <input id="vet-pickup-latitude" type="number" min="-90" max="90" step="any" required bind:value={pickupLatitude} />
                  </label>
                  <label for="vet-pickup-longitude">Pickup longitude
                    <input id="vet-pickup-longitude" type="number" min="-180" max="180" step="any" required bind:value={pickupLongitude} />
                  </label>
                </div>
                <p>Verify that the coordinates are at the veterinary clinic, not the original injury location. The transport pickup will become available once a carer reserves the animal and selects a private delivery destination.</p>
              {/if}
              {#if selected.activeTransportRescueId}<p class="notice">Transport already requested for this animal. A new job cannot be created until its custody handover is completed.</p>{/if}
            {/if}
            <button class="primary" disabled={busy || !phoneCaller.trim() || !phoneNotes.trim() || (callbackAllowed && !callbackNumber.trim()) || (requestTransport && (!pickupAddress.trim() || pickupLatitude === null || pickupLongitude === null))}>Record phone update</button>
          </form>
          {#if phoneSaved}<p role="status">{phoneSaved}</p>{/if}
        {/if}
        <ol class="timeline" aria-label="Animal phone update history">
          {#each phoneEvents as call (call.id)}
            <li><strong>Phone call: {call.callerName} ({call.callerRole.toLowerCase()})</strong>
              <small>{new Date(call.createdAt).toLocaleString('en-AU')} · Recorded by {call.actorUserId}</small>
              <p>{call.notes}</p>
              {#if call.finalOutcome}<p><strong>Veterinary-reported final outcome: {call.finalOutcome.replaceAll('_',' ')}</strong></p>{/if}
              {#if call.transportRescueId}<p><strong>Transport offered to volunteers</strong> · <a href="/rescues/{call.transportRescueId}/care">View transport job</a></p>{/if}
              {#if call.callbackPermitted && call.callbackPhone}<small>Callback permitted: <a href="tel:{call.callbackPhone}">{call.callbackPhone}</a></small>{/if}
            </li>
          {:else}<li>No phone updates recorded for this animal.</li>{/each}
        </ol>
        <h3>Care timeline</h3>
        <ol class="timeline">
          {#each events.filter(event => event.type !== 'PHONE_UPDATE') as event (event.id)}
            <li><strong>{event.type.replaceAll('_', ' ')}</strong><small>{new Date(event.occurredAt || event.createdAt).toLocaleString()}</small>{#if event.notes}<p>{event.notes}</p>{/if}{#if event.source}<small>Source: {event.source} · {event.reportedByName || 'Not specified'}</small>{/if}</li>
          {/each}
        </ol>
        {#if !final}
          <form onsubmit={(e) => { e.preventDefault(); void submit(() => api(`/api/mobile/animals/${selected!.id}/events`, { kind: 'NOTE', type: eventType, notes: note })); }}>
            <h3>Record care update</h3>
            <label>Update type<select bind:value={eventType}>{#each ['OBSERVATION', 'VET_ASSESSMENT', 'TREATMENT', 'FEEDING', 'WEIGHT', 'REVIEW'] as type}<option value={type}>{type.replaceAll('_', ' ')}</option>{/each}</select></label>
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
  :global(body){margin:0;background:var(--rh-t240, #f1f4f1);color:var(--rh-t241, #1b2d24);font-family:system-ui,sans-serif}
  .phone-coordinates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}@media(max-width:600px){.phone-coordinates{grid-template-columns:1fr}} .inline-check{display:flex;align-items:center;gap:10px}.inline-check input{width:auto;margin:0} .care{max-width:1250px;margin:auto;padding:32px 22px 80px}.care>a{color:var(--rh-t192, #24583f);font-weight:700}header,.record-head{display:flex;justify-content:space-between;align-items:center;gap:16px}header{margin:22px 0}.eyebrow{font-size:11px;font-weight:800;letter-spacing:1.3px;color:var(--rh-t187, #648074)}h1{font-size:32px;margin:4px 0}h2{margin:0 0 14px}h3{margin:22px 0 12px}p{line-height:1.5;color:var(--rh-t242, #52655a)}.layout{display:grid;grid-template-columns:minmax(260px,1fr) minmax(0,2fr);gap:18px}.panel{background:var(--rh-t186, white);border:1px solid var(--rh-t221, #dce5df);border-radius:16px;padding:22px;min-width:0}.tag{background:var(--rh-t243, #e1eee6);border-radius:20px;padding:8px 12px;font-size:12px;font-weight:800}.animal-row{display:flex;flex-direction:column;align-items:flex-start;width:100%;background:var(--rh-t186, white);border:1px solid var(--rh-t221, #dce5df);border-radius:10px;padding:12px;margin:8px 0;cursor:pointer}.animal-row.active{background:var(--rh-t243, #e1eee6);border-color:#24583f}small{display:block;color:var(--rh-t244, #6a7c70);margin-top:5px}form{border-top:1px solid var(--rh-t245, #e3e9e5);margin-top:22px;padding-top:4px}label{display:block;font-size:13px;font-weight:700;margin:12px 0}input,textarea,select{box-sizing:border-box;display:block;width:100%;margin-top:7px;padding:11px;border:1px solid var(--rh-t217, #cbd9d0);border-radius:9px;font:inherit}textarea{min-height:90px}.primary{background:#173d2c;color:white;border:0;border-radius:9px;padding:12px 16px;font-weight:700;cursor:pointer}.primary:disabled{opacity:.5;cursor:not-allowed}dl{display:flex;gap:24px;flex-wrap:wrap}dt{font-size:12px;color:var(--rh-t244, #6a7c70)}dd{margin:5px 0;font-weight:700}.timeline{padding-left:24px}.timeline li{border-left:2px solid var(--rh-t246, #bdd2c4);padding:0 0 18px 16px;margin-left:-4px}.timeline p{margin:6px 0}.notice{color:var(--rh-t247, #805a12);background:var(--rh-t248, #fff6dc);padding:12px;border-radius:9px}.error{color:var(--rh-t181, #a23f35);font-weight:700}@media(max-width:750px){.layout{grid-template-columns:1fr}.care{padding:18px 12px}header{align-items:flex-start}}
</style>
