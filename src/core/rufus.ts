// Rufus on the shop's laptop: make the customer's install USB again (case 2, textbook p.45–48).
// Pure data in, data out like pc.ts: the Rufus screen renders `rufusView` and sends actions; finishing
// the write returns the new stick, which the case flow plugs back into the customer's PC.
// Wording follows Rufus 4.15 (docs/real-screens.md section 1); the game simplifies one thing on purpose:
// an MBR stick boots legacy BIOS only and a GPT stick UEFI only, as the textbook teaches (p.47).

import type { DiskStyle, UsbOs } from './machine';

/** What an ISO installs; only Windows 11 is the right one for these customers. */
export type IsoOs = Exclude<UsbOs, 'empty'>;

export interface IsoFile {
  name: string;
  os: IsoOs;
  /** Volume label Rufus gives the stick for this image. */
  label: string;
}

/** The Downloads folder on the shop laptop: the right image with two look-alikes (case 2 trap). */
export const ISO_FILES: readonly IsoFile[] = [
  { name: 'Win10_22H2_Thai_x64.iso', os: 'win10', label: 'CCCOMA_X64FRE_TH-TH_DV9' },
  { name: 'Win11_24H2_Thai_x64.iso', os: 'win11', label: 'CCCOMA_X64FRE_TH-TH_DV9' },
  { name: 'ubuntu-24.04-desktop-amd64.iso', os: 'ubuntu', label: 'Ubuntu 24.04 LTS amd64' },
];

/** The install USB as it is right now. */
export interface Usb {
  scheme: DiskStyle;
  os: UsbOs;
  label: string;
  /** Rufus was told to remove the Windows 11 checks (TPM, Secure Boot, RAM): an install Microsoft does not support. */
  bypassChecks: boolean;
}

/** "Customize Windows installation?" (Windows User Experience). The game starts with every box unticked. */
export const CUSTOMIZE_OPTIONS = [
  { id: 'bypassChecks', label: 'Remove requirement for 4GB+ RAM, Secure Boot and TPM 2.0' },
  { id: 'noMsAccount', label: 'Remove requirement for an online Microsoft account' },
  { id: 'localAccount', label: 'Create a local account with username:' },
  { id: 'regional', label: "Set regional options to the same values as this user's" },
  { id: 'noDataCollection', label: 'Disable data collection (Skip privacy questions)' },
  { id: 'noBitLocker', label: 'Disable BitLocker automatic device encryption' },
] as const;
export type CustomizeId = (typeof CUSTOMIZE_OPTIONS)[number]['id'];

export type Dialog =
  | { kind: 'pick-iso' }
  | { kind: 'customize'; ticked: CustomizeId[] }
  | { kind: 'warning' };

export interface Rufus {
  /** The stick in the laptop (what is on it now, before any new write). */
  usb: Usb;
  /** Boot selection; null until an image is picked ("Disk or ISO image (Please select)"). */
  iso: IsoFile | null;
  scheme: DiskStyle;
  /** The Customize choices the player confirmed for the write in progress. */
  ticked: CustomizeId[];
  dialog: Dialog | null;
  /** READY, copying (0–1), or finished. */
  phase: 'ready' | 'copying' | 'done';
  progress: number;
}

export type RufusAction =
  | { type: 'open-picker' }
  | { type: 'pick-iso'; name: string }
  | { type: 'close-dialog' }
  | { type: 'set-scheme'; scheme: DiskStyle }
  | { type: 'toggle'; id: CustomizeId }
  | { type: 'start' }
  | { type: 'ok' }
  | { type: 'tick'; ms: number };

export type RufusEffect = { type: 'usb-written'; usb: Usb };

/** How long copying the image takes in the game (a real stick takes minutes). */
export const COPY_MS = 4000;

/**
 * Rufus opens with the customer's stick inserted. It remembers the scheme last used on this stick
 * (the customer made it MBR from an old video), but the image has to be picked again.
 */
export function openRufus(usb: Usb): Rufus {
  return { usb, iso: null, scheme: usb.scheme, ticked: [], dialog: null, phase: 'ready', progress: 0 };
}

