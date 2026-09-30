// What's on screen and where it came from: the menu document, the chosen outlet and day, the
// open dish, and the clock. The URL mirrors it (/elbe/2026-10-01?dish=…) so any view can be
// shared or bookmarked, and the back button closes an open dish.

import type { Assortment, MenuDoc, Outlet, Section } from '../data/types';
import { addDays, berlinNow, weekday, type Now } from '../time';
import { settings } from './settings.svelte';

const CACHE_KEY = 'cantina:menu';
/** Refetch when the tab comes back after this long. */
const REFRESH_AFTER = 10 * 60_000;

type Status = 'loading' | 'ready' | 'error';

export const app = $state({
  doc: null as MenuDoc | null,
  status: 'loading' as Status,
  /** Showing a saved copy because the network failed. */
  offline: false,
  loadedAt: 0,
  outletId: null as number | null,
  date: '',
  dishId: null as number | null,
  palette: false,
  filters: false,
  now: berlinNow(),
});

// --- Loading --------------------------------------------------------------------------------------

function readCache(): MenuDoc | null {
  try {
    const doc = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return doc?.version === 1 ? doc : null;
  } catch {
    return null;
  }
}

function writeCache(doc: MenuDoc) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(doc));
  } catch {}
}

let loading: Promise<void> | null = null;

export function load(): Promise<void> {
  loading ??= (async () => {
    if (!app.doc) {
      const cached = readCache();
      if (cached) adopt(cached);
    }
    try {
      const res = await fetch('/api/menu', { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = (await res.json()) as MenuDoc;
      adopt(doc);
      writeCache(doc);
      app.offline = false;
      app.loadedAt = Date.now();
    } catch {
      if (app.doc) app.offline = true;
      else app.status = 'error';
    }
  })().finally(() => (loading = null));
  return loading;
}

function adopt(doc: MenuDoc) {
  const first = !app.doc;
  app.doc = doc;
  app.status = 'ready';
  if (first) fromUrl();
  else if (!doc.outlets.some((o) => o.id === app.outletId)) app.outletId = defaultOutlet(doc);
}

addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  tick();
  if (Date.now() - app.loadedAt > REFRESH_AFTER) void load();
});
addEventListener('online', () => void load());

// --- The clock ------------------------------------------------------------------------------------

function tick() {
  const previous = app.now.date;
  app.now = berlinNow();
  // Past midnight with "today" on screen: follow the day over.
  if (app.now.date !== previous && app.date === previous) setDate(defaultDate(app.doc));
}
setInterval(tick, 30_000);

// --- Selection ------------------------------------------------------------------------------------

export const shortName = (name: string) => name.replace(/^Kochwerk\s+/i, '');

export const outletSlug = (outlet: Outlet) =>
  shortName(outlet.name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function defaultOutlet(doc: MenuDoc): number | null {
  const saved = doc.outlets.find((o) => o.id === settings.outlet);
  return (saved ?? doc.outlets[0])?.id ?? null;
}

/** Today on a weekday; the coming Monday at the weekend. */
export function defaultDate(doc: MenuDoc | null): string {
  const today = app.now.date;
  const wd = weekday(today);
  const date = wd > 4 ? addDays(today, 7 - wd) : today;
  if (doc?.days.length && date > doc.days.at(-1)!) return doc.days.at(-1)!;
  return date;
}

/** Every weekday from the Monday of the first week with data to the Friday of the last. */
export function dayList(doc: MenuDoc | null): string[] {
  if (!doc) return [];
  const known = [...doc.days, defaultDate(doc)].sort();
  const start = addDays(known[0], -weekday(known[0]));
  const last = known.at(-1)!;
  const end = addDays(last, 4 - Math.min(weekday(last), 4));
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) if (weekday(d) < 5) out.push(d);
  return out;
}

export function outlet(): Outlet | null {
  return app.doc?.outlets.find((o) => o.id === app.outletId) ?? null;
}

export function sectionsFor(outletId: number | null, date: string): Section[] {
  if (!app.doc || outletId == null) return [];
  return app.doc.menus[outletId]?.[date] ?? [];
}

export function assortmentsFor(outletId: number | null, date: string): Assortment[] {
  if (!app.doc || outletId == null) return [];
  return (app.doc.assortments[outletId] ?? []).filter((a) => (!a.from || a.from <= date) && (!a.to || a.to >= date));
}

export function setOutlet(id: number) {
  if (id === app.outletId) return;
  app.outletId = id;
  settings.outlet = id;
  toUrl();
}

export function setDate(date: string) {
  if (date === app.date) return;
  app.date = date;
  toUrl();
}

export function stepDay(delta: number) {
  const days = dayList(app.doc);
  const index = days.indexOf(app.date);
  const next = days[Math.max(0, Math.min(days.length - 1, (index === -1 ? 0 : index) + delta))];
  if (next) setDate(next);
}

// --- URL ------------------------------------------------------------------------------------------

let pushedDish = false;

function fromUrl() {
  const doc = app.doc;
  if (!doc) return;
  const [slug, date] = location.pathname.split('/').filter(Boolean);
  const fromSlug = doc.outlets.find((o) => outletSlug(o) === slug);
  app.outletId = fromSlug?.id ?? defaultOutlet(doc);
  app.date = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : defaultDate(doc);
  const dish = Number(new URLSearchParams(location.search).get('dish'));
  app.dishId = dish > 0 ? dish : null;
  pushedDish = false;
  toUrl(true);
}

function path(): string {
  const current = outlet();
  if (!current) return '/';
  const date = app.date === defaultDate(app.doc) ? '' : `/${app.date}`;
  return `/${outletSlug(current)}${date}${app.dishId ? `?dish=${app.dishId}` : ''}`;
}

function toUrl(replace = true) {
  const next = path();
  if (next === location.pathname + location.search) return;
  if (replace) history.replaceState(null, '', next);
  else history.pushState(null, '', next);
}

addEventListener('popstate', () => {
  pushedDish = false;
  fromUrl();
});

export function openDish(id: number) {
  app.dishId = id;
  toUrl(pushedDish);
  pushedDish = true;
}

export function closeDish() {
  if (app.dishId == null) return;
  if (pushedDish) {
    history.back();
    return;
  }
  app.dishId = null;
  toUrl();
}

/** Everything needed to show the open dish: where it's served, on which day, in which station. */
export function findDish(id: number | null) {
  const doc = app.doc;
  if (!doc || id == null) return null;
  const search = (outletId: number, date: string | null, sections: Section[]) => {
    for (const section of sections) {
      const dish = section.dishes.find((d) => d.id === id);
      if (dish) return { dish, section, outletId, date };
    }
    return null;
  };
  // The selected outlet and day first: the same dish id never repeats across days, but be exact.
  const here = app.outletId != null ? search(app.outletId, app.date, sectionsFor(app.outletId, app.date)) : null;
  if (here) return here;
  for (const [outletId, byDate] of Object.entries(doc.menus)) {
    for (const [date, sections] of Object.entries(byDate)) {
      const hit = search(Number(outletId), date, sections);
      if (hit) return hit;
    }
  }
  for (const [outletId, menus] of Object.entries(doc.assortments)) {
    for (const menu of menus) {
      const hit = search(Number(outletId), null, menu.sections);
      if (hit) return hit;
    }
  }
  return null;
}

export type { Now };
