// The customer's PC from power-on to Windows installed: POST, the BIOS setup screen, the one-time
// Boot Menu, "Press any key to boot", what the machine boots into, which depends on what is on the
// install USB (case 2: the stick can be remade on the shop laptop, src/core/rufus.ts), and Windows 11
// Setup itself (case 3, src/core/setup.ts), whose partition page can wipe the PC's disk or the stick, and
// after the install the new Windows' first-time setup up to the desktop (case 5, src/core/oobe.ts).
// Pure data in, data out (no DOM): the simulated screens only render `biosView` / `bootMenuEntries`
// and send keys; the case flow listens to the returned effects. Real wording: docs/real-screens.md.

import type { Machine, UsbOs } from './machine';
import type { BiosMenu, BiosSetting, Brand, MenuRow } from '../content/schema';
import { cantRunReasons } from './requirements';
import { act as setupAct, openSetup, type Setup, type SetupAction, type SetupMistake } from './setup';
import { act as oobeAct, openOobe, type Oobe, type OobeAction, type OobeMistake, type OobeResult } from './oobe';

/** Keys the simulated screens understand (the on-screen key bar sends the same names). */
export const KEYS = ['Esc', 'F2', 'F8', 'F10', 'Delete', 'Enter', 'Up', 'Down', 'Left', 'Right', 'Plus', 'Minus'] as const;
export type Key = (typeof KEYS)[number];

/** Drives in the machine: the internal disk with the old Windows, and the customer's install USB. */
export const DRIVES = ['ssd', 'usb'] as const;
export type DriveId = (typeof DRIVES)[number];
export type BootSlot = 'hdd' | 'disabled';

/** BIOS settings as the setup screen holds them. Edits change a draft copy; only Save (F10) writes them to the machine. */
export interface Firmware {
  bootMode: Machine['bootMode'];
  secureBoot: boolean;
  tpmEnabled: boolean;
  sataMode: Machine['sataMode'];
  /** Hard Disk Drives order: which drive the HDD group boots first (the USB stick counts as a hard disk). */
  hddOrder: DriveId[];
  /** Boot Device Priority: each slot holds the HDD group or nothing. */
  bootSlots: BootSlot[];
}

export type Popup =
  /** Choosing a value for the row under the cursor. */
  | { kind: 'choose'; cursor: number }
  /** "Save configuration changes and exit setup?" / "Discard changes and exit setup?"; cursor 0 = Ok, 1 = Cancel. */
  | { kind: 'confirm'; action: 'save' | 'discard'; cursor: 0 | 1 };

export type Screen =
  | { kind: 'post' }
  | { kind: 'bios'; tab: number; stack: { menu: string; cursor: number }[]; popup: Popup | null }
  | { kind: 'boot-menu'; cursor: number }
  | { kind: 'press-any-key'; via: Route }
  | { kind: 'old-windows' }
  | { kind: 'no-boot' }
  /** Windows 11 Setup, page by page (src/core/setup.ts). */
  | { kind: 'setup'; setup: Setup }
  /** Wrong image on the stick: the Windows 10 installer, or Ubuntu's GNU GRUB menu (case 2 traps). */
  | { kind: 'setup-win10' }
  | { kind: 'grub' }
  /** Windows 11 Setup refused the PC: "This PC can't run Windows 11" with its reasons (case 4; case 2's CSM trap). */
  | { kind: 'cant-run'; reasons: string[] }
  /** The new Windows 11 starting for the first time: first-time setup, then the desktop (src/core/oobe.ts). */
  | { kind: 'oobe'; oobe: Oobe };

/** How the USB was reached: the saved boot order, or the one-time Boot Menu. Both are correct (case 1 design). */
export type Route = 'bios' | 'boot-menu';

export type MistakeReason =
  | 'booted-old-windows'
  | 'no-boot-device'
  /** The stick holds Windows 10 or Ubuntu instead of Windows 11. */
  | 'wrong-image'
  /** The stick booted only because CSM (legacy BIOS) was turned on; Windows 11 needs UEFI. */
  | 'legacy-boot'
  /** "This PC can't run Windows 11" again with the very same reasons: nothing was fixed (e.g. left the BIOS with Esc). */
  | 'still-cant-run'
  /** On Setup's partition page (case 3). */
  | SetupMistake
  /** On the account page of first-time setup (case 5). */
  | OobeMistake;

