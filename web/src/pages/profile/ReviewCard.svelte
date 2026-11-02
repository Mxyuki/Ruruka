<script lang="ts">
  import type { Review } from '../../api/queries/review';
  import ScoreRing from '../../components/ScoreRing.svelte';
  import { formatRelativeTime } from '../../lib/format';
  import { renderAniListMarkdown } from '../../lib/markdown';
  import { mediaPath } from '../../lib/routes';

  interface Props {
    review: Review;
  }

  let { review }: Props = $props();

  let isOpen = $state(false);
</script>

<article class="card">
  <header>
    <a href="#{mediaPath(review.media.id)}"><img src={review.media.coverImage.medium} alt="" loading="lazy" width="60" height="86" /></a>
    <div class="heading">
      <a class="title" href="#{mediaPath(review.media.id)}">{review.media.title.userPreferred}</a>
      <p class="summary">« {review.summary} »</p>
      <span class="faint meta">
        {formatRelativeTime(review.createdAt)}
        {#if review.ratingAmount}· {review.rating} sur {review.ratingAmount} lecteurs l’ont trouvée utile{/if}
      </span>
    </div>
    <ScoreRing score={review.score} label="Verdict" />
  </header>

  <!-- Le texte complet ne se rend qu'à l'ouverture : certaines critiques sont très longues et pleines d'images -->
  {#if isOpen}
    <div class="rich-text body">{@html renderAniListMarkdown(review.body)}</div>
  {/if}
  <button class="btn btn-ghost btn-sm" type="button" onclick={() => (isOpen = !isOpen)}>{isOpen ? 'Refermer' : 'Lire la critique'}</button>
</article>

<style>
  article {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space3);
    padding: var(--space4) var(--space5);
    content-visibility: auto;
    contain-intrinsic-size: auto 160px;
  }

  header {
    display: grid;
    grid-template-columns: 60px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space4);
    width: 100%;
  }

  img {
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .heading {
    display: grid;
    gap: var(--space1);
    min-width: 0;
  }

  .title {
    font-weight: 800;
  }

  .title:hover {
    color: var(--textSoft);
  }

  .summary {
    margin: 0;
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: var(--fontSizeLg);
  }

  .meta {
    font-size: var(--fontSizeXs);
  }

  .body {
    width: 100%;
    padding-top: var(--space3);
    border-top: 1px solid var(--colorLine);
  }
</style>
