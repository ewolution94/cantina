// The Kochwerk menu, fetched from webspeiseplan.de and boiled down to what Cantina shows.
//
// webspeiseplan.de is a jQuery app talking to `/index.php?token=…&model=…`. That endpoint sends
// no CORS headers and answers with an empty body unless the request carries the site's own
// Referer, so a browser can't use it directly: this module does, on the server, and hands the
// client one compact, language-complete JSON document instead of nine raw ones (the raw menu
// alone is ~2.3 MB).
//
// No dependencies. Shared by the production server and the Vite dev server.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

export const DEFAULT_ORIGIN = 'https://kochwerk-web.webspeiseplan.de';
/** Baked into webspeiseplan's own public bundle (index.js, `PROXY_TOKEN`). Re-read from there if it stops working. */
export const DEFAULT_TOKEN = '3524feef01a6cea78cd1996c72b31d5f';
export const DEFAULT_LOCATION = 1800; // OTTO Kochwerk
/** Where dish and outlet photos live. The image proxy only ever talks to this host. */
export const IMAGE_ORIGIN = 'https://kochwerk.konkaapps.de';

const TIME_ZONE = 'Europe/Berlin';
/** Bump when normalize() changes shape or content, so a menu cached by an older build is refetched. */
const REVISION = 4;
const DE = 1;
const EN = 2;

// --- Small helpers --------------------------------------------------------------------------------

const clean = (value) =>
  String(value ?? '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

const stripHtml = (html) =>
  clean(
    String(html ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s*\n\s*/g, ' '),
  );

const ids = (list) =>
  String(list ?? '')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);

const round = (value, digits = 1) => (value == null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 10 ** digits) / 10 ** digits);

