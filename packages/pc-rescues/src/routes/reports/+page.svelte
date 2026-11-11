<script lang="ts">
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { subscribeRescueChanges, type RealtimeConfig } from '../../../../core/realtime-client';
  let { data }: { data: PageData } = $props();
  let reports = $state<PageData['reports']>([]);
  onMount(() => {
    reports = data.reports;
    let closed = false;
    let stop: (() => void) | undefined;
    let connected = false;
    let inflight = false;
    let delayedRefresh: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      if (closed || inflight) return;
      inflight = true;
      try {
        const response = await fetch('/api/dispatch/reports', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Public report feed HTTP ${response.status}`);
        const payload = await response.json() as { items: PageData['reports'] };
        if (!closed) reports = payload.items;
      } catch (e) {
        if (!closed) console.error('Public report refresh failed:', e);
      } finally { inflight = false; }
    };

    const connect = async () => {
      try {
        const response = await fetch('/api/realtime', { cache: 'no-store' });
        if (!response.ok) throw new Error('Realtime feed unavailable.');
        const config = await response.json() as RealtimeConfig;
        if (closed) return;
        stop = subscribeRescueChanges(config, {
          onChange: () => {
            void refresh();
            if (delayedRefresh) clearTimeout(delayedRefresh);
            delayedRefresh = setTimeout(() => void refresh(), 1500);
          },
          onConnected: () => { void refresh(); },
          onStatus: online => { connected = online; }
        });
      } catch {
        if (!closed) {
          console.warn('Public dispatch live feed unavailable; fallback refresh active.');
          retry = setTimeout(() => void connect(), 10_000);
        }
      }
    };
    void connect();
    const fallback = setInterval(() => { if (!connected) void refresh(); }, 30_000);
    const visibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      closed = true;
      clearInterval(fallback);
      if (delayedRefresh) clearTimeout(delayedRefresh);
      if (retry) clearTimeout(retry);
      document.removeEventListener('visibilitychange', visibility);
      stop?.();
    };
  });
  let busy = $state('');
  let error = $state('');
  let notice = $state('');

  async function approve(id: string) {
    if (busy) return;
    busy = id; error = ''; notice = '';
    try {
      const response = await fetch(`/api/dispatch/reports/${encodeURIComponent(id)}/convert`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      });
      const payload = await response.json() as { rescue?: { id: string }; error?: string };
      if (!response.ok || !payload.rescue) throw new Error(payload.error ?? 'Could not convert report.');
      reports = reports.map(report => report.id === id
        ? { ...report, status: 'CONVERTED', rescueId: payload.rescue!.id } : report);
      notice = 'Report accepted. An operational rescue has been created and eligible rescuers notified.';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not convert report.';
    } finally { busy = ''; }
  }
</script>

<svelte:head><title>Public wildlife reports — Rescue Hub dispatch</title></svelte:head>
<main>
  <header>
    <div><p class="eyebrow">RESCUE HUB · DISPATCH</p><h1>Public wildlife reports</h1></div>
    <a href="/">Back to dispatch map</a>
  </header>
  <p>Reports from the public. GPS-matched reports are sent to the relevant organisation automatically. This queue keeps the original unverified observations and lets central coordinators review exceptions. No manual organisation selection.</p>
  {#if error}<p role="alert" class="error">{error}</p>{/if}
  {#if notice}<p role="status" class="success">{notice}</p>{/if}
  {#if reports.length === 0}<p>No public reports received yet.</p>{/if}
  <div class="reports">
    {#each reports as report (report.id)}
      <article>
        <div class="record-head">
          <div>
            <p class="eyebrow">REPORTED · {new Date(report.createdAt).toLocaleString('en-AU')}</p>
            <h2>{report.animal}</h2>
          </div>
          <span class:accepted={report.status === 'CONVERTED'} class="status">{report.status.replaceAll('_', ' ')}</span>
        </div>
        <p>{report.condition}</p>
        <p class="location">Location: {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</p>
        <div class="actions">
          <a href="https://www.openstreetmap.org/?mlat={report.latitude}&mlon={report.longitude}#map=15/{report.latitude}/{report.longitude}"
            target="_blank" rel="noopener noreferrer">Inspect reported location</a>
          {#if report.status === 'SUBMITTED'}
            <p class="routing">GPS routing: {report.routingStatus === 'MATCHED' ? report.areaLabel || report.organisationId : report.routingReason || 'Awaiting boundary lookup'}</p>
            <button onclick={() => void approve(report.id)}
              disabled={busy !== ''}>
              {busy === report.id ? 'Rechecking…' : 'Retry GPS dispatch'}
            </button>
          {:else if report.rescueId}
            <a href="/rescues/{report.rescueId}/care">View operational case</a>
          {/if}
        </div>
      </article>
    {/each}
  </div>
</main>
<style>
  main{max-width:1100px;margin:auto;padding:26px;font-family:Inter,system-ui,sans-serif;color:var(--rh-t185, #17211d)}
  header{display:flex;align-items:center;justify-content:space-between;gap:20px}
  h1{font-size:30px;margin:6px 0}h2{font-size:20px;margin:4px 0}
  p{line-height:1.5;color:var(--rh-t225, #526458)}a{color:var(--rh-t192, #24583f);font-weight:700}
  .eyebrow{font-size:11px;font-weight:900;letter-spacing:.1em;color:var(--rh-t226, #718474);margin:0}
  .reports{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:12px}
  article{padding:18px;background:var(--rh-t186, white);border:1px solid var(--rh-t178, #d9e1dc);border-radius:12px;display:grid;gap:9px}
  .record-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
  .status{background:var(--rh-t227, #fff4d6);padding:6px 9px;border-radius:99px;font-size:11px;font-weight:800}
  .accepted{background:var(--rh-t228, #dff4e4);color:var(--rh-t192, #24583f)}
  .location{font-size:12px;font-weight:800}
  .actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
  button{padding:10px 13px;background:#173d2c;color:white;border:0;border-radius:9px;cursor:pointer;font-weight:800}
  .routing{font-size:12px;font-weight:800;color:var(--rh-t198, #173d2c)}
  button:disabled{opacity:.5}
  .error{color:var(--rh-t181, #a23f35);font-weight:800}.success{background:var(--rh-t229, #e4f2e8);padding:10px;border-radius:10px;color:var(--rh-t192, #24583f)}
</style>
