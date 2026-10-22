<script lang="ts">
  type StickerName = 'etoile' | 'loupe' | 'coeur' | 'bonbon' | 'lune' | 'ruban';

  interface Props {
    name: StickerName;
    size?: number;
    rotate?: number;
    /** Placement inside the nearest positioned parent, e.g. "top: -20px; right: 30px". */
    position: string;
  }

  let { name, size = 64, rotate = 0, position }: Props = $props();
</script>

<!-- Autocollant décoratif posé sur un coin, sans gêner les clics -->
<img
  class="sticker"
  src="./art/autocollants/{name}.png"
  alt=""
  aria-hidden="true"
  width={size}
  style="{position}; --rotate: {rotate}deg"
/>

<style>
  .sticker {
    position: absolute;
    z-index: 2;
    height: auto;
    filter: drop-shadow(2px 3px 0 rgb(43 30 48 / 0.25));
    pointer-events: none;
    transform: rotate(var(--rotate));
  }
</style>
