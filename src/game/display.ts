// Pixel-art display: the game draws into a small canvas (short side ~180-240 art pixels) and the
// browser scales it up by a whole number of device pixels, so every art pixel stays a crisp square.

/** Aim for about this many art pixels across the screen's short side. */
export const TARGET_SHORT = 210;

export interface PixelView {
  /** Device pixels per art pixel (always a whole number). */
  scale: number;
  /** Canvas size in art pixels. */
  width: number;
  height: number;
  /** Phaser zoom: CSS pixels per art pixel. */
  zoom: number;
}

export function pixelView(cssW: number, cssH: number, dpr: number): PixelView {
  const dw = Math.round(cssW * dpr);
  const dh = Math.round(cssH * dpr);
  const scale = Math.max(1, Math.round(Math.min(dw, dh) / TARGET_SHORT));
  return { scale, width: Math.floor(dw / scale), height: Math.floor(dh / scale), zoom: scale / dpr };
}

export const currentDpr = (): number => window.devicePixelRatio || 1;
