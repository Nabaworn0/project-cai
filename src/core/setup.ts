// Windows 11 Setup (the new 24H2 installer) from its first page to "Installing Windows 11" (case 3,
// textbook p.52–56). Pure data in, data out like pc.ts and rufus.ts: the Setup screen renders `setupView`
// and sends actions; the case flow listens to the returned effects.
// The heart is "Select location to install Windows 11": on a UEFI PC an MBR disk shows the red text, and
// the fix is to Delete every partition of the PC's disk so Setup makes it GPT itself (textbook p.55).
// Wording: docs/real-screens.md section 3 (⚠️ there = not checked word for word against a real screen).

import type { Machine } from './machine';

export const PAGES = [
  'language',
  'keyboard',
  'option',
  'product-key',
  'image',
  'license',
  'location',
  'ready',
  'installing',
  'done',
  'media-error',
] as const;
export type Page = (typeof PAGES)[number];

/** Editions on the "Select image" page (shown only without a product key: a key decides the edition itself). */
/** In the order the real list shows them (24H2 consumer image). */
export const EDITIONS = [
  'Windows 11 Home',
  'Windows 11 Home N',
  'Windows 11 Home Single Language',
  'Windows 11 Education',
  'Windows 11 Education N',
  'Windows 11 Pro',
  'Windows 11 Pro N',
  'Windows 11 Pro Education',
  'Windows 11 Pro for Workstations',
] as const;
export type Edition = (typeof EDITIONS)[number];

/** A line of the partition table: a partition, or the free space left on a disk. */
export interface Part {
  id: string;
  disk: 0 | 1;
  name: string;
  sizeMB: number;
  freeMB: number;
  type: 'Primary' | 'System' | 'MSR (Reserved)' | 'Recovery' | 'Unallocated';
  /** Holds the customer's files (the old Windows): wiping it needs the backup check first. */
  data: boolean;
}

export type Confirm = { action: 'delete' | 'format'; id: string };

export interface Setup {
  page: Page;
  /** Select setup option: Install Windows 11 is chosen; the "everything will be deleted" box must be ticked. */
  agreed: boolean;
  /** The customer brought a key (machine.productKey): tapping the field fills it in from the sticker. */
  hasKey: boolean;
  keyEntered: boolean;
  /** "I don't have a product key" was pressed. */
  noKey: boolean;
  edition: Edition | null;
  /** The edition on the work ticket (what the PC had before), to note a mismatch. */
  ticketEdition: Edition;
  /** UEFI or legacy: decides which partition style Setup can install to. */
  bootMode: Machine['bootMode'];
  /** Partition style of the PC's disk (Disk 1); Setup makes an empty disk match the boot mode by itself. */
  diskStyle: Machine['diskStyle'];
  parts: Part[];
  selected: string | null;
  confirm: Confirm | null;
  /** The player asked the customer and heard the files are backed up. */
  backupConfirmed: boolean;
  /** The backup mistake is counted once per visit. */
  backupBlamed: boolean;
  progress: number;
}

export type SetupAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'agree'; on: boolean }
  | { type: 'enter-key' }
  | { type: 'no-key' }
  | { type: 'pick-edition'; edition: Edition }
  | { type: 'accept' }
  | { type: 'decline' }
  | { type: 'select'; id: string }
  | { type: 'delete' }
  | { type: 'format' }
  | { type: 'refresh' }
  | { type: 'ok' }
  | { type: 'cancel' }
  | { type: 'install' }
  /** From the case flow: the customer said the files are backed up. */
  | { type: 'backup-confirmed' }
  | { type: 'tick'; ms: number };

export type SetupMistake =
  /** Deleted or formatted the customer's disk before asking about a backup. */
  | 'no-backup-check'
  /** Deleted or formatted the install USB itself: Setup lost its own files. */
  | 'deleted-installer';

export type SetupEffect =
  | { type: 'mistake'; reason: SetupMistake }
  /** The install USB was wiped: it has to be made again in Rufus before the PC can boot it. */
  | { type: 'usb-wiped' }
  /** Install pressed and finished. `diskStyle`: what Setup left the PC's disk as. */
  | { type: 'installed'; edition: Edition; activateLater: boolean; wrongEdition: boolean; diskStyle: Machine['diskStyle'] };

/** How long "Installing Windows 11" takes in the game (a real install takes 10–30 minutes). */
export const INSTALL_MS = 5000;

