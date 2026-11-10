<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { env } from '$env/dynamic/public';
  import { Map, Marker } from '@beyonk/svelte-mapbox';

  let center = $state<[number, number]>([151.7, -32.93]);
  let zoom = $state(9);
  let mapRef: any = $state(null);
  let pin = $state<{ latitude: number; longitude: number } | null>(null);
  let animal = $state('');
  let condition = $state('');
  let error = $state('');
  let busy = $state(false);
  let success = $state('');
  let locBusy = $state(false);
  const mapToken = env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

  function handleReady() {
    const raw = mapRef?.getMap?.();
    if (!raw) return;
    raw.on('click', (event: { lngLat: { lat: number; lng: number } }) => {
      pin = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
    });
  }

  function locate() {
    if (!navigator.geolocation) { error = 'Location is unavailable. Tap the map to place a pin.'; return; }
    locBusy = true;
    error = '';
    navigator.geolocation.getCurrentPosition(position => {
      locBusy = false;
      pin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      mapRef?.getMap?.()?.flyTo?.({ center: [pin.longitude, pin.latitude], zoom: 14 });
    }, () => {
      locBusy = false;
      error = 'Location permission was not granted. You can tap the map instead.';
    }, { enableHighAccuracy: false, timeout: 15000 });
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!pin) { error = 'Please tap the map to show where the animal is.'; return; }
    busy = true; error = '';
    try {
      const response = await fetch('/api/public/reports', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ animal, condition, latitude: pin.latitude, longitude: pin.longitude })
      });
      const data = await response.json() as { report?: { id: string }; error?: string };
      if (!response.ok || !data.report) throw new Error(data.error ?? 'Unable to submit report.');
      success = data.report.id;
      animal = ''; condition = ''; pin = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to send report.';
    } finally { busy = false; }
  }
</script>

<svelte:head>
  <title>Report injured wildlife — Rescue Hub</title>
  <meta name="description" content="Tell wildlife rescue dispatch about an injured native animal." />
</svelte:head>

<main>
  <header><a href="/report" class="brand">RESCUE HUB</a><span>Report injured wildlife</span><a href="/logout">Sign out</a></header>
  <div class="layout">
    <section class="intro">
      <p class="eyebrow">PUBLIC WILDLIFE REPORT</p>
      <h1>Found an injured animal?</h1>
      <p>Tell local wildlife dispatch where it is, what you think the animal is and what appears wrong. You do not need to be a wildlife rescuer or belong to an organisation.</p>
      <p class="safety">Do not handle unfamiliar animals, snakes or bats. Keep your distance and contact emergency services if anyone is in immediate danger.</p>
      {#if success}
        <div class="success" role="status">
          <strong>Report received.</strong> Your report is awaiting dispatch review. Reference: <code>{success}</code>
          <button class="secondary" onclick={() => success = ''}>Report another animal</button>
        </div>
      {:else}
        <form onsubmit={submit}>
          <div class="field">
            <label for="animal">What animal do you think it is?</label>
            <input id="animal" bind:value={animal} placeholder="e.g. Blue-tongue lizard, possum, bird" required minlength="2" maxlength="120" />
            <small>It's fine if you are unsure.</small>
          </div>
          <div class="field">
            <label for="condition">What appears to be wrong?</label>
            <textarea id="condition" bind:value={condition} placeholder="e.g. Lying beside the road, dragging its back leg" required minlength="5" maxlength="2000" rows="4"></textarea>
          </div>
          <div class="field">
            <span class="label">Where is the animal?</span>
            <p class="hint">Tap the map to drop a pin, or choose your current location.</p>
            <button class="secondary" type="button" onclick={locate} disabled={locBusy}>
              {locBusy ? 'Locating…' : 'Use my current location'}
            </button>
            {#if pin}<p class="coordinates" role="status">Pin selected: {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}</p>{/if}
          </div>
          {#if error}<p class="error" role="alert">{error}</p>{/if}
          <button class="submit" disabled={busy || !pin || !animal.trim() || !condition.trim()}>
            {busy ? 'Sending report…' : 'Submit wildlife report'}
          </button>
        </form>
      {/if}
    </section>
    <section class="map-panel" aria-label="Choose wildlife report location">
      {#if mapToken}
        <Map bind:this={mapRef} bind:center bind:zoom accessToken={mapToken}
          style="mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn" onready={handleReady}>
          {#if pin}
            <Marker lat={pin.latitude} lng={pin.longitude} label="Reported animal location">
              <div class="report-pin" aria-label="Reported animal position"></div>
            </Marker>
          {/if}
        </Map>
      {:else}
        <div class="map-error">Map configuration is unavailable. Please contact Rescue Hub support.</div>
      {/if}
      <div class="map-tip">Tap anywhere on the map to move the report pin.</div>
    </section>
  </div>
</main>

<style>
  :global(body){margin:0;background:#edf1ee;font-family:Inter,system-ui,sans-serif;color:#17211d}
  header{height:56px;padding:0 20px;display:flex;align-items:center;gap:24px;background:#173d2c;color:white}
  header a{color:white;text-decoration:none;font-size:13px}
  header a:last-child{margin-left:auto}
  .brand{font-weight:900;letter-spacing:.1em}
  .layout{display:grid;grid-template-columns:minmax(320px,420px) minmax(0,1fr);min-height:calc(100dvh - 56px)}
  .intro{padding:28px;max-height:calc(100dvh - 56px);overflow:auto;background:white}
  .eyebrow{font-size:11px;color:#648074;font-weight:900;letter-spacing:.12em}
  h1{font-size:28px;letter-spacing:-.04em;margin:8px 0 12px}
  p{line-height:1.5;color:#56665b}
  .safety{font-size:13px;color:#83580a;background:#fff6df;padding:12px;border-radius:10px}
  form{display:grid;gap:17px;margin-top:20px}
  .field{display:grid;gap:7px}
  label,.label{font-size:13px;font-weight:800;color:#243c2e}
  input,textarea{box-sizing:border-box;width:100%;font:inherit;padding:12px;border-radius:10px;border:1px solid #cbd9d0}
  small,.hint{color:#65776b;font-size:12px;margin:0}
  button{border:0;cursor:pointer;min-height:44px;border-radius:10px;font:inherit;font-weight:800;padding:11px}
  button:disabled{opacity:.55;cursor:default}
  .submit{background:#173d2c;color:white}
  .secondary{border:1px solid #b9cbc0;background:#f2f6f3;color:#173d2c}
  .map-panel{position:relative;min-height:400px}
  .report-pin{width:22px;height:22px;background:#bf4429;border-radius:100%;border:4px solid white;box-shadow:0 0 0 5px #bf442955}
  .map-tip{position:absolute;top:10px;left:10px;background:#ffffffed;padding:9px 12px;border-radius:10px;color:#173d2c;font-size:12px;font-weight:800}
  .error{color:#a23f35;font-weight:700}
  .success{background:#eff8f1;padding:16px;border-radius:12px;display:grid;gap:12px}
  .coordinates{font-weight:700;color:#173d2c}
  .map-error{display:grid;place-items:center;padding:24px}
  @media(max-width:800px){.layout{grid-template-columns:1fr}.intro{max-height:none;padding:20px}.map-panel{height:55dvh;min-height:350px}header{gap:12px;padding:0 12px}}
</style>
