<script lang="ts">
  import Heart from '@lucide/svelte/icons/heart';
  import { formatNumber, formatPrice, l } from '../lib/i18n/index.svelte';
  import { dietName, fit } from '../lib/data/labels';
  import type { Dish } from '../lib/data/types';
  import { app, openDish } from '../lib/state/app.svelte';
  import { isFavorite, settings } from '../lib/state/settings.svelte';
  import Plate from './Plate.svelte';

  let { dish, compact = false, index = 0 }: { dish: Dish; compact?: boolean; index?: number } = $props();

  const fits = $derived(fit(dish, app.doc));
  const favorite = $derived(isFavorite(dish.name.de));
  /** The simplified view (Settings): a diet dot, the name and the price; the sheet has the rest. */
  const simple = $derived(settings.simple);
  let imageFailed = $state(false);
  let imageLoaded = $state(false);
</script>

<button
  class="dish"
  class:compact
  class:simple
  class:dim={!fits.ok}
  class:favorite
  data-diet={dish.diet ?? 'none'}
  style:--n={index}
  onclick={() => openDish(dish.id)}
>
  {#if !simple}<span class="media">
    {#if dish.image && !imageFailed && !compact}
      <img
        src={dish.thumb ?? dish.image}
        alt=""
        width="84"
        height="84"
        loading="lazy"
        decoding="async"
        class:loaded={imageLoaded}
        onload={() => (imageLoaded = true)}
        onerror={() => (imageFailed = true)}
      />
      {#if !imageLoaded}
        <span class="placeholder"><Plate name={dish.name.de} diet={dish.diet} size={compact ? 40 : 64} /></span>
      {/if}
    {:else}
      <Plate name={dish.name.de} diet={dish.diet} size={compact ? 40 : 64} />
    {/if}
  </span>{/if}

  <span class="body">
    <span class="name">
      {#if simple}<i class="dot" aria-hidden="true"></i>{/if}{l(dish.name)}{#if simple && favorite}<span class="fav inline" aria-hidden="true"><Heart size={11} fill="currentColor" /></span>{/if}
    </span>
    {#if l(dish.note) && !simple}
      <span class="note">{l(dish.note)}</span>
    {/if}
    {#if !compact && !simple}
      <span class="meta">
        {#if dish.diet}
          <span class="diet"><i aria-hidden="true"></i>{dietName(dish.diet)}</span>
        {/if}
        {#if dish.co2?.rating}
          <span class="co2" data-co2={dish.co2.rating} title="CO₂ {dish.co2.g} g"><b>{dish.co2.rating}</b>CO₂</span>
        {/if}
        {#if dish.nutrition}
          <span class="kcal tabular">{formatNumber(dish.nutrition.kcal)} kcal</span>
        {/if}
        {#if favorite}
          <span class="fav" aria-hidden="true"><Heart size={12} fill="currentColor" /></span>
        {/if}
      </span>
    {/if}
    {#if !fits.ok && !simple}
      <span class="why">{fits.reasons.join(' · ')}</span>
    {/if}
  </span>

  <span class="price tabular">
    {#if dish.price}{formatPrice(dish.price)}{/if}
  </span>
</button>

<style>
  /* Scrolling moves rows under a resting cursor, so hover must never repaint a row: the
     highlight is its own layer that only fades (compositor work), and nothing inside the row
     transitions a paint property. */
  .dish {
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 16px;
    padding: 14px 12px;
    margin: 0 -12px;
    width: calc(100% + 24px);
    text-align: left;
    transition: opacity 300ms var(--ease);
    animation: rise 520ms var(--ease-out) backwards;
    animation-delay: calc(min(var(--n), 12) * 32ms);
  }
  .dish::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: var(--r-lg);
    background: var(--fill-2);
    opacity: 0;
  }
  /* Effects ease in on hover but drop instantly when it ends, so the moment scrolling starts
     (and hover is paused, see src/lib/scrolling.ts) costs nothing. */
  .dish:hover::before {
    opacity: 0.6;
    transition: opacity 180ms var(--ease);
  }
  .dish:active::before {
    opacity: 1;
  }
  .dish.dim {
    opacity: 0.42;
  }
  .dish.dim .media {
    filter: grayscale(0.8);
  }
  .dish.dim:hover {
    opacity: 0.8;
  }

  .media {
    position: relative;
    display: grid;
    place-items: center;
    width: 68px;
    height: 68px;
    border-radius: 18px;
    overflow: hidden;
    flex: none;
  }
  .media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 400ms var(--ease);
  }
  .media img.loaded {
    opacity: 1;
  }
  .media :global(.plate) {
    width: 94%;
    height: 94%;
  }
  /* Whole-element transforms only: the compositor scales the already-painted layer. */
  .dish:hover .media img.loaded,
  .dish:hover .media :global(.plate) {
    scale: 1.07;
    transition: scale 500ms var(--ease-out);
  }
  .placeholder {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }
  /* A photo's frame: a hairline ring in the dish's colour. */
  .media:has(img.loaded)::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px oklch(1 0 0 / 0.08);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .name {
    font-size: 16px;
    font-weight: 500;
    line-height: 1.32;
    letter-spacing: -0.01em;
    color: var(--fg);
    text-wrap: pretty;
  }
  .note {
    font-size: 13px;
    color: var(--fg-3);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin-top: 4px;
    font-size: 12.5px;
    color: var(--fg-3);
  }
  .diet {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--fg-2);
  }
  .diet i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--diet);
  }
  .co2 {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
  }
  .co2 b {
    display: inline-grid;
    place-items: center;
    width: 17px;
    height: 17px;
    border-radius: 5px;
    background: oklch(from var(--co2) l c h / 0.16);
    color: var(--co2);
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
  }
  .fav {
    display: inline-flex;
    color: var(--danger);
  }
  .why {
    margin-top: 2px;
    font-size: 12px;
    color: var(--fg-2);
    font-weight: 500;
  }

  .price {
    align-self: start;
    padding-top: 2px;
    font-size: 14.5px;
    font-weight: 500;
    color: var(--fg);
    white-space: nowrap;
  }

  .compact {
    gap: 14px;
    padding: 9px 12px;
  }

  .simple {
    grid-template-columns: 1fr auto;
    align-items: baseline;
    padding-block: 11px;
  }
  /* Hanging indent: a wrapped name lines up under its first word, not under the dot. */
  .simple .name {
    font-weight: 450;
    padding-left: 18px;
    text-indent: -18px;
  }
  .simple .price {
    padding: 0;
    color: var(--fg-2);
  }
  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin: 0 10px 0 1px;
    text-indent: 0;
    border-radius: 50%;
    background: var(--diet);
    vertical-align: 0.12em;
  }
  .fav.inline {
    margin-left: 8px;
    vertical-align: -0.05em;
  }
  .compact .media {
    width: 42px;
    height: 42px;
    border-radius: 12px;
  }
  .compact .name {
    font-size: 14.5px;
    font-weight: 450;
  }
  .compact .price {
    align-self: center;
    padding: 0;
    font-size: 13.5px;
    color: var(--fg-2);
  }

  @media (min-width: 1000px) {
    .media {
      width: 84px;
      height: 84px;
      border-radius: 22px;
    }
    .name {
      font-size: 17px;
    }
    .dish {
      gap: 20px;
      padding: 16px 16px;
      margin: 0 -16px;
      width: calc(100% + 32px);
    }
    .simple {
      padding-block: 12px;
    }
  }
</style>
