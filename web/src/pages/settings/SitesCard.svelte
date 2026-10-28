<script lang="ts">
  import type { Settings, SettingsPatch } from '../../lib/bridge';
  import { siteName } from '../../lib/siteAddress';
  import { session } from '../../state/session.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();

  type SiteKey = 'searchSiteUrl' | 'mangaSiteUrl' | 'songFileHostUrl';

  // <-- Aucun site n'est fourni : chaque fonction reste cachée tant que l'adresse correspondante est vide -->
  const fields: { key: SiteKey; label: string; hint: string; active: (site: string) => string }[] = [
    {
      key: 'searchSiteUrl',
      label: 'Recherche d’épisodes',
      hint: 'Les boutons « Rechercher » ouvrent ce site avec le titre et l’épisode qui te manquent.',
      active: (site) => `Les recherches s’ouvriront sur ${site}.`,
    },
    {
      key: 'mangaSiteUrl',
      label: 'Lecture des manga',
      hint: 'Le site dont l’API liste les chapitres d’un manga et sert ses pages, pour les lire dans Ruruka.',
      active: (site) => `Les chapitres viendront de ${site}.`,
    },
    {
      key: 'songFileHostUrl',
      label: 'Fichiers de la bande-son',
      hint: 'Le serveur qui héberge les fichiers des openings et endings, placé devant le nom de chaque fichier.',
      active: (site) => `Les chansons se liront depuis ${site}.`,
    },
  ];

  const activeSites = $derived<Record<SiteKey, string | null>>({
    searchSiteUrl: session.searchSite,
    mangaSiteUrl: session.mangaSite,
    songFileHostUrl: session.songFileHost,
  });

  const valueOf = (settings: Settings | null, key: SiteKey) => settings?.[key] ?? '';
</script>

<section class="card" style:--accent="var(--colorThread)">
  <h2 class="note-label">Sites</h2>
  <p class="hint">Ruruka ne fournit aucun site : c’est toi qui choisis. Laisse un champ vide pour masquer ce qui en dépend ; une mauvaise adresse ne trouvera simplement rien.</p>

  {#each fields as field (field.key)}
    {@const site = activeSites[field.key]}
    <label class="field">
      <span class="field-label">{field.label}</span>
      <span class="hint">{field.hint}</span>
      <input
        class="input"
        placeholder="par ex. monsite.org"
        spellcheck="false"
        value={valueOf(session.settings, field.key)}
        onchange={(event) => update({ [field.key]: event.currentTarget.value.trim() })}
      />
      {#if site}<span class="faint preview">{field.active(siteName(site))}</span>{/if}
    </label>
  {/each}
</section>

<style>
  section {
    position: relative;
    margin-bottom: var(--space4);
    padding: var(--space5);
  }

  .hint {
    margin: calc(var(--space2) * -1) 0 var(--space3);
    color: var(--textFaint);
    font-size: var(--fontSizeSm);
  }

  .field {
    display: grid;
    gap: var(--space2);
    margin-top: var(--space4);
  }

  .field .hint {
    margin: 0;
  }

  .preview {
    font-family: var(--fontHand);
    font-size: var(--fontSizeMd);
  }
</style>
