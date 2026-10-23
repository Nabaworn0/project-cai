// npm run pixelize -- <files or folders> [--height 39] [--same-rows 0-16,40-] [--same-cols 0-5,33-]
//                     [--out src/assets/sprites] [--no-preview]
//   --same-rows / --same-cols: in a frame set, copy these art rows / columns from the *-neutral frame
//                into the others (expressions only change the face; this removes AI noise elsewhere)
//   Technician: npm run pixelize -- "art-source/tech-*.png" --same-rows 0-16,40- --same-cols 0-5,33-
// npm run pixelize -- art-source/icons-sheet.png --grid 4x2 --names ram,ssd,usb,... [--prefix icon-]
// npm run pixelize -- --export-palette
//
// Cleans ChatGPT pixel-art images into game-ready sprites (see tools/pixelize-core.ts).
// Files that share a name prefix (tech-happy.png, tech-sad.png -> group "tech") are cropped with one
// shared box, so every expression keeps the character in exactly the same place.

import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import sharp from 'sharp';
import { PALETTE_KEYS } from '../src/game/art/palette';
import { estimateArtHeight, estimateCellSize, pixelize, subjectBox, subjectMask, unionBox, type Rgba } from './pixelize-core';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const has = (name: string) => {
  const i = args.indexOf(name);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};

if (has('--export-palette')) {
  const lines = Object.values(PALETTE_KEYS).map((c) => c.slice(1));
  writeFileSync('docs/palette.hex', lines.join('\n') + '\n');
  console.log(`docs/palette.hex: ${lines.length} colours (import into Aseprite / Lospec / Piskel)`);
  process.exit(0);
}

const heightArg = flag('--height');
const gridArg = flag('--grid');
const namesArg = flag('--names');
const prefixArg = flag('--prefix') ?? 'icon-';
/** '0-16,40-' -> [[0,16],[40,Infinity]] */
const ranges = (spec: string | undefined) =>
  spec?.split(',').map((part) => {
    const [a, b] = part.split('-');
    return [Number(a), b === undefined ? Number(a) : b === '' ? Infinity : Number(b)] as const;
  });
const sameRows = ranges(flag('--same-rows'));
const sameCols = ranges(flag('--same-cols'));
const outDir = flag('--out') ?? 'src/assets/sprites';
const preview = !has('--no-preview');
const previewDir = 'art-source/preview';

