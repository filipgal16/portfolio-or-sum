import './style.css';
import { createSurface, type HeightFn, type Surface } from './surface';
import { ascent, createRipples, heroField, orbs, rings, strip } from './fields';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const surfaces: Surface[] = [];

// One clock for every surface. It only advances while the loop runs, so a
// hidden tab resumes where it left off instead of jumping.
let time = 0;

// Hero ------------------------------------------------------------------------

const hero = document.querySelector<HTMLElement>('.hero');
const heroCanvas = hero?.querySelector<HTMLCanvasElement>('canvas');
if (hero && heroCanvas) {
  const ripples = createRipples(8);
  const surface = createSurface(heroCanvas, heroField(ripples), {
    // Sizes at a 1440 px wide hero; they scale with the screen from there.
    step: 6,
    cell: 12,
    grid: [160, 170],
    scaleRef: 1440,
    scaleMin: 0.8,
    scaleMax: 2,
    render3d: true,
    adaptive: true,
    eventTarget: hero,
    still: reduced,
  });
  surfaces.push(surface);

  if (!reduced) {
    hero.addEventListener('click', (e) => {
      if ((e.target as Element).closest('a')) return;
      const p = surface.toField(e.clientX, e.clientY);
      ripples.spawn(p.x, p.y, time);
    });
  }
}

// Work rows -------------------------------------------------------------------

const rowFields: Record<string, HeightFn> = { ascent, drift: orbs, ripple: rings };
for (const canvas of document.querySelectorAll<HTMLCanvasElement>('canvas[data-field]')) {
  const fn = rowFields[canvas.dataset.field ?? ''];
  if (!fn) continue;
  surfaces.push(
    createSurface(canvas, fn, {
      step: 8,
      cell: 7,
      scaleRef: 420,
      scaleMin: 0.8,
      scaleMax: 1.6,
      strength: 1,
      adaptive: true,
      still: reduced,
    }),
  );
}

// Contact strip ---------------------------------------------------------------

const stripCanvas = document.querySelector<HTMLCanvasElement>('.contact__strip');
if (stripCanvas) {
  surfaces.push(
    createSurface(stripCanvas, strip, {
      step: 8,
      cell: 9,
      scaleRef: 1440,
      scaleMin: 0.8,
      scaleMax: 2,
      inv: true,
      adaptive: true,
      still: reduced,
    }),
  );
}

// Shared loop -----------------------------------------------------------------

let running = false;
let raf = 0;
let last = 0;

function tick(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;
  for (const s of surfaces) if (s.visible) s.render(time);
  raf = requestAnimationFrame(tick);
}

function start(): void {
  if (running || reduced || document.hidden) return;
  running = true;
  last = performance.now();
  raf = requestAnimationFrame(tick);
}

function stop(): void {
  running = false;
  cancelAnimationFrame(raf);
}

// With reduced motion each surface paints one still frame (on resize and when
// it scrolls into view) and the loop never starts.
if (!reduced) {
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
}
