// Where things fall on the belt room picture (src/assets/scenes/order-room.png, ChatGPT art pixelized to the palette,
// docs/pages-plan.md task C) in the boss's stage. The picture covers the stage; the belt in it runs from the hatch in
// the back wall down to the bottom edge. Cards and the belt's moving stripes are placed on that belt, in stage pixels.

/** The picture in art pixels, and its belt measured on it: the hatch's top, the row where the belt comes out of
 *  the hatch, and the half-width of the belt's surface there and at the bottom row (fractions of the picture). */
export const ROOM = { w: 197, h: 148, hatch: 38 / 148, far: 57 / 148, farHalf: 15 / 197, nearHalf: 85 / 197 } as const;

/** Cards are this share of the stage's width at full size (order.css .boss-card). */
export const CARD_W = 0.46;
/** Room kept above the hatch when the picture is taller than the stage (px). */
const ABOVE_HATCH = 6;

/** The picture's box in the stage (px). */
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The picture covers the stage, centred sideways. Taller than the stage, it is moved up as far as keeps the hatch
 *  in sight, but never so far that a gap shows under it. */
export function roomView(sw: number, sh: number): View {
  const s = Math.max(sw / ROOM.w, sh / ROOM.h);
  const w = ROOM.w * s;
  const h = ROOM.h * s;
  return { x: (sw - w) / 2, y: Math.min(0, Math.max(sh - h, ABOVE_HATCH - ROOM.hatch * h)), w, h };
}

/** The belt's left and right edges (stage px) at depth `v` of the picture (0 its top, 1 its bottom). */
export function beltEdges(view: View, v: number) {
  const t = (v - ROOM.far) / (1 - ROOM.far);
  const half = (ROOM.farHalf + (ROOM.nearHalf - ROOM.farHalf) * t) * view.w;
  const mid = view.x + view.w / 2;
  return { l: mid - half, r: mid + half };
}

/** Depth in the picture of a point `x` along the belt: 0 where it leaves the hatch, 1 at the stage's bottom edge.
 *  Far away a step along the belt is shorter on screen, as in perspective. */
export function depth(view: View, sh: number, x: number) {
  const end = Math.min(1, (sh - view.y) / view.h);
  return ROOM.far + (end - ROOM.far) * x ** 1.25;
}

/** Where card `x` along the belt is drawn: its centre (stage px) and size. Cards come on in turn on the left and
 *  right halves of the belt, each at least its own half-width from the middle, so two never overlap and each is easy
 *  to tap (near the hatch, and on short wide stages, that puts them a little beside the belt). Near the front the
 *  belt can be wider than a narrow stage, so a card is kept inside the stage. */
export function cardPlace(view: View, sw: number, sh: number, x: number, key: number) {
  const scale = 0.65 + 0.35 * x;
  const v = depth(view, sh, x);
  const { l, r } = beltEdges(view, v);
  const lane = key % 2 ? 1 : -1;
  const half = (CARD_W * sw * scale) / 2;
  const left = Math.min(sw - half - 4, Math.max(half + 4, (l + r) / 2 + lane * Math.max((r - l) / 4, half + 4)));
  return { top: view.y + v * view.h, left, scale };
}

/** The belt's stripes, `run` belt lengths travelled: each a line across the belt (stage px), moving as the cards do. */
export function stripes(view: View, sh: number, run: number, count = 8) {
  return Array.from({ length: count }, (_, i) => {
    const v = depth(view, sh, (((i / count + run) % 1) + 1) % 1);
    return { y: view.y + v * view.h, ...beltEdges(view, v) };
  });
}
