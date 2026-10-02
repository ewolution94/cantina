<script lang="ts">
  import { DISH, FORK, KNIFE, PLATE, VIEWBOX } from '../lib/mark';

  let { size = 28 }: { size?: number } = $props();
</script>

<svg class="logo" width={size} height={size} viewBox={VIEWBOX} aria-hidden="true">
  <!-- Fork, plate, knife: they rise in one after the other. -->
  <path class="fork" d={FORK} />
  <g class="plate">
    <path d={PLATE} fill-rule="evenodd" />
    <circle cx={DISH.cx} cy={DISH.cy} r={DISH.r} />
  </g>
  <path class="knife" d={KNIFE} />
</svg>

<style>
  .logo {
    display: block;
    flex: none;
    color: var(--fg);
    fill: currentColor;
  }
  .fork,
  .plate,
  .knife {
    animation: rise-in 700ms var(--ease-spring) backwards;
  }
  .plate {
    animation-delay: 90ms;
  }
  .knife {
    animation-delay: 180ms;
  }
  /* In the viewBox's units: 110 of 708 is about 4 px at header size. */
  @keyframes rise-in {
    from {
      opacity: 0;
      translate: 0 110px;
    }
  }
</style>
