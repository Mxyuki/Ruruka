<script lang="ts">
  import LibraryRootPicker from '../../components/LibraryRootPicker.svelte';
  import type { SettingsPatch } from '../../lib/bridge';
  import SitesCard from './SitesCard.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();
</script>

<section class="card settings-card" style:--accent="var(--colorLilac)">
  <h2 class="note-label">Dossier d’anime</h2>
  <LibraryRootPicker />
</section>

<SitesCard {update} />
