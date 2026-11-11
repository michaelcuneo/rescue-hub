<script lang="ts">
  import { Monitor, Moon, Sun } from '@lucide/svelte';
  import { setThemePreference, themePreference, type ThemePreference } from '$lib/theme';

  let { compact = false }: { compact?: boolean } = $props();
</script>

<div class:compact class="theme-switcher">
  {#if $themePreference === 'light'}
    <Sun size={16} aria-hidden="true" />
  {:else if $themePreference === 'dark'}
    <Moon size={16} aria-hidden="true" />
  {:else}
    <Monitor size={16} aria-hidden="true" />
  {/if}

  <select
    aria-label="Appearance"
    title="Appearance"
    value={$themePreference}
    onchange={(event) => setThemePreference(event.currentTarget.value as ThemePreference)}
  >
    <option value="light">Light</option>
    <option value="dark">Dark</option>
    <option value="system">System</option>
  </select>
</div>

<style>
  .theme-switcher {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 6px 0 9px;
    border: 1px solid var(--rh-border);
    border-radius: 9px;
    background: var(--rh-surface);
    color: var(--rh-text);
    pointer-events: auto;
    font: 700 12px/1.4 Inter, system-ui, sans-serif;
  }
  select {
    min-height: 34px;
    padding: 0 5px 0 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  select option {
    background: var(--rh-surface);
    color: var(--rh-text);
  }
  select:focus-visible {
    outline: 3px solid var(--rh-focus);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .compact { min-height: 34px; }
  .compact select { min-height: 32px; }
</style>
