// What the learner has done and earned, kept on this device (localStorage) so closing the page loses nothing.
// Storage can be missing or refused (private windows): the game then just starts from zero each visit.
// The shape and its checks live in src/core/path.ts; version 1 (coins only) is carried over on first load.
// Free play (src/core/free.ts) keeps a save of its own in the same shape, and which mode is on.

import { EMPTY, OLD_STORAGE_KEY, parseProgress, STORAGE_KEY, type Progress } from '../core/path';
import { FREE_STORAGE_KEY, MODE_KEY, type Mode } from '../core/free';

export type { Progress };

export function loadProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(STORAGE_KEY), localStorage.getItem(OLD_STORAGE_KEY));
  } catch {
    return EMPTY;
  }
}

export function saveProgress(p: Progress, key = STORAGE_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(p));
  } catch {
    // Not saved: it still counts for this visit.
  }
}

/** Free play's save, or null before the first visit to it. */
export function loadFree(): Progress | null {
  try {
    const raw = localStorage.getItem(FREE_STORAGE_KEY);
    return raw === null ? null : parseProgress(raw, null);
  } catch {
    return null;
  }
}

export const saveFree = (p: Progress) => saveProgress(p, FREE_STORAGE_KEY);

export function loadMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'free' ? 'free' : 'class';
  } catch {
    return 'class';
  }
}

export function saveMode(m: Mode): void {
  try {
    if (m === 'free') localStorage.setItem(MODE_KEY, 'free');
    else localStorage.removeItem(MODE_KEY);
  } catch {
    // Not kept: the next visit opens in the class mode.
  }
}
