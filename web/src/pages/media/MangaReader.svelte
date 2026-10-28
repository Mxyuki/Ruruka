<script lang="ts">
  import { fetchChapterPages, type ChapterPage, type MangaChapter } from '../../api/mangaSite';
  import type { MediaSummary } from '../../api/types';
  import Icon from '../../components/Icon.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import { mediaList } from '../../state/mediaList.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import { chapterName, pickVersion, type ChapterGroup } from './chapterGroups';

  interface Props {
    media: MediaSummary;
    /** Chapters with at least one version readable here, in reading order. */
    groups: ChapterGroup[];
    groupIndex: number;
    /** The version being read. */
    chapter: MangaChapter;
    onchange: (groupIndex: number, chapter: MangaChapter) => void;
    onclose: () => void;
  }

  let { media, groups, groupIndex, chapter, onchange, onclose }: Props = $props();

  // <-- Les deux pages suivantes se chargent en avance pour que tourner la page soit instantané -->
  const preloadCount = 2;

  const group = $derived(groups[groupIndex]);
  const versions = $derived(group?.versions.filter((version) => !version.externalUrl) ?? []);
  const previousGroup = $derived(groupIndex > 0 ? groupIndex - 1 : null);
  const nextGroup = $derived(groupIndex < groups.length - 1 ? groupIndex + 1 : null);

  let pages = $state<ChapterPage[]>([]);
  let pageIndex = $state(0);
  // <-- Pages passées au serveur principal, puis pages introuvables même là-bas -->
  let fallbackPages = $state(new Set<number>());
  let brokenPages = $state(new Set<number>());
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let recordedChapterId: string | null = null;
  // <-- En reculant depuis la première page, le chapitre précédent s'ouvre sur sa dernière page -->
  let opensOnLastPage = false;

  const isLastPage = $derived(pages.length > 0 && pageIndex === pages.length - 1);

  $effect(() => {
    const current = chapter;
    let isCurrent = true;
    isLoading = true;
    loadError = null;
    fetchChapterPages(current.id, session.mangaSite ?? '')
      .then((urls) => {
        if (!isCurrent) return;
        pages = urls;
        fallbackPages = new Set();
        brokenPages = new Set();
        pageIndex = opensOnLastPage ? Math.max(urls.length - 1, 0) : 0;
        opensOnLastPage = false;
      })
      .catch((error: unknown) => {
        if (isCurrent) loadError = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        if (isCurrent) isLoading = false;
      });
    return () => {
      isCurrent = false;
    };
  });

  $effect(() => {
    for (const page of pages.slice(pageIndex + 1, pageIndex + 1 + preloadCount)) new Image().src = page.url;
  });

  const sourceOf = (index: number) => (fallbackPages.has(index) ? pages[index]?.fallbackUrl : pages[index]?.url);

  function onImageError(index: number) {
    if (!fallbackPages.has(index)) fallbackPages = new Set(fallbackPages).add(index);
    else brokenPages = new Set(brokenPages).add(index);
  }

  // <-- Nouvel essai : on repart du serveur d'images bénévole, avec une adresse unique pour contourner le cache d'échec -->
  function retryPage(index: number) {
    const page = pages[index];
    if (!page) return;
    const retried = new Set(fallbackPages);
    retried.delete(index);
    fallbackPages = retried;
    const stillBroken = new Set(brokenPages);
    stillBroken.delete(index);
    brokenPages = stillBroken;
    pages[index] = { ...page, url: `${page.url.split('?')[0]}?retry=${Date.now()}` };
  }

  // <-- Arrivé à la dernière page, la liste AniList avance (chapitre et tome), une seule fois par chapitre -->
  $effect(() => {
    if (isLastPage) void markRead(chapter);
  });

  async function markRead(item: MangaChapter) {
    if (item.number === null || recordedChapterId === item.id) return;
    recordedChapterId = item.id;
    try {
      const result = await mediaList.recordRead(media, Math.floor(item.number), item.volume);
      if (result === 'updated') toasts.success(`${chapterName(item)} lu, ta liste est à jour !`);
    } catch (error) {
      recordedChapterId = null;
      toasts.error(error, 'Impossible de mettre à jour ta liste');
    }
  }

  // <-- On reste avec l'équipe du chapitre en cours tant qu'elle a traduit le suivant -->
  function openGroup(index: number) {
    const target = groups[index];
    const version = target ? pickVersion(target, chapter.group) : null;
    if (version) onchange(index, version);
  }

  function goForward() {
    if (isLoading) return;
    if (pageIndex < pages.length - 1) pageIndex += 1;
    else if (nextGroup !== null) openGroup(nextGroup);
  }

  function goBack() {
    if (isLoading) return;
    if (pageIndex > 0) {
      pageIndex -= 1;
    } else if (previousGroup !== null) {
      opensOnLastPage = true;
      openGroup(previousGroup);
    }
  }

  // <-- Après un choix, la liste rend le focus : sinon ← et → changeraient aussi sa valeur -->
  function jumpTo(event: Event & { currentTarget: HTMLSelectElement }) {
    openGroup(Number(event.currentTarget.value));
    event.currentTarget.blur();
  }

  function switchVersion(event: Event & { currentTarget: HTMLSelectElement }) {
    const version = versions.find((item) => item.id === event.currentTarget.value);
    if (version) onchange(groupIndex, version);
    event.currentTarget.blur();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onclose();
    if (event.target instanceof HTMLSelectElement) return;
    if (event.key === 'ArrowRight') goForward();
    if (event.key === 'ArrowLeft') goBack();
  }
</script>

<svelte:window {onkeydown} />

