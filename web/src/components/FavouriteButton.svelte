<script lang="ts">
  import { session } from '../state/session.svelte';
  import { toasts } from '../state/toasts.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    /** What AniList says when the page loads. */
    isFavourite: boolean;
    /** Flips the favourite on AniList; the heart is already switched when this runs. */
    ontoggle: () => Promise<void>;
  }

  let { isFavourite: initial, ontoggle }: Props = $props();

  let isFavourite = $state(false);
  let isSaving = $state(false);

  $effect.pre(() => {
    isFavourite = initial;
  });

  async function toggle() {
    if (isSaving) return;
    isSaving = true;
    isFavourite = !isFavourite;
    try {
      await ontoggle();
    } catch (error) {
      isFavourite = !isFavourite;
      toasts.error(error, 'Impossible de modifier les favoris');
    } finally {
      isSaving = false;
    }
  }
</script>

{#if session.viewer}
  <button class="btn btn-ghost" class:is-active={isFavourite} type="button" aria-pressed={isFavourite} data-sparkle onclick={toggle}>
    <Icon name="heart" size={16} filled={isFavourite} />
    {isFavourite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
  </button>
{/if}

<style>
  .is-active :global(svg) {
    color: var(--colorStrawberry);
  }
</style>
