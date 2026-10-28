<script lang="ts">
  import { searchPeople, type PeopleSearch } from '../../api/queries/people';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import Section from '../../components/Section.svelte';
  import { characterPath, staffPath } from '../../lib/routes';
  import { toasts } from '../../state/toasts.svelte';

  type Kind = 'all' | 'characters' | 'voiceActors' | 'staff';

  const searchDelayMs = 400;
  const kinds: [Kind, string][] = [
    ['all', 'Tout'],
    ['characters', 'Personnages'],
    ['voiceActors', 'Seiyuu'],
    ['staff', 'Staff'],
  ];

  let search = $state('');
  let debouncedSearch = $state('');
  let kind = $state<Kind>('all');
  let result = $state<PeopleSearch | null>(null);
  let isLoading = $state(false);

  $effect(() => {
    const value = search;
    const timer = setTimeout(() => (debouncedSearch = value), searchDelayMs);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const query = debouncedSearch;
    let isCurrent = true;
    isLoading = true;
    searchPeople(query)
      .then((found) => {
        if (isCurrent) result = found;
      })
      .catch((error) => toasts.error(error, 'La recherche a échoué'))
      .finally(() => {
        if (isCurrent) isLoading = false;
      });
    return () => {
      isCurrent = false;
    };
  });

  // <-- Seiyuu = staff dont un métier principal est le doublage ; « Staff » garde tous les autres -->
  const isVoiceActor = (occupations: string[]) => occupations.some((occupation) => /voice act/i.test(occupation));
  const characters = $derived(kind === 'all' || kind === 'characters' ? (result?.characters ?? []) : []);
  const voiceActors = $derived(kind === 'all' || kind === 'voiceActors' ? (result?.staff.filter((person) => isVoiceActor(person.primaryOccupations)) ?? []) : []);
  const otherStaff = $derived(kind === 'all' || kind === 'staff' ? (result?.staff.filter((person) => !isVoiceActor(person.primaryOccupations)) ?? []) : []);
  const isEmpty = $derived(result !== null && !characters.length && !voiceActors.length && !otherStaff.length);
</script>

<div class="page">
  <PageHeader title="Personnes" note="Les suspects, leurs voix et ceux qui tirent les ficelles" />

  <div class="filters">
    <input class="input" type="search" placeholder="Un personnage, un seiyuu, un réalisateur…" aria-label="Chercher une personne" bind:value={search} />
    <div class="kinds">
      {#each kinds as [value, label] (value)}
        <button class="chip" class:is-active={kind === value} type="button" onclick={() => (kind = value)}>{label}</button>
      {/each}
    </div>
  </div>

  {#if isLoading && !result}
    <LoadingState />
  {:else if isEmpty}
    <EmptyState title="Personne à l’horizon" message="Aucun nom ne correspond à cette recherche." />
  {:else if result}
    <div class:is-stale={isLoading}>
      {#if !debouncedSearch.trim()}<p class="faint">Les plus aimés d’AniList. Tape un nom pour chercher.</p>{/if}

      {#if characters.length}
        <Section title="Personnages">
          <div class="people">
            {#each characters as person (person.id)}
              <a class="person" href="#{characterPath(person.id)}">
                <img src={person.image.medium} alt="" loading="lazy" />
                <strong>{person.name.userPreferred}</strong>
                {#if person.media.nodes[0]}<span>{person.media.nodes[0].title.userPreferred}</span>{/if}
              </a>
            {/each}
          </div>
        </Section>
      {/if}

      {#each [['Seiyuu', voiceActors], ['Staff', otherStaff]] as const as [title, people] (title)}
        {#if people.length}
          <Section {title}>
            <div class="people">
              {#each people as person (person.id)}
                <a class="person" href="#{staffPath(person.id)}">
                  <img src={person.image.medium} alt="" loading="lazy" />
                  <strong>{person.name.userPreferred}</strong>
                  <span>{person.primaryOccupations.slice(0, 2).join(', ') || person.name.native || ''}</span>
                </a>
              {/each}
            </div>
          </Section>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .filters {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
    margin-bottom: var(--space6);
  }

  .filters .input {
    max-width: 560px;
  }

  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  .is-stale {
    opacity: 0.6;
  }

  .faint {
    margin-bottom: var(--space4);
  }

  .people {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--space5) var(--space4);
  }

  /* <-- Fiche polaroïd légèrement de travers, comme sur un tableau d'enquête --> */
  .person {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 6px 10px;
    border: var(--outline);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    font-size: var(--fontSizeXs);
    text-align: center;
    transition: transform 0.25s var(--easeSpring);
  }

  .person:nth-child(odd) {
    transform: rotate(-2deg);
  }

  .person:nth-child(even) {
    transform: rotate(1.5deg);
  }

  .person:hover {
    transform: rotate(0deg) scale(1.05);
  }

  .person img {
    width: 100%;
    aspect-ratio: 2 / 3;
    border: var(--outlineThin);
    object-fit: cover;
  }

  .person strong {
    font-size: var(--fontSizeSm);
  }

  .person span {
    overflow: hidden;
    color: var(--textFaint);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
