<script lang="ts">
  import { tick } from 'svelte';
  import Search from '@lucide/svelte/icons/search';
  import Heart from '@lucide/svelte/icons/heart';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import MapPin from '@lucide/svelte/icons/map-pin';
  import Languages from '@lucide/svelte/icons/languages';
  import SunMoon from '@lucide/svelte/icons/sun-moon';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import Settings2 from '@lucide/svelte/icons/settings-2';
  import { formatPrice, formatShortDate, l, locale, setLocale, t, weekdayShort } from '../lib/i18n/index.svelte';
  import type { Dish, Section } from '../lib/data/types';
  import { app, defaultDate, dayList, openDish, setDate, setOutlet, shortName } from '../lib/state/app.svelte';
  import { favoriteKey, settings } from '../lib/state/settings.svelte';
  import { toggleTheme } from '../lib/state/theme.svelte';
  import { addDays } from '../lib/time';
  import Plate from './Plate.svelte';
  import Sheet from './Sheet.svelte';

  type Hit = { dish: Dish; section: Section; outletId: number; date: string | null; text: string; also?: (string | null)[] };
  type Item =
    | { kind: 'dish'; hit: Hit }
    | { kind: 'action'; id: string; label: string; sub?: string; icon: typeof Search; run: () => void };

  let query = $state('');
  let active = $state(0);
  let input: HTMLInputElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();

  const fold = (text: string) =>
    text
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '');

  /** Every dish of both weeks at every outlet, plus the everyday assortments. */
  const index = $derived.by(() => {
    const doc = app.doc;
    if (!doc) return [] as Hit[];
    const hits: Hit[] = [];
    const add = (outletId: number, date: string | null, sections: Section[]) => {
      const outlet = doc.outlets.find((o) => o.id === outletId);
      for (const section of sections)
        for (const dish of section.dishes)
          hits.push({ dish, section, outletId, date, text: fold([dish.name.de, dish.name.en, section.name.de, section.name.en, outlet?.name ?? ''].join(' ')) });
    };
    for (const [outletId, byDate] of Object.entries(doc.menus)) for (const [date, sections] of Object.entries(byDate)) add(Number(outletId), date, sections);
    for (const [outletId, menus] of Object.entries(doc.assortments)) for (const menu of menus) add(Number(outletId), null, menu.sections);
    return hits;
  });

  function score(hit: Hit, tokens: string[]): number {
    const name = fold(l(hit.dish.name));
    let s = 0;
    for (const token of tokens) {
      if (name.startsWith(token)) s += 6;
      else if (new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name)) s += 4;
      else if (name.includes(token)) s += 2;
      else s += 1;
    }
    // Upcoming beats past, soon beats later, the menu beats the assortment.
    if (hit.date == null) s -= 1.5;
    else if (hit.date < app.now.date) s -= 3;
    else s -= (Date.parse(hit.date) - Date.parse(app.now.date)) / 86_400_000 / 20;
    return s;
  }

  /** Best matches first; a dish served on several days is one row per outlet, listing its days. */
  const results = $derived.by(() => {
    const tokens = fold(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return [] as Hit[];
    const matches = index
      .filter((hit) => tokens.every((token) => hit.text.includes(token)))
      .map((hit) => ({ hit, s: score(hit, tokens) }))
      .sort((a, b) => b.s - a.s);
    const rows = new Map<string, Hit>();
    for (const { hit } of matches) {
      const key = `${fold(hit.dish.name.de)}:${hit.outletId}`;
      const row = rows.get(key);
      if (row) row.also!.push(hit.date);
      else rows.set(key, { ...hit, also: [] });
    }
    return [...rows.values()].slice(0, 30);
  });

  /** Favourites that are on some menu today or later. */
  const favorites = $derived.by(() => {
    if (!settings.favorites.length) return [] as Hit[];
    const seen = new Set<string>();
    return index
      .filter((h) => h.date && h.date >= app.now.date && settings.favorites.includes(favoriteKey(h.dish.name.de)))
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))
      .filter((h) => {
        const key = `${h.dish.name.de}:${h.date}:${h.outletId}`;
        return !seen.has(key) && seen.add(key);
      })
      .slice(0, 8);
  });

  const actions = $derived.by((): Item[] => {
    const doc = app.doc;
    if (!doc) return [];
    const today = defaultDate(doc);
    const days = dayList(doc);
    const tomorrow = days.find((d) => d > today);
    const out: Item[] = [
      { kind: 'action', id: 'today', label: t('common.today'), sub: weekdayShort(today) + ' ' + formatShortDate(today), icon: CalendarDays, run: () => setDate(today) },
    ];
    if (tomorrow) out.push({ kind: 'action', id: 'tomorrow', label: tomorrow === addDays(today, 1) ? t('common.tomorrow') : weekdayShort(tomorrow), sub: formatShortDate(tomorrow), icon: CalendarDays, run: () => setDate(tomorrow) });
    for (const outlet of doc.outlets) {
      out.push({ kind: 'action', id: `outlet-${outlet.id}`, label: outlet.name, icon: MapPin, run: () => setOutlet(outlet.id) });
    }
    out.push(
      { kind: 'action', id: 'favorites', label: t('favorites.title'), icon: Heart, run: () => (app.favorites = true) },
      { kind: 'action', id: 'filters', label: t('settings.filters'), icon: SlidersHorizontal, run: () => (app.settings = 'filters') },
      { kind: 'action', id: 'settings', label: t('settings.title'), icon: Settings2, run: () => (app.settings = 'general') },
      { kind: 'action', id: 'lang', label: t('common.switchLanguage'), icon: Languages, run: () => setLocale(locale() === 'de' ? 'en' : 'de') },
      { kind: 'action', id: 'theme', label: t('common.theme'), icon: SunMoon, run: toggleTheme },
    );
    return out;
  });

  const outletsMatching = $derived.by((): Item[] => {
    const q = fold(query.trim());
    if (!q) return [];
    return actions.filter((a) => a.kind === 'action' && a.id.startsWith('outlet-') && fold(a.label).includes(q));
  });

  const items = $derived<Item[]>(
    query.trim()
      ? [...outletsMatching, ...results.map((hit) => ({ kind: 'dish' as const, hit }))]
      : [...favorites.map((hit) => ({ kind: 'dish' as const, hit })), ...actions],
  );

  $effect(() => {
    void query;
    active = 0;
  });

  $effect(() => {
    if (app.palette) {
      query = '';
      void tick().then(() => input?.focus());
    }
  });

  async function choose(item: Item | undefined) {
    if (!item) return;
    app.palette = false;
    if (item.kind === 'action') {
      item.run();
      return;
    }
    const { hit } = item;
    setOutlet(hit.outletId);
    if (hit.date) setDate(hit.date);
    await tick();
    openDish(hit.dish.id);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const n = items.length;
      if (!n) return;
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + n) % n;
      void tick().then(() => list?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void choose(items[active]);
    }
  }

  const outletName = (id: number) => shortName(app.doc?.outlets.find((o) => o.id === id)?.name ?? '');
  /** "Today, Thu 1 Oct +2": the row's own day, then the next others. */
  function whenList(hit: Hit): string {
    const others = (hit.also ?? []).filter((d) => d && d >= app.now.date && d !== hit.date).sort() as string[];
    const shown = [whenLabel(hit.date), ...others.slice(0, 1).map(whenLabel)].join(', ');
    return others.length > 1 ? `${shown} +${others.length - 1}` : shown;
  }
  const whenLabel = (date: string | null) => (date == null ? t('menu.assortment') : date === app.now.date ? t('common.today') : `${weekdayShort(date)} ${formatShortDate(date)}`);
