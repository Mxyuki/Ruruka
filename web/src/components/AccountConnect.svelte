<script lang="ts">
  import { session } from '../state/session.svelte';
  import { toasts } from '../state/toasts.svelte';
  import Icon from './Icon.svelte';

  const redirectUrl = 'https://anilist.co/api/v2/oauth/pin';

  let clientId = $state(session.settings?.aniListClientId ?? '');
  let manualToken = $state('');
  let isWorking = $state(false);
  let showsManualToken = $state(false);

  async function run(task: () => Promise<unknown>, context: string) {
    isWorking = true;
    try {
      await task();
    } catch (error) {
      toasts.error(error, context);
    } finally {
      isWorking = false;
    }
  }

  const login = () =>
    run(async () => {
      await session.updateSettings({ aniListClientId: clientId.trim() });
      await session.login();
    }, 'Connexion impossible');

  const loginWithToken = () => run(() => session.loginWithToken(manualToken), 'Ce jeton ne fonctionne pas');
</script>

{#if session.viewer}
  <div class="connected">
    <img src={session.viewer.avatar.medium} alt="" width="44" height="44" />
    <div>
      <strong>{session.viewer.name}</strong>
      <span class="muted">Connecté·e à AniList</span>
    </div>
    <button class="btn btn-ghost" type="button" onclick={() => run(() => session.logout(), 'Déconnexion impossible')}>
      <Icon name="logout" size={14} /> Se déconnecter
    </button>
  </div>
{:else}
  <ol class="steps">
    <li>
      Ouvre <a href="https://anilist.co/settings/developer" target="_blank" rel="noopener noreferrer">AniList → Settings → Developer</a>
      et crée un client nommé <em>Ruruka</em>.
    </li>
    <li>
      Mets ce lien comme « redirect URL » :
      <code>{redirectUrl}</code>
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => navigator.clipboard.writeText(redirectUrl)}>Copier</button>
    </li>
    <li>
      Colle l'<strong>ID</strong> du client ici :
      <input class="input" placeholder="par ex. 12345" inputmode="numeric" bind:value={clientId} />
    </li>
  </ol>

  <div class="actions">
    <button class="btn btn-primary" type="button" disabled={!clientId.trim() || isWorking} onclick={login}>Se connecter avec AniList</button>
    <button class="btn btn-ghost btn-sm" type="button" onclick={() => (showsManualToken = !showsManualToken)}>
      Coller un jeton à la place
    </button>
  </div>

  {#if showsManualToken}
    <div class="manual">
      <p class="faint">Si la fenêtre de connexion ne se ferme pas toute seule, copie le jeton affiché par AniList et colle-le ici.</p>
      <textarea class="input" rows="3" bind:value={manualToken}></textarea>
      <button class="btn" type="button" disabled={!manualToken.trim() || isWorking} onclick={loginWithToken}>Utiliser ce jeton</button>
    </div>
  {/if}
{/if}

<style>
  .connected {
    display: flex;
    align-items: center;
    gap: var(--space3);
  }

  .connected img {
    border: 2px solid var(--colorStar);
    border-radius: 50%;
  }

  .connected div {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
    margin: 0 0 var(--space4);
    padding-left: 20px;
    color: var(--textSoft);
  }

  .steps li::marker {
    color: var(--textSoft);
    font-weight: 700;
  }

  .steps a {
    color: var(--textSoft);
  }

  .steps input {
    max-width: 240px;
    margin-top: var(--space2);
  }

  code {
    padding: 2px 6px;
    border-radius: var(--radiusSmall);
    background: var(--colorSunken);
    color: var(--textMain);
  }

  .actions,
  .manual {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .manual {
    flex-direction: column;
    align-items: stretch;
    margin-top: var(--space4);
  }
</style>