export type Effect =
  /** The player made the machine boot the wrong thing. Waiting too long at "Press any key" is not a mistake. */
  | { type: 'mistake'; reason: MistakeReason }
  /** `bypassedChecks`: the stick was made with Rufus' "remove requirement" box ticked (not a mistake, but noted). */
  | { type: 'reached-setup'; route: Route; bypassedChecks: boolean }
  /** Setup refused the PC for the first time, or with fewer reasons than before (progress, not a mistake). */
  | { type: 'cant-run'; reasons: string[] }
  /** Case 5: CSM is off, so the legacy Windows and the MBR stick no longer start (seen once, not a mistake). */
  | { type: 'legacy-no-boot' }
  /** Setup finished installing Windows. `wrongEdition`: no key, and another edition than the PC had (noted, not a mistake). */
  | { type: 'installed'; wrongEdition: boolean; activateLater: boolean }
  /** First-time setup: the PC went to the customer and back, or the customer was asked about privacy. */
  | { type: 'oobe-note'; note: 'handed-over' | 'handed-back' | 'privacy-asked' }
  /** First-time setup finished: the Windows 11 desktop. */
  | { type: 'desktop'; result: OobeResult };

export interface Pc {
  /** The machine as the rest of the game sees it (saved settings already applied). */
  machine: Machine;
  /** Settings stored in the BIOS. Kept apart from `machine`, which cannot hold everything (e.g. a disabled boot slot). */
  saved: Firmware;
  /** The settings being edited on the setup screen. */
  draft: Firmware;
  screen: Screen;
  /** Asked the customer about a backup / already blamed for wiping without asking: kept when Setup starts again. */
  backup: { confirmed: boolean; blamed: boolean };
  /** The last "can't run" screen: its reasons and the boot mode it came up in, to tell a repeat from progress. */
  lastCantRun: { reasons: string[]; bootMode: Machine['bootMode'] } | null;
  /** The boot mode the PC came into the shop with: its old Windows was installed that way (case 5 arrives in legacy). */
  arrivedIn: Machine['bootMode'];
  /** Already met "no boot device" once because the legacy Windows cannot start with CSM off (case 5: free the first time). */
  legacyNoBootSeen: boolean;
  /** The Windows 11 just installed on the disk and how far its first-time setup has got (null before the install). */
  fresh: Oobe | null;
}

export interface Result {
  pc: Pc;
  effects: Effect[];
}

export function firmwareOf(m: Machine): Firmware {
  return {
    bootMode: m.bootMode,
    secureBoot: m.secureBoot,
    tpmEnabled: m.tpmEnabled,
    sataMode: m.sataMode,
    hddOrder: m.usbFirst ? ['usb', 'ssd'] : ['ssd', 'usb'],
    bootSlots: ['hdd', 'disabled'],
  };
}

/** Writes saved settings back to the machine. "USB first" means the first boot slot reaches the USB. */
export function applyFirmware(m: Machine, fw: Firmware): Machine {
  return {
    ...m,
    bootMode: fw.bootMode,
    secureBoot: fw.secureBoot,
    tpmEnabled: fw.tpmEnabled,
    sataMode: fw.sataMode,
    usbFirst: bootOrder(fw)[0] === 'usb',
  };
}

/** Drives in the order a normal boot tries them. */
export function bootOrder(fw: Firmware): DriveId[] {
  return fw.bootSlots.includes('hdd') ? [...fw.hddOrder] : [];
}

/** Same rule as the usb-scheme-mismatch blocker: Rufus GPT boots UEFI only, MBR boots legacy only (textbook p.47). A wiped stick never boots. */
export function usbBoots(m: Machine): boolean {
  return m.usbOs !== 'empty' && (m.bootMode === 'uefi') === (m.usbScheme === 'gpt');
}

export function powerOn(m: Machine): Pc {
  const fw = firmwareOf(m);
  return {
    machine: m,
    saved: fw,
    draft: fw,
    screen: { kind: 'post' },
    backup: { confirmed: false, blamed: false },
    lastCantRun: null,
    arrivedIn: m.bootMode,
    legacyNoBootSeen: false,
    fresh: null,
  };
}

