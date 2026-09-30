<script lang="ts">
  import type { Snippet } from 'svelte';

  // A native <dialog>: focus trap, Escape and the top layer for free. A bottom sheet on phones
  // (drag the handle down to dismiss), a centred card from 720px up.

  let {
    open,
    onclose,
    label,
    wide = false,
    top = false,
    children,
  }: {
    open: boolean;
    onclose: () => void;
    label: string;
    wide?: boolean;
    /** Anchor near the top on desktop (the search palette), instead of centring. */
    top?: boolean;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement;
  let closing = $state(false);
  let drag = $state(0);
  let dragging = $state(false);
  let startY = 0;

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  $effect(() => {
    if (open && !dialog.open) {
      closing = false;
      drag = 0;
      dialog.showModal();
      document.documentElement.classList.add('sheet-open');
    } else if (!open && dialog.open) {
      if (reduced()) return finish();
      closing = true;
      // animationend is the normal path; this covers a tab that throttles animations.
      const fallback = setTimeout(() => closing && finish(), 450);
      return () => clearTimeout(fallback);
    }
  });

  function finish() {
    closing = false;
    drag = 0;
    if (dialog.open) dialog.close();
    document.documentElement.classList.remove('sheet-open');
  }

  function onanimationend(event: AnimationEvent) {
    if (closing && event.target === dialog) finish();
  }

  function oncancel(event: Event) {
    event.preventDefault();
    onclose();
  }

  function onpointerdown(event: PointerEvent) {
    if (event.pointerType === 'mouse') return;
    dragging = true;
    startY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onpointermove(event: PointerEvent) {
    if (!dragging) return;
    drag = Math.max(0, event.clientY - startY);
  }

  function onpointerup() {
    if (!dragging) return;
    dragging = false;
    if (drag > 90) onclose();
    else drag = 0;
  }
</script>

<dialog
  bind:this={dialog}
  class="sheet"
  class:wide
  class:top
  class:closing
  class:dragging
  aria-label={label}
  style:--drag="{drag}px"
  {oncancel}
  {onanimationend}
  onclick={(event) => event.target === dialog && onclose()}
>
  <div class="grip" {onpointerdown} {onpointermove} {onpointerup} onpointercancel={onpointerup} aria-hidden="true">
    <span></span>
  </div>
  <div class="body">
    {@render children()}
  </div>
</dialog>

<style>
  .sheet {
    position: fixed;
    inset: auto 0 0 0;
    width: 100%;
    max-width: 100%;
    max-height: min(92dvh, 900px);
    margin: 0;
    padding: 0;
    border: 1px solid var(--line);
    border-bottom: 0;
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    background: var(--panel-solid);
    color: var(--fg);
    box-shadow: var(--highlight), 0 -30px 80px -20px oklch(0 0 0 / 0.5);
    overflow: hidden;
    display: none;
    flex-direction: column;
    translate: 0 var(--drag);
  }
  .sheet[open] {
    display: flex;
    animation: sheet-in 420ms var(--ease-out);
  }
  .sheet.closing {
    animation: sheet-out 260ms var(--ease) forwards;
  }
  .sheet.dragging {
    transition: none;
  }
  .sheet:not(.dragging) {
    transition: translate 260ms var(--ease-out);
  }

  .sheet::backdrop {
    background: oklch(0.1 0.01 270 / 0.5);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: fade-in 300ms var(--ease);
  }
  .sheet.closing::backdrop {
    animation: fade-out 260ms var(--ease) forwards;
  }

  /* The search palette: tall from the start, so results have room above a phone keyboard. */
  .sheet.top {
    height: 92dvh;
  }

  .grip {
    flex: none;
    display: grid;
    place-items: center;
    height: 22px;
    touch-action: none;
    cursor: grab;
  }
  .grip span {
    width: 38px;
    height: 4px;
    border-radius: 99px;
    background: var(--line-strong);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: env(safe-area-inset-bottom);
  }

  @media (min-width: 720px) {
    .sheet {
      inset: 0;
      width: min(560px, calc(100vw - 48px));
      max-height: min(86dvh, 860px);
      margin: auto;
      border: 1px solid var(--line);
      border-radius: var(--r-xl);
      box-shadow: var(--highlight), var(--shadow);
      translate: none;
    }
    .sheet.wide {
      width: min(680px, calc(100vw - 48px));
    }
    .sheet.top {
      height: auto;
      margin-top: 12vh;
    }
    .sheet[open] {
      animation: pop-in 320ms var(--ease-out);
    }
    .sheet.closing {
      animation: pop-out 200ms var(--ease) forwards;
    }
    .grip {
      display: none;
    }
  }

  @keyframes sheet-in {
    from {
      translate: 0 100%;
    }
  }
  @keyframes sheet-out {
    to {
      translate: 0 100%;
    }
  }
  @keyframes pop-in {
    from {
      opacity: 0;
      scale: 0.97;
      translate: 0 8px;
    }
  }
  @keyframes pop-out {
    to {
      opacity: 0;
      scale: 0.98;
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  @keyframes fade-out {
    to {
      opacity: 0;
    }
  }

  :global(html.sheet-open) {
    overflow: hidden;
  }
</style>
