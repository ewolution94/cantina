<script lang="ts">
  import { plateDots } from '../lib/plate';
  import type { Diet } from '../lib/data/types';

  let { name, diet, size = 64 }: { name: string; diet: Diet | null; size?: number } = $props();

  const dots = $derived(plateDots(name));
</script>

<svg class="plate" data-diet={diet ?? 'none'} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
  <circle class="rim" cx="50" cy="50" r="47" />
  <circle class="well" cx="50" cy="50" r="39" />
  {#each dots as dot, i (i)}
    <circle class="tone-{dot.tone}" cx={dot.x} cy={dot.y} r={dot.r} />
  {/each}
</svg>

<style>
  .plate {
    display: block;
    overflow: visible;
  }
  .rim {
    fill: var(--fill);
    stroke: var(--line-strong);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .well {
    fill: none;
    stroke: var(--line);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .tone-0 {
    fill: var(--diet);
  }
  .tone-1 {
    fill: var(--fg-3);
    opacity: 0.7;
  }
  .tone-2 {
    fill: var(--diet);
    opacity: 0.5;
  }
  /* No diet known: the plate stays in the theme's ink. */
  [data-diet='none'] .tone-0,
  [data-diet='none'] .tone-2 {
    fill: var(--fg-2);
  }
</style>
