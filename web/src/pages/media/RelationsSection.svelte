<script lang="ts">
  import type { RelationEdge } from '../../api/queries/media';
  import Section from '../../components/Section.svelte';
  import { formatEnum } from '../../lib/format';
  import { mediaPath } from '../../lib/routes';

  interface Props {
    relations: RelationEdge[];
  }

  let { relations }: Props = $props();

  const groups = [
    { label: "L'histoire", types: ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'SUMMARY'] },
    { label: 'Autres versions', types: ['ALTERNATIVE', 'COMPILATION', 'CONTAINS'] },
    { label: 'Adaptations', types: ['SOURCE', 'ADAPTATION'] },
    { label: 'Personnages', types: ['CHARACTER'] },
    { label: 'Divers', types: ['OTHER'] },
  ];
  const relationLabels: Record<string, string> = {
    PREQUEL: 'Avant', SEQUEL: 'Après', PARENT: 'Histoire mère', SIDE_STORY: 'Histoire annexe', SPIN_OFF: 'Spin-off',
    SUMMARY: 'Résumé', ALTERNATIVE: 'Version alternative', COMPILATION: 'Compilation', CONTAINS: 'Contient',
    SOURCE: 'Source', ADAPTATION: 'Adaptation', CHARACTER: 'Personnages communs', OTHER: 'Autre',
  };
  const typeOrder = groups.flatMap((group) => group.types);
  const otherGroup = groups[groups.length - 1]!;

  // <-- Un type de relation inconnu atterrit dans « Divers » au lieu de disparaître -->
  const groupOf = (relationType: string) => groups.find((group) => group.types.includes(relationType)) ?? otherGroup;

  const grouped = $derived(
    groups
      .map((group) => ({
        ...group,
        edges: relations
          .filter((edge) => groupOf(edge.relationType) === group)
          .sort((a, b) => typeOrder.indexOf(a.relationType) - typeOrder.indexOf(b.relationType)),
      }))
      .filter((group) => group.edges.length),
  );

  const tiltFor = (index: number) => [-4, 3, -2, 4, -3][index % 5];
</script>

<Section title="Le fil des indices">
  <div class="groups">
    {#each grouped as group (group.label)}
      <div class="group">
        <h3 class="note-label">{group.label}</h3>
        <!-- Polaroïds punaisés, reliés par un fil de laine -->
        <div class="board">
          <span class="yarn" aria-hidden="true"></span>
          {#each group.edges as edge, index (`${edge.node.id}:${edge.relationType}`)}
            <a class="polaroid" href="#{mediaPath(edge.node.id)}" style:--tilt="{tiltFor(index)}deg">
              <svg class="pin" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21 C5 15.5 2 12 2 8 C2 5 4.5 3 7 3 C9 3 11 4.2 12 6 C13 4.2 15 3 17 3 C19.5 3 22 5 22 8 C22 12 19 15.5 12 21Z" />
              </svg>
              <img src={edge.node.coverImage.medium} alt="" loading="lazy" />
              <span class="type">{relationLabels[edge.relationType] ?? formatEnum(edge.relationType)}</span>
              <span class="title">{edge.node.title.userPreferred}</span>
              <span class="meta">{[edge.node.format, edge.node.status].filter(Boolean).map(formatEnum).join(' · ')}</span>
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</Section>

<style>
  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--space5);
  }

  .board {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space6) var(--space5);
    padding-top: var(--space3);
  }

  /* <-- Le fil passe derrière les punaises de chaque rangée --> */
  .yarn {
    position: absolute;
    top: 16px;
    right: 60px;
    left: 60px;
    height: 30px;
    border-top: 2.5px solid var(--colorThread);
    border-radius: 50%;
  }

  .polaroid {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 150px;
    padding: 8px 8px 12px;
    border: var(--outline);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    transform: rotate(var(--tilt));
    transition: transform 0.3s var(--easeSpring), box-shadow var(--transitionFast);
  }

  .polaroid:hover {
    z-index: 1;
    box-shadow: var(--stickerShadowLarge);
    transform: rotate(0deg) scale(1.06);
  }

  .pin {
    position: absolute;
    top: -12px;
    left: calc(50% - 10px);
    width: 20px;
    height: 20px;
    fill: var(--colorStrawberry);
    stroke: var(--colorInk);
    stroke-width: 2;
  }

  img {
    width: 100%;
    height: 150px;
    margin-bottom: 4px;
    border: var(--outlineThin);
    object-fit: cover;
  }

  .type {
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 1.6rem;
    line-height: 1.1;
  }

  .title {
    display: -webkit-box;
    overflow: hidden;
    font-size: var(--fontSizeSm);
    font-weight: 800;
    line-height: 1.25;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .meta {
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
  }
</style>
