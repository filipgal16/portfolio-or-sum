import './style.css';
import { createSurface, type HeightFn, type Surface } from './surface';
import { ascent, createCalmBoxes, createRipples, heroField, orbs, rings, strip } from './fields';

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
  const calm = createCalmBoxes(6);

  // Measure where the hero's text actually is and flatten the ridges under
  // it, so the text stays readable wherever the layout puts it. Runs before
  // the surface is created so its observer fires first on every resize.
  const PAD = 14;
  const FEATHER = 56;
  const textParts = ['.brand', '.nav ul', '.hero__title', '.lede'];

  // Behind the small intro paragraph the dots stay but turn a light grey and
  // the surface there holds still (see calm.still), so the text reads clearly. Box in canvas px: [left, top, right, bottom].
  const TINT = 0.18;
  const TINT_PAD = 12;
  const TINT_FEATHER = 28;
  const lede = [0, 0, 0, 0];
  let hasLede = false;
  const ramp = (a: number, b: number, v: number): number => {
    let u = (v - a) / (b - a);
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    return u * u * (3 - 2 * u);
  };
  const dotTint = (x: number, y: number): number => {
    if (!hasLede) return 1;
    const inX = ramp(lede[0] - TINT_FEATHER, lede[0], x) * (1 - ramp(lede[2], lede[2] + TINT_FEATHER, x));
    if (inX <= 0) return 1;
    const inY = ramp(lede[1] - TINT_FEATHER, lede[1], y) * (1 - ramp(lede[3], lede[3] + TINT_FEATHER, y));
    return 1 - (1 - TINT) * inX * inY;
  };
  const textBox = (el: Element): DOMRect | null => {
    // For text blocks, use the extent of the actual lines, not the full box.
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) return el.getBoundingClientRect();
    const l = Math.min(...rects.map((r) => r.left));
    const t = Math.min(...rects.map((r) => r.top));
    const r = Math.max(...rects.map((r) => r.right));
    const b = Math.max(...rects.map((r) => r.bottom));
    return new DOMRect(l, t, r - l, b - t);
  };
  const measureCalm = (): void => {
    const c = heroCanvas.getBoundingClientRect();
    if (c.width === 0 || c.height === 0) return;
    let n = 0;
    for (const sel of textParts) {
      const el = hero.querySelector(sel);
      const b = el && textBox(el);
      if (!b || n * 4 >= calm.data.length) continue;
      calm.data[n * 4] = (b.left - PAD - c.left) / c.width;
      calm.data[n * 4 + 1] = (b.top - PAD - c.top) / c.height;
      calm.data[n * 4 + 2] = (b.right + PAD - c.left) / c.width;
      calm.data[n * 4 + 3] = (b.bottom + PAD - c.top) / c.height;
      calm.still[n] = sel === '.lede' ? 1 : 0;
      if (sel === '.lede') {
        lede[0] = b.left - TINT_PAD - c.left;
        lede[1] = b.top - TINT_PAD - c.top;
        lede[2] = b.right + TINT_PAD - c.left;
        lede[3] = b.bottom + TINT_PAD - c.top;
        hasLede = true;
      }
      n++;
    }
    calm.count = n;
    calm.featherU = FEATHER / c.width;
    calm.featherV = FEATHER / c.height;
  };
  measureCalm();
  new ResizeObserver(measureCalm).observe(hero);

  const surface = createSurface(heroCanvas, heroField(ripples, calm), {
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
    dotTint,
    still: reduced,
  });
  surfaces.push(surface);

  // Web fonts change the text's size once they arrive: measure again then.
  document.fonts.ready.then(() => {
    measureCalm();
    surface.render(time);
  });

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
