<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { app, setOutlet, shortName } from '../lib/state/app.svelte';
  import { outletStatus, statusTone } from '../lib/time';

  let { variant = 'bar' }: { variant?: 'bar' | 'row' } = $props();

  const outlets = $derived(app.doc?.outlets ?? []);
  let tabs: HTMLButtonElement[] = $state([]);
  let list: HTMLDivElement;
  let pill = $state({ x: 0, w: 0 });
  /** Transitions switch on a frame after the first placement, so the pill doesn't grow in from nothing. */
  let ready = $state(false);

  function measure() {
    const index = outlets.findIndex((o) => o.id === app.outletId);
    const tab = tabs[index];
    if (!tab) return;
    pill = { x: tab.offsetLeft, w: tab.offsetWidth };
    if (variant === 'row') {
      const left = tab.offsetLeft - list.clientWidth / 2 + tab.offsetWidth / 2;
      list.scrollTo({ left, behavior: ready ? 'smooth' : 'instant' });
    }
    if (!ready) requestAnimationFrame(() => requestAnimationFrame(() => (ready = true)));
  }

  // The header's grid settles after first paint (fonts, the actions' width); follow it.
  $effect(() => {
    const observer = new ResizeObserver(() => measure());
    observer.observe(list);
    return () => observer.disconnect();
  });

  $effect(() => {
    void app.outletId;
    void outlets.length;
    void document.fonts?.ready.then(measure);
    // measure() reads the pill it writes; only the selection should re-run this.
    untrack(measure);
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

<svelte:window onresize={measure} />

<div class="tabs {variant}" role="tablist" tabindex="-1" aria-label={t('outlets.label')} bind:this={list} {onkeydown}>
  <span class="pill" class:ready style:--x="{pill.x}px" style:--w="{pill.w}px" aria-hidden="true"></span>
  {#each outlets as outlet, i (outlet.id)}
    {@const tone = statusTone(outletStatus(outlet, app.now))}
    <button
      bind:this={tabs[i]}
      class="tab"
      role="tab"
      aria-selected={outlet.id === app.outletId}
      tabindex={outlet.id === app.outletId ? 0 : -1}
      title={outlet.name}
      onclick={() => setOutlet(outlet.id)}
    >
      <span class="status {tone}" aria-hidden="true"></span>
      {shortName(outlet.name)}
    </button>
  {/each}
</div>

<style>
  .tabs {
    position: relative;
    outline: none;
    display: flex;
    align-items: center;
    gap: 2px;
    isolation: isolate;
  }

  .bar {
    padding: 3px;
    border-radius: 999px;
    background: var(--fill);
    border: 1px solid var(--line);
  }

  .row {
    overflow-x: auto;
    scrollbar-width: none;
    padding: 4px var(--gutter);
    mask-image: linear-gradient(to right, transparent 0, #000 var(--gutter), #000 calc(100% - var(--gutter)), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0, #000 var(--gutter), #000 calc(100% - var(--gutter)), transparent 100%);
  }
  .row::-webkit-scrollbar {
    display: none;
  }

  .pill {
    position: absolute;
    z-index: -1;
    left: 0;
    top: 50%;
    height: 34px;
    width: var(--w);
    translate: var(--x) -50%;
    border-radius: 999px;
    background: var(--invert);
    box-shadow: 0 8px 24px -10px var(--glow);
  }
  .pill.ready {
    transition:
      translate 420ms var(--ease-out),
      width 420ms var(--ease-out),
      background-color 200ms var(--ease);
  }

  .tab {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 14px 0 12px;
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

  .status {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--closed);
    opacity: 0.7;
  }
  .status.open {
    background: var(--open);
    opacity: 1;
    box-shadow: 0 0 0 3px oklch(from var(--open) l c h / 0.18);
  }
  .status.soon {
    background: var(--soon);
    opacity: 1;
  }
  .tab[aria-selected='true'] .status.closed {
    background: var(--invert-ink);
    opacity: 0.35;
  }
</style>
