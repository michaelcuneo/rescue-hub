<script lang="ts">
  import { page } from '$app/state';
  import { ChevronDown } from '@lucide/svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';

  type Viewer = { name: string; roles: string[] };
  let { viewer, demoMode = false }: { viewer: Viewer | null; demoMode?: boolean } = $props();

  const isAdministrator = $derived(Boolean(viewer?.roles.some(role =>
    ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN'].includes(role))));
  const isAuthority = $derived(Boolean(viewer?.roles.some(role =>
    ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role))));
  const initials = $derived(viewer?.name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0]?.toUpperCase()).join('') || '?');
  const path = $derived(page.url.pathname);
</script>

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
    {#if isAdministrator}
      <a href="/admin" aria-current={path.startsWith('/admin') ? 'page' : undefined}>Administration</a>
    {/if}
    <a href="/documentation" aria-current={path.startsWith('/documentation') ? 'page' : undefined}>Documentation</a>
  </nav>

  <div class="account-actions">
    {#if viewer}
      <details class="more-menu">
        <summary>More <ChevronDown size={14} aria-hidden="true" /></summary>
        <nav aria-label="Other tools">
          <a href="/chats">Chats</a>
          {#if viewer.roles.includes('CARER')}<a href="/care-offers">Care offers</a>{/if}
          {#if isAuthority}
            <a href="/reports">Public reports</a>
            <a href="/demo/hunter">Hunter workspace</a>
            {#if demoMode}<a href="/demo/exit">Leave Hunter workspace</a>{/if}
          {/if}
        </nav>
      </details>
      <span class="person" title={viewer.name}><span class="person-mark">{initials}</span><span class="person-name">{viewer.name}</span></span>
    {/if}
    <ThemeSwitcher compact />
    {#if viewer}
      <form method="POST" action="/logout"><button class="sign-out" type="submit">Sign out</button></form>
    {:else}
      <a class="sign-out" href="/login?next=%2F">Sign in</a>
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
  .sign-out, .more-menu summary {
    display:inline-flex; justify-content:center; align-items:center; gap:6px; min-height:34px;
    border:1px solid var(--rh-border); border-radius:9px; padding:0 10px;
    background:var(--rh-surface-soft); color:var(--rh-text); font:inherit;
    text-decoration:none; cursor:pointer; white-space:nowrap;
  }
  .more-menu { position:relative; }
  .more-menu summary { list-style:none; }
  .more-menu summary::-webkit-details-marker { display:none; }
  .more-menu nav {
    position:absolute; right:0; top:calc(100% + 10px); z-index:70;
    min-width:190px; display:grid; gap:4px; padding:7px;
    border:1px solid var(--rh-border); border-radius:11px;
    background:var(--rh-surface); box-shadow:var(--rh-shadow);
  }
  .more-menu nav a { padding:10px 12px; border-radius:7px; color:var(--rh-text);
    text-decoration:none; white-space:nowrap; }
  .more-menu nav a:hover { background:var(--rh-surface-soft); }
  .person { display:flex; align-items:center; gap:7px; min-width:0; max-width:160px; }
  .person-mark { width:31px; height:31px; flex:0 0 31px; display:grid; place-items:center;
    border-radius:50%; background:var(--rh-raised); color:var(--rh-text); font-weight:800; }
  .person-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  form { margin:0; }
  @media(max-width:1280px) {
    .workspace-bar { grid-template-columns:auto minmax(0,1fr) auto; }
    .person-name { display:none; }
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
    .area-navigation a { font-size:12px; padding:7px 8px; }
    .person, .sign-out { display:none; }
    .more-menu summary { font-size:0; width:30px; padding:0; }
    .more-menu summary svg { width:16px; height:16px; }
  }
  @media(max-width:420px) {
    .area-navigation a { font-size:10px; padding:7px 4px; }
  }
</style>
