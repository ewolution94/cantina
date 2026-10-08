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
      // showModal() focuses the first button, which Safari rings as if it were tabbed to (a
      // heavy circle around the close button on iPhones). The sheet itself takes focus instead;
      // Tab still reaches the button first.
      dialog.focus({ preventScroll: true });
      document.documentElement.classList.add('sheet-open');
    } else if (!open && dialog.open) {
      if (reduced()) return finish();
      closing = true;
      // animationend is the normal path; this covers a tab that throttles animations.
      const fallback = setTimeout(() => closing && finish(), 450);
      return () => clearTimeout(fallback);
    }
  });

  // Keeps a top sheet (the search palette) sized to what's visible above a phone keyboard.
  $effect(() => {
    const viewport = window.visualViewport;
    if (!open || !top || !viewport) return;
    const update = () => {
      dialog.style.setProperty('--vvh', `${viewport.height}px`);
      dialog.style.setProperty('--vvo', `${viewport.offsetTop}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
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

  // Dragged down by the grip, or by a sheet's own header (Settings, Favorites) away from its
  // buttons: the 22 px grip alone was hard to hit (2026-10-07). Phones only: from 720px it's a card
  // without a grip.
  const phone = matchMedia('(max-width: 719px)');
  function onpointerdown(event: PointerEvent) {
    if (event.pointerType === 'mouse' || !phone.matches) return;
    const target = event.target as Element;
    const handle = target.closest<HTMLElement>('.grip, header');
    if (!handle || !dialog.contains(handle) || target.closest('button, a, input, select, textarea, label')) return;
    dragging = true;
    startY = event.clientY;
    handle.setPointerCapture(event.pointerId);
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
  tabindex="-1"
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
  {onpointerdown}
  {onpointermove}
  {onpointerup}
  onpointercancel={onpointerup}
>
  <div class="grip" aria-hidden="true">
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

  /* The search palette on phones hangs from the top and is exactly as tall as what's visible
     above the keyboard (--vvh, from visualViewport). A bottom sheet doesn't survive the keyboard
     on iOS: Safari pans the page to make room and the search field slides out of view. */
  .sheet.top {
    inset: 0 0 auto 0;
    height: var(--vvh, 100dvh);
    max-height: none;
    padding-top: env(safe-area-inset-top);
    border: 0;
    border-bottom: 1px solid var(--line);
    border-radius: 0 0 var(--r-xl) var(--r-xl);
    translate: 0 var(--vvo, 0px);
  }
  .sheet.top[open] {
    animation: drop-in 300ms var(--ease-out);
  }
  .sheet.top.closing {
    animation: drop-out 200ms var(--ease) forwards;
  }
  .sheet.top .grip {
    display: none;
  }
  .sheet.top .body {
    padding-bottom: 0;
  }

  /* 6 px taller than before (hard to hit at 22), overlapping the body by as much, so nothing below
     it moves. */
  .grip {
    position: relative;
    z-index: 2;
    flex: none;
    display: grid;
    place-items: center;
    height: 28px;
    margin-bottom: -6px;
    touch-action: none;
    cursor: grab;
  }
  /* Above a sticky header (Settings, Favorites), a band of the sheet's colour along the grip's
     lower edge, 3 px above the body and over its first 6 (the header's padding). Safari clips the
     scrolled list a device pixel higher than the stuck header, and while scrolling a sliver of the
     list showed between the grip and the header (2026-10-08). Not on the dish sheet, whose photo
     starts at the body's top. */
  .sheet:has(.body :global(header)) .grip::after {
    content: '';
    position: absolute;
    inset: auto 0 0;
    height: 9px;
    background: var(--panel-solid);
  }
  .grip span {
    width: 44px;
    height: 5px;
    border-radius: 99px;
    background: var(--line-strong);
  }

  /* `auto`, not `flex: 1`: the dialog has a max-height but no height, and Safari resolves a 0%
     basis against that literally, collapsing the sheet to its grip. Sized by its content, then
     shrunk to fit and scrolled, it works the same everywhere. */
  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: calc(env(safe-area-inset-bottom) + 12px);
  }
  .sheet:focus {
    outline: none;
  }
  /* In a phone's browser (not the installed app), Safari's floating toolbar sits over the bottom
     of the sheet; leave room to scroll the last rows above it. */
  @media (display-mode: browser) and (max-width: 719px) {
    .body {
      padding-bottom: calc(env(safe-area-inset-bottom) + 76px);
    }
  }

  @media (max-width: 719px) {
    .sheet :global(header) {
      touch-action: none;
    }
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
      inset: 0;
      height: auto;
      max-height: min(86dvh, 860px);
      margin-top: 12vh;
      padding-top: 0;
      border: 1px solid var(--line);
      border-radius: var(--r-xl);
      translate: none;
    }
    .sheet[open],
    .sheet.top[open] {
      animation: pop-in 320ms var(--ease-out);
    }
    .sheet.closing,
    .sheet.top.closing {
      animation: pop-out 200ms var(--ease) forwards;
    }
    .grip {
      display: none;
    }
  }

  @keyframes drop-in {
    from {
      opacity: 0;
      translate: 0 -24px;
    }
  }
  @keyframes drop-out {
    to {
      opacity: 0;
      translate: 0 -16px;
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

  /* The page behind a sheet stays put. On <body>, not <html>: locking the root element turned it
     into its own scroller and the sticky header scrolled away behind the backdrop. */
  :global(html.sheet-open body) {
    overflow: hidden;
  }
</style>
