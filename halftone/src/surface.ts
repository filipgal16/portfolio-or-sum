/**
 * Halftone surface engine.
 *
 * Each frame samples a height field on a coarse grid, lights it with a
 * directional light that follows the pointer, optionally paints the shade as a
 * soft greyscale "render" layer, then draws a halftone dot grid on top.
 *
 * All buffers are allocated on resize (or when the adaptive quality drops a
 * level), never per frame.
 */

/** What a height function can read about the surface it is drawn on. */
export interface FieldState {
  /** Width / height of the canvas. Field x spans ±aspect, y spans ±1 (y points down). */
  aspect: number;
  /** Eased pointer position in field units. */
  px: number;
  py: number;
  /** Eased pointer position normalised to ±1 on both axes. */
  nx: number;
  ny: number;
  /** Eases toward 1 while the pointer is over the surface and toward 0 after it leaves. */
  presence: number;
}

export type HeightFn = (x: number, y: number, t: number, f: FieldState) => number;

export interface SurfaceOptions {
  /** Height-field grid cell size in CSS px. */
  step: number;
  /** Halftone cell size in CSS px. */
  cell: number;
  /** Dot radius multiplier. */
  gain?: number;
  /** Normal strength k: how strongly slopes tilt the normal. */
  strength?: number;
  /** Dot displacement, in px per unit of gradient, at full pointer offset. */
  parallax?: number;
  /** Paint the smoothed greyscale shade layer under the dots. */
  render3d?: boolean;
  /** Faint grid line spacing [x, y] in CSS px. */
  grid?: readonly [number, number];
  /** Light dots on black instead of ink dots on paper. */
  inv?: boolean;
  /** Coarsen step, then cell, when frames stay slower than 20 ms. */
  adaptive?: boolean;
  /** Element whose pointer events steer the light. Defaults to the canvas. */
  eventTarget?: HTMLElement;
  /** Resting pointer, normalised ±1. The default puts the light at the top left. */
  rest?: readonly [number, number];
  /** Coarsest values the adaptive quality may fall back to. */
  maxStep?: number;
  maxCell?: number;
  /** No animation loop: redraw a still frame whenever the canvas resizes or scrolls into view. */
  still?: boolean;
  /** Time used for still frames and before the first animated frame. */
  t0?: number;
}

export interface Surface {
  readonly canvas: HTMLCanvasElement;
  /** True while the canvas is on screen. The shared loop skips surfaces that are not. */
  readonly visible: boolean;
  render(t: number): void;
  /** Convert a client position to field coordinates. */
  toField(clientX: number, clientY: number): { x: number; y: number };
  destroy(): void;
}

const E = 0.012;
/** Grids finer than this (in field units) differentiate between neighbouring nodes. */
const NEIGHBOUR_E = 0.02;
const EASE = 0.08;
const BUCKETS = 8;
const TAU = Math.PI * 2;
const SLOW_MS = 20;
const SLOW_FRAMES = 40;

