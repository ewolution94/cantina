<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import { t } from '../lib/i18n/index.svelte';
  import { MAIN_ALLERGENS, allergenName } from '../lib/data/labels';
  import { app } from '../lib/state/app.svelte';
  import { resetFilters, settings } from '../lib/state/settings.svelte';
  import Sheet from './Sheet.svelte';

  function toggle(code: string) {
    settings.avoid = settings.avoid.includes(code) ? settings.avoid.filter((c) => c !== code) : [...settings.avoid, code];
  }
</script>

<Sheet open={app.filters} onclose={() => (app.filters = false)} label={t('filter.label')}>
  <div class="wrap">
    <div class="head">
      <h2>{t('filter.allergens')}</h2>
      <button class="btn btn-ghost" onclick={resetFilters}>{t('filter.reset')}</button>
    </div>
    <p class="hint">{t('filter.avoidHint')}</p>

    <div class="grid" role="group" aria-label={t('filter.avoid')}>
      {#each MAIN_ALLERGENS as code (code)}
        {@const on = settings.avoid.includes(code)}
        <button class="opt" class:on aria-pressed={on} onclick={() => toggle(code)}>
          <span class="code tabular">{code}</span>
          <span class="name">{allergenName(code, app.doc)}</span>
          <span class="tick" aria-hidden="true"><Check size={14} strokeWidth={2.5} /></span>
        </button>
      {/each}
    </div>

    <label class="switch">
      <input type="checkbox" bind:checked={settings.hide} />
      <span class="track" aria-hidden="true"><span></span></span>
      <span>{t('filter.hideMode')}</span>
    </label>

    <button class="btn btn-solid done" onclick={() => (app.filters = false)}>{t('filter.done')}</button>
  </div>
</Sheet>

<style>
  .wrap {
    padding: 8px 22px 22px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 480;
    letter-spacing: -0.02em;
  }
  .hint {
    margin-top: 2px;
    font-size: 13.5px;
    color: var(--fg-3);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 6px;
    margin-top: 18px;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--fill);
    text-align: left;
    transition:
      background-color 180ms var(--ease),
      border-color 180ms var(--ease),
      color 180ms var(--ease);
  }
  .opt:hover {
    border-color: var(--line-strong);
  }
  .code {
    width: 18px;
    font-size: 11px;
    color: var(--fg-4);
  }
  .name {
    flex: 1;
    font-size: 14px;
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
  .opt.on .name {
    color: var(--fg);
  }
  .opt.on .tick {
    background: var(--invert);
    border-color: transparent;
    color: var(--invert-ink);
  }

  .switch {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
    font-size: 14px;
    color: var(--fg-2);
    cursor: pointer;
  }
  .switch input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .track {
    position: relative;
    width: 40px;
    height: 24px;
    flex: none;
    border-radius: 99px;
    background: var(--fill-3);
    transition: background-color 200ms var(--ease);
  }
  .track span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--fg);
    transition: translate 260ms var(--ease-spring);
  }
  .switch input:checked + .track {
    background: var(--invert);
  }
  .switch input:checked + .track span {
    translate: 16px 0;
    background: var(--invert-ink);
  }
  .switch input:focus-visible + .track {
    outline: 2px solid var(--fg);
    outline-offset: 2px;
  }

  .done {
    width: 100%;
    height: 46px;
    margin-top: 22px;
    font-size: 15px;
  }
</style>