/** YYYY-MM-DD in Hamburg, whatever the server's clock is set to. */
export function berlinDate(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
const weekday = (iso) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;

/** "DE text / EN text" in one field, which Kochwerk does for notes and closed days. */
function bilingual(text) {
  const value = clean(text);
  if (!value) return null;
  const parts = value.split(/\s+\/\s+/);
  if (parts.length === 2 && parts[0] && parts[1]) return { de: parts[0], en: parts[1] };
  return { de: value, en: value };
}

// --- Names ----------------------------------------------------------------------------------------

/**
 * Categories are named for the till, not for people: "Green Daily Salad 3", "F&T Vegan Elbe",
 * "Lust auf Suppe Groß Bistro". Dropping the running number and the outlet suffix turns them
 * into stations that group sensibly ("Green Daily Salad", "F&T Vegan", "Lust auf Suppe Groß").
 */
export function stationName(raw, outletWords) {
  let name = clean(raw);
  for (let i = 0; i < 4; i++) {
    const before = name;
    name = name.replace(/\s+\d+$/, '');
    const last = name.split(' ').at(-1)?.toLowerCase();
    if (name.includes(' ') && last && outletWords.has(last)) name = name.slice(0, name.lastIndexOf(' '));
    name = name.trim();
    if (name === before) break;
  }
  return name || clean(raw);
}

const MENU_WORDS = {
  fruehstueck: { de: 'Frühstück', en: 'Breakfast' },
  frühstück: { de: 'Frühstück', en: 'Breakfast' },
  sortiment: { de: 'Sortiment', en: 'Assortment' },
  getränke: { de: 'Getränke', en: 'Drinks' },
  salatbuffet: { de: 'Salatbuffet', en: 'Salad bar' },
  brötchenmix: { de: 'Brötchenmix', en: 'Bread rolls' },
  toppings: { de: 'Toppings', en: 'Toppings' },
  basics: { de: 'Basics', en: 'basics' },
  kiosksortimente: { de: 'Kiosksortiment', en: 'Kiosk assortment' },
  kiosksortiment: { de: 'Kiosksortiment', en: 'Kiosk assortment' },
  thekensortiment: { de: 'Thekensortiment', en: 'Counter assortment' },
};

/** Menus that only exist for Kochwerk's own screens or as a fallback; their dishes join the main assortment. */
const INTERNAL_MENU = /^(monitore?|backup)\b/i;

/** "Sortiment Bistro Boulevard 1" → Sortiment / Assortment, "Toppings_Salatbuffet" → Toppings Salatbuffet. */
export function menuName(raw, outletWords) {
  const words = clean(String(raw ?? '').replace(/_/g, ' '))
    .split(' ')
    .filter((word) => word && !/^\d+$/.test(word) && !outletWords.has(word.toLowerCase()));
  if (!words.length) return null;
  return {
    de: words.map((w) => MENU_WORDS[w.toLowerCase()]?.de ?? w).join(' '),
    en: words.map((w) => MENU_WORDS[w.toLowerCase()]?.en ?? w).join(' '),
  };
}

/**
 * Till abbreviations Kochwerk sometimes leaves in a name: "Gulasch Pute Bi" (Bistro), "Reis Duft
 * El" (Elbe), "Rind Roulade Pr". A closed list, so a real word like "Ei" is never touched.
 */
const TILL_SUFFIX = /\s+(?:Bi|El|Pr|Bo|Bp|Ki|Sr)$/;

/** A dish name's first line is the dish; further lines are notes ("Kleine Portion 1,80 €", "Pro 100 Gramm"). */
function splitName(raw) {
  const lines = String(raw ?? '')
    .split(/\r?\n/)
    .map((line) => clean(line).replace(TILL_SUFFIX, ''))
    .filter(Boolean);
  // Some English names arrive in lower case ("vegan schnitzel with …").
  const name = lines[0] ?? '';
  return { name: name.charAt(0).toUpperCase() + name.slice(1), note: lines.slice(1).join(' · ') || null };
}

/** An "English" name that is really till shorthand is worse than the German one. */
const tillCode = (raw) => String(raw ?? '').split(/\r?\n/).some((line) => TILL_SUFFIX.test(clean(line)));

// --- Features, allergens, additives ---------------------------------------------------------------

const FEATURE_KEYS = [
  [/^vegan/i, 'vegan'],
  [/^vegetar/i, 'vegetarian'],
  [/gluten/i, 'glutenFree'],
  [/la[ck]tose/i, 'lactoseFree'],
  [/^wild/i, 'game'],
  [/knoblauch|garlic/i, 'garlic'],
  [/^rind|^beef/i, 'beef'],
  [/^schwein|^pork/i, 'pork'],
  [/klima|climate/i, 'climate'],
  [/geflügel|poultry/i, 'poultry'],
  [/^lamm|^lamb/i, 'lamb'],
  [/sustainable|nachhaltig/i, 'sustainable'],
];

const featureKey = (name, id) => FEATURE_KEYS.find(([pattern]) => pattern.test(clean(name)))?.[1] ?? `f${id}`;

/** The one colour a dish is drawn in. Order matters: a vegan dish is also vegetarian, meatballs are beef and pork. */
const DIET_ORDER = ['vegan', 'vegetarian', 'fish', 'poultry', 'beef', 'pork', 'lamb', 'game'];

/** Allergen codes that mean "nothing to declare" rather than an allergen. */
const NO_ALLERGEN = new Set(['X99']);
/** Additive codes that aren't additives: "keine deklarationspflichtigen Zusatzstoffe", "INFORMATION". */
const NO_ADDITIVE = new Set(['NON', '99']);

/** Kochwerk writes some allergens in capitals ("SENF UND SENFERZEUGNISSE"); tone them down, keeping nouns capitalised. */
function calmCase(text) {
  const value = clean(text);
  const letters = value.replace(/[^\p{L}]/gu, '');
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  if (!letters || upper / letters.length < 0.7) return value;
  return value
    .toLowerCase()
    .replace(/(^|[\s/(-])(\p{L})/gu, (match, lead, letter) => lead + letter.toUpperCase())
    .replace(/\b(Und|Oder|Inkl|Der|Die|Das|Mit)\b/g, (word) => word.toLowerCase());
}

// --- The normalizer -------------------------------------------------------------------------------

/**
 * Turns the raw webspeiseplan models into Cantina's document. Pure, so it can be tested on
 * recorded responses.
 *
 * @param {object} raw  { location, outlets, menus, categories: {de, en}, allergens: {de, en},
 *                        additives: {de, en}, features: {de, en} } — each the `content` array
 * @param {string} today  YYYY-MM-DD in Berlin
 */
export function normalize(raw, today = berlinDate()) {
  const outletWords = new Set(
    raw.outlets
      .flatMap((outlet) => clean(outlet.name).toLowerCase().split(' '))
      .filter((word) => word && word !== 'kochwerk'),
  );

  // Categories: the German record is canonical; English ones point at it via gerichtkategorieID.
  const categories = new Map();
  for (const c of raw.categories.de) categories.set(c.id, { name: clean(c.name), order: c.reihenfolgeInApp ?? 999 });
  const categoryEn = new Map();
  for (const c of raw.categories.en) if (c.languageTypeID === EN) categoryEn.set(c.gerichtkategorieID, clean(c.name));

  // Features / allergens / additives: dishes reference the German ids.
  const features = new Map();
  const meta = { features: {}, allergens: {}, additives: {} };
  const featureEn = new Map(raw.features.en.map((f) => [f.gerichtmerkmalID, clean(f.name)]));
  for (const f of raw.features.de) {
    const key = featureKey(f.name, f.id);
    features.set(f.id, key);
    meta.features[key] ??= { de: clean(f.name), en: featureEn.get(f.id) ?? clean(f.name) };
  }
  const allergens = new Map();
  const allergenEn = new Map(raw.allergens.en.map((a) => [a.allergeneID, clean(a.name)]));
  for (const a of raw.allergens.de) {
    const code = clean(a.kuerzel).toUpperCase();
    if (!code) continue;
    allergens.set(a.id, code);
    if (NO_ALLERGEN.has(code)) continue;
    // Two German records can share a code (fish is listed twice); keep the one that has an English name.
    // Some "English" records are just the German name again, so only a different name counts.
    const en = allergenEn.get(a.id);
    const translated = Boolean(en) && clean(en).toLowerCase() !== clean(a.name).toLowerCase();
    if (!meta.allergens[code] || (translated && !meta.allergens[code].translated)) {
      meta.allergens[code] = { de: calmCase(a.name), en: calmCase(translated ? en : a.name), translated };
    }
  }
  const additives = new Map();
  const additiveEn = new Map(raw.additives.en.map((a) => [a.zusatzstoffeID, clean(a.name)]));
  for (const a of raw.additives.de) {
    const code = clean(a.kuerzel).toUpperCase();
    if (!code) continue;
    additives.set(a.id, code);
    if (!NO_ADDITIVE.has(code)) meta.additives[code] ??= { de: clean(a.name), en: additiveEn.get(a.id) ?? clean(a.name) };
  }

  function dish(entry) {
    const g = entry.speiseplanAdvancedGericht;
    const z = entry.zusatzinformationen ?? {};
    const de = splitName(g.gerichtname);
    const alt = clean(z.gerichtnameAlternative) && !tillCode(z.gerichtnameAlternative) ? splitName(z.gerichtnameAlternative) : null;
    // Notes stay with their own language: an English note under a German name would be noise.
    const en = alt?.name ? alt : de;

    const feats = [...new Set(ids(entry.gerichtmerkmaleIds).map((id) => features.get(id)).filter(Boolean))];
    const allergenCodes = [...new Set(ids(entry.allergeneIds).map((id) => allergens.get(id)).filter((c) => c && !NO_ALLERGEN.has(c)))].sort();
    const additiveCodes = [...new Set(ids(entry.zusatzstoffeIds).map((id) => additives.get(id)).filter((c) => c && !NO_ADDITIVE.has(c)))];

    const traits = new Set(feats);
    if (allergenCodes.includes('C')) traits.add('fish');
    const diet = DIET_ORDER.find((key) => traits.has(key)) ?? null;

    const out = {
      id: g.id,
      name: { de: de.name, en: en.name },
      diet,
      feats,
      allergens: allergenCodes,
      additives: additiveCodes,
    };
    if (de.note || en.note) out.note = { de: de.note ?? '', en: en.note ?? '' };
    const price = Number(z.mitarbeiterpreisDecimal2);
    if (price > 0) out.price = round(price, 2);
    if (z.nwkcalInteger != null) {
      out.nutrition = {
        kcal: Math.round(z.nwkcalInteger),
        kj: z.nwkjInteger != null ? Math.round(z.nwkjInteger) : null,
        protein: round(z.nweiweissDecimal1),
        carbs: round(z.nwkohlehydrateDecimal1),
        sugar: round(z.nwzuckerDecimal1),
        fat: round(z.nwfettDecimal1),
        saturated: round(z.nwfettsaeurenDecimal1),
        salt: round(z.nwsalzDecimal1, 2),
      };
    }
    const co2 = z.sustainability?.co2;
    if (co2?.co2Value != null) out.co2 = { g: Math.round(co2.co2Value), rating: clean(co2.co2RatingIdentifier).toUpperCase() || null };
    const image = String(z.gerichtImage ?? '');
    if (image && !/dummy/i.test(image)) {
      out.image = proxiedImage(image);
      // Kochwerk renders a 205 px square of every dish photo for its own app; the list uses that
      // instead of scaling a 1600 px original down to a thumbnail on every paint.
      if (out.image) out.thumb = out.image.replace(/\/([^/]+)$/, '/small_MEAL_1_1_$1');
    }
    return out;
  }

  /** Dishes grouped into stations, in the order Kochwerk's own app shows them. */
  function stations(entries) {
    const groups = new Map();
    entries.forEach((entry, index) => {
      const g = entry.speiseplanAdvancedGericht;
      const category = categories.get(g.gerichtkategorieID) ?? { name: '', order: 999 };
      const de = stationName(category.name, outletWords);
      const en = stationName(categoryEn.get(g.gerichtkategorieID) ?? category.name, outletWords);
      const key = de.toLowerCase();
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { name: { de, en }, order: category.order, first: index, items: [] }));
      group.order = Math.min(group.order, category.order);
      group.items.push({ entry, order: [category.order, g.reihenfolgeInGerichtkategorie ?? 0, index] });
    });

    return [...groups.values()]
      .sort((a, b) => a.order - b.order || a.first - b.first)
      .map((group) => {
        const seen = new Set();
        const dishes = group.items
          .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2])
          .map(({ entry }) => dish(entry))
          .filter((d) => d.name.de && !seen.has(d.name.de.toLowerCase()) && seen.add(d.name.de.toLowerCase()));
        return { id: slug(group.name.de), name: group.name, dishes };
      })
      .filter((section) => section.dishes.length);
  }

  // Dated menus: one day's dishes per outlet. The window drops archived plans (a 2021 "backup"
  // plan and a 2020 counter plan are still marked active) without hiding earlier days this week.
  const from = addDays(today, -weekday(today));
  const until = addDays(from, 27);
  const dated = new Map(); // outletId → date → entries
  const assortmentMenus = new Map(); // outletId → menu[]

  const plans = raw.menus
    .filter((m) => m.speiseplanAdvanced?.aktiv !== false)
    .sort((a, b) => (a.speiseplanAdvanced.reihenfolgeInApp ?? 0) - (b.speiseplanAdvanced.reihenfolgeInApp ?? 0) || a.speiseplanAdvanced.id - b.speiseplanAdvanced.id);

  for (const plan of plans) {
    const info = plan.speiseplanAdvanced;
    const entries = (plan.speiseplanGerichtData ?? []).filter((e) => e.speiseplanAdvancedGericht?.aktiv !== false);
    if (!entries.length) continue;

    if (info.gueltigTaeglich) {
      const validFrom = String(info.gueltigVon ?? '').slice(0, 10);
      const validTo = String(info.gueltigBis ?? '').slice(0, 10);
      if (validTo && validTo < from) continue;
      if (/^backup\b/i.test(clean(info.titel))) continue;
      const list = assortmentMenus.get(info.outletID) ?? [];
      list.push({ info, entries, from: validFrom || null, to: validTo || null });
      assortmentMenus.set(info.outletID, list);
      continue;
    }

    for (const entry of entries) {
      const date = String(entry.speiseplanAdvancedGericht.datum ?? '').slice(0, 10);
      if (!date || date < from || date > until) continue;
      if (!info.showWeekend && weekday(date) > 4) continue;
      const byDate = dated.get(info.outletID) ?? new Map();
      const list = byDate.get(date) ?? [];
      list.push(entry);
      byDate.set(date, list);
      dated.set(info.outletID, byDate);
    }
  }

  const menus = {};
  const days = new Set();
  for (const [outletId, byDate] of dated) {
    menus[outletId] = {};
    for (const [date, entries] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
      const sections = stations(entries);
      if (!sections.length) continue;
      menus[outletId][date] = sections;
      days.add(date);
    }
  }

  // Assortments: the everyday range (coffee, rolls, the salad bar). Screen-only and unnamed plans
  // fold into the first real one, and a dish already listed in an earlier plan isn't repeated.
  const assortments = {};
  for (const [outletId, list] of assortmentMenus) {
    const merged = [];
    for (const menu of list) {
      const name = menuName(menu.info.anzeigename || menu.info.titel, outletWords);
      const internal = !name || INTERNAL_MENU.test(name.de);
      const target = internal ? merged[0] : null;
      if (target) {
        target.entries.push(...menu.entries);
        target.from = [target.from, menu.from].filter(Boolean).sort()[0] ?? null;
        target.to = [target.to, menu.to].filter(Boolean).sort().at(-1) ?? null;
      } else {
        merged.push({ name: internal ? { de: 'Sortiment', en: 'Assortment' } : name, entries: [...menu.entries], from: menu.from, to: menu.to });
      }
    }
    const seen = new Set();
    assortments[outletId] = merged
      .map((menu) => {
        const sections = stations(menu.entries)
          .map((section) => ({
            ...section,
            dishes: section.dishes.filter((d) => !seen.has(d.name.de.toLowerCase()) && seen.add(d.name.de.toLowerCase())),
          }))
          .filter((section) => section.dishes.length);
        return { id: slug(menu.name.de), name: menu.name, from: menu.from, to: menu.to, sections };
      })
      .filter((menu) => menu.sections.length);
  }

  const outlets = raw.outlets
    .map((o) => {
      const days = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
      return {
        id: o.id,
        name: clean(o.name),
        order: o.reihenfolge ?? 999,
        image: o.outletImage ? proxiedImage(o.outletImage) : null,
        hours: days.map((d) => [o[`${d}Zeit1`], o[`${d}Zeit2`]].map(slot).filter(Boolean)),
        note: bilingual(stripHtml(o.oeffnungszeitenRichtext)),
      };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  for (const entry of Object.values(meta.allergens)) delete entry.translated;

  const location = raw.location.find((l) => l.id === raw.locationId) ?? raw.location[0];

  return {
    version: 1,
    today,
    location: { id: location?.id ?? raw.locationId, name: clean(location?.name) },
    outlets,
    days: [...days].sort(),
    menus,
    assortments,
    meta,
  };
}

/** "07:30 - 17:30 Uhr" → ["07:30", "17:30"]; closed days and blanks → null. */
function slot(text) {
  const match = clean(text).match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const pad = (h, m) => `${h.padStart(2, '0')}:${m}`;
  return [pad(match[1], match[2]), pad(match[3], match[4])];
}

const slug = (text) =>
  clean(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'section';

/** Photos go through our own /img/ proxy: the canvas halftone needs them same-origin. */
export function proxiedImage(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== IMAGE_ORIGIN) return null;
    return `/img${parsed.pathname.replace(/\/{2,}/g, '/')}`;
  } catch {
    return null;
  }
}

