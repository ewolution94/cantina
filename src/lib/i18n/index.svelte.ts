import { untrack } from 'svelte';
import { themeShift } from '../../../vendor/ewo/elements/theme-shift.js';
import { settings } from '../state/settings.svelte';
import { de } from './de';
import { en, type MessageKey } from './en';

export type Locale = 'en' | 'de';
export const LOCALES: Locale[] = ['de', 'en'];

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, de };

/** First supported language in the browser's list; German by default, since Kochwerk is in Hamburg. */
function detectLocale(): Locale {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const base = tag?.toLowerCase().split('-')[0];
    if (LOCALES.includes(base as Locale)) return base as Locale;
  }
  return 'de';
}

let systemLocale = $state<Locale>(detectLocale());
addEventListener('languagechange', () => (systemLocale = detectLocale()));

/** The language the user's choice asks for: theirs, or the browser's until they make one. */
const wanted = (): Locale => (settings.language === 'system' ? systemLocale : settings.language);

// The language on screen. A pick in Settings reaches it under Folio's themeShift (the page blurs for
// a moment, like a theme change); the first run and the browser's own language changing under
// "system" apply at once.
let shown = $state<Locale>(wanted());
let lastChoice = settings.language;

/** The active language, as it's shown. */
export function locale(): Locale {
  return shown;
}

export function setLocale(next: Locale) {
  settings.language = next;
}

$effect.root(() => {
  $effect(() => {
    const next = wanted(); // tracks the choice and the browser's language
    const picked = settings.language !== lastChoice;
    lastChoice = settings.language;
    if (next === untrack(() => shown)) return;
    if (picked) themeShift(() => (shown = next));
    else shown = next;
  });
  $effect(() => {
    document.documentElement.lang = locale();
  });
});

type Param = string | number;

function render(param: Param): string {
  return typeof param === 'number' ? new Intl.NumberFormat(locale()).format(param) : param;
}

/** Translates a key, filling `{name}` placeholders. Reactive: re-renders when the language changes. */
export function t(key: MessageKey, params?: Record<string, Param>): string {
  const template = DICTIONARIES[locale()][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? render(params[name]) : match));
}

type PluralBase = { [K in MessageKey]: K extends `${infer Base}.other` ? Base : never }[MessageKey];

/** Plural-aware t(): picks `<key>.one` or `<key>.other` for the count and passes it as {count}. */
export function tn(base: PluralBase, count: number, params?: Record<string, Param>): string {
  const form = new Intl.PluralRules(locale()).select(count) === 'one' ? 'one' : 'other';
  return t(`${base}.${form}` as MessageKey, { count, ...params });
}

/** Picks the current language out of a { de, en } pair from the menu document. */
export function l(value: { de: string; en: string } | null | undefined): string {
  if (!value) return '';
  return value[locale()] ?? value.de ?? '';
}

// --- Locale-aware formatting --------------------------------------------------------------------

/**
 * "5,80€" / "5.80€": the euro sign after the amount and tight to it in both languages, the way
 * Kochwerk's own tills print it (plenty of German readers use the English interface).
 */
export function formatPrice(value: number): string {
  return `${formatNumber(value, 2)}€`;
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(ratio);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** "Mi" / "Wed" */
export function weekdayShort(iso: string): string {
  return new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(at(iso)).replace('.', '');
}

/** "Mittwoch" / "Wednesday" */
export function weekdayLong(iso: string): string {
  return new Intl.DateTimeFormat(locale(), { weekday: 'long', timeZone: 'UTC' }).format(at(iso));
}

/** "Mittwoch, 30. September" / "Wednesday, 30 September" */
export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat(locale() === 'de' ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(at(iso));
}

/** "30. Sept." / "30 Sept" */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat(locale() === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(at(iso));
}

/** Clock time of an ISO timestamp in Hamburg: "14:32". */
export function formatClock(timestamp: string | number): string {
  return new Intl.DateTimeFormat(locale() === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(timestamp));
}

export function formatList(items: string[]): string {
  return new Intl.ListFormat(locale(), { style: 'short', type: 'conjunction' }).format(items);
}
