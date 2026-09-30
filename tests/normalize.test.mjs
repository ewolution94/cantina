import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuName, normalize, proxiedImage, stationName } from '../server/kochwerk.mjs';

// A miniature of webspeiseplan's models, shaped like the real responses (field names and all).

const outlet = (id, name, order, extra = {}) => ({
  id,
  name,
  reihenfolge: order,
  standortID: 1800,
  outletImage: `https://kochwerk.konkaapps.de/KMSLiveRessources/outlet/${id}.jpg`,
  moZeit1: '11:30 - 14:00 Uhr',
  moZeit2: ' ',
  diZeit1: '11:30 - 14:00 Uhr',
  miZeit1: '07:30 - 10:00 Uhr',
  miZeit2: '11:30 - 14:00 Uhr',
  doZeit1: '11:30 - 14:00 Uhr',
  frZeit1: '11:30 - 13:30',
  saZeit1: 'geschlossen / closed',
  soZeit1: 'geschlossen / closed',
  oeffnungszeitenRichtext: null,
  ...extra,
});

let nextId = 1;
const dish = (name, date, category, { alt = null, price = 4.5, features = null, allergens = null, additives = null, image = null, order = 1, active = true, kcal = 600, co2 = null } = {}) => ({
  speiseplanAdvancedGericht: { id: nextId++, aktiv: active, datum: `${date}T00:00:00+02:00`, gerichtkategorieID: category, reihenfolgeInGerichtkategorie: order, gerichtname: name },
  zusatzinformationen: {
    gerichtnameAlternative: alt,
    mitarbeiterpreisDecimal2: price,
    nwkcalInteger: kcal,
    nwkjInteger: kcal == null ? null : kcal * 4.2,
    nweiweissDecimal1: 20,
    nwkohlehydrateDecimal1: 60,
    nwzuckerDecimal1: 5,
    nwfettDecimal1: 20,
    nwfettsaeurenDecimal1: 4,
    nwsalzDecimal1: 1.5,
    gerichtImage: image ?? 'https://kochwerk.konkaapps.de/KMSLiveRessources//speiseplangericht/Dummygerichtbild.jpg',
    sustainability: co2 ? { co2: { co2Value: co2[0], co2RatingIdentifier: co2[1] } } : null,
  },
  gerichtmerkmaleIds: features,
  allergeneIds: allergens,
  zusatzstoffeIds: additives,
});

const plan = (id, outletID, title, entries, { daily = false, active = true, from = '2026-09-28', to = '2026-10-03', order = 1 } = {}) => ({
  speiseplanAdvanced: { id, aktiv: active, gueltigTaeglich: daily, showWeekend: false, titel: title, anzeigename: title, gueltigVon: `${from}T00:00:00+02:00`, gueltigBis: `${to}T23:59:59+02:00`, reihenfolgeInApp: order, outletID },
  speiseplanGerichtData: entries,
});

