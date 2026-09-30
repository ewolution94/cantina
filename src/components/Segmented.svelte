<script lang="ts" generics="T extends string | number">
  import type { Component } from 'svelte';

  // Fermata's segmented control: one sliding indicator, arrow keys move the choice.

  let {
    value,
    options,
    onchange,
    label,
  }: {
    value: T;
    options: { value: T; label: string; icon?: Component<{ size?: number }> }[];
    onchange: (value: T) => void;
    label: string;
  } = $props();

  const index = $derived(Math.max(0, options.findIndex((o) => o.value === value)));

  function onkeydown(event: KeyboardEvent) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    const next = (index + step + options.length) % options.length;
    onchange(options[next].value);
    // +1 skips the indicator element.
    ((event.currentTarget as HTMLElement).children[next + 1] as HTMLElement | undefined)?.focus();
  }
</script>

<div class="seg" role="radiogroup" aria-label={label} style:--n={options.length} style:--i={index} tabindex="-1" {onkeydown}>
  <span class="indicator" aria-hidden="true"></span>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      tabindex={option.value === value ? 0 : -1}
      onclick={() => onchange(option.value)}
    >
      {#if option.icon}<option.icon size={14} />{/if}
      {option.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    padding: 3px;
    border-radius: 999px;
    background: var(--fill);
    border: 1px solid var(--line);
    outline: none;
  }
  .indicator {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc((100% - 6px) / var(--n));
    translate: calc(var(--i) * 100%) 0;
    border-radius: 999px;
    background: var(--fill-3);
    transition: translate 320ms var(--ease-spring);
  }
  button {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-2);
    white-space: nowrap;
    transition: color 200ms var(--ease);
  }
  button:hover,
  button[aria-checked='true'] {
    color: var(--fg);
  }
</style>
