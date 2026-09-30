<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import { locale, setLocale, t } from '../lib/i18n/index.svelte';
  import { app, defaultDate, setDate } from '../lib/state/app.svelte';
  import { effectiveTheme, toggleTheme } from '../lib/state/theme.svelte';
  import Logo from './Logo.svelte';
  import OutletTabs from './OutletTabs.svelte';

  let scrolled = $state(false);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
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

    <nav class="outlets">
      {#if app.doc}
        <OutletTabs variant="bar" />
      {/if}
    </nav>

    <div class="actions">
      <button class="search" onclick={() => (app.palette = true)} aria-label={t('common.search')}>
        <Search size={16} />
        <span class="search-label">{t('common.search')}</span>
        <span class="kbd">{mac ? '⌘' : 'Ctrl'} K</span>
      </button>

      <button
        class="lang"
        onclick={() => setLocale(locale() === 'de' ? 'en' : 'de')}
        aria-label={t('common.switchLanguage')}
        title={t('common.switchLanguage')}
      >
        <span class="opt" class:on={locale() === 'de'} lang="de">DE</span>
        <span class="opt" class:on={locale() === 'en'} lang="en">EN</span>
      </button>

      <button
        class="icon-btn theme"
        onclick={toggleTheme}
        aria-label={t('common.switchTheme', { theme: effectiveTheme() === 'dark' ? t('common.themeLight') : t('common.themeDark') })}
      >
        {#if effectiveTheme() === 'dark'}
          <Sun size={17} />
        {:else}
          <Moon size={17} />
        {/if}
      </button>
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
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
    max-width: var(--page);
    height: var(--bar-h);
    margin: 0 auto;
    padding: 0 var(--gutter);
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
    gap: 6px;
  }

  .search {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 8px 0 12px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--fill);
    color: var(--fg-3);
    font-size: 13px;
    transition:
      border-color 160ms var(--ease),
      color 160ms var(--ease);
  }
  .search:hover {
    color: var(--fg);
    border-color: var(--line-strong);
  }
  .search .kbd {
    height: 22px;
  }

  /* The landing page's language pill: both options visible, the current one filled. */
  .lang {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 36px;
    padding: 0 4px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--fill);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--fg-3);
    transition:
      color 0.2s,
      border-color 0.2s;
  }
  .lang:hover {
    color: var(--fg-2);
    border-color: var(--line-strong);
  }
  .opt {
    padding: 4px 7px;
    border-radius: 999px;
    transition:
      color 0.3s var(--ease),
      background-color 0.3s var(--ease);
  }
  .opt.on {
    color: var(--fg);
    background: var(--fill-3);
  }

  .theme {
    width: 36px;
    height: 36px;
  }

  @media (max-width: 999px) {
    .inner {
      grid-template-columns: 1fr auto;
    }
    .outlets {
      display: none;
    }
    .search-label,
    .search .kbd {
      display: none;
    }
    .search {
      width: 36px;
      padding: 0;
      justify-content: center;
    }
  }

  @media (max-width: 360px) {
    .word {
      display: none;
    }
  }
</style>
