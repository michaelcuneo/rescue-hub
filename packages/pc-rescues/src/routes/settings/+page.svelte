<script lang="ts">
  import type { PageData } from './$types';
  import type { AvailabilityPolicy, Weekday } from '$lib/server/availability';
  import { Check, Clock3, Smartphone, UserRound, ShieldCheck } from '@lucide/svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { invalidateAll } from '$app/navigation';

  let { data }: { data: PageData } = $props();
  const days: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // Evaluate defaults in functions so updates to page data don't imply an
  // automatic overwrite of a user's unsaved schedule edits.
  const initialPolicy = () => structuredClone(data.availability);
  const initialStatus = () => data.availabilityStatus;
  let policy = $state<AvailabilityPolicy>(initialPolicy());
  let status = $state(initialStatus());
  let saving = $state(false);
  let error = $state('');
  let feedback = $state('');
  const selectedTeams = $derived(
    data.membership?.teams.filter(team => data.profile.teamIds.includes(team.id)).map(team => team.name) ?? []
  );
  const membershipName = $derived(
    data.membership?.membershipTypes.find(type => type.id === data.profile.membershipTypeId)?.name ??
      data.profile.membershipTypeId ?? 'No active membership assigned'
  );

  function editDay(day: Weekday, changes: Partial<AvailabilityPolicy['week'][Weekday]>) {
    policy.week[day] = { ...policy.week[day], ...changes };
    feedback = '';
  }
  function editWindow(day: Weekday, index: number, field: 'start' | 'end', value: string) {
    policy.week[day].windows = policy.week[day].windows.map((window, i) =>
      i === index ? { ...window, [field]: value } : window
    );
    feedback = '';
  }

  async function save(nextPolicy: AvailabilityPolicy, message = 'Your rescue availability settings have been saved.') {
    if (saving) return;
    saving = true; error = ''; feedback = '';
    try {
      const response = await fetch('/api/mobile/availability', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(nextPolicy)
      });
      const result = await response.json() as {
        policy?: AvailabilityPolicy;
        status?: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
        error?: string;
      };
      if (!response.ok || !result.policy || !result.status)
        throw new Error(result.error ?? 'Unable to save rescue availability.');
      policy = result.policy;
      status = result.status;
      feedback = message;
      // Refresh the shared topbar's availability badge immediately after save.
      await invalidateAll();
    } catch (issue) {
      error = issue instanceof Error ? issue.message : 'Unable to save rescue availability.';
    } finally {
      saving = false;
    }
  }

  function setMode(mode: AvailabilityPolicy['mode']) {
    if (saving || policy.mode === mode) return;
    void save({ ...policy, mode }, mode === 'SCHEDULE'
      ? 'Your weekly schedule is now active.'
      : mode === 'ON' ? 'You are available for rescue offers.' : 'You are unavailable for rescue offers.');
  }
</script>