const MB_PER_GB = 1024;
/** A disk sold as N GB holds N·10⁹ bytes, which Setup shows in binary units (500 GB → 465.7 GB). */
const diskMB = (gb: number) => Math.round((gb * 1e9) / 2 ** 20);
/** The 16 GB stick as Setup lists it. */
const USB_MB = Math.round(14.9 * MB_PER_GB);

/** The partition table Setup finds on this machine: the install USB is Disk 0, the PC's own disk Disk 1. */
export function partsOf(m: Machine, usbLabel = 'ESD-USB'): Part[] {
  const usb: Part = {
    id: '0-1',
    disk: 0,
    name: `Disk 0 Partition 1: ${usbLabel}`,
    sizeMB: USB_MB,
    freeMB: Math.round(9.3 * MB_PER_GB),
    type: 'Primary',
    data: false,
  };
  const total = diskMB(m.storageGB);
  if (!m.diskHasData) return [usb, unallocated(total)];
  if (m.diskStyle === 'mbr') {
    // Windows on an MBR disk: the small "System Reserved" partition, then C:.
    const main = total - 50;
    return [
      usb,
      { id: '1-1', disk: 1, name: 'Disk 1 Partition 1: System Reserved', sizeMB: 50, freeMB: 18, type: 'System', data: false },
      { id: '1-2', disk: 1, name: 'Disk 1 Partition 2', sizeMB: main, freeMB: Math.round(main * 0.42), type: 'Primary', data: true },
    ];
  }
  // Windows on a GPT disk: EFI system, MSR, C:, Recovery.
  const main = total - 100 - 16 - 650;
  return [
    usb,
    { id: '1-1', disk: 1, name: 'Disk 1 Partition 1', sizeMB: 100, freeMB: 70, type: 'System', data: false },
    { id: '1-2', disk: 1, name: 'Disk 1 Partition 2', sizeMB: 16, freeMB: 16, type: 'MSR (Reserved)', data: false },
    { id: '1-3', disk: 1, name: 'Disk 1 Partition 3', sizeMB: main, freeMB: Math.round(main * 0.42), type: 'Primary', data: true },
    { id: '1-4', disk: 1, name: 'Disk 1 Partition 4', sizeMB: 650, freeMB: 90, type: 'Recovery', data: false },
  ];
}

function unallocated(sizeMB: number): Part {
  return { id: '1-free', disk: 1, name: 'Disk 1 Unallocated Space', sizeMB, freeMB: sizeMB, type: 'Unallocated', data: false };
}

/** `backup`: what an earlier run of Setup on this PC already settled (asked about the backup, blamed for not asking). */
export function openSetup(m: Machine, opts: { ticketEdition: Edition; usbLabel?: string; backup?: { confirmed: boolean; blamed: boolean } }): Setup {
  return {
    page: 'language',
    agreed: false,
    hasKey: m.productKey,
    keyEntered: false,
    noKey: false,
    edition: null,
    ticketEdition: opts.ticketEdition,
    bootMode: m.bootMode,
    diskStyle: m.diskStyle,
    parts: partsOf(m, opts.usbLabel),
    selected: null,
    confirm: null,
    backupConfirmed: opts.backup?.confirmed ?? false,
    backupBlamed: opts.backup?.blamed ?? false,
    progress: 0,
  };
}

// ---- rules ----

const disk1 = (s: Setup) => s.parts.filter((p) => p.disk === 1);
const partOf = (s: Setup, id: string | null) => s.parts.find((p) => p.id === id) ?? null;
const wantStyle = (s: Setup) => (s.bootMode === 'uefi' ? 'gpt' : 'mbr');

/**
 * The red text under the table for the selected line, or null. A disk whose style does not match the boot mode
 * is refused while any partition is left on it; once it is all Unallocated Space, Setup converts it on Next.
 */
export function locationError(s: Setup): string | null {
  const p = partOf(s, s.selected);
  if (!p) return null;
  if (p.disk === 0) return "Windows can't be installed to this drive.";
  const partitioned = disk1(s).some((x) => x.type !== 'Unallocated');
  if (s.diskStyle !== wantStyle(s) && partitioned) {
    return s.diskStyle === 'mbr'
      ? "Windows can't be installed to this disk. The selected disk has an MBR partition table. On EFI systems, Windows can only be installed to GPT disks."
      : "Windows can't be installed to this disk. The selected disk is of the GPT partition style.";
  }
  return null;
}

