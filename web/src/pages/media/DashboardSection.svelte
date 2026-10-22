<script lang="ts">
  import type { FollowingEntry, MediaDetails } from '../../api/queries/media';
  import Section from '../../components/Section.svelte';
  import { formatCompact, formatEnum, formatFuzzyDate, formatListStatus, statusColor } from '../../lib/format';
  import { studioPath, userPath } from '../../lib/routes';
  import DashboardCard from './DashboardCard.svelte';

  interface Props {
    media: MediaDetails;
    friends: FollowingEntry[];
  }

  let { media, friends }: Props = $props();

  const statusOrder = ['COMPLETED', 'CURRENT', 'PLANNING', 'PAUSED', 'DROPPED', 'REPEATING'];

  const scores = $derived([...media.stats.scoreDistribution].sort((a, b) => a.score - b.score));
  const maxScoreAmount = $derived(Math.max(1, ...scores.map((bucket) => bucket.amount)));
  const statuses = $derived(
    media.stats.statusDistribution
      .filter((bucket) => bucket.amount > 0)
      .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)),
  );
  const statusTotal = $derived(statuses.reduce((sum, bucket) => sum + bucket.amount, 0));
  const sortedFriends = $derived([...friends].sort((a, b) => b.score - a.score));
  const links = $derived([...media.externalLinks].sort((a, b) => Number(a.type !== 'STREAMING') - Number(b.type !== 'STREAMING')));

  const aired = $derived.by(() => {
    const start = formatFuzzyDate(media.startDate);
    const end = formatFuzzyDate(media.endDate);
    if (!start) return null;
    if (!end) return media.status === 'RELEASING' ? `Since ${start}` : start;
    return start === end ? start : `${start} – ${end}`;
  });

  const about = $derived(
    [
      ['Diffusion', aired],
      ['Membres', media.popularity?.toLocaleString('fr-FR')],
      ['Favoris', media.favourites?.toLocaleString('fr-FR')],
      ['Hashtag', media.hashtag],
      ['Romaji', media.title.romaji],
      ['Anglais', media.title.english],
      ['Original', media.title.native],
      ['Autres noms', media.synonyms.join(', ')],
    ].filter((row): row is [string, string] => Boolean(row[1])),
  );

  function friendStatus(friend: FollowingEntry): string {
    const label = formatListStatus(friend.status, media.type);
    const showsProgress = ['CURRENT', 'REPEATING', 'PAUSED', 'DROPPED'].includes(friend.status) && friend.progress;
    return showsProgress ? `${label} · ${media.type === 'MANGA' ? 'ch.' : 'ép.'} ${friend.progress}` : label;
  }
</script>

