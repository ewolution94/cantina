<script lang="ts">
  import Clock from '@lucide/svelte/icons/clock';
  import { formatDay, l, t, weekdayLong, weekdayShort } from '../lib/i18n/index.svelte';
  import { Halftone } from '../lib/halftone';
  import { app, outlet } from '../lib/state/app.svelte';
  import { effectiveTheme } from '../lib/state/theme.svelte';
  import { addDays, formatSlots, outletStatus, statusTone, weekday, type Status } from '../lib/time';

  let canvas: HTMLCanvasElement;
  let halftone: Halftone | null = null;
  // Open by default where there's room for it (the desktop column), a tap away on phones.
  let showHours = $state(matchMedia('(min-width: 1000px)').matches);

  const current = $derived(outlet());
  const isToday = $derived(app.date === app.now.date);
  const status = $derived(current ? outletStatus(current, app.now) : null);

  /** Monday–Friday of the selected week, plus the weekend if the outlet opens then. */
  const week = $derived.by(() => {
    if (!current || !app.date) return [];
    const monday = addDays(app.date, -weekday(app.date));
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((day, i) => i < 5 || current.hours[i]?.length);
  });

  function statusText(s: Status): string {
    switch (s.kind) {
      case 'open':
        return t('status.openUntil', { time: s.until });
      case 'closing':
        return t('status.closesIn', { minutes: s.minutes });
      case 'opening':
        return t('status.opensIn', { minutes: s.minutes });
      case 'later':
        return t('status.opensAt', { time: s.at });
      case 'closed':
        return t('status.closedNow');
      case 'closedToday':
        return t('status.closedToday');
    }
  }

  function dayHours(day: string): string {
    const slots = current?.hours[weekday(day)] ?? [];
    return slots.length ? formatSlots(slots) : t('hours.closed');
  }

  $effect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    halftone = new Halftone(canvas, {
      onTint: (tint) => {
        const root = document.documentElement.style;
        root.setProperty('--accent-h', String(tint?.h ?? 250));
        root.setProperty('--accent-c', String(tint?.c ?? 0.02));
      },
    });
    halftone.setReducedMotion(reduced.matches);
    const onchange = () => halftone?.setReducedMotion(reduced.matches);
    reduced.addEventListener('change', onchange);
    return () => {
      reduced.removeEventListener('change', onchange);
      halftone?.destroy();
      halftone = null;
    };
  });

  $effect(() => {
    void halftone?.show(current?.image ?? null);
  });

  $effect(() => {
    void effectiveTheme();
    // After the new tokens have been applied.
    requestAnimationFrame(() => halftone?.readTheme());
  });
</script>

<section class="hero" aria-labelledby="outlet-name">
  <div class="art">
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
  </div>

  {#if current}
    <div class="info">
      <p class="label">{app.doc?.location.name}</p>
      <h1 id="outlet-name" class="name">{current.name}</h1>

      <button class="status-line" onclick={() => (showHours = !showHours)} aria-expanded={showHours}>
        {#if isToday && status}
          <span class="dot {statusTone(status)}" aria-hidden="true"></span>
          <span>{statusText(status)}</span>
        {:else}
          <Clock size={14} />
          <span>{t('status.hoursOn', { day: weekdayLong(app.date), hours: dayHours(app.date) })}</span>
        {/if}
      </button>

      <div class="more" class:open={showHours}>
        <dl class="hours" aria-label={t('hours.title')}>
          {#each week as day (day)}
            <div class="row" class:sel={day === app.date} class:today={day === app.now.date}>
              <dt title={formatDay(day)}>{weekdayShort(day)}</dt>
              <dd class="tabular">{dayHours(day)}</dd>
            </div>
          {/each}
        </dl>
        {#if current.note}
          <p class="note">{l(current.note)}</p>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .hero {
    position: relative;
  }

  .art {
    position: relative;
    height: 236px;
    margin: 0 calc(var(--gutter) * -1);
    overflow: hidden;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: pan-y;
    /* Fades out towards the bottom, where the outlet's name sits over it. */
    mask-image: radial-gradient(85% 100% at 50% 0%, #000 30%, transparent 100%);
    -webkit-mask-image: radial-gradient(85% 100% at 50% 0%, #000 30%, transparent 100%);
    opacity: 0.85;
  }

  .info {
    position: relative;
    margin-top: -86px;
  }

  .label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--fg-3);
  }

  .name {
    margin-top: 4px;
    font-family: var(--font-display);
    font-size: clamp(38px, 10vw, 54px);
    font-weight: 480;
    line-height: 1;
    letter-spacing: -0.035em;
    font-variation-settings: 'opsz' 144;
    text-wrap: balance;
  }

  .status-line {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    height: 30px;
    padding: 0 12px 0 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: color-mix(in oklch, var(--bg) 60%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    font-size: 13px;
    color: var(--fg-2);
    transition: border-color 160ms var(--ease);
  }
  .status-line:hover {
    border-color: var(--line-strong);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--closed);
  }
  .dot.open {
    position: relative;
    background: var(--open);
  }
  /* The beacon is a ring that scales and fades: transform and opacity only, so it runs on the
     compositor instead of repainting every frame the way an animated box-shadow would. */
  .dot.open::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--open);
    animation: beacon 2.4s var(--ease) infinite;
  }
  .dot.soon {
    background: var(--soon);
  }
  @keyframes beacon {
    from {
      scale: 1;
      opacity: 0.55;
    }
    70%,
    to {
      scale: 3;
      opacity: 0;
    }
  }

  .more {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 320ms var(--ease-out);
  }
  .more > * {
    min-height: 0;
    overflow: hidden;
  }
  .more.open {
    grid-template-rows: 1fr;
  }
  .more.open > :first-child {
    margin-top: 16px;
  }

  .hours {
    margin: 0;
    display: grid;
    gap: 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 7px 0;
    border-top: 1px solid var(--line);
    font-size: 13.5px;
    color: var(--fg-3);
  }
  .row dt {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    align-self: center;
  }
  .row dd {
    margin: 0;
    font-size: 13px;
  }
  .row.today dt::after {
    content: ' ·';
  }
  .row.sel {
    color: var(--fg);
  }

  .note {
    margin-top: 12px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--fg-3);
  }

  /* Desktop: the hero is the sticky left column; the photo gets room and the hours stay open. */
  @media (min-width: 1000px) {
    .art {
      height: auto;
      aspect-ratio: 1 / 1.02;
      margin: 0 -12px;
    }
    /* No frame: the photo dissolves into the page. */
    canvas {
      mask-image: radial-gradient(closest-side at 50% 44%, #000 40%, transparent 100%);
      -webkit-mask-image: radial-gradient(closest-side at 50% 44%, #000 40%, transparent 100%);
    }
    .info {
      margin-top: -64px;
      padding: 0 4px;
    }
  }
</style>
