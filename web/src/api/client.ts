const apiUrl = 'https://graphql.anilist.co';
const maxRateLimitRetries = 2;
const requestTimeoutMs = 20_000;

// <-- AniList limite à ~30 requêtes/minute : les tâches de fond restent bien en dessous -->
const backgroundIntervalMs = 2500;

export class AniListError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || /invalid token/i.test(this.message);
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

interface GraphQLResponse<T> {
  data: T | null;
  errors?: { message: string; status?: number }[];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    }).catch((error: unknown) => {
      const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
      throw new AniListError(isTimeout ? 'AniList took too long to answer.' : "Couldn't reach AniList.", 0);
    });

    if (response.status === 429 && attempt < maxRateLimitRetries) {
      const retryAfter = Number(response.headers.get('Retry-After')) || 30;
      await wait(retryAfter * 1000);
      continue;
    }

    const body = (await response.json().catch(() => null)) as GraphQLResponse<T> | null;
    const firstError = body?.errors?.[0];
    if (firstError || !body?.data) {
      throw new AniListError(firstError?.message ?? `AniList request failed (${response.status})`, firstError?.status ?? response.status);
    }
    return body.data;
  }
}

let backgroundQueue: Promise<unknown> = Promise.resolve();

/** Like `gql`, but spaced out for bulk work such as library matching. */
export function gqlBackground<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const request = backgroundQueue.then(() => gql<T>(query, variables));
  backgroundQueue = request.catch(() => undefined).then(() => wait(backgroundIntervalMs));
  return request;
}
