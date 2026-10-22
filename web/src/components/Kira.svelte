<script lang="ts">
  interface Props {
    size?: number;
    color?: string;
  }

  let { size = 18, color = 'var(--colorStar)' }: Props = $props();
</script>

<svg class="kira" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style:fill={color}>
  <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" />
</svg>

<style>
  .kira {
    flex-shrink: 0;
    stroke: var(--colorInk);
    stroke-width: 1.2;
    stroke-linejoin: round;
  }
</style>
