<script lang="ts">
  import { formatPrice, l, t, tn } from '../lib/i18n/index.svelte';
  import { fit } from '../lib/data/labels';
  import type { Dish } from '../lib/data/types';
  import { app, openDish, sectionsFor, setOutlet } from '../lib/state/app.svelte';
  import { settings } from '../lib/state/settings.svelte';

  // Every outlet's menu for the day in one list: the outlet, each dish, its price. Nothing else;
  // the full outlet tab is one tap away. Filters still apply, so "what's vegan anywhere today"
  // is the diet switch plus this page.

  const outlets = $derived(
    (app.doc?.outlets ?? []).map((outlet) => {
      const dishes = sectionsFor(outlet.id, app.date).flatMap((section) => section.dishes);
      return { outlet, dishes: settings.hide ? dishes.filter((d) => fit(d, app.doc).ok) : dishes, total: dishes.length };
    }),
  );

  const dimmed = (dish: Dish) => !fit(dish, app.doc).ok;
</script>

<div class="overview">
  {#each outlets as { outlet, dishes, total } (outlet.id)}
    <section class="outlet" aria-labelledby="ov-{outlet.id}">
      <header>
        <h2 id="ov-{outlet.id}">{outlet.name}</h2>
        <button class="full" onclick={() => setOutlet(outlet.id)}>{t('overview.full')} <span aria-hidden="true">→</span></button>
      </header>
      {#if dishes.length}
        <ul>
          {#each dishes as dish (dish.id)}
            <li>
              <button class="row" class:dim={dimmed(dish)} onclick={() => openDish(dish.id)}>
                <span class="name">{l(dish.name)}</span>
                {#if dish.price}<span class="price tabular">{formatPrice(dish.price)}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="none">{total ? tn('filter.hidden', total) : t('overview.noMenu')}</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .overview {
    display: grid;
    gap: 28px;
  }
  @media (min-width: 760px) {
    .overview {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 36px 32px;
      align-items: start;
    }
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line-strong);
  }
  h2 {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 480;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .full {
    flex: none;
    font-size: 12.5px;
    color: var(--fg-3);
    white-space: nowrap;
  }
  .full:hover {
    color: var(--fg);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li + li {
    border-top: 1px solid var(--line);
  }
  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: 10px 0;
    text-align: left;
    transition: opacity 300ms var(--ease);
  }
  .row:hover .name {
    text-decoration: underline;
    text-decoration-color: var(--line-strong);
    text-underline-offset: 3px;
  }
  .row.dim {
    opacity: 0.38;
  }
  .name {
    font-size: 15px;
    line-height: 1.35;
    color: var(--fg);
  }
  .price {
    flex: none;
    font-size: 14px;
    color: var(--fg-2);
  }
  .none {
    padding: 12px 0;
    font-size: 13.5px;
    color: var(--fg-3);
  }
</style>