/** Next on the location page: free space, or a Primary partition, on a disk Setup accepts. */
function canInstallTo(s: Setup): boolean {
  const p = partOf(s, s.selected);
  return !!p && p.disk === 1 && (p.type === 'Unallocated' || p.type === 'Primary') && !locationError(s);
}

function canNext(s: Setup): boolean {
  switch (s.page) {
    case 'language':
    case 'keyboard':
      return true;
    case 'option':
      return s.agreed;
    case 'product-key':
      return s.keyEntered;
    case 'image':
      return !!s.edition;
    case 'location':
      return canInstallTo(s) && !s.confirm;
    default:
      return false;
  }
}

/** The page after this one. With a key the edition comes from the key, so "Select image" is skipped. */
function nextPage(s: Setup): Page {
  switch (s.page) {
    case 'language':
      return 'keyboard';
    case 'keyboard':
      return 'option';
    case 'option':
      return 'product-key';
    case 'product-key':
      return s.noKey ? 'image' : 'license';
    case 'image':
      return 'license';
    case 'license':
      return 'location';
    default:
      return 'ready';
  }
}

const BACK: Partial<Record<Page, (s: Setup) => Page>> = {
  keyboard: () => 'language',
  option: () => 'keyboard',
  'product-key': () => 'option',
  image: () => 'product-key',
  license: (s) => (s.noKey ? 'image' : 'product-key'),
  location: () => 'license',
  ready: () => 'location',
};

const same = (s: Setup) => ({ setup: s, effects: [] as SetupEffect[] });

/** Delete or Format confirmed: the line is wiped. The USB loses Setup's own files; the PC's disk loses the customer's. */
function wipe(s: Setup, c: Confirm): { setup: Setup; effects: SetupEffect[] } {
  const p = partOf(s, c.id)!;
  const effects: SetupEffect[] = [];
  if (p.disk === 0) {
    return {
      setup: { ...s, confirm: null, selected: null, page: 'media-error' },
      effects: [{ type: 'mistake', reason: 'deleted-installer' }, { type: 'usb-wiped' }],
    };
  }
  let next = s;
  if (disk1(s).some((x) => x.data) && !s.backupConfirmed && !s.backupBlamed) {
    effects.push({ type: 'mistake', reason: 'no-backup-check' });
    next = { ...next, backupBlamed: true };
  }
  if (c.action === 'format') {
    // Format empties the partition but keeps the partition table, so the red text stays.
    const parts = s.parts.map((x) => (x.id === p.id ? { ...x, data: false, freeMB: x.sizeMB } : x));
    return { setup: { ...next, parts, confirm: null }, effects };
  }
  // Delete: the partition becomes free space, merged into the disk's one Unallocated line (listed last, as Setup does).
  const kept = s.parts.filter((x) => x.id !== p.id && x.type !== 'Unallocated');
  const freeMB = disk1(s)
    .filter((x) => x.id === p.id || x.type === 'Unallocated')
    .reduce((n, x) => n + x.sizeMB, 0);
  return { setup: { ...next, parts: [...kept, unallocated(freeMB)], confirm: null, selected: '1-free' }, effects };
}

