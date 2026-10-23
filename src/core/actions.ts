// Every repair the player can perform, as a pure machine -> machine step.
// Content refers to these by id; the BIOS screens map their settings onto them.

import type { Machine } from './machine';
import type { BiosSetting, Brand } from '../content/schema';

export interface ActionContext {
  brand: Brand;
}

export interface Action {
  id: string;
  lo: string[];
  /** Wipes the customer's files. Forbidden when the customer asked to keep data. */
  destructive: boolean;
  /** A setup step that only unlocks other actions (e.g. a BIOS password). */
  prep: boolean;
  /** Done in the BIOS: every brand used by a case must show this setting somewhere. */
  biosSetting?: BiosSetting;
  /** Returns why the action cannot run right now, or null when it can. */
  blockedBy(m: Machine, ctx: ActionContext): string | null;
  apply(m: Machine): Machine;
}

const ok = null;

export const ACTIONS: readonly Action[] = [
  {
    id: 'set-usb-first',
    lo: ['LO3'],
    destructive: false,
    prep: false,
    biosSetting: 'bootOrder',
    blockedBy: (m) => (m.usbFirst ? 'USB is already first' : ok),
    apply: (m) => ({ ...m, usbFirst: true }),
  },
  {
    id: 'set-boot-uefi',
    lo: ['LO3'],
    destructive: false,
    prep: false,
    biosSetting: 'bootMode',
    blockedBy: (m) => (m.bootMode === 'uefi' ? 'already UEFI' : ok),
    apply: (m) => ({ ...m, bootMode: 'uefi' }),
  },
  {
    id: 'set-supervisor-password',
    lo: ['LO3'],
    destructive: false,
    prep: true,
    biosSetting: 'supervisorPassword',
    blockedBy: (m) => (m.supervisorPassword ? 'password already set' : ok),
    apply: (m) => ({ ...m, supervisorPassword: true }),
  },
  {
    id: 'enable-secure-boot',
    lo: ['LO3', 'LO2'],
    destructive: false,
    prep: false,
    biosSetting: 'secureBoot',
    blockedBy: (m, { brand }) => {
      if (m.bootMode !== 'uefi') return 'Secure Boot needs UEFI mode';
      if (m.secureBoot) return 'already on';
      if (brand.quirks.secureBootNeedsSupervisorPassword && !m.supervisorPassword) return 'option locked until a supervisor password is set';
      return ok;
    },
    apply: (m) => ({ ...m, secureBoot: true }),
  },
  {
    id: 'enable-tpm',
    lo: ['LO2', 'LO3'],
    destructive: false,
    prep: false,
    biosSetting: 'tpm',
    blockedBy: (m) => (m.tpm !== '2.0' ? 'no TPM 2.0 chip' : m.tpmEnabled ? 'already on' : ok),
    apply: (m) => ({ ...m, tpmEnabled: true }),
  },
  {
    id: 'set-ahci',
    lo: ['LO3', 'LO6'],
    destructive: false,
    prep: false,
    biosSetting: 'sataMode',
    // Switching an installed Windows from RAID to AHCI stops it booting, so only on an empty disk.
    blockedBy: (m) => (m.sataMode === 'ahci' ? 'already AHCI' : m.diskHasData ? 'existing Windows would stop booting' : ok),
    apply: (m) => ({ ...m, sataMode: 'ahci' }),
  },
  {
    id: 'load-raid-driver',
    lo: ['LO5', 'LO6'],
    destructive: false,
    prep: false,
    blockedBy: (m) => (m.sataMode !== 'raid' ? 'no RAID controller in use' : m.raidDriverLoaded ? 'already loaded' : ok),
    apply: (m) => ({ ...m, raidDriverLoaded: true }),
  },
  {
    id: 'setup-delete-all',
    lo: ['LO4'],
    destructive: true,
    prep: false,
    // Setup converts an empty disk to the style that matches the boot mode by itself.
    blockedBy: (m) => (m.diskStyle === 'gpt' && !m.diskHasData ? 'disk already empty GPT' : ok),
    apply: (m) => ({ ...m, diskStyle: m.bootMode === 'uefi' ? 'gpt' : 'mbr', diskHasData: false }),
  },
  {
    id: 'diskpart-clean-convert-gpt',
    lo: ['LO4', 'LO6'],
    destructive: true,
    prep: false,
    blockedBy: (m) => (m.diskStyle === 'gpt' ? 'already GPT' : ok),
    apply: (m) => ({ ...m, diskStyle: 'gpt', diskHasData: false }),
  },
  {
    id: 'mbr2gpt',
    lo: ['LO4', 'LO6'],
    destructive: false,
    prep: false,
    // mbr2gpt converts a disk that already has Windows on it; an empty disk has nothing to validate.
    blockedBy: (m) => (m.diskStyle === 'gpt' ? 'already GPT' : !m.diskHasData ? 'no Windows install to convert' : ok),
    apply: (m) => ({ ...m, diskStyle: 'gpt' }),
  },
  {
    id: 'upgrade-ram',
    lo: ['LO2'],
    destructive: false,
    prep: false,
    blockedBy: (m) => (m.ramGB >= 8 ? 'enough RAM' : ok),
    apply: (m) => ({ ...m, ramGB: 8 }),
  },
  {
    id: 'replace-ssd',
    lo: ['LO2'],
    destructive: true,
    prep: false,
    blockedBy: (m) => (m.storageGB >= 256 ? 'enough storage' : ok),
    apply: (m) => ({ ...m, storageGB: 256, diskStyle: 'gpt', diskHasData: false }),
  },
  {
    id: 'install-drivers',
    lo: ['LO5'],
    destructive: false,
    prep: false,
    blockedBy: (m) => (m.missingDrivers.length === 0 ? 'no missing drivers' : ok),
    apply: (m) => ({ ...m, missingDrivers: [] }),
  },
];

export const ACTION_IDS = ACTIONS.map((a) => a.id);

export function getAction(id: string): Action {
  const a = ACTIONS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown action: ${id}`);
  return a;
}