const done = (pc: Pc, effects: Effect[] = []): Result => ({ pc, effects });

/**
 * Whether the old Windows on the disk still starts. CSM on boots both kinds; CSM off (UEFI only) cannot start
 * a Windows that was installed in legacy mode (case 5: the lab PC came in legacy with an MBR disk).
 */
function oldWindowsBoots(pc: Pc): boolean {
  return pc.machine.diskHasData && (pc.arrivedIn === 'uefi' || pc.machine.bootMode === 'legacy');
}

/** CSM was turned off on a PC whose old Windows was installed in legacy mode: that Windows can no longer start. */
const legacyWindowsStranded = (pc: Pc) => pc.machine.diskHasData && !oldWindowsBoots(pc);

/** The stick as Rufus left it, plugged back into this PC, which then starts again from POST. */
export function insertUsb(pc: Pc, usb: { scheme: Machine['usbScheme']; os: UsbOs; bypassChecks: boolean }): Pc {
  return restart({ ...pc, machine: { ...pc.machine, usbScheme: usb.scheme, usbOs: usb.os, usbBypassChecks: usb.bypassChecks } });
}

/** Restart from any screen: unsaved BIOS changes are lost, saved ones stay, like on a real PC. */
export function restart(pc: Pc): Pc {
  return { ...pc, draft: pc.saved, screen: { kind: 'post' } };
}

/** A normal boot down the saved order. `skipUsb` = the player let "Press any key" time out. */
function boot(pc: Pc, skipUsb = false): Result {
  const order = bootOrder(pc.saved).filter((d) => !(skipUsb && d === 'usb'));
  const first = order.find((d) => d === 'ssd' || usbBoots(pc.machine));
  // Timing out at "Press any key" is not the player's mistake: the machine just carries on (decision 3, case1-plan).
  // Nor is a wiped stick being passed over: wiping it was the mistake, counted when it happened.
  const excused = skipUsb || pc.machine.usbOs === 'empty';
  const blame = (reason: 'booted-old-windows' | 'no-boot-device'): Effect[] => (excused ? [] : [{ type: 'mistake', reason }]);
  if (first === 'usb') return bootUsb(pc, 'bios');
  if (first === 'ssd' && pc.fresh) return bootFresh(pc);
  // A disk whose old Windows was deleted in Setup has nothing left to start.
  if (first === 'ssd' && oldWindowsBoots(pc)) return done({ ...pc, screen: { kind: 'old-windows' } }, blame('booted-old-windows'));
  // Case 5: CSM off leaves the legacy Windows (and the customer's MBR stick) unable to start. Seeing that once is
  // part of the repair (the stick must be remade as GPT); meeting it again is a mistake.
  if (first === 'ssd' && legacyWindowsStranded(pc) && !pc.legacyNoBootSeen) return done({ ...pc, legacyNoBootSeen: true, screen: { kind: 'no-boot' } }, [{ type: 'legacy-no-boot' }]);
  return done({ ...pc, screen: { kind: 'no-boot' } }, blame('no-boot-device'));
}

/** The new Windows starts from the disk: its first-time setup carries on where it was left (or the desktop). */
function bootFresh(pc: Pc): Result {
  return done({ ...pc, screen: { kind: 'oobe', oobe: pc.fresh! } });
}

/** Starting from the USB: Windows installers ask "Press any key"; Ubuntu goes straight to its GRUB menu. */
function bootUsb(pc: Pc, via: Route): Result {
  if (pc.machine.usbOs === 'ubuntu') return done({ ...pc, screen: { kind: 'grub' } }, [{ type: 'mistake', reason: 'wrong-image' }]);
  return done({ ...pc, screen: { kind: 'press-any-key', via } });
}

/**
 * A key at "Press any key": the installer on the stick starts. Windows 11 Setup first checks the PC (in the game
 * right away; where the real one does it is not confirmed, case4-plan decision 1). The first refusal is what the
 * customer saw, and fewer reasons is progress; the same reasons again is a mistake, and so is booting in legacy
 * mode on a PC that came in with UEFI (the player turned CSM on). A PC that came in legacy (case 5) is refused
 * the first time as the customer saw it.
 */
