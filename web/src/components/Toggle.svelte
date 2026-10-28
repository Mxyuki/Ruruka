<script lang="ts">
  interface Props {
    checked: boolean;
    label: string;
    onchange: (checked: boolean) => void;
  }

  let { checked, label, onchange }: Props = $props();
</script>

<label class="toggle">
  <button type="button" role="switch" aria-checked={checked} aria-label={label} class:is-on={checked} onclick={() => onchange(!checked)}>
    <span class="scoop" aria-hidden="true"></span>
  </button>
  <span class="text">{label}</span>
</label>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space3);
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
    cursor: pointer;
  }

  button {
    position: relative;
    flex-shrink: 0;
    width: 54px;
    height: 30px;
    padding: 0;
    border: var(--outline);
    border-radius: var(--radiusPill);
    background: var(--colorSunken);
    cursor: pointer;
    transition: background var(--transitionFast), border-color var(--transitionFast);
  }

  button.is-on {
    background: var(--scoopMint);
  }

  /* <-- Le bouton est une boule de glace : vanille éteint, fraise allumé --> */
  .scoop {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 22px;
    height: 22px;
    border: var(--outlineThin);
    border-radius: 50% 50% 45% 45%;
    background:
      radial-gradient(circle at 30% 30%, var(--scoopMint) 1.5px, transparent 2px),
      radial-gradient(circle at 62% 24%, var(--scoopStrawberry) 1.5px, transparent 2px),
      radial-gradient(circle at 48% 48%, var(--scoopLavender) 1.5px, transparent 2px),
      var(--scoopVanilla);

    transition: transform 0.4s var(--easeSpring), background-color var(--transitionFast);
  }

  .scoop::after {
    content: '';
    position: absolute;
    bottom: -3px;
    left: 30%;
    width: 6px;
    height: 7px;
    border-radius: 0 0 50% 50%;
    background: inherit;
    background-image: none;
    background-color: var(--scoopVanilla);
  }

  .is-on .scoop {
    background:
      radial-gradient(circle at 30% 30%, var(--scoopMint) 1.5px, transparent 2px),
      radial-gradient(circle at 62% 24%, var(--scoopVanilla) 1.5px, transparent 2px),
      radial-gradient(circle at 48% 48%, var(--scoopLavender) 1.5px, transparent 2px),
      var(--scoopStrawberry);
    transform: translateX(22px) rotate(12deg);
  }

  .is-on .scoop::after {
    background-color: var(--scoopStrawberry);
  }

  .text {
    line-height: 1.4;
  }
</style>
