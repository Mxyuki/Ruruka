/** Reveals a spoiler when its label is clicked and hides it again on a click in its content. Returns the uninstall function. */
export function installSpoilers(): () => void {
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const spoiler = event.target.closest('.rich-text .spoiler');
    if (!spoiler || event.target.closest('a, iframe, video')) return;
    spoiler.classList.toggle('is-revealed');
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
