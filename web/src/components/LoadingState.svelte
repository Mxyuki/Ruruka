<script lang="ts">
  interface Props {
    label?: string;
  }

  let { label = 'Mashutan mène l’enquête…' }: Props = $props();
</script>

<!-- Une loupe qui passe d'indice en indice -->
<div class="loading" role="status">
  <svg viewBox="0 0 140 70" width="140" height="70" aria-hidden="true">
    <circle class="clue" cx="28" cy="44" r="6" />
    <circle class="clue" cx="70" cy="30" r="6" />
    <circle class="clue" cx="112" cy="46" r="6" />
    <g class="lens">
      <path class="handle" d="M10 10 L20 20" />
      <circle cx="0" cy="0" r="14" />
    </g>
  </svg>
  <span>{label}</span>
</div>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space2);
    padding: var(--space7) 0;
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 2rem;
  }

  .clue {
    fill: var(--colorStrawberry);
    stroke: var(--colorInk);
    stroke-width: 2;
    animation: found 2.4s ease-in-out infinite;
  }

  .clue:nth-child(2) {
    animation-delay: 0.8s;
  }

  .clue:nth-child(3) {
    animation-delay: 1.6s;
  }

  .lens circle {
    fill: rgb(143 203 230 / 0.5);
    stroke: var(--colorInk);
    stroke-width: 3;
  }

  .handle {
    stroke: var(--colorInk);
    stroke-width: 6;
    stroke-linecap: round;
  }

  .lens {
    animation: sweep 2.4s ease-in-out infinite;
  }

  @keyframes sweep {
    0%,
    100% {
      transform: translate(28px, 38px);
    }
    33% {
      transform: translate(70px, 24px);
    }
    66% {
      transform: translate(112px, 40px);
    }
  }

  @keyframes found {
    0%,
    100% {
      fill: var(--colorMauve);
    }
    12% {
      fill: var(--colorStar);
    }
  }
</style>