export function createSurface(
  canvas: HTMLCanvasElement,
  heightFn: HeightFn,
  options: SurfaceOptions,
): Surface {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas is not available');

  const gain = options.gain ?? 1;
  const strength = options.strength ?? 0.4;
  const parallax = options.parallax ?? 1.6;
  const render3d = options.render3d ?? false;
  const grid = options.grid;
  const inv = options.inv ?? false;
  const adaptive = options.adaptive ?? false;
  const rest = options.rest ?? ([-0.55, -0.65] as const);
  const still = options.still ?? false;
  const maxStep = options.maxStep ?? Math.round(options.step * 2);
  const maxCell = options.maxCell ?? Math.round(options.cell * 1.6);

  const paper = inv ? '#0d0d0d' : '#ececec';
  const inkRGB = inv ? '236,236,236' : '13,13,13';
  const gridStyle = inv ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  // Dot alpha is 0.3 + 0.7·tone; dots are batched into BUCKETS alpha levels so
  // each frame needs only a handful of fill() calls.
  const bucketStyle: string[] = [];
  for (let b = 0; b < BUCKETS; b++) {
    bucketStyle.push(`rgba(${inkRGB},${(0.3 + (0.7 * (b + 0.5)) / BUCKETS).toFixed(3)})`);
  }

  let step = options.step;
  let cell = options.cell;

  // Canvas size in CSS px.
  let W = 0;
  let H = 0;

  // Height-field grid.
  let gc = 0;
  let gr = 0;
  let height = new Float32Array(0);
  let shade = new Float32Array(0);
  let gradX = new Float32Array(0);
  let gradY = new Float32Array(0);

  // Soft render layer: one pixel per grid node, scaled up with smoothing.
  const off = render3d ? document.createElement('canvas') : null;
  const offCtx = off ? off.getContext('2d', { willReadFrequently: true }) : null;
  let img: ImageData | null = null;

  // Halftone grid.
  let dc = 0;
  let dr = 0;
  let dots = new Float32Array(0);
  let dotBucket = new Uint8Array(0);

  const field: FieldState = { aspect: 1, px: 0, py: 0, nx: rest[0], ny: rest[1], presence: 0 };
  let targetX = rest[0];
  let targetY = rest[1];
  let targetPresence = 0;

  let visible = false;
  let lastT = options.t0 ?? 0;
  let ema = 0;
  let slowFrames = 0;

  function alloc(): void {
    gc = Math.ceil(W / step) + 2;
    gr = Math.ceil(H / step) + 2;
    const n = gc * gr;
    if (shade.length < n) {
      height = new Float32Array(n);
      shade = new Float32Array(n);
      gradX = new Float32Array(n);
      gradY = new Float32Array(n);
    }
    if (off && offCtx) {
      off.width = gc;
      off.height = gr;
      img = offCtx.createImageData(gc, gr);
      img.data.fill(255);
    }
    dc = Math.ceil(W / cell) + 1;
    dr = Math.ceil(H / cell) + 1;
    const m = dc * dr;
    if (dotBucket.length < m) {
      dots = new Float32Array(m * 3);
      dotBucket = new Uint8Array(m);
    }
  }

  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w;
    H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    alloc();
    // Setting the size clears the canvas; repaint at once so it never flashes.
    if (visible || still) render(lastT);
  }

  /** Light one grid node: normal from the gradient, Lambert-ish shade, fake AO. */
  function light(idx: number, h: number, hx: number, hy: number, lx: number, ly: number, lz: number): void {
    const nX = -hx * strength;
    const nY = -hy * strength;
    const d = (nX * lx + nY * ly + lz) / Math.sqrt(nX * nX + nY * nY + 1);
    let s = 0.5 + 0.6 * d - 0.14;
    s = s < 0 ? 0 : s > 1 ? 1 : s;
    s *= 0.82 + 0.3 * h; // fake ambient occlusion
    shade[idx] = s < 0 ? 0 : s > 1 ? 1 : s;
    gradX[idx] = hx;
    gradY[idx] = hy;
  }

  function render(t: number): void {
    if (W === 0 || H === 0) return;
    const started = performance.now();
    lastT = t;
    const c = ctx!;

    // Ease the pointer.
    field.nx += (targetX - field.nx) * EASE;
    field.ny += (targetY - field.ny) * EASE;
    field.presence += (targetPresence - field.presence) * EASE;
    const aspect = W / H;
    field.aspect = aspect;
    field.px = field.nx * aspect;
    field.py = field.ny;

    // Light direction points toward the pointer, raised above the surface.
    let lx = field.nx;
    let ly = field.ny;
    let lz = 0.9;
    const ll = 1 / Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx *= ll;
    ly *= ll;
    lz *= ll;

    // 1–3. Sample, differentiate, light.
    // Grid spacing in field units (the same along x and y).
    const g = (2 * step) / H;
    const fn = heightFn;
    if (g <= NEIGHBOUR_E) {
      // The grid is about as fine as E already: take forward differences
      // between neighbouring nodes, one height sample per node instead of three.
      for (let j = 0; j < gr; j++) {
        const y = j * g - 1;
        let idx = j * gc;
        for (let i = 0; i < gc; i++, idx++) height[idx] = fn(i * g - aspect, y, t, field);
      }
      const ig = 1 / g;
      for (let j = 0; j < gr; j++) {
        const down = j < gr - 1 ? gc : -gc;
        const sy = j < gr - 1 ? ig : -ig;
        let idx = j * gc;
        for (let i = 0; i < gc; i++, idx++) {
          const h = height[idx];
          const hx = i < gc - 1 ? (height[idx + 1] - h) * ig : (h - height[idx - 1]) * ig;
          const hy = (height[idx + down] - h) * sy;
          light(idx, h, hx, hy, lx, ly, lz);
        }
      }
    } else {
      for (let j = 0; j < gr; j++) {
        const y = j * g - 1;
        let idx = j * gc;
        for (let i = 0; i < gc; i++, idx++) {
          const x = i * g - aspect;
          const h = fn(x, y, t, field);
          const hx = (fn(x + E, y, t, field) - h) / E;
          const hy = (fn(x, y + E, t, field) - h) / E;
          light(idx, h, hx, hy, lx, ly, lz);
        }
      }
    }

    // 4. Background: soft render layer or flat paper.
    if (img && off && offCtx) {
      const data = img.data;
      const n = gc * gr;
      for (let i = 0, p = 0; i < n; i++, p += 4) {
        const v = 196 + 52 * shade[i];
        data[p] = v;
        data[p + 1] = v;
        data[p + 2] = v;
      }
      offCtx.putImageData(img, 0, 0);
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      // Pixel i is centred on grid node i, which sits at i·step.
      c.drawImage(off, -step / 2, -step / 2, gc * step, gr * step);
    } else {
      c.fillStyle = paper;
      c.fillRect(0, 0, W, H);
    }

    if (grid) {
      c.fillStyle = gridStyle;
      for (let x = grid[0]; x < W; x += grid[0]) c.fillRect(Math.round(x), 0, 1, H);
      for (let y = grid[1]; y < H; y += grid[1]) c.fillRect(0, Math.round(y), W, 1);
    }

    // 5. Halftone dots.
    const half = cell * 0.5;
    const rMax = cell * 0.52 * gain;
    const offX = field.nx * parallax;
    const offY = field.ny * parallax;
    const lastI = gc - 2;
    const lastJ = gr - 2;
    let count = 0;
    for (let j = 0; j < dr; j++) {
      const py = j * cell + half;
      const gy = py / step;
      let j0 = gy | 0;
      if (j0 > lastJ) j0 = lastJ;
      const ty = gy - j0;
      for (let i = 0; i < dc; i++) {
        const px = i * cell + half;
        const gx = px / step;
        let i0 = gx | 0;
        if (i0 > lastI) i0 = lastI;
        const tx = gx - i0;
        const a = j0 * gc + i0;
        const top = shade[a] + (shade[a + 1] - shade[a]) * tx;
        const bottom = shade[a + gc] + (shade[a + gc + 1] - shade[a + gc]) * tx;
        const s = top + (bottom - top) * ty;
        // Ink dots mark shadow; inverted light dots mark light.
        const tone = inv ? s : 1 - s;
        const r = rMax * Math.pow(tone, 1.15);
        if (r < 0.35) continue;
        const near = (ty < 0.5 ? j0 : j0 + 1) * gc + (tx < 0.5 ? i0 : i0 + 1);
        const o = count * 3;
        dots[o] = px + gradX[near] * offX;
        dots[o + 1] = py + gradY[near] * offY;
        dots[o + 2] = r;
        let b = (tone * BUCKETS) | 0;
        if (b >= BUCKETS) b = BUCKETS - 1;
        dotBucket[count] = b;
        count++;
      }
    }

    for (let b = 0; b < BUCKETS; b++) {
      let any = false;
      c.beginPath();
      for (let q = 0; q < count; q++) {
        if (dotBucket[q] !== b) continue;
        const o = q * 3;
        const x = dots[o];
        const y = dots[o + 1];
        const r = dots[o + 2];
        c.moveTo(x + r, y);
        c.arc(x, y, r, 0, TAU);
        any = true;
      }
      if (any) {
        c.fillStyle = bucketStyle[b];
        c.fill();
      }
    }

    // Adaptive quality: if frames stay slow, coarsen step first, then cell.
    if (adaptive && !still) {
      const ms = performance.now() - started;
      ema = ema === 0 ? ms : ema * 0.9 + ms * 0.1;
      if (ema > SLOW_MS) {
        if (++slowFrames > SLOW_FRAMES) {
          slowFrames = 0;
          ema = 0;
          if (step < maxStep) step++;
          else if (cell < maxCell) cell++;
          else return;
          alloc();
        }
      } else {
        slowFrames = 0;
      }
    }
  }

  // Pointer.
  const target = options.eventTarget ?? canvas;
  const onMove = (e: PointerEvent): void => {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    targetX = ((e.clientX - r.left) / r.width) * 2 - 1;
    targetY = ((e.clientY - r.top) / r.height) * 2 - 1;
    targetPresence = 1;
  };
  const onLeave = (): void => {
    targetX = rest[0];
    targetY = rest[1];
    targetPresence = 0;
  };
  target.addEventListener('pointermove', onMove, { passive: true });
  target.addEventListener('pointerdown', onMove, { passive: true });
  target.addEventListener('pointerleave', onLeave, { passive: true });

  // Size and visibility.
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const was = visible;
        visible = entry.isIntersecting;
        if (still && visible && !was) render(lastT);
      }
    },
    { rootMargin: '120px 0px' },
  );
  io.observe(canvas);

  return {
    canvas,
    get visible() {
      return visible;
    },
    render,
    toField(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const aspect = r.height > 0 ? r.width / r.height : 1;
      return {
        x: (((clientX - r.left) / r.width) * 2 - 1) * aspect,
        y: ((clientY - r.top) / r.height) * 2 - 1,
      };
    },
    destroy() {
      ro.disconnect();
      io.disconnect();
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerdown', onMove);
      target.removeEventListener('pointerleave', onLeave);
    },
  };
}
