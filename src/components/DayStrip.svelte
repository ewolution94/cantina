<script lang="ts">
  import { t, weekdayShort, formatDay } from '../lib/i18n/index.svelte';
  import { app, dayList, isOverview, sectionsFor, setDate } from '../lib/state/app.svelte';
  import { isoWeek, weekday } from '../lib/time';

  const days = $derived(dayList(app.doc));
  let strip: HTMLDivElement;
  let buttons: Record<string, HTMLButtonElement> = $state({});
  let first = true;

  $effect(() => {
    const button = buttons[app.date];
    if (!button || !strip) return;
    const left = button.offsetLeft - strip.clientWidth / 2 + button.offsetWidth / 2;
    strip.scrollTo({ left, behavior: first ? 'instant' : 'smooth' });
    first = false;
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = days.indexOf(app.date);
    const next = days[Math.max(0, Math.min(days.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))];
    if (next) {
      setDate(next);
      buttons[next]?.focus();
    }
  }
</script>

<div class="strip" bind:this={strip} role="tablist" aria-label={t('days.label')} tabindex="-1" {onkeydown}>
  {#each days as day, i (day)}
    {@const selected = day === app.date}
    {@const today = day === app.now.date}
    {@const empty = isOverview() ? !app.doc?.days.includes(day) : !sectionsFor(app.outletId, day).length}
    {#if i === 0 || weekday(day) === 0}
      <span class="week" aria-hidden="true">{t('days.week', { n: isoWeek(day) })}</span>
    {/if}
    <button
      bind:this={buttons[day]}
      class="day"
      class:selected
      class:today
      class:past={day < app.now.date}
      class:empty
      role="tab"
      aria-selected={selected}
      tabindex={selected ? 0 : -1}
      aria-label="{formatDay(day)}{today ? ` · ${t('common.today')}` : ''}{empty ? ` · ${t('days.noMenu')}` : ''}"
      onclick={() => setDate(day)}
    >
      <span class="wd">{today ? t('common.today') : weekdayShort(day)}</span>
      <span class="num tabular">{Number(day.slice(8))}</span>
    </button>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    align-items: stretch;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    padding: 6px var(--gutter);
    margin: 0 calc(var(--gutter) * -1);
    mask-image: linear-gradient(to right, transparent 0, #000 var(--gutter), #000 calc(100% - var(--gutter)), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0, #000 var(--gutter), #000 calc(100% - var(--gutter)), transparent 100%);
  }
  .strip::-webkit-scrollbar {
    display: none;
  }
  .strip:focus {
    outline: none;
  }

  .week {
    flex: none;
    align-self: center;
    writing-mode: vertical-rl;
    rotate: 180deg;
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-4);
    padding: 0 2px 0 6px;
    border-right: 1px solid var(--line);
    margin-right: 2px;
  }
  .week:first-child {
    padding-left: 0;
  }
  .strip > .week:not(:first-child) {
    margin-left: 10px;
  }

  .day {
    position: relative;
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    min-width: 54px;
    height: 56px;
    padding: 0 8px;
    border-radius: 16px;
    color: var(--fg-2);
    transition:
      background-color 200ms var(--ease),
      color 200ms var(--ease),
      transform 200ms var(--ease);
  }
  .day:hover {
    background: var(--fill-2);
    color: var(--fg);
  }
  .day:active {
    transform: scale(0.96);
  }
  .wd {
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-3);
  }
  .num {
    font-family: var(--font-sans);
    font-size: 19px;
    font-weight: 560;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .past {
    color: var(--fg-3);
  }
  .past .num {
    font-weight: 450;
  }
  .empty .num {
    color: var(--fg-4);
  }
  /* Menu or not, a small mark under days that have dishes for this outlet. */
  .day::after {
    content: '';
    position: absolute;
    bottom: 7px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.45;
  }
  .day.empty::after {
    opacity: 0;
  }
  .today .wd {
    color: var(--fg);
    font-weight: 600;
  }
  .selected,
  .selected:hover {
    background: var(--invert);
    color: var(--invert-ink);
    box-shadow: 0 10px 26px -12px var(--glow);
  }
  .selected .wd,
  .selected.empty .num {
    color: color-mix(in oklch, var(--invert-ink) 70%, transparent);
  }
</style>
