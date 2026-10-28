<script lang="ts">
  import { fetchStaff, type VoicedCharacter } from '../../api/queries/people';
  import DetailLayout from '../../components/DetailLayout.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import Section from '../../components/Section.svelte';
  import { formatEnum, formatFuzzyDate } from '../../lib/format';
  import type { RouteParams } from '../../lib/router.svelte';
  import { characterPath } from '../../lib/routes';

  let { params }: { params: RouteParams } = $props();
  const staff = $derived(fetchStaff(Number(params.id)));

  type RoleSort = 'date' | 'favourites' | 'name';

  const roleSorts: [RoleSort, string][] = [
    ['date', 'Date de sortie'],
    ['favourites', 'Favoris'],
    ['name', 'A → Z'],
  ];
  let roleSort = $state<RoleSort>('date');

  // <-- Les rôles arrivent déjà par date (les plus récents d'abord) : les autres tris repartent de cet ordre -->
  function sortRoles(roles: VoicedCharacter[], sort: RoleSort): VoicedCharacter[] {
    if (sort === 'favourites') return [...roles].sort((a, b) => b.character.favourites - a.character.favourites);
    if (sort === 'name') return [...roles].sort((a, b) => a.character.name.userPreferred.localeCompare(b.character.name.userPreferred, 'fr'));
    return roles;
  }
</script>

{#await staff}
  <LoadingState />
{:then staff}
  <DetailLayout
    image={staff.image.large}
    name={staff.name.userPreferred}
    nativeName={staff.name.native}
    description={staff.description}
    facts={[
      ['Métier', staff.primaryOccupations.join(', ')],
      ['Anniversaire', formatFuzzyDate(staff.dateOfBirth)],
      ['Âge', staff.age?.toString()],
      ['Genre', staff.gender],
      ['Ville natale', staff.homeTown],
      ['Années d’activité', staff.yearsActive.length ? `${staff.yearsActive[0]}–${staff.yearsActive[1] ?? 'aujourd’hui'}` : null],
      ['Favoris', staff.favourites.toLocaleString('fr-FR')],
    ]}
  >
    {#if staff.characterRoles.length}
      <Section title="Rôles de doublage · {staff.characterRoles.length}">
        {#snippet action()}
          <div class="sorts">
            {#each roleSorts as [value, label] (value)}
              <button class="chip" class:is-active={roleSort === value} type="button" aria-pressed={roleSort === value} onclick={() => (roleSort = value)}>{label}</button>
            {/each}
          </div>
        {/snippet}
        <!-- Un personnage n'apparaît qu'une fois, avec l'œuvre où on l'a entendu en premier -->
        <div class="roles">
          {#each sortRoles(staff.characterRoles, roleSort) as { character, characterRole, media, year } (character.id)}
            <div class="card role">
              <a href="#{characterPath(character.id)}"><img src={character.image.medium} alt="" loading="lazy" /></a>
              <div class="body">
                <a class="name" href="#{characterPath(character.id)}">{character.name.userPreferred}</a>
                <span class="faint">{formatEnum(characterRole)}{year ? ` · ${year}` : ''}{roleSort === 'favourites' ? ` · ${character.favourites.toLocaleString('fr-FR')} favoris` : ''}</span>
                <a class="media" href="#/media/{media.id}">{media.title.userPreferred}</a>
              </div>
              <a href="#/media/{media.id}"><img src={media.coverImage.medium} alt="" loading="lazy" /></a>
            </div>
          {/each}
        </div>
      </Section>
    {/if}

    {#if staff.staffRoles.length}
      <Section title="Participations">
        <div class="media-grid">
          {#each staff.staffRoles as role, index (index)}
            <MediaCard media={role.node} subtitle={role.staffRole} />
          {/each}
        </div>
      </Section>
    {/if}
  </DetailLayout>
{:catch error}
  <EmptyState title="Créateur introuvable" message={error.message} />
{/await}

<style>
  .sorts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  .roles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space3) var(--space4);
  }

  .role {
    content-visibility: auto;
    contain-intrinsic-size: auto 80px;
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) 56px;
    height: 80px;
    overflow: hidden;
  }

  img {
    width: 56px;
    height: 80px;
    object-fit: cover;
  }

  .body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 8px 10px;
    font-size: var(--fontSizeSm);
  }

  .body > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .body .faint {
    font-size: var(--fontSizeXs);
  }

  .media {
    margin-top: auto;
    color: var(--textSoft);
    font-size: var(--fontSizeXs);
  }

  .body a:hover {
    color: var(--textSoft);
  }
</style>
