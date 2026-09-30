<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts } from '../lib/state/toasts.svelte';
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts as toast (toast.id)}
    <p class="toast panel" transition:fly={{ y: 16, duration: 280 }}>{toast.text}</p>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 50%;
    bottom: calc(20px + env(safe-area-inset-bottom));
    z-index: 60;
    translate: -50% 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    width: max-content;
    max-width: calc(100vw - 32px);
  }
  .toast {
    padding: 10px 16px;
    border-radius: 14px;
    font-size: 13.5px;
    text-align: center;
  }
</style>
