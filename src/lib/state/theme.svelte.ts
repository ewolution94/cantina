// Light / dark. Follows the system until the toggle is used; public/boot.js applies a saved
// choice before first paint, and this keeps <html data-theme> and theme-color in step after.

import { settings } from './settings.svelte';

const media = matchMedia('(prefers-color-scheme: light)');
let systemLight = $state(media.matches);
media.addEventListener('change', (event) => (systemLight = event.matches));

export function effectiveTheme(): 'light' | 'dark' {
  if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
  return systemLight ? 'light' : 'dark';
}

export function toggleTheme() {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  // Back to "system" when the choice matches it, so a later OS switch is followed again.
  settings.theme = next === (systemLight ? 'light' : 'dark') ? 'system' : next;
}

$effect.root(() => {
  $effect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    // Each theme-color meta carries a media query; with an explicit theme both get its colour.
    const color = (theme: 'light' | 'dark') => (theme === 'light' ? '#f6f5f2' : '#0a0a0c');
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = settings.theme === 'system' ? color(meta.media.includes('light') ? 'light' : 'dark') : color(effectiveTheme());
    }
  });
});
