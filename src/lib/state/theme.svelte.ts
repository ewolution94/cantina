// Light / dark. Follows the system until the toggle is used; public/boot.js applies a saved
// choice before first paint, and this keeps <html data-theme> and theme-color in step after.

import { themeShift } from '../../../vendor/ewo/elements/theme-shift.js';
import { settings } from './settings.svelte';

type Theme = typeof settings.theme;

const media = matchMedia('(prefers-color-scheme: light)');
let systemLight = $state(media.matches);
// What's on screen, from media.matches rather than systemLight, so the effect below doesn't track it.
const resolve = (theme: Theme): 'light' | 'dark' => (theme === 'system' ? (media.matches ? 'light' : 'dark') : theme);
// The theme the page shows. It changes when the theme is applied (under themeShift's blur, a moment
// after the pick) or when the OS switches under "system", so the halftone reads the right colours.
let onScreen = $state(resolve(settings.theme));
media.addEventListener('change', (event) => {
  systemLight = event.matches;
  if (settings.theme === 'system') onScreen = resolve('system');
});

export function effectiveTheme(): 'light' | 'dark' {
  if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
  return systemLight ? 'light' : 'dark';
}

/** The theme the page shows right now; follow this, not the pick, for colours read from CSS. */
export function shownTheme(): 'light' | 'dark' {
  return onScreen;
}

export function toggleTheme() {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  // Back to "system" when the choice matches it, so a later OS switch is followed again.
  settings.theme = next === (systemLight ? 'light' : 'dark') ? 'system' : next;
}

let shown: Theme | undefined;

$effect.root(() => {
  $effect(() => {
    const theme = settings.theme; // read here, so the effect tracks it
    const apply = () => {
      const root = document.documentElement;
      if (theme === 'system') delete root.dataset.theme;
      else root.dataset.theme = theme;
      // Each theme-color meta carries a media query; with an explicit theme both get its colour.
      const color = (side: 'light' | 'dark') => (side === 'light' ? '#f6f5f2' : '#0a0a0c');
      for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
        meta.content = theme === 'system' ? color(meta.media.includes('light') ? 'light' : 'dark') : color(theme);
      }
      onScreen = resolve(theme);
    };
    // A pick that changes the colours blurs the page for a moment (Folio's themeShift); the
    // first run, an OS switch and a pick that changes nothing on screen apply at once.
    if (shown !== undefined && resolve(shown) !== resolve(theme)) themeShift(apply);
    else apply();
    shown = theme;
  });
});
