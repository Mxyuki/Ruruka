<script lang="ts">
  import { fetchStaff } from '../../api/queries/people';
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
      <Section title="Rôles de doublage">
        <div class="roles">
          {#each staff.characterRoles as role, index (index)}
            {#each role.characters as character, characterIndex (characterIndex)}
              <div class="card role">
                <a href="#{characterPath(character.id)}"><img src={character.image.medium} alt="" loading="lazy" /></a>
                <div class="body">
                  <a class="name" href="#{characterPath(character.id)}">{character.name.userPreferred}</a>
                  <span class="faint">{formatEnum(role.characterRole)}</span>
                  <a class="media" href="#/media/{role.node.id}">{role.node.title.userPreferred}</a>
                </div>
                <a href="#/media/{role.node.id}"><img src={role.node.coverImage.medium} alt="" loading="lazy" /></a>
              </div>
            {/each}
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
  .roles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space3) var(--space4);
  }

  .role {
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
