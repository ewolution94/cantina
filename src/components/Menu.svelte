<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Heart from '@lucide/svelte/icons/heart';
  import { tick } from 'svelte';
  import { upcomingFavorites, type Occurrence } from '../lib/data/occurrences';
  import { formatDay, l, t, tn, weekdayLong } from '../lib/i18n/index.svelte';
  import { fit } from '../lib/data/labels';
  import type { Dish, Section } from '../lib/data/types';
  import { app, assortmentsFor, dayList, isOverview, openDish, outlet, sectionsFor, setDate, setOutlet, shortName, stepDay } from '../lib/state/app.svelte';
  import { favoriteKey, settings } from '../lib/state/settings.svelte';
  import DishRow from './DishRow.svelte';
  import Overview from './Overview.svelte';
  import Plate from './Plate.svelte';

  const sections = $derived(sectionsFor(app.outletId, app.date));
  const assortments = $derived(assortmentsFor(app.outletId, app.date));
  const current = $derived(outlet());
  let showAll = $state(false);

  // Which way the new day slides in from.
  let direction = $state(0);
  let lastDate = '';
  let lastOutlet = -1;
  $effect.pre(() => {
    const outlets = app.doc?.outlets ?? [];
    // The Overview pill sits left of every outlet (index -1).
    const outletIndex = outlets.findIndex((o) => o.id === app.outletId);
    const lastIndex = outlets.findIndex((o) => o.id === lastOutlet);
    if (lastDate && app.date !== lastDate) direction = app.date > lastDate ? 1 : -1;
    else if (lastOutlet !== -1 && app.outletId !== lastOutlet) direction = outletIndex > lastIndex ? 1 : -1;
    lastDate = app.date;
    lastOutlet = app.outletId ?? -1;
    showAll = false;
  });

  const visible = (dishes: Dish[]) => (settings.hide && !showAll ? dishes.filter((d) => fit(d, app.doc).ok) : dishes);
  /** Dishes on this day that the filter dims or hides, said up front so a filter never seems to do nothing. */
  const unfit = $derived(sections.reduce((n, s) => n + s.dishes.filter((d) => !fit(d, app.doc).ok).length, 0));
  const hiding = $derived(settings.hide && !showAll);
  const shown = $derived(sections.map((s) => ({ ...s, dishes: visible(s.dishes) })).filter((s) => s.dishes.length));
  const offsets = $derived(shown.reduce<number[]>((acc, s, i) => [...acc, i ? acc[i - 1] + shown[i - 1].dishes.length : 0], []));

  /** Other outlets with a menu on this day, and this outlet's next day with one: somewhere to go from an empty day. */
  const elsewhere = $derived(sections.length ? [] : (app.doc?.outlets ?? []).filter((o) => o.id !== app.outletId && sectionsFor(o.id, app.date).length));
  const nextDay = $derived(sections.length ? null : (dayList(app.doc).find((d) => d > app.date && sectionsFor(app.outletId, d).length) ?? null));

  /**
   * Favourites served at another outlet on this day (and not here too), grouped by outlet. Off
   * with the "point out favourites elsewhere" setting.
   */
  const favoritesElsewhere = $derived.by(() => {
    if (!settings.favoriteHint || !settings.favorites.length || !app.doc) return [];
    const here = new Set(sections.flatMap((s) => s.dishes.map((d) => favoriteKey(d.name.de))));
    const byOutlet = new Map<number, Occurrence[]>();
    for (const hits of upcomingFavorites(app.doc, settings.favorites, app.date).values()) {
      for (const hit of hits) {
        if (hit.date !== app.date || hit.outletId === app.outletId || here.has(favoriteKey(hit.dish.name.de))) continue;
        const list = byOutlet.get(hit.outletId) ?? [];
        if (!list.some((h) => h.dish.name.de === hit.dish.name.de)) list.push(hit);
        byOutlet.set(hit.outletId, list);
      }
    }
    return [...byOutlet.entries()].map(([outletId, hits]) => ({ outlet: app.doc!.outlets.find((o) => o.id === outletId)!, hits }));
  });

  async function goTo(hit: Occurrence) {
    setOutlet(hit.outletId);
    await tick();
    openDish(hit.dish.id);
  }

  const count = (list: Section[]) => list.reduce((n, s) => n + s.dishes.length, 0);

  // Swipe between days on touch screens: a clearly horizontal flick, not a scroll.
  let wrap: HTMLDivElement;
  $effect(() => {
    wrap.addEventListener('touchstart', ontouchstart, { passive: true });
    wrap.addEventListener('touchend', ontouchend, { passive: true });
    return () => {
      wrap.removeEventListener('touchstart', ontouchstart);
      wrap.removeEventListener('touchend', ontouchend);
    };
  });
  let touch: { x: number; y: number; t: number } | null = null;
  function ontouchstart(event: TouchEvent) {
    if (event.touches.length !== 1) return (touch = null);
    const target = event.target as HTMLElement;
    if (target.closest('.scroll-x, input, dialog')) return (touch = null);
    touch = { x: event.touches[0].clientX, y: event.touches[0].clientY, t: Date.now() };
  }
  function ontouchend(event: TouchEvent) {
    if (!touch) return;
    const dx = event.changedTouches[0].clientX - touch.x;
    const dy = event.changedTouches[0].clientY - touch.y;
    const quick = Date.now() - touch.t < 600;
    touch = null;
    if (quick && Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.8) stepDay(dx < 0 ? 1 : -1);
  }