const IMAGE = /\.(png|webp|jpe?g)$/i;
// Windows shells (cmd, PowerShell) pass "art-source/tech-*.png" through unexpanded, so expand * here.
const expand = (p: string): string[] => {
  if (!p.includes('*')) return statSync(p).isDirectory() ? readdirSync(p).filter((f) => IMAGE.test(f)).map((f) => join(p, f)) : [p];
  const dir = dirname(p);
  const re = new RegExp(`^${basename(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i');
  return readdirSync(dir).filter((f) => re.test(f) && IMAGE.test(f)).map((f) => join(dir, f));
};
const inputs = args.flatMap(expand);
if (inputs.length === 0) {
  console.log('usage: npm run pixelize -- art-source/tech-neutral.png art-source/tech-happy.png --height 39');
  process.exit(1);
}

const stem = (f: string) => basename(f, extname(f));
const groupOf = (f: string) => {
  const s = stem(f);
  const prefix = s.includes('-') ? s.slice(0, s.lastIndexOf('-')) : s;
  return inputs.filter((g) => stem(g).startsWith(prefix + '-')).length > 1 ? prefix : s;
};
const groups = new Map<string, string[]>();
for (const f of inputs) groups.set(groupOf(f), [...(groups.get(groupOf(f)) ?? []), f]);

mkdirSync(outDir, { recursive: true });
if (preview) mkdirSync(previewDir, { recursive: true });

async function load(file: string): Promise<Rgba> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

let problems = 0;

async function save(r: { data: Uint8Array; width: number; height: number }, name: string): Promise<void> {
  const raw = { raw: { width: r.width, height: r.height, channels: 4 as const } };
  await sharp(Buffer.from(r.data), raw).png().toFile(join(outDir, name));
  if (preview) await sharp(Buffer.from(r.data), raw).resize(r.width * 8, r.height * 8, { kernel: 'nearest' }).png().toFile(join(previewDir, name));
}

// Sheet mode: cut one image into a grid of separate sprites that share the sheet's pixel size,
// so every icon comes out at the same pixel density.
if (gridArg) {
  const [cols, rows] = gridArg.split('x').map(Number) as [number, number];
  if (inputs.length !== 1 || !cols || !rows) throw new Error('--grid needs exactly one image and a size like 4x2');
  const names = namesArg?.split(',') ?? [];
  const sheet = await load(inputs[0]!);
  const mask = subjectMask(sheet);
  const cell = estimateCellSize(sheet, mask, subjectBox(sheet, mask)!);
  console.log(`${stem(inputs[0]!)}: ${cols}x${rows} sheet, ~${cell.toFixed(1)}px per art pixel`);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const k = r * cols + col;
      const cw = Math.floor(sheet.width / cols), ch = Math.floor(sheet.height / rows);
      const area = new Uint8Array(mask.length);
      for (let y = r * ch; y < (r + 1) * ch; y++) for (let x = col * cw; x < (col + 1) * cw; x++) area[y * sheet.width + x] = mask[y * sheet.width + x]!;
      const box = subjectBox(sheet, area);
      const name = `${prefixArg}${names[k] ?? k + 1}.png`;
      if (!box) {
        console.log(`  ! ${name}: cell ${k + 1} is empty`);
        problems++;
        continue;
      }
      const out = pixelize(sheet, area, box, Math.max(1, Math.round(box.h / cell)));
      await save(out, name);
      console.log(`  ${name}: ${out.width}x${out.height}, ${out.colorsUsed} colours`);
    }
  }
  console.log(`\nwrote ${outDir}/${problems ? ` — ${problems} warning(s) above` : ''}`);
  process.exit(0);
}

for (const [group, files] of groups) {
  const imgs = await Promise.all(files.map(load));
  const sizes = new Set(imgs.map((i) => `${i.width}x${i.height}`));
  if (sizes.size > 1) {
    console.log(`  ! ${group}: source images differ in size (${[...sizes].join(', ')}); expressions may not line up`);
    problems++;
  }
  const masks = imgs.map(subjectMask);
  const boxes = imgs.map((img, i) => subjectBox(img, masks[i]!));
  if (boxes.some((b) => !b)) {
    console.log(`  ! ${group}: an image is empty after background removal`);
    problems++;
    continue;
  }
  const box = unionBox(boxes as NonNullable<(typeof boxes)[number]>[]);
  // Each image votes; the group shares the median so every frame gets the same grid.
  const votes = imgs.map((img, i) => estimateArtHeight(img, masks[i]!, box)).sort((a, b) => a - b);
  const suggested = votes[Math.floor(votes.length / 2)]!;
  const cell = (box.h / suggested).toFixed(1);
  const targetH = heightArg ? Number(heightArg) : suggested;
  console.log(`${group}: ${files.length} file(s), subject ${box.w}x${box.h}px, looks like ~${cell}px per art pixel -> ${suggested} art px tall${heightArg ? ` (using --height ${targetH})` : ''}`);

  const results = files.map((_, i) => pixelize(imgs[i]!, masks[i]!, box, targetH));
  if ((sameRows || sameCols) && files.length > 1) {
    // Hair, headset and body should be identical in every frame; AI noise there would shimmer when
    // frames switch, so those pixels come from the neutral frame.
    const baseIdx = Math.max(0, files.findIndex((f) => stem(f).endsWith('-neutral')));
    const base = results[baseIdx]!;
    const inRanges = (v: number, ranges: readonly (readonly [number, number])[] | undefined) => !!ranges?.some(([a, b]) => v >= a && v <= b);
    for (const [i, r] of results.entries()) {
      if (i === baseIdx) continue;
      for (let y = 0; y < base.height; y++) {
        for (let x = 0; x < base.width; x++) {
          if (!inRanges(y, sameRows) && !inRanges(x, sameCols)) continue;
          const o = (y * base.width + x) * 4;
          r.data.set(base.data.subarray(o, o + 4), o);
        }
      }
    }
    const fmt = (rs: readonly (readonly [number, number])[]) => rs.map(([a, b]) => (b === Infinity ? `${a}+` : a === b ? `${a}` : `${a}-${b}`)).join(', ');
    console.log(`  ${[sameRows && `rows ${fmt(sameRows)}`, sameCols && `columns ${fmt(sameCols)}`].filter(Boolean).join(' and ')} copied from ${stem(files[baseIdx]!)} into the other frames`);
  }

  for (const [i, file] of files.entries()) {
    const r = results[i]!;
    const name = `${stem(file)}.png`;
    await save(r, name);
    const warn = r.uncertain > 0.15 ? `  <- ${Math.round(r.uncertain * 100)}% of pixels were a close call; try another --height` : '';
    if (warn) problems++;
    console.log(`  ${name}: ${r.width}x${r.height}, ${r.colorsUsed} colours${warn}`);
  }
}
console.log(`\nwrote ${outDir}/${preview ? ` and 8x previews in ${previewDir}/` : ''}${problems ? ` — ${problems} warning(s) above` : ''}`);
