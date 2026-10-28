<script lang="ts">
  import { fetchAnimeSongs, type AnimeSong, type SongLookup } from '../../api/anisongdb';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import Section from '../../components/Section.svelte';
  import SongFilterBar from './SongFilterBar.svelte';
  import SongRow, { type SongSource } from './SongRow.svelte';
  import { emptySongFilters, filterSongs } from './songFilters';

  interface Props {
    media: SongLookup;
  }

  let { media }: Props = $props();

  let isOpen = $state(false);
  // <-- AnisongDB n'est appelé qu'à la première ouverture du menu -->
  let songs = $state<Promise<AnimeSong[]> | null>(null);
  let playing = $state<{ songId: number; source: SongSource } | null>(null);
  let filters = $state(emptySongFilters());

  function toggle() {
    isOpen = !isOpen;
    if (isOpen) songs = fetchAnimeSongs(media);
    else playing = null;
  }

  function play(songId: number, source: SongSource | null) {
    playing = source ? { songId, source } : null;
  }

  const countLabel = (list: AnimeSong[]) => `${list.length} musique${list.length === 1 ? '' : 's'}`;
</script>

<Section title="La bande-son">
  <div class="card songs">
    <button class="disclosure" type="button" aria-expanded={isOpen} onclick={toggle}>
      <Icon name="music" size={20} />
      <span class="label">Openings, endings et chansons</span>
      {#if isOpen && songs}
        {#await songs then list}<span class="count">{countLabel(list)}</span>{/await}
      {/if}
      <span class="chevron" class:is-open={isOpen}><Icon name="chevronDown" size={18} /></span>
    </button>

    {#if isOpen && songs}
      <div class="body">
        {#await songs}
          <LoadingState label="Mashutan fouille les archives musicales…" />
        {:then list}
          {#if list.length}
            {@const visible = filterSongs(list, filters)}
            <!-- Les filtres n'ont de sens qu'à partir de deux musiques -->
            {#if list.length >= 2}
              <SongFilterBar bind:filters songs={list} visibleCount={visible.length} />
            {/if}
            {#if !visible.length}
              <p class="no-match">Aucune musique ne correspond à ces filtres.</p>
            {/if}
            <ul>
              {#each visible as song (song.id)}
                <SongRow {song} playing={playing?.songId === song.id ? playing.source : null} onplay={(source) => play(song.id, source)} />
              {/each}
            </ul>
            <p class="source">Musiques fournies par <a href="https://anisongdb.com" target="_blank" rel="noopener noreferrer">AnisongDB</a>.</p>
          {:else}
            <EmptyState title="Aucune musique trouvée" message="AnisongDB ne connaît pas encore la bande-son de cet anime." />
          {/if}
        {:catch error}
          <EmptyState title="Bande-son introuvable" message={error.message} />
        {/await}
      </div>
    {/if}
  </div>
</Section>

<style>
  .songs {
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

  .count {
    padding: 1px 10px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorSunken);
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
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

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .no-match {
    padding: var(--space5);
    color: var(--textFaint);
    font-family: var(--fontHand);
    font-size: var(--fontSizeLg);
    text-align: center;
  }

  .source {
    padding: var(--space2) var(--space4) var(--space3);
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
    text-align: right;
  }

  .source a {
    color: var(--textSoft);
    text-decoration: underline;
  }
</style>
