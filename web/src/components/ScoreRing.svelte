<script lang="ts">
  interface Props {
    /** A 0–100 score. */
    score: number;
    label: string;
    tooltip?: string;
  }

  let { score, label, tooltip }: Props = $props();
</script>

<!-- Pastille de note façon autocollant, remplie à hauteur du score -->
<div class="score-badge" title={tooltip}>
  <div class="badge" style:--fill="{score}%">
    <span>{score}<small>%</small></span>
  </div>
  <span class="label">{label}</span>
</div>

<style>
  .score-badge {
    display: flex;
    align-items: center;
    gap: var(--space3);
  }

  .badge {
    display: grid;
    width: 64px;
    height: 64px;
    place-items: center;
    border: var(--outline);
    border-radius: 50%;
    background:
      radial-gradient(closest-side, var(--colorPaper) 72%, transparent 74%),
      conic-gradient(var(--colorStar) var(--fill), var(--colorMauve) 0);
    box-shadow: var(--stickerShadow);
    transform: rotate(-6deg);
  }

  .badge span {
    font-family: var(--fontTitle);
    font-size: 1.8rem;
  }

  .badge small {
    font-size: 0.6em;
  }

  .label {
    max-width: 110px;
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 1.8rem;
    font-weight: 400;
    line-height: 1.1;
  }
</style>
