// Turns an AI-generated "pixel art" image into real pixel art: one image pixel per art pixel,
// every pixel from the game palette. AI images usually have uneven pixel sizes, soft edges, JPEG-ish
// noise and either a flat background or real transparency; this undoes all of that.
// Pure functions on RGBA buffers so they can be unit-tested; tools/pixelize.ts does the file I/O.

import { PALETTE_RGB } from '../src/game/art/palette';

export interface Rgba {
  data: Uint8Array; // RGBA, row-major
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BG_TOLERANCE = 48;

const at = (img: Rgba, x: number, y: number) => (y * img.width + x) * 4;

/** "Redmean" colour distance: cheap and much closer to perceived difference than plain RGB. */
function dist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export function nearestPalette(r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  PALETTE_RGB.forEach(([pr, pg, pb], i) => {
    const d = dist(r, g, b, pr, pg, pb);
    if (d < bestD) (bestD = d), (best = i);
  });
  return best;
}

/**
 * Mask of pixels that belong to the subject. Uses real transparency when the image has it; otherwise
 * flood-fills the flat background inwards from the border (so white inside the art, like eyes, survives).
 */
export function subjectMask(img: Rgba): Uint8Array {
  const n = img.width * img.height;
  const mask = new Uint8Array(n);
  let hasAlpha = false;
  for (let i = 0; i < n; i++) if (img.data[i * 4 + 3]! < 250) hasAlpha = true;
  if (hasAlpha) {
    for (let i = 0; i < n; i++) mask[i] = img.data[i * 4 + 3]! >= 128 ? 1 : 0;
    return mask;
  }

  // Background colour = the most common border colour (coarsely bucketed).
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const border: number[] = [];
  for (let x = 0; x < img.width; x++) border.push(x, (img.height - 1) * img.width + x);
  for (let y = 0; y < img.height; y++) border.push(y * img.width, y * img.width + img.width - 1);
  for (const p of border) {
    const r = img.data[p * 4]!, g = img.data[p * 4 + 1]!, b = img.data[p * 4 + 2]!;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const c = counts.get(key) ?? { n: 0, r, g, b };
    c.n++;
    counts.set(key, c);
  }
  const bg = [...counts.values()].sort((a, b) => b.n - a.n)[0]!;

  mask.fill(1);
  const stack = border.filter((p) => dist(img.data[p * 4]!, img.data[p * 4 + 1]!, img.data[p * 4 + 2]!, bg.r, bg.g, bg.b) < BG_TOLERANCE);
  for (const p of stack) mask[p] = 0;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % img.width;
    const y = (p - x) / img.width;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
      const q = ny * img.width + nx;
      if (!mask[q]) continue;
      if (dist(img.data[q * 4]!, img.data[q * 4 + 1]!, img.data[q * 4 + 2]!, bg.r, bg.g, bg.b) >= BG_TOLERANCE) continue;
      mask[q] = 0;
      stack.push(q);
    }
  }
  return mask;
}

