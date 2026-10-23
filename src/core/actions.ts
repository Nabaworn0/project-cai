// Every repair the player can perform, as a pure machine -> machine step.
// Content refers to these by id; the BIOS screens map their settings onto them.
// Page numbers refer to the textbook ระบบปฏิบัติการเบื้องต้น 20204-2001 (docs/book-alignment.md).

import type { Machine } from './machine';
import type { BiosSetting, Brand } from '../content/schema';

export interface ActionContext {
  brand: Brand;
}

/** Where a topic comes from: the textbook, what Windows 11 adds to it, or beyond the book (advanced). */
export type Source = 'book' | 'win11' | 'extra';

export interface Action {
  id: string;
  /** What the player does, in Thai (hints, solution lists, the content viewer). */
  labelTh: string;
  lo: string[];
  source: Source;
  /** Textbook page(s), when the book covers it. */
  bookPage?: string;
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
    id: 'remake-usb',
    labelTh: 'ทำ USB ใหม่ใน Rufus ให้ Partition scheme ตรงกับเครื่อง (UEFI → GPT, Legacy → MBR)',
    lo: ['LO2'],
    source: 'book',
    bookPage: '45–48',
    destructive: false,
    prep: false,
    blockedBy: (m) => ((m.bootMode === 'uefi') === (m.usbScheme === 'gpt') ? 'USB already matches' : ok),
    apply: (m) => ({ ...m, usbScheme: m.bootMode === 'uefi' ? 'gpt' : 'mbr' }),
  },
  {
    id: 'set-usb-first',
    labelTh: 'ตั้ง Boot Device Priority ให้ USB ขึ้นก่อน แล้วกด F10 บันทึก (หรือใช้ Boot Menu)',
    lo: ['LO3'],
    source: 'book',
    bookPage: '48–51',
    destructive: false,
    prep: false,
    biosSetting: 'bootOrder',
    blockedBy: (m) => (m.usbFirst ? 'USB is already first' : ok),
    apply: (m) => ({ ...m, usbFirst: true }),
  },
  {
    id: 'set-boot-uefi',
    labelTh: 'เปลี่ยนโหมดบูตเป็น UEFI (ปิด CSM/Legacy)',
    lo: ['LO3', 'LO1'],
    source: 'win11',
    destructive: false,
    prep: false,
    biosSetting: 'bootMode',
    blockedBy: (m) => (m.bootMode === 'uefi' ? 'already UEFI' : ok),
    apply: (m) => ({ ...m, bootMode: 'uefi' }),
  },
  {
    id: 'set-supervisor-password',
    labelTh: 'ตั้งรหัสผ่านผู้ดูแล BIOS (Supervisor Password)',
    lo: ['LO3'],
    source: 'extra',
    destructive: false,
    prep: true,
    biosSetting: 'supervisorPassword',
    blockedBy: (m) => (m.supervisorPassword ? 'password already set' : ok),
    apply: (m) => ({ ...m, supervisorPassword: true }),
  },
  {
    id: 'enable-secure-boot',
    labelTh: 'เปิด Secure Boot',
    lo: ['LO3', 'LO1'],
    source: 'win11',
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
    labelTh: 'เปิด TPM (PTT / fTPM)',
    lo: ['LO3', 'LO1'],
    source: 'win11',
    destructive: false,
    prep: false,
    biosSetting: 'tpm',
    blockedBy: (m) => (m.tpm !== '2.0' ? 'no TPM 2.0 chip' : m.tpmEnabled ? 'already on' : ok),
    apply: (m) => ({ ...m, tpmEnabled: true }),
  },
  {
    id: 'set-ahci',
    labelTh: 'เปลี่ยน SATA Mode เป็น AHCI',
    lo: ['LO3'],
    source: 'extra',
    destructive: false,
    prep: false,
    biosSetting: 'sataMode',
    // Switching an installed Windows from RAID to AHCI stops it booting, so only on an empty disk.
    blockedBy: (m) => (m.sataMode === 'ahci' ? 'already AHCI' : m.diskHasData ? 'existing Windows would stop booting' : ok),
    apply: (m) => ({ ...m, sataMode: 'ahci' }),
  },
  {
    id: 'load-raid-driver',
    labelTh: 'โหลดไดรเวอร์ RAID/RST ในตัวติดตั้ง (Load driver)',
    lo: ['LO6', 'LO4'],
    source: 'extra',
    destructive: false,
    prep: false,
    blockedBy: (m) => (m.sataMode !== 'raid' ? 'no RAID controller in use' : m.raidDriverLoaded ? 'already loaded' : ok),
    apply: (m) => ({ ...m, raidDriverLoaded: true }),
  },
  {
    id: 'skip-product-key',
    labelTh: 'กด "I don\'t have a product key" แล้ว Activate ภายหลัง',
    lo: ['LO4'],
    source: 'book',
    bookPage: '54',
    destructive: false,
    prep: false,
    blockedBy: (m) => (m.productKey || m.activateLater ? 'nothing to skip' : ok),
    apply: (m) => ({ ...m, activateLater: true }),
  },
  {
    id: 'setup-delete-all',
    labelTh: 'ลบพาร์ทิชันเดิมในตัวติดตั้งแล้วสร้างใหม่ (Setup จัดดิสก์ให้ตรงกับโหมดบูต)',
    lo: ['LO4'],
    source: 'book',
    bookPage: '55',
    destructive: true,
    prep: false,
    // Setup converts an empty disk to the style that matches the boot mode by itself.
    blockedBy: (m) => {
      const want = m.bootMode === 'uefi' ? 'gpt' : 'mbr';
      return m.diskStyle === want && !m.diskHasData ? 'disk already empty and correct' : ok;
    },
    apply: (m) => ({ ...m, diskStyle: m.bootMode === 'uefi' ? 'gpt' : 'mbr', diskHasData: false }),
  },
  {
    id: 'diskpart-clean-convert-gpt',
    labelTh: 'diskpart: clean แล้ว convert gpt',
    lo: ['LO4'],
    source: 'extra',
    destructive: true,
    prep: false,
    blockedBy: (m) => (m.diskStyle === 'gpt' ? 'already GPT' : ok),
    apply: (m) => ({ ...m, diskStyle: 'gpt', diskHasData: false }),
  },
  {
    id: 'mbr2gpt',
    labelTh: 'mbr2gpt แปลงเป็น GPT โดยไม่ลบข้อมูล',
    lo: ['LO4'],
    source: 'extra',
    destructive: false,
    prep: false,
    // mbr2gpt converts a disk that already has Windows on it; an empty disk has nothing to validate.
    blockedBy: (m) => (m.diskStyle === 'gpt' ? 'already GPT' : !m.diskHasData ? 'no Windows install to convert' : ok),
    apply: (m) => ({ ...m, diskStyle: 'gpt' }),
  },
  {
    id: 'upgrade-ram',
    labelTh: 'เพิ่มแรม (อะไหล่จากร้าน)',
    lo: ['LO1'],
    source: 'win11',
    destructive: false,
    prep: false,
    blockedBy: (m) => (m.ramGB >= 8 ? 'enough RAM' : ok),
    apply: (m) => ({ ...m, ramGB: 8 }),
  },
  {
    id: 'replace-ssd',
    labelTh: 'เปลี่ยน SSD ลูกใหม่',
    lo: ['LO1'],
    source: 'win11',
    destructive: true,
    prep: false,
    blockedBy: (m) => (m.storageGB >= 256 ? 'enough storage' : ok),
    apply: (m) => ({ ...m, storageGB: 256, diskStyle: m.bootMode === 'uefi' ? 'gpt' : 'mbr', diskHasData: false }),
  },
  {
    id: 'install-drivers',
    labelTh: 'ติดตั้งไดรเวอร์ที่ขาด (dxdiag ดูรุ่น → ดาวน์โหลดจากผู้ผลิต / Device Manager → Update driver)',
    lo: ['LO6'],
    source: 'book',
    bookPage: '72–93',
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
