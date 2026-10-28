<script lang="ts">
  import type { StaffEdge } from '../../api/queries/media';
  import Section from '../../components/Section.svelte';
  import { staffPath } from '../../lib/routes';

  interface Props {
    staff: StaffEdge[];
  }

  let { staff }: Props = $props();
</script>

<Section title="L'équipe">
  <div class="grid">
    {#each staff as edge, index (index)}
      <a class="card person" href="#{staffPath(edge.node.id)}">
        <img src={edge.node.image.medium} alt="" loading="lazy" />
        <span class="body">
          <span class="name">{edge.node.name.userPreferred}</span>
          <span class="role">{edge.role}</span>
        </span>
      </a>
    {/each}
  </div>
</Section>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space3) var(--space4);
  }

  .person {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    height: 72px;
    overflow: hidden;
  }

  img {
    width: 52px;
    height: 72px;
    object-fit: cover;
  }

  .body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    padding: 0 12px;
    font-size: var(--fontSizeSm);
  }

  .name,
  .role {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role {
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
  }

  .person:hover .name {
    color: var(--textSoft);
  }
</style>