function fixture() {
  nextId = 1;
  return {
    locationId: 1800,
    location: [{ id: 1800, name: 'OTTO Kochwerk' }],
    outlets: [
      outlet(2, 'Bistro Boulevard', 3),
      outlet(4, 'Kochwerk Elbe', 2),
      outlet(7, 'Steelrunner', 7, { oeffnungszeitenRichtext: '<p>Ob der Steelrunner heute geöffnet ist, erfährst Du im Intranet / check our website for opening times</p>' }),
    ],
    menus: [
      plan(1, 4, 'Elbe', [
        dish('Veganes Chili mit Reis', '2026-09-30', 10, { alt: 'Vegan chilli with rice', features: '11,48', allergens: '42,43', co2: [805, 'A'], image: 'https://kochwerk.konkaapps.de/KMSLiveRessources//speiseplangericht/20260930_PLU2508.jpg' }),
        dish('Gebratenes Schollenfilet', '2026-09-30', 11, { alt: 'Fried plaice fillet', allergens: '132' }),
        dish('Vegetarischer Blattsalat', '2026-09-30', 12, { features: '25', order: 1 }),
        dish('Veganer Antipasti Salat', '2026-09-30', 13, { features: '11', order: 1 }),
        dish('Wochenend-Brunch', '2026-10-03', 10),
        dish('Gestrichen', '2026-09-30', 10, { active: false }),
      ]),
      plan(2, 2, 'Bistro Boulevard Mittag', [
        dish('Putengulasch mit Reis', '2026-09-30', 20, { alt: 'Gulasch Pute Bi\nReis Duft El', features: '17' }),
        dish('Vegane Rote Bete Suppe\nKleine Portion 1,80 €', '2026-09-30', 21, { alt: 'Vegan beetroot soup\nSmall portion 1,50 €', features: '11' }),
        dish('6 Fleischklösschen', '2026-10-01', 20, { features: '15,16', allergens: '131', price: 0 }),
      ]),
      plan(3, 2, 'Backup Sortiment Bistro Boulevard', [dish('Altes Brötchen', '2021-09-01', 30)], { from: '2021-09-01', to: '2026-11-01' }),
      plan(4, 2, 'Sortiment Bistro Boulevard 1', [dish('Croissant', '2026-09-22', 30, { features: '25' }), dish('Cappuccino', '2026-09-22', 31)], { daily: true, from: '2026-09-22', to: '2027-09-22' }),
      plan(5, 2, 'Monitore Bistro Boulevard', [dish('Croissant', '2026-09-28', 30), dish('Haribo', '2026-09-28', 32)], { daily: true, from: '2026-09-28', to: '2027-09-28', order: 2 }),
      plan(6, 2, 'Fruehstueck_Boulevard', [dish('Obstsalat', '2026-09-30', 33)], { daily: true, active: false, from: '2026-09-30', to: '2027-09-30' }),
    ],
    categories: {
      de: [
        { id: 10, name: 'F&T Vegan Elbe', reihenfolgeInApp: 10 },
        { id: 11, name: 'Topping 2', reihenfolgeInApp: 30 },
        { id: 12, name: 'Green Daily Salad 1', reihenfolgeInApp: 110 },
        { id: 13, name: 'Green Daily Salad 2', reihenfolgeInApp: 120 },
        { id: 20, name: 'Spezial des Tages ', reihenfolgeInApp: 1 },
        { id: 21, name: 'Lust auf Suppe Groß Bistro', reihenfolgeInApp: 2 },
        { id: 30, name: 'Backwaren', reihenfolgeInApp: 1 },
        { id: 31, name: 'Heißgetränke', reihenfolgeInApp: 1 },
        { id: 32, name: 'Vegetarisch', reihenfolgeInApp: 1 },
        { id: 33, name: 'Obstsalate', reihenfolgeInApp: 1 },
      ].map((c) => ({ ...c, gerichtkategorieID: c.id, languageTypeID: 1 })),
      en: [{ id: 900, name: 'Fresh & Tasty vegan', gerichtkategorieID: 10, languageTypeID: 2 }],
    },
    allergens: {
      de: [
        { id: 42, name: 'GLUTENHALTIGES GETREIDE', kuerzel: 'A' },
        { id: 43, name: 'WEIZEN', kuerzel: 'AA' },
        { id: 132, name: 'FISCH UND FISCHERZEUGNISSE', kuerzel: 'C' },
        { id: 58, name: 'FISCH UND ERZEUGNISSE', kuerzel: 'C' },
        { id: 131, name: 'Chefs Culinar keine deklarationspflichtigen Allergene', kuerzel: 'X99' },
      ],
      en: [
        { id: 108, name: 'cereals containing gluten', kuerzel: 'ccg', allergeneID: 42 },
        { id: 132, name: 'FISCH UND FISCHERZEUGNISSE', kuerzel: 'C', allergeneID: 132 },
        { id: 110, name: 'fish and fish products', kuerzel: 'ffp', allergeneID: 58 },
      ],
    },
    additives: { de: [{ id: 69, name: 'keine', kuerzel: 'NON' }], en: [] },
    features: {
      de: [
        { id: 11, name: 'Vegan' },
        { id: 25, name: 'Vegetarisch' },
        { id: 15, name: 'Rind' },
        { id: 16, name: 'Schwein' },
        { id: 17, name: 'Geflügel' },
        { id: 48, name: 'Klimafreundlich' },
      ],
      en: [{ id: 41, name: 'vegan', gerichtmerkmalID: 11 }],
    },
  };
}

test('station names lose running numbers and outlet suffixes', () => {
  const words = new Set(['bistro', 'boulevard', 'elbe', 'bonprix']);
  assert.equal(stationName('Green Daily Salad 3', words), 'Green Daily Salad');
  assert.equal(stationName('F&T Vegan Elbe', words), 'F&T Vegan');
  assert.equal(stationName('Lust auf Suppe Groß Bistro', words), 'Lust auf Suppe Groß');
  assert.equal(stationName('Kochwerk Klassiker', words), 'Kochwerk Klassiker');
  assert.equal(stationName('Elbe', words), 'Elbe');
});

test('menu names are cleaned and translated word by word', () => {
  const words = new Set(['bistro', 'boulevard']);
  assert.deepEqual(menuName('Sortiment Bistro Boulevard 1', words), { de: 'Sortiment', en: 'Assortment' });
  assert.deepEqual(menuName('Fruehstueck_Boulevard', words), { de: 'Frühstück', en: 'Breakfast' });
  assert.equal(menuName('Bistro Boulevard', words), null);
});

test('photos are proxied, and only from Kochwerk’s image host', () => {
  assert.equal(proxiedImage('https://kochwerk.konkaapps.de/KMSLiveRessources//speiseplangericht/a.jpg'), '/img/KMSLiveRessources/speiseplangericht/a.jpg');
  assert.equal(proxiedImage('https://evil.example/a.jpg'), null);
});