function startInstaller(pc: Pc, via: Route): Result {
  const m = pc.machine;
  if (m.usbOs !== 'win11') return done({ ...pc, screen: { kind: 'setup-win10' } }, [{ type: 'mistake', reason: 'wrong-image' }]);
  const reasons = cantRunReasons(m);
  if (reasons.length) {
    // Turning CSM off is progress even when Secure Boot still gives the same line (case 5).
    const last = pc.lastCantRun;
    const same = last !== null && last.bootMode === m.bootMode && reasons.length === last.reasons.length && reasons.every((r) => last.reasons.includes(r));
    const effect: Effect =
      m.bootMode !== 'uefi' && pc.arrivedIn === 'uefi'
        ? { type: 'mistake', reason: 'legacy-boot' }
        : same
          ? { type: 'mistake', reason: 'still-cant-run' }
          : { type: 'cant-run', reasons };
    return done({ ...pc, lastCantRun: { reasons, bootMode: m.bootMode }, screen: { kind: 'cant-run', reasons } }, [effect]);
  }
  const setup = openSetup(m, { ticketEdition: m.windowsEdition, backup: pc.backup });
  return done({ ...pc, screen: { kind: 'setup', setup } }, [{ type: 'reached-setup', route: via, bypassedChecks: m.usbBypassChecks }]);
}

/**
 * A tap on the Setup screen. What Setup does to the disks lands on the machine: wiping the stick leaves it
 * empty (it must be made again in Rufus), wiping the old Windows leaves the PC with nothing to boot, and a
 * finished install leaves a fresh Windows on a disk of the right style.
 */
export function setupAction(pc: Pc, a: SetupAction): Result {
  const s = pc.screen;
  if (s.kind !== 'setup') return done(pc);
  const r = setupAct(s.setup, a);
  let m = pc.machine;
  let fresh = pc.fresh;
  const effects: Effect[] = [];
  for (const e of r.effects) {
    if (e.type === 'mistake') effects.push({ type: 'mistake', reason: e.reason });
    else if (e.type === 'usb-wiped') m = { ...m, usbOs: 'empty' };
    else {
      m = { ...m, diskStyle: e.diskStyle, activateLater: e.activateLater, windowsEdition: e.edition };
      fresh = openOobe(e.edition);
      effects.push({ type: 'installed', wrongEdition: e.wrongEdition, activateLater: e.activateLater });
    }
  }
  // The old Windows is gone once its partition is deleted or formatted (a new install is not "old" either).
  if (!r.setup.parts.some((p) => p.data)) m = { ...m, diskHasData: false };
  const backup = { confirmed: r.setup.backupConfirmed, blamed: r.setup.backupBlamed };
  return done({ ...pc, machine: m, backup, fresh, screen: { kind: 'setup', setup: r.setup } }, effects);
}

/** A tap (or the clock) on first-time setup. Its progress stays with the disk, so a restart picks it up again. */
export function oobeAction(pc: Pc, a: OobeAction): Result {
  const s = pc.screen;
  if (s.kind !== 'oobe') return done(pc);
  const r = oobeAct(s.oobe, a);
  const effects: Effect[] = r.effects.map((e) =>
    e.type === 'mistake' ? { type: 'mistake', reason: e.reason } : e.type === 'desktop' ? e : { type: 'oobe-note', note: e.type },
  );
  return done({ ...pc, fresh: r.oobe, screen: { kind: 'oobe', oobe: r.oobe } }, effects);
}

/** The customer said the files are backed up (the case flow's "ask" button): remembered even if Setup restarts. */
export function confirmBackup(pc: Pc): Pc {
  const backup = { ...pc.backup, confirmed: true };
  if (pc.screen.kind !== 'setup') return { ...pc, backup };
  return { ...setupAction(pc, { type: 'backup-confirmed' }).pc, backup };
}

/** The screen's own timer ran out (POST continues, "Press any key" moves on). Other screens ignore it. */
export function timeout(pc: Pc): Result {
  if (pc.screen.kind === 'post') return boot(pc);
  if (pc.screen.kind === 'press-any-key') return boot(pc, true);
  // "Installing Windows 11" finished: the PC restarts by itself (a stick still first boots "Press any key" again).
  if (pc.screen.kind === 'setup' && pc.screen.setup.page === 'done') return done(restart(pc));
  return done(pc);
}