<div class="reader" role="dialog" aria-modal="true" aria-label="Lecture de {media.title.userPreferred}">
  <header>
    <div class="title">
      <strong>{media.title.userPreferred}</strong>
      <span>{chapter.volume ? `Tome ${chapter.volume} · ` : ''}{chapterName(chapter)}{chapter.title ? ` · ${chapter.title}` : ''}</span>
    </div>
    {#if versions.length > 1}
      <!-- Plusieurs équipes ont traduit ce chapitre : on choisit la sienne -->
      <label class="team">
        Traduction
        <select class="select picker" value={chapter.id} onchange={switchVersion}>
          {#each versions as version (version.id)}
            <option value={version.id}>{version.group ?? 'Équipe inconnue'}</option>
          {/each}
        </select>
      </label>
    {:else if chapter.group}
      <span class="team">Traduction : {chapter.group}</span>
    {/if}
    {#if pages.length && !isLoading}
      <span class="counter">Page {pageIndex + 1} / {pages.length}</span>
    {/if}
    <div class="actions">
      <button class="btn btn-sm" type="button" disabled={previousGroup === null} onclick={() => previousGroup !== null && openGroup(previousGroup)}>
        <Icon name="chevronLeft" size={14} /> Chapitre précédent
      </button>
      <!-- Saut direct vers n'importe quel chapitre -->
      <select class="select picker" aria-label="Aller au chapitre" value={groupIndex} onchange={jumpTo}>
        {#each groups as item, itemIndex (item.key)}
          <option value={itemIndex}>{item.volume ? `T.${item.volume} · ` : ''}{chapterName(item)}</option>
        {/each}
      </select>
      <button class="btn btn-sm" type="button" disabled={nextGroup === null} onclick={() => nextGroup !== null && openGroup(nextGroup)}>
        Chapitre suivant <Icon name="chevronRight" size={14} />
      </button>
      <button class="btn btn-sm btn-icon" type="button" aria-label="Fermer la lecture" onclick={onclose}><Icon name="close" size={16} /></button>
    </div>
  </header>

  <div class="stage">
    {#if isLoading}
      <LoadingState label="Mashutan tourne les pages…" />
    {:else if loadError}
      <p class="message">{loadError}</p>
    {:else if pages[pageIndex]}
      {#if brokenPages.has(pageIndex)}
        <div class="broken">
          <p>Cette page refuse de s’afficher, même depuis le serveur principal du site.</p>
          <button class="btn btn-primary" type="button" onclick={() => retryPage(pageIndex)}><Icon name="refresh" size={14} /> Réessayer</button>
        </div>
      {:else}
        {#key sourceOf(pageIndex)}
          <img src={sourceOf(pageIndex)} alt="Page {pageIndex + 1}" referrerpolicy="no-referrer" onerror={() => onImageError(pageIndex)} />
        {/key}
      {/if}
      <!-- Moitié gauche : page précédente ; moitié droite : page suivante -->
      <button class="zone previous" type="button" aria-label="Page précédente" onclick={goBack}><Icon name="chevronLeft" size={28} /></button>
      <button class="zone next" type="button" aria-label="Page suivante" onclick={goForward}><Icon name="chevronRight" size={28} /></button>
      {#if isLastPage}
        <p class="hint">
          {nextGroup !== null && groups[nextGroup] ? `Page suivante : ${chapterName(groups[nextGroup])}` : 'Dernier chapitre disponible dans cette langue.'}
        </p>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* <-- La lecture prend toute la fenêtre, sur fond d'encre pour laisser la page respirer --> */
  .reader {
    position: fixed;
    inset: var(--titleBarHeight) 0 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    background: var(--colorInk);
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space3);
    padding: var(--space3) var(--space5);
    border-bottom: 2px solid var(--colorPlum);
    background: var(--colorInk);
    color: var(--onImage);
  }

  .title {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .title span {
    color: var(--onImageMuted);
    font-size: var(--fontSizeSm);
    font-weight: 700;
  }

  .team {
    display: flex;
    align-items: center;
    gap: var(--space2);
    color: var(--onImageMuted);
    font-size: var(--fontSizeSm);
    font-weight: 700;
  }

  .counter {
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space2);
  }

  /* <-- Barre sombre pendant la lecture : boutons et listes passent en encre pour ne pas éblouir --> */
  .actions :global(.btn),
  .picker {
    border-color: var(--colorPlum);
    background: var(--colorInk);
    box-shadow: 2px 2px 0 var(--colorPlum);
    color: var(--onImage);
  }

  .actions :global(.btn:hover:not(:disabled)) {
    background: var(--colorPlum);
  }

  .picker {
    width: auto;
    max-width: 220px;
  }

  .picker option {
    background: var(--colorInk);
    color: var(--onImage);
  }

  .stage {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: var(--space3);
  }

  .stage img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    user-select: none;
  }

  /* <-- Deux grandes zones cliquables invisibles ; la flèche n'apparaît qu'au survol --> */
  .zone {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    width: 50%;
    padding: 0 var(--space5);
    border: 0;
    background: none;
    color: var(--onImage);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--transitionFast);
  }

  .zone:hover {
    opacity: 0.8;
  }

  /* <-- Les flèches du clavier tournent déjà les pages : pas de contour de focus sur les zones après un clic --> */
  .zone:focus {
    outline: none;
  }

  .zone.previous {
    left: 0;
    justify-content: flex-start;
  }

  .zone.next {
    right: 0;
    justify-content: flex-end;
  }

  .hint {
    position: absolute;
    bottom: var(--space3);
    padding: 4px 14px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    font-size: var(--fontSizeSm);
    font-weight: 800;
    pointer-events: none;
  }

  .message {
    color: var(--onImage);
  }

  .broken {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space3);
    max-width: 420px;
    color: var(--onImage);
    text-align: center;
  }
</style>