test('dated menus: grouped into stations per outlet and day', () => {
  const doc = normalize(fixture(), '2026-09-30');
  assert.deepEqual(doc.days, ['2026-09-30', '2026-10-01']);
  const elbe = doc.menus[4]['2026-09-30'];
  assert.deepEqual(
    elbe.map((s) => s.name.de),
    ['F&T Vegan', 'Topping', 'Green Daily Salad'],
  );
  assert.equal(elbe[0].name.en, 'Fresh & Tasty vegan');
  // "Green Daily Salad 1" and "… 2" are one station, in their own order.
  assert.deepEqual(elbe[2].dishes.map((d) => d.name.de), ['Vegetarischer Blattsalat', 'Veganer Antipasti Salat']);
  // Inactive dishes and weekend days are left out.
  assert.ok(!elbe.flatMap((s) => s.dishes).some((d) => d.name.de === 'Gestrichen'));
  assert.equal(doc.menus[4]['2026-10-03'], undefined);
  // The 2021 backup plan is outside the window.
  assert.ok(!doc.days.includes('2021-09-01'));
});

test('dishes: diet, allergens, notes, photos, prices', () => {
  const doc = normalize(fixture(), '2026-09-30');
  const all = Object.values(doc.menus).flatMap((byDate) => Object.values(byDate).flat().flatMap((s) => s.dishes));
  const find = (name) => all.find((d) => d.name.de === name);

  const chili = find('Veganes Chili mit Reis');
  assert.equal(chili.diet, 'vegan');
  assert.deepEqual(chili.feats, ['vegan', 'climate']);
  assert.deepEqual(chili.allergens, ['A', 'AA']);
  assert.deepEqual(chili.co2, { g: 805, rating: 'A' });
  assert.equal(chili.image, '/img/KMSLiveRessources/speiseplangericht/20260930_PLU2508.jpg');
  assert.equal(chili.price, 4.5);

  // Fish is known from the allergen, not a feature.
  const plaice = find('Gebratenes Schollenfilet');
  assert.equal(plaice.diet, 'fish');
  assert.equal(plaice.image, undefined);

  // Till shorthand in the English name falls back to German; no English note leaks into German.
  const goulash = find('Putengulasch mit Reis');
  assert.equal(goulash.name.en, 'Putengulasch mit Reis');
  assert.equal(goulash.note, undefined);
  assert.equal(goulash.diet, 'poultry');

  const soup = find('Vegane Rote Bete Suppe');
  assert.deepEqual(soup.note, { de: 'Kleine Portion 1,80 €', en: 'Small portion 1,50 €' });

  // "Nothing to declare" isn't an allergen; a zero price is no price.
  const meatballs = find('6 Fleischklösschen');
  assert.deepEqual(meatballs.allergens, []);
  assert.equal(meatballs.price, undefined);
  assert.equal(meatballs.diet, 'beef');
});

test('assortments: screen-only plans merge, duplicates and inactive plans drop', () => {
  const doc = normalize(fixture(), '2026-09-30');
  const boulevard = doc.assortments[2];
  assert.equal(boulevard.length, 1);
  assert.deepEqual(boulevard[0].name, { de: 'Sortiment', en: 'Assortment' });
  const names = boulevard[0].sections.flatMap((s) => s.dishes.map((d) => d.name.de));
  assert.deepEqual(names.sort(), ['Cappuccino', 'Croissant', 'Haribo']);
  assert.ok(!names.includes('Obstsalat'));
});

test('outlets: sorted, hours parsed, bilingual note split', () => {
  const doc = normalize(fixture(), '2026-09-30');
  assert.deepEqual(doc.outlets.map((o) => o.name), ['Kochwerk Elbe', 'Bistro Boulevard', 'Steelrunner']);
  const elbe = doc.outlets[0];
  assert.deepEqual(elbe.hours[0], [['11:30', '14:00']]);
  assert.deepEqual(elbe.hours[2], [['07:30', '10:00'], ['11:30', '14:00']]);
  assert.deepEqual(elbe.hours[4], [['11:30', '13:30']]);
  assert.deepEqual(elbe.hours[5], []);
  assert.equal(elbe.image, '/img/KMSLiveRessources/outlet/4.jpg');
  assert.deepEqual(doc.outlets[2].note, {
    de: 'Ob der Steelrunner heute geöffnet ist, erfährst Du im Intranet',
    en: 'check our website for opening times',
  });
});

test('allergen names: calmer case, and the translated duplicate wins', () => {
  const doc = normalize(fixture(), '2026-09-30');
  assert.deepEqual(doc.meta.allergens.A, { de: 'Glutenhaltiges Getreide', en: 'cereals containing gluten' });
  assert.equal(doc.meta.allergens.C.en, 'fish and fish products');
  assert.equal(doc.meta.allergens.X99, undefined);
  assert.equal(doc.meta.additives.NON, undefined);
});