</script>

<Sheet open={app.palette} onclose={() => (app.palette = false)} label={t('palette.label')} top wide>
  <div class="palette">
    <label class="field">
      <Search size={18} />
      <input
        bind:this={input}
        bind:value={query}
        {onkeydown}
        type="search"
        placeholder={t('palette.placeholder')}
        aria-label={t('palette.label')}
        autocomplete="off"
        spellcheck="false"
        enterkeyhint="search"
      />
      <span class="kbd">esc</span>
    </label>

    <div class="list" bind:this={list} role="listbox" aria-label={t('palette.results')}>
      {#if !query.trim() && favorites.length}
        <p class="group label"><Heart size={11} fill="currentColor" /> {t('palette.favorites')}</p>
      {:else if query.trim() && results.length}
        <p class="group label">{t('palette.results')} · <span class="hint">{t('palette.hint')}</span></p>
      {/if}

      {#each items as item, i (item.kind === 'dish' ? `d${item.hit.dish.id}:${item.hit.outletId}:${item.hit.date}` : item.id)}
        {#if item.kind === 'action' && (i === 0 || items[i - 1].kind === 'dish') && !query.trim()}
          <p class="group label">{t('palette.jump')}</p>
        {/if}
        <button
          class="item"
          role="option"
          aria-selected={i === active}
          data-active={i === active}
          onpointermove={() => (active = i)}
          onclick={() => choose(item)}
        >
          {#if item.kind === 'dish'}
            {@const hit = item.hit}
            <span class="thumb" data-diet={hit.dish.diet ?? 'none'}>
              {#if hit.dish.image}
                <img src={hit.dish.thumb ?? hit.dish.image} alt="" loading="lazy" decoding="async" />
              {:else}
                <Plate name={hit.dish.name.de} diet={hit.dish.diet} size={36} />
              {/if}
            </span>
            <span class="text">
              <span class="title">{l(hit.dish.name)}</span>
              <span class="sub">{whenList(hit)} · {outletName(hit.outletId)} · {l(hit.section.name)}</span>
            </span>
            {#if hit.dish.price}<span class="price tabular">{formatPrice(hit.dish.price)}</span>{/if}
          {:else}
            {@const Icon = item.icon}
            <span class="thumb icon"><Icon size={16} /></span>
            <span class="text">
              <span class="title">{item.label}</span>
            </span>
            {#if item.sub}<span class="price">{item.sub}</span>{/if}
          {/if}
        </button>
      {/each}

      {#if query.trim() && !items.length}
        <p class="none">{t('palette.empty', { query: query.trim() })}</p>
      {/if}
    </div>

    <div class="foot" aria-hidden="true">
      <span><span class="kbd">↑</span><span class="kbd">↓</span> {t('palette.navigate')}</span>
      <span><span class="kbd">↵</span> {t('palette.open')}</span>
    </div>
  </div>
</Sheet>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    max-height: min(80dvh, 640px);
  }
  .field {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 6px 14px 0;
    padding: 0 12px 0 14px;
    height: 52px;
    border-radius: 16px;
    background: var(--fill);
    border: 1px solid var(--line);
    color: var(--fg-3);
  }
  .field:focus-within {
    border-color: var(--line-strong);
    background: var(--fill-2);
  }
  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: 0;
    background: none;
    font-size: 16px;
    color: var(--fg);
  }
  input::placeholder {
    color: var(--fg-4);
  }
  input::-webkit-search-cancel-button {
    display: none;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px 8px 8px;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 14px 12px 6px;
  }
  .hint {
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--font-sans);
    color: var(--fg-4);
  }
  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 12px;
    text-align: left;
  }
  .item[data-active='true'] {
    background: var(--fill-2);
  }
  .thumb {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    flex: none;
    border-radius: 10px;
    overflow: hidden;
    color: var(--fg-2);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .thumb.icon {
    background: var(--fill-2);
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .title {
    font-size: 14.5px;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 12px;
    color: var(--fg-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .price {
    flex: none;
    font-size: 13px;
    color: var(--fg-2);
  }
  .none {
    padding: 28px 12px;
    text-align: center;
    color: var(--fg-3);
    font-size: 14px;
  }
  .foot {
    display: flex;
    gap: 16px;
    padding: 10px 18px 14px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--fg-3);
  }
  .foot > span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  @media (max-width: 719px) {
    .foot,
    .field .kbd {
      display: none;
    }
    .palette {
      height: 100%;
      max-height: none;
    }
  }
</style>
