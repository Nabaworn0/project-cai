// The game's fixed 16-bit palette (docs/style-guide.md). Every art pixel must be one of these colours:
// code-drawn sprites use the one-letter keys, and tools/pixelize.ts snaps ChatGPT images onto the same list.
// docs/palette.hex is generated from this file (npm run pixelize -- --export-palette).

export const PALETTE_KEYS = {
  K: '#1b2a4a', // outline navy
  k: '#2c3e66', // navy
  n: '#4a5f8f', // navy light
  Y: '#ffd23f', // yellow
  y: '#d9a12b', // yellow shade
  T: '#2ec4b6', // teal
  t: '#1f8f86', // teal shade
  u: '#8ff0e4', // teal light
  C: '#ff6b6b', // coral
  c: '#c94b55', // coral shade
  W: '#ffffff', // white
  w: '#fff4e0', // cream
  S: '#f6c69c', // skin
  s: '#d9976a', // skin shade
  H: '#2b2340', // hair
  h: '#4a3d66', // hair light
  B: '#ffe3b3', // wall
  b: '#ffd59a', // wall stripe
  F: '#c98f5a', // floor
  f: '#a8703f', // floor shade
  D: '#8a5a33', // wood
  d: '#5e3b20', // wood dark
  A: '#8fd3ff', // sky
  a: '#5aa8e6', // sky shade
  M: '#1d6fd6', // screen blue
  m: '#0f4a9e', // screen blue dark
  L: '#d8dee8', // light grey
  G: '#9aa5b8', // grey
  g: '#5f6b80', // grey dark
  P: '#b07cd6', // purple (customer clothes, rare cards)
  p: '#7a4fa3', // purple shade
  E: '#7bd65a', // green (status OK, plants)
} as const;

export type PaletteKey = keyof typeof PALETTE_KEYS;

/** Named colours for scene drawing code. */
export const PALETTE = {
  navy: PALETTE_KEYS.K,
  navyMid: PALETTE_KEYS.k,
  yellow: PALETTE_KEYS.Y,
  yellowShade: PALETTE_KEYS.y,
  teal: PALETTE_KEYS.T,
  tealShade: PALETTE_KEYS.t,
  coral: PALETTE_KEYS.C,
  cream: PALETTE_KEYS.w,
  white: PALETTE_KEYS.W,
  wall: PALETTE_KEYS.B,
  wallStripe: PALETTE_KEYS.b,
  floor: PALETTE_KEYS.F,
  floorDark: PALETTE_KEYS.f,
  wood: PALETTE_KEYS.D,
  woodDark: PALETTE_KEYS.d,
  sky: PALETTE_KEYS.A,
  skyShade: PALETTE_KEYS.a,
  screen: PALETTE_KEYS.M,
  screenDark: PALETTE_KEYS.m,
  grey: PALETTE_KEYS.G,
  greyDark: PALETTE_KEYS.g,
  lightGrey: PALETTE_KEYS.L,
  purple: PALETTE_KEYS.P,
  green: PALETTE_KEYS.E,
} as const;

export const hex = (c: string): number => parseInt(c.slice(1), 16);

export const PALETTE_RGB: readonly [number, number, number][] = Object.values(PALETTE_KEYS).map((c) => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
]);
