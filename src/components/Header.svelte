<script lang="ts">
  import Heart from '@lucide/svelte/icons/heart';
  import Search from '@lucide/svelte/icons/search';
  import { t } from '../lib/i18n/index.svelte';
  import { upcomingFavorites } from '../lib/data/occurrences';
  import { app, defaultDate, setDate } from '../lib/state/app.svelte';
  import { settings } from '../lib/state/settings.svelte';
  import '../../vendor/ewo/elements/settings-button.js';
  import Logo from './Logo.svelte';
  import OutletTabs from './OutletTabs.svelte';

  let scrolled = $state(false);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);

  /** A favourite is on somewhere today: the heart says so. */
  const favoriteToday = $derived(
    settings.favorites.length > 0 &&
      [...upcomingFavorites(app.doc, settings.favorites, app.now.date).values()].some((hits) => hits[0].date === app.now.date),
  );
</script>

<svelte:window onscroll={() => (scrolled = scrollY > 4)} />

<header class:scrolled>
  <div class="inner">
    <a
      href="/"
      class="brand"
      aria-label={t('app.home')}
      onclick={(event) => {
        event.preventDefault();
        setDate(defaultDate(app.doc));
        scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      <Logo size={26} />
      <span class="word"><em>C</em>antina</span>
    </a>

    <nav class="outlets" aria-label={t('outlets.label')}>
      {#if app.doc}
        <OutletTabs />
      {/if}
    </nav>

    <div class="actions">
      <button class="icon-btn" onclick={() => (app.palette = true)} aria-label={t('common.search')} title="{t('common.search')} ({mac ? '⌘' : 'Ctrl'} K)">
        <Search size={18} />
      </button>
      <button class="icon-btn fav" class:lit={favoriteToday} onclick={() => (app.favorites = true)} aria-label={t('favorites.open')} title={t('favorites.open')}>
        <Heart size={18} />
      </button>
      <!-- A real <button> inside (Folio's element): Enter and Space click it, the click reaches here. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <ewo-settings-button onclick={() => (app.settings = 'general')}></ewo-settings-button>
    </div>
  </div>
</header>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 30;
    isolation: isolate;
  }
  /* The frosted bar is its own layer that only fades in and out (compositor work); toggling the
     header's own background and blur would repaint it right as scrolling starts. */
  header::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: color-mix(in oklch, var(--bg) 80%, transparent);
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(18px) saturate(1.4);
    -webkit-backdrop-filter: blur(18px) saturate(1.4);
    opacity: 0;
    transition: opacity 200ms var(--ease);
  }
  header.scrolled::before {
    opacity: 1;
  }

  .inner {
    display: grid;
    /* The outlet bar may shrink (and scroll inside its frame) before it pushes the sides. */
    grid-template-columns: 1fr minmax(0, auto) 1fr;
    align-items: center;
    gap: 16px;
    max-width: var(--page);
    height: var(--bar-h);
    margin: 0 auto;
    padding: 0 var(--gutter);
  }

  .outlets {
    min-width: 0;
  }

  .brand {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    border-radius: 10px;
  }
  .word {
    font-family: var(--font-display);
    font-size: 21px;
    font-weight: 560;
    letter-spacing: -0.02em;
    font-variation-settings: 'opsz' 48;
  }
  .word em {
    font-style: italic;
    font-weight: 480;
  }

  .actions {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .actions .icon-btn {
    width: 38px;
    height: 38px;
  }
  /* A favourite is on somewhere today. */
  .fav {
    position: relative;
  }
  .fav.lit::after {
    content: '';
    position: absolute;
    top: 8px;
    right: 8px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--danger);
    box-shadow: 0 0 0 2px var(--bg);
  }

  @media (max-width: 999px) {
    .inner {
      grid-template-columns: 1fr auto;
    }
    .outlets {
      display: none;
    }
  }

  @media (max-width: 360px) {
    .word {
      display: none;
    }
  }
</style>
