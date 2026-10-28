const maxEntries = 150;

interface CacheEntry {
  expiresAt: number;
  value: Promise<unknown>;
}

const entries = new Map<string, CacheEntry>();

/**
 * Shares one in-flight or recent request per key. Failed loads are evicted so the next call
 * retries. The oldest entries are dropped past maxEntries to keep memory flat.
 */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const existing = entries.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value as Promise<T>;

  const value = load().catch((error: unknown) => {
    entries.delete(key);
    throw error;
  });
  entries.delete(key);
  entries.set(key, { expiresAt: Date.now() + ttlMs, value });
  if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
  return value;
}

export function invalidate(keyPrefix: string): void {
  for (const key of entries.keys()) {
    if (key.startsWith(keyPrefix)) entries.delete(key);
  }
}

export const minuteMs = 60_000;
