<script lang="ts">
  import { page } from '$app/state';
  import { ChevronDown, LogOut, Settings } from '@lucide/svelte';

  type Viewer = {
    name: string;
    roles: string[];
    availabilityMode: 'ON' | 'OFF' | 'SCHEDULE';
    isAvailableNow: boolean;
    canReceiveRescueOffers: boolean;
  };
  let { viewer }: { viewer: Viewer | null } = $props();

  const isAdministrator = $derived(Boolean(viewer?.roles.some(role =>
    ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN'].includes(role))));
  const initials = $derived(viewer?.name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0]?.toUpperCase()).join('') || '?');
  const path = $derived(page.url.pathname);
  const availabilityLabel = $derived(!viewer?.canReceiveRescueOffers
    ? 'Unavailable for rescue offers'
    : viewer.availabilityMode === 'ON' ? 'Available now'
    : viewer.availabilityMode === 'SCHEDULE'
      ? `Following schedule — ${viewer.isAvailableNow ? 'currently available' : 'currently outside scheduled hours'}`
      : 'Unavailable for rescue offers');
  const availabilityColour = $derived(
    viewer?.canReceiveRescueOffers && viewer.availabilityMode === 'ON' ? 'on'
    : viewer?.canReceiveRescueOffers && viewer.availabilityMode === 'SCHEDULE' ? 'schedule' : 'off'
  );
  let profileMenu = $state<HTMLDetailsElement | undefined>(undefined);
  function closeProfileMenu() {
    if (profileMenu) profileMenu.open = false;
  }
</script>

<svelte:window
  onclick={(event) => {
    if (profileMenu && event.target instanceof Node && !profileMenu.contains(event.target)) {
      closeProfileMenu();
    }
  }}
  onkeydown={(event) => {
    if (event.key === 'Escape' && profileMenu?.open) {
      closeProfileMenu();
      profileMenu.querySelector('summary')?.focus();
    }
  }}
/>

<header class="workspace-bar">
  <a class="identity" href={viewer ? '/' : '/documentation'} aria-label="Rescue Hub home">
    <span class="mark" aria-hidden="true">RH</span>
    <span class="identity-text"><strong>Rescue Hub</strong><small>Wildlife coordination</small></span>
  </a>

  <nav class="area-navigation" aria-label="Main navigation">
    {#if viewer}
      <a href="/" aria-current={path === '/' ? 'page' : undefined}>Operations</a>
    {:else}
      <a href="/login?next=%2F">Operations</a>
    {/if}
    {#if viewer && !viewer.roles.includes('PUBLIC_REPORTER')}
      <a href="/chats" aria-current={path.startsWith('/chats') ? 'page' : undefined}>Chats</a>
    {/if}
    {#if isAdministrator}
      <a href="/admin" aria-current={path.startsWith('/admin') ? 'page' : undefined}>Administration</a>
    {/if}
    <a href="/documentation" aria-current={path.startsWith('/documentation') ? 'page' : undefined}>Documentation</a>
  </nav>

  <div class="account-actions">
    {#if viewer}
      <details class="profile-menu" bind:this={profileMenu}>
        <summary title={`${viewer.name} · ${availabilityLabel}`}
          aria-label={`Account menu for ${viewer.name}. ${availabilityLabel}.`}>
          <span class="avatar-wrap" aria-hidden="true">
            <span class="profile-avatar">{initials}</span>
            <span class="availability-dot" data-status={availabilityColour}></span>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div class="profile-panel" aria-label="Account options">
          <p class="availability-caption" role="status">
            <span class="availability-dot inline" data-status={availabilityColour} aria-hidden="true"></span>
            {availabilityLabel}
          </p>
          <a href="/settings" aria-current={path.startsWith('/settings') ? 'page' : undefined}
            onclick={closeProfileMenu}>
            <Settings size={17} aria-hidden="true" /> Settings
          </a>
          <form method="POST" action="/logout">
            <button type="submit"><LogOut size={17} aria-hidden="true" /> Sign out</button>
          </form>
        </div>
      </details>
    {:else}
      <a class="sign-in" href="/login?next=%2F">Sign in</a>
    {/if}
  </div>
</header>

<style>
  .workspace-bar {
    position: fixed;
    z-index: 60;
    top: 14px;
    left: var(--rh-gutter);
    right: var(--rh-gutter);
    height: 58px;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(155px,1fr) auto minmax(155px,1fr);
    gap: 12px;
    align-items: center;
    padding: 7px 12px;
    border: 1px solid var(--rh-border);
    border-radius: 14px;
    background: var(--rh-surface);
    box-shadow: var(--rh-shadow);
    color: var(--rh-text);
    font: 600 12px/1.35 Inter, ui-sans-serif, system-ui, sans-serif;
  }
  .identity { min-width:0; display:flex; align-items:center; gap:10px; text-decoration:none; color:inherit; }
  .mark { display:grid; place-items:center; width:38px; height:38px; flex:0 0 38px;
    border-radius:10px; background:var(--rh-primary); color:var(--rh-on-primary); font-size:13px; font-weight:900; }
  .identity-text { display:grid; gap:1px; white-space:nowrap; }
  .identity-text strong { font-size:14px; }
  .identity-text small { font-size:11px; color:var(--rh-muted); font-weight:500; }
  .area-navigation { display:flex; align-items:center; gap:3px; padding:4px;
    border:1px solid var(--rh-border); background:var(--rh-surface-soft); border-radius:10px; min-width:0; }
  .area-navigation a { padding:8px 13px; border-radius:7px; color:var(--rh-muted);
    text-decoration:none; font-size:12px; white-space:nowrap; font-weight:750; }
  .area-navigation a:hover { background:var(--rh-raised); color:var(--rh-text); }
  .area-navigation a[aria-current='page'] { background:var(--rh-nav-active); color:var(--rh-text);
    box-shadow: 0 1px 4px rgb(0 0 0 / .08); }
  .account-actions { justify-self:end; display:flex; align-items:center; gap:8px; min-width:0; }
  .sign-in {
    display:inline-flex; align-items:center; min-height:34px;
    border:1px solid var(--rh-border); border-radius:9px; padding:0 10px;
    background:var(--rh-surface-soft); color:var(--rh-text); text-decoration:none;
  }
  .profile-menu { position:relative; }
  .profile-menu summary {
    display:flex; align-items:center; justify-content:center; gap:4px;
    min-width:53px; min-height:42px; padding:2px 6px;
    list-style:none; border:1px solid var(--rh-border); border-radius:10px;
    background:var(--rh-surface-soft); color:var(--rh-text); cursor:pointer;
  }
  .profile-menu summary::-webkit-details-marker { display:none; }
  .profile-menu summary:hover, .profile-menu[open] summary {
    background:var(--rh-raised); border-color:var(--rh-border-strong);
  }
  .profile-menu summary:focus-visible, .profile-panel a:focus-visible,
  .profile-panel button:focus-visible { outline:3px solid var(--rh-focus); outline-offset:2px; }
  .avatar-wrap { position:relative; display:inline-grid; place-items:center; }
  .profile-avatar {
    display:grid; place-items:center; width:32px; height:32px; border-radius:50%;
    background:var(--rh-primary); color:var(--rh-on-primary);
    font-weight:850; font-size:12px; letter-spacing:.01em;
  }
  .availability-dot {
    --status: #aa3037;
    position:absolute; right:-3px; bottom:-2px; width:11px; height:11px;
    border:2px solid var(--rh-surface); border-radius:50%;
    background:var(--status);
  }
  .availability-dot[data-status='on'] { --status:#17854c; }
  .availability-dot[data-status='schedule'] { --status:#b17a08; }
  .availability-dot[data-status='off'] { --status:#b22932; }
  .availability-dot:not(.inline)::after {
    content:''; position:absolute; inset:-5px; border:2px solid var(--status);
    border-radius:50%; animation:status-pulse 2.8s ease-out infinite;
  }
  @keyframes status-pulse {
    0% { opacity:.75; transform:scale(.6); }
    70%, 100% { opacity:0; transform:scale(1.65); }
  }
  @media (prefers-reduced-motion: reduce) {
    .availability-dot::after { animation:none !important; }
  }
  .availability-caption { display:flex; align-items:center; gap:9px;
    padding:7px 11px 10px; font-size:12px; line-height:1.4;
    font-weight:750; color:var(--rh-muted); }
  .availability-dot.inline { position:relative; right:auto; bottom:auto;
    flex:0 0 11px; border-color:var(--rh-surface); }
  .profile-panel {
    position:absolute; top:calc(100% + 9px); right:0; z-index:85;
    min-width:185px; padding:7px; border:1px solid var(--rh-border);
    border-radius:12px; background:var(--rh-surface);
    box-shadow:var(--rh-shadow); color:var(--rh-text);
  }
  .profile-panel a, .profile-panel button {
    display:flex; align-items:center; gap:10px; width:100%; min-height:42px;
    border:0; border-radius:8px; padding:9px 12px; background:transparent;
    color:var(--rh-text); font:inherit; font-size:13px; font-weight:700;
    text-decoration:none; text-align:left; cursor:pointer;
  }
  .profile-panel a:hover, .profile-panel button:hover,
  .profile-panel a[aria-current='page'] { background:var(--rh-raised); }
  .profile-panel form { margin:0; border-top:1px solid var(--rh-border); padding-top:5px; margin-top:5px; }
  @media(max-width:1280px) {
    .workspace-bar { grid-template-columns:auto minmax(0,1fr) auto; }
    .profile-menu summary { min-width:48px; }
  }
  @media(max-width:1050px) {
    .identity-text small { display:none; }
    .account-actions { gap:5px; }
    .area-navigation { justify-self:center; }
    .area-navigation a { padding:8px 9px; }
  }
  @media(max-width:760px) {
    .workspace-bar { top:10px; left:10px; right:10px; height:86px; padding:6px 8px;
      grid-template-columns:auto 1fr auto; grid-template-rows:34px 34px; gap:4px; }
    .identity { grid-column:1; grid-row:1; }
    .identity-text { display:none; }
    .mark { width:34px; height:34px; flex-basis:34px; }
    .account-actions { grid-column:3; grid-row:1; }
    .area-navigation { grid-column:1 / -1; grid-row:2; justify-self:stretch;
      justify-content:space-evenly; padding:2px; }
    .area-navigation a { font-size:11px; padding:7px 8px; }
    .sign-in { min-height:34px; }
  }
  @media(max-width:420px) {
    .area-navigation a { font-size:10px; padding:7px 4px; }
  }
</style>
