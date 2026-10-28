const particleCount = 7;
const burstMs = 600;
const triggerSelector = '.btn-primary, [data-sparkle]';
const particleColors = ['var(--colorStar)', 'var(--colorStrawberry)', 'var(--colorSky)'];
const kiraPath = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// <-- Fait jaillir quelques étoiles kira du point cliqué, puis les retire -->
function burst(x: number, y: number): void {
  for (let index = 0; index < particleCount; index++) {
    const angle = (index / particleCount) * Math.PI * 2 + Math.random() * 0.6;
    const distance = 24 + Math.random() * 22;
    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    particle.setAttribute('viewBox', '0 0 24 24');
    particle.setAttribute('class', 'sparkle-particle');
    particle.innerHTML = `<path d="${kiraPath}" stroke="#2b1e30" stroke-width="1.5" />`;
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.fill = particleColors[index % particleColors.length] ?? 'var(--colorStar)';
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    document.body.append(particle);
    setTimeout(() => particle.remove(), burstMs);
  }
}

/** Sparkles on every primary button and anything marked `data-sparkle`. Returns the uninstall function. */
export function installSparkles(): () => void {
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target.closest(triggerSelector) : null;
    if (!target || target.matches(':disabled') || prefersReducedMotion()) return;
    burst(event.clientX, event.clientY);
  };
  document.addEventListener('pointerdown', onPointerDown);
  return () => document.removeEventListener('pointerdown', onPointerDown);
}
