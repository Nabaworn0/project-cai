// npm run teach-frames — the senior's frames for the lesson cartoons (docs/lessons-plan.md, docs/art-prompts.md 6.1).
//
// ChatGPT drew nine edits of one sprite; pixelized together (art-source/teach-px, see below) the head still comes
// out a little different in each (a hair streak, a darker moustache, a pixel to the side). Here every pose gets the
// neutral frame's head, so only the arms change, and the three face frames become layers drawn over any pose:
// the mouth half open, wide open, the eyes shut, and the smiling and thinking faces. All frames keep one canvas, so layers fit every pose.
//
//   npm run pixelize -- "art-source/teach-*.png" --height 84 --out art-source/teach-px --no-preview
//   npm run teach-frames

import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const IN = 'art-source/teach-px';
const OUT = 'src/assets/sprites';

/** Rows of the neutral frame (art pixels): the head down to the collar, the eyes, the mouth and moustache; the
 *  mouth layer is only this many columns either side of the face's middle (not the cheeks and jaw). */
export const HEAD = { to: 45 };
export const EYES = { from: 26, to: 33 };
export const MOUTH = { from: 34, to: 41, half: 7 };
/** The thinking pose's hand is on his chin: there only the hair and eyes are the neutral ones. */
const CHIN_HEAD_TO = 33;

/** The frames the game uses, from ChatGPT's files: poses (whole sprites) and face layers. */
const POSES = { stand: 'neutral', 'point-left': 'pointleft', 'point-right': 'pointright', explain: 'explain', thumbs: 'thumbs', chin: 'chin' };
const FACE = { from: EYES.from, to: MOUTH.to, half: 99 };
const LAYERS = {
  'mouth-small': ['talksmall', MOUTH],
  'mouth-wide': ['talkwide', MOUTH],
  'eyes-shut': ['blink', { ...EYES, half: 99 }],
  // Smiling and thinking: eyes and mouth together (docs/art-prompts.md 6.1b).
  'face-happy': ['happy', FACE],
  'face-thinking': ['thinking', FACE],
} as const;

interface Frame {
  data: Buffer;
  w: number;
  h: number;
}
const read = async (name: string): Promise<Frame> => {
  const { data, info } = await sharp(`${IN}/teach-${name}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const write = (f: Frame, name: string) =>
  sharp(f.data, { raw: { width: f.w, height: f.h, channels: 4 } })
    .png()
    .toFile(`${OUT}/teach-${name}.png`);
const opaque = (f: Frame, x: number, y: number) => x >= 0 && x < f.w && y >= 0 && y < f.h && f.data[(y * f.w + x) * 4 + 3]! > 0;

/** The columns the neutral head covers on row y, `margin` pixels wider each side. */
function headSpan(base: Frame, y: number, margin = 0): [number, number] | null {
  let a = -1;
  let b = -1;
  for (let x = 0; x < base.w; x++) if (opaque(base, x, y)) ((a = a < 0 ? x : a), (b = x));
  return a < 0 ? null : [a - margin, b + margin];
}

/** How far a frame's head sits from the neutral one's (whole pixels), by the best overlap of rows 0-29. */
function offset(base: Frame, f: Frame): number {
  let best = { dx: 0, s: -1 };
  for (let dx = -3; dx <= 3; dx++) {
    let s = 0;
    for (let y = 0; y < 30; y++) for (let x = 0; x < base.w; x++) s += opaque(base, x, y) === opaque(f, x + dx, y) ? 1 : 0;
    if (s > best.s) best = { dx, s };
  }
  return best.dx;
}

const copyPx = (from: Frame, fx: number, fy: number, to: Frame, tx: number, ty: number) => {
  const a = (fy * from.w + fx) * 4;
  const b = (ty * to.w + tx) * 4;
  for (let k = 0; k < 4; k++) to.data[b + k] = from.data[a + k]!;
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const base = await read('neutral');
  for (const [pose, file] of Object.entries(POSES)) {
    const f = await read(file);
    if (f.w !== base.w || f.h !== base.h) throw new Error(`teach-${file}: ${f.w}x${f.h}, the neutral frame is ${base.w}x${base.h}`);
    const to = pose === 'chin' ? CHIN_HEAD_TO : HEAD.to;
    for (let y = 0; y <= to; y++) {
      // Two pixels wider round the hair, where ChatGPT's redraws left stray pixels; one at the collar, by the arms.
      const span = headSpan(base, y, y < 43 ? 2 : 1);
      if (span) for (let x = Math.max(0, span[0]); x <= Math.min(base.w - 1, span[1]); x++) copyPx(base, x, y, f, x, y);
    }
    await write(f, pose);
  }
  for (const [layer, [file, rows]] of Object.entries(LAYERS)) {
    const f = await read(file);
    const dx = offset(base, f);
    const out: Frame = { data: Buffer.alloc(base.w * base.h * 4), w: base.w, h: base.h };
    // Inside the neutral head only: the layer covers the neutral face part completely, and nothing else.
    for (let y = rows.from; y <= rows.to; y++) {
      const [a, b] = headSpan(base, y)!;
      const mid = Math.round((a + b) / 2);
      for (let x = Math.max(a, mid - rows.half); x <= Math.min(b, mid + rows.half); x++)
        if (opaque(base, x, y) && opaque(f, x + dx, y)) copyPx(f, x + dx, y, out, x, y);
    }
    await write(out, layer);
    console.log(`teach-${layer}: from ${file}, ${dx ? `moved ${-dx} px to fit` : 'in place'}`);
  }
  console.log(`teach frames: ${Object.keys(POSES).length} poses and ${Object.keys(LAYERS).length} face layers in ${OUT}`);
}

main();