// --- Upstream + cache -----------------------------------------------------------------------------

class UpstreamError extends Error {}

/**
 * @param {object} [options]
 * @param {string} [options.origin]     webspeiseplan instance
 * @param {number} [options.location]   location id (1800 = OTTO Kochwerk)
 * @param {string} [options.token]      proxy token; rediscovered from the site's bundle if rejected
 * @param {number} [options.ttl]        how long a fetched menu counts as fresh (ms)
 * @param {string} [options.cacheFile]  where the last good document survives restarts
 */
export function createMenuSource(options = {}) {
  const origin = (options.origin ?? DEFAULT_ORIGIN).replace(/\/$/, '');
  const location = Number(options.location ?? DEFAULT_LOCATION);
  const ttl = options.ttl ?? 15 * 60_000;
  const cacheFile = options.cacheFile ?? null;
  let token = options.token || DEFAULT_TOKEN;

  /** { doc, json, gzip, br, etag, fetchedAt } */
  let current = null;
  let inflight = null;
  let lastError = null;
  let loadedFromDisk = false;

  async function call(model, lang) {
    const url = new URL('/index.php', origin);
    url.search = new URLSearchParams({ token, model, location: String(location), languagetype: String(lang), _: String(Date.now()) }).toString();
    const res = await fetch(url, {
      headers: {
        referer: `${origin}/menu`,
        'x-requested-with': 'XMLHttpRequest',
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (compatible; Cantina; +menu viewer)',
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new UpstreamError(`${model}: HTTP ${res.status}`);
    const text = await res.text();
    // A rejected token (or a missing Referer) doesn't error; it answers 200 with nothing.
    if (!text.trim()) throw new UpstreamError(`${model}: empty response`);
    const body = JSON.parse(text);
    if (!body.success || !Array.isArray(body.content)) throw new UpstreamError(`${model}: unsuccessful`);
    return body.content;
  }

  /** Reads the current token out of webspeiseplan's own bundle, for when they rotate it. */
  async function discoverToken() {
    const html = await (await fetch(`${origin}/menu`, { signal: AbortSignal.timeout(15_000) })).text();
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1], origin).href);
    for (const src of scripts) {
      const js = await (await fetch(src, { signal: AbortSignal.timeout(20_000) })).text();
      const match = js.match(/PROXY_TOKEN:"([a-f0-9]{16,64})"/);
      if (match) return match[1];
    }
    return null;
  }

  async function fetchAll() {
    const models = {
      location: ['location', DE],
      outlets: ['outlet', DE],
      menus: ['menu', DE],
      categoriesDe: ['mealCategory', DE],
      categoriesEn: ['mealCategory', EN],
      allergensDe: ['allergens', DE],
      allergensEn: ['allergens', EN],
      additivesDe: ['additives', DE],
      additivesEn: ['additives', EN],
      featuresDe: ['features', DE],
      featuresEn: ['features', EN],
    };
    const entries = await Promise.all(Object.entries(models).map(async ([key, [model, lang]]) => [key, await call(model, lang)]));
    const r = Object.fromEntries(entries);
    return {
      locationId: location,
      location: r.location,
      outlets: r.outlets.filter((o) => o.standortID == null || o.standortID === location),
      menus: r.menus,
      categories: { de: r.categoriesDe, en: r.categoriesEn },
      allergens: { de: r.allergensDe, en: r.allergensEn },
      additives: { de: r.additivesDe, en: r.additivesEn },
      features: { de: r.featuresDe, en: r.featuresEn },
    };
  }

  function pack(doc, fetchedAt) {
    const json = Buffer.from(JSON.stringify({ ...doc, fetchedAt }));
    return {
      doc,
      json,
      gzip: zlib.gzipSync(json, { level: 9 }),
      br: zlib.brotliCompressSync(json, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10 } }),
      etag: `"${crypto.createHash('sha1').update(json).digest('base64url').slice(0, 20)}"`,
      fetchedAt,
    };
  }

  async function refresh() {
    let raw;
    try {
      raw = await fetchAll();
    } catch (err) {
      if (!(err instanceof UpstreamError) || !/empty response/.test(err.message)) throw err;
      const found = await discoverToken().catch(() => null);
      if (!found || found === token) throw err;
      console.log('[cantina] webspeiseplan rotated its token; picked up the new one');
      token = found;
      raw = await fetchAll();
    }
    current = pack(normalize(raw), new Date().toISOString());
    lastError = null;
    if (cacheFile) {
      await mkdir(path.dirname(cacheFile), { recursive: true }).catch(() => {});
      await writeFile(cacheFile, JSON.stringify({ revision: REVISION, doc: current.doc, fetchedAt: current.fetchedAt })).catch((err) => console.warn('[cantina] could not write cache:', err.message));
    }
    return current;
  }

  function refreshOnce() {
    inflight ??= refresh()
      .catch((err) => {
        lastError = err;
        console.warn('[cantina] upstream refresh failed:', err.message);
        throw err;
      })
      .finally(() => (inflight = null));
    return inflight;
  }

  async function loadFromDisk() {
    loadedFromDisk = true;
    if (!cacheFile) return;
    try {
      const saved = JSON.parse(await readFile(cacheFile, 'utf8'));
      if (saved?.revision === REVISION) current = pack(saved.doc, saved.fetchedAt);
    } catch {}
  }

  /** Stale-while-revalidate: a stale menu is served at once and refreshed behind it. */
  async function get() {
    if (!current && !loadedFromDisk) await loadFromDisk();
    const age = current ? Date.now() - Date.parse(current.fetchedAt) : Infinity;
    // A document from before today's date (cached overnight) has the wrong week window; wait for a fresh one.
    const stale = !current || age > ttl || current.doc.today !== berlinDate();
    if (!current) return refreshOnce();
    if (stale) {
      const pending = refreshOnce().catch(() => current);
      if (current.doc.today !== berlinDate()) return pending;
    }
    return current;
  }

  return { get, get lastError() { return lastError; } };
}

