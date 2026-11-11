<script lang="ts">
  import './global.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import AppTopbar from '$lib/components/AppTopbar.svelte';
  import { initialiseTheme } from '$lib/theme';

  let { data, children } = $props();
  onMount(initialiseTheme);
  const isWorkspace = $derived(['/', '/admin', '/documentation', '/chats'].includes(page.url.pathname));
</script>

{#if isWorkspace}
  <AppTopbar viewer={data.viewer} />
{/if}
{@render children()}

{#if !isWorkspace && page.url.pathname !== '/chats'}
  <div class="appearance-dock"><ThemeSwitcher compact /></div>
{/if}

<style>
  .appearance-dock {
    position:fixed; z-index:80; right:max(12px,env(safe-area-inset-right));
    bottom:max(12px,env(safe-area-inset-bottom));
  }
</style>
