// The customer's PC from power-on to the first Windows Setup screen: POST, the BIOS setup screen,
// the one-time Boot Menu, "Press any key to boot", and what the machine boots into.
// Pure data in, data out (no DOM): the simulated screens only render `biosView` / `bootMenuEntries`
// and send keys; the case flow listens to the returned effects. Real wording: docs/real-screens.md.

import type { Machine } from './machine';
import type { BiosMenu, BiosSetting, Brand, MenuRow } from '../content/schema';

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
  | { kind: 'setup' };

/** How the USB was reached: the saved boot order, or the one-time Boot Menu. Both are correct (case 1 design). */
export type Route = 'bios' | 'boot-menu';

export type Effect =
  /** The player made the machine boot the wrong thing. Waiting too long at "Press any key" is not a mistake. */
  | { type: 'mistake'; reason: 'booted-old-windows' | 'no-boot-device' }
  | { type: 'reached-setup'; route: Route };

export interface Pc {
  /** The machine as the rest of the game sees it (saved settings already applied). */
  machine: Machine;
  /** Settings stored in the BIOS. Kept apart from `machine`, which cannot hold everything (e.g. a disabled boot slot). */
  saved: Firmware;
  /** The settings being edited on the setup screen. */
  draft: Firmware;
  screen: Screen;
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

/** Same rule as the usb-scheme-mismatch blocker: Rufus GPT boots UEFI only, MBR boots legacy only (textbook p.47). */
export function usbBoots(m: Machine): boolean {
  return (m.bootMode === 'uefi') === (m.usbScheme === 'gpt');
}

export function powerOn(m: Machine): Pc {
  const fw = firmwareOf(m);
  return { machine: m, saved: fw, draft: fw, screen: { kind: 'post' } };
}

const done = (pc: Pc, effects: Effect[] = []): Result => ({ pc, effects });

/** Restart from any screen: unsaved BIOS changes are lost, saved ones stay, like on a real PC. */
export function restart(pc: Pc): Pc {
  return { ...pc, draft: pc.saved, screen: { kind: 'post' } };
}

/** A normal boot down the saved order. `skipUsb` = the player let "Press any key" time out. */
function boot(pc: Pc, skipUsb = false): Result {
  const order = bootOrder(pc.saved).filter((d) => !(skipUsb && d === 'usb'));
  const first = order.find((d) => d === 'ssd' || usbBoots(pc.machine));
  // Timing out at "Press any key" is not the player's mistake: the machine just carries on (decision 3, case1-plan).
  const blame = (reason: 'booted-old-windows' | 'no-boot-device'): Effect[] => (skipUsb ? [] : [{ type: 'mistake', reason }]);
  if (first === 'usb') return done({ ...pc, screen: { kind: 'press-any-key', via: 'bios' } });
  if (first === 'ssd') return done({ ...pc, screen: { kind: 'old-windows' } }, blame('booted-old-windows'));
  return done({ ...pc, screen: { kind: 'no-boot' } }, blame('no-boot-device'));
}

/** The screen's own timer ran out (POST continues, "Press any key" moves on). Other screens ignore it. */
export function timeout(pc: Pc): Result {
  if (pc.screen.kind === 'post') return boot(pc);
  if (pc.screen.kind === 'press-any-key') return boot(pc, true);
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
      return done({ ...pc, screen: { kind: 'setup' } }, [{ type: 'reached-setup', route: s.via }]);
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
  if (s.popup?.kind === 'confirm') popup = { kind: 'confirm', text: s.popup.action === 'save' ? menu.saveDialog : menu.discardDialog, cursor: s.popup.cursor };
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
    .filter((d) => d === 'ssd' || usbBoots(m))
    .map((d) => ({
      target: d,
      // The BIOS lists the stick as "USB: Flash Disk"; the boot menu names the device itself ("UEFI: USB Flash Disk").
      label: d === 'usb' ? `${uefi ? 'UEFI: ' : ''}USB Flash Disk 16GB` : uefi ? `Windows Boot Manager (${driveLabel(m, 'ssd')})` : driveLabel(m, 'ssd'),
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
  if (target === 'usb') return done({ ...pc, screen: { kind: 'press-any-key', via: 'boot-menu' } });
  return done({ ...pc, screen: { kind: 'old-windows' } }, [{ type: 'mistake', reason: 'booted-old-windows' }]);
}
