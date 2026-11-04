// Big screens (a lab monitor, a projector): the HTML over the game grows with the screen, so the boards, the HUD and
// the talk box fill it the way they fill a laptop, instead of staying laptop-sized in the middle. The canvas grows on
// its own (src/game/display.ts). theme.css applies it as CSS zoom on #ui's layers; inside them a vw or dvh is zoomed
// too, so the CSS divides those by --ui.

/** The screen the UI is drawn for at its own size; bigger screens scale it up. */
export const BASE = { w: 1100, h: 640 } as const;
/** At most this much bigger (a 4K screen at 100%). */
export const MAX_UI = 2;
/** The learning path's board grows up to this much more again, reached on a 1920×1080 screen. */
export const HOME_BOOST = 1.18;

/** How much bigger the UI is drawn on a screen of this size (CSS pixels): 1 up to BASE, never more than MAX_UI. */
export function uiScale(w: number, h: number): number {
  const s = Math.min(w / BASE.w, h / BASE.h);
  return Math.round(Math.min(MAX_UI, Math.max(1, s)) * 100) / 100;
}

/** The learning path's extra growth on top of uiScale: none at 1, rising evenly to HOME_BOOST at 1.69 (a
 *  1920×1080 screen, drawn 2× in all), never past MAX_UI in all. */
export function homeBoost(ui: number): number {
  const b = 1 + (HOME_BOOST - 1) * Math.min(1, (ui - 1) / 0.69);
  return Math.round(Math.min(b, MAX_UI / ui) * 100) / 100;
}

/** Keeps --ui and --ui-home on the page right as the window changes size. */
export function watchUiScale(): void {
  const root = document.documentElement.style;
  const set = () => {
    const ui = uiScale(window.innerWidth, window.innerHeight);
    root.setProperty('--ui', String(ui));
    root.setProperty('--ui-home', String(homeBoost(ui)));
  };
  set();
  window.addEventListener('resize', set);
}
