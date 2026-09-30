<script lang="ts">
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { formatDay, t } from './lib/i18n/index.svelte';
  import { app, defaultDate, load, setDate, setOutlet, stepDay } from './lib/state/app.svelte';
  import { toggleTheme } from './lib/state/theme.svelte';
  import DayStrip from './components/DayStrip.svelte';
  import DishSheet from './components/DishSheet.svelte';
  import FilterBar from './components/FilterBar.svelte';
  import Favorites from './components/Favorites.svelte';
  import Footer from './components/Footer.svelte';
  import Header from './components/Header.svelte';
  import Hero from './components/Hero.svelte';
  import Logo from './components/Logo.svelte';
  import Menu from './components/Menu.svelte';
  import OutletTabs from './components/OutletTabs.svelte';
  import Palette from './components/Palette.svelte';
  import Settings from './components/Settings.svelte';
  import Toasts from './components/Toasts.svelte';

  void load();

  const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

  function onkeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      app.palette = !app.palette;
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === ',') {
      event.preventDefault();
      app.settings = 'general';
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
    if (document.querySelector('dialog[open]')) return;
    if (event.key === '/') {
      event.preventDefault();
      app.palette = true;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      if ((event.target as HTMLElement)?.closest?.('[role="tablist"]')) return;
      stepDay(event.key === 'ArrowRight' ? 1 : -1);
    } else if (/^[1-9]$/.test(event.key)) {
      const outlet = app.doc?.outlets[Number(event.key) - 1];
      if (outlet) setOutlet(outlet.id);
    } else if (event.key === 't') {
      setDate(defaultDate(app.doc));
    } else if (event.key === 'f') {
      app.settings = 'filters';
    } else if (event.key === ',') {
      app.settings = 'general';
    } else if (event.key === 'd') {
      toggleTheme();
    }
  }
</script>

<svelte:window {onkeydown} />

<Header />

{#if app.doc}
  <main class="shell">
    <div class="mobile-outlets">
      <OutletTabs />
    </div>

    <aside class="side">
      <Hero />
    </aside>

    <section class="content" aria-label={formatDay(app.date)}>
      <div class="days">
        <DayStrip />
      </div>
      <div class="head">
        <h2 class="day-title">{formatDay(app.date)}</h2>
        <FilterBar />
      </div>
      <Menu />
    </section>
  </main>
{:else if app.status === 'error'}
  <main class="state">
    <Logo size={56} />
    <h1>{t('app.errorTitle')}</h1>
    <p>{t('app.errorBody')}</p>
    <button class="btn btn-soft" onclick={() => load()}><RefreshCw size={15} /> {t('app.retry')}</button>
  </main>
{:else}
  <main class="state loading" aria-busy="true">
    <Logo size={56} />
    <p>{t('app.loading')}</p>
  </main>
{/if}

<Footer />
<DishSheet />
<Settings />
<Favorites />
<Palette />
<Toasts />

<style>
  .shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: var(--page);
    margin: 0 auto;
    padding: 0 var(--gutter);
  }

  .mobile-outlets {
    margin-top: 6px;
  }

  .side {
    min-width: 0;
  }

  .content {
    min-width: 0;
  }

  /* The day strip rides under the header while the menu scrolls. */
  .days {
    position: sticky;
    top: var(--bar-h);
    z-index: 20;
    margin: 8px calc(var(--gutter) * -1) 0;
    padding: 0 var(--gutter);
    background: color-mix(in oklch, var(--bg) 82%, transparent);
    backdrop-filter: blur(18px) saturate(1.4);
    -webkit-backdrop-filter: blur(18px) saturate(1.4);
    border-bottom: 1px solid var(--line);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 22px 0 18px;
  }
  .day-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 450;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  @media (min-width: 1000px) {
    .shell {
      display: grid;
      grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
      column-gap: clamp(40px, 5vw, 72px);
      align-items: start;
      padding-top: 20px;
    }
    .mobile-outlets {
      display: none;
    }
    .side {
      position: sticky;
      top: calc(var(--bar-h) + 20px);
    }
    .days {
      margin: 0;
      padding: 0;
      background: color-mix(in oklch, var(--bg) 86%, transparent);
    }
    .day-title {
      font-size: 30px;
    }
  }

  .state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 60vh;
    padding: 0 var(--gutter);
    text-align: center;
  }
  .state h1 {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 480;
    letter-spacing: -0.02em;
  }
  .state p {
    max-width: 40ch;
    color: var(--fg-3);
  }
  .loading :global(.logo) {
    animation: pulse 1.1s var(--ease) infinite alternate;
  }
  @keyframes pulse {
    to {
      opacity: 0.3;
    }
  }
</style>