export function act(s: Setup, a: SetupAction): { setup: Setup; effects: SetupEffect[] } {
  if (a.type === 'backup-confirmed') return same({ ...s, backupConfirmed: true });

  if (s.page === 'installing') {
    if (a.type !== 'tick') return same(s);
    const progress = Math.min(1, s.progress + a.ms / INSTALL_MS);
    if (progress < 1) return same({ ...s, progress });
    const edition = s.edition ?? s.ticketEdition;
    const effect: SetupEffect = {
      type: 'installed',
      edition,
      activateLater: s.noKey,
      wrongEdition: edition !== s.ticketEdition,
      // An all-free disk is made to match the boot mode (textbook p.55).
      diskStyle: disk1(s).every((x) => x.type === 'Unallocated') ? wantStyle(s) : s.diskStyle,
    };
    return { setup: { ...s, page: 'done', progress: 1, diskStyle: effect.diskStyle }, effects: [effect] };
  }

  // A confirm box on the location page takes every tap until it is answered.
  if (s.confirm) {
    if (a.type === 'ok') return wipe(s, s.confirm);
    if (a.type === 'cancel') return same({ ...s, confirm: null });
    return same(s);
  }

  switch (a.type) {
    case 'next':
      if (!canNext(s)) return same(s);
      return same({ ...s, page: nextPage(s) });
    case 'back': {
      const to = BACK[s.page];
      return same(to ? { ...s, page: to(s) } : s);
    }
    case 'agree':
      return same(s.page === 'option' ? { ...s, agreed: a.on } : s);
    case 'enter-key':
      return same(s.page === 'product-key' && s.hasKey ? { ...s, keyEntered: true, noKey: false } : s);
    case 'no-key':
      // The link moves on by itself, to "Select image".
      return same(s.page === 'product-key' ? { ...s, noKey: true, keyEntered: false, page: 'image' } : s);
    case 'pick-edition':
      return same(s.page === 'image' ? { ...s, edition: a.edition } : s);
    case 'accept':
      return same(s.page === 'license' ? { ...s, page: 'location' } : s);
    case 'decline':
      // Declining the license ends this run of Setup: back to the first page (no harm done).
      return same(s.page === 'license' ? { ...s, page: 'language' } : s);
    case 'select':
      return same(s.page === 'location' && partOf(s, a.id) ? { ...s, selected: a.id } : s);
    case 'delete':
    case 'format': {
      const p = partOf(s, s.selected);
      if (s.page !== 'location' || !p || p.type === 'Unallocated') return same(s);
      return same({ ...s, confirm: { action: a.type, id: p.id } });
    }
    case 'refresh':
      return same(s);
    case 'install':
      return same(s.page === 'ready' ? { ...s, page: 'installing', progress: 0 } : s);
    default:
      return same(s);
  }
}

// ---- what the screen shows ----

const TITLES: Record<Page, string> = {
  language: 'Select language settings',
  keyboard: 'Select keyboard settings',
  option: 'Select setup option',
  'product-key': 'Product key',
  image: 'Select Image',
  license: 'Applicable notices and license terms',
  location: 'Select location to install Windows 11',
  ready: 'Ready to install',
  installing: 'Installing Windows 11',
  done: 'Installing Windows 11',
  'media-error': 'Windows 11 Setup',
};

/** Sizes as Setup prints them: MB under 1 GB, otherwise GB with one decimal. */
export function formatSize(mb: number): string {
  return mb < MB_PER_GB ? `${mb.toFixed(1)} MB` : `${(mb / MB_PER_GB).toFixed(1)} GB`;
}

export interface SetupRowView {
  id: string;
  name: string;
  total: string;
  free: string;
  type: string;
  selected: boolean;
}

export interface SetupView {
  page: Page;
  title: string;
  canNext: boolean;
  canBack: boolean;
  rows: SetupRowView[];
  /** Delete and Format work on a partition, not on free space. */
  canWipe: boolean;
  error: string | null;
  confirm: null | { action: 'delete' | 'format'; text: string };
  /** The key from the sticker, once entered (shown in the field). */
  key: string;
  progress: number;
}

/** A made-up key in the real 5×5 format (invented, not any real or published key). */
export const STICKER_KEY = '7RN2K-QX8VT-HM3PD-4CWGY-B9FJ6';

export function setupView(s: Setup): SetupView {
  const sel = partOf(s, s.selected);
  return {
    page: s.page,
    title: TITLES[s.page],
    canNext: canNext(s),
    canBack: !!BACK[s.page] && !s.confirm,
    rows: s.parts.map((p) => ({
      id: p.id,
      name: p.name,
      total: formatSize(p.sizeMB),
      free: formatSize(p.freeMB),
      type: p.type === 'Unallocated' ? 'Unallocated Space' : p.type,
      selected: p.id === s.selected,
    })),
    canWipe: s.page === 'location' && !!sel && sel.type !== 'Unallocated' && !s.confirm,
    error: s.page === 'location' ? locationError(s) : null,
    confirm: s.confirm
      ? {
          action: s.confirm.action,
          text:
            s.confirm.action === 'delete'
              ? 'If you delete this partition, any data stored on it will be lost.'
              : 'If you format this partition, any data stored on it will be lost.',
        }
      : null,
    key: s.keyEntered ? STICKER_KEY : '',
    progress: s.page === 'installing' || s.page === 'done' ? s.progress : 0,
  };
}

/** The message after the install USB was wiped (⚠️ wording, docs/real-screens.md). */
export const MEDIA_ERROR =
  'Windows installation encountered an unexpected error. Verify that the installation sources are accessible, and restart the installation.';
