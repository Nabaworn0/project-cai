// The "does this PC meet Windows 11's requirements?" table on the work ticket (case 4 task C,
// docs/case4-plan.md section 3). For each requirement the player says: passes, fails, or "can't tell from
// the ticket, look in the BIOS". The ticket shows the CPU, RAM and disk, so those pass or fail by the
// machine; whether Secure Boot and TPM are switched on only the BIOS can show. Practice: correct rows earn
// a few coins, wrong ones cost nothing. The wording of each row lives in win11-check.json.

import type { Machine } from './machine';
import { REQUIREMENTS } from './requirements';

export const WIN11_CHECK_IDS = ['cpu', 'ram', 'storage', 'secure-boot', 'tpm'] as const;
export type CheckId = (typeof WIN11_CHECK_IDS)[number];

export type CheckAnswer = 'pass' | 'fail' | 'bios';

/** The right answer for a row on this machine. */
export function checkAnswer(id: CheckId, m: Machine): CheckAnswer {
  switch (id) {
    case 'cpu':
      return m.cpuWin11 ? 'pass' : 'fail';
    case 'ram':
      return m.ramGB >= REQUIREMENTS.ramGB ? 'pass' : 'fail';
    case 'storage':
      return m.storageGB >= REQUIREMENTS.storageGB ? 'pass' : 'fail';
    default:
      // On or off is a BIOS setting: the ticket cannot say.
      return 'bios';
  }
}

/** What the ticket says about this requirement on this machine. */
export function checkValueTh(id: CheckId, m: Machine): string {
  switch (id) {
    case 'cpu':
      return m.cpu;
    case 'ram':
      return `RAM ${m.ramGB} GB`;
    case 'storage':
      return `SSD ${m.storageGB} GB`;
    default:
      return 'ใบงานไม่ได้บอก';
  }
}

/** Labels of the three answer buttons. */
export const ANSWER_TH: Record<CheckAnswer, string> = { pass: 'ผ่าน', fail: 'ไม่ผ่าน', bios: 'ต้องดูใน BIOS' };
