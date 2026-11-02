<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    site: string;
    size: number;
  }

  let { site, size }: Props = $props();

  // <-- Le favicon vient du site web, parfois derrière une vérification anti-bot : sans lui, un livre prend sa place -->
  let hasFailed = $state(false);
</script>

{#if hasFailed}
  <Icon name="book" {size} />
{:else}
  <img src="{site}/favicon.ico" alt="" width={size} height={size} onerror={() => (hasFailed = true)} />
{/if}
