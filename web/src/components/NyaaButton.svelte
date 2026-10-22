<script lang="ts">
  interface Props {
    url: string;
    label?: string;
  }

  let { url, label }: Props = $props();
</script>

<a class="nyaa" class:has-label={label} href={url} target="_blank" rel="noopener noreferrer" title="Chercher sur Nyaa">
  <img src="https://nyaa.si/static/favicon.png" alt="Nyaa" width="18" height="18" />
  {#if label}<span>{label}</span>{/if}
</a>

<style>
  .nyaa {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px;
    border-radius: var(--radiusSmall);
    transition: transform 0.2s var(--easeSpring);
  }

  .nyaa:hover {
    transform: rotate(-6deg) scale(1.1);
  }

  .nyaa.has-label {
    padding: 6px 16px;
    border: var(--outline);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    box-shadow: 2px 2px 0 var(--colorInk);
    font-size: var(--fontSizeSm);
    font-weight: 800;
  }

  img {
    border-radius: 3px;
  }
</style>
