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

/** The active language: the user's choice, or the browser's until they make one. */
export function locale(): Locale {
  return settings.language === 'system' ? systemLocale : settings.language;
}

export function setLocale(next: Locale) {
  settings.language = next;
}

$effect.root(() => {
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

export function formatPrice(value: number): string {
  return new Intl.NumberFormat(locale() === 'de' ? 'de-DE' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(value);
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
