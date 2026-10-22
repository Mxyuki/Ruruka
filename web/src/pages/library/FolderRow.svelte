<script lang="ts">
  import Icon from '../../components/Icon.svelte';
  import { invoke, type LibraryFolder } from '../../lib/bridge';
  import { mediaPath } from '../../lib/routes';
  import { library } from '../../state/library.svelte';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    folder: LibraryFolder;
    onpick: () => void;
  }

  let { folder, onpick }: Props = $props();

  const link = $derived(library.linkFor(folder.name));
  const media = $derived(link?.mediaId ? library.mediaById.get(link.mediaId) : undefined);
  const numbered = $derived(folder.episodes.filter((episode) => episode.number !== null));
  const episodeRange = $derived(
    numbered.length ? `ép. ${numbered[0]!.number}–${numbered[numbered.length - 1]!.number}` : 'aucun numéro d’épisode trouvé',
  );

  async function run(task: () => Promise<unknown>) {
    try {
      await task();
    } catch (error) {
      toasts.error(error);
    }
  }
</script>

<div class="row">
  <div class="folder">
    <span class="name" title={folder.path}>{folder.name}</span>
    <span class="faint">{folder.episodes.length} fichiers · {episodeRange}</span>
  </div>

  <div class="link">
    {#if media}
      <a class="media" href="#{mediaPath(media.id)}">
        <img src={media.coverImage.medium} alt="" loading="lazy" width="30" height="42" />
        <span>{media.title.userPreferred}</span>
      </a>
      <span class="badge" class:is-manual={link?.kind === 'manual'}>{link?.kind === 'manual' ? 'À la main' : 'Auto'}</span>
    {:else if link?.mediaId}
      <span class="faint">AniList #{link.mediaId}</span>
    {:else if link?.kind === 'manual'}
      <span class="faint">Ignoré</span>
    {:else}
      <span class="unmatched">Pas de piste sûre pour "{folder.guessedTitle}"</span>
    {/if}
  </div>

  {#if link?.mediaId}
    <label class="offset" title="À soustraire des numéros de fichier, par exemple 12 quand la saison 2 est numérotée 13 à 24">
      <span class="faint">Décalage</span>
      <input
        class="input"
        type="number"
        min="0"
        value={link.episodeOffset}
        onchange={(event) => run(() => library.setEpisodeOffset(folder, Number(event.currentTarget.value) || 0))}
      />
    </label>
  {:else}
    <span></span>
  {/if}

  <div class="actions">
    <button class="btn btn-sm" class:btn-primary={!link?.mediaId} type="button" onclick={onpick}>
      <Icon name="link" size={14} /> {link?.mediaId ? 'Changer' : 'Lier'}
    </button>
    {#if link?.mediaId}
      <button class="btn btn-ghost btn-sm" type="button" title="Délier et ignorer" onclick={() => run(() => library.unlink(folder))}>
        <Icon name="unlink" size={14} />
      </button>
    {:else}
      <button class="btn btn-ghost btn-sm" type="button" title="Relancer la recherche automatique" onclick={() => run(() => library.retryMatch(folder))}>
        <Icon name="refresh" size={14} />
      </button>
    {/if}
    <button class="btn btn-ghost btn-sm" type="button" title="Ouvrir le dossier" onclick={() => run(() => invoke('shell.openPath', { path: folder.path }))}>
      <Icon name="folder" size={14} />
    </button>
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 110px auto;
    align-items: center;
    gap: var(--space4);
    padding: var(--space3) var(--space4);
    border-bottom: 1px solid var(--colorLine);
    content-visibility: auto;
    contain-intrinsic-size: auto 66px;
  }

  .row:last-child {
    border-bottom: 0;
  }

  .folder {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: var(--fontSizeXs);
  }

  .name {
    overflow: hidden;
    font-size: var(--fontSizeSm);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .link {
    display: flex;
    align-items: center;
    gap: var(--space2);
    min-width: 0;
    font-size: var(--fontSizeSm);
  }

  .media {
    display: flex;
    align-items: center;
    gap: var(--space2);
    min-width: 0;
  }

  .media span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .media:hover span {
    color: var(--textSoft);
  }

  .media img {
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .badge {
    padding: 1px 8px;
    border-radius: var(--radiusPill);
    background: var(--colorMauveSoft);
    color: var(--textSoft);
    font-size: var(--fontSizeXs);
  }

  .badge.is-manual {
    background: var(--colorBlond);
    color: var(--textSoft);
  }

  .unmatched {
    color: var(--colorWarning);
  }

  .offset {
    display: flex;
    align-items: center;
    gap: var(--space2);
    font-size: var(--fontSizeXs);
  }

  .offset input {
    width: 60px;
    padding: 4px 8px;
  }

  .actions {
    display: flex;
    gap: var(--space1);
  }
</style>
