<script lang="ts">
  import Heart from '@lucide/svelte/icons/heart';
  import Share from '@lucide/svelte/icons/share';
  import X from '@lucide/svelte/icons/x';
  import { formatDay, formatNumber, formatPercent, formatPrice, l, t, weekdayLong } from '../lib/i18n/index.svelte';
  import { additiveName, allergenName, dietName, featureChips, fit } from '../lib/data/labels';
  import type { Dish } from '../lib/data/types';
  import { app, closeDish, findDish } from '../lib/state/app.svelte';
  import { isFavorite, toggleFavorite } from '../lib/state/settings.svelte';
  import { toast } from '../lib/state/toasts.svelte';
  import Plate from './Plate.svelte';
  import Sheet from './Sheet.svelte';

  // Keep showing the last dish while the sheet animates closed.
  let last = $state<ReturnType<typeof findDish>>(null);
  const found = $derived(findDish(app.dishId));
  $effect(() => {
    if (found) last = found;
  });
  const entry = $derived(found ?? last);
  const dish = $derived(entry?.dish ?? null);
  const where = $derived(entry ? app.doc?.outlets.find((o) => o.id === entry.outletId) : null);
  const favorite = $derived(dish ? isFavorite(dish.name.de) : false);
  const fits = $derived(dish ? fit(dish, app.doc) : { ok: true as const });
  let photoLoaded = $state(false);
  $effect(() => {
    void dish?.id;
    photoLoaded = false;
  });

  const RATINGS = ['A', 'B', 'C', 'D', 'E'];

  /** Energy share of protein, carbs and fat (4 / 4 / 9 kcal per gram). */
  function macros(d: Dish) {
    const n = d.nutrition;
    if (!n || n.protein == null || n.carbs == null || n.fat == null) return null;
    const parts = [
      { key: 'protein', label: t('dish.protein'), kcal: n.protein * 4 },
      { key: 'carbs', label: t('dish.carbs'), kcal: n.carbs * 4 },
      { key: 'fat', label: t('dish.fat'), kcal: n.fat * 9 },
    ];
    const total = parts.reduce((sum, p) => sum + p.kcal, 0);
    if (!total) return null;
    return parts.map((p) => ({ ...p, share: p.kcal / total }));
  }

  function favoriteToggle() {
    if (!dish) return;
    if (toggleFavorite(dish.name)) toast(t('dish.favorited'));
  }

  async function share() {
    if (!dish || !where) return;
    const url = new URL(location.href);
    const text = t('dish.shareText', { dish: l(dish.name), outlet: where.name, day: entry?.date ? weekdayLong(entry.date) : '' });
    try {
      if (navigator.share) {
        await navigator.share({ title: l(dish.name), text, url: url.href });
        return;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url.href}`);
      toast(t('common.copied'));
    } catch {}
  }
</script>

<Sheet open={app.dishId != null && !!found} onclose={closeDish} label={dish ? l(dish.name) : ''} wide>
  {#if dish && entry}
    <article class="detail" data-diet={dish.diet ?? 'none'}>
      <div class="media" class:photo={!!dish.image}>
        {#if dish.image}
          <img src={dish.image} alt={l(dish.name)} class:loaded={photoLoaded} onload={() => (photoLoaded = true)} />
          <span class="credit">{t('dish.photo')}</span>
        {:else}
          <div class="big-plate"><Plate name={dish.name.de} diet={dish.diet} size={200} /></div>
        {/if}
        <button class="icon-btn close" onclick={closeDish} aria-label={t('common.close')}><X size={18} /></button>
      </div>

      <div class="content">
        <p class="label">
          {[l(entry.section.name), where?.name, entry.date ? formatDay(entry.date) : null].filter(Boolean).join(' · ')}
        </p>
        <h2 class="name">{l(dish.name)}</h2>
        {#if l(dish.note)}<p class="note">{l(dish.note)}</p>{/if}
        {#if !fits.ok}<p class="why">{fits.reasons.join(' · ')}</p>{/if}

        <div class="topline">
          <div class="price">
            {#if dish.price}
              <span class="tabular amount">{formatPrice(dish.price)}</span>
            {:else}
              <span class="muted">{t('dish.noPrice')}</span>
            {/if}
          </div>
          <div class="actions">
            <button class="btn btn-soft" class:on={favorite} onclick={favoriteToggle} aria-pressed={favorite}>
              <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
              {favorite ? t('dish.unfavorite') : t('dish.favorite')}
            </button>
            <button class="icon-btn" onclick={share} aria-label={t('common.share')}><Share size={17} /></button>
          </div>
        </div>

        <div class="chips">
          {#if dish.diet}
            <span class="chip diet"><i aria-hidden="true"></i>{dietName(dish.diet)}</span>
          {/if}
          {#each featureChips(dish, app.doc) as feature (feature.key)}
            <span class="chip">{feature.label}</span>
          {/each}
        </div>

        {#if dish.co2}
          <section class="block">
            <h3 class="label">{t('dish.co2')}</h3>
            <div class="co2">
              <div class="scale" role="img" aria-label="{dish.co2.rating ?? ''} · {t('dish.co2Value', { grams: formatNumber(dish.co2.g) })}">
                {#each RATINGS as rating (rating)}
                  <span class="step" data-co2={rating} class:on={rating === dish.co2.rating}>{rating}</span>
                {/each}
              </div>
              <p class="co2-value tabular">{t('dish.co2Value', { grams: formatNumber(dish.co2.g) })}</p>
            </div>
            <p class="fine">{t('dish.co2Scale')}</p>
          </section>
        {/if}

        {#if dish.nutrition}
          {@const n = dish.nutrition}
          {@const split = macros(dish)}
          <section class="block">
            <h3 class="label">{t('dish.nutrition')}<span class="per">{` · ${t('dish.perPortion')}`}</span></h3>
            <p class="kcal"><span class="tabular">{formatNumber(n.kcal)}</span> kcal{#if n.kj}<span class="kj tabular">{` · ${formatNumber(n.kj)} kJ`}</span>{/if}</p>
            {#if split}
              <div class="split" role="img" aria-label={t('dish.macroSplit')}>
                {#each split as part (part.key)}
                  <span class="seg {part.key}" style:flex-grow={part.share}></span>
                {/each}
              </div>
              <div class="legend">
                {#each split as part (part.key)}
                  <span><i class={part.key}></i>{part.label} <b class="tabular">{formatPercent(part.share)}</b></span>
                {/each}
              </div>
            {/if}
            <dl class="facts">
              {#each [['dish.protein', n.protein], ['dish.carbs', n.carbs], ['dish.sugar', n.sugar], ['dish.fat', n.fat], ['dish.saturated', n.saturated], ['dish.salt', n.salt]] as [key, value] (key)}
                {#if value != null}
                  <div class="fact" class:sub={key === 'dish.sugar' || key === 'dish.saturated'}>
                    <dt>{t(key as 'dish.protein')}</dt>
                    <dd class="tabular">{formatNumber(value as number, 1)} g</dd>
                  </div>
                {/if}
              {/each}
            </dl>
          </section>
        {/if}

        <section class="block">
          <h3 class="label">{t('dish.allergens')}</h3>
          {#if dish.allergens.length}
            <div class="allergens">
              {#each dish.allergens as code (code)}
                <span class="chip"><b class="tabular">{code}</b>{allergenName(code, app.doc)}</span>
              {/each}
            </div>
          {:else}
            <p class="fine">{t('dish.noAllergens')}</p>
          {/if}
        </section>

        {#if dish.additives.length}
          <section class="block">
            <h3 class="label">{t('dish.additives')}</h3>
            <ul class="additives">
              {#each dish.additives as code (code)}
                <li><b class="tabular">{code}</b>{additiveName(code, app.doc)}</li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>
    </article>
  {/if}
</Sheet>

<style>
  .detail {
    padding-bottom: 12px;
  }

  .media {
    position: relative;
    margin: 0 14px;
    border-radius: 22px;
    overflow: hidden;
    background: var(--fill);
  }
  .media.photo {
    aspect-ratio: 16 / 10;
  }
  .media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    scale: 1.04;
    transition:
      opacity 500ms var(--ease),
      scale 900ms var(--ease-out);
  }
  .media img.loaded {
    opacity: 1;
    scale: 1;
  }
  .credit {
    position: absolute;
    left: 12px;
    bottom: 10px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    color: oklch(1 0 0 / 0.75);
    text-shadow: 0 1px 6px oklch(0 0 0 / 0.5);
  }
  .big-plate {
    display: grid;
    place-items: center;
    padding: 28px 0;
    background: radial-gradient(60% 70% at 50% 50%, var(--diet-fill), transparent 70%);
  }
  /* No grip above it on desktop, so the photo needs its own inset from the card's edge. */
  @media (min-width: 720px) {
    .media {
      margin-top: 14px;
    }
  }
  .close {
    position: absolute;
    top: 10px;
    right: 10px;
    background: color-mix(in oklch, var(--bg) 70%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: var(--fg);
  }

  .content {
    padding: 18px 22px 8px;
  }
  .name {
    margin-top: 6px;
    font-family: var(--font-display);
    font-size: clamp(26px, 6vw, 32px);
    font-weight: 480;
    line-height: 1.1;
    letter-spacing: -0.025em;
    text-wrap: balance;
  }
  .note {
    margin-top: 6px;
    color: var(--fg-3);
    font-size: 14px;
  }
  .why {
    margin-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-2);
  }

  .topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
  }
  .amount {
    font-size: 26px;
    font-weight: 500;
    letter-spacing: -0.03em;
  }
  .muted {
    color: var(--fg-3);
    font-size: 14px;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn.on {
    color: var(--danger);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 14px;
  }
  .chip.diet {
    background: var(--diet-fill);
    color: var(--fg);
  }
  .chip.diet i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--diet);
  }

  .block {
    margin-top: 26px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }
  .per {
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--font-sans);
    font-size: 12px;
  }
  .fine {
    margin-top: 8px;
    font-size: 12.5px;
    color: var(--fg-3);
  }

  .co2 {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 12px;
  }
  .scale {
    display: flex;
    gap: 4px;
  }
  .step {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-4);
    background: oklch(from var(--co2) l c h / 0.1);
    transition: all 300ms var(--ease);
  }
  .step.on {
    color: var(--invert-ink);
    background: var(--co2);
    scale: 1.14;
    box-shadow: 0 6px 20px -6px oklch(from var(--co2) l c h / 0.7);
  }
  .co2-value {
    font-size: 14px;
    color: var(--fg-2);
  }

  .kcal {
    margin-top: 10px;
    font-size: 15px;
    color: var(--fg-2);
  }
  .kcal > .tabular:first-child {
    font-size: 30px;
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--fg);
  }
  .kj {
    font-size: 13px;
    color: var(--fg-3);
  }
  .split {
    display: flex;
    gap: 3px;
    height: 8px;
    margin-top: 14px;
  }
  .seg {
    flex-basis: 0;
    border-radius: 99px;
  }
  .protein {
    background: var(--fg);
  }
  .carbs {
    background: var(--fg-3);
  }
  .fat {
    background: var(--fg-4);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin-top: 10px;
    font-size: 12.5px;
    color: var(--fg-3);
  }
  .legend i {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 50%;
  }
  .legend b {
    font-weight: 500;
    color: var(--fg-2);
  }
  .facts {
    margin: 14px 0 0;
  }
  .fact {
    display: flex;
    justify-content: space-between;
    padding: 7px 0;
    border-top: 1px solid var(--line);
    font-size: 14px;
  }
  .fact dt {
    color: var(--fg-2);
  }
  .fact dd {
    margin: 0;
  }
  .fact.sub dt {
    padding-left: 14px;
    color: var(--fg-3);
    font-size: 13px;
  }

  .allergens {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .allergens b,
  .additives b {
    font-size: 10.5px;
    color: var(--fg-4);
    font-weight: 500;
  }
  .additives {
    list-style: none;
    padding: 0;
    margin: 10px 0 0;
    display: grid;
    gap: 6px;
    font-size: 13.5px;
    color: var(--fg-2);
  }
  .additives li {
    display: flex;
    gap: 10px;
  }
  .additives b {
    width: 22px;
    flex: none;
    padding-top: 2px;
  }
</style>
