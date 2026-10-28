<script lang="ts">
  import { fetchCharacter } from '../../api/queries/people';
  import DetailLayout from '../../components/DetailLayout.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import Section from '../../components/Section.svelte';
  import { formatEnum, formatFuzzyDate } from '../../lib/format';
  import type { RouteParams } from '../../lib/router.svelte';

  let { params }: { params: RouteParams } = $props();
  const character = $derived(fetchCharacter(Number(params.id)));
</script>

{#await character}
  <LoadingState />
{:then character}
  <DetailLayout
    image={character.image.large}
    name={character.name.userPreferred}
    nativeName={character.name.native}
    description={character.description}
    facts={[
      ['Anniversaire', formatFuzzyDate(character.dateOfBirth)],
      ['Âge', character.age],
      ['Genre', character.gender],
      ['Groupe sanguin', character.bloodType],
      ['Aussi appelé·e', character.name.alternative.filter(Boolean).join(', ')],
      ['Favoris', character.favourites.toLocaleString('fr-FR')],
    ]}
  >
    <Section title="Apparaît dans">
      <div class="media-grid">
        {#each character.media as edge (edge.node.id)}
          <MediaCard
            media={edge.node}
            subtitle={[formatEnum(edge.characterRole), edge.voiceActors[0]?.name.userPreferred].filter(Boolean).join(' · ')}
          />
        {/each}
      </div>
    </Section>
  </DetailLayout>
{:catch error}
  <EmptyState title="Personnage introuvable" message={error.message} />
{/await}
