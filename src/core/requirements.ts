// What stops Windows 11 from installing (or from being "done") on a machine. The game installs Windows 11 only
// (decided 2026-10-24); Windows 10 appears just as the old system on customers' PCs.
// Blocker ids are referenced by problems.json; the Thai explanation lives there, not here.

import type { Machine } from './machine';

export const BLOCKER_IDS = [
  'usb-not-first',
  'usb-scheme-mismatch',
  'legacy-boot',
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

/** Blockers no in-shop repair can clear; a base machine must never have these. */
export const HARDWARE_LIMITS = ['tpm-missing', 'cpu-unsupported'] as const;

/** Windows 11 minimums used by the game (UEFI, Secure Boot and TPM 2.0 are checked by the blockers below). */
export const REQUIREMENTS = { ramGB: 4, storageGB: 64 } as const;

/** Short Thai description of each blocker, for the content viewer and hints. */
export const BLOCKER_TH: Record<BlockerId, string> = {
  'usb-not-first': 'เครื่องไม่บูตจาก USB',
  'usb-scheme-mismatch': 'USB ทำด้วย Partition scheme ไม่ตรงกับโหมดบูตของเครื่อง',
  'legacy-boot': 'เครื่องตั้งเป็นโหมด Legacy (Windows 11 ต้องการ UEFI)',
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
  const out: BlockerId[] = [];
  if (!m.usbFirst) out.push('usb-not-first');
  // Rufus: GPT targets UEFI, MBR targets legacy BIOS (textbook p.47). A mismatched stick does not boot.
  if ((m.bootMode === 'uefi') !== (m.usbScheme === 'gpt')) out.push('usb-scheme-mismatch');
  if (m.bootMode === 'legacy') out.push('legacy-boot');
  if (m.bootMode === 'uefi' && m.diskStyle === 'mbr') out.push('uefi-mbr');
  if (m.bootMode === 'uefi' && !m.secureBoot) out.push('secure-boot-off');
  if (m.tpm === '2.0' && !m.tpmEnabled) out.push('tpm-disabled');
  if (m.sataMode === 'raid' && !m.raidDriverLoaded) out.push('raid-no-driver');
  if (m.ramGB < REQUIREMENTS.ramGB) out.push('ram-low');
  if (m.storageGB < REQUIREMENTS.storageGB) out.push('storage-low');
  if (!m.productKey && !m.activateLater) out.push('no-product-key');
  if (m.missingDrivers.length > 0) out.push('drivers-missing');
  return out;
}

/**
 * The reasons Windows 11 Setup lists under "This PC can't run Windows 11", in its own words (docs/real-screens.md
 * section 3: TPM, memory and processor found in sources; the Secure Boot line follows the TPM one ⚠️).
 * A stick made with Rufus' "Remove requirement…" box skips the TPM, Secure Boot and memory checks; legacy (CSM)
 * boot is refused either way, since Windows 11 Setup needs UEFI (case2-plan decision on CSM).
 */
export const CANT_RUN_REASONS = {
  cpu: "The processor isn't supported for this version of Windows",
  tpm: 'The PC must support TPM 2.0',
  secureBoot: 'The PC must support Secure Boot',
  ram: 'There must be at least 4 GB of system memory',
} as const;

export function cantRunReasons(m: Machine): string[] {
  const skip = m.usbBypassChecks;
  const out: string[] = [];
  if (!m.cpuWin11) out.push(CANT_RUN_REASONS.cpu);
  if (!skip && (m.tpm !== '2.0' || !m.tpmEnabled)) out.push(CANT_RUN_REASONS.tpm);
  if (m.bootMode === 'legacy' || (!skip && !m.secureBoot)) out.push(CANT_RUN_REASONS.secureBoot);
  if (!skip && m.ramGB < REQUIREMENTS.ramGB) out.push(CANT_RUN_REASONS.ram);
  return out;
}

export function hardwareLimits(m: Machine): (typeof HARDWARE_LIMITS)[number][] {
  const out: (typeof HARDWARE_LIMITS)[number][] = [];
  if (m.tpm !== '2.0') out.push('tpm-missing');
  if (!m.cpuWin11) out.push('cpu-unsupported');
  return out;
}