/** Bounding box of the subject, or null if the image is empty. */
export function subjectBox(img: Rgba, mask: Uint8Array): Box | null {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!mask[y * img.width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function unionBox(boxes: readonly Box[]): Box {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Guesses how many image pixels make one art pixel, from the lengths of same-colour runs along rows.
 * Used to suggest --height when the user does not know it.
 */
export function estimateCellSize(img: Rgba, mask: Uint8Array, box: Box): number {
  return coarseCellSize(runLengths(img, mask, box));
}

/**
 * Best guess of the sprite's height in art pixels. AI images rarely use a whole-number pixel size
 * (24.6 px is typical), so after the coarse guess this tries nearby heights and keeps the one whose
 * cell size makes the observed runs closest to whole multiples.
 */
export function estimateArtHeight(img: Rgba, mask: Uint8Array, box: Box): number {
  const hist = runLengths(img, mask, box);
  const s = coarseCellSize(hist);
  let best = Math.max(1, Math.round(box.h / s));
  let bestErr = Infinity;
  for (let n = Math.max(1, Math.floor(box.h / (s + 1.5))); n <= Math.ceil(box.h / Math.max(1, s - 1.5)); n++) {
    const c = box.h / n;
    let err = 0;
    let total = 0;
    for (const [len, count] of hist) {
      const k = Math.max(1, Math.round(len / c));
      err += (count * Math.abs(len - k * c)) / c;
      total += count;
    }
    if (total && err / total < bestErr) (bestErr = err / total), (best = n);
  }
  return best;
}

/**
 * Histogram of distances between the starts of consecutive same-colour runs along rows.
 * Blurred edges leave 1–2 px "transition" runs that would shorten every run; measuring start-to-start
 * between real runs (3 px or longer) cancels that out, so distances stay whole multiples of the cell.
 */
function runLengths(img: Rgba, mask: Uint8Array, box: Box): Map<number, number> {
  const hist = new Map<number, number>();
  for (let y = box.y; y < box.y + box.h; y += 2) {
    const runs: { c: number; start: number; len: number }[] = [];
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = at(img, x, y);
      const c = mask[y * img.width + x] ? nearestPalette(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!) : -2;
      const last = runs[runs.length - 1];
      if (last && last.c === c) last.len++;
      else runs.push({ c, start: x, len: 1 });
    }
    // Keep real runs, joining ones of the same colour that noise split apart.
    const real: { c: number; start: number }[] = [];
    for (const r of runs) {
      if (r.len < 3) continue;
      if (real.length && real[real.length - 1]!.c === r.c) continue;
      real.push(r);
    }
    for (let k = 1; k + 1 < real.length; k++) {
      // Skip k = 0: the row's first run starts at the crop edge, not at a pixel boundary.
      const d = real[k + 1]!.start - real[k]!.start;
      hist.set(d, (hist.get(d) ?? 0) + 1);
    }
  }
  return hist;
}

/**
 * Coarse cell size: the most common start-to-start distance. Pixel-art outlines are one art pixel
 * wide, so single-pixel runs dominate. A non-integer cell (13.4 px) splits that peak between 13 and
 * 14, so neighbouring distances are pooled and averaged.
 */
function coarseCellSize(hist: Map<number, number>): number {
  let best = 1;
  let bestCount = 0;
  for (const [d] of hist) {
    if (d < 3) continue;
    const pooled = (hist.get(d) ?? 0) + (hist.get(d + 1) ?? 0);
    if (pooled > bestCount) {
      bestCount = pooled;
      const a = hist.get(d) ?? 0;
      const b = hist.get(d + 1) ?? 0;
      best = (d * a + (d + 1) * b) / (a + b);
    }
  }
  return best;
}

export interface PixelizeResult extends Rgba {
  /** Share of art pixels whose colour vote was close (under 60 %): high values mean a wrong --height. */
  uncertain: number;
  colorsUsed: number;
}

/** Resamples `box` of the image to `targetH` art pixels tall, snapping every pixel to the palette. */
export function pixelize(img: Rgba, mask: Uint8Array, box: Box, targetH: number): PixelizeResult {
  const cell = box.h / targetH;
  const targetW = Math.max(1, Math.round(box.w / cell));
  const out = new Uint8Array(targetW * targetH * 4);
  const used = new Set<number>();
  let uncertain = 0;
  let opaqueCells = 0;

  for (let ty = 0; ty < targetH; ty++) {
    for (let tx = 0; tx < targetW; tx++) {
      // Sample the middle 60 % of the cell: edges are where AI images blur between pixels.
      const sx0 = box.x + (tx + 0.2) * cell, sx1 = box.x + (tx + 0.8) * cell;
      const sy0 = box.y + (ty + 0.2) * cell, sy1 = box.y + (ty + 0.8) * cell;
      const votes = new Map<number, number>();
      let total = 0;
      let opaque = 0;
      for (let y = Math.floor(sy0); y < Math.max(Math.ceil(sy1), Math.floor(sy0) + 1); y++) {
        for (let x = Math.floor(sx0); x < Math.max(Math.ceil(sx1), Math.floor(sx0) + 1); x++) {
          if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
          total++;
          if (!mask[y * img.width + x]) continue;
          opaque++;
          const i = at(img, x, y);
          const c = nearestPalette(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!);
          votes.set(c, (votes.get(c) ?? 0) + 1);
        }
      }
      const o = (ty * targetW + tx) * 4;
      if (total === 0 || opaque * 2 < total) continue; // transparent
      const [winner, n] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]!;
      opaqueCells++;
      if (n / opaque < 0.6) uncertain++;
      used.add(winner);
      const [r, g, b] = PALETTE_RGB[winner]!;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }
  return { data: out, width: targetW, height: targetH, uncertain: opaqueCells ? uncertain / opaqueCells : 0, colorsUsed: used.size };
}
