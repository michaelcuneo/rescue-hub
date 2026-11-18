<script lang="ts">
  import { onMount } from 'svelte';
  import { resolvedTheme } from '$lib/theme';
  import { formatReleaseCoordinates, isValidReleasePoint } from '../../../../core/release-location';

  type Point = { latitude: number; longitude: number };
  let {
    original,
    selected = null,
    onChoose,
    onCancel
  }: {
    original: Point;
    selected?: Point | null;
    onChoose: (point: Point) => void;
    onCancel: () => void;
  } = $props();

  const ESM = 'https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.mjs';
  const LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
  const DARK = 'https://tiles.openfreemap.org/styles/dark';

  let surface: HTMLDivElement | undefined;
  let map: any;
  let marker: any;
  let module: any;
  let pending = $state<Point | null>(selected && isValidReleasePoint(selected) ? selected : null);
  let ready = $state(false);
  let error = $state('');
  let activeTheme = 'light';

  function setPin(point: Point) {
    if (!isValidReleasePoint(point)) return;
    pending = point;
    if (!map || !module) return;
    if (!marker) {
      const pin = document.createElement('div');
      pin.className = 'release-pin';
      pin.setAttribute('aria-label', 'Selected wildlife release point');
      marker = new module.Marker({ element: pin, anchor: 'bottom' });
    }
    marker.setLngLat([point.longitude, point.latitude]).addTo(map);
  }

  function chooseOriginal() {
    setPin(original);
    map?.flyTo?.({ center: [original.longitude, original.latitude], zoom: 13, duration: 350 });
  }

  onMount(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    const init = async () => {
      try {
        module = await import(/* @vite-ignore */ ESM);
        if (!surface || disposed) return;
        activeTheme = $resolvedTheme;
        map = new module.Map({
          container: surface,
          style: activeTheme === 'dark' ? DARK : LIGHT,
          center: [selected?.longitude ?? original.longitude, selected?.latitude ?? original.latitude],
          zoom: 11
        });
        map.addControl(new module.NavigationControl(), 'top-right');
        map.on('load', () => {
          if (disposed) return;
          ready = true;
          if (pending) setPin(pending);
        });
        map.on('click', (event: any) => {
          setPin({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
        });
        unsubscribe = resolvedTheme.subscribe(theme => {
          if (disposed || activeTheme === theme) return;
          activeTheme = theme;
          map.setStyle(theme === 'dark' ? DARK : LIGHT);
        });
        map.on('error', (event: any) => {
          if (!ready) error = event.error?.message ?? 'Map tiles unavailable';
        });
      } catch (failure) {
        if (!disposed) error = failure instanceof Error ? failure.message : 'Could not load release map';
      }
    };
    void init();
    return () => {
      disposed = true;
      unsubscribe?.();
      marker?.remove();
      map?.remove();
      marker = undefined;
      map = undefined;
    };
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.css"/>
</svelte:head>
<div class="release-picker" role="dialog" aria-modal="true" aria-label="Choose wildlife release location">
  <div class="picker-content">
    <header>
      <div>
        <h3>Drop a release / relocation pin</h3>
        <p>Pan or zoom to the bushland, forest or reserve and click the exact spot. No street address is required.</p>
      </div>
      <button type="button" class="close" aria-label="Close release map" onclick={onCancel}>×</button>
    </header>
    <div class="picker-map" bind:this={surface} aria-label="Interactive release location map"></div>
    {#if error}<p class="error" role="alert">{error}</p>
    {:else if !ready}<p role="status">Loading the release map…</p>{/if}
    <div class="picker-footer">
      <div class="details">
        <strong>{pending ? 'Release location selected' : 'Click the map to set the release location'}</strong>
        <small>{pending ? formatReleaseCoordinates(pending) : 'Coordinates are recorded to the animal history.'}</small>
      </div>
      <button type="button" onclick={chooseOriginal} disabled={!isValidReleasePoint(original)}>Use rescue location</button>
      <button type="button" onclick={onCancel}>Cancel</button>
      <button type="button" class="primary" disabled={!pending} onclick={() => pending && onChoose(pending)}>Use this pin</button>
    </div>
  </div>
</div>
<style>
  .release-picker { position:fixed; inset:0; z-index:3000; background:rgba(7,19,15,.68); display:grid; place-items:center; padding:20px; }
  .picker-content { width:min(1040px,100%); max-height:95dvh; display:flex; flex-direction:column; padding:16px; gap:12px; background:var(--rh-surface); border:1px solid var(--rh-border); border-radius:14px; color:var(--rh-text); box-shadow:0 18px 60px rgba(0,0,0,.35); }
  header { display:flex; align-items:start; justify-content:space-between; gap:18px; }
  header h3 { margin:0 0 7px; font-size:20px; }
  header p { margin:0; color:var(--rh-muted); font-size:13px; line-height:1.45; }
  button { padding:10px 13px; border:1px solid var(--rh-border); border-radius:8px; background:var(--rh-surface-soft); color:var(--rh-text); cursor:pointer; font:inherit; font-size:13px; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  .close { min-width:40px; min-height:40px; font-size:24px; }
  .picker-map { width:100%; height:min(58dvh,560px); min-height:260px; border:1px solid var(--rh-border); border-radius:9px; overflow:hidden; }
  .picker-footer { display:flex; flex-wrap:wrap; align-items:center; gap:9px; }
  .details { flex:1 1 230px; display:grid; gap:3px; }
  .details small { color:var(--rh-muted); font-size:12px; }
  .primary { background:#173d2c; color:#fff; border-color:#173d2c; font-weight:700; }
  .error { color:var(--rh-danger-text); margin:0; }
  :global(.release-pin) { display:block; width:30px; height:30px; border:3px solid #fff; border-radius:50% 50% 50% 4px; background:#7b4295; transform:rotate(-45deg); box-shadow:0 2px 9px rgba(0,0,0,.4); }
  @media(max-width:640px) { .release-picker { padding:8px; } .picker-content { padding:10px; } .picker-map { height:50dvh; } }
</style>
