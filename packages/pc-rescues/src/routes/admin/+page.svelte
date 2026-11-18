<script lang="ts">
  import { rescueNSWDay, rescueTodayNSW, shiftRescueDay, rescueDayLabel, type RescuePeriod, type RescueOrder } from '$lib/rescue-list';
  import AdminOperatingAreas from '$lib/components/AdminOperatingAreas.svelte';
  import AdminRescueHistoryMap from '$lib/components/AdminRescueHistoryMap.svelte';
  import type { PageData } from './$types';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import FeedbackModal from '$lib/components/FeedbackModal.svelte';
  import { portal } from '$lib/actions/portal';
  import { adminActionFeedback, type FeedbackNotice } from '../../../../core/admin-feedback';
  import { invitationEmailLabel, invitationExpired } from '../../../../core/invitation-delivery';

  let { data }: { data: PageData } = $props();

  type Section =
    | 'overview'
    | 'organisations'
    | 'rescues'
    | 'regions'
    | 'people'
    | 'audit';

  type PeopleView = 'people' | 'positions' | 'clinics';
  type RescueView = 'list' | 'map';
  let section = $state<Section>('overview');
  let peopleView = $state<PeopleView>('people');
  let peopleNavOpen = $state(true);
  let rescueView = $state<RescueView>('list');
  let rescueNavOpen = $state(true);
  let organisationSearch = $state('');
  let rescueSearch = $state('');
  let rescueStatus = $state<'active' | 'all' | 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED'>('active');
  let rescuePeriod = $state<RescuePeriod | 'selected_day'>('all');
  let rescueOrder = $state<RescueOrder>('newest');
  let rescueOrganisation = $state('all');
  let archiveRows = $state<PageData['rescues']>([]);
  let archiveNextToken = $state<string | null>(null);
  let archiveHasMore = $state(false);
  let archiveLoading = $state(false);
  let archiveLoaded = $state(false);
  let archiveError = $state('');
  let archiveExamined = $state(0);
  let archiveController: AbortController | null = null;
  let rescueDate = $state(rescueTodayNSW());
  let rescueMapMode = $state<'all' | 'single' | 'range'>('all');
  let rescueRangeFrom = $state(shiftRescueDay(rescueTodayNSW(), -6));
  let rescueRangeTo = $state(rescueTodayNSW());
  let rescueMapExamined = $state(0);
  let rescueDayItems = $state<PageData['rescues']>([]);
  let rescueDayLoaded = $state(false);
  let rescueDayLoading = $state(false);
  let rescueDayError = $state('');
  let rescueMapSelectedId = $state<string | null>(null);
  let rescueMapFocusedRescue = $state<PageData['rescues'][number] | null>(null);

  let peopleSearch = $state('');
  let positionOrganisationId = $state('');
  let peopleFilter = $state<'all' | 'invited' | 'available' | 'admins' | 'disabled'>('all');
  let showInvite = $state(false);
  let selectedPersonId = $state<string | null>(null);
  let feedback = $state<FeedbackNotice | null>(null);
  let saving = $state(false);
  // Only new user submissions may open a feedback notice. Never watch stale
  // action form data: SvelteKit invalidations can recreate its identity and
  // reopen an already acknowledged modal.
  const handleAdminSubmit: SubmitFunction = ({ cancel }) => {
    if (saving) { cancel(); return; }
    saving = true;
    return async ({ result, update }) => {
      saving = false;
      if (result.type === 'error') {
        feedback = { kind: 'error', title: 'Request failed',
          message: 'The server could not process your request. Your changes were not confirmed.' };
        return;
      }
      if (result.type === 'redirect') {
        await update();
        return;
      }
      const response = result.data as { action?: string; success?: boolean; error?: string;
        userId?: string; devCode?: string } | undefined;
      if (response?.action) {
        section = 'people';
        if (response.action === 'addOrganisationPosition' ||
            response.action === 'deactivateOrganisationPosition') peopleView = 'positions';
        if (response.action === 'createVetClinic') peopleView = 'clinics';
        if (response.action === 'inviteUser') showInvite = result.type === 'failure';
        if (response.action === 'removeUser' && result.type === 'success') selectedPersonId = null;
        if (['correctInvitationEmail', 'resendInvitation'].includes(response.action) &&
            response.userId) selectedPersonId = response.userId;
      }
      await update({ reset: result.type === 'success', invalidateAll: result.type === 'success' });
      feedback = response
        ? adminActionFeedback(response)
        : { kind: result.type === 'success' ? 'success' : 'error',
            title: result.type === 'success' ? 'Changes saved' : 'Could not save changes',
            message: result.type === 'success' ? 'Your changes were saved.' :
              'No detailed server response was returned. Please check the record.' };
    };
  };
  $effect(() => {
    // Backend health is shown inline. A refresh must never open an unsolicited modal.
    if (!positionOrganisationId)
      positionOrganisationId = data.currentUser.organisationId ?? data.organisations[0]?.id ?? '';
    const target = page.url.searchParams.get('section');
    if (target && ['overview','organisations','rescues','regions','people','audit'].includes(target))
      section = target as Section;
    const subsection = page.url.searchParams.get('sub');
    if (target === 'rescues' && subsection && ['list','map'].includes(subsection))
      rescueView = subsection as RescueView;
    if (target === 'people' && subsection && ['people','positions','clinics'].includes(subsection))
      peopleView = subsection as PeopleView;
  });
  function chooseSection(next: Section) {
    section = next;
    const url = new URL(page.url);
    url.searchParams.set('section', next);
    if (next === 'rescues') url.searchParams.set('sub', rescueView);
    else if (next === 'people') url.searchParams.set('sub', peopleView);
    else url.searchParams.delete('sub');
    void goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: false });
  }
  function chooseRescueView(next: RescueView) {
    section = 'rescues';
    rescueView = next;
    rescueNavOpen = true;
    const url = new URL(page.url);
    url.searchParams.set('section', 'rescues');
    url.searchParams.set('sub', next);
    void goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: false, invalidateAll: false });
  }
  function toggleRescueNavigation() {
    if (section === 'rescues') rescueNavOpen = !rescueNavOpen;
    else chooseRescueView(rescueView);
  }
  function selectRescueDate(date: string) {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))) return;
    if (new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) return;
    if (date > rescueTodayNSW()) return;
    rescueDate = date;
    rescueMapSelectedId = null;
    rescueMapFocusedRescue = null;
  }
  function showRescueOnMap(rescue: PageData['rescues'][number]) {
    const day = rescueNSWDay(rescue.createdAt);
    if (!day) return;
    // The archive's date index is the original report date, not the last
    // status change. Carry the selected case while its historical page loads.
    selectRescueDate(day);
    rescueMapMode = 'single';
    rescueMapFocusedRescue = rescue;
    rescueMapSelectedId = rescue.id;
    if (canChooseOrganisation) rescueOrganisation = rescue.organisationId ?? 'all';
    chooseRescueView('map');
  }
  function choosePeopleView(next: PeopleView) {
    section = 'people';
    peopleView = next;
    peopleNavOpen = true;
    showInvite = false;
    selectedPersonId = null;
    const url = new URL(page.url);
    url.searchParams.set('section', 'people');
    url.searchParams.set('sub', next);
    void goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: false, invalidateAll: false });
  }
  function togglePeopleNavigation() {
    if (section === 'people') peopleNavOpen = !peopleNavOpen;
    else choosePeopleView(peopleView);
  }
  let inviteOrganisationId = $state('');
  // New invitations start with no permissions, species teams, transport or positions.
  // Administrators deliberately select each independent responsibility.

  const visiblePeople = $derived(data.users.filter((user) => {
    const query = peopleSearch.trim().toLowerCase();
    const positions = membershipConfigFor(user).positions ?? [];
    const titleNames = (user.positionIds ?? []).map(id => positions.find(position => position.id === id)?.name ?? '');
    const matches = !query || [user.name, user.email, user.positionTitle ?? '', ...titleNames, organisationName(user.organisationId), user.roles.join(' '), ...teamNames(user)].join(' ').toLowerCase().includes(query);
    const filterMatches = peopleFilter === 'all' ||
      (peopleFilter === 'invited' && user.enabled && user.status === 'INVITED' && !user.roles.includes('PUBLIC_REPORTER')) ||
      (peopleFilter === 'available' && user.enabled && user.availabilityStatus === 'AVAILABLE') ||
      (peopleFilter === 'admins' && user.roles.some((role) => role.includes('ADMIN'))) ||
      (peopleFilter === 'disabled' && !user.enabled);
    return matches && filterMatches;
  }));
  const selectedPerson = $derived(data.users.find((user) => user.id === selectedPersonId));
  const roleOptions = [
    { id: 'RESCUER', label: 'Rescuer — field rescue access' },
    { id: 'CARER', label: 'Carer — custody and care access' },
    { id: 'VET_STAFF', label: 'Veterinary clinic staff — clinic-only workspace' },
    { id: 'DISPATCHER', label: 'Dispatcher — coordinate organisation jobs' },
    { id: 'ORG_ADMIN', label: 'Organisation administrator' },
    { id: 'DATA_STEWARD', label: 'Data steward — records support' },
    { id: 'AUTHORITY_AUDITOR', label: 'Authority auditor' },
    { id: 'AUTHORITY_ADMIN', label: 'Authority administrator' },
    { id: 'PLATFORM_ADMIN', label: 'Platform administrator — full platform access' }
  ] as const;
  const inviteMembershipConfig = $derived(
    data.membershipConfigs[inviteOrganisationId || data.currentUser.organisationId || ''] ?? {
      teams: data.standardTeams,
      positions: [] as { id: string; name: string; active: boolean }[]
    }
  );

  const openRescues = $derived(
    data.rescues.filter((rescue) => rescue.status === 'PENDING' || rescue.status === 'ASSIGNED')
  );

  const pendingRescues = $derived(
    data.rescues.filter((rescue) => rescue.status === 'PENDING')
  );

  const gisOrganisations = $derived(
    data.organisations.filter((organisation) => organisation.boundaryStatus === 'GIS_AVAILABLE')
  );

  const visibleOrganisations = $derived(
    data.organisations.filter((organisation) => {
      const query = organisationSearch.trim().toLowerCase();
      if (!query) return true;

      return [
        organisation.displayName,
        organisation.officialName,
        organisation.areaDescription,
        organisation.speciesSpeciality,
        ...organisation.aliases
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
  );

  const archiveFilterKey = $derived(JSON.stringify({
    q: rescueSearch, status: rescueStatus, period: rescuePeriod,
    date: rescueDate, organisation: rescueOrganisation, order: rescueOrder
  }));
  function archiveParams(cursor?: string): URLSearchParams {
    const params = new URLSearchParams({
      q: rescueSearch, status: rescueStatus, period: rescuePeriod,
      date: rescueDate, organisation: rescueOrganisation, order: rescueOrder
    });
    if (cursor) params.set('cursor', cursor);
    return params;
  }
  async function fetchArchivePage(controller: AbortController, reset: boolean): Promise<void> {
    if (archiveLoading && !reset) return;
    archiveLoading = true;
    archiveError = '';
    try {
      const params = archiveParams(reset ? undefined : archiveNextToken ?? undefined);
      const response = await fetch(`/api/admin/rescues/search?${params.toString()}`, {
        signal: controller.signal, cache: 'no-store'
      });
      const payload = await response.json() as {
        items?: PageData['rescues'];
        nextToken?: string | null;
        hasMore?: boolean;
        examined?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? `Archive search HTTP ${response.status}`);
      if (controller.signal.aborted) return;
      const nextItems = payload.items ?? [];
      archiveRows = reset ? nextItems : [...archiveRows, ...nextItems];
      archiveExamined = reset ? (payload.examined ?? 0) : archiveExamined + (payload.examined ?? 0);
      archiveNextToken = payload.nextToken ?? null;
      archiveHasMore = Boolean(payload.hasMore && payload.nextToken);
      archiveLoaded = true;
    } catch (error) {
      if (!controller.signal.aborted) archiveError = error instanceof Error ? error.message : 'Archive search failed';
    } finally {
      if (!controller.signal.aborted) archiveLoading = false;
    }
  }
  $effect(() => {
    // The archive API, not the browser or the operational 200-row snapshot,
    // owns all filtering and continuation through historical cases.
    if (section !== 'rescues' || rescueView !== 'list') return;
    archiveFilterKey;
    archiveController?.abort();
    const controller = new AbortController();
    archiveController = controller;
    archiveRows = [];
    archiveNextToken = null;
    archiveHasMore = false;
    archiveLoaded = false;
    archiveLoading = false;
    archiveError = '';
    archiveExamined = 0;
    const timer = setTimeout(() => void fetchArchivePage(controller, true), rescueSearch.trim() ? 280 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (archiveController === controller) archiveController = null;
    };
  });
  function loadMoreArchive() {
    if (!archiveController || archiveLoading || !archiveHasMore) return;
    void fetchArchivePage(archiveController, false);
  }
  // The map has its own complete paginated archive query; List search remains
  // unchanged. Each filter change cancels any previous in-flight map request.
  $effect(() => {
    if (section !== 'rescues' || rescueView !== 'map') return;
    const mode = rescueMapMode;
    const day = rescueDate;
    const from = rescueRangeFrom;
    const to = rescueRangeTo;
    const organisation = rescueOrganisation;
    const controller = new AbortController();
    rescueDayLoading = true;
    rescueDayLoaded = false;
    rescueDayError = '';
    rescueDayItems = [];
    rescueMapExamined = 0;

    if (mode === 'range' && (from > to || to > rescueTodayNSW())) {
      rescueDayLoading = false;
      rescueDayError = 'The date range must start on or before its end, and cannot extend into the future.';
      return () => controller.abort();
    }
    void (async () => {
      let cursor: string | null = null;
      const seenCursors = new Set<string>();
      const collected = new Map<string, PageData['rescues'][number]>();
      do {
        const params = new URLSearchParams({
          period: mode === 'all' ? 'all' : mode === 'single' ? 'selected_day' : 'range',
          organisation,
          date: day,
          from,
          to
        });
        if (cursor) params.set('cursor', cursor);
        const response = await fetch(`/api/admin/rescues/map?${params.toString()}`, {
          cache: 'no-store', signal: controller.signal
        });
        const payload = await response.json() as {
          items?: PageData['rescues'];
          examined?: number;
          nextToken?: string | null;
          hasMore?: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || `Map archive HTTP ${response.status}`);
        if (controller.signal.aborted) return;
        for (const record of payload.items ?? []) collected.set(record.id, record);
        rescueDayItems = [...collected.values()];
        rescueMapExamined += payload.examined ?? 0;
        const next = payload.hasMore ? payload.nextToken ?? null : null;
        if (next && seenCursors.has(next)) throw new Error('Archive continuation repeated unexpectedly');
        if (next) seenCursors.add(next);
        cursor = next;
      } while (cursor && !controller.signal.aborted);
      if (!controller.signal.aborted) rescueDayLoaded = true;
    })().catch(error => {
      if (!controller.signal.aborted) rescueDayError = error instanceof Error ? error.message : 'Unable to load rescue map';
    }).finally(() => {
      if (!controller.signal.aborted) rescueDayLoading = false;
    });
    return () => controller.abort();
  });

  const navigation: Array<{ id: Section; label: string; short: string }> = [
    { id: 'overview', label: 'Overview', short: 'OV' },
    { id: 'organisations', label: 'Organisations', short: 'OR' },
    { id: 'rescues', label: 'Rescues', short: 'RE' },
    { id: 'regions', label: 'Operating areas', short: 'OA' },
    { id: 'people', label: 'People & access', short: 'PE' },
    { id: 'audit', label: 'Audit', short: 'AU' }
  ];

  const statusLabel = (status: string) =>
    status.charAt(0) + status.slice(1).toLowerCase();

  const assignedRescuerName = (id?: string | null): string => {
    if (!id) return 'Unassigned';
    const person = data.users.find(user => user.id === id);
    return person?.name?.trim() || person?.email || 'Assigned member unavailable';
  };

  const organisationName = (id?: string) =>
    data.organisations.find((organisation) => organisation.id === id)?.displayName ??
    (id || 'No organisation');

  const membershipConfigFor = (user: { organisationId?: string }) =>
    (user.organisationId ? data.membershipConfigs[user.organisationId] : undefined) ?? {
      membershipTypes: data.standardMembershipTypes,
      teams: data.standardTeams,
      positions: [] as { id: string; name: string; active: boolean }[]
    };


  const teamNames = (user: { organisationId?: string; teamIds: string[] }) => {
    const config = membershipConfigFor(user);
    const ids = new Set(user.teamIds ?? []);
    return config.teams.filter((team) => ids.has(team.id)).map((team) => team.name);
  };

  const canChooseOrganisation = $derived(
    data.currentUser.roles.includes('PLATFORM_ADMIN') ||
      data.currentUser.roles.includes('AUTHORITY_ADMIN')
  );

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Australia/Sydney'
    }).format(new Date(value));
</script>

<svelte:window onkeydown={(event) => {
  if (event.key !== 'Escape' || feedback) return;
  if (selectedPersonId) selectedPersonId = null;
  else if (showInvite) showInvite = false;
}} />

{#if feedback}
  <FeedbackModal kind={feedback.kind} title={feedback.title}
    message={feedback.message} detail={feedback.detail}
    onDismiss={() => (feedback = null)} />
{/if}
{#if saving}
  <div class="save-progress" role="status" aria-live="polite">Saving changes…</div>
{/if}
<div class="admin-shell" class:historical-map-workspace={section === 'rescues' && rescueView === 'map'}>
  <aside class="sidebar">
    <nav aria-label="Administration">
      {#each navigation as item}
        <button
          class:active={section === item.id}
          type="button"
          aria-expanded={item.id === 'people' ? section === 'people' && peopleNavOpen : item.id === 'rescues' ? section === 'rescues' && rescueNavOpen : undefined}
          onclick={() => item.id === 'people' ? togglePeopleNavigation() : item.id === 'rescues' ? toggleRescueNavigation() : chooseSection(item.id)}
        >
          <span class="nav-icon">{item.short}</span>
          <span>{item.label}</span>
          {#if item.id === 'people' || item.id === 'rescues'}
            <span class="people-caret" aria-hidden="true">{section === item.id && (item.id === 'rescues' ? rescueNavOpen : peopleNavOpen) ? '▾' : '▸'}</span>
          {/if}
        </button>
        {#if item.id === 'rescues' && section === 'rescues' && rescueNavOpen}
          <div class="people-subnav" role="group" aria-label="Rescue administration views">
            {#each [{ id: 'list', label: 'List' }, { id: 'map', label: 'Map' }] as child}
              <button type="button" class:active={rescueView === child.id}
                aria-current={rescueView === child.id ? 'page' : undefined}
                onclick={() => chooseRescueView(child.id as RescueView)}>{child.label}</button>
            {/each}
          </div>
        {/if}
        {#if item.id === 'people' && section === 'people' && peopleNavOpen}
          <div class="people-subnav" role="group" aria-label="People and access sections">
            {#each [
              { id: 'people', label: 'People' },
              { id: 'positions', label: 'Organisation Positions' },
              { id: 'clinics', label: 'Veterinary Clinics' }
            ] as child}
              <button type="button" class:active={peopleView === child.id}
                aria-current={peopleView === child.id ? 'page' : undefined}
                onclick={() => choosePeopleView(child.id as PeopleView)}>{child.label}</button>
            {/each}
          </div>
        {/if}
      {/each}
    </nav>
    {#if section === 'rescues' && rescueView === 'map'}
      <div class="historical-map-filters" aria-label="Historical map filters">
          <div class="panel-heading table-heading">
              <div>
                <p class="eyebrow">Historical rescue map</p>
                <h2>Rescue locations</h2>
                <p class="intro">Explore every rescue location, or filter by an NSW calendar day or date range. Completed cases stay in the historical map.</p>
              </div>
            </div>
            <div class="rescue-map-toolbar">
              <label><span>Map history</span>
                <select bind:value={rescueMapMode} aria-label="Rescue map date filter">
                  <option value="all">All rescues · any dates</option>
                  <option value="single">Specific day</option>
                  <option value="range">Date range</option>
                </select>
              </label>
              {#if rescueMapMode === 'single'}
                <button type="button" aria-label="Previous day" onclick={() => selectRescueDate(shiftRescueDay(rescueDate, -1))}>Previous</button>
                <label><span>Report date · NSW</span>
                  <input type="date" value={rescueDate} max={rescueTodayNSW()}
                    onchange={(event) => selectRescueDate(event.currentTarget.value)} />
                </label>
                <button type="button" aria-label="Next day" disabled={rescueDate >= rescueTodayNSW()}
                  onclick={() => selectRescueDate(shiftRescueDay(rescueDate, 1))}>Next</button>
                <button type="button" onclick={() => selectRescueDate(rescueTodayNSW())}>Today</button>
              {:else if rescueMapMode === 'range'}
                <label><span>From · NSW</span><input type="date" bind:value={rescueRangeFrom} max={rescueTodayNSW()} /></label>
                <label><span>To · NSW</span><input type="date" bind:value={rescueRangeTo} max={rescueTodayNSW()} /></label>
              {/if}
              {#if canChooseOrganisation}
                <label><span>Organisation</span>
                  <select bind:value={rescueOrganisation}>
                    <option value="all">All organisations</option>
                    {#each data.organisations as organisation (organisation.id)}
                      <option value={organisation.id}>{organisation.displayName}</option>
                    {/each}
                  </select>
                </label>
              {/if}
            </div>
            <p class="rescue-map-date" role="status" aria-live="polite">
              {rescueMapMode === 'all' ? 'All dates' : rescueMapMode === 'single' ? rescueDayLabel(rescueDate) : `${rescueRangeFrom} to ${rescueRangeTo}`}
              · {rescueDayItems.length} rescues loaded
              {rescueDayLoading ? ` · loading more locations (${rescueMapExamined} records examined)…` : ''}
              {rescueDayLoaded ? ' · archive loaded' : ''}
            </p>
            {#if rescueDayError}
              <p class="rescue-day-error" role="alert">Historical map loading issue: {rescueDayError}</p>
            {/if}
      </div>
    {/if}
    <div class="sidebar-footer">
      <div class:online={data.backend.online} class="status-dot"></div>
      <div>
        <strong>{data.backend.online ? 'Services connected' : 'Services unavailable'}</strong>
        <span>{data.backend.online ? 'Rescue Hub services' : 'Backend data unavailable'}</span>
      </div>
    </div>
  </aside>

  <main>
    {#if !data.backend.online}
      <section class="backend-warning">
        <strong>Some Rescue Hub services are currently unavailable.</strong>
        <span>
          Try again shortly. If the problem continues, contact your platform administrator.
        </span>
        {#if data.backend.errors.length}
          <details>
            <summary>Backend diagnostics</summary>
            {#each data.backend.errors as error}
              <code>{error}</code>
            {/each}
          </details>
        {/if}
      </section>
    {/if}

    {#if section === 'overview'}
      <section class="metrics" aria-label="Operational summary">
        <article>
          <span class="metric-label">NSW organisations</span>
          <strong>{data.organisations.length || 35}</strong>
          <small>DCCEEW public directory</small>
        </article>
        <article>
          <span class="metric-label">Open rescues</span>
          <strong>{openRescues.length}</strong>
          <small>{pendingRescues.length} waiting for assignment</small>
        </article>
        <article>
          <span class="metric-label">GIS operating areas</span>
          <strong>{gisOrganisations.length}</strong>
          <small>authoritative geometry available</small>
        </article>
        <article>
          <span class="metric-label">Active accounts</span>
          <strong>{data.users.filter((member) => member.enabled && member.status === 'ACTIVE').length}</strong>
          <small>Enabled people with active access</small>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="panel wide">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Directory</p>
              <h2>NSW rescue organisations</h2>
            </div>
            <button class="text-button" type="button" onclick={() => (section = 'organisations')}>
              View all
            </button>
          </div>

          <div class="organisation-list">
            {#if data.organisations.length}
              {#each data.organisations.slice(0, 7) as organisation}
                <button
                  type="button"
                  class="organisation-row"
                  onclick={() => (section = 'organisations')}
                >
                  <span class="org-initials">
                    {organisation.displayName
                      .split(' ')
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join('')}
                  </span>
                  <span class="org-main">
                    <strong>{organisation.displayName}</strong>
                    <small>{organisation.areaDescription}</small>
                  </span>
                  <span class:gis={organisation.boundaryStatus === 'GIS_AVAILABLE'} class="boundary">
                    {organisation.boundaryStatus === 'GIS_AVAILABLE' ? 'GIS boundary' : 'Text area'}
                  </span>
                  <span class="claim">Unclaimed</span>
                </button>
              {/each}
            {:else}
              <div class="empty-state">
                <strong>Directory ready to load</strong>
                <span>The 35 seeded NSW organisations will appear once the SST stage is running.</span>
              </div>
            {/if}
          </div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Dispatch</p>
              <h2>Live rescue state</h2>
            </div>
          </div>

          <div class="rescue-summary">
            <div>
              <span>Pending</span>
              <strong>{pendingRescues.length}</strong>
            </div>
            <div>
              <span>Assigned</span>
              <strong>{data.rescues.filter((rescue) => rescue.status === 'ASSIGNED').length}</strong>
            </div>
            <div>
              <span>Completed</span>
              <strong>{data.rescues.filter((rescue) => rescue.status === 'COMPLETED').length}</strong>
            </div>
          </div>

          <button class="primary-action" type="button" onclick={() => (section = 'rescues')}>
            Open rescue register
          </button>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Coverage</p>
              <h2>Operating-area readiness</h2>
            </div>
          </div>

          <div class="coverage-figure">
            <div
              class="coverage-ring"
              style={`--coverage: ${data.organisations.length ? Math.round((gisOrganisations.length / data.organisations.length) * 100) : 0}%`}
            >
              <strong>
                {data.organisations.length
                  ? Math.round((gisOrganisations.length / data.organisations.length) * 100)
                  : 0}%
              </strong>
            </div>
            <p>
              {gisOrganisations.length} of {data.organisations.length || 35} public provider
              records currently identify an available GIS operating-area source.
            </p>
          </div>
        </article>
      </section>
    {:else if section === 'organisations'}
      <section class="panel page-panel">
        <div class="panel-heading table-heading">
          <div>
            <p class="eyebrow">NSW DCCEEW directory</p>
            <h2>Organisation registry</h2>
            <p class="intro">
              Public directory entries remain unclaimed until an authorised representative is verified.
            </p>
          </div>
          <label class="search">
            <span>Search organisations</span>
            <input bind:value={organisationSearch} placeholder="Name, region or species…" />
          </label>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Operating area</th>
                <th>Species scope</th>
                <th>Boundary</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {#each visibleOrganisations as organisation}
                <tr>
                  <td>
                    <strong>{organisation.displayName}</strong>
                    {#if organisation.officialName !== organisation.displayName}
                      <span>{organisation.officialName}</span>
                    {/if}
                  </td>
                  <td>{organisation.areaDescription}</td>
                  <td>{organisation.speciesSpeciality}</td>
                  <td>
                    <span
                      class:gis={organisation.boundaryStatus === 'GIS_AVAILABLE'}
                      class="boundary"
                    >
                      {organisation.boundaryStatus === 'GIS_AVAILABLE' ? 'GIS available' : 'Text only'}
                    </span>
                  </td>
                  <td><span class="claim">Unclaimed</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {:else if section === 'rescues'}
      <section class="panel page-panel" class:historical-map-page={rescueView === 'map'}>
        {#if rescueView === 'map'}
          <AdminRescueHistoryMap rescues={rescueDayItems}
            selectedId={rescueMapSelectedId}
            focusedRescue={rescueMapFocusedRescue}
            onSelect={(id) => {
              rescueMapSelectedId = id;
              if (id !== rescueMapFocusedRescue?.id) rescueMapFocusedRescue = null;
            }} />
        {:else}
        <div class="panel-heading table-heading">
          <div><p class="eyebrow">Operational register</p><h2>Wildlife rescues</h2>
            <p class="intro">Search active and historical rescue records by status, organisation and report date.</p>
          </div>
        </div>
        <div class="rescue-register-toolbar">
          <label class="search"><span>Search rescues</span><input bind:value={rescueSearch} placeholder="Case ID, animal, suburb, responder…" /></label>
          <label><span>Status</span><select bind:value={rescueStatus}>
            <option value="active">Active rescues</option><option value="all">All statuses</option>
            <option value="PENDING">Pending</option><option value="ASSIGNED">Assigned</option>
            <option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
          </select></label>
          <label><span>Reported</span><select bind:value={rescuePeriod}>
            <option value="all">Any date</option><option value="today">Today</option>
            <option value="seven_days">Last 7 days</option><option value="older">Older than 7 days</option>
            <option value="selected_day">Specific calendar day</option>
          </select></label>
          {#if canChooseOrganisation}
            <label><span>Organisation</span><select bind:value={rescueOrganisation}>
              <option value="all">All organisations</option>
              {#each data.organisations as organisation (organisation.id)}
                <option value={organisation.id}>{organisation.displayName}</option>
              {/each}
            </select></label>
          {/if}
          {#if rescuePeriod === 'selected_day'}
            <label><span>NSW report date</span>
              <input type="date" value={rescueDate} max={rescueTodayNSW()}
                onchange={(event) => selectRescueDate(event.currentTarget.value)} />
            </label>
          {/if}
          <label><span>Sort</span><select bind:value={rescueOrder}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
          </select></label>
        </div>
        <p class="rescue-register-count" role="status">
          {#if archiveLoading && !archiveLoaded}Searching rescue history…
          {:else if archiveHasMore}Showing {archiveRows.length} matching rescues so far · more history available
          {:else if archiveLoaded}Found {archiveRows.length} matching rescues across the entire selected archive
          {:else}Search pending{/if}
        </p>
        {#if archiveError}
          <p class="rescue-day-error" role="alert">{archiveError}</p>
        {/if}
        {#if archiveRows.length}
          <div class="table-wrap"><table>
            <thead><tr><th>Animal / Case</th><th>Location</th><th>Status</th><th>Assigned</th><th>Reported</th><th>Updated</th><th>Map</th></tr></thead>
            <tbody>
              {#each archiveRows as rescue (rescue.id)}
                <tr>
                  <td><strong>{rescue.type}</strong>
                    {#if rescue.breed}<span>{rescue.breed}</span>{/if}
                    <span title={rescue.id}>#{rescue.id.length > 18 ? rescue.id.slice(-12) : rescue.id}</span>
                  </td>
                  <td>{rescue.location || 'Location not recorded'}</td>
                  <td><span class="rescue-status status-{rescue.status.toLowerCase()}">{statusLabel(rescue.status)}</span></td>
                  <td>{assignedRescuerName(rescue.assignedUserId)}</td>
                  <td>{formatDate(rescue.createdAt)}</td><td>{formatDate(rescue.updatedAt)}</td>
                  <td><button type="button" class="rescue-view-map" onclick={() => showRescueOnMap(rescue)}>View pin</button></td>
                </tr>
              {/each}
            </tbody>
          </table></div>
        {:else if archiveLoaded && !archiveHasMore}
          <div class="empty-state large"><strong>No matching rescues</strong><span>Try changing the search or filters.</span></div>
        {/if}
        {#if archiveHasMore}
          <div class="rescue-register-pagination">
            <button type="button" disabled={archiveLoading} onclick={loadMoreArchive}>
              {archiveLoading ? 'Searching more records…' : archiveRows.length ? 'Load 25 more matches' : 'Continue searching history'}
            </button>
            <span>{archiveExamined} archive records examined in this search</span>
          </div>
        {/if}
        {/if}
      </section>
    {:else if section === 'regions'}
      <section class="feature-grid">
        <article class="panel page-panel feature-copy">
          <p class="eyebrow">Operating areas</p>
          <h2>NSW geographic authority</h2>
          <p>
            Official DCCEEW wildlife rehabilitation boundaries are rendered directly below and linked
            to the Rescue Hub organisation directory for dispatch routing.
          </p>
          <div class="readiness">
            <span><strong>{gisOrganisations.length}</strong> GIS sources identified</span>
            <span><strong>{Math.max(0, data.organisations.length - gisOrganisations.length)}</strong> text-only areas</span>
          </div>
        </article>
        <AdminOperatingAreas onNotice={(notice) => (feedback = notice)} />
      </section>
    {:else if section === 'people'}
      <section class="people-workspace" aria-label="People and access management">
        <div class="people-head">
          <div>
            <p class="eyebrow">Identity & permissions</p>
            <h2>{peopleView === 'people' ? 'People directory' : peopleView === 'positions' ? 'Organisation Positions' : 'Veterinary Clinics'}</h2>
            <p class="intro">{peopleView === 'people'
              ? 'Manage member permissions, trained areas, transport and organisation assignments.'
              : peopleView === 'positions'
                ? 'Define committee and leadership titles separately from trained roles and system access.'
                : 'Manage approved veterinary practices and their verified collection locations.'}</p>
          </div>
          {#if peopleView === 'people'}
            <button class="primary-action" type="button" onclick={() => { inviteOrganisationId = data.currentUser.organisationId ?? data.organisations[0]?.id ?? ''; showInvite = true; }}>+ Invite person</button>
          {/if}
        </div>

        {#if peopleView === 'people'}
          <div class="people-stats" aria-label="People summary">
            <div><span>Total people</span><strong>{data.users.length}</strong></div>
            <div><span>Available now</span><strong>{data.users.filter(user => user.enabled && user.availabilityStatus === 'AVAILABLE').length}</strong></div>
            <div><span>Administrators</span><strong>{data.users.filter(user => user.roles.some(role => role.includes('ADMIN'))).length}</strong></div>
            <div><span>Awaiting invitations</span><strong>{data.users.filter(user => user.status === 'INVITED' && !user.roles.includes('PUBLIC_REPORTER')).length}</strong></div>
          </div>
          <div class="people-directory panel">
            <div class="directory-toolbar">
            <div><h3>People directory</h3><p>{visiblePeople.length} of {data.users.length} people</p></div>
            <label class="people-search"><span class="sr-only">Search people</span><input type="search" bind:value={peopleSearch} placeholder="Search people, organisations or teams…" /></label>
          </div>
          <div class="people-filters" aria-label="Filter people">
            {#each [{ id: 'all', label: 'Everyone' }, { id: 'invited', label: `Invited (${data.users.filter(user => user.status === 'INVITED' && !user.roles.includes('PUBLIC_REPORTER')).length})` }, { id: 'available', label: 'Available' }, { id: 'admins', label: 'Administrators' }, { id: 'disabled', label: 'Disabled' }] as filter}
              <button type="button" class:chosen={peopleFilter === filter.id} onclick={() => (peopleFilter = filter.id as typeof peopleFilter)}>{filter.label}</button>
            {/each}
          </div>
          <div class="directory-list">
            {#each visiblePeople as user (user.id)}
              <button class="person-row" type="button" onclick={() => (selectedPersonId = user.id)} aria-label={`Manage ${user.name || user.email}`}>
                <span class="person-avatar" aria-hidden="true">{(user.name || user.email).split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</span>
                <span class="person-identity"><strong>{user.name || user.email}</strong><small>{user.email}</small><small>{organisationName(user.organisationId)}</small></span>
                <span class="person-role"><strong>{user.roles.map((role) => role.replaceAll('_', ' ').toLowerCase()).join(' · ') || 'No system permissions'}</strong><small>{user.canTransport ? 'Transport authorised' : 'No transport authorisation'}</small></span>
                <span class="person-teams">{teamNames(user).slice(0, 2).join(' · ') || 'No dispatch teams'}{teamNames(user).length > 2 ? ` +${teamNames(user).length - 2}` : ''}</span>
                <span class="person-status">
                  <span class:available={user.enabled && user.availabilityStatus === 'AVAILABLE'} class="availability-state">
                    {user.status === 'INVITED' ? 'Invited' : !user.enabled ? 'Disabled' : user.availabilityStatus === 'AVAILABLE' ? 'Available' : user.availabilityStatus === 'BUSY' ? 'Busy' : 'Offline'}
                  </span>
                  {#if user.status === 'INVITED' && !user.roles.includes('PUBLIC_REPORTER')}
                    <small class="invitation-delivery">{invitationEmailLabel(user.invitationEmailStatus)}</small>
                  {/if}
                </span>
                <span class="person-chevron" aria-hidden="true">›</span>
              </button>
            {:else}
              <div class="empty-state"><strong>No matching people</strong><span>Try a different search or filter.</span></div>
            {/each}
          </div>

          </div>
        {:else if peopleView === 'positions'}
          <section class="panel page-panel management-panel" aria-label="Organisation positions">
            <div class="management-heading">
              <h3>Manage positions</h3>
              <p>Titles such as President, Secretary and Raptor Leader appear in member profiles and Chats. They never grant application permissions.</p>
            </div>
            <div class="management-form">
            <h3>Organisation positions</h3>
            <p class="permission-help">Add committee and management positions such as President, Secretary, Raptor Leader or Transport Coordinator. These are shown beside members in Chats; they do not change permissions.</p>
            <form method="POST" use:enhance={handleAdminSubmit} action="?/addOrganisationPosition" class="position-create">
              <label><span>Organisation</span>
                <select name="organisationId" bind:value={positionOrganisationId} required>
                  {#each data.organisations as organisation}
                    <option value={organisation.id}>{organisation.displayName}</option>
                  {/each}
                </select>
              </label>
              <label><span>New position</span>
                <input name="positionName" maxlength="80" required placeholder="e.g. Raptor Leader" />
              </label>
              <button class="primary-action" type="submit">Add position</button>
            </form>
            {#each data.organisations.filter(org => org.id === positionOrganisationId || (!positionOrganisationId && org.id === data.currentUser.organisationId)) as organisation}
              <div class="position-list">
                {#each (data.membershipConfigs[organisation.id]?.positions ?? []).filter(position => position.active) as position (position.id)}
                  <form method="POST" use:enhance={handleAdminSubmit} action="?/deactivateOrganisationPosition" class="position-row">
                    <input type="hidden" name="organisationId" value={organisation.id} />
                    <input type="hidden" name="positionId" value={position.id} />
                    <span>{position.name}</span>
                    <button type="submit" aria-label={`Disable ${position.name}`}>Disable</button>
                  </form>
                {:else}
                  <p class="permission-help">No organisation positions added yet.</p>
                {/each}
              </div>
            {/each}
            </div>
          </section>
        {:else if peopleView === 'clinics'}
          <section class="panel page-panel management-panel" aria-label="Approved veterinary clinics">
            <div class="management-heading">
              <h3>Approved clinics</h3>
              <p>Register a clinic with its verified pickup address and coordinates before inviting veterinary staff. An animal becomes visible to the clinic only after a recorded handover.</p>
            </div>
            <div class="management-form">
              <h3>Approved veterinary clinics</h3>
              <p class="permission-help">Add a clinic and its exact pickup coordinates before inviting staff. Only animals explicitly handed over to that clinic are visible to its staff.</p>
              <form method="POST" use:enhance={handleAdminSubmit} action="?/createVetClinic" class="position-create">
                <label><span>Rescue organisation</span>
                  <select name="organisationId" required>
                    {#each data.organisations as organisation}
                      <option value={organisation.id} selected={organisation.id === (data.currentUser.organisationId ?? data.organisations[0]?.id)}>{organisation.displayName}</option>
                    {/each}
                  </select>
                </label>
                <label><span>Clinic name</span><input name="name" required maxlength="120" placeholder="e.g. Animal Referral & Emergency Centre" /></label>
                <label><span>Full pickup address</span><input name="address" required maxlength="250" placeholder="Street, suburb, NSW, Australia" /></label>
                <label><span>Latitude</span><input name="latitude" type="number" step="any" min="-90" max="90" required placeholder="-32.93" /></label>
                <label><span>Longitude</span><input name="longitude" type="number" step="any" min="-180" max="180" required placeholder="151.76" /></label>
                <button class="primary-action" type="submit">Add clinic</button>
              </form>
              <div class="clinic-directory">
                <h4>Registered clinics</h4>
                {#each data.organisations as organisation}
                  {#if data.vetClinicDirectory[organisation.id]?.length}
                    <div class="clinic-organisation">
                      <h5>{organisation.displayName}</h5>
                      <div class="clinic-list">
                        {#each data.vetClinicDirectory[organisation.id] as clinic (clinic.id)}
                          <article class="clinic-entry">
                            <strong>{clinic.name}</strong>
                            <span>{clinic.address}</span>
                          </article>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/each}
                {#if !data.organisations.some(org => (data.vetClinicDirectory[org.id]?.length ?? 0) > 0)}
                  <p class="permission-help">No approved veterinary clinics registered yet.</p>
                {/if}
              </div>
            </div>
          </section>
        {/if}
      </section>

      {#if showInvite}
        <div class="people-overlay" use:portal role="presentation">
          <button type="button" class="people-backdrop" aria-label="Close invitation" onclick={() => (showInvite = false)}></button>
          <div class="people-dialog invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-title">
            <div class="dialog-heading"><div><p class="eyebrow">New team member</p><h2 id="invite-title">Invite a person</h2></div><button class="dialog-close" type="button" aria-label="Close invitation" onclick={() => (showInvite = false)}>×</button></div>
              <form method="POST" use:enhance={handleAdminSubmit} action="?/inviteUser" class="person-form invite-form">
              <div class="invite-scroll-content">
              {#if canChooseOrganisation}
                <div class="reviewer-note"><strong>Reviewer permissions</strong><p>Invitations grant operational access according to the selected role. Do not invite read-only reviewers until a restricted reviewer role is available.</p></div>
              {/if}
              <div class="form-pair"><label><span>Name</span><input name="name" required placeholder="Jane Smith" /></label><label><span>Email</span><input name="email" type="email" required placeholder="jane@example.org" /></label></div>
              <label><span>Organisation</span><select name="organisationId" bind:value={inviteOrganisationId} disabled={!canChooseOrganisation} required>{#each data.organisations as organisation}<option value={organisation.id}>{organisation.displayName}</option>{/each}</select>{#if !canChooseOrganisation}<input type="hidden" name="organisationId" value={inviteOrganisationId} />{/if}</label>
              <fieldset class="access-group">
                <legend>System permissions — select all that apply</legend>
                <p class="permission-help">All unchecked by default. These control access to Rescue Hub features, not committee titles or animal training.</p>
                <div class="capability-grid">{#each roleOptions.filter(option => data.assignableRoles.includes(option.id)) as role}<label class="capability-option"><input type="checkbox" name="roles" value={role.id} /><span><strong>{role.label}</strong></span></label>{/each}</div>
              </fieldset>
              <div class="access-group">
                <label><span>Veterinary clinic — veterinary staff only</span>
                  <select name="vetClinicId">
                    <option value="">No clinic assigned</option>
                    {#each (data.vetClinicDirectory[inviteOrganisationId] ?? []) as clinic}
                      <option value={clinic.id}>{clinic.name} — {clinic.address}</option>
                    {/each}
                  </select>
                </label>
                <p class="permission-help">Vet accounts must have Veterinary staff as their only system permission and cannot be assigned wildlife rescue training, transport or committee positions. Staff access only animals physically handed over to the selected clinic.</p>
              </div>
              <fieldset class="capability-picker"><legend>Trained species and specialist teams <small>All unchecked. Assign verified training; field rescue additionally requires Rescuer permission.</small></legend><div class="capability-grid">{#each inviteMembershipConfig.teams.filter(team => team.active && team.id !== 'transport' && !team.receivesAllRescues) as team}<label class="capability-option"><input type="checkbox" name="teamIds" value={team.id} /><span><strong>{team.name}</strong><small>{team.description}</small></span></label>{/each}</div></fieldset>
              <fieldset class="access-group">
                <legend>Transport authorisation</legend>
                <label class="capability-option"><input type="checkbox" name="canTransport" value="on" /><span><strong>Can transport animals</strong><small>Unchecked by default. Enable for a transport-only volunteer or a trained rescuer/carer who can transport. Not required for carer or management roles.</small></span></label>
              </fieldset>
              <fieldset class="capability-picker">
                <legend>Committee and management positions <small>Independent of training and system permissions. Select any positions this person holds.</small></legend>
                <div class="capability-grid">{#each (inviteMembershipConfig.positions ?? []).filter(position => position.active) as position}<label class="capability-option"><input type="checkbox" name="positionIds" value={position.id} /><span><strong>{position.name}</strong></span></label>{:else}<p class="permission-help">No positions defined yet. Add President, Secretary, Raptor Leader and others in People → Organisation positions.</p>{/each}</div>
              </fieldset>
              </div>
              <div class="dialog-actions"><button type="button" onclick={() => (showInvite = false)}>Cancel</button><button class="primary-action" type="submit">Send invitation</button></div>
            </form>
          </div>
        </div>
      {/if}

      {#if selectedPerson}
        <div class="people-overlay" use:portal role="presentation">
          <button type="button" class="people-backdrop" aria-label="Close person details" onclick={() => (selectedPersonId = null)}></button>
          <div class="people-dialog person-detail" role="dialog" aria-modal="true" aria-labelledby="person-detail-title">
            <div class="dialog-heading"><div><p class="eyebrow">Person details</p><h2 id="person-detail-title">{selectedPerson.name || selectedPerson.email}</h2><p class="intro">{selectedPerson.email} · {organisationName(selectedPerson.organisationId)}</p></div><button class="dialog-close" type="button" aria-label="Close person details" onclick={() => (selectedPersonId = null)}>×</button></div>
            <div class="person-detail-summary"><span class:available={selectedPerson.enabled && selectedPerson.availabilityStatus === 'AVAILABLE'} class="availability-state">{selectedPerson.enabled ? selectedPerson.availabilityStatus ?? 'Offline' : 'Disabled'}</span><span>{selectedPerson.roles.join(' · ')}</span><span>{selectedPerson.status}</span></div>
            {#if selectedPerson.status === 'INVITED' && selectedPerson.enabled && !selectedPerson.roles.includes('PUBLIC_REPORTER')}
              <section class="invitation-detail" aria-labelledby="pending-invite-heading">
                <h3 id="pending-invite-heading">Invitation awaiting acceptance</h3>
                <dl class="invitation-metadata">
                  <div><dt>Email service status</dt><dd><strong>{invitationEmailLabel(selectedPerson.invitationEmailStatus)}</strong></dd></div>
                  <div><dt>Last attempt</dt><dd>{selectedPerson.invitationEmailUpdatedAt ? formatDate(selectedPerson.invitationEmailUpdatedAt) : 'No send result recorded'}</dd></div>
                  <div><dt>Invitation link</dt><dd>{selectedPerson.invitationIssuedAt
                    ? invitationExpired(selectedPerson.invitationIssuedAt) ? 'Expired — resend needed' : 'Valid for up to seven days'
                    : 'Status unavailable for older invitations'}</dd></div>
                  {#if selectedPerson.invitationEmailDetail}
                    <div><dt>Delivery details</dt><dd>{selectedPerson.invitationEmailDetail}</dd></div>
                  {/if}
                </dl>
                <p class="permission-help">Accepted by SES means the email service accepted the send. Delivered means a receiving mail server accepted it—not that the person read it. Older invitations may show unknown until resent.</p>
                <form method="POST" use:enhance={handleAdminSubmit} action="?/resendInvitation" class="invitation-resend">
                  <input type="hidden" name="userId" value={selectedPerson.id} />
                  <button type="submit">Resend invitation email</button>
                </form>
                <form method="POST" use:enhance={handleAdminSubmit} action="?/correctInvitationEmail" class="person-form invitation-correction">
                  <input type="hidden" name="userId" value={selectedPerson.id} />
                  <label><span>Correct the email address</span>
                    <input name="email" type="email" value={selectedPerson.email} required autocomplete="off" />
                  </label>
                  <p class="permission-help">Saves the corrected address, invalidates the old invitation link and sends a new one. Existing role and species qualifications stay unchanged.</p>
                  <button class="primary-action" type="submit">Save email and send new invitation</button>
                </form>
              </section>
            {/if}
            <form method="POST" use:enhance={handleAdminSubmit} action="?/assignMemberPositions" class="person-form">
              <input type="hidden" name="userId" value={selectedPerson.id} />
              <div class="access-group">
                <strong>Organisation management and committee positions</strong>
                <p class="permission-help">Select the positions this person holds. These appear in Chats and do not grant system access.</p>
                <div class="capability-grid">
                  {#each (membershipConfigFor(selectedPerson).positions ?? []).filter(position => position.active) as position}
                    <label class="capability-option">
                      <input type="checkbox" name="positionIds" value={position.id}
                        checked={(selectedPerson.positionIds ?? []).includes(position.id)} />
                      <span><strong>{position.name}</strong></span>
                    </label>
                  {:else}
                    <p class="permission-help">No management positions defined yet. Create them in People & access → Organisation Positions.</p>
                  {/each}
                </div>
                <div class="dialog-actions">
                  <button class="primary-action" type="submit">Save management positions</button>
                </div>
              </div>
            </form>
            <form method="POST" use:enhance={handleAdminSubmit} action="?/updateMemberPosition" class="person-form">
              <input type="hidden" name="userId" value={selectedPerson.id} />
              <div class="access-group">
                <label><span>Organisation position / function — shown in Chats</span>
                  <input name="positionTitle" maxlength="100" value={selectedPerson.positionTitle ?? ''}
                    placeholder="e.g. Director, Raptor Manager, Transport Coordinator" />
                </label>
                <p class="permission-help">A descriptive title displayed alongside permissions and trained areas. This does not change permissions.</p>
              </div>
              <div class="dialog-actions"><button class="primary-action" type="submit">Save position</button></div>
            </form>
            <form method="POST" use:enhance={handleAdminSubmit} action="?/updateMemberAccess" class="person-form">
              <input type="hidden" name="userId" value={selectedPerson.id} />
              <fieldset class="access-group" disabled={selectedPerson.id === data.currentUser.id && !data.currentUser.roles.includes('PLATFORM_ADMIN')}>
                <legend>System permissions — select all that apply</legend>
                <p class="permission-help">Grant only necessary privileges. Changing permissions signs this member out of existing sessions. Management positions do not grant permissions.</p>
                {#if selectedPerson.id === data.currentUser.id && data.currentUser.roles.includes('PLATFORM_ADMIN')}
                  <p class="permission-help">You can select your own additional system permissions. Platform Administrator remains mandatory. Public reporter and veterinary clinic staff require dedicated accounts.</p>
                {/if}
                <div class="capability-grid">{#each roleOptions.filter(option => data.assignableRoles.includes(option.id) &&
                  !(selectedPerson.id === data.currentUser.id && ['VET_STAFF'].includes(option.id))) as role}<label class="capability-option"><input type="checkbox" name="roles" value={role.id} checked={selectedPerson.roles.includes(role.id)}
                    disabled={selectedPerson.id === data.currentUser.id && role.id === 'PLATFORM_ADMIN'} />
                  {#if selectedPerson.id === data.currentUser.id && role.id === 'PLATFORM_ADMIN'}<input type="hidden" name="roles" value="PLATFORM_ADMIN" />{/if}
                  <span><strong>{role.label}</strong></span></label>{/each}</div>
              </fieldset>
              <div class="access-group">
                <label><span>Assigned veterinary clinic (veterinary staff only)</span>
                  <select name="vetClinicId" disabled={selectedPerson.id === data.currentUser.id}>
                    <option value="">No clinic assigned</option>
                    {#each (data.vetClinicDirectory[selectedPerson.organisationId ?? ''] ?? []) as clinic}
                      <option value={clinic.id} selected={selectedPerson.vetClinicId === clinic.id}>{clinic.name} — {clinic.address}</option>
                    {/each}
                  </select>
                </label>
              </div>
              <fieldset class="capability-picker" disabled={selectedPerson.id === data.currentUser.id && !data.currentUser.roles.includes('PLATFORM_ADMIN')}><legend>Trained species and specialist teams <small>Check only verified training and qualifications. Unchecked areas are not assigned.</small></legend><div class="capability-grid">{#each membershipConfigFor(selectedPerson).teams.filter(team => team.active && team.id !== 'transport' && !team.receivesAllRescues) as team}<label class="capability-option"><input type="checkbox" name="teamIds" value={team.id} checked={(selectedPerson.teamIds ?? []).includes(team.id)} /><span><strong>{team.name}</strong><small>{team.description}</small></span></label>{/each}</div></fieldset>
              <fieldset class="access-group" disabled={selectedPerson.id === data.currentUser.id && !data.currentUser.roles.includes('PLATFORM_ADMIN')}>
                <legend>Transport authorisation</legend>
                <label class="capability-option"><input type="checkbox" name="canTransport" value="on" checked={selectedPerson.canTransport === true} /><span><strong>Can transport animals</strong><small>Independent of being a carer, rescuer or specialist. Untick if they cannot transport.</small></span></label>
              </fieldset>
              <div class="dialog-actions"><button class="primary-action" type="submit" disabled={selectedPerson.id === data.currentUser.id && !data.currentUser.roles.includes('PLATFORM_ADMIN')}>{selectedPerson.id === data.currentUser.id ? 'Save my roles, training & transport' : 'Save permissions & qualifications'}</button></div>
            </form>
            <div class="account-management"><h3>Account access</h3><p>These actions affect sign-in access, not dispatch availability.</p><div class="account-actions"><form method="POST" use:enhance={handleAdminSubmit} action={selectedPerson.enabled ? '?/disableUser' : '?/enableUser'}><input type="hidden" name="userId" value={selectedPerson.id} /><button type="submit">{selectedPerson.enabled ? 'Disable access' : 'Enable access'}</button></form><form method="POST" use:enhance={handleAdminSubmit} action="?/resetPassword"><input type="hidden" name="userId" value={selectedPerson.id} /><button type="submit">Reset password</button></form><form method="POST" use:enhance={handleAdminSubmit} action="?/removeUser" onsubmit={(event) => { if (!confirm('Remove this person from Rescue Hub? This cannot be undone.')) event.preventDefault(); }}><input type="hidden" name="userId" value={selectedPerson.id} /><button class="danger" type="submit">Remove person</button></form></div></div>
          </div>
        </div>
      {/if}
    {:else}
      <section class="panel page-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Governance</p>
            <h2>Audit history</h2>
            <p class="intro">Presentation events show how operational changes become a regulator-visible timeline.</p>
          </div>
        </div>
        <div class="audit-list">
          {#each data.auditEvents as event}
            <article>
              <div>
                <strong>{event.action.replaceAll('_', ' ')}</strong>
                <span>{event.summary}</span>
              </div>
              <time>{formatDate(event.createdAt)}</time>
            </article>
          {:else}
            <div class="empty-state large">
              <strong>No audit events yet</strong>
              <span>Operational changes will appear here as immutable audit history.</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </main>
</div>

<style>
  /* Controls must never rely on browser-default ButtonText/ButtonFace.
     Both themes supply explicit, high-contrast surface and foreground tokens.
     :where() keeps this a low-specificity fallback: primary actions, active
     filters, destructive actions and transparent navigation keep their own styles. */
  :where(.admin-shell) button {
    color: var(--rh-text);
    background: var(--rh-surface-soft);
  }

  .save-progress{position:fixed;z-index:90;top:84px;right:var(--rh-gutter);
    background:var(--rh-surface);color:var(--rh-text);border:1px solid var(--rh-border);
    box-shadow:var(--rh-shadow);padding:12px 18px;border-radius:9px;font-size:13px;font-weight:750}
  .adam-invite { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border:1px solid var(--rh-t72, #a7c6b1); background:var(--rh-t73, #f2f8f3); border-radius: 12px; }
  
  @media (max-width: 700px) { .adam-invite { flex-direction: column; align-items: stretch; } }

  .reviewer-note { padding: 13px 16px; border:1px solid var(--rh-t74, #dfc995); border-radius: 9px; background:var(--rh-t75, #fff8e7); font-size: 12px; }
  .reviewer-note p { margin: 5px 0 0; line-height: 1.5; }

  .people-workspace { display: grid; gap: 22px; }
  .people-workspace > .panel { width:100%; min-width:0; }
  .management-panel { display:grid; gap:24px; align-content:start; max-width:100%; }
  .management-heading { display:grid; gap:7px; padding-bottom:18px; border-bottom:1px solid var(--rh-border); }
  .management-heading h3 { margin:0; font-size:20px; }
  .management-heading p { margin:0; color:var(--rh-muted); font-size:13px; line-height:1.65; max-width:760px; }
  .management-form { display:grid; gap:18px; max-width:850px; min-width:0; }
  .management-form > h3 { display:none; }
  .clinic-directory { display:grid; gap:15px; padding-top:14px; border-top:1px solid var(--rh-border); }
  .clinic-directory h4 { margin:0; font-size:15px; }
  .clinic-organisation { display:grid; gap:9px; }
  .clinic-organisation h5 { margin:0; font-size:12px; font-weight:750; color:var(--rh-muted); }
  .clinic-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr)); gap:10px; }
  .clinic-entry { display:grid; align-content:start; gap:6px; padding:13px 15px; border:1px solid var(--rh-border); border-radius:10px; background:var(--rh-surface-soft); }
  .clinic-entry strong { font-size:13px; color:var(--rh-text); }
  .clinic-entry span { font-size:12px; color:var(--rh-muted); line-height:1.5; overflow-wrap:anywhere; }
  .management-form > .permission-help { max-width:720px; }
  .management-form .position-create { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; align-items:end; }
  .management-form .position-create label { min-width:0; width:100%; }
  .management-form .position-create button { justify-self:start; }
  .management-form .position-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr)); gap:10px; }
  .management-form .position-row { justify-content:space-between; min-width:0; }
  .management-form .position-row span { overflow-wrap:anywhere; }
  .management-form > form[action*="createVetClinic"] label:nth-of-type(3) { grid-column:1 / -1; }
  @media(max-width:700px) {
    .management-form .position-create { grid-template-columns:1fr; }
    .management-form .position-create button { width:100%; }
  }
  .people-subnav { display:grid; gap:4px; margin:0 0 5px 14px; padding:5px 0 5px 12px; border-left:2px solid var(--rh-border); }
  nav .people-subnav button { min-height:38px; padding:8px 11px; font-size:12px; border-radius:9px; white-space:normal; }
  nav .people-subnav button.active { background:var(--rh-nav-active); color:var(--rh-text); font-weight:800; }
  .people-caret { margin-left:auto; font-size:14px; }

  .position-create { display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px }
  .position-create label { display:grid;gap:5px;flex:1 1 170px }
  .position-create input,.position-create select { min-height:42px;border:1px solid var(--rh-border);border-radius:9px;background:var(--rh-field);color:var(--rh-text);padding:9px 12px;font:inherit }
  .position-create button { min-height:42px }
  .position-list { display:flex;gap:8px;flex-wrap:wrap }
  .position-row { display:flex;gap:9px;align-items:center;background:var(--rh-surface-soft);border:1px solid var(--rh-border);border-radius:9px;padding:8px 12px }
  .position-row button { border:0;background:transparent;color:var(--rh-danger-text);cursor:pointer;font:inherit;text-decoration:underline }
  .invitation-delivery { display:block; margin-top:5px; font-size:11px; line-height:1.35; color:var(--rh-muted); overflow-wrap:anywhere; }
  .invitation-detail { display:grid; gap:12px; border:1px solid var(--rh-border); border-radius:12px; padding:16px; background:var(--rh-surface-soft); color:var(--rh-text); }
  .invitation-detail h3 { margin:0; font-size:17px; }
  .invitation-metadata { display:grid; gap:8px; margin:0; }
  .invitation-metadata div { display:grid; grid-template-columns:minmax(110px,35%) minmax(0,1fr); gap:10px; }
  .invitation-metadata dt { color:var(--rh-muted); font-size:12px; }
  .invitation-metadata dd { margin:0; font-size:13px; overflow-wrap:anywhere; }
  .invitation-resend button, .invitation-correction button { min-height:42px; }
  .invitation-correction input { width:100%; min-height:42px; }
  @media(max-width:600px) { .invitation-metadata div { grid-template-columns:1fr; gap:2px; } }
  .people-head, .directory-toolbar, .dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
  .people-head h2, .dialog-heading h2 { margin: 5px 0 8px; font-size: 27px; }
  .people-head .intro { max-width: 660px; }
  .people-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
  .people-stats > div { background:var(--rh-t6, white); border:1px solid var(--line); border-radius: 13px; padding: 18px; display: grid; gap: 8px; }
  .people-stats span { color:var(--muted); font-size: 12px; }
  .people-stats strong { font-size: 29px; line-height: 1; }
  .people-directory { overflow: hidden; padding: 0; }
  .directory-toolbar { padding: 22px 22px 12px; }
  .directory-toolbar h3 { margin: 0; font-size: 18px; }
  .directory-toolbar p { margin: 5px 0 0; font-size: 12px; color:var(--muted); }
  .people-search { min-width: min(100%, 330px); }
  .people-search input { width: 100%; padding: 11px 13px; border:1px solid var(--line); border-radius: 9px; background:var(--rh-t6, white); }
  .people-filters { display: flex; gap: 8px; padding: 4px 22px 18px; flex-wrap: wrap; }
  .people-filters button { border:1px solid var(--line); border-radius: 999px; background:var(--rh-t6, white); padding: 8px 14px; font: inherit; font-size: 12px; cursor: pointer; }
  .people-filters button.chosen { background:var(--forest); color:white; border-color:var(--forest); }
  .person-row { display: grid; grid-template-columns: 42px minmax(170px, 1.4fr) minmax(130px, 1fr) minmax(130px, 1fr) 90px 16px; gap: 15px; align-items: center; width: 100%; text-align: left; padding: 16px 22px; border:0; border-top:1px solid var(--line); background:var(--rh-t6, white); color:var(--ink); cursor: pointer; font: inherit; }
  .person-row:hover, .person-row:focus-visible { background:var(--surface-soft); }
  .person-avatar { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background:var(--rh-t76, #e5eee7); color:var(--forest); font-size: 13px; font-weight: 750; }
  .person-identity, .person-role { display: grid; gap: 3px; min-width: 0; }
  .person-identity strong, .person-role strong { font-size: 13px; overflow-wrap: anywhere; }
  .person-identity small, .person-role small, .person-teams { color:var(--muted); font-size: 11px; overflow-wrap: anywhere; }
  .person-chevron { font-size: 25px; color:var(--muted); }
  .people-overlay { position:fixed; inset:0; z-index:100; background:rgba(10,27,18,.56); display:flex; align-items:center; justify-content:center; min-height:0; overflow:hidden; padding:16px; }
  .people-backdrop { position:absolute; inset:0; width:100%; height:100%; z-index:0; padding:0; margin:0; border:0; background:transparent; cursor:default; }
  /* Portalled overlays are moved to document.body. They MUST carry the
     aliases normally inherited from .admin-shell or --forest resolves to
     nothing and a white-on-white primary action disappears in light mode. */
  .people-dialog {
    --ink: var(--rh-text);
    --muted: var(--rh-muted);
    --line: var(--rh-border);
    --surface: var(--rh-surface);
    --surface-soft: var(--rh-surface-soft);
    --forest: var(--rh-primary);
    --forest-2: var(--rh-accent);
    --lime: var(--rh-accent-soft);
    --danger: var(--rh-danger-text);
    position: relative;
    z-index: 1;
    width: min(100%, 740px);
    height: auto;
    max-height: calc(100dvh - 32px);
    min-height: 0;
    overflow-y: auto;
    padding: 28px;
    background: var(--rh-surface);
    border: 1px solid var(--rh-border);
    color: var(--rh-text);
    box-shadow: 0 22px 70px rgba(0,0,0,.28);
    border-radius: 16px;
  }
  .invite-dialog { display:flex; flex-direction:column; height:min(88dvh,760px); max-height:calc(100dvh - 32px); min-height:0; overflow:hidden; padding-bottom:max(18px,env(safe-area-inset-bottom)); }
  .invite-dialog .dialog-heading { flex: 0 0 auto; }
  .invite-form { display:flex; flex:1 1 auto; min-height:0; overflow:hidden; gap:0; }
  .invite-scroll-content { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x:hidden; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; display:grid; align-content:start; gap:18px; padding:2px 4px 18px 0; }
  .invite-form > .dialog-actions { flex:0 0 auto; margin-top:0; padding:14px 0 0; background:var(--rh-surface); }

  .dialog-heading { align-items: flex-start; border-bottom:1px solid var(--line); padding-bottom: 18px; margin-bottom: 20px; }
  .dialog-close { border:1px solid var(--line); background:var(--rh-t6, white); border-radius: 9px; width: 36px; height: 36px; font-size: 25px; cursor: pointer; }
  .person-form { display: grid; gap: 18px; }
  .access-group { display: grid; gap: 6px; padding: 15px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
  .permission-help { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
  .person-form label:not(.capability-option) { display: grid; gap: 7px; font-size: 12px; font-weight: 700; }
  .person-form input:not([type='checkbox']), .person-form select { width: 100%; padding: 11px; border:1px solid var(--line); border-radius: 8px; background:var(--rh-t6, white); font: inherit; }
  .form-pair { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
  .capability-picker { border:0; padding: 0; margin: 0; min-width: 0; }
  .capability-picker legend { font-weight: 750; font-size: 14px; margin-bottom: 12px; }
  .capability-picker legend small { display: block; font-weight: 400; color:var(--muted); margin-top: 4px; }
  .capability-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 9px; }
  .capability-option { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border:1px solid var(--line); border-radius: 10px; cursor: pointer; }
  .capability-option:has(input:checked) { background:var(--rh-t77, #f0f7e7); border-color:var(--rh-t78, #91b58c); }
  .capability-option input { margin: 3px 0 0; flex-shrink: 0; accent-color: var(--forest); }
  .capability-option span { display: grid; gap: 4px; }
  .capability-option strong { font-size: 12px; }
  .capability-option small { font-size: 11px; font-weight: 400; color:var(--muted); line-height: 1.4; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; border-top:1px solid var(--line); }
  .dialog-actions button, .account-actions button { padding: 10px 15px; border-radius: 8px; border:1px solid var(--line); cursor: pointer; font: inherit; }

  /* Explicit colours are required even though the dialog is not a child
     of .admin-shell after portal() appends it directly to document.body. */
  .people-dialog button:not(.primary-action) {
    background: var(--rh-surface-soft);
    color: var(--rh-text);
    border-color: var(--rh-border-strong);
  }
  .people-dialog .primary-action {
    background: var(--rh-primary);
    color: var(--rh-on-primary);
    border: 1px solid var(--rh-primary);
  }
  .people-dialog .primary-action:hover {
    background: var(--rh-primary-hover);
    border-color: var(--rh-primary-hover);
  }
  .people-dialog .account-actions .danger {
    color: var(--rh-danger-text);
    border-color: var(--rh-border-strong);
  }
  .person-detail-summary { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 22px; color:var(--muted); font-size: 12px; }
  .account-management { margin-top: 28px; padding-top: 20px; border-top:1px solid var(--line); }
  .account-management h3 { margin: 0 0 7px; }
  .account-management p { color:var(--muted); font-size: 12px; }
  .account-actions { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 16px; }
  .account-actions .danger { color:var(--rh-t79, #a32929); border-color:var(--rh-t80, #e6b6b6); }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border:0; }
  @media (max-width: 1100px) { .person-row { grid-template-columns: 42px minmax(150px,1.5fr) minmax(110px,1fr) 90px 16px; } .person-teams { display: none; } }
  @media (max-width: 700px) { .people-overlay { padding:8px; } .people-dialog { max-height:calc(100dvh - 16px); padding:18px; } .invite-dialog { height:calc(100dvh - 16px); } .people-head, .directory-toolbar { align-items: stretch; flex-direction: column; } .people-stats { grid-template-columns: repeat(2,minmax(0,1fr)); } .person-row { grid-template-columns: 38px minmax(0,1fr) 18px; gap: 10px; padding: 13px; } .person-role, .person-status { display: none; } .people-dialog { padding: 18px; } .form-pair, .capability-grid { grid-template-columns: 1fr; } }

  .admin-shell {
    --ink: var(--rh-text);
    --muted: var(--rh-muted);
    --line: var(--rh-border);
    --surface: var(--rh-surface);
    --surface-soft: var(--rh-surface-soft);
    --forest: var(--rh-primary);
    --forest-2: var(--rh-accent);
    --lime: var(--rh-accent-soft);
    --danger: var(--rh-danger-text);
    --amber: #b58a4d;
    min-height: 100dvh;
    padding: var(--rh-content-top) var(--rh-gutter) var(--rh-gutter);
    background: var(--rh-background);
    color: var(--rh-text);
    display: grid;
    grid-template-columns: 244px minmax(0, 1fr);
    gap: var(--rh-gutter);
  }

  .sidebar {
    height: calc(100dvh - var(--rh-content-top) - var(--rh-gutter));
    min-height: 0;
    position: sticky;
    top: var(--rh-content-top);
    align-self: start;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 19px 14px;
    border: 1px solid var(--rh-border);
    border-radius: 16px;
    background: var(--rh-surface);
    color: var(--rh-text);
    box-shadow: var(--rh-shadow);
  }

  .sidebar-footer strong,
  .sidebar-footer span { display: block; }

  nav {
    display: grid;
    gap: 5px;
  }

  nav button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 12px;
    border:0;
    border-radius: 10px;
    background:transparent;
    color:var(--rh-muted);
    cursor: pointer;
    text-align: left;
  }

  nav button:hover,
  nav button.active {
    background:var(--rh-nav-active);
    color:var(--rh-text);
  }

  .nav-icon {
    display: grid;
    place-items: center;
    width: 29px;
    height: 29px;
    border-radius: 8px;
    background:var(--rh-surface-soft);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  nav button.active .nav-icon {
    background:var(--rh-accent-soft);
    color:var(--rh-text);
  }

  .sidebar-footer {
    margin-top: auto;
    padding: 18px 8px 2px;
    border-top:1px solid var(--rh-border);
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .sidebar-footer strong {
    font-size: 14px;
  }

  .sidebar-footer span {
    margin-top: 2px;
    color:var(--rh-t83, #91aa9a);
    font-size: 13px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background:#ca7a60;
    box-shadow: 0 0 0 4px rgba(202, 122, 96, 0.11);
  }

  .status-dot.online {
    background:var(--rh-t84, #81db8d);
    box-shadow: 0 0 0 4px rgba(129, 219, 141, 0.11);
  }

  main {
    min-width: 0;
    padding: 0 0 32px;
  }

  .eyebrow {
    margin: 0 0 5px;
    color:var(--rh-t85, #648074);
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.13em;
  }

  .backend-warning {
    margin-top: 0;
    display: grid;
    gap: 5px;
    padding: 14px 16px;
    border:1px solid var(--rh-t87, #e4c986);
    border-radius: 12px;
    background:var(--rh-t88, #fff8e6);
    color:var(--rh-t89, #674f16);
    font-size: 15px;
  }

  .backend-warning span {
    color:var(--rh-t90, #806928);
  }

  .backend-warning details {
    margin-top: 5px;
  }

  .backend-warning details code {
    display: block;
    margin-top: 6px;
    white-space: normal;
    font-size: 13px;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 0;
  }

  .metrics article {
    padding: 18px;
    min-height: 128px;
    border:1px solid var(--line);
    border-radius: 14px;
    background:var(--rh-surface);
    box-shadow: 0 10px 30px rgba(29, 55, 42, 0.035);
  }

  .metric-label,
  .metrics small {
    display: block;
    color:var(--muted);
  }

  .metric-label {
    font-size: 14px;
    font-weight: 700;
  }

  .metrics strong {
    display: block;
    margin: 15px 0 7px;
    color:var(--forest);
    font-size: 30px;
    line-height: 1;
    letter-spacing: -0.05em;
  }

  .metrics small {
    font-size: 13px;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(260px, 0.7fr);
    gap: 14px;
    margin-top: 14px;
  }

  .panel {
    min-width: 0;
    padding: 21px;
    border:1px solid var(--line);
    border-radius: 16px;
    background:var(--rh-surface);
    box-shadow: 0 12px 32px rgba(29, 55, 42, 0.04);
  }

  .panel.wide {
    grid-row: span 2;
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 17px;
  }

  .panel h2 {
    font-size: 22px;
  }

  .text-button {
    padding: 0;
    border:0;
    background:none;
    color:var(--forest-2);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .organisation-list {
    display: grid;
  }

  .organisation-row {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto auto;
    gap: 12px;
    align-items: center;
    width: 100%;
    padding: 10px 0;
    border:0;
    border-top:1px solid var(--rh-t91, #e8eeea);
    background:transparent;
    text-align: left;
    cursor: pointer;
  }

  .organisation-row:first-child {
    border-top:0;
  }

  .organisation-row:hover .org-main strong {
    color:var(--forest-2);
  }

  .org-initials {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background:var(--surface-soft);
    color:var(--forest);
    font-size: 12px;
    font-weight: 900;
  }

  .org-main {
    min-width: 0;
  }

  .org-main strong,
  .org-main small {
    display: block;
  }

  .org-main strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
  }

  .org-main small {
    margin-top: 3px;
    overflow: hidden;
    color:var(--muted);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .boundary,
  .claim,
  .rescue-status {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 800;
  }

  .boundary {
    background:var(--rh-t92, #f1f3f2);
    color:var(--rh-t9, #66736c);
  }

  .boundary.gis {
    background:var(--rh-t93, #e7f5eb);
    color:var(--rh-t94, #29633e);
  }

  .claim {
    background:var(--rh-t95, #f5efe1);
    color:var(--rh-t96, #7c6329);
  }

  .rescue-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
  }

  .rescue-summary div {
    padding: 12px 8px;
    border-radius: 11px;
    background:var(--surface-soft);
    text-align: center;
  }

  .rescue-summary span,
  .rescue-summary strong {
    display: block;
  }

  .rescue-summary span {
    color:var(--muted);
    font-size: 12px;
  }

  .rescue-summary strong {
    margin-top: 5px;
    color:var(--forest);
    font-size: 21px;
  }

  .primary-action {
    width: 100%;
    margin-top: 14px;
    padding: 11px 14px;
    border:0;
    border-radius: 10px;
    background:var(--forest);
    color:white;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .primary-action:hover {
    background:var(--forest-2);
  }

  .coverage-figure {
    display: grid;
    grid-template-columns: 78px 1fr;
    gap: 16px;
    align-items: center;
  }

  .coverage-ring {
    --coverage: 0%;
    width: 76px;
    height: 76px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: conic-gradient(var(--forest-2) var(--coverage), #e8eeea 0);
    position: relative;
  }

  .coverage-ring::after {
    content: '';
    position: absolute;
    inset: 7px;
    border-radius: 50%;
    background:var(--rh-t6, white);
  }

  .coverage-ring strong {
    position: relative;
    z-index: 1;
    font-size: 19px;
  }

  .coverage-figure p {
    margin: 0;
    color:var(--muted);
    font-size: 14px;
    line-height: 1.55;
  }

  /* Align right-hand Administration content with the sidebar and the
     Documentation workspace; spacing belongs inside panels, not above them. */
  .page-panel,
  .feature-grid {
    margin-top: 0;
  }

  .table-heading {
    align-items: end;
  }

  .intro {
    max-width: 660px;
    margin: 7px 0 0;
    color:var(--muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .search {
    display: grid;
    gap: 5px;
    min-width: min(310px, 100%);
    color:var(--muted);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .search input {
    width: 100%;
    padding: 9px 11px;
    border:1px solid var(--rh-t97, #d4ddd7);
    border-radius: 9px;
    outline: none;
    background:var(--rh-t6, white);
    color:var(--ink);
    font-size: 14px;
    text-transform: none;
    letter-spacing: normal;
  }

  .search input:focus {
    border-color:#6e947e;
    box-shadow: 0 0 0 3px rgba(110, 148, 126, 0.12);
  }

  .rescue-view-map { padding:7px 9px; border:1px solid var(--rh-border); border-radius:8px; background:var(--rh-surface-soft); color:var(--rh-text); font:inherit; font-size:12px; font-weight:750; cursor:pointer; white-space:nowrap; }
  .rescue-view-map:hover { border-color:var(--rh-border-strong); background:var(--rh-raised); }
  .rescue-map-toolbar { display:flex; flex-wrap:wrap; align-items:end; gap:10px; margin-top:18px; }
  .rescue-map-toolbar label { display:grid; gap:5px; flex:0 1 230px; min-width:170px; color:var(--rh-muted); font-size:12px; font-weight:750; }
  .rescue-map-toolbar button { min-height:38px; padding:8px 12px; border:1px solid var(--rh-border); border-radius:9px; background:var(--rh-surface-soft); color:var(--rh-text); cursor:pointer; font:inherit; font-size:12px; font-weight:750; }
  .rescue-map-toolbar button:disabled { opacity:.45; cursor:not-allowed; }
  .rescue-map-toolbar input, .rescue-map-toolbar select, .rescue-register-toolbar input[type=date] { min-height:38px; padding:8px 10px; border:1px solid var(--rh-border); border-radius:9px; background:var(--rh-field); color:var(--rh-text); font:inherit; font-size:13px; }
  .rescue-map-date { margin:14px 0 0; color:var(--rh-muted); font-size:13px; }
  .rescue-day-error { margin:12px 0; color:var(--rh-danger-text); font-size:13px; }
  .rescue-map-placeholder { margin-top:18px; display:grid; place-items:center; min-height:300px; border:1px dashed var(--rh-border); border-radius:12px; color:var(--rh-muted); font-size:14px; }
  .rescue-register-toolbar { display:flex; align-items:end; flex-wrap:wrap; gap:10px; margin:18px 0 12px; }
  .rescue-register-toolbar > label { display:grid; gap:5px; min-width:135px; color:var(--rh-muted); font-size:12px; font-weight:700; }
  .rescue-register-toolbar > label.search { flex:2 1 240px; min-width:190px; }
  .rescue-register-toolbar select { min-height:38px; padding:8px; border:1px solid var(--rh-border); border-radius:9px; background:var(--rh-field); color:var(--rh-text); font:inherit; font-size:13px; }
  .rescue-register-count { color:var(--rh-muted); font-size:13px; }
  .rescue-register-pagination { display:flex; gap:14px; justify-content:center; align-items:center; padding:16px; font-size:13px; color:var(--rh-muted); }
  .rescue-register-pagination button { padding:8px 12px; border:1px solid var(--rh-border); border-radius:8px; background:var(--rh-surface-soft); color:var(--rh-text); cursor:pointer; }
  .rescue-register-pagination button:disabled { opacity:.45; cursor:not-allowed; }
  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th {
    padding: 9px 11px;
    border-bottom:1px solid var(--line);
    color:var(--rh-t11, #718078);
    font-size: 12px;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  td {
    max-width: 340px;
    padding: 12px 11px;
    border-bottom:1px solid var(--rh-t91, #e8eeea);
    vertical-align: top;
    color:var(--rh-t98, #4b5b52);
    line-height: 1.45;
  }

  td strong,
  td span {
    display: block;
  }

  td strong {
    color:var(--ink);
    font-size: 14px;
  }

  td span {
    margin-top: 2px;
    color:var(--muted);
    font-size: 12px;
  }

  td .boundary,
  td .claim {
    margin: 0;
  }

  .rescue-status {
    margin: 0;
    background:var(--rh-t99, #edf0ee);
  }

  .status-pending {
    background:var(--rh-t100, #fff1cd);
    color:var(--rh-t101, #7b5b0d);
  }

  .status-assigned {
    background:var(--rh-t102, #e8eefc);
    color:var(--rh-t103, #355a9a);
  }

  .status-completed {
    background:var(--rh-t104, #e2f3e8);
    color:var(--rh-t105, #27663e);
  }

  .feature-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(360px, 1.2fr);
    gap: 14px;
  }

  .feature-copy > p:not(.eyebrow) {
    color:var(--muted);
    font-size: 15px;
    line-height: 1.65;
  }

  .readiness {
    display: grid;
    gap: 8px;
    margin-top: 24px;
  }

  .readiness span {
    display: flex;
    justify-content: space-between;
    padding: 11px 0;
    border-top:1px solid var(--line);
    color:var(--muted);
    font-size: 14px;
  }

  .readiness strong {
    color:var(--forest);
  }

  .map-placeholder {
    min-height: 430px;
    display: grid;
    place-content: center;
    gap: 5px;
    border-radius: 16px;
    background:
      radial-gradient(circle at 30% 22%, rgba(201, 240, 74, 0.22), transparent 19%),
      linear-gradient(145deg, #214b37, #112f23);
    color:white;
    text-align: center;
  }

  

  

  

  .invite-user {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1.2fr 1fr 1fr;
    gap: 10px;
    align-items: end;
    padding: 15px;
    border:1px solid var(--line);
    border-radius: 12px;
    background:var(--surface-soft);
  }

  

  

  

  

  .invite-button {
    width: auto;
    margin: 0;
    min-height: 36px;
    align-self: end;
  }

  .invite-teams {
    grid-column: 1 / -1;
  }

  .team-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 12px;
    margin: 0;
    padding: 10px 12px;
    border:1px solid var(--line);
    border-radius: 9px;
  }

  

  

  

  .team-picker.compact {
    display: grid;
    max-width: 250px;
    margin: 8px 0;
  }

  

  .team-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  

  

  .availability-state {
    display: inline-flex;
    width: max-content;
    padding: 3px 7px;
    border-radius: 999px;
    background:var(--rh-t92, #f1f3f2);
    color:var(--rh-t106, #69766f);
    font-size: 12px;
    font-weight: 800;
  }

  .availability-state.available {
    background:var(--rh-t93, #e7f5eb);
    color:var(--rh-t94, #29633e);
  }

  .dispatch-editor {
    position: relative;
  }

  

  

  

  

  .people-feedback {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 9px;
    font-size: 12px;
  }

  .people-feedback.success {
    background:var(--rh-t93, #e7f5eb);
    color:var(--rh-t94, #29633e);
  }

  .people-feedback.error {
    background:var(--rh-t64, #fff0ed);
    color:var(--rh-t107, #9d3c34);
  }

  .people-table {
    margin-top: 18px;
  }

  .identity-status,
  .access-state {
    display: inline-flex;
    width: max-content;
    margin: 0;
    padding: 3px 7px;
    border-radius: 999px;
    background:var(--rh-t108, #f3efe4);
    color:var(--rh-t109, #755c20);
    font-size: 12px;
    font-weight: 800;
  }

  .access-state.enabled {
    background:var(--rh-t93, #e7f5eb);
    color:var(--rh-t94, #29633e);
  }

  .user-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  

  

  

  .broadcast-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 18px;
  }

  

  

  

  

  .audit-list {
    display: grid;
  }

  .audit-list article {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 12px 0;
    border-top:1px solid var(--line);
  }

  .audit-list article:first-child {
    border-top:0;
  }

  .audit-list strong,
  .audit-list span {
    display: block;
  }

  .audit-list strong {
    color:var(--ink);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .audit-list span {
    margin-top: 3px;
    color:var(--muted);
    font-size: 13px;
  }

  .audit-list time {
    flex: 0 0 auto;
    color:var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }

  .empty-state {
    display: grid;
    gap: 4px;
    padding: 28px 10px;
    color:var(--muted);
    text-align: center;
    font-size: 13px;
  }

  .empty-state strong {
    color:var(--ink);
    font-size: 15px;
  }

  .empty-state.large {
    min-height: 310px;
    place-content: center;
  }

  .empty-feature {
    min-height: 340px;
    display: grid;
    place-content: center;
    max-width: none;
    text-align: center;
  }

  

  @media (max-width: 1050px) {
    .metrics {
      grid-template-columns: repeat(2, 1fr);
    }

    .dashboard-grid,
    .feature-grid {
      grid-template-columns: 1fr;
    }

    .panel.wide {
      grid-row: auto;
    }
  }

  @media (max-width: 780px) {
    .admin-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      min-height: auto;
      position: static;
      padding: 14px;
    }

    .brand {
      padding-bottom: 12px;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    nav .people-subnav { flex:1 1 100%; display:flex; flex-wrap:wrap; margin:0; padding:6px 0; border-left:0; border-top:1px solid var(--rh-border); }
    nav .people-subnav button { flex:0 0 auto; width:auto; }

    nav button {
      width: auto;
      flex: 0 0 auto;
    }

    .sidebar-footer {
      display: none;
    }

    main {
      padding: 0 15px 28px;
    }



    .table-heading {
      display: grid;
    }

    .invite-user {
      grid-template-columns: 1fr 1fr;
    }

    .invite-button {
      width: 100%;
    }

    .search {
      min-width: 100%;
    }
  }

  @media (max-width: 520px) {
    .metrics {
      grid-template-columns: 1fr 1fr;
    }

    .metrics article {
      min-height: 112px;
      padding: 14px;
    }

    .organisation-row {
      grid-template-columns: 34px minmax(0, 1fr) auto;
    }

    .organisation-row .boundary {
      display: none;
    }

    .coverage-figure {
      grid-template-columns: 1fr;
    }

    .invite-user,
    .broadcast-grid {
      grid-template-columns: 1fr;
    }
  }

  .reviewer-invite { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
  
  
  

  .sidebar-footer strong { color: var(--rh-text); }
  .sidebar-footer span { color: var(--rh-muted); }
  .admin-shell .panel, .metrics article, .people-dialog {
    background: var(--rh-surface);
    border-color: var(--rh-border);
    color: var(--rh-text);
  }
  .admin-shell input, .admin-shell select {
    background: var(--rh-field);
    color: var(--rh-text);
    border-color: var(--rh-border);
  }
  @media(min-width:781px) and (max-width:1000px) {
    .admin-shell { grid-template-columns: 210px minmax(0,1fr); }
  }
  @media(max-width:780px) {
    .admin-shell { display:block; }
    .sidebar { height:auto; max-height:none; overflow:visible; margin-bottom:12px; }
    main { padding:0 0 28px; }
  }
  /* On the historical map, the existing Administration navigation and its
     date filters form the left rail, the map takes the full centre, and
     operating areas, animal groups and selected case live on the right. */
  .historical-map-workspace { min-height:100dvh; height:100dvh; }
  .historical-map-workspace .sidebar { min-height:0; }
  .historical-map-workspace main { min-height:0; }
  .admin-shell .historical-map-page { height:100%; min-height:0; padding:0; background:transparent; border:0; border-radius:0; box-shadow:none; container-type:inline-size; }
  .historical-map-filters { display:grid; align-content:start; gap:12px; padding:18px 2px 14px; margin-top:18px; border-top:1px solid var(--rh-border); }
  .historical-map-filters .panel-heading { margin:0; }
  .historical-map-filters .panel-heading h2 { font-size:17px; margin:4px 0; }
  .historical-map-filters .intro { font-size:12px; line-height:1.5; margin:3px 0 0; }
  .historical-map-filters .rescue-map-toolbar { display:grid; align-items:stretch; gap:10px; margin:0; }
  .historical-map-filters .rescue-map-toolbar label { width:100%; min-width:0; display:grid; gap:5px; }
  .historical-map-filters .rescue-map-toolbar input,
  .historical-map-filters .rescue-map-toolbar select { width:100%; min-width:0; }
  .historical-map-filters .rescue-map-toolbar button { width:100%; }
  .historical-map-filters .rescue-map-date { margin:0; font-size:12px; line-height:1.5; }
  .historical-map-filters .rescue-day-error { margin:0; }
  @media(max-width:1100px) and (min-width:781px) {
    .historical-map-workspace { grid-template-columns:220px minmax(0,1fr); }
  }
  @media(max-width:780px) {
    .historical-map-workspace { height:auto; min-height:100dvh; }
    .historical-map-workspace .sidebar { overflow:visible; }
    .historical-map-filters { margin:12px 0 0; }
    .historical-map-filters .rescue-map-toolbar { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .historical-map-page { height:auto; }
  }
</style>
