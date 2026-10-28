<script lang="ts">
  import { untrack } from 'svelte';
  import { quickSearchMedia } from '../../api/queries/media';
  import type { MediaSummary } from '../../api/types';
  import Modal from '../../components/Modal.svelte';
  import type { LibraryFolder } from '../../lib/bridge';
  import { formatEnum } from '../../lib/format';
  import { library } from '../../state/library.svelte';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    folder: LibraryFolder;
    onclose: () => void;
  }

  let { folder, onclose }: Props = $props();

  const searchDelayMs = 400;
  // <-- Le sélecteur est créé pour un seul dossier : on part de ses valeurs initiales -->
  let query = $state(untrack(() => folder.guessedTitle));
  let results = $state<MediaSummary[]>(untrack(() => library.suggestions.get(folder.name) ?? []));
  let isSearching = $state(false);
  let timer: ReturnType<typeof setTimeout>;

  $effect(() => {
    const search = query.trim();
    clearTimeout(timer);
    if (!search) return;
    timer = setTimeout(async () => {
      isSearching = true;
      try {
        results = await quickSearchMedia(search);
      } catch (error) {
        toasts.error(error, 'La recherche a échoué');
      } finally {
        isSearching = false;
      }
    }, searchDelayMs);
  });

  async function choose(media: MediaSummary) {
    try {
      await library.link(folder, media);
      toasts.success(`« ${folder.name} » est lié à ${media.title.userPreferred} !`);
      onclose();
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer le lien');
    }
  }
</script>

<Modal open title="Lier le dossier" width="620px" {onclose}>
  <p class="folder faint">{folder.name}</p>
  <input class="input" type="search" placeholder="Chercher sur AniList…" bind:value={query} />

  <ul class:is-searching={isSearching}>
    {#each results as media (media.id)}
      <li>
        <button type="button" onclick={() => choose(media)}>
          <img src={media.coverImage.medium} alt="" loading="lazy" width="40" height="56" />
          <span class="info">
            <span class="title">{media.title.userPreferred}</span>
            <span class="faint">
              {[formatEnum(media.format), media.seasonYear, media.episodes && `${media.episodes} ép.`].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>
      </li>
    {:else}
      <li class="faint empty">{isSearching ? 'Recherche…' : 'Pas encore de résultat'}</li>
    {/each}
  </ul>
</Modal>

<style>
  .folder {
    margin-bottom: var(--space3);
    font-size: var(--fontSizeSm);
    word-break: break-all;
  }

  ul {
    max-height: 420px;
    margin: var(--space3) 0 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    transition: opacity var(--transitionFast);
  }

  ul.is-searching {
    opacity: 0.6;
  }

  button {
    display: flex;
    align-items: center;
    gap: var(--space3);
    width: 100%;
    padding: var(--space2);
    border: 0;
    border-radius: var(--radiusSmall);
    background: none;
    cursor: pointer;
    text-align: left;
  }

  button:hover {
    background: var(--colorSunken);
  }

  img {
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .info {
    display: flex;
    flex-direction: column;
    font-size: var(--fontSizeXs);
  }

  .title {
    font-size: var(--fontSizeSm);
    font-weight: 600;
  }

  .empty {
    padding: var(--space4);
    text-align: center;
  }
</style>
