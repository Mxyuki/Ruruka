<script lang="ts">
  import Modal from '../../components/Modal.svelte';
  import { mediaPath } from '../../lib/routes';
  import { toasts } from '../../state/toasts.svelte';
  import { calendar } from './calendar.svelte';

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  async function show(mediaId: number) {
    try {
      await calendar.show(mediaId);
    } catch (error) {
      toasts.error(error, 'Impossible de réafficher cet anime');
    }
  }
</script>

<Modal open title="Anime masqués" {onclose}>
  <p class="muted">Ils ne s'affichent plus dans le calendrier. Un anime terminé quitte cette liste tout seul.</p>

  <ul>
    {#each calendar.hiddenMedia as media (media.id)}
      <li>
        <img src={media.coverImage.medium} alt="" loading="lazy" width="40" height="56" />
        <a class="title" href="#{mediaPath(media.id)}" onclick={onclose}>{media.title.userPreferred}</a>
        <button class="btn btn-sm" type="button" onclick={() => show(media.id)}>Réafficher</button>
      </li>
    {:else}
      <li class="faint">Aucun anime masqué pour l'instant.</li>
    {/each}
  </ul>
</Modal>

<style>
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
    margin: var(--space3) 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space3);
  }

  img {
    flex-shrink: 0;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .title {
    flex: 1;
    min-width: 0;
    font-weight: 800;
  }

  .title:hover {
    text-decoration: underline;
    text-decoration-color: var(--colorStar);
    text-decoration-thickness: 3px;
  }
</style>
