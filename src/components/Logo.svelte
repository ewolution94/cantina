<script lang="ts">
  import { MARK } from '../lib/mark';

  let { size = 28 }: { size?: number } = $props();
</script>

<svg class="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
  <!-- Fork first, then spoon: they rise in one after the other. -->
  <g class="fork">
    {#each MARK.slice(0, 5) as shape, i (i)}
      {#if shape.tag === 'rect'}<rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />
      {:else if shape.tag === 'ellipse'}<ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
      {:else}<path d={shape.d} />{/if}
    {/each}
  </g>
  <g class="spoon">
    {#each MARK.slice(5) as shape, i (i)}
      {#if shape.tag === 'rect'}<rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />
      {:else if shape.tag === 'ellipse'}<ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
      {:else}<path d={shape.d} />{/if}
    {/each}
  </g>
</svg>

<style>
  .logo {
    display: block;
    flex: none;
    color: var(--fg);
    fill: currentColor;
  }
  g {
    animation: rise-in 700ms var(--ease-spring) backwards;
  }
  .spoon {
    animation-delay: 90ms;
  }
  @keyframes rise-in {
    from {
      opacity: 0;
      translate: 0 5px;
    }
  }
</style>
