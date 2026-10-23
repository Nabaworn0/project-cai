// What stops Windows from installing (or from being "done") on a machine, per target version.
// Windows 11 is the main path; Windows 10 follows the textbook (ระบบปฏิบัติการเบื้องต้น 20204-2001).
// Blocker ids are referenced by problems.json; the Thai explanation lives there, not here.

import type { Machine, TargetOs } from './machine';

export const BLOCKER_IDS = [
  'usb-not-first',
  'usb-scheme-mismatch',
  'legacy-boot',
  'legacy-gpt',
  'uefi-mbr',
  'secure-boot-off',
  'tpm-disabled',
  'raid-no-driver',
  'ram-low',
  'storage-low',
  'no-product-key',
  'drivers-missing',
] as const;
export type BlockerId = (typeof BLOCKER_IDS)[number];

/** Blockers no in-shop repair can clear; a base machine must never have these for its target. */
export const HARDWARE_LIMITS = ['tpm-missing', 'cpu-unsupported'] as const;

/** Minimums used by the game (64-bit editions). Kept beside the blockers so both versions read the same way. */
export const REQUIREMENTS: Record<TargetOs, { ramGB: number; storageGB: number; uefiOnly: boolean; secureBoot: boolean; tpm2: boolean; cpuList: boolean }> = {
  win10: { ramGB: 2, storageGB: 32, uefiOnly: false, secureBoot: false, tpm2: false, cpuList: false },
  win11: { ramGB: 4, storageGB: 64, uefiOnly: true, secureBoot: true, tpm2: true, cpuList: true },
};

/** Short Thai description of each blocker, for the content viewer and hints. */
export const BLOCKER_TH: Record<BlockerId, string> = {
  'usb-not-first': 'เครื่องไม่บูตจาก USB',
  'usb-scheme-mismatch': 'USB ทำด้วย Partition scheme ไม่ตรงกับโหมดบูตของเครื่อง',
  'legacy-boot': 'เครื่องตั้งเป็นโหมด Legacy (Windows 11 ต้องการ UEFI)',
  'legacy-gpt': 'บูตแบบ Legacy แต่ดิสก์เป็น GPT (ต้องใช้ MBR)',
  'uefi-mbr': 'บูตแบบ UEFI แต่ดิสก์เป็น MBR (ต้องใช้ GPT)',
  'secure-boot-off': 'Secure Boot ปิดอยู่',
  'tpm-disabled': 'TPM ปิดอยู่',
  'raid-no-driver': 'ตัวติดตั้งมองไม่เห็นดิสก์ (โหมด RAID ไม่มีไดรเวอร์)',
  'ram-low': 'RAM ไม่ถึงขั้นต่ำ',
  'storage-low': 'ดิสก์เล็กกว่าขั้นต่ำ',
  'no-product-key': 'ไม่มี Product Key และยังไม่ได้เลือก Activate ภายหลัง',
  'drivers-missing': 'ยังมีอุปกรณ์ที่ไม่มีไดรเวอร์',
};

export function findBlockers(m: Machine): BlockerId[] {
  const req = REQUIREMENTS[m.targetOs];
  const out: BlockerId[] = [];
  if (!m.usbFirst) out.push('usb-not-first');
  // Rufus: GPT targets UEFI, MBR targets legacy BIOS (textbook p.47). A mismatched stick does not boot.
  if ((m.bootMode === 'uefi') !== (m.usbScheme === 'gpt')) out.push('usb-scheme-mismatch');
  if (req.uefiOnly && m.bootMode === 'legacy') out.push('legacy-boot');
  if (!req.uefiOnly && m.bootMode === 'legacy' && m.diskStyle === 'gpt') out.push('legacy-gpt');
  if (m.bootMode === 'uefi' && m.diskStyle === 'mbr') out.push('uefi-mbr');
  if (req.secureBoot && m.bootMode === 'uefi' && !m.secureBoot) out.push('secure-boot-off');
  if (req.tpm2 && m.tpm === '2.0' && !m.tpmEnabled) out.push('tpm-disabled');
  if (m.sataMode === 'raid' && !m.raidDriverLoaded) out.push('raid-no-driver');
  if (m.ramGB < req.ramGB) out.push('ram-low');
  if (m.storageGB < req.storageGB) out.push('storage-low');
  if (!m.productKey && !m.activateLater) out.push('no-product-key');
  if (m.missingDrivers.length > 0) out.push('drivers-missing');
  return out;
}

export function hardwareLimits(m: Machine): (typeof HARDWARE_LIMITS)[number][] {
  const req = REQUIREMENTS[m.targetOs];
  const out: (typeof HARDWARE_LIMITS)[number][] = [];
  if (req.tpm2 && m.tpm !== '2.0') out.push('tpm-missing');
  if (req.cpuList && !m.cpuWin11) out.push('cpu-unsupported');
  return out;
}
