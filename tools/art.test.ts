// npm run test:unit — pixel-art checks: code-drawn sprites are valid, and the ChatGPT clean-up
// (pixelize) recovers a sprite from a blurry, noisy, wrongly scaled, flat-background copy of it.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import sharp from 'sharp';
import { PALETTE_KEYS, type PaletteKey } from '../src/game/art/palette';
import { checkRows, type PixelRows } from '../src/game/art/pixels';
import { MONITOR } from '../src/game/art/props';
import { EXPRESSIONS, technicianRows, TECH_H, TECH_W } from '../src/game/art/technician';
import { pixelView } from '../src/game/display';
import { estimateArtHeight, estimateCellSize, pixelize, subjectBox, subjectMask, type Rgba } from './pixelize-core';

test('every code-drawn sprite has even rows and only palette colours', () => {
  const sprites: [string, PixelRows][] = [...EXPRESSIONS.map((e) => [`tech-${e}`, technicianRows(e)] as [string, PixelRows]), ['monitor', MONITOR]];
  for (const [name, rows] of sprites) assert.deepEqual(checkRows(name, rows), []);
  for (const e of EXPRESSIONS) {
    const rows = technicianRows(e);
    assert.equal(rows.length, TECH_H);
    assert.equal(rows[0]!.length, TECH_W);
  }
});

test('expressions only change the face, so swapping them never moves the character', () => {
  const base = technicianRows('neutral');
  for (const e of EXPRESSIONS) {
    technicianRows(e).forEach((row, y) => {
      if (y < 10 || y > 16) assert.equal(row, base[y], `${e} differs outside the face at row ${y}`);
    });
  }
});

test('docs/palette.hex matches the palette in code', () => {
  const file = readFileSync(new URL('../docs/palette.hex', import.meta.url), 'utf8').trim().split('\n');
  assert.deepEqual(file, Object.values(PALETTE_KEYS).map((c) => c.slice(1)));
});

test('the pixel scale is always a whole number of device pixels and the canvas fits the screen', () => {
  for (const [w, h, dpr] of [[1280, 800, 1], [412, 915, 2.625], [360, 640, 3], [915, 412, 2.625], [1920, 1080, 1.25], [320, 480, 1]] as const) {
    const v = pixelView(w, h, dpr);
    assert.ok(Number.isInteger(v.scale) && v.scale >= 1);
    assert.ok(v.width * v.zoom <= w + 1e-9 && v.height * v.zoom <= h + 1e-9, `canvas larger than ${w}x${h}`);
    assert.ok(Math.min(v.width, v.height) >= 110 && Math.min(v.width, v.height) <= 240, `short side ${Math.min(v.width, v.height)} art px on ${w}x${h}@${dpr}`);
  }
});

function rowsToRgba(rows: PixelRows): Rgba {
  const w = rows[0]!.length, h = rows.length;
  const data = new Uint8Array(w * h * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const c = PALETTE_KEYS[ch as PaletteKey];
    data.set([parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255], (y * w + x) * 4);
  }));
  return { data, width: w, height: h };
}

/** Makes the kind of image ChatGPT returns: odd scale, blur, JPEG noise, white background, margins. */
async function messyCopy(rows: PixelRows, scale: number, transparent: boolean): Promise<Rgba> {
  const src = rowsToRgba(rows);
  let img = sharp(Buffer.from(src.data), { raw: { width: src.width, height: src.height, channels: 4 } })
    .resize(Math.round(src.width * scale), Math.round(src.height * scale), { kernel: 'nearest' })
    .extend({ top: 37, bottom: 51, left: 29, right: 44, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  // sharp reorders operations inside one pipeline (flatten would run before extend), so materialise first.
  if (!transparent) img = sharp(await sharp(await img.png().toBuffer()).flatten({ background: '#fdfdfb' }).blur(0.8).jpeg({ quality: 80 }).toBuffer());
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

/** The sprite without its transparent margin: pixelize returns sprites trimmed to the subject. */
function trimmed(img: Rgba): Rgba {
  const box = subjectBox(img, subjectMask(img))!;
  const data = new Uint8Array(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) data.set(img.data.subarray(((box.y + y) * img.width + box.x) * 4, ((box.y + y) * img.width + box.x + box.w) * 4), y * box.w * 4);
  return { data, width: box.w, height: box.h };
}

function matchShare(a: Rgba, b: Rgba): number {
  assert.equal(a.width, b.width, 'width');
  assert.equal(a.height, b.height, 'height');
  let same = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    const ta = a.data[i * 4 + 3]! < 128, tb = b.data[i * 4 + 3]! < 128;
    if (ta && tb) same++;
    else if (!ta && !tb && [0, 1, 2].every((k) => a.data[i * 4 + k] === b.data[i * 4 + k])) same++;
  }
  return same / (a.width * a.height);
}

const CASES: [string, PixelRows, boolean, number][] = [
  // 'surprised' has white eyes inside the art, which must survive background removal.
  ['tech-surprised', technicianRows('surprised'), false, 13.37],
  ['tech-surprised', technicianRows('surprised'), true, 13.37],
  ['tech-surprised', technicianRows('surprised'), false, 24.6],
  ['tech-surprised', technicianRows('surprised'), false, 7.8],
  ['tech-neutral', technicianRows('neutral'), false, 18.9],
  ['monitor', MONITOR, false, 16.4],
  ['monitor', MONITOR, true, 10.2],
];

for (const [name, rows, transparent, scale] of CASES) {
  test(`pixelize recovers ${name} from a messy ${transparent ? 'transparent' : 'flat-background JPEG'} copy at ${scale}x`, async () => {
    const img = await messyCopy(rows, scale, transparent);
    const mask = subjectMask(img);
    const box = subjectBox(img, mask)!;
    const cell = estimateCellSize(img, mask, box);
    assert.ok(Math.abs(cell - scale) <= 1.5, `estimated ${cell}px per art pixel, expected ~${scale}`);
    assert.equal(estimateArtHeight(img, mask, box), rows.length, 'suggested --height');
    const out = pixelize(img, mask, box, rows.length);
    const share = matchShare(out, trimmed(rowsToRgba(rows)));
    assert.ok(share >= 0.97, `only ${(share * 100).toFixed(1)}% of pixels recovered`);
    assert.ok(out.colorsUsed <= Object.keys(PALETTE_KEYS).length);
  });
}
