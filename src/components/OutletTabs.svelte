<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { app, setOutlet, shortName } from '../lib/state/app.svelte';

  // The outlet switch, built like Clinch's view nav: a framed pill bar whose labels scroll inside
  // the frame on narrow screens.

  const outlets = $derived(app.doc?.outlets ?? []);
  let tabs: HTMLButtonElement[] = $state([]);
  let scroller: HTMLDivElement;
  let pill = $state({ x: 0, w: 0 });
  /** Transitions switch on a frame after the first placement, so the pill doesn't grow in from nothing. */
  let ready = $state(false);

  /** Which sides have labels hidden behind them. */
  let edges = $state({ start: false, end: false });
  const SLACK = 2;

  function updateEdges() {
    const hidden = scroller.scrollWidth - scroller.clientWidth;
    const start = scroller.scrollLeft > SLACK;
    const end = hidden > SLACK && scroller.scrollLeft < hidden - SLACK;
    if (start !== edges.start || end !== edges.end) edges = { start, end };
  }

  /** A fade only on the sides that actually hide something (Clinch's edgeFadeMask). */
  const mask = $derived.by(() => {
    if (!edges.start && !edges.end) return undefined;
    const w = 30;
    const stops = [edges.start ? 'transparent 0' : '#000 0', edges.start ? `#000 ${w}px` : null, edges.end ? `#000 calc(100% - ${w}px)` : null, edges.end ? 'transparent 100%' : '#000 100%'];
    return `linear-gradient(to right, ${stops.filter(Boolean).join(', ')})`;
  });

  function measure() {
    const tab = tabs[outlets.findIndex((o) => o.id === app.outletId)];
    if (!tab) return;
    pill = { x: tab.offsetLeft, w: tab.offsetWidth };
    updateEdges();
    if (!ready) requestAnimationFrame(() => requestAnimationFrame(() => (ready = true)));
  }

  /**
   * Bring the current outlet into view, but only when it isn't already: tapping a pill you can
   * see shouldn't slide the bar out from under your finger. This is for arriving (a shared link,
   * the palette, the number keys) with the pill off the edge of a phone.
   */
  function reveal() {
    const tab = tabs[outlets.findIndex((o) => o.id === app.outletId)];
    if (!tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left >= scroller.scrollLeft && right <= scroller.scrollLeft + scroller.clientWidth) return;
    scroller.scrollTo({ left: Math.max(0, left - (scroller.clientWidth - tab.offsetWidth) / 2), behavior: ready ? 'smooth' : 'instant' });
  }

  $effect(() => {
    const observer = new ResizeObserver(() => measure());
    observer.observe(scroller);
    for (const tab of tabs) if (tab) observer.observe(tab);
    scroller.addEventListener('scroll', updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', updateEdges);
    };
  });

  $effect(() => {
    void app.outletId;
    void outlets.length;
    void document.fonts?.ready.then(measure);
    // measure() reads the state it writes; only the selection should re-run this.
    untrack(() => {
      measure();
      reveal();
    });
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = outlets.findIndex((o) => o.id === app.outletId);
    const next = outlets[(index + (event.key === 'ArrowRight' ? 1 : -1) + outlets.length) % outlets.length];
    setOutlet(next.id);
    tabs[outlets.indexOf(next)]?.focus();
  }
</script>

<!--
  The frame and the scroller are two elements, as in Clinch: the border stays put and crisp while
  the labels scroll and fade under it. The scroller carries the frame's radius too, because it is
  the element that clips, and the chevrons are its siblings so its mask can't erase them.
-->
<div class="frame">
  <div
    class="scroller"
    role="tablist"
    tabindex="-1"
    aria-label={t('outlets.label')}
    bind:this={scroller}
    style:mask-image={mask}
    style:-webkit-mask-image={mask}
    {onkeydown}
  >
    <span class="pill" class:ready style:--x="{pill.x}px" style:--w="{pill.w}px" aria-hidden="true"></span>
    {#each outlets as outlet, i (outlet.id)}
      <button
        bind:this={tabs[i]}
        class="tab"
        role="tab"
        aria-selected={outlet.id === app.outletId}
        tabindex={outlet.id === app.outletId ? 0 : -1}
        title={outlet.name}
        onclick={() => setOutlet(outlet.id)}
      >
        {shortName(outlet.name)}
      </button>
    {/each}
  </div>
  <span class="cue start" class:shown={edges.start} aria-hidden="true">
    <svg width="7" height="12" viewBox="0 0 7 12"><path d="M6 1 1 6l5 5" /></svg>
  </span>
  <span class="cue end" class:shown={edges.end} aria-hidden="true">
    <svg width="7" height="12" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
  </span>
</div>

<style>
  .frame {
    position: relative;
    display: flex;
    min-width: 0;
    max-width: 100%;
    padding: 3px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: color-mix(in oklch, var(--bg) 70%, transparent);
  }

  .scroller {
    position: relative;
    display: flex;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    border-radius: 999px;
    /* Keeps the labels' scrollable overflow out of the page's own, so a phone can't drag the
       whole page sideways (Clinch hit exactly this). */
    contain: paint;
    isolation: isolate;
    outline: none;
  }
  .scroller::-webkit-scrollbar {
    display: none;
  }

  .pill {
    position: absolute;
    z-index: -1;
    left: 0;
    top: 0;
    height: 100%;
    width: var(--w);
    translate: var(--x) 0;
    border-radius: 999px;
    background: var(--invert);
  }
  .pill.ready {
    transition:
      translate 420ms var(--ease-out),
      width 420ms var(--ease-out);
  }

  .tab {
    flex: none;
    height: 34px;
    padding: 0 15px;
    border-radius: 999px;
    color: var(--fg-2);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    transition: color 220ms var(--ease);
  }
  .tab:hover {
    color: var(--fg);
  }
  .tab[aria-selected='true'] {
    color: var(--invert-ink);
  }

  /* "There is more this way": painted whatever is underneath, unlike the fade alone. */
  .cue {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    color: var(--fg-2);
    pointer-events: none;
    opacity: 0;
    transition: opacity 300ms var(--ease);
  }
  .cue.start {
    left: 0;
  }
  .cue.end {
    right: 0;
  }
  .cue.shown {
    opacity: 1;
  }
  .cue svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