</script>

<div class="menu-wrap" bind:this={wrap}>
  {#key `${app.outletId}:${app.date}`}
    <div class="menu" class:simple={settings.simple} in:fly={{ x: direction * 32, duration: direction ? 380 : 0, easing: cubicOut, opacity: 0 }}>
      {#if isOverview()}
        <Overview />
      {:else}
      {#each favoritesElsewhere as group (group.outlet.id)}
        <div class="fav-hint">
          <Heart size={14} fill="currentColor" />
          <p>
            {t('favorites.elsewhere', { outlet: shortName(group.outlet.name) })}
            {#each group.hits as hit, i (hit.dish.id)}
              {#if i}<span class="sep">·</span>{/if}
              <button onclick={() => goTo(hit)}>{l(hit.dish.name)}</button>
            {/each}
          </p>
        </div>
      {/each}
      {#if unfit && shown.length}
        <p class="filter-note">
          <span>{hiding ? tn('filter.hidden', unfit) : tn('filter.unfit', unfit)}</span>
          {#if hiding}<button onclick={() => (showAll = true)}>{t('filter.showAll')}</button>{/if}
        </p>
      {/if}
      {#if shown.length}
        {#each shown as section, si (section.id)}
          <section class="station" aria-labelledby="st-{section.id}">
            <header class="station-head">
              <span class="num tabular">{String(si + 1).padStart(2, '0')}</span>
              <h2 id="st-{section.id}">{l(section.name)}</h2>
              <span class="rule" aria-hidden="true"></span>
            </header>
            <div class="rows">
              {#each section.dishes as dish, i (dish.id)}
                <DishRow {dish} index={offsets[si] + i} />
              {/each}
            </div>
          </section>
        {/each}
      {:else if sections.length}
        <div class="empty">
          <p class="empty-title">{tn('filter.hidden', count(sections))}</p>
          <button class="btn btn-soft" onclick={() => (showAll = true)}>{t('filter.showAll')}</button>
        </div>
      {:else if current}
        <div class="empty">
          <div class="empty-plate" aria-hidden="true"><Plate name="empty-{current.name}" diet={null} size={96} /></div>
          <p class="empty-title">{t('menu.emptyTitle')}</p>
          <p class="empty-body">
            {app.doc?.menus[current.id] ? t('menu.emptyDay', { outlet: current.name, day: formatDay(app.date) }) : t('menu.emptyOutlet', { outlet: current.name })}
          </p>
          {#if elsewhere.length || nextDay}
            <div class="empty-actions">
              {#each elsewhere as other (other.id)}
                <button class="btn btn-soft" onclick={() => setOutlet(other.id)}>{shortName(other.name)}</button>
              {/each}
              {#if nextDay}
                <button class="btn btn-ghost" onclick={() => setDate(nextDay)}>{weekdayLong(nextDay)} →</button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      {#each assortments as assortment (assortment.id)}
        <details class="assortment" open={!sections.length}>
          <summary>
            <span class="label">{t('menu.assortment')}</span>
            <span class="a-name">{l(assortment.name)}</span>
            <span class="a-count">{tn('menu.items', count(assortment.sections))}</span>
            <ChevronDown size={18} class="chev" />
          </summary>
          <div class="a-body">
            {#each assortment.sections as section (section.id)}
              <h3 class="sub">{l(section.name)}</h3>
              <div class="rows">
                {#each visible(section.dishes) as dish (dish.id)}
                  <DishRow {dish} compact />
                {/each}
              </div>
            {/each}
          </div>
        </details>
      {/each}
      {/if}
    </div>
  {/key}
</div>

<style>
  .menu-wrap {
    display: grid;
    min-height: 50vh;
    touch-action: pan-y;
  }
  .menu {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    gap: 34px;
    min-width: 0;
  }

  .fav-hint {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: -14px;
    padding: 12px 14px;
    border-radius: 14px;
    background: color-mix(in oklch, var(--danger) 9%, transparent);
    color: var(--danger);
    font-size: 13.5px;
  }
  .fav-hint :global(svg) {
    flex: none;
    translate: 0 2px;
  }
  .fav-hint p {
    color: var(--fg-2);
    line-height: 1.5;
  }
  .fav-hint button {
    color: var(--fg);
    font-weight: 500;
    text-decoration: underline;
    text-decoration-color: var(--line-strong);
    text-underline-offset: 3px;
  }
  .fav-hint button:hover {
    text-decoration-color: currentColor;
  }
  .sep {
    margin: 0 6px;
    color: var(--fg-4);
  }

  .menu.simple {
    gap: 20px;
  }
  .station-head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 6px;
  }
  .num {
    font-size: 11px;
    color: var(--fg-4);
  }
  .station-head h2 {
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-2);
    white-space: nowrap;
  }
  .rule {
    flex: 1;
    height: 1px;
    align-self: center;
    background: var(--line);
  }
  .rows {
    display: flex;
    flex-direction: column;
  }

  .filter-note {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin: -16px 0 -12px;
    font-size: 13px;
    color: var(--fg-3);
  }
  .filter-note button {
    color: var(--fg);
    font-weight: 500;
    text-decoration: underline;
    text-decoration-color: var(--line-strong);
    text-underline-offset: 3px;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 36px 16px 12px;
  }
  .empty-plate {
    opacity: 0.8;
    margin-bottom: 18px;
  }
  .empty-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 480;
    letter-spacing: -0.02em;
  }
  .empty-body {
    margin-top: 6px;
    max-width: 36ch;
    color: var(--fg-3);
    font-size: 14px;
  }
  .empty-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 20px;
  }
  .empty > .btn {
    margin-top: 16px;
  }

  .assortment {
    border-top: 1px solid var(--line);
    padding-top: 6px;
  }
  .assortment summary {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: baseline;
    gap: 12px;
    padding: 12px 0;
    cursor: pointer;
    list-style: none;
  }
  .assortment summary::-webkit-details-marker {
    display: none;
  }
  .a-name {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 480;
    letter-spacing: -0.015em;
  }
  .a-count {
    font-size: 12.5px;
    color: var(--fg-3);
  }
  .assortment :global(.chev) {
    align-self: center;
    color: var(--fg-3);
    transition: rotate 300ms var(--ease-out);
  }
  .assortment[open] :global(.chev) {
    rotate: 180deg;
  }
  .a-body {
    padding-bottom: 8px;
  }
  .sub {
    margin: 18px 0 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--fg-3);
  }
  .sub:first-child {
    margin-top: 6px;
  }

  @media (max-width: 420px) {
    .assortment summary {
      grid-template-columns: 1fr auto auto;
    }
    .assortment summary .label {
      display: none;
    }
  }
</style>