export function press(brand: Brand, pc: Pc, key: Key): Result {
  const s = pc.screen;
  switch (s.kind) {
    case 'post':
      if (brand.keys.setup.includes(key)) return done({ ...pc, screen: openBios(menuOf(brand)) });
      if (brand.keys.bootMenu.includes(key)) return done({ ...pc, screen: { kind: 'boot-menu', cursor: 0 } });
      if (key === 'Enter') return boot(pc);
      return done(pc);
    case 'bios':
      return pressBios(menuOf(brand), pc, s, key);
    case 'boot-menu':
      return pressBootMenu(brand, pc, s.cursor, key);
    case 'press-any-key':
      return startInstaller(pc, s.via);
    case 'no-boot':
      // "Reboot and Select proper Boot device ... and press a key"
      return done(restart(pc));
    default:
      return done(pc);
  }
}

function menuOf(brand: Brand): BiosMenu {
  if (!brand.menu) throw new Error(`brand ${brand.id} has no playable BIOS menu`);
  return brand.menu;
}

const selectable = (r: MenuRow) => r.type !== 'info';

function firstSelectable(rows: readonly MenuRow[]): number {
  const i = rows.findIndex(selectable);
  return i < 0 ? 0 : i;
}

function openBios(menu: BiosMenu, tab = 0): Screen {
  const id = menu.tabs[tab]!.menu;
  return { kind: 'bios', tab, stack: [{ menu: id, cursor: firstSelectable(menu.menus[id]!.rows) }], popup: null };
}

type BiosScreen = Extract<Screen, { kind: 'bios' }>;

function pressBios(menu: BiosMenu, pc: Pc, s: BiosScreen, key: Key): Result {
  const top = s.stack[s.stack.length - 1]!;
  const rows = menu.menus[top.menu]!.rows;
  const row = rows[top.cursor];
  const withScreen = (screen: Partial<BiosScreen>) => done({ ...pc, screen: { ...s, ...screen } });
  const withTop = (cursor: number) => withScreen({ stack: [...s.stack.slice(0, -1), { ...top, cursor }] });

  if (s.popup?.kind === 'confirm') {
    const p = s.popup;
    if (key === 'Left' || key === 'Right') return withScreen({ popup: { ...p, cursor: p.cursor === 0 ? 1 : 0 } });
    if (key === 'Esc' || (key === 'Enter' && p.cursor === 1)) return withScreen({ popup: null });
    if (key === 'Enter') {
      if (p.action === 'discard') return done(restart(pc));
      return done(restart({ ...pc, machine: applyFirmware(pc.machine, pc.draft), saved: pc.draft }));
    }
    return done(pc);
  }

  if (s.popup?.kind === 'choose' && row && editable(row)) {
    const options = choicesOf(pc, row);
    const p = s.popup;
    if (key === 'Up') return withScreen({ popup: { ...p, cursor: Math.max(0, p.cursor - 1) } });
    if (key === 'Down') return withScreen({ popup: { ...p, cursor: Math.min(options.length - 1, p.cursor + 1) } });
    if (key === 'Esc') return withScreen({ popup: null });
    if (key === 'Enter') return done({ ...pc, draft: choose(pc.draft, row, p.cursor), screen: { ...s, popup: null } });
    return done(pc);
  }

  switch (key) {
    case 'Up':
    case 'Down': {
      const dir = key === 'Up' ? -1 : 1;
      for (let i = top.cursor + dir; i >= 0 && i < rows.length; i += dir) if (selectable(rows[i]!)) return withTop(i);
      return done(pc);
    }
    case 'Left':
    case 'Right': {
      // Tabs switch only from a tab's own page, as on AMIBIOS 8; inside a submenu Esc goes back first.
      if (s.stack.length > 1) return done(pc);
      const tab = (s.tab + (key === 'Left' ? -1 : 1) + menu.tabs.length) % menu.tabs.length;
      return done({ ...pc, screen: openBios(menu, tab) });
    }
    case 'Enter': {
      if (!row) return done(pc);
      if (row.type === 'submenu') return withScreen({ stack: [...s.stack, { menu: row.menu, cursor: firstSelectable(menu.menus[row.menu]!.rows) }] });
      if (row.type === 'exit') return withScreen({ popup: { kind: 'confirm', action: row.action, cursor: 0 } });
      if (!editable(row)) return done(pc);
      return withScreen({ popup: { kind: 'choose', cursor: currentChoice(pc, row) } });
    }
    case 'Plus':
    case 'Minus': {
      if (!row || !editable(row)) return done(pc);
      const n = choicesOf(pc, row).length;
      const next = (currentChoice(pc, row) + (key === 'Plus' ? 1 : n - 1)) % n;
      return done({ ...pc, draft: choose(pc.draft, row, next) });
    }
    case 'Esc':
      if (s.stack.length > 1) return withScreen({ stack: s.stack.slice(0, -1) });
      return withScreen({ popup: { kind: 'confirm', action: 'discard', cursor: 0 } });
    case 'F10':
      return withScreen({ popup: { kind: 'confirm', action: 'save', cursor: 0 } });
    default:
      return done(pc);
  }
}

