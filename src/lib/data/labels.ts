// Human names for the codes in the menu document, and the dietary filter.

import { l, locale, t } from '../i18n/index.svelte';
import type { MessageKey } from '../i18n/en';
import { settings } from '../state/settings.svelte';
import type { Diet, Dish, MenuDoc } from './types';

/**
 * Kochwerk's allergen names are the legal ones ("Glutenhaltiges Getreide", "Schalenfrüchte und
 * Erzeugnisse"). Chips want the word people use. Keyed by Kochwerk's German codes; anything not
 * listed falls back to the name in the document.
 */
const ALLERGENS: Record<string, [de: string, en: string]> = {
  A: ['Gluten', 'Gluten'],
  AA: ['Weizen', 'Wheat'],
  AB: ['Roggen', 'Rye'],
  AC: ['Gerste', 'Barley'],
  AD: ['Hafer', 'Oats'],
  AE: ['Dinkel', 'Spelt'],
  AF: ['Kamut', 'Kamut'],
  B: ['Ei', 'Egg'],
  C: ['Fisch', 'Fish'],
  D: ['Krebstiere', 'Crustaceans'],
  E: ['Weichtiere', 'Molluscs'],
  F: ['Erdnuss', 'Peanut'],
  G: ['Soja', 'Soy'],
  H: ['Milch', 'Milk'],
  I: ['Nüsse', 'Tree nuts'],
  IA: ['Mandel', 'Almond'],
  IB: ['Haselnuss', 'Hazelnut'],
  IC: ['Walnuss', 'Walnut'],
  ID: ['Cashew', 'Cashew'],
  IE: ['Pekannuss', 'Pecan'],
  IF: ['Paranuss', 'Brazil nut'],
  IG: ['Pistazie', 'Pistachio'],
  IH: ['Macadamia', 'Macadamia'],
  J: ['Sellerie', 'Celery'],
  K: ['Senf', 'Mustard'],
  L: ['Sesam', 'Sesame'],
  M: ['Sulfite', 'Sulphites'],
  N: ['Lupine', 'Lupin'],
};

/** The 14 EU main allergens, in the order the filter shows them. Sub-codes (AA wheat, IB hazelnut) count towards their group. */
export const MAIN_ALLERGENS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

export function allergenName(code: string, doc?: MenuDoc | null): string {
  const own = ALLERGENS[code];
  if (own) return locale() === 'de' ? own[0] : own[1];
  return capitalize(l(doc?.meta.allergens[code]) || code);
}

/** Main group of a code: AA (wheat) → A (gluten), IB (hazelnut) → I (nuts). */
export const allergenGroup = (code: string) => (/^[AI][A-H]$/.test(code) ? code[0] : code);

/** Kochwerk's English names are often lower case ("preservatives"); lists read better capitalised. */
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

export function additiveName(code: string, doc?: MenuDoc | null): string {
  return capitalize(l(doc?.meta.additives[code]) || code);
}

const FEATURE_KEYS: Record<string, MessageKey> = {
  glutenFree: 'feat.glutenFree',
  lactoseFree: 'feat.lactoseFree',
  garlic: 'feat.garlic',
  climate: 'feat.climate',
  sustainable: 'feat.sustainable',
};

/** Features worth a chip. Diet features (vegan, beef …) are already the dish's colour and label. */
export function featureChips(dish: Dish, doc?: MenuDoc | null): { key: string; label: string }[] {
  return dish.feats
    .filter((key) => !DIETS.includes(key as Diet))
    .map((key) => ({ key, label: FEATURE_KEYS[key] ? t(FEATURE_KEYS[key]) : capitalize(l(doc?.meta.features[key]) || key) }));
}

export const DIETS: Diet[] = ['vegan', 'vegetarian', 'fish', 'poultry', 'beef', 'pork', 'lamb', 'game'];

export const dietName = (diet: Diet) => t(`diet.${diet}` as MessageKey);

export type Fit = { ok: true } | { ok: false; reasons: string[] };

/** Whether a dish passes the current filter, and if not, why (shown on the dimmed card). */
export function fit(dish: Dish, doc?: MenuDoc | null): Fit {
  const reasons: string[] = [];
  const veg = dish.diet === 'vegan' || dish.diet === 'vegetarian';
  if (settings.diet === 'vegan' && dish.diet !== 'vegan') reasons.push(t('filter.notDiet', { diet: t('diet.vegan') }));
  else if (settings.diet === 'vegetarian' && !veg) reasons.push(t('filter.notDiet', { diet: t('diet.vegetarian') }));
  if (settings.noPork && dish.feats.includes('pork')) reasons.push(t('diet.pork'));
  if (settings.avoid.length) {
    const hits = [...new Set(dish.allergens.filter((code) => settings.avoid.includes(allergenGroup(code)) || settings.avoid.includes(code)).map(allergenGroup))];
    if (hits.length) reasons.push(t('filter.contains', { list: hits.map((code) => allergenName(code, doc)).join(', ') }));
  }
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
