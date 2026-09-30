<script lang="ts">
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import { t, tn } from '../lib/i18n/index.svelte';
  import { app, isOverview, sectionsFor } from '../lib/state/app.svelte';
  import { filtersActive, settings, type DietFilter } from '../lib/state/settings.svelte';

  const options: { value: DietFilter; key: 'filter.all' | 'filter.vegetarian' | 'filter.vegan' }[] = [
    { value: 'all', key: 'filter.all' },
    { value: 'vegetarian', key: 'filter.vegetarian' },
    { value: 'vegan', key: 'filter.vegan' },
  ];

  const total = $derived(
    (isOverview() ? (app.doc?.outlets ?? []).map((o) => o.id) : [app.outletId]).reduce<number>(
      (n, id) => n + sectionsFor(id, app.date).reduce((m, s) => m + s.dishes.length, 0),
      0,
    ),
  );
  const active = $derived(filtersActive());
</script>

<div class="bar">
  <div class="scroll-x chips" role="group" aria-label={t('filter.label')}>
    <div class="seg" role="radiogroup">
      {#each options as option (option.value)}
        <button
          class="seg-btn"
          role="radio"
          aria-checked={settings.diet === option.value}
          data-diet={option.value === 'all' ? 'none' : option.value}
          onclick={() => (settings.diet = option.value)}
        >
          {#if option.value !== 'all'}<i aria-hidden="true"></i>{/if}
          {t(option.key)}
        </button>
      {/each}
    </div>
    <!-- Allergens, no pork and hide-or-dim live in Settings; this opens it right there. -->
    <button class="toggle" class:on={active > 0} onclick={() => (app.settings = 'filters')}>
      <SlidersHorizontal size={14} />
      {t('filter.button')}
      {#if active}<span class="badge tabular">{active}</span>{/if}
    </button>
  </div>
  {#if total}
    <span class="count">{tn('menu.dishes', total)}</span>
  {/if}
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .chips {
    flex: 1;
    gap: 6px;
    align-items: center;
    min-width: 0;
    padding: 2px var(--gutter);
    margin: 0 calc(var(--gutter) * -1);
    mask-image: linear-gradient(to right, transparent 0, #000 var(--gutter), #000 calc(100% - var(--gutter)), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0, #000 var(--gutter), #000 calc(100% - var(--gutter)), transparent 100%);
  }

  .seg {
    display: inline-flex;
    flex: none;
    padding: 2px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--fill);
  }
  .seg-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 11px;
    border-radius: 999px;
    font-size: 13px;
    color: var(--fg-2);
    white-space: nowrap;
    transition:
      background-color 200ms var(--ease),
      color 200ms var(--ease);
  }
  .seg-btn:hover {
    color: var(--fg);
  }
  .seg-btn[aria-checked='true'] {
    background: var(--fill-3);
    color: var(--fg);
  }
  .seg-btn i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--diet);
  }

  .toggle {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    max-width: 240px;
    padding: 0 13px;
    border-radius: 999px;
    border: 1px solid var(--line);
    font-size: 13px;
    color: var(--fg-2);
    white-space: nowrap;
    transition:
      background-color 200ms var(--ease),
      border-color 200ms var(--ease),
      color 200ms var(--ease);
  }
  .toggle:hover {
    color: var(--fg);
    border-color: var(--line-strong);
  }
  .toggle.on {
    border-color: var(--line-strong);
    color: var(--fg);
  }
  .badge {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--invert);
    color: var(--invert-ink);
    font-size: 11px;
    font-weight: 600;
  }

  .count {
    flex: none;
    font-size: 12.5px;
    color: var(--fg-3);
  }
  @media (max-width: 640px) {
    .count {
      display: none;
    }
  }
</style>
