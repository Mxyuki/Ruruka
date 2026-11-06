import { mount, unmount } from 'svelte';
import ProfileVideo from './ProfileVideo.svelte';

/** Svelte action: replaces the videos of a rendered profile text with Ruruka's player. */
export function profileVideos(container: HTMLElement): { destroy: () => void } {
  const players = [...container.querySelectorAll('video')].map((video) => {
    const target = document.createElement('span');
    const src = video.getAttribute('src') ?? '';
    video.replaceWith(target);
    return mount(ProfileVideo, { target, props: { src } });
  });
  return {
    destroy: () => {
      for (const player of players) void unmount(player);
    },
  };
}
