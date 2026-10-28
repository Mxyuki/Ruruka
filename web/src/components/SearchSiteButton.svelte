<script lang="ts">
  import { siteName } from '../lib/siteAddress';
  import { session } from '../state/session.svelte';
  import Icon from './Icon.svelte';

  interface Props {
    /** Builds the search link from the site chosen in Settings. */
    searchUrl: (site: string) => string;
    label?: string;
  }

  let { searchUrl, label }: Props = $props();
</script>

<!-- Sans site de recherche dans les réglages, le bouton n'apparaît pas -->
{#if session.searchSite}
  <a class="search" class:has-label={label} href={searchUrl(session.searchSite)} target="_blank" rel="noopener noreferrer" title="Chercher sur {siteName(session.searchSite)}">
    <Icon name="search" size={16} />
    {#if label}<span>{label}</span>{/if}
  </a>
{/if}

<style>
  .search {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px;
    border-radius: var(--radiusSmall);
    color: var(--textSoft);
    transition: transform 0.2s var(--easeSpring);
  }

  .search:hover {
    transform: rotate(-6deg) scale(1.1);
  }

  .search.has-label {
    padding: 6px 16px;
    border: var(--outline);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    box-shadow: 2px 2px 0 var(--colorInk);
    color: var(--textMain);
    font-size: var(--fontSizeSm);
    font-weight: 800;
  }
</style>
