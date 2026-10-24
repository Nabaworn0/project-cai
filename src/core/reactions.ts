// What the customer says while the technician works (case1-plan task F). Each case can give its own
// lines in customer.reactionsTh; anything missing falls back to these generic ones, so a new case
// plays before its dialogue is written.

import type { Reactions } from '../content/schema';

export type ReactionEvent = 'old-windows' | 'no-boot' | 'fixed';

export const GENERIC_REACTIONS: Required<Reactions> = {
  oldWindowsTh: ['ยังขึ้นหน้าจอเดิมอยู่เลยนะ', 'เหมือนเดิมเลย ยังไม่ได้อีกเหรอ'],
  noBootTh: 'จอดำขึ้นภาษาอังกฤษเต็มเลย เครื่องพังหรือเปล่า',
  fixedTh: 'ขึ้นหน้าใหม่แล้ว! ได้แล้วใช่ไหม',
  goodbyeTh: ['ได้แล้วก็ดี แต่ลุ้นอยู่นานเลยนะ', 'เรียบร้อยแล้ว ขอบคุณนะ', 'เก่งมาก ขอบคุณมากเลย ไว้มาใช้บริการอีกนะ'],
};

/** The line for something that just happened. `count` is how many times it has happened so far (1 = first). */
export function reactionLine(r: Reactions, event: ReactionEvent, count = 1): string {
  if (event === 'old-windows') {
    const lines = r.oldWindowsTh ?? GENERIC_REACTIONS.oldWindowsTh;
    return lines[(Math.max(1, count) - 1) % lines.length]!;
  }
  if (event === 'no-boot') return r.noBootTh ?? GENERIC_REACTIONS.noBootTh;
  return r.fixedTh ?? GENERIC_REACTIONS.fixedTh;
}

/** Goodbye on the summary screen for 1–3 stars. */
export function goodbyeLine(r: Reactions, stars: number): string {
  const lines = r.goodbyeTh ?? GENERIC_REACTIONS.goodbyeTh;
  return lines[Math.min(3, Math.max(1, stars)) - 1]!;
}
