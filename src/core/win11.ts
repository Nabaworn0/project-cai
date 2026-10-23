// What stops Windows 11 from installing (or from being "done") on a machine.
// Blocker ids are referenced by problems.json; the Thai explanation lives there, not here.

import type { Machine } from './machine';

export const BLOCKER_IDS = [
  'usb-not-first',
  'legacy-boot',
  'uefi-mbr',
  'secure-boot-off',
  'tpm-disabled',
  'raid-no-driver',
  'ram-low',
  'storage-low',
  'drivers-missing',
] as const;
export type BlockerId = (typeof BLOCKER_IDS)[number];

/** Blockers that no in-shop repair can clear; a base machine must never have these. */
export const HARDWARE_LIMITS = ['tpm-missing', 'cpu-unsupported'] as const;

export const MIN_RAM_GB = 4;
export const MIN_STORAGE_GB = 64;

export function findBlockers(m: Machine): BlockerId[] {
  const out: BlockerId[] = [];
  if (!m.usbFirst) out.push('usb-not-first');
  if (m.bootMode === 'legacy') out.push('legacy-boot');
  if (m.bootMode === 'uefi' && m.diskStyle === 'mbr') out.push('uefi-mbr');
  if (m.bootMode === 'uefi' && !m.secureBoot) out.push('secure-boot-off');
  if (m.tpm === '2.0' && !m.tpmEnabled) out.push('tpm-disabled');
  if (m.sataMode === 'raid' && !m.raidDriverLoaded) out.push('raid-no-driver');
  if (m.ramGB < MIN_RAM_GB) out.push('ram-low');
  if (m.storageGB < MIN_STORAGE_GB) out.push('storage-low');
  if (m.missingDrivers.length > 0) out.push('drivers-missing');
  return out;
}

export function hardwareLimits(m: Machine): (typeof HARDWARE_LIMITS)[number][] {
  const out: (typeof HARDWARE_LIMITS)[number][] = [];
  if (m.tpm !== '2.0') out.push('tpm-missing');
  if (!m.cpuWin11) out.push('cpu-unsupported');
  return out;
}
