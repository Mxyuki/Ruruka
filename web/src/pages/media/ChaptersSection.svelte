<script lang="ts">
  import { fetchChapters, findSiteManga, type MangaChapter, type MangaLookup, type SiteManga } from '../../api/mangaSite';
  import type { MediaSummary } from '../../api/types';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import Section from '../../components/Section.svelte';
  import { mediaList } from '../../state/mediaList.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import MangaReader from './MangaReader.svelte';
  import { groupChapters, isReadableGroup, pickVersion, type ChapterGroup } from './chapterGroups';

  interface Props {
    media: MediaSummary & MangaLookup;
    isOpen: boolean;
  }

  let { media, isOpen = $bindable() }: Props = $props();

  const languageNames = new Intl.DisplayNames(['fr'], { type: 'language' });
  const fallbackLanguage = 'en';

  // <-- Le site de lecture n'est interrogé qu'à l'ouverture du menu (ou par le bouton « Chapitres » du dossier) -->
  const manga = $derived(isOpen ? findSiteManga(media) : null);
  let chosenLanguage = $state<string | null>(null);
  let reading = $state<{ groupIndex: number; chapter: MangaChapter } | null>(null);
  // <-- L'équipe du dernier chapitre ouvert : « Reprendre » et la liste la privilégient ensuite -->
  let lastTeam = $state<string | null>(null);

  const progress = $derived(mediaList.entryFor(media.id)?.progress ?? 0);

  function languageFor(found: SiteManga): string {
    const wanted = chosenLanguage ?? session.settings?.mangaLanguage ?? 'fr';
    if (found.languages.includes(wanted)) return wanted;
    return found.languages.includes(fallbackLanguage) ? fallbackLanguage : (found.languages[0] ?? wanted);
  }

  const languageLabel = (code: string) => {
    const name = languageNames.of(code) ?? code;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  async function chooseLanguage(code: string) {
    chosenLanguage = code;
    try {
      await session.updateSettings({ mangaLanguage: code });
    } catch (error) {
      toasts.error(error, 'Impossible de retenir la langue');
    }
  }

  const isRead = (group: ChapterGroup) => group.number !== null && group.number <= progress;
  const nextToRead = (groups: ChapterGroup[]) => groups.findIndex((group) => !isRead(group));

  function read(groups: ChapterGroup[], groupIndex: number, version?: MangaChapter) {
    const target = groups[groupIndex];
    const chapter = version ?? (target ? pickVersion(target, lastTeam) : null);
    if (!chapter) return;
    reading = { groupIndex, chapter };
    lastTeam = chapter.group;
  }

  // <-- La liste défile seule jusqu'au chapitre à lire, sans bouger le reste de la page -->
  function centerInList(row: HTMLElement) {
    const list = row.parentElement;
    if (list) list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2;
  }
</script>

<div id="chapters-section">
  <Section title="Les chapitres">
    <div class="card chapters">
      <button class="disclosure" type="button" aria-expanded={isOpen} onclick={() => (isOpen = !isOpen)}>
        {#if session.mangaSite}<img src="{session.mangaSite}/favicon.ico" alt="" width="20" height="20" />{/if}
        <span class="label">Lire les chapitres</span>
        <span class="chevron" class:is-open={isOpen}><Icon name="chevronDown" size={18} /></span>
      </button>

      {#if manga}
        <div class="body">
          {#await manga}
            <LoadingState label="Mashutan cherche le manga…" />
          {:then found}
            {#if !found}
              <EmptyState title="Manga introuvable" message="Le site de lecture n’a aucun manga relié à cette fiche AniList." />
            {:else if !found.languages.length}
              <EmptyState title="Aucun chapitre" message="Le site de lecture n’héberge aucun chapitre de ce manga." />
            {:else}
              {@const language = languageFor(found)}
              <div class="toolbar">
                <label>
                  <span>Langue</span>
                  <select class="select" value={language} onchange={(event) => chooseLanguage(event.currentTarget.value)}>
                    {#each [...found.languages].sort((a, b) => languageLabel(a).localeCompare(languageLabel(b))) as code (code)}
                      <option value={code}>{languageLabel(code)}</option>
                    {/each}
                  </select>
                </label>
                {#if session.mangaSite}
                  <a class="btn btn-ghost btn-sm" href="{session.mangaSite}/title/{found.id}" target="_blank" rel="noopener noreferrer">
                    <Icon name="external" size={14} /> Page du manga
                  </a>
                {/if}
              </div>

              {#await fetchChapters(found.id, language)}
                <LoadingState label="Mashutan range les chapitres…" />
              {:then chapters}
                {@const allGroups = groupChapters(chapters)}
                {@const groups = allGroups.filter(isReadableGroup)}
                {@const next = nextToRead(groups)}
                {#if !chapters.length}
                  <p class="empty">Aucun chapitre en {languageLabel(language).toLowerCase()} pour l’instant.</p>
                {:else}
                  {#if next >= 0}
                    <button class="btn btn-primary resume" type="button" onclick={() => read(groups, next)}>
                      <Icon name="book" size={16} />
                      {progress ? 'Reprendre' : 'Commencer'} : chapitre {groups[next]?.label ?? ''}
                    </button>
                  {/if}
                  <ol>
                    {#each allGroups as group (group.key)}
                      {@const groupIndex = groups.indexOf(group)}
                      {@const isNext = groupIndex >= 0 && groupIndex === next}
                      <li class:is-read={isRead(group)} class:is-next={isNext} {@attach isNext && centerInList}>
                        <!-- Le chapitre lui-même s'ouvre au clic, avec l'équipe préférée -->
                        {#if groupIndex >= 0}
                          <button class="chapter-link" type="button" onclick={() => read(groups, groupIndex)}>
                            <span class="number">{group.volume ? `T.${group.volume} · ` : ''}{group.label ? `Ch. ${group.label}` : 'Oneshot'}</span>
                            <span class="title">{group.title ?? ''}</span>
                          </button>
                        {:else}
                          <a class="chapter-link" href={group.versions[0]?.externalUrl} target="_blank" rel="noopener noreferrer" title="Hébergé par l’éditeur, s’ouvre dans le navigateur">
                            <span class="number">{group.volume ? `T.${group.volume} · ` : ''}{group.label ? `Ch. ${group.label}` : 'Oneshot'}</span>
                            <span class="title">{group.title ?? ''}</span>
                          </a>
                        {/if}
                        {#if isRead(group)}<span class="read-mark"><Icon name="check" size={12} /> Lu</span>{:else if isNext}<span class="next-mark">à lire</span>{/if}
                        <!-- Une pastille par équipe de traduction, à droite : cliquer lit sa version -->
                        <span class="versions">
                          {#each group.versions as version (version.id)}
                            {#if version.externalUrl}
                              <a class="version is-external" href={version.externalUrl} target="_blank" rel="noopener noreferrer" title="Hébergé par l’éditeur, s’ouvre dans le navigateur">
                                <Icon name="external" size={12} /> {version.group ?? 'Chez l’éditeur'}
                              </a>
                            {:else}
                              <button class="version" class:is-preferred={lastTeam !== null && version.group === lastTeam} type="button" title="Lire la traduction de {version.group ?? 'cette équipe'}" onclick={() => read(groups, groupIndex, version)}>
                                {version.group ?? 'Équipe inconnue'}
                              </button>
                            {/if}
                          {/each}
                        </span>
                      </li>
                    {/each}
                  </ol>
                  {#if reading}
                    <MangaReader
                      {media}
                      {groups}
                      groupIndex={reading.groupIndex}
                      chapter={reading.chapter}
                      onchange={(groupIndex, chapter) => read(groups, groupIndex, chapter)}
                      onclose={() => (reading = null)}
                    />
                  {/if}
                {/if}
              {:catch error}
                <EmptyState title="Chapitres inaccessibles" message={error.message} />
              {/await}
            {/if}
          {:catch error}
            <EmptyState title="Le site de lecture ne répond pas" message={error.message} />
          {/await}
        </div>
      {/if}
    </div>
  </Section>
</div>

<style>
  .chapters {
    overflow: hidden;
  }

  .disclosure {
    display: flex;
    align-items: center;
    gap: var(--space3);
    width: 100%;
    padding: var(--space4) var(--space5);
    border: 0;
    background: var(--colorPaper);
    color: var(--textMain);
    cursor: pointer;
    font-family: var(--fontText);
    font-size: var(--fontSizeMd);
    font-weight: 800;
    text-align: left;
    transition: background var(--transitionFast);
  }

  .disclosure:hover {
    background: var(--colorBlond);
  }

  .label {
    flex: 1;
  }

  .chevron {
    display: inline-flex;
    transition: transform 0.25s var(--easeSpring);
  }

  .chevron.is-open {
    transform: rotate(180deg);
  }

  .body {
    border-top: var(--outlineThin);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space3);
    padding: var(--space4);
    background: var(--colorSunken);
  }

  .toolbar label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 200px;
  }

  .toolbar label span {
    font-size: var(--fontSizeXs);
    font-weight: 800;
    text-transform: uppercase;
  }

  .resume {
    margin: var(--space4) var(--space4) 0;
  }

  ol {
    position: relative;
    max-height: 560px;
    margin: var(--space3) 0 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space3);
    padding: var(--space2) var(--space4);
    border-top: 1px dashed var(--colorLineStrong);
    content-visibility: auto;
    contain-intrinsic-size: auto 48px;
  }

  /* <-- Chapitres lus grisés, prochain chapitre surligné comme une piste à suivre --> */
  li.is-read {
    background: var(--colorSunken);
    color: var(--textFaint);
  }

  li.is-read .chapter-link {
    opacity: 0.55;
  }

  li.is-next {
    position: relative;
    border: var(--outline);
    background: var(--colorBlond);
    box-shadow: inset 6px 0 0 var(--colorStar);
    font-weight: 800;
  }

  .next-mark {
    padding: 1px 10px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorStar);
    font-size: var(--fontSizeXs);
    font-weight: 800;
  }

  .chapter-link {
    display: flex;
    flex: 1;
    align-items: baseline;
    gap: var(--space3);
    min-width: 0;
    padding: 4px 0;
    border: 0;
    background: none;
    color: inherit;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .chapter-link:hover .title,
  .chapter-link:hover .number {
    color: var(--textSoft);
    text-decoration: underline;
    text-decoration-color: var(--colorStar);
    text-decoration-thickness: 3px;
  }

  .number {
    flex-shrink: 0;
    min-width: 110px;
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
  }

  .title {
    overflow: hidden;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .versions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px var(--space2);
    max-width: 45%;
  }

  /* <-- L'équipe de traduction se lit d'un coup d'œil ; celle du dernier chapitre lu est en jaune --> */
  .version {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 10px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    color: var(--textMain);
    cursor: pointer;
    font-family: var(--fontText);
    font-size: var(--fontSizeXs);
    font-weight: 800;
  }

  .version:hover {
    background: var(--colorSky);
  }

  .version.is-preferred {
    background: var(--colorStar);
  }

  .version.is-external {
    border-style: dashed;
    color: var(--textFaint);
  }

  /* <-- Pastille « Lu » : même forme que « à lire », en vert pour les chapitres déjà résolus --> */
  .read-mark {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 10px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    color: var(--colorSuccess);
    font-size: var(--fontSizeXs);
    font-weight: 800;
  }

  .empty {
    padding: var(--space5);
    color: var(--textFaint);
    font-family: var(--fontHand);
    font-size: var(--fontSizeLg);
  }
</style>
