/**
 * Height functions h(x, y, t). Field x spans ±aspect, y spans ±1 (y down).
 * Heights sit roughly in 0..1; they are only ever lit, never drawn directly.
 */
import type { FieldState, HeightFn } from './surface';

const { sin, abs, pow, exp, sqrt, round } = Math;

function smoothstep(a: number, b: number, v: number): number {
  let u = (v - a) / (b - a);
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return u * u * (3 - 2 * u);
}

/** Domain-warped sine ridges: a soft folded-fabric surface. */
export function fold(x: number, y: number, t: number): number {
  const wx = x + 0.32 * sin(y * 1.7 + t * 0.13);
  const wy = y + 0.28 * sin(x * 1.3 - t * 0.17);
  const v = 1 - abs(sin(wx * 4.2 + 1.8 * sin(wy * 2.6 + t * 0.2) + wy * 1.5));
  return pow(v, 1.6) * 0.7 + 0.035 * sin(x * 17 + t * 0.6) * sin(y * 15 - t * 0.5);
}

/** A soft Gaussian bump under the pointer, faded by its presence. */
function bump(x: number, y: number, f: FieldState, amp: number, tight: number): number {
  if (f.presence < 0.001) return 0;
  const dx = x - f.px;
  const dy = y - f.py;
  return f.presence * amp * exp(-(dx * dx + dy * dy) * tight);
}

// Click ripples ------------------------------------------------------------

const RIPPLE_LIFE = 2.2;
const RIPPLE_SPEED = 0.9;
const RIPPLE_WIDTH = 0.14;

export interface Ripples {
  spawn(x: number, y: number, t: number): void;
  sample(x: number, y: number, t: number): number;
}

/** A fixed ring buffer of expanding Gaussian rings. */
export function createRipples(max = 8): Ripples {
  const data = new Float64Array(max * 3).fill(-1e9);
  let head = 0;
  let lastSpawn = -1e9;
  return {
    spawn(x, y, t) {
      const o = head * 3;
      data[o] = x;
      data[o + 1] = y;
      data[o + 2] = t;
      head = (head + 1) % max;
      lastSpawn = t;
    },
    sample(x, y, t) {
      if (t - lastSpawn > RIPPLE_LIFE) return 0;
      let h = 0;
      for (let i = 0; i < max; i++) {
        const o = i * 3;
        const age = t - data[o + 2];
        if (age < 0 || age > RIPPLE_LIFE) continue;
        const dx = x - data[o];
        const dy = y - data[o + 1];
        const q = (sqrt(dx * dx + dy * dy) - age * RIPPLE_SPEED) / RIPPLE_WIDTH;
        if (q > 4 || q < -4) continue;
        const fadeIn = age < 0.15 ? age / 0.15 : 1;
        h += fadeIn * (1 - age / RIPPLE_LIFE) * 0.45 * exp(-q * q);
      }
      return h;
    },
  };
}

// Surfaces -----------------------------------------------------------------

/**
 * Boxes, in 0..1 canvas coordinates (u across, v down), where the hero's
 * ridges flatten out so the text on top stays readable. The page measures
 * where its text really is and writes the boxes here, so the calm areas
 * follow the layout on every screen size.
 */
export interface CalmBoxes {
  /** [u0, v0, u1, v1] per box. */
  data: Float64Array;
  /**
   * Per box, 0..1: how completely the surface stops there. At 1 the ridges,
   * the cursor bump and click ripples all fade out, so the dots hold still.
   */
  still: Float64Array;
  count: number;
  /** Width of the soft edge, as a fraction of the canvas width and height. */
  featherU: number;
  featherV: number;
}

export function createCalmBoxes(max = 6): CalmBoxes {
  return {
    data: new Float64Array(max * 4),
    still: new Float64Array(max),
    count: 0,
    featherU: 0.04,
    featherV: 0.04,
  };
}

/** Hero: the fold, calmed on the left and under the text, plus cursor bump and ripples. */
export function heroField(ripples: Ripples, boxes: CalmBoxes): HeightFn {
  return (x, y, t, f) => {
    const u = (x / f.aspect + 1) * 0.5;
    const v = (y + 1) * 0.5;
    let mask = 0.18 + 0.82 * smoothstep(0.06, 0.52, u);
    // How far inside any text box this point is, with soft edges.
    const d = boxes.data;
    const fu = boxes.featherU;
    const fv = boxes.featherV;
    let calm = 0;
    let still = 0;
    for (let i = 0, a = 0; i < boxes.count; i++, a += 4) {
      const iu = smoothstep(d[a] - fu, d[a], u) * (1 - smoothstep(d[a + 2], d[a + 2] + fu, u));
      if (iu <= 0) continue;
      const iv = smoothstep(d[a + 1] - fv, d[a + 1], v) * (1 - smoothstep(d[a + 3], d[a + 3] + fv, v));
      const c = iu * iv;
      if (c > calm) calm = c;
      const sc = c * boxes.still[i];
      if (sc > still) still = sc;
    }
    mask += (0.12 - mask) * calm;
    const h = fold(x, y, t) * mask + bump(x, y, f, 0.32, 9) + ripples.sample(x, y, t);
    return still > 0 ? h * (1 - still) : h;
  };
}

// The row canvases are small (about 80 px of field per unit), so their
// features are broader than the hero's to stay well above the 8 px grid.

/** Row 01: the fold, zoomed in, on a faster clock. */
export const ascent: HeightFn = (x, y, t, f) =>
  fold(x * 0.42, y * 0.5, t * 1.7 + 11) + bump(x, y, f, 0.3, 3);

/** Row 02: a lattice of spheres whose radii breathe; spheres near the pointer swell. */
export const orbs: HeightFn = (x, y, t, f) => {
  const S = 1;
  const cx = round(x / S) * S;
  const cy = round(y / S) * S;
  const dx = x - cx;
  const dy = y - cy;
  let r = 0.3 + 0.08 * sin(t * 1.3 + cx * 2.9 + cy * 4.1);
  if (f.presence > 0.001) {
    const px = cx - f.px;
    const py = cy - f.py;
    r += f.presence * 0.1 * exp(-(px * px + py * py) * 1.5);
  }
  const d2 = r * r - dx * dx - dy * dy;
  return d2 > 0 ? sqrt(d2) * 1.4 : 0;
};

/** Row 03: concentric sine rings centred on the pointer, falling off exponentially. */
export const rings: HeightFn = (x, y, t, f) => {
  const dx = x - f.px;
  const dy = y - f.py;
  const d = sqrt(dx * dx + dy * dy);
  return (0.5 + 0.5 * sin(d * 8 - t * 2.2)) * exp(-d * 0.9) * 0.7;
};

/** Contact strip: the fold, stretched along the band. Drawn inverted. */
export const strip: HeightFn = (x, y, t, f) =>
  fold(x * 0.55, y * 1.2, t * 0.8 + 40) + bump(x, y, f, 0.3, 4);