<svelte:head><title>Settings · Rescue Hub</title></svelte:head>
<main class="settings-page">
  <header class="heading">
    <p class="eyebrow">Your account</p>
    <h1>Settings</h1>
    <p>Manage your account, appearance and rescue availability.</p>
  </header>

  <div class="settings-layout">
    <div class="settings-aside">
      <section class="settings-panel" aria-labelledby="account-heading">
      <div class="section-heading">
        <UserRound size={21} aria-hidden="true" />
        <h2 id="account-heading">Account and membership</h2>
      </div>
      <dl class="account-details">
        <div><dt>Name</dt><dd>{data.profile.name}</dd></div>
        <div><dt>Email</dt><dd>{data.profile.email}</dd></div>
        <div><dt>Organisation</dt><dd>{data.membership?.organisationId ?? 'No organisation'}</dd></div>
        <div><dt>Membership</dt><dd>{membershipName}</dd></div>
        <div><dt>Roles</dt><dd>{data.profile.roles.map(role => role.replaceAll('_', ' ')).join(' · ')}</dd></div>
        <div><dt>Dispatch teams</dt><dd>{selectedTeams.length ? selectedTeams.join(' · ') : 'None assigned'}</dd></div>
      </dl>
      <p class="help">Roles and species qualifications are managed by your organisation administrator. Changing availability does not grant any additional permissions.</p>
    </section>

    <section class="settings-panel" aria-labelledby="appearance-heading">
      <div class="section-heading">
        <ShieldCheck size={21} aria-hidden="true" />
        <h2 id="appearance-heading">Appearance</h2>
      </div>
      <p>Use light, dark or follow your system appearance.</p>
      <ThemeSwitcher />
    </section>

      {#if data.canManageAvailability}
      <section class="settings-panel" aria-labelledby="device-heading">
        <div class="section-heading">
          <Smartphone size={21} aria-hidden="true" />
          <h2 id="device-heading">Mobile notifications</h2>
        </div>
        <p>Push notifications are delivered to registered mobile devices. Desktop rescue offers are available through Operations while signed in.</p>
        <strong>{data.registeredDevices === null ? 'Registration status unavailable' :
          `${data.registeredDevices} registered mobile device${data.registeredDevices === 1 ? '' : 's'}`}</strong>
        <p class="help">To register or repair push notifications, use Settings on your iOS or Android device.</p>
      </section>
      {/if}
    </div>
    <div class="settings-main">
    {#if data.canManageAvailability}
      <section class="settings-panel availability-panel" aria-labelledby="availability-heading">
        <div class="section-heading">
          <Clock3 size={21} aria-hidden="true" />
          <h2 id="availability-heading">Rescue availability</h2>
        </div>
        <p>Use an immediate override or follow a weekly rescue schedule. These settings are shared with the mobile application.</p>
        <p class="availability-current" aria-live="polite">
          <span class:active={status === 'AVAILABLE'} class="status-dot"></span>
          Currently {status === 'AVAILABLE' ? 'available' : status === 'BUSY' ? 'busy' : 'unavailable'}
        </p>

        <fieldset class="mode-controls" disabled={saving}>
          <legend>Availability mode</legend>
          <div class="mode-buttons">
            <button type="button" class:chosen={policy.mode === 'SCHEDULE'} aria-pressed={policy.mode === 'SCHEDULE'}
              onclick={() => setMode('SCHEDULE')}>Follow schedule</button>
            <button type="button" class:chosen={policy.mode === 'ON'} aria-pressed={policy.mode === 'ON'}
              onclick={() => setMode('ON')}>Available now</button>
            <button type="button" class:chosen={policy.mode === 'OFF'} aria-pressed={policy.mode === 'OFF'}
              onclick={() => setMode('OFF')}>Unavailable</button>
          </div>
        </fieldset>

        <form class="schedule-form" onsubmit={(event) => { event.preventDefault(); void save(policy); }}>
          <label class="timezone-field" for="timezone">
            Timezone
            <input id="timezone" name="timezone" type="text" spellcheck="false"
              bind:value={policy.timezone} placeholder="Australia/Sydney" required />
          </label>
          <p class="help">Use an IANA timezone, for example Australia/Sydney or Australia/Brisbane.</p>
          <fieldset class="week" disabled={saving}>
            <legend>Weekly schedule</legend>
            {#each days as day, index (day)}
              <div class="day">
                <label class="day-heading">
                  <input type="checkbox" checked={policy.week[day].enabled}
                    onchange={(event) => editDay(day, { enabled: event.currentTarget.checked })} />
                  <strong>{dayNames[index]}</strong>
                </label>
                {#if policy.week[day].enabled}
                  <div class="windows">
                    {#each policy.week[day].windows as window, i (i)}
                      <div class="window">
                        <label>From
                          <input aria-label={`${dayNames[index]} window ${i + 1} start`}
                            type="time" value={window.start}
                            onchange={(event) => editWindow(day, i, 'start', event.currentTarget.value)} required />
                        </label>
                        <label>To
                          <input aria-label={`${dayNames[index]} window ${i + 1} end`}
                            type="text" value={window.end} placeholder="17:00" pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00"
                            onchange={(event) => editWindow(day, i, 'end', event.currentTarget.value)} required />
                        </label>
                        <button class="remove" type="button" aria-label={`Remove ${dayNames[index]} window ${i + 1}`}
                          onclick={() => editDay(day, { windows: policy.week[day].windows.filter((_, j) => i !== j) })}>Remove</button>
                      </div>
                    {/each}
                    <button class="add-window" type="button" disabled={policy.week[day].windows.length >= 8}
                      onclick={() => editDay(day, { windows: [...policy.week[day].windows, { start: '09:00', end: '17:00' }] })}>
                      + Add time window
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </fieldset>
          <p class="help">Time windows can cross midnight. Add up to eight non-overlapping windows each day. No GPS tracking is required.</p>
          {#if error}<p class="error" role="alert">{error}</p>{/if}
          {#if feedback}<p class="success" role="status"><Check size={16} aria-hidden="true" />{feedback}</p>{/if}
          <button class="save-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save availability settings'}</button>
        </form>
      </section>

    {:else}
      <section class="settings-panel" aria-labelledby="availability-disabled">
        <div class="section-heading">
          <Clock3 size={21} aria-hidden="true" />
          <h2 id="availability-disabled">Rescue availability</h2>
        </div>
        <p>Your account does not currently have an operational rescue membership. You can still use the areas available to your role; an organisation administrator can assign rescue membership and species teams if needed.</p>
      </section>
    {/if}
    </div>
  </div>
</main>

<style>
  .settings-page { min-height:100dvh; padding:var(--rh-content-top) var(--rh-gutter) 48px;
    color:var(--rh-text); background:var(--rh-background); }
  .heading { margin:0 0 18px; }
  .eyebrow { font-size:12px; font-weight:800; text-transform:uppercase;
    letter-spacing:.1em; color:var(--rh-muted); }
  h1 { font-size:clamp(26px,3vw,34px); margin:4px 0 6px; }
  .heading p:last-child, .settings-panel > p { font-size:14px; color:var(--rh-muted); line-height:1.55; }
  .settings-layout { display:grid; grid-template-columns:minmax(290px, min(36%, 420px)) minmax(0,1fr);
    gap:16px; align-items:start; max-width:1450px; }
  .settings-aside, .settings-main { display:grid; align-content:start; gap:16px; min-width:0; }
  .settings-panel { min-width:0; display:grid; gap:14px; padding:22px;
    border:1px solid var(--rh-border); border-radius:16px; background:var(--rh-surface);
    box-shadow:var(--rh-shadow); }
  .section-heading { display:flex; align-items:center; gap:10px; color:var(--rh-text); }
  h2 { font-size:19px; margin:0; }
  .account-details { margin:0; display:grid; gap:11px; }
  .account-details > div { border-bottom:1px solid var(--rh-border); padding-bottom:9px;
    display:grid; grid-template-columns:115px minmax(0,1fr); gap:12px; }
  dt { color:var(--rh-muted); font-size:13px; }
  dd { margin:0; font-weight:700; font-size:13px; overflow-wrap:anywhere; }
  .help { color:var(--rh-muted); line-height:1.5; font-size:12px; }
  .availability-panel { min-width:0; }
  .availability-current { display:flex; align-items:center; gap:9px; font-weight:750; }
  .status-dot { width:9px; height:9px; border-radius:50%; background:#b65c2f; }
  .status-dot.active { background:#258153; }
  fieldset { min-width:0; border:0; padding:0; margin:0; }
  legend, .timezone-field { display:block; font-size:13px; font-weight:750; color:var(--rh-text); }
  .mode-buttons { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
  .mode-buttons button, .remove, .add-window { min-height:40px; padding:9px 12px; cursor:pointer;
    border-radius:9px; border:1px solid var(--rh-border); background:var(--rh-surface-soft);
    color:var(--rh-text); font-weight:750; font-size:13px; }
  .mode-buttons button.chosen { background:var(--rh-primary); color:var(--rh-on-primary);
    border-color:var(--rh-primary); }
  .schedule-form { display:grid; gap:12px; }
  .timezone-field { display:grid; gap:7px; }
  input[type=text], input[type=time] { min-height:41px; width:100%; border-radius:9px;
    border:1px solid var(--rh-border-strong); background:var(--rh-field); color:var(--rh-text);
    padding:8px 11px; font:inherit; font-size:14px; }
  input[type=checkbox] { accent-color:var(--rh-primary); width:17px; height:17px; }
  .week { display:grid; gap:9px; }
  .week legend { margin-bottom:10px; }
  .day { border:1px solid var(--rh-border); border-radius:10px; padding:13px;
    background:var(--rh-surface-soft); }
  .day-heading { display:flex; gap:10px; align-items:center; cursor:pointer; }
  .day-heading strong { font-size:14px; }
  .windows { display:grid; gap:8px; margin:11px 0 0 25px; }
  .window { display:flex; flex-wrap:wrap; gap:8px; align-items:end; }
  .window label { display:grid; gap:4px; font-size:12px; color:var(--rh-muted); }
  .window label input { width:126px; }
  .remove { color:var(--rh-danger-text); }
  .add-window { justify-self:start; }
  .save-button { justify-self:start; min-height:44px; padding:10px 18px; border:0;
    border-radius:10px; background:var(--rh-primary); color:var(--rh-on-primary);
    font-weight:800; cursor:pointer; }
  button:disabled { opacity:.6; cursor:not-allowed; }
  .error { color:var(--rh-danger-text); font-weight:700; }
  .success { display:flex; gap:7px; align-items:center; color:var(--rh-text); font-weight:700; }
  button:focus-visible, input:focus-visible { outline:3px solid var(--rh-focus); outline-offset:2px; }
  @media(max-width:850px) {
    .settings-layout { grid-template-columns:1fr; }
    .settings-layout { grid-template-columns:minmax(0,1fr); }
  }
  @media(max-width:500px) {
    .settings-panel { padding:15px; }
    .account-details > div { grid-template-columns:1fr; gap:3px; }
    .window label input { width:115px; }
  }
</style>
