<script lang="ts">
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import { t, tn } from '../lib/i18n/index.svelte';
  import { allergenName } from '../lib/data/labels';
  import { app, sectionsFor } from '../lib/state/app.svelte';
  import { settings, type DietFilter } from '../lib/state/settings.svelte';

  const options: { value: DietFilter; key: 'filter.all' | 'filter.vegetarian' | 'filter.vegan' }[] = [
    { value: 'all', key: 'filter.all' },
    { value: 'vegetarian', key: 'filter.vegetarian' },
    { value: 'vegan', key: 'filter.vegan' },
  ];

  const total = $derived(sectionsFor(app.outletId, app.date).reduce((n, s) => n + s.dishes.length, 0));
  const avoidLabel = $derived(settings.avoid.length ? settings.avoid.map((code) => allergenName(code, app.doc)).join(', ') : t('filter.allergens'));
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
    <button class="toggle" aria-pressed={settings.noPork} onclick={() => (settings.noPork = !settings.noPork)}>{t('filter.noPork')}</button>
    <button class="toggle more" aria-pressed={settings.avoid.length > 0} onclick={() => (app.filters = true)}>
      <SlidersHorizontal size={14} />
      <span class="avoid">{avoidLabel}</span>
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
  .toggle[aria-pressed='true'] {
    background: var(--invert);
    border-color: transparent;
    color: var(--invert-ink);
  }
  .avoid {
    overflow: hidden;
    text-overflow: ellipsis;
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
