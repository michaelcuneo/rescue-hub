<script lang="ts">
  import { onMount } from 'svelte';
  import MapBox from '$lib/components/MapBox.svelte';
  import DispatcherShell from '$lib/components/DispatcherShell.svelte';
  import { data as rescueData, people, selectedRescue, routingExceptions } from '$lib/stores';
  import { subscribeRescueChanges, type RealtimeConfig } from '../../../core/realtime-client';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type RescueRecord = PageData['rescues'][number];
  const colourForStatus = (status: string) => {
    if (status === 'ASSIGNED') return 'ffbf00';
    if (status === 'COMPLETED') return '238823';
    return 'd2222d';
  };
  function showRescues(rescues: RescueRecord[]) {
    const mapped = rescues.map(rescue => ({
      ...rescue,
      breed: rescue.breed ?? '',
      location: rescue.location ?? '',
      injury: rescue.injury ?? '',
      assignedUserId: rescue.assignedUserId ?? undefined,
      color: colourForStatus(rescue.status),
      disabled: false
    }));
    rescueData.set({
      pending: mapped.filter(rescue => rescue.status === 'PENDING'),
      assigned: mapped.filter(rescue => rescue.status === 'ASSIGNED'),
      completed: mapped.filter(rescue => rescue.status === 'COMPLETED')
    });
    selectedRescue.update(selected => selected
      ? mapped.find(rescue => rescue.id === selected.id) ?? null
      : null
    );
  }

  onMount(() => {
    people.set(data.people ?? []);
    routingExceptions.set(data.routingExceptions ?? []);
    selectedRescue.set(null);
    showRescues(data.rescues);
    let disposed = false;
    let connected = false;
    let stop: (() => void) | null = null;
    let retryConfig: ReturnType<typeof setTimeout> | null = null;
    let delayedRefresh: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let pending = false;

    const reload = async () => {
      if (disposed) return;
      if (inFlight) { pending = true; return; }
      inFlight = true;
      try {
        const response = await fetch('/api/rescues/feed', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Rescue snapshot HTTP ${response.status}`);
        const snapshot = await response.json() as { items: RescueRecord[]; routingExceptions: PageData['routingExceptions'] };
        if (!disposed) {
          showRescues(snapshot.items);
          routingExceptions.set(snapshot.routingExceptions ?? []);
        }
      } catch (error) {
        if (!disposed) console.error('Desktop realtime rescue refresh failed:', error);
      } finally {
        inFlight = false;
        if (pending && !disposed) { pending = false; void reload(); }
      }
    };

    const start = async () => {
      try {
        const response = await fetch('/api/realtime', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Realtime configuration HTTP ${response.status}`);
        const config = await response.json() as RealtimeConfig;
        if (disposed) return;
        stop = subscribeRescueChanges(config, {
          onChange: () => {
            void reload();
            // DynamoDB GSIs are eventually consistent. Reconcile shortly after
            // invalidation so a just-created or transferred case is not missed.
            if (delayedRefresh) clearTimeout(delayedRefresh);
            delayedRefresh = setTimeout(() => void reload(), 1500);
          },
          onConnected: () => void reload(),
          onStatus: online => { connected = online; }
        });
      } catch (error) {
        if (!disposed) {
          console.error('Desktop realtime connection unavailable:', error);
          retryConfig = setTimeout(() => void start(), 10_000);
        }
      }
    };
    void start();
    const whenVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    const whenOnline = () => void reload();
    document.addEventListener('visibilitychange', whenVisible);
    window.addEventListener('online', whenOnline);
    // Safety net only while disconnected; normal updates are subscriptions.
    const fallback = setInterval(() => {
      if (!connected) void reload();
    }, 30_000);
    return () => {
      disposed = true;
      clearInterval(fallback);
      if (retryConfig) clearTimeout(retryConfig);
      if (delayedRefresh) clearTimeout(delayedRefresh);
      document.removeEventListener('visibilitychange', whenVisible);
      window.removeEventListener('online', whenOnline);
      stop?.();
    };
  });
</script>

<div class="dispatch-workspace">
  <MapBox />
  <DispatcherShell backendOnline={data.backendOnline} user={data.user} demoMode={data.demoMode} membershipConfig={data.membershipConfig} />
</div>

<style>
  /* One set of measurements keeps the fixed desktop queue and map panels aligned. */
  .dispatch-workspace {
    --dispatch-gutter: 16px;
    --dispatch-queue-width: 365px;
    --dispatch-content-top: 84px;
    --dispatch-areas-width: clamp(240px, 22vw, 285px);
    position: relative;
    min-height: 100dvh;
    background:var(--rh-background);
  }

  @media (max-width: 900px) {
    .dispatch-workspace {
      --dispatch-queue-width: 330px;
    }
  }

  @media (max-width: 700px) {
    .dispatch-workspace {
      --dispatch-gutter: 10px;
    }
  }
</style>
