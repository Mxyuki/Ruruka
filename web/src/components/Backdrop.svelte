<script lang="ts">
  import Kira from './Kira.svelte';

  // <-- Positions fixes (en % de la fenêtre) : le décor reste le même à chaque lancement -->
  const sparkles = [
    { x: 6, y: 18, size: 18, delay: 0 },
    { x: 91, y: 12, size: 24, delay: 1.6 },
    { x: 84, y: 72, size: 16, delay: 3.1 },
    { x: 34, y: 92, size: 20, delay: 2.2 },
  ];
</script>

<div class="backdrop" aria-hidden="true">
  <span class="blob is-mauve"></span>
  <span class="blob is-blond"></span>
  <span class="blob is-sky"></span>
  {#each sparkles as sparkle, index (index)}
    <span class="sparkle" style:left="{sparkle.x}%" style:top="{sparkle.y}%" style:animation-delay="{sparkle.delay}s">
      <Kira size={sparkle.size} />
    </span>
  {/each}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
  }

  .blob.is-mauve {
    top: -220px;
    right: -180px;
    width: 560px;
    height: 560px;
    background: var(--colorMauve);
    opacity: 0.45;
  }

  .blob.is-blond {
    bottom: -160px;
    left: 10%;
    width: 340px;
    height: 340px;
    background: var(--colorBlond);
    opacity: 0.6;
  }

  .blob.is-sky {
    top: 40%;
    right: -120px;
    width: 220px;
    height: 220px;
    background: var(--colorSky);
    opacity: 0.25;
  }

  .sparkle {
    position: absolute;
    animation: twinkle 5s ease-in-out infinite;
  }

  @keyframes twinkle {
    0%,
    100% {
      opacity: 0.2;
      transform: scale(0.7) rotate(0deg);
    }
    50% {
      opacity: 1;
      transform: scale(1) rotate(20deg);
    }
  }
</style>