<Section title="Le dossier">
  <div class="dashboard">
    {#if scores.length}
      <DashboardCard title="Les notes" accent="var(--colorStar)" span={statuses.length ? 2 : 3}>
        <div class="histogram">
          {#each scores as bucket (bucket.score)}
            <div class="bar" title="{bucket.score}%: {bucket.amount.toLocaleString()} membres">
              <span class="bar-count">{formatCompact(bucket.amount)}</span>
              <span class="bar-fill" style:height="{Math.max((bucket.amount / maxScoreAmount) * 85, 2)}%"></span>
              <span class="bar-label">{bucket.score}</span>
            </div>
          {/each}
        </div>
      </DashboardCard>
    {/if}

    {#if statuses.length}
      <DashboardCard title="Les lecteurs" accent="var(--colorStrawberry)">
        <div class="status-bar">
          {#each statuses as bucket (bucket.status)}
            <span style:flex={bucket.amount} style:background={statusColor(bucket.status)}></span>
          {/each}
        </div>
        <ul class="legend">
          {#each statuses as bucket (bucket.status)}
            <li>
              <span class="dot" style:background={statusColor(bucket.status)}></span>
              {formatListStatus(bucket.status, media.type)}
              <strong>{formatCompact(bucket.amount)}</strong>
              <span class="faint">{Math.round((bucket.amount / statusTotal) * 100)}%</span>
            </li>
          {/each}
        </ul>
      </DashboardCard>
    {/if}

    {#if sortedFriends.length}
      <DashboardCard title="Tes amis · {friends.length}" accent="var(--colorSky)">
        <ul class="friends">
          {#each sortedFriends as friend (friend.name)}
            <li>
              <a href="#{userPath(friend.name)}">
                <img src={friend.avatar} alt="" loading="lazy" width="30" height="30" />
                <span class="friend-info">
                  <span class="friend-name">{friend.name}</span>
                  <span class="faint">{friendStatus(friend)}</span>
                </span>
                {#if friend.score}
                  <strong class="friend-score">{friend.score}%</strong>
                {:else}
                  <span class="faint">–</span>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </DashboardCard>
    {/if}

    <DashboardCard title="Infos" accent="var(--colorLilac)" span={sortedFriends.length ? 1 : 2}>
      <dl class="about">
        {#each about as [label, value] (label)}
          <dt>{label}</dt>
          <dd>{value}</dd>
        {/each}
        {#if media.producers.length}
          <dt>Producteurs</dt>
          <dd>
            {#each media.producers as producer, index (producer.id)}
              {#if index}, {/if}<a href="#{studioPath(producer.id)}">{producer.name}</a>
            {/each}
          </dd>
        {/if}
        {#if media.countryOfOrigin && media.countryOfOrigin !== 'JP'}
          <dt>Pays</dt>
          <dd>{formatEnum(media.countryOfOrigin)}</dd>
        {/if}
      </dl>
    </DashboardCard>

    {#if links.length}
      <DashboardCard title="Où regarder" accent="var(--colorSuccess)">
        <div class="links">
          {#each links as link, index (index)}
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              <span class="link-icon" style:background={link.color ?? 'var(--textFaint)'}>
                {#if link.icon}<img src={link.icon} alt="" width="14" height="14" />{/if}
              </span>
              {link.site}
            </a>
          {/each}
        </div>
      </DashboardCard>
    {/if}
  </div>
</Section>

<style>
  .dashboard {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: 250px;
    gap: var(--space4);
  }

  @media (max-width: 1000px) {
    .dashboard {
      grid-template-columns: minmax(0, 1fr);
    }

    .dashboard :global(.dashboard-card) {
      grid-column: auto;
    }
  }

  .histogram {
    display: flex;
    align-items: flex-end;
    gap: var(--space2);
    height: 100%;
  }

  .bar {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: flex-end;
    gap: 4px;
    height: 100%;
    text-align: center;
  }

  .bar-fill {
    border-radius: 4px 4px 2px 2px;
    border: var(--outlineThin);
    background: var(--colorLilac);
  }

  .bar-count {
    color: var(--textSoft);
    font-size: 1rem;
    font-weight: 600;
  }

  .bar-label {
    color: var(--textFaint);
    font-size: 1rem;
  }

  .status-bar {
    display: flex;
    gap: 2px;
    height: 8px;
    overflow: hidden;
    border-radius: var(--radiusPill);
  }

  .legend,
  .friends {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legend {
    gap: 8px;
    margin-top: var(--space4);
    color: var(--textSoft);
  }

  .legend li {
    display: grid;
    grid-template-columns: 8px 1fr auto 36px;
    align-items: center;
    gap: var(--space2);
  }

  .legend strong {
    color: var(--textMain);
  }

  .legend .faint {
    text-align: right;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .friends a {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 5px 8px;
    border-radius: var(--radiusSmall);
  }

  .friends a:hover {
    background: var(--colorSunken);
  }

  .friends img {
    border-radius: 50%;
    object-fit: cover;
  }

  .friend-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: var(--fontSizeXs);
  }

  .friend-name {
    overflow: hidden;
    font-size: var(--fontSizeSm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .friend-score {
    font-family: var(--fontTitle);
    font-weight: 400;
  }

  .about {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 6px var(--space4);
    margin: 0;
  }

  .about dt {
    color: var(--textFaint);
  }

  .about dd {
    margin: 0;
  }

  .about a {
    color: var(--textSoft);
  }

  .links {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .links a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 8px;
    border-radius: var(--radiusSmall);
    color: var(--textSoft);
    font-weight: 600;
  }

  .links a:hover {
    background: var(--colorSunken);
    color: var(--textMain);
  }

  .link-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
  }
</style>
