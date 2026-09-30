<script lang="ts">
  import { tick } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import Heart from '@lucide/svelte/icons/heart';
  import Languages from '@lucide/svelte/icons/languages';
  import Monitor from '@lucide/svelte/icons/monitor';
  import Moon from '@lucide/svelte/icons/moon';
  import Sun from '@lucide/svelte/icons/sun';
  import X from '@lucide/svelte/icons/x';
  import { formatClock, t } from '../lib/i18n/index.svelte';
  import { MAIN_ALLERGENS, allergenName } from '../lib/data/labels';
  import { app, shortName } from '../lib/state/app.svelte';
  import { resetFilters, settings } from '../lib/state/settings.svelte';
  import Segmented from './Segmented.svelte';
  import Sheet from './Sheet.svelte';
  import Toggle from './Toggle.svelte';

  let filtersSection: HTMLElement | undefined = $state();
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Opened from the menu's filter button: land on the filters, not at the top.
  $effect(() => {
    if (app.settings === 'filters') void tick().then(() => filtersSection?.scrollIntoView({ block: 'start' }));
  });

  function toggleAllergen(code: string) {
    settings.avoid = settings.avoid.includes(code) ? settings.avoid.filter((c) => c !== code) : [...settings.avoid, code];
  }

  const startValue = $derived(settings.startOutlet === 'last' ? 'last' : String(settings.startOutlet));
</script>

