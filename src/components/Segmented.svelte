<script lang="ts" generics="T extends string | number">
  import type { Component } from 'svelte';
  // One sliding indicator, arrow keys move the choice: the shared
  // <ewo-segmented> (Folio's elements, vendored into vendor/ewo).
  import '../../vendor/ewo/elements/segmented.js';

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

  const choices = $derived(options.map((o) => ({ value: String(o.value), label: o.label })));

  function change(event: CustomEvent<{ value: string }>) {
    const option = options.find((o) => String(o.value) === event.detail.value);
    if (option) onchange(option.value);
  }
</script>

<ewo-segmented class="seg" stretch {label} value={String(value)} options={choices} onchange={change}>
  {#each options as option (option.value)}
    {#if option.icon}<span slot="icon-{option.value}"><option.icon size={14} /></span>{/if}
  {/each}
</ewo-segmented>

<style>
  /* Cantina's proportions: a little tighter, and a flat indicator. */
  ewo-segmented::part(option) {
    padding: 0 10px;
  }
  ewo-segmented::part(indicator) {
    box-shadow: none;
  }
</style>