const same = (r: Rufus) => ({ rufus: r, effects: [] as RufusEffect[] });

/** Rufus is busy while copying: everything but the timer is ignored (its buttons are disabled). */
export function act(r: Rufus, a: RufusAction): { rufus: Rufus; effects: RufusEffect[] } {
  if (r.phase === 'copying') {
    if (a.type !== 'tick') return same(r);
    const progress = Math.min(1, r.progress + a.ms / COPY_MS);
    if (progress < 1) return same({ ...r, progress });
    const usb: Usb = { scheme: r.scheme, os: r.iso!.os, label: r.iso!.label, bypassChecks: r.ticked.includes('bypassChecks') };
    return { rufus: { ...r, usb, phase: 'done', progress: 1 }, effects: [{ type: 'usb-written', usb }] };
  }

  const d = r.dialog;
  switch (a.type) {
    case 'open-picker':
      return same(d ? r : { ...r, dialog: { kind: 'pick-iso' } });
    case 'pick-iso': {
      const iso = ISO_FILES.find((f) => f.name === a.name);
      if (d?.kind !== 'pick-iso' || !iso) return same(r);
      // A new image means a new job: READY again, ready for another write.
      return same({ ...r, iso, dialog: null, phase: 'ready', progress: 0 });
    }
    case 'close-dialog':
      return same({ ...r, dialog: null });
    case 'set-scheme':
      return same(d ? r : { ...r, scheme: a.scheme, phase: 'ready', progress: 0 });
    case 'toggle': {
      if (d?.kind !== 'customize') return same(r);
      const ticked = d.ticked.includes(a.id) ? d.ticked.filter((x) => x !== a.id) : [...d.ticked, a.id];
      return same({ ...r, dialog: { kind: 'customize', ticked } });
    }
    case 'start':
      // START stays greyed out until an image is picked.
      if (d || !r.iso) return same(r);
      // Windows images ask about customizing first, then every write warns that the stick will be wiped.
      return same({ ...r, dialog: r.iso.os === 'ubuntu' ? { kind: 'warning' } : { kind: 'customize', ticked: [] } });
    case 'ok':
      if (d?.kind === 'customize') return same({ ...r, ticked: d.ticked, dialog: { kind: 'warning' } });
      if (d?.kind === 'warning') return same({ ...r, dialog: null, phase: 'copying', progress: 0 });
      return same(r);
    case 'tick':
      return same(r);
  }
}

// ---- what the screen shows ----

/** "Target system" follows the partition scheme (Rufus 4.x). */
export const targetSystem = (scheme: DiskStyle) => (scheme === 'gpt' ? 'UEFI (non CSM)' : 'BIOS (or UEFI-CSM)');

export interface RufusView {
  device: string;
  bootSelection: string;
  scheme: DiskStyle;
  target: string;
  volumeLabel: string;
  fileSystem: string;
  cluster: string;
  status: string;
  /** 0–1 for the status bar. */
  progress: number;
  canStart: boolean;
  busy: boolean;
  dialog: Dialog | null;
  /** The text of the "will be destroyed" warning. */
  warning: string;
}

export function rufusView(r: Rufus): RufusView {
  const label = r.iso?.label ?? r.usb.label;
  // The same 16 GB stick the customer's BIOS lists as "USB: Flash Disk 16GB".
  const device = `${r.usb.label} (E:) [16 GB]`;
  return {
    device,
    bootSelection: r.iso?.name ?? 'Disk or ISO image (Please select)',
    scheme: r.scheme,
    target: targetSystem(r.scheme),
    volumeLabel: label,
    fileSystem: 'NTFS',
    cluster: '4096 bytes (Default)',
    status: r.phase === 'copying' ? `Copying ISO files: ${Math.floor(r.progress * 100)}%` : 'READY',
    progress: r.phase === 'ready' ? 0 : r.progress,
    canStart: !!r.iso && r.phase !== 'copying' && !r.dialog,
    busy: r.phase === 'copying',
    dialog: r.dialog,
    warning: `WARNING: ALL DATA ON DEVICE '${device}' WILL BE DESTROYED.\nTo continue with this operation, click OK. To quit click CANCEL.`,
  };
}
