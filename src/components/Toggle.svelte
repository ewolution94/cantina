<script lang="ts">
  // The settings switch row: label and hint on the left, the switch on the right.
  // It's the shared <ewo-switch> (Folio's elements, vendored into vendor/ewo).
  import '../../vendor/ewo/elements/switch.js';

  let { checked = $bindable(), label, hint }: { checked: boolean; label: string; hint?: string } = $props();
</script>

<ewo-switch row {checked} onchange={(event) => (checked = event.detail.checked)}>
  {label}
  {#if hint}<span slot="hint">{hint}</span>{/if}
</ewo-switch>
