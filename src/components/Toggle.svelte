<script lang="ts">
  // Fermata's switch row: label and hint on the left, the switch on the right.

  let { checked = $bindable(), label, hint }: { checked: boolean; label: string; hint?: string } = $props();
</script>

<label class="toggle">
  <span class="text">
    <span class="name">{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </span>
  <input type="checkbox" role="switch" bind:checked />
  <span class="track" aria-hidden="true"><span class="knob"></span></span>
</label>

<style>
  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    cursor: pointer;
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
  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .track {
    position: relative;
    flex: none;
    width: 40px;
    height: 24px;
    border-radius: 999px;
    background: var(--fill-3);
    border: 1px solid var(--line);
    transition: background-color 200ms var(--ease);
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--fg);
    box-shadow: 0 1px 3px oklch(0 0 0 / 0.3);
    transition:
      translate 260ms var(--ease-spring),
      background-color 200ms var(--ease);
  }
  input:checked + .track {
    background: var(--invert);
    border-color: transparent;
  }
  input:checked + .track .knob {
    translate: 16px 0;
    background: var(--invert-ink);
  }
  input:focus-visible + .track {
    outline: 2px solid var(--fg);
    outline-offset: 2px;
  }
</style>