<Sheet open={app.settings !== false} onclose={() => (app.settings = false)} label={t('settings.title')}>
  <div class="settings">
    <header>
      <h2>{t('settings.title')}</h2>
      <button class="icon-btn" onclick={() => (app.settings = false)} aria-label={t('common.close')}><X size={18} /></button>
    </header>

    <section>
      <h3 class="label">{t('settings.general')}</h3>
      <div class="row">
        <span class="name">{t('settings.language')}</span>
        <!-- Language names stay in their own language, so they're findable whatever is active. -->
        <Segmented
          label={t('settings.language')}
          value={settings.language}
          onchange={(language) => (settings.language = language)}
          options={[
            { value: 'system', label: t('settings.system'), icon: Languages },
            { value: 'de', label: 'Deutsch' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      <div class="row">
        <span class="name">{t('settings.theme')}</span>
        <Segmented
          label={t('settings.theme')}
          value={settings.theme}
          onchange={(theme) => (settings.theme = theme)}
          options={[
            { value: 'system', label: t('settings.system'), icon: Monitor },
            { value: 'light', label: t('settings.light'), icon: Sun },
            { value: 'dark', label: t('settings.dark'), icon: Moon },
          ]}
        />
      </div>
      <Toggle bind:checked={settings.simple} label={t('settings.simple')} hint={t('settings.simpleHint')} />
      <label class="row">
        <span class="text">
          <span class="name">{t('settings.start')}</span>
          <span class="hint">{t('settings.startHint')}</span>
        </span>
        <select
          class="field"
          value={startValue}
          onchange={(event) => {
            const value = (event.currentTarget as HTMLSelectElement).value;
            settings.startOutlet = value === 'last' ? 'last' : Number(value);
          }}
        >
          <option value="last">{t('settings.startLast')}</option>
          <option value="0">{t('overview.tab')}</option>
          {#each app.doc?.outlets ?? [] as outlet (outlet.id)}
            <option value={String(outlet.id)}>{shortName(outlet.name)}</option>
          {/each}
        </select>
      </label>
    </section>

    <section bind:this={filtersSection}>
      <div class="head">
        <h3 class="label">{t('settings.filters')}</h3>
        <button class="reset" onclick={resetFilters}>{t('filter.reset')}</button>
      </div>
      <Toggle bind:checked={settings.noPork} label={t('filter.noPork')} hint={t('settings.noPorkHint')} />
      <div class="stack">
        <span class="text">
          <span class="name">{t('filter.allergens')}</span>
          <span class="hint">{t('filter.avoidHint')}</span>
        </span>
        <div class="grid" role="group" aria-label={t('filter.avoid')}>
          {#each MAIN_ALLERGENS as code (code)}
            {@const on = settings.avoid.includes(code)}
            <button class="opt" class:on aria-pressed={on} onclick={() => toggleAllergen(code)}>
              <span class="code tabular">{code}</span>
              <span class="opt-name">{allergenName(code, app.doc)}</span>
              <span class="tick" aria-hidden="true"><Check size={13} strokeWidth={2.6} /></span>
            </button>
          {/each}
        </div>
      </div>
      <Toggle bind:checked={settings.hide} label={t('filter.hideMode')} hint={t('settings.hideHint')} />
    </section>

    <section>
      <h3 class="label">{t('settings.favorites')}</h3>
      <Toggle bind:checked={settings.favoriteHint} label={t('settings.favoriteHint')} hint={t('settings.favoriteHintHint')} />
      <button
        class="btn btn-soft wide"
        onclick={() => {
          app.settings = false;
          app.favorites = true;
        }}
      >
        <Heart size={15} />
        {t('settings.showFavorites')}
        {#if settings.favorites.length}<span class="count tabular">{settings.favorites.length}</span>{/if}
      </button>
    </section>

    <section class="about">
      <h3 class="label">{t('settings.about')}</h3>
      <p>{t('settings.aboutText')}</p>
      {#if app.doc}<p class="meta tabular">{t('app.updated', { time: formatClock(app.doc.fetchedAt) })}</p>{/if}
      {#if finePointer}<p class="meta">{t('settings.shortcuts')}</p>{/if}
    </section>
  </div>
</Sheet>

<style>
  .settings {
    padding: 0 22px 22px;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 -22px;
    padding: 6px 12px 10px 22px;
    background: var(--panel-solid);
  }
  h2 {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 480;
    letter-spacing: -0.02em;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px 0 22px;
    border-top: 1px solid var(--line);
    scroll-margin-top: 56px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .reset {
    font-size: 13px;
    color: var(--fg-3);
  }
  .reset:hover {
    color: var(--fg);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .row :global(.seg) {
    flex: none;
    width: min(300px, 62%);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-size: 14px;
  }
  .hint {
    font-size: 12.5px;
    color: var(--fg-3);
    line-height: 1.45;
  }

  .field {
    flex: none;
    height: 36px;
    min-width: 150px;
    padding: 0 30px 0 12px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--fill)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E")
      no-repeat right 12px center;
    font-size: 13.5px;
    appearance: none;
    cursor: pointer;
  }
  .field:hover {
    border-color: var(--line-strong);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 42px;
    padding: 0 12px;
    border-radius: 13px;
    border: 1px solid var(--line);
    background: var(--fill);
    text-align: left;
    transition:
      background-color 180ms var(--ease),
      border-color 180ms var(--ease);
  }
  .opt:hover {
    border-color: var(--line-strong);
  }
  .code {
    width: 16px;
    font-size: 11px;
    color: var(--fg-4);
  }
  .opt-name {
    flex: 1;
    font-size: 13.5px;
    color: var(--fg-2);
  }
  .tick {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    color: transparent;
    transition:
      background-color 180ms var(--ease),
      color 180ms var(--ease);
  }
  .opt.on {
    border-color: var(--line-strong);
    background: var(--fill-3);
  }
  .opt.on .opt-name {
    color: var(--fg);
  }
  .opt.on .tick {
    background: var(--invert);
    border-color: transparent;
    color: var(--invert-ink);
  }

  .wide {
    width: 100%;
    height: 42px;
  }
  .count {
    font-size: 12px;
    color: var(--fg-3);
  }

  .about p {
    font-size: 13.5px;
    color: var(--fg-2);
    line-height: 1.55;
  }
  .about .meta {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--fg-3);
  }

  @media (max-width: 480px) {
    .row {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    .row :global(.seg) {
      width: 100%;
    }
    .field {
      width: 100%;
    }
  }
</style>
