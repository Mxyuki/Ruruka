<script lang="ts">
  import { fetchCharacter, type CharacterDetails } from '../../api/queries/people';
  import type { NamedNode } from '../../api/types';
  import DetailLayout from '../../components/DetailLayout.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import Section from '../../components/Section.svelte';
  import { formatContentKind, formatEnum, formatFuzzyDate } from '../../lib/format';
  import type { RouteParams } from '../../lib/router.svelte';
  import { staffPath } from '../../lib/routes';

  let { params }: { params: RouteParams } = $props();
  const character = $derived(fetchCharacter(Number(params.id)));

  interface Voice {
    voiceActor: NamedNode;
    notes: Set<string>;
  }

  // <-- Les précisions d'AniList sont du texte libre en anglais : on traduit les plus courantes -->
  const roleNoteLabels: Record<string, string> = { child: 'Enfant', young: 'Jeune', teen: 'Ado', adult: 'Adulte', old: 'Âgé·e' };
  const roleNoteLabel = (note: string) => roleNoteLabels[note.trim().toLowerCase()] ?? note.trim();

  // <-- Un personnage peut changer de voix d'une œuvre à l'autre (ou selon son âge) : chaque seiyuu n'apparaît qu'une fois -->
  function voicesOf(details: CharacterDetails): Voice[] {
    const byId = new Map<number, Voice>();
    for (const { voiceActor, roleNotes } of details.media.flatMap((edge) => edge.voiceRoles)) {
      const voice = byId.get(voiceActor.id) ?? { voiceActor, notes: new Set<string>() };
      if (roleNotes) voice.notes.add(roleNoteLabel(roleNotes));
      byId.set(voiceActor.id, voice);
    }
    return [...byId.values()];
  }
</script>

{#await character}
  <LoadingState />
{:then character}
  {@const voices = voicesOf(character)}
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
    {#if voices.length}
      <Section title={voices.length > 1 ? 'Ses voix' : 'Sa voix'}>
        <div class="voices">
          {#each voices as { voiceActor, notes } (voiceActor.id)}
            <a class="card voice" href="#{staffPath(voiceActor.id)}">
              <img src={voiceActor.image.medium} alt="" loading="lazy" />
              <span class="voice-text">
                <span class="voice-name">{voiceActor.name.userPreferred}</span>
                {#if notes.size}<span class="voice-notes">{[...notes].join(', ')}</span>{/if}
              </span>
            </a>
          {/each}
        </div>
      </Section>
    {/if}

    <Section title="Apparaît dans">
      <div class="media-grid">
        {#each character.media as edge (edge.node.id)}
          <MediaCard
            media={edge.node}
            subtitle={[formatContentKind(edge.node), formatEnum(edge.characterRole)].filter(Boolean).join(' · ')}
          />
        {/each}
      </div>
    </Section>
  </DetailLayout>
{:catch error}
  <EmptyState title="Personnage introuvable" message={error.message} />
{/await}

<style>
  /* <-- Fiche de seiyuu : photo et nom, un clic mène à tous ses rôles --> */
  .voices {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space3) var(--space4);
  }

  .voice {
    display: flex;
    align-items: center;
    gap: var(--space3);
    height: 82px;
    padding-right: var(--space4);
    overflow: hidden;
    transition: transform 0.2s var(--easeSpring);
  }

  .voice:hover {
    transform: rotate(-1.5deg);
  }

  img {
    width: 58px;
    height: 82px;
    object-fit: cover;
  }

  .voice-text {
    display: flex;
    flex-direction: column;
  }

  .voice-name {
    font-family: var(--fontTitle);
  }

  .voice-notes {
    color: var(--textFaint);
    font-family: var(--fontHand);
    font-size: var(--fontSizeLg);
  }

  .voice:hover .voice-name {
    color: var(--textSoft);
  }
</style>
