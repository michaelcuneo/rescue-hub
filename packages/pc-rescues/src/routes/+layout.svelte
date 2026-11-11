<script lang="ts">
  import './global.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { initialiseTheme } from '$lib/theme';

  let { children } = $props();
  onMount(initialiseTheme);
</script>

{@render children()}

{#if !['/', '/admin', '/documentation', '/chats'].includes(page.url.pathname)}
  <div class="appearance-dock"><ThemeSwitcher compact /></div>
{/if}

<style>
  .appearance-dock {
    position: fixed;
    z-index: 80;
    right: max(12px, env(safe-area-inset-right));
    bottom: max(12px, env(safe-area-inset-bottom));
  }
</style>