// ---- values shown and chosen in the BIOS ----

const driveLabel = (m: Machine, d: DriveId) => (d === 'usb' ? 'USB: Flash Disk 16GB' : `SATA: SSD ${m.storageGB}GB`);

type EditableRow = Extract<MenuRow, { type: 'option' | 'bootDevice' | 'drive' }>;
const editable = (r: MenuRow): r is EditableRow => r.type === 'option' || r.type === 'bootDevice' || r.type === 'drive';

/** Firmware field behind an option row's setting name. */
const FIELD: Partial<Record<BiosSetting, 'bootMode' | 'secureBoot' | 'tpmEnabled' | 'sataMode'>> = {
  bootMode: 'bootMode',
  secureBoot: 'secureBoot',
  tpm: 'tpmEnabled',
  sataMode: 'sataMode',
};

/** Which option settings this module can edit, and the values each accepts (the validator checks brand menus against it). */
export const OPTION_VALUES: Partial<Record<BiosSetting, readonly (string | boolean)[]>> = {
  bootMode: ['uefi', 'legacy'],
  secureBoot: [true, false],
  tpm: [true, false],
  sataMode: ['ahci', 'raid'],
};

function fieldOf(row: Extract<MenuRow, { type: 'option' }>) {
  const f = FIELD[row.setting];
  if (!f) throw new Error(`BIOS option "${row.label}": setting ${row.setting} cannot be edited here`);
  return f;
}

function choicesOf(pc: Pc, row: EditableRow): string[] {
  if (row.type === 'option') return row.choices.map((c) => c.label);
  if (row.type === 'drive') return pc.draft.hddOrder.map((d) => driveLabel(pc.machine, d));
  return [driveLabel(pc.machine, pc.draft.hddOrder[0]!), 'Disabled'];
}

function currentChoice(pc: Pc, row: EditableRow): number {
  const fw = pc.draft;
  if (row.type === 'option') return Math.max(0, row.choices.findIndex((c) => c.value === fw[fieldOf(row)]));
  if (row.type === 'drive') return row.slot; // the list is hddOrder itself
  return fw.bootSlots[row.slot] === 'hdd' ? 0 : 1;
}

/** Sets a row to choice `i`. Slots swap like AMIBIOS: picking a device already in another slot moves it there. */
function choose(fw: Firmware, row: EditableRow, i: number): Firmware {
  if (row.type === 'option') return { ...fw, [fieldOf(row)]: row.choices[i]!.value };
  if (row.type === 'drive') return { ...fw, hddOrder: swapInto(fw.hddOrder, row.slot, fw.hddOrder[i]!) };
  const value: BootSlot = i === 0 ? 'hdd' : 'disabled';
  if (value === 'disabled') return { ...fw, bootSlots: fw.bootSlots.map((v, k) => (k === row.slot ? 'disabled' : v)) };
  return { ...fw, bootSlots: swapInto(fw.bootSlots, row.slot, 'hdd') };
}

function swapInto<T>(list: readonly T[], slot: number, value: T): T[] {
  const out = [...list];
  const from = out.indexOf(value);
  if (from >= 0) out[from] = out[slot]!;
  out[slot] = value;
  return out;
}

// ---- what the screens render ----

export interface BiosRowView {
  label: string;
  /** Shown in brackets on the right, e.g. "[Enabled]"; empty for submenus and exit rows. */
  value: string;
  kind: MenuRow['type'];
  selected: boolean;
}

