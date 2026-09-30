<script lang="ts">
  import WifiOff from '@lucide/svelte/icons/wifi-off';
  import { formatClock, t } from '../lib/i18n/index.svelte';
  import { app } from '../lib/state/app.svelte';
</script>

<footer>
  <div class="inner">
    {#if app.doc}
      <span class:offline={app.offline}>
        {#if app.offline}<WifiOff size={13} />{/if}
        {app.offline ? t('app.offline', { time: formatClock(app.doc.fetchedAt) }) : t('app.updated', { time: formatClock(app.doc.fetchedAt) })}
      </span>
    {/if}
    <a href="https://kochwerk-web.webspeiseplan.de/menu" target="_blank" rel="noopener">{t('app.source')} ↗</a>
  </div>
</footer>

<style>
  footer {
    margin-top: auto;
    padding: 56px 0 calc(24px + env(safe-area-inset-bottom));
  }
  .inner {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 24px;
    max-width: var(--page);
    margin: 0 auto;
    padding: 18px var(--gutter) 0;
    border-top: 1px solid var(--line);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--fg-4);
  }
  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .offline {
    color: var(--soon);
  }
  a {
    text-decoration: none;
  }
  a:hover {
    color: var(--fg-2);
  }
</style>
