import { get, writable } from 'svelte/store';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'rescue-hub-appearance';
export const themePreference = writable<ThemePreference>('system');
export const resolvedTheme = writable<ResolvedTheme>('light');

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function setThemePreference(value: ThemePreference): void {
  if (isThemePreference(value)) themePreference.set(value);
}

/**
 * Initialise exactly once from the root layout. The pre-hydration script in
 * app.html applies the same preference before any content paints.
 */
export function initialiseTheme(): () => void {
  if (typeof window === 'undefined') return () => {};

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let stored: unknown = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Private browsing/storage restrictions must not prevent the UI rendering.
  }
  const preference: ThemePreference = isThemePreference(stored) ? stored : 'system';

  const apply = (choice: ThemePreference) => {
    const mode: ResolvedTheme = choice === 'system'
      ? (media.matches ? 'dark' : 'light')
      : choice;
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    resolvedTheme.set(mode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      // Preserve this-tab behaviour when browser storage is disabled.
    }
  };

  themePreference.set(preference);
  const unsubscribe = themePreference.subscribe(apply);
  const onSystemChange = () => {
    if (get(themePreference) === 'system') apply('system');
  };
  media.addEventListener('change', onSystemChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const next = isThemePreference(event.newValue) ? event.newValue : 'system';
    themePreference.set(next);
  };
  window.addEventListener('storage', onStorage);

  return () => {
    unsubscribe();
    media.removeEventListener('change', onSystemChange);
    window.removeEventListener('storage', onStorage);
  };
}
