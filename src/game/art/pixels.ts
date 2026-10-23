// Sprites drawn as text: one character per art pixel, keys from PALETTE_KEYS, '.' = transparent.
// Used for placeholder art until the ChatGPT sprites arrive, and for small UI icons.

import { PALETTE_KEYS, type PaletteKey } from './palette';

export type PixelRows = readonly string[];

/** Problems with a sprite's rows (ragged widths, unknown colour keys); empty when valid. */
export function checkRows(name: string, rows: PixelRows): string[] {
  const errors: string[] = [];
  const width = rows[0]?.length ?? 0;
  rows.forEach((row, y) => {
    if (row.length !== width) errors.push(`${name} row ${y}: width ${row.length}, expected ${width}`);
    for (const ch of row) if (ch !== '.' && !(ch in PALETTE_KEYS)) errors.push(`${name} row ${y}: unknown colour key "${ch}"`);
  });
  return errors;
}

/** Paints rows onto a 2D canvas context at (0,0), one canvas pixel per art pixel. */
export function paintRows(ctx: CanvasRenderingContext2D, rows: PixelRows): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      ctx.fillStyle = PALETTE_KEYS[ch as PaletteKey];
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

/** Writes `patch` rows into `rows` starting at column x, row y (patch '.' leaves the pixel unchanged). */
export function overlay(rows: PixelRows, patch: PixelRows, x: number, y: number): string[] {
  const out = rows.slice();
  patch.forEach((prow, dy) => {
    const target = out[y + dy]!;
    let next = '';
    for (let i = 0; i < target.length; i++) {
      const p = i - x >= 0 && i - x < prow.length ? prow[i - x]! : '.';
      next += p === '.' ? target[i] : p;
    }
    out[y + dy] = next;
  });
  return out;
}
