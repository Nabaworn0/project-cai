// What the learner has done and earned, kept on this device (localStorage) so closing the page loses nothing.
// Storage can be missing or refused (private windows): the game then just starts from zero each visit.
// The shape and its checks live in src/core/path.ts; version 1 (coins only) is carried over on first load.

import { EMPTY, OLD_STORAGE_KEY, parseProgress, STORAGE_KEY, type Progress } from '../core/path';

export type { Progress };

export function loadProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(STORAGE_KEY), localStorage.getItem(OLD_STORAGE_KEY));
  } catch {
    return EMPTY;
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Not saved: it still counts for this visit.
  }
}
