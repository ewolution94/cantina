<script lang="ts">
  import { MARK_DOTS } from '../lib/mark';

  let { size = 28 }: { size?: number } = $props();
</script>

<svg class="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
  {#each MARK_DOTS as dot, i (i)}
    <circle cx={dot.x} cy={dot.y} r={dot.r} style:--i={i} />
  {/each}
</svg>

<style>
  .logo {
    display: block;
    flex: none;
    color: var(--fg);
  }
  circle {
    fill: currentColor;
    transform-box: fill-box;
    transform-origin: center;
    animation: dot-in 700ms var(--ease-spring) backwards;
    animation-delay: calc(var(--i) * 28ms);
  }
  @keyframes dot-in {
    from {
      scale: 0;
    }
  }
</style>