export interface BiosView {
  title: string;
  tabs: string[];
  tab: number;
  heading: string;
  rows: BiosRowView[];
  help: string;
  legend: string[];
  popup: null | { kind: 'choose'; title: string; options: string[]; cursor: number } | { kind: 'confirm'; text: string; cursor: 0 | 1 };
}

export function biosView(brand: Brand, pc: Pc): BiosView | null {
  const s = pc.screen;
  if (s.kind !== 'bios') return null;
  const menu = menuOf(brand);
  const top = s.stack[s.stack.length - 1]!;
  const page = menu.menus[top.menu]!;
  const row = page.rows[top.cursor];
  const fill = (text: string) =>
    text.replace('{cpu}', pc.machine.cpu).replace('{ramMB}', String(pc.machine.ramGB * 1024)).replace('{storageGB}', String(pc.machine.storageGB));
  const valueOf = (r: MenuRow): string => {
    if (r.type === 'info') return fill(r.value);
    if (!editable(r)) return '';
    return choicesOf(pc, r)[currentChoice(pc, r)] ?? '';
  };
  let popup: BiosView['popup'] = null;
  if (s.popup?.kind === 'confirm')
    popup = { kind: 'confirm', text: s.popup.action === 'save' ? menu.saveDialog : menu.discardDialog, cursor: s.popup.cursor };
  else if (s.popup?.kind === 'choose' && row && editable(row)) {
    popup = { kind: 'choose', title: row.label, options: choicesOf(pc, row), cursor: s.popup.cursor };
  }
  return {
    title: menu.title,
    tabs: menu.tabs.map((t) => t.label),
    tab: s.tab,
    heading: page.title,
    // A read-only page (Main) has no highlight at all, rather than a highlighted line that cannot be changed.
    rows: page.rows.map((r, i) => ({ label: r.label, value: valueOf(r), kind: r.type, selected: i === top.cursor && selectable(r) })),
    help: row?.help ?? '',
    legend: menu.legend,
    popup,
  };
}

export interface BootMenuEntry {
  label: string;
  target: DriveId | 'setup';
}

/** "Please select boot device:" A USB that cannot boot in this mode is not listed (the case 2 symptom). */
export function bootMenuEntries(pc: Pc): BootMenuEntry[] {
  const m = pc.machine;
  const uefi = m.bootMode === 'uefi';
  // Lists every drive, even when Boot Device Priority has its slot disabled: that is what a one-time menu is for.
  const entries: BootMenuEntry[] = pc.saved.hddOrder
    // A legacy-installed Windows has no UEFI boot entry once CSM is off, so the menu does not list the disk.
    .filter((d) => (d === 'ssd' ? !legacyWindowsStranded(pc) : usbBoots(m)))
    .map((d) => ({
      target: d,
      // The BIOS lists the stick as "USB: Flash Disk"; the boot menu names the device itself ("UEFI: USB Flash Disk").
      label:
        d === 'usb' ? `${uefi ? 'UEFI: ' : ''}USB Flash Disk 16GB` : uefi ? `Windows Boot Manager (${driveLabel(m, 'ssd')})` : driveLabel(m, 'ssd'),
    }));
  return [...entries, { label: 'Enter Setup', target: 'setup' }];
}

function pressBootMenu(brand: Brand, pc: Pc, cursor: number, key: Key): Result {
  const entries = bootMenuEntries(pc);
  if (key === 'Up') return done({ ...pc, screen: { kind: 'boot-menu', cursor: Math.max(0, cursor - 1) } });
  if (key === 'Down') return done({ ...pc, screen: { kind: 'boot-menu', cursor: Math.min(entries.length - 1, cursor + 1) } });
  // "ESC to boot using defaults"
  if (key === 'Esc') return boot(pc);
  if (key !== 'Enter') return done(pc);
  const target = entries[cursor]!.target;
  if (target === 'setup') return done({ ...pc, screen: openBios(menuOf(brand)) });
  if (target === 'usb') return bootUsb(pc, 'boot-menu');
  if (pc.fresh) return bootFresh(pc);
  return done({ ...pc, screen: { kind: 'old-windows' } }, [{ type: 'mistake', reason: 'booted-old-windows' }]);
}
