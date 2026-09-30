// A dish without a photo gets a plate of dots instead: seen from above, the food as halftone
// piles on a sunflower (phyllotaxis) grid. It's seeded by the dish name, so the same dish always
// gets the same plate, and shaped a little by what it is: soup fills the bowl, a salad scatters,
// a pizza carries toppings.

export type PlateDot = { x: number; y: number; r: number; tone: 0 | 1 | 2 };

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pile = { x: number; y: number; sigma: number; weight: number; tone: 0 | 1 | 2 };

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const CENTER = 50;
const FOOD_RADIUS = 35;
const COUNT = 120;

type Kind = 'soup' | 'salad' | 'pizza' | 'bowl' | 'plate' | 'drink' | 'bake';

function kindOf(name: string): Kind {
  const n = name.toLowerCase();
  if (/suppe|soup|eintopf|brühe|consommé|bisque/.test(n)) return 'soup';
  if (/pizza|flammkuchen|quiche|tarte/.test(n)) return 'pizza';
  if (/salat|salad|antipasti/.test(n)) return 'salad';
  if (/kaffee|coffee|espresso|cappuccino|latte|tee\b|tea\b|kakao|cocoa|saft|juice|wasser|water|limo|getränk|drink|smoothie/.test(n)) return 'drink';
  if (/brötchen|croissant|muffin|kuchen|cake|cookie|brezel|laugen|schrippe|stulle|toast|bagel|wrap|sandwich|franzbrötchen/.test(n)) return 'bake';
  if (/bowl|curry|chili|risotto|gulasch|goulash|müsli|porridge|pudding|quark|joghurt|eis\b|ice/.test(n)) return 'bowl';
  return 'plate';
}

function piles(kind: Kind, random: () => number): Pile[] {
  const around = (radius: number) => {
    const a = random() * Math.PI * 2;
    const d = radius * Math.sqrt(random());
    return { x: CENTER + Math.cos(a) * d, y: CENTER + Math.sin(a) * d };
  };
  switch (kind) {
    case 'soup':
    case 'drink':
      return [
        { x: CENTER, y: CENTER, sigma: 60, weight: kind === 'drink' ? 0.55 : 0.7, tone: 0 },
        { ...around(10), sigma: 7, weight: 0.5, tone: 2 },
      ];
    case 'pizza':
      return [
        { x: CENTER, y: CENTER, sigma: 50, weight: 0.45, tone: 1 },
        ...Array.from({ length: 6 }, () => ({ ...around(24), sigma: 4 + random() * 3, weight: 0.9, tone: 0 as const })),
      ];
    case 'salad':
      return Array.from({ length: 7 + Math.floor(random() * 4) }, (_, i) => ({
        ...around(26),
        sigma: 5 + random() * 5,
        weight: 0.6 + random() * 0.4,
        tone: (i % 3 === 0 ? 2 : 0) as 0 | 2,
      }));
    case 'bake':
      return [{ ...around(6), sigma: 15 + random() * 5, weight: 0.85, tone: 1 }];
    case 'bowl': {
      const main = around(8);
      return [
        { ...main, sigma: 16 + random() * 5, weight: 1, tone: 0 },
        { x: 2 * CENTER - main.x + (random() - 0.5) * 10, y: 2 * CENTER - main.y + (random() - 0.5) * 10, sigma: 11 + random() * 4, weight: 0.8, tone: 1 },
        { ...around(18), sigma: 4, weight: 0.7, tone: 2 },
      ];
    }
    default: {
      // A main, a side or two, a garnish.
      const a = random() * Math.PI * 2;
      return [
        { x: CENTER + Math.cos(a) * 11, y: CENTER + Math.sin(a) * 11, sigma: 13 + random() * 4, weight: 1, tone: 0 },
        { x: CENTER + Math.cos(a + 2.3) * 16, y: CENTER + Math.sin(a + 2.3) * 16, sigma: 9 + random() * 4, weight: 0.85, tone: 1 },
        { x: CENTER + Math.cos(a - 2.1) * 17, y: CENTER + Math.sin(a - 2.1) * 17, sigma: 7 + random() * 3, weight: 0.75, tone: random() > 0.5 ? 2 : 1 },
      ];
    }
  }
}

const cache = new Map<string, PlateDot[]>();

export function plateDots(name: string): PlateDot[] {
  const cached = cache.get(name);
  if (cached) return cached;
  const random = rng(hash(name));
  const kind = kindOf(name);
  const food = piles(kind, random);
  const dots: PlateDot[] = [];
  for (let i = 1; i <= COUNT; i++) {
    const radius = FOOD_RADIUS * Math.sqrt(i / COUNT);
    const angle = i * GOLDEN;
    const x = CENTER + Math.cos(angle) * radius;
    const y = CENTER + Math.sin(angle) * radius;
    let best = 0;
    let tone: 0 | 1 | 2 = 0;
    for (const pile of food) {
      const d2 = (x - pile.x) ** 2 + (y - pile.y) ** 2;
      const v = pile.weight * Math.exp(-d2 / (2 * pile.sigma * pile.sigma));
      if (v > best) {
        best = v;
        tone = pile.tone;
      }
    }
    const v = best * (0.85 + random() * 0.3);
    const r = 0.5 + 2.6 * v;
    if (v < 0.12) continue;
    dots.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: Math.round(r * 100) / 100, tone });
  }
  cache.set(name, dots);
  return dots;
}
