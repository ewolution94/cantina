<script lang="ts">
  import Clock from '@lucide/svelte/icons/clock';
  import { l, t, weekdayLong, weekdayShort } from '../lib/i18n/index.svelte';
  import { Halftone } from '../lib/halftone';
  import { app, outlet } from '../lib/state/app.svelte';
  import { shownTheme } from '../lib/state/theme.svelte';
  import { addDays, formatSlots, outletStatus, statusTone, weekday, type Status } from '../lib/time';

  let canvas = $state<HTMLCanvasElement | undefined>();
  let halftone = $state<Halftone | null>(null);

  const current = $derived(outlet());
  const isToday = $derived(app.date === app.now.date);
  const status = $derived(current ? outletStatus(current, app.now) : null);

  /**
   * The selected week's hours, with runs of days that keep the same hours folded into one line:
   * "Mo – Do 07:30–17:30", "Fr 07:30–14:00". Monday to Friday, plus the weekend if it opens then.
   */
  const groups = $derived.by(() => {
    if (!current || !app.date) return [];
    const monday = addDays(app.date, -weekday(app.date));
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((_, i) => i < 5 || current.hours[i]?.length);
    const out: { days: string[]; hours: string }[] = [];
    for (const day of days) {
      const hours = dayHours(day);
      const last = out.at(-1);
      if (last && last.hours === hours) last.days.push(day);
      else out.push({ days: [day], hours });
    }
    return out;
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

  const tint = (h: number, c: number) => {
    const root = document.documentElement.style;
    root.setProperty('--accent-h', String(h));
    root.setProperty('--accent-c', String(c));
  };

  $effect(() => {
    if (!canvas) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const instance = new Halftone(canvas, { onTint: (t) => tint(t?.h ?? 250, t?.c ?? 0.02) });
    instance.setReducedMotion(reduced.matches);
    const onchange = () => instance.setReducedMotion(reduced.matches);
    reduced.addEventListener('change', onchange);
    halftone = instance;
    return () => {
      reduced.removeEventListener('change', onchange);
      instance.destroy();
      halftone = null;
      // Without the photo there's no colour to borrow: back to the neutral glow.
      tint(250, 0.02);
    };
  });

  $effect(() => {
    void halftone?.show(current?.image ?? null);
  });

  $effect(() => {
    // The theme on the page, not the pick: under themeShift the new tokens arrive a moment later.
    void shownTheme();
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

      <p class="status-line">
        {#if isToday && status}
          <span class="dot {statusTone(status)}" aria-hidden="true"></span>
          <span>{statusText(status)}</span>
        {:else}
          <Clock size={14} />
          <span>{t('status.hoursOn', { day: weekdayLong(app.date), hours: dayHours(app.date) })}</span>
        {/if}
      </p>

      <dl class="hours" aria-label={t('hours.title')}>
        {#each groups as group (group.days[0])}
          <div class="row" class:sel={group.days.includes(app.date)}>
            <dt>
              {weekdayShort(group.days[0])}{#if group.days.length > 1}{` – ${weekdayShort(group.days.at(-1)!)}`}{/if}
            </dt>
            <dd class="tabular">{group.hours}</dd>
          </div>
        {/each}
      </dl>
      {#if current.note}
        <p class="note">{l(current.note)}</p>
      {/if}
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
    mask-image: linear-gradient(to bottom, #000 38%, transparent 96%);
    -webkit-mask-image: linear-gradient(to bottom, #000 38%, transparent 96%);
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

  .hours {
    margin: 16px 0 0;
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
    /* A plate: the photo is the food, cut to a circle, with a quiet rim around it (the dish
       plates in the list use the same rim and line colours). */
    .art {
      height: auto;
      aspect-ratio: 1;
      margin: 12px 14px 0;
      overflow: visible;
      isolation: isolate;
    }
    .art::before {
      content: '';
      position: absolute;
      inset: -5%;
      z-index: -1;
      border-radius: 50%;
      background: var(--fill);
      border: 1px solid var(--line-strong);
      box-shadow: 0 40px 70px -40px oklch(0 0 0 / 0.55);
    }
    canvas {
      border-radius: 50%;
      mask-image: radial-gradient(circle closest-side, #000 86%, transparent 100%);
    }
    .info {
      margin-top: 34px;
      padding: 0 4px;
    }
  }
</style>
