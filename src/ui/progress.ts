// What the player has earned, kept on this device (localStorage) so closing the page loses nothing.
// Storage can be missing or refused (private windows): the game then just starts from zero each visit.

const KEY = 'shop.progress.v1';

export interface Progress {
  coins: number;
}

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Progress>;
    return { coins: Number.isInteger(p.coins) && p.coins! >= 0 ? p.coins! : 0 };
  } catch {
    return { coins: 0 };
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Not saved: the coins still count for this visit.
  }
}
