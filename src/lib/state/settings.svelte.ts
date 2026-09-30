// Preferences, kept in this browser only. public/boot.js reads `theme` before first paint; keep
// the key and shape in step with it.

export type Theme = 'system' | 'light' | 'dark';
export type Language = 'system' | 'de' | 'en';
export type DietFilter = 'all' | 'vegetarian' | 'vegan';

type Settings = {
  theme: Theme;
  language: Language;
  /** Last outlet looked at. */
  outlet: number | null;
  /** Where the app opens: the last outlet looked at, or always the same one (an outlet id). */
  startOutlet: 'last' | number;
  diet: DietFilter;
  noPork: boolean;
  /** Allergen codes (A, H, K …) to steer clear of. */
  avoid: string[];
  /** Hide non-matching dishes instead of dimming them. */
  hide: boolean;
  /** Favourite dishes, by their German name in lower case (ids change every day). */
  favorites: string[];
  /** Display names of favourites, for listing ones that aren't on the menu right now. */
  favoriteNames: Record<string, { de: string; en: string }>;
  /** Point out a favourite that's on at another outlet the same day. */
  favoriteHint: boolean;
};

const KEY = 'cantina:settings';

const DEFAULTS: Settings = {
  theme: 'system',
  language: 'system',
  outlet: null,
  startOutlet: 'last',
  diet: 'all',
  noPork: false,
  avoid: [],
  hide: false,
  favorites: [],
  favoriteNames: {},
  favoriteHint: true,
};

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = $state<Settings>(load());

$effect.root(() => {
  $effect(() => {
    const snapshot = JSON.stringify(settings);
    try {
      localStorage.setItem(KEY, snapshot);
    } catch {
      // Private mode or full storage: preferences just won't survive a reload.
    }
  });
});

// Another tab changed them (e.g. the installed app and a browser tab side by side).
addEventListener('storage', (event) => {
  if (event.key !== KEY || !event.newValue) return;
  try {
    Object.assign(settings, { ...DEFAULTS, ...JSON.parse(event.newValue) });
  } catch {}
});

export const favoriteKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export function isFavorite(name: string): boolean {
  return settings.favorites.includes(favoriteKey(name));
}

export function toggleFavorite(name: { de: string; en: string }): boolean {
  const key = favoriteKey(name.de);
  const on = !settings.favorites.includes(key);
  settings.favorites = on ? [...settings.favorites, key] : settings.favorites.filter((f) => f !== key);
  if (on) settings.favoriteNames = { ...settings.favoriteNames, [key]: { de: name.de, en: name.en } };
  else {
    const { [key]: _, ...rest } = settings.favoriteNames;
    settings.favoriteNames = rest;
  }
  return on;
}

/** Filters set in Settings (the diet switch sits in the menu itself and isn't counted). */
export function filtersActive(): number {
  return (settings.noPork ? 1 : 0) + settings.avoid.length;
}

export function resetFilters() {
  settings.diet = 'all';
  settings.noPork = false;
  settings.avoid = [];
}