// --- HTTP -----------------------------------------------------------------------------------------

const IMAGE_PATH = /^\/img(\/KMSLiveRessources\/[A-Za-z0-9_\-./%]+\.(?:jpe?g|png|webp|gif))$/i;
/** Kochwerk's scaled copies: small_MEAL_1_1_<file>, medium_MEAL_16_9_<file> … → [dir/, file]. */
const SCALED_COPY = /^(.*\/)(?:small|medium|large)_MEAL_\d+_\d+_([^/]+)$/;

async function fetchImage(path) {
  try {
    return await fetch(IMAGE_ORIGIN + path, { signal: AbortSignal.timeout(20_000) });
  } catch {
    return null;
  }
}

/**
 * Connect-style middleware for `/api/menu` and the `/img/…` photo proxy; everything else falls
 * through to `next`.
 */
export function createApi(options = {}) {
  const source = options.source ?? createMenuSource(options);

  async function menu(req, res) {
    let entry;
    try {
      entry = await source.get();
    } catch (err) {
      res.writeHead(502, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ error: 'upstream', message: err.message }));
      return;
    }
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache',
      etag: entry.etag,
      vary: 'accept-encoding',
    };
    if (req.headers['if-none-match'] === entry.etag) {
      res.writeHead(304, headers).end();
      return;
    }
    const accept = req.headers['accept-encoding'] ?? '';
    const [body, encoding] = /\bbr\b/.test(accept) ? [entry.br, 'br'] : /\bgzip\b/.test(accept) ? [entry.gzip, 'gzip'] : [entry.json, null];
    res.writeHead(200, { ...headers, ...(encoding ? { 'content-encoding': encoding } : {}), 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  async function image(req, res, pathname) {
    const match = pathname.match(IMAGE_PATH);
    if (!match || match[1].includes('..')) {
      res.writeHead(404).end();
      return;
    }
    let upstream = await fetchImage(match[1]);
    // A scaled copy Kochwerk hasn't rendered (yet): serve the original instead.
    const scaled = match[1].match(SCALED_COPY);
    if (scaled && upstream?.status === 404) upstream = await fetchImage(scaled[1] + scaled[2]);
    if (!upstream) {
      res.writeHead(502).end();
      return;
    }
    const type = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !type.startsWith('image/')) {
      res.writeHead(upstream.status === 404 ? 404 : 502).end();
      return;
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(200, {
      'content-type': type,
      'content-length': body.length,
      // Kochwerk re-uploads under new names rather than replacing files, so a day is safe.
      'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  return async function api(req, res, next) {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname === '/api/menu' || pathname.startsWith('/img/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' }).end();
        return;
      }
      return pathname === '/api/menu' ? menu(req, res) : image(req, res, pathname);
    }
    return next();
  };
}
