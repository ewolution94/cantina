// Every place a dish appears: which outlet, which day (null for the everyday assortment), which
// station. Search and favourites both work from this list.

import { favoriteKey } from '../state/settings.svelte';
import type { Dish, MenuDoc, Section } from './types';

export type Occurrence = { dish: Dish; section: Section; outletId: number; date: string | null };

export function occurrences(doc: MenuDoc | null): Occurrence[] {
  if (!doc) return [];
  const out: Occurrence[] = [];
  const add = (outletId: number, date: string | null, sections: Section[]) => {
    for (const section of sections) for (const dish of section.dishes) out.push({ dish, section, outletId, date });
  };
  for (const [outletId, byDate] of Object.entries(doc.menus)) for (const [date, sections] of Object.entries(byDate)) add(Number(outletId), date, sections);
  for (const [outletId, menus] of Object.entries(doc.assortments)) for (const menu of menus) add(Number(outletId), null, menu.sections);
  return out;
}

/** Dated appearances of each favourite from `from` on, soonest first. */
export function upcomingFavorites(doc: MenuDoc | null, favorites: string[], from: string): Map<string, Occurrence[]> {
  const wanted = new Set(favorites);
  const found = new Map<string, Occurrence[]>();
  for (const hit of occurrences(doc)) {
    if (!hit.date || hit.date < from) continue;
    const key = favoriteKey(hit.dish.name.de);
    if (!wanted.has(key)) continue;
    const list = found.get(key) ?? [];
    list.push(hit);
    found.set(key, list);
  }
  for (const list of found.values()) list.sort((a, b) => a.date!.localeCompare(b.date!) || a.outletId - b.outletId);
  return found;
}
