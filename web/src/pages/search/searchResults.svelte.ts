import { browseMedia, type BrowseFilters, type BrowseMedia, type BrowseResult } from '../../api/queries/search';
import { toasts } from '../../state/toasts.svelte';

type KeepTest = ((media: BrowseMedia) => boolean) | undefined;

// <-- Les classements bougent entre deux pages : on retire les doublons -->
function appendPage(previous: BrowseResult, next: BrowseResult): BrowseResult {
  const seen = new Set(previous.media.map((media) => media.id));
  return { pageInfo: next.pageInfo, media: [...previous.media, ...next.media.filter((media) => !seen.has(media.id))] };
}

/** Explorer's results; only the latest search may write them, so a slow older one is dropped. */
export class SearchResults {
  result = $state<BrowseResult | null>(null);
  isLoading = $state(false);
  isLoadingMore = $state(false);
  private latestSearch = 0;

  /** Loads results up to `lastPage`; pages seen in the last minutes come straight from the cache. Resolves false if superseded. */
  async search(filters: BrowseFilters, keep: KeepTest, lastPage = 1): Promise<boolean> {
    const searchId = ++this.latestSearch;
    this.isLoading = true;
    try {
      let loaded = await browseMedia(filters, 1, keep);
      while (loaded.pageInfo.hasNextPage && loaded.pageInfo.currentPage < lastPage) {
        loaded = appendPage(loaded, await browseMedia(filters, loaded.pageInfo.currentPage + 1, keep));
      }
      if (searchId !== this.latestSearch) return false;
      this.result = loaded;
      return true;
    } catch (error) {
      toasts.error(error, 'La recherche a échoué');
      return false;
    } finally {
      if (searchId === this.latestSearch) this.isLoading = false;
    }
  }

  async loadMore(filters: BrowseFilters, keep: KeepTest): Promise<void> {
    const current = this.result;
    if (!current) return;
    this.isLoadingMore = true;
    try {
      this.result = appendPage(current, await browseMedia(filters, current.pageInfo.currentPage + 1, keep));
    } catch (error) {
      toasts.error(error, 'Impossible de charger la suite');
    } finally {
      this.isLoadingMore = false;
    }
  }
}
