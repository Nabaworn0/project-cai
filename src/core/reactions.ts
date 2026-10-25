// What the customer says while the technician works (case1-plan task F). Each case can give its own
// lines in customer.reactionsTh; anything missing falls back to these generic ones, so a new case
// plays before its dialogue is written.

import type { Reactions } from '../content/schema';

export type ReactionEvent =
  | 'old-windows'
  | 'no-boot'
  | 'wrong-image'
  | 'cant-run'
  | 'still-cant-run'
  | 'fixed'
  | 'reached-setup'
  | 'backup'
  | 'no-backup'
  | 'lost-installer'
  | 'installed'
  | 'handed-over'
  | 'account-trap'
  | 'privacy-asked'
  | 'no-thai-keyboard';

export const GENERIC_REACTIONS: Required<Reactions> = {
  oldWindowsTh: ['ยังขึ้นหน้าจอเดิมอยู่เลยนะ', 'เหมือนเดิมเลย ยังไม่ได้อีกเหรอ'],
  noBootTh: 'จอดำขึ้นภาษาอังกฤษเต็มเลย เครื่องพังหรือเปล่า',
  wrongImageTh: 'ขึ้นหน้าติดตั้งแล้ว แต่ดูไม่ใช่ Windows 11 นะ',
  cantRunTh: 'ขึ้นว่าเครื่องนี้ลง Windows 11 ไม่ได้ จริงเหรอ',
  stillCantRunTh: 'ยังขึ้นหน้าเดิมอยู่เลยนะ',
  fixedTh: 'ขึ้นหน้าใหม่แล้ว! ได้แล้วใช่ไหม',
  reachedSetupTh: 'ขึ้นหน้าติดตั้งแล้ว ทำต่อได้เลย',
  backupTh: 'สำรองไว้แล้ว ลบได้เลย',
  noBackupTh: 'เดี๋ยวก่อน ยังไม่ได้ถามเลยว่าข้อมูลเก็บไว้หรือยัง',
  lostInstallerTh: 'อ้าว ขึ้นข้อความผิดพลาด แฟลชไดรฟ์เป็นอะไรไปหรือเปล่า',
    installedTh: 'ติดตั้งเสร็จแล้วเหรอ ยังต้องตั้งค่าอะไรต่ออีกไหม',
    handedOverTh: 'อ๋อ ให้พิมพ์เองใช่ไหม ได้เลย',
    accountTrapTh: 'เอ๊ะ บัญชีกับรหัสผ่านให้ช่างรู้ด้วยเหรอ ขอพิมพ์เองดีกว่านะ',
    privacyAskedTh: 'ปิดโฆษณากับตำแหน่งไว้ก็ได้ ที่เหลือแล้วแต่ช่างเลย',
    noThaiKeyboardTh: 'ได้แล้ว แต่พิมพ์ภาษาไทยได้หรือเปล่านะ',
  goodbyeTh: ['ได้แล้วก็ดี แต่ลุ้นอยู่นานเลยนะ', 'เรียบร้อยแล้ว ขอบคุณนะ', 'เก่งมาก ขอบคุณมากเลย ไว้มาใช้บริการอีกนะ'],
};

/** The line for something that just happened. `count` is how many times it has happened so far (1 = first). */
export function reactionLine(r: Reactions, event: ReactionEvent, count = 1): string {
  if (event === 'old-windows') {
    const lines = r.oldWindowsTh ?? GENERIC_REACTIONS.oldWindowsTh;
    return lines[(Math.max(1, count) - 1) % lines.length]!;
  }
  if (event === 'no-boot') return r.noBootTh ?? GENERIC_REACTIONS.noBootTh;
  if (event === 'wrong-image') return r.wrongImageTh ?? GENERIC_REACTIONS.wrongImageTh;
  if (event === 'cant-run') return r.cantRunTh ?? GENERIC_REACTIONS.cantRunTh;
  if (event === 'still-cant-run') return r.stillCantRunTh ?? GENERIC_REACTIONS.stillCantRunTh;
  if (event === 'reached-setup') return r.reachedSetupTh ?? GENERIC_REACTIONS.reachedSetupTh;
  if (event === 'backup') return r.backupTh ?? GENERIC_REACTIONS.backupTh;
  if (event === 'no-backup') return r.noBackupTh ?? GENERIC_REACTIONS.noBackupTh;
  if (event === 'lost-installer') return r.lostInstallerTh ?? GENERIC_REACTIONS.lostInstallerTh;
  if (event === 'installed') return r.installedTh ?? GENERIC_REACTIONS.installedTh;
  if (event === 'handed-over') return r.handedOverTh ?? GENERIC_REACTIONS.handedOverTh;
  if (event === 'account-trap') return r.accountTrapTh ?? GENERIC_REACTIONS.accountTrapTh;
  if (event === 'privacy-asked') return r.privacyAskedTh ?? GENERIC_REACTIONS.privacyAskedTh;
  if (event === 'no-thai-keyboard') return r.noThaiKeyboardTh ?? GENERIC_REACTIONS.noThaiKeyboardTh;
  return r.fixedTh ?? GENERIC_REACTIONS.fixedTh;
}

/** Goodbye on the summary screen for 1–3 stars. */
export function goodbyeLine(r: Reactions, stars: number): string {
  const lines = r.goodbyeTh ?? GENERIC_REACTIONS.goodbyeTh;
  return lines[Math.min(3, Math.max(1, stars)) - 1]!;
}
