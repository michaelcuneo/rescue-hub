<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  type Offer = { animalId: string; species: string; clinic: string; transportRescueId: string; createdAt: string };
  type Reservation = { animalId: string; species: string; transportRescueId: string; claimedAt: string };
  type Animal = { id: string; species: string; status: string; pendingTransferToUserId?: string; currentCustodianUserId?: string };
  type Place = { id: string; label: string; latitude: number; longitude: number };
  type Mode = 'CURRENT_LOCATION' | 'WORKPLACE' | 'OTHER';

  let available = $state<Offer[]>([]);
  let mine = $state<Reservation[]>([]);
  let animals = $state<Record<string, Animal>>({});
  let selectedId = $state('');
  let mode = $state<Mode>('CURRENT_LOCATION');
  let address = $state('');
  let chosen = $state<Place | null>(null);
  let matches = $state<Place[]>([]);
  let busy = $state(false);
  let loading = $state(true);
  let message = $state('');
  let error = $state('');
  const mapboxToken = env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

  async function request(path: string, method = 'GET', body?: Record<string, unknown>) {
    const response = await fetch(path, {
      method, headers: { 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store'
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Request failed');
    return payload;
  }
  async function refresh() {
    const result = await request('/api/mobile/care-offers');
    available = result.items;
    mine = result.mine;
    const details = await Promise.all(mine.map(async reservation => {
      try {
        const result = await request(`/api/mobile/animals/${reservation.animalId}`);
        return [reservation.animalId, result.animal] as const;
      } catch { return null; }
    }));
    animals = Object.fromEntries(details.filter((item): item is readonly [string, Animal] => item !== null));
  }
  onMount(() => {
    void refresh().catch(e => error = String(e)).finally(() => loading = false);
  });
  function chooseMode(value: Mode) {
    mode = value; address = ''; chosen = null; matches = []; error = '';
  }
  function selectOffer(id: string) {
    selectedId = id; chooseMode('CURRENT_LOCATION'); message = '';
  }
  async function locate() {
    error = '';
    if (!navigator.geolocation || !window.isSecureContext) {
      error = 'GPS needs a secure browser connection. Choose a workplace or another address instead.';
      return;
    }
    busy = true;
    try {
      const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          position => resolve(position.coords), reject,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      });
      chosen = { id: 'gps', label: 'My current GPS location', latitude: coords.latitude, longitude: coords.longitude };
      address = chosen.label;
      matches = [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to determine your position.';
    } finally { busy = false; }
  }
  async function search() {
    if (address.trim().length < 3 || !mapboxToken.startsWith('pk.')) {
      error = 'Enter an address and configure Mapbox public geocoding.';
      return;
    }
    busy = true; error = ''; chosen = null; matches = [];
    try {
      const params = new URLSearchParams({ q: address.trim(), country: 'au', limit: '5', access_token: mapboxToken });
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
      if (!response.ok) throw new Error('Address search unavailable.');
      const payload = await response.json() as {
        features?: Array<{ id: string; geometry: { coordinates: [number, number] };
          properties?: { full_address?: string; name?: string; place_formatted?: string } }>
      };
      matches = (payload.features ?? []).map(feature => ({
        id: feature.id,
        label: feature.properties?.full_address ||
          [feature.properties?.name, feature.properties?.place_formatted].filter(Boolean).join(', ') || 'Selected address',
        longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1]
      }));
      if (!matches.length) error = 'No matching addresses were found.';
    } catch (e) { error = e instanceof Error ? e.message : 'Address lookup failed.'; }
    finally { busy = false; }
  }
  async function claim() {
    if (!selectedId || !chosen || busy) return;
    busy = true; error = ''; message = '';
    try {
      await request(`/api/mobile/animals/${selectedId}/claim-care`, 'POST', {
        mode, address: chosen.label, latitude: chosen.latitude, longitude: chosen.longitude
      });
      selectedId = '';
      message = 'Care reserved. The linked transport job is now available for an eligible volunteer to claim.';
      await refresh();
    } catch (e) { error = e instanceof Error ? e.message : 'Unable to reserve care.'; }
    finally { busy = false; }
  }
  async function updateGPS(animalId: string) {
    await locate();
    if (!chosen || busy || error) return;
    busy = true;
    try {
      await request(`/api/mobile/animals/${animalId}/delivery`, 'PATCH', {
        mode: 'CURRENT_LOCATION', address: 'My current GPS location',
        latitude: chosen.latitude, longitude: chosen.longitude
      });
      message = 'Your new GPS location is saved. The transporter can refresh delivery details.';
    } catch (e) { error = e instanceof Error ? e.message : 'Unable to update location.'; }
    finally { busy = false; }
  }
  async function accept(animalId: string) {
    if (busy) return;
    busy = true; error = ''; message = '';
    try {
      await request(`/api/mobile/animals/${animalId}/events`, 'POST', { kind: 'ACCEPT_TRANSFER' });
      message = 'Physical custody received and recorded. The animal is now in your care.';
      await refresh();
    } catch (e) { error = e instanceof Error ? e.message : 'Unable to acknowledge custody.'; }
    finally { busy = false; }
  }
</script>

<svelte:head><title>Animal care offers · Rescue Hub</title></svelte:head>
<main>
  <p><a href="/">← Back to rescue map</a></p>
  <header>
    <p class="eyebrow">RESCUE HUB · WILDLIFE CARE</p>
    <h1>Animals needing a carer</h1>
    <p>Claim the animal you can care for. A different volunteer can collect it from the vet and bring it to you.</p>
  </header>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if message}<p class="success" role="status">{message}</p>{/if}
  {#if loading}<p>Loading animal care offers…</p>{/if}
  <section aria-label="Available animals">
    {#each available as offer (offer.animalId)}
      <article>
        <h2>{offer.species}</h2>
        <p>At veterinary facility: {offer.clinic}</p>
        {#if selectedId !== offer.animalId}
          <button class="primary" onclick={() => selectOffer(offer.animalId)}>Claim for care · Transport to me</button>
        {:else}
          <h3>Where should the animal be delivered?</h3>
          <div class="modes" role="group" aria-label="Delivery location">
            {#each [
              { id: 'CURRENT_LOCATION', label: 'My current GPS' },
              { id: 'WORKPLACE', label: 'My workplace' },
              { id: 'OTHER', label: 'Another address' }
            ] as option}
              <button type="button" class:active={mode === option.id}
                onclick={() => chooseMode(option.id as Mode)}>{option.label}</button>
            {/each}
          </div>
          {#if mode === 'CURRENT_LOCATION'}
            <button type="button" onclick={() => void locate()} disabled={busy}>Use my current GPS</button>
          {:else}
            <label for="delivery-address">Search delivery address</label>
            <input id="delivery-address" bind:value={address}
              oninput={() => chosen = null} maxlength="250" autocomplete="street-address" />
            <button type="button" onclick={() => void search()} disabled={busy || !address.trim()}>Find address</button>
            {#if matches.length}
              <ul aria-label="Matching addresses">
                {#each matches as place (place.id)}
                  <li><button type="button" onclick={() => { chosen = place; address = place.label; matches = []; }}>
                    {place.label}
                  </button></li>
                {/each}
              </ul>
            {/if}
          {/if}
          {#if chosen}<p>Selected location: {chosen.label} · {chosen.latitude.toFixed(5)}, {chosen.longitude.toFixed(5)}</p>{/if}
          <button class="primary" onclick={() => void claim()} disabled={busy || !chosen}>Confirm carer reservation & request transport</button>
          <button type="button" onclick={() => selectedId = ''}>Cancel</button>
        {/if}
      </article>
    {:else if !loading}
      <p>No animals are currently awaiting a carer.</p>
    {/each}
  </section>
  <section aria-labelledby="my-claimed">
    <h2 id="my-claimed">Animals I've claimed for care</h2>
    {#each mine as reservation (reservation.animalId)}
      <article>
        <h3>{reservation.species}</h3>
        <p>Current state: {animals[reservation.animalId]?.status.replaceAll('_', ' ') ?? 'Updating'}</p>
        {#if animals[reservation.animalId]?.status === 'AT_VET'}
          <button type="button" onclick={() => void updateGPS(reservation.animalId)} disabled={busy}>Update transport-to-me GPS position</button>
        {/if}
        {#if animals[reservation.animalId]?.pendingTransferToUserId === data.carerId}
          <button class="primary" onclick={() => void accept(reservation.animalId)} disabled={busy}>Accept custody after physical delivery</button>
        {:else if animals[reservation.animalId]?.currentCustodianUserId === data.carerId}
          <p>Care is now in your custody and recorded in the permanent animal history.</p>
        {:else}
          <p>Awaiting transport or handover.</p>
        {/if}
      </article>
    {/each}
  </section>
  <button type="button" onclick={() => void refresh().catch(e => error = String(e))}>Refresh care offers</button>
</main>
<style>
  main{max-width:850px;margin:auto;padding:28px 22px 90px;display:grid;gap:20px;color:#173d2c}
  header{margin:4px 0 12px}h1{font-size:clamp(28px,4vw,43px);margin:8px 0}
  h2{font-size:22px}h3{font-size:17px}p{line-height:1.6;color:#486152}
  .eyebrow{font-size:11px;letter-spacing:1px;font-weight:800;color:#57806a}
  section{display:grid;gap:15px}
  article{border:1px solid #d9e2dc;background:white;border-radius:15px;padding:20px;display:grid;gap:12px}
  .modes{display:flex;gap:8px;flex-wrap:wrap}.modes button.active{background:#173d2c;color:white}
  button{padding:10px 15px;border:1px solid #adc6b5;border-radius:10px;background:white;color:#173d2c;font:inherit;cursor:pointer}
  button.primary{background:#173d2c;color:white;font-weight:750}
  button:disabled{opacity:.5;cursor:not-allowed}
  label{font-weight:700}input{border:1px solid #adbcaf;padding:12px;border-radius:9px;font:inherit;width:100%}
  ul{margin:0;padding:0;list-style:none;display:grid;gap:7px}li button{text-align:left;width:100%}
  .error{color:#a23f35}.success{color:#1f7244;font-weight:700}
</style>
