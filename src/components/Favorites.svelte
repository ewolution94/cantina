<script lang="ts">
  import { tick } from 'svelte';
  import Heart from '@lucide/svelte/icons/heart';
  import X from '@lucide/svelte/icons/x';
  import { formatPrice, formatShortDate, l, t, tn, weekdayShort } from '../lib/i18n/index.svelte';
  import { upcomingFavorites, type Occurrence } from '../lib/data/occurrences';
  import { app, openDish, setDate, setOutlet, shortName } from '../lib/state/app.svelte';
  import { settings, toggleFavorite } from '../lib/state/settings.svelte';
  import Plate from './Plate.svelte';
  import Sheet from './Sheet.svelte';

  const upcoming = $derived(upcomingFavorites(app.doc, settings.favorites, app.now.date));
  /** Soonest first, each favourite once. */
  const coming = $derived([...upcoming.entries()].sort(([, a], [, b]) => a[0].date!.localeCompare(b[0].date!)));
  const resting = $derived(settings.favorites.filter((key) => !upcoming.has(key)));

  const outletName = (id: number) => shortName(app.doc?.outlets.find((o) => o.id === id)?.name ?? '');
  const when = (date: string) => (date === app.now.date ? t('common.today') : `${weekdayShort(date)} ${formatShortDate(date)}`);
  const restingName = (key: string) => l(settings.favoriteNames[key]) || key.charAt(0).toUpperCase() + key.slice(1);

  async function go(hit: Occurrence) {
    app.favorites = false;
    setOutlet(hit.outletId);
    if (hit.date) setDate(hit.date);
    await tick();
    openDish(hit.dish.id);
  }

  const remove = (key: string) => toggleFavorite(settings.favoriteNames[key] ?? { de: key, en: key });
</script>

<Sheet open={app.favorites} onclose={() => (app.favorites = false)} label={t('favorites.title')}>
  <div class="favorites">
    <header>
      <h2>{t('favorites.title')}</h2>
      <button class="icon-btn" onclick={() => (app.favorites = false)} aria-label={t('common.close')}><X size={18} /></button>
    </header>

    {#if !settings.favorites.length}
      <div class="empty">
        <span class="empty-icon" aria-hidden="true"><Heart size={22} /></span>
        <p>{t('favorites.empty')}</p>
      </div>
    {/if}

    {#if coming.length}
      <h3 class="label">{t('favorites.upcoming')}</h3>
      <ul>
        {#each coming as [key, hits] (key)}
          {@const hit = hits[0]}
          <li>
            <button class="item" onclick={() => go(hit)}>
              <span class="thumb">
                {#if hit.dish.thumb ?? hit.dish.image}
                  <img src={hit.dish.thumb ?? hit.dish.image} alt="" loading="lazy" decoding="async" />
                {:else}
                  <Plate name={hit.dish.name.de} diet={hit.dish.diet} size={44} />
                {/if}
              </span>
              <span class="text">
                <span class="name">{l(hit.dish.name)}</span>
                <span class="sub">
                  <b class:today={hit.date === app.now.date}>{when(hit.date!)}</b> · {outletName(hit.outletId)}{#if hits.length > 1}{` · ${tn('favorites.more', hits.length - 1)}`}{/if}
                </span>
              </span>
              {#if hit.dish.price}<span class="price tabular">{formatPrice(hit.dish.price)}</span>{/if}
            </button>
            <button class="icon-btn unfav" onclick={() => remove(key)} aria-label={t('favorites.remove', { dish: l(hit.dish.name) })}>
              <Heart size={16} fill="currentColor" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if resting.length}
      <h3 class="label">{t('favorites.notOn')}</h3>
      <ul>
        {#each resting as key (key)}
          <li class="resting">
            <span class="name">{restingName(key)}</span>
            <button class="icon-btn unfav" onclick={() => remove(key)} aria-label={t('favorites.remove', { dish: restingName(key) })}>
              <Heart size={16} fill="currentColor" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</Sheet>

<style>
  .favorites {
    padding: 0 16px 20px;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 -16px;
    padding: 6px 12px 10px 22px;
    background: var(--panel-solid);
  }
  h2 {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 480;
    letter-spacing: -0.02em;
  }
  h3 {
    padding: 16px 6px 6px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 4px;
    border-top: 1px solid var(--line);
  }
  li:first-child {
    border-top: 0;
  }
  .item {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 6px;
    border-radius: 14px;
    text-align: left;
  }
  .item:hover {
    background: var(--fill);
  }
  .thumb {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    flex: none;
    border-radius: 12px;
    overflow: hidden;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.3;
  }
  .sub {
    font-size: 12.5px;
    color: var(--fg-3);
  }
  .sub b {
    font-weight: 500;
    color: var(--fg-2);
  }
  .sub b.today {
    color: var(--open);
  }
  .price {
    flex: none;
    font-size: 13.5px;
    color: var(--fg-2);
  }
  .unfav {
    color: var(--danger);
  }
  .resting {
    justify-content: space-between;
    padding: 6px 0 6px 6px;
  }
  .resting .name {
    color: var(--fg-2);
    font-weight: 450;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 30px 16px 16px;
    text-align: center;
  }
  .empty-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--fill-2);
    color: var(--fg-3);
  }
  .empty p {
    max-width: 34ch;
    font-size: 14px;
    color: var(--fg-3);
  }
</style>
