<script lang="ts">
  import Kira from './Kira.svelte';

  interface Props {
    /** File name inside web/public/art/, see docs/concept/concept-art.md. */
    name: string;
    width: number;
    height: number;
  }

  let { name, width, height }: Props = $props();

  let isMissing = $state(false);
</script>

<!-- Emplacement d'illustration : l'image de l'utilisatrice, ou un cadre vide de carnet tant qu'elle manque -->
{#if isMissing}
  <span class="placeholder" style:width="{width}px" style:height="{height}px" aria-hidden="true">
    <Kira size={Math.min(width, height) / 4} />
  </span>
{:else}
  <img src="./art/{name}" alt="" {width} {height} onerror={() => (isMissing = true)} />
{/if}

<style>
  img {
    flex-shrink: 0;
    object-fit: contain;
  }

  .placeholder {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    border: 2px dashed var(--colorLilac);
    border-radius: var(--radiusLarge);
    background: var(--screentone), var(--colorSunken);
  }
</style>
