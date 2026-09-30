// The document /api/menu serves; built by server/kochwerk.mjs → normalize().

export type Localized = { de: string; en: string };

export type Diet = 'vegan' | 'vegetarian' | 'fish' | 'poultry' | 'beef' | 'pork' | 'lamb' | 'game';

export type Nutrition = {
  kcal: number;
  kj: number | null;
  protein: number | null;
  carbs: number | null;
  sugar: number | null;
  fat: number | null;
  saturated: number | null;
  salt: number | null;
};

export type Dish = {
  id: number;
  name: Localized;
  note?: Localized;
  diet: Diet | null;
  /** Feature keys: vegan, vegetarian, glutenFree, lactoseFree, garlic, climate, beef, pork … */
  feats: string[];
  /** EU allergen codes as Kochwerk prints them: A (gluten), AA (wheat), H (milk) … */
  allergens: string[];
  additives: string[];
  price?: number;
  nutrition?: Nutrition;
  co2?: { g: number; rating: string | null };
  /** Same-origin proxy path (/img/…); only set for real photos, not Kochwerk's placeholder. */
  image?: string;
  /** The same photo as Kochwerk's 205 px square, for lists. */
  thumb?: string;
};

export type Section = { id: string; name: Localized; dishes: Dish[] };

export type Assortment = { id: string; name: Localized; from: string | null; to: string | null; sections: Section[] };

/** [open, close] as "HH:MM", per weekday Monday…Sunday; an empty list means closed. */
export type Slot = [string, string];

export type Outlet = {
  id: number;
  name: string;
  order: number;
  image: string | null;
  hours: Slot[][];
  note: Localized | null;
};

export type MenuDoc = {
  version: 1;
  today: string;
  fetchedAt: string;
  location: { id: number; name: string };
  outlets: Outlet[];
  /** Every date (YYYY-MM-DD) that has a dated menu somewhere. */
  days: string[];
  menus: Record<string, Record<string, Section[]>>;
  assortments: Record<string, Assortment[]>;
  meta: {
    features: Record<string, Localized>;
    allergens: Record<string, Localized>;
    additives: Record<string, Localized>;
  };
};
