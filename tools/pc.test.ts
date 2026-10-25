// npm run test:unit — the customer's PC (src/core/pc.ts) driven key by key on the real classic BIOS:
// the textbook route (p.48–51), the Boot Menu shortcut, the Esc trap, and random key mashing.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { generateCase } from '../src/core/cases';
import { healthyMachine, type Machine } from '../src/core/machine';
import {
  biosView,
  bootMenuEntries,
  confirmBackup,
  DRIVES,
  insertUsb,
  KEYS,
  oobeAction,
  powerOn,
  press,
  restart,
  setupAction,
  timeout,
  type Effect,
  type Key,
  type Pc,
} from '../src/core/pc';
import { INSTALL_MS, locationError, type SetupAction } from '../src/core/setup';
import { CANT_RUN_REASONS, cantRunReasons } from '../src/core/requirements';
import { CUSTOMER_MS, FINISHING_MS, UPDATES_MS, type OobeAction } from '../src/core/oobe';
import { createRng } from '../src/core/rng';
import { BrandSchema, CaseSchema, ProblemsSchema } from '../src/content/schema';

const data = (path: string) => JSON.parse(readFileSync(new URL(`../src/content/data/${path}`, import.meta.url), 'utf8'));
const classic = BrandSchema.parse(data('brands/classic.json'));
const c01 = CaseSchema.parse(data('cases/c01-boot-order.json'));
const problems = ProblemsSchema.parse(data('problems.json'));
const somsriPc = generateCase(c01, { problems, brands: [classic] }, 'seed-1').machine;
const beamPc = generateCase(CaseSchema.parse(data('cases/c02-rufus-scheme.json')), { problems, brands: [classic] }, 'seed-2').machine;

/** Presses keys in order; 'timeout' stands for the screen's timer running out. Collects every effect. */
function run(start: Pc, ...keys: (Key | 'timeout')[]): { pc: Pc; effects: Effect[] } {
  let pc = start;
  const effects: Effect[] = [];
  for (const k of keys) {
    const r = k === 'timeout' ? timeout(pc) : press(classic, pc, k);
    pc = r.pc;
    effects.push(...r.effects);
  }
  return { pc, effects };
}

const view = (pc: Pc) => biosView(classic, pc)!;
const selected = (pc: Pc) => view(pc).rows.find((r) => r.selected)!;
const USB = 'USB: Flash Disk 16GB';

/** F2, then over to the Boot tab (Main, Advanced, PCIPnP, Boot). */
const TO_BOOT_TAB: Key[] = ['F2', 'Right', 'Right', 'Right'];
/** Boot > Hard Disk Drives > 1st Drive = USB, then back out to Boot Device Priority (textbook p.49–51). */
const USB_FIRST_DRIVE: Key[] = ['Down', 'Down', 'Enter', 'Enter', 'Down', 'Enter', 'Esc'];

test('case 1 really starts with the old Windows disk first', () => {
  assert.equal(somsriPc.usbFirst, false);
});

test('the textbook route: F2, Boot, Hard Disk Drives, 1st Drive = USB, F10, Ok, boot from USB', () => {
  const inBoot = run(powerOn(somsriPc), ...TO_BOOT_TAB).pc;
  assert.equal(view(inBoot).tabs[view(inBoot).tab], 'Boot');
  assert.deepEqual(view(inBoot).rows.map((r) => r.label), ['Boot Settings Configuration', 'Boot Device Priority', 'Hard Disk Drives']);

  // Before: Boot Device Priority offers only the first drive of the group, which is the old disk.
  const before = run(inBoot, 'Down', 'Enter').pc;
  assert.equal(view(before).heading, 'Boot Device Priority');
  assert.equal(selected(before).value, `SATA: SSD ${somsriPc.storageGB}GB`);
  const picker = run(before, 'Enter').pc;
  assert.deepEqual(view(picker).popup, { kind: 'choose', title: '1st Boot Device', options: [`SATA: SSD ${somsriPc.storageGB}GB`, 'Disabled'], cursor: 0 });

  // Hard Disk Drives: 1st Drive -> USB. Then USB is first in Boot Device Priority (figure 3.17).
  const set = run(inBoot, ...USB_FIRST_DRIVE).pc;
  const priority = run(set, 'Up', 'Enter').pc;
  assert.equal(view(priority).heading, 'Boot Device Priority');
  assert.equal(view(priority).rows[0]!.value, USB);

  // F10 -> "Save configuration changes and exit setup?" -> Ok -> reboot -> boots the USB.
  const dialog = run(priority, 'F10').pc;
  assert.deepEqual(view(dialog).popup, { kind: 'confirm', text: 'Save configuration changes and exit setup?', cursor: 0 });
  const saved = run(dialog, 'Enter');
  assert.equal(saved.pc.screen.kind, 'post');
  assert.equal(saved.pc.machine.usbFirst, true);
  const booted = run(saved.pc, 'timeout');
  assert.deepEqual(booted.pc.screen, { kind: 'press-any-key', via: 'bios' });
  const setup = run(booted.pc, 'Enter');
  assert.equal(setup.pc.screen.kind, 'setup');
  assert.deepEqual([...saved.effects, ...booted.effects, ...setup.effects], [{ type: 'reached-setup', route: 'bios', bypassedChecks: false }]);
});

test('Save Changes and Exit on the Exit tab works like F10', () => {
  const pc = run(powerOn(somsriPc), ...TO_BOOT_TAB, ...USB_FIRST_DRIVE, 'Left', 'Left', 'Left', 'Left').pc;
  assert.equal(view(pc).tabs[view(pc).tab], 'Exit');
  assert.equal(selected(pc).label, 'Save Changes and Exit');
  const r = run(pc, 'Enter', 'Enter', 'Enter', 'Enter');
  assert.equal(r.pc.screen.kind, 'setup');
  assert.deepEqual(r.effects, [{ type: 'reached-setup', route: 'bios', bypassedChecks: false }]);
});

test('the Boot Menu shortcut (F8) boots the USB once without changing the BIOS', () => {
  const menu = run(powerOn(somsriPc), 'F8').pc;
  assert.deepEqual(bootMenuEntries(menu).map((e) => e.label), [
    `Windows Boot Manager (SATA: SSD ${somsriPc.storageGB}GB)`,
    'UEFI: USB Flash Disk 16GB',
    'Enter Setup',
  ]);
  const r = run(menu, 'Down', 'Enter', 'Enter');
  assert.equal(r.pc.screen.kind, 'setup');
  assert.deepEqual(r.effects, [{ type: 'reached-setup', route: 'boot-menu', bypassedChecks: false }]);
  assert.equal(r.pc.machine.usbFirst, false, 'a one-time boot does not save anything');
});

test('the Esc trap: changes thrown away, the PC boots the old Windows, one mistake', () => {
  const changed = run(powerOn(somsriPc), ...TO_BOOT_TAB, ...USB_FIRST_DRIVE).pc;
  const out = run(changed, 'Esc'); // already back on the Boot tab's own page, so Esc means "exit setup"
  assert.deepEqual(view(out.pc).popup, { kind: 'confirm', text: 'Discard changes and exit setup?', cursor: 0 });
  const r = run(out.pc, 'Enter', 'timeout');
  assert.equal(r.pc.screen.kind, 'old-windows');
  assert.equal(r.pc.machine.usbFirst, false);
  assert.deepEqual(r.effects, [{ type: 'mistake', reason: 'booted-old-windows' }]);
});

test('Cancel in a dialog goes back to the BIOS with the changes still there', () => {
  const changed = run(powerOn(somsriPc), ...TO_BOOT_TAB, ...USB_FIRST_DRIVE).pc;
  for (const keys of [['F10', 'Right', 'Enter'], ['F10', 'Esc']] as Key[][]) {
    const r = run(changed, ...keys);
    assert.equal(r.pc.screen.kind, 'bios');
    assert.equal(view(r.pc).popup, null);
    assert.deepEqual(r.pc.draft.hddOrder, ['usb', 'ssd']);
  }
});

test('doing nothing at POST boots the old Windows (a mistake); Enter does the same', () => {
  for (const key of ['timeout', 'Enter'] as const) {
    const r = run(powerOn(somsriPc), key);
    assert.equal(r.pc.screen.kind, 'old-windows');
    assert.deepEqual(r.effects, [{ type: 'mistake', reason: 'booted-old-windows' }]);
  }
});

test('waiting too long at "Press any key" boots the old Windows but is not a mistake', () => {
  const r = run(powerOn(somsriPc), 'F8', 'Down', 'Enter', 'timeout');
  assert.equal(r.pc.screen.kind, 'old-windows');
  assert.deepEqual(r.effects, []);
  assert.equal(restart(r.pc).screen.kind, 'post', 'the player restarts and tries again');
});

test('picking Windows Boot Manager in the Boot Menu is a mistake; Esc boots the defaults', () => {
  assert.deepEqual(run(powerOn(somsriPc), 'F8', 'Enter').effects, [{ type: 'mistake', reason: 'booted-old-windows' }]);
  assert.equal(run(powerOn(somsriPc), 'F8', 'Esc').pc.screen.kind, 'old-windows');
  assert.equal(run(powerOn(somsriPc), 'F8', 'Down', 'Down', 'Enter').pc.screen.kind, 'bios', 'Enter Setup');
});

test('disabling every boot device: "no boot device" is a mistake, and a key restarts', () => {
  // Boot Device Priority > 1st Boot Device > Disabled, save.
  const r = run(powerOn(somsriPc), ...TO_BOOT_TAB, 'Down', 'Enter', 'Enter', 'Down', 'Enter', 'F10', 'Enter', 'timeout');
  assert.equal(r.pc.screen.kind, 'no-boot');
  assert.deepEqual(r.effects, [{ type: 'mistake', reason: 'no-boot-device' }]);
  const again = run(r.pc, 'Enter');
  assert.equal(again.pc.screen.kind, 'post');
  assert.equal(run(again.pc, 'timeout').pc.screen.kind, 'no-boot', 'the saved setting survives the restart');
  assert.ok(bootMenuEntries(again.pc).some((e) => e.target === 'usb'), 'the Boot Menu still lists the drives');
});

test('saved settings survive restarts; only unsaved edits are lost', () => {
  const saved = run(powerOn(somsriPc), ...TO_BOOT_TAB, ...USB_FIRST_DRIVE, 'F10', 'Enter').pc;
  const edited = run(saved, 'F2', 'Right', 'Right', 'Right', 'Enter', 'Plus').pc; // CSM Support -> Enabled, not saved
  const back = restart(edited);
  assert.deepEqual(back.draft, back.saved);
  assert.equal(back.draft.bootMode, 'uefi');
  assert.deepEqual(back.saved.hddOrder, ['usb', 'ssd']);
  assert.equal(back.machine.usbFirst, true);
});

test('a USB made for the wrong boot mode is skipped at boot and missing from the Boot Menu (case 2)', () => {
  const m: Machine = { ...healthyMachine('classic'), usbScheme: 'mbr', diskHasData: true };
  assert.equal(m.usbFirst, true);
  assert.equal(run(powerOn(m), 'timeout').pc.screen.kind, 'old-windows');
  assert.ok(!bootMenuEntries(powerOn(m)).some((e) => e.target === 'usb'));
  const legacy: Machine = { ...m, bootMode: 'legacy', secureBoot: false };
  assert.deepEqual(bootMenuEntries(powerOn(legacy)).map((e) => e.label), ['USB Flash Disk 16GB', `SATA: SSD ${m.storageGB}GB`, 'Enter Setup']);
});

test('options change with Enter or +/-, only in the draft until saved (CSM Support)', () => {
  const csm = run(powerOn(somsriPc), ...TO_BOOT_TAB, 'Enter').pc;
  assert.equal(view(csm).heading, 'Boot Settings Configuration');
  assert.equal(selected(csm).label, 'CSM Support', 'the cursor skips the read-only Quick Boot line');
  assert.equal(selected(csm).value, 'Disabled');
  const plus = run(csm, 'Plus').pc;
  assert.equal(selected(plus).value, 'Enabled');
  assert.equal(plus.draft.bootMode, 'legacy');
  assert.equal(plus.machine.bootMode, 'uefi', 'not saved yet');
  assert.equal(selected(run(plus, 'Minus').pc).value, 'Disabled');
  assert.equal(run(plus, 'F10', 'Enter').pc.machine.bootMode, 'legacy');
  assert.equal(restart(plus).machine.bootMode, 'uefi', 'restarting throws unsaved changes away');
});

test('arrows: tabs wrap, but not from inside a submenu; Up/Down stop at the ends and skip read-only lines', () => {
  const bios = run(powerOn(somsriPc), 'F2').pc;
  assert.equal(view(run(bios, 'Left').pc).tabs[view(run(bios, 'Left').pc).tab], 'Exit');
  const sub = run(bios, 'Right', 'Enter').pc; // Advanced > SATA Configuration
  assert.equal(view(sub).heading, 'SATA Configuration');
  assert.equal(view(run(sub, 'Right').pc).heading, 'SATA Configuration');
  const boot = run(bios, ...TO_BOOT_TAB.slice(1)).pc;
  assert.equal(selected(run(boot, 'Up').pc).label, 'Boot Settings Configuration');
  assert.equal(selected(run(boot, 'Down', 'Down', 'Down', 'Down').pc).label, 'Hard Disk Drives');
});

test('the Main tab shows this machine, and every selected row has its help text', () => {
  const main = view(run(powerOn(somsriPc), 'F2').pc);
  assert.equal(main.title, 'BIOS SETUP UTILITY');
  assert.deepEqual(main.tabs, ['Main', 'Advanced', 'PCIPnP', 'Boot', 'Security', 'Chipset', 'Exit']);
  assert.ok(main.rows.some((r) => r.value === somsriPc.cpu));
  assert.ok(main.rows.some((r) => r.value === `${somsriPc.ramGB * 1024}MB`));
  assert.ok(main.legend.includes('F10  Save and Exit'));
  const priority = view(run(powerOn(somsriPc), ...TO_BOOT_TAB, 'Down').pc);
  assert.equal(priority.help, 'Specifies the boot device priority sequence.');
});

test('random key mashing never breaks the PC', () => {
  const rng = createRng('mash');
  const all = [...KEYS, 'timeout'] as const;
  for (let game = 0; game < 1500; game++) {
    let pc = powerOn(rng.int(0, 1) ? somsriPc : { ...somsriPc, usbFirst: true });
    for (let i = 0; i < 60; i++) {
      const k = rng.pick(all);
      const r = k === 'timeout' ? timeout(pc) : press(classic, pc, k);
      pc = r.pc;
      assert.ok(r.effects.length <= 1);
      assert.deepEqual([...pc.draft.hddOrder].sort(), [...DRIVES].sort(), 'drives stay a permutation');
      assert.equal(pc.draft.bootSlots.length, 2);
      if (pc.screen.kind === 'bios') {
        const v = view(pc);
        const canSelect = v.rows.some((r) => r.kind !== 'info');
        assert.equal(v.rows.filter((r) => r.selected).length, canSelect ? 1 : 0, 'one highlight, or none on a read-only page');
        if (canSelect) assert.notEqual(v.rows.find((r) => r.selected)!.kind, 'info');
        if (v.popup?.kind === 'choose') assert.ok(v.popup.cursor >= 0 && v.popup.cursor < v.popup.options.length);
      }
      if (pc.screen.kind === 'boot-menu') assert.ok(pc.screen.cursor < bootMenuEntries(pc).length);
      if (pc.screen.kind === 'old-windows' || pc.screen.kind === 'setup') pc = restart(pc);
    }
  }
});

// ---- case 2: what is on the stick decides what boots (the stick is remade with Rufus, src/core/rufus.ts) ----

const STICK = { scheme: 'gpt', os: 'win11', bypassChecks: false } as const;
/** Boot Settings Configuration > CSM Support > Enabled, saved: the BIOS now boots legacy (MBR) sticks too. */
const CSM_ON: Key[] = [...TO_BOOT_TAB, 'Enter', 'Plus', 'F10', 'Enter'];

test("Beam's stick is MBR with Windows 11 on it, and his UEFI PC cannot see it", () => {
  assert.equal(beamPc.bootMode, 'uefi');
  assert.equal(beamPc.usbScheme, 'mbr');
  assert.equal(beamPc.usbOs, 'win11');
  assert.ok(!bootMenuEntries(powerOn(beamPc)).some((e) => e.target === 'usb'));
  assert.deepEqual(run(powerOn(beamPc), 'timeout').effects, [{ type: 'mistake', reason: 'booted-old-windows' }]);
});

test('the fix: the stick remade as GPT, plugged back in, F8 > UEFI USB > any key reaches Setup', () => {
  const pc = insertUsb(run(powerOn(beamPc), 'F8').pc, STICK);
  assert.equal(pc.screen.kind, 'post', 'plugging the stick back in starts the PC again');
  assert.equal(pc.machine.usbScheme, 'gpt');
  // His boot order already had the stick first: only the stick itself was wrong.
  assert.equal(bootMenuEntries(pc)[0]!.label, 'UEFI: USB Flash Disk 16GB');
  const r = run(pc, 'F8', 'Enter', 'Enter');
  assert.equal(r.pc.screen.kind, 'setup');
  assert.deepEqual(r.effects, [{ type: 'reached-setup', route: 'boot-menu', bypassedChecks: false }]);
  // The stick was first in the saved order all along, so a plain boot reaches it too.
  assert.deepEqual(run(pc, 'timeout', 'Enter').effects, [{ type: 'reached-setup', route: 'bios', bypassedChecks: false }]);
});

test('trap: a Windows 10 image boots the Windows 10 installer, one mistake', () => {
  const r = run(insertUsb(powerOn(beamPc), { ...STICK, os: 'win10' }), 'F8', 'Enter', 'Enter');
  assert.equal(r.pc.screen.kind, 'setup-win10');
  assert.deepEqual(r.effects, [{ type: 'mistake', reason: 'wrong-image' }]);
});

test('trap: an Ubuntu image goes straight to GNU GRUB (no "Press any key"), one mistake', () => {
  const r = run(insertUsb(powerOn(beamPc), { ...STICK, os: 'ubuntu' }), 'F8', 'Enter');
  assert.equal(r.pc.screen.kind, 'grub');
  assert.deepEqual(r.effects, [{ type: 'mistake', reason: 'wrong-image' }]);
  assert.equal(run(insertUsb(powerOn(beamPc), { ...STICK, os: 'ubuntu' }), 'timeout').pc.screen.kind, 'grub', 'a plain boot too');
});

test('trap: turning CSM on makes the MBR stick boot, but Windows 11 refuses legacy mode, one mistake', () => {
  const saved = run(powerOn(beamPc), ...CSM_ON).pc;
  assert.equal(saved.machine.bootMode, 'legacy');
  assert.ok(bootMenuEntries(saved).some((e) => e.target === 'usb'), 'the stick shows up now');
  const r = run(saved, 'timeout', 'Enter');
  assert.deepEqual(r.pc.screen, { kind: 'cant-run', reasons: [CANT_RUN_REASONS.secureBoot] });
  assert.deepEqual(r.effects, [{ type: 'mistake', reason: 'legacy-boot' }]);
  assert.deepEqual(run(restart(r.pc), 'timeout', 'Enter').effects, [{ type: 'mistake', reason: 'legacy-boot' }], 'every legacy boot counts');
  // Remaking the stick as GPT while CSM is still on does not help: the GPT stick needs UEFI.
  assert.ok(!bootMenuEntries(insertUsb(saved, STICK)).some((e) => e.target === 'usb'));
});

test('a stick made with the Windows 11 checks removed still installs, and Setup is told so (noted, not a mistake)', () => {
  const r = run(insertUsb(powerOn(beamPc), { ...STICK, bypassChecks: true }), 'F8', 'Enter', 'Enter');
  assert.deepEqual(r.effects, [{ type: 'reached-setup', route: 'boot-menu', bypassedChecks: true }]);
});

test('plugging a stick in keeps the saved BIOS settings and drops unsaved ones', () => {
  const saved = run(powerOn(beamPc), ...CSM_ON).pc;
  const editing = run(saved, 'F2', 'Right', 'Right', 'Right', 'Enter', 'Minus').pc; // CSM back to Disabled, not saved
  const pc = insertUsb(editing, STICK);
  assert.equal(pc.machine.bootMode, 'legacy');
  assert.deepEqual(pc.draft, pc.saved);
});

test("case 1 is unchanged: Somsri's stick is the right one", () => {
  assert.equal(somsriPc.usbOs, 'win11');
  assert.equal(somsriPc.usbBypassChecks, false);
});

// ---- case 3: Windows 11 Setup on the PC (src/core/setup.ts drives the pages) ----

/** Lung Chai's PC: UEFI, the USB first already, an MBR disk with his old Windows on it. */
const chaiPc: Machine = { ...healthyMachine('classic'), storageGB: 500, diskStyle: 'mbr', diskHasData: true };
const GOOD_STICK = { scheme: 'gpt' as const, os: 'win11' as const, bypassChecks: false };

function tap(start: Pc, ...actions: SetupAction[]): { pc: Pc; effects: Effect[] } {
  let pc = start;
  const effects: Effect[] = [];
  for (const a of actions) {
    const r = setupAction(pc, a);
    pc = r.pc;
    effects.push(...r.effects);
  }
  return { pc, effects };
}
const NEXT: SetupAction = { type: 'next' };
const TO_LOCATION: SetupAction[] = [NEXT, NEXT, { type: 'agree', on: true }, NEXT, { type: 'enter-key' }, NEXT, { type: 'accept' }];
const wipe = (id: string): SetupAction[] => [{ type: 'select', id }, { type: 'delete' }, { type: 'ok' }];
const INSTALL: SetupAction[] = [{ type: 'select', id: '1-free' }, NEXT, { type: 'install' }, { type: 'tick', ms: INSTALL_MS }];
/** Power on, let POST boot the USB, press a key: Setup's first page. */
const toSetup = (pc: Pc) => run(pc, 'timeout', 'Enter').pc;
const setupOf = (pc: Pc) => (pc.screen.kind === 'setup' ? pc.screen.setup : assert.fail(`not in Setup: ${pc.screen.kind}`));

test('case 3 content: the generated PC boots the USB straight into Setup, which shows the MBR disk', () => {
  const c03 = CaseSchema.parse(data('cases/c03-red-text.json'));
  assert.equal(c03.goal, 'install');
  const m = generateCase(c03, { problems, brands: [classic] }, 'seed-3').machine;
  const pc = tap(toSetup(powerOn(m)), ...TO_LOCATION.slice(0, 4)).pc;
  assert.equal(setupOf(pc).page, 'product-key');
  assert.equal(setupOf(pc).diskStyle, 'mbr');
  assert.equal(setupOf(pc).hasKey, m.productKey);
});

test('the textbook fix on the PC: installed, the disk is GPT now, and the old Windows is gone', () => {
  const pc = confirmBackup(toSetup(powerOn(chaiPc)));
  const r = tap(pc, ...TO_LOCATION, ...wipe('1-2'), ...wipe('1-1'), ...INSTALL);
  assert.deepEqual(r.effects, [{ type: 'installed', wrongEdition: false, activateLater: false }]);
  assert.equal(r.pc.machine.diskStyle, 'gpt');
  assert.equal(r.pc.machine.diskHasData, false);
  assert.equal(setupOf(r.pc).page, 'done');
});

test('deleting the stick in Setup: one mistake, then the PC passes over the empty stick without a second one', () => {
  const r = tap(toSetup(powerOn(chaiPc)), ...TO_LOCATION, ...wipe('0-1'));
  assert.deepEqual(r.effects, [{ type: 'mistake', reason: 'deleted-installer' }]);
  assert.equal(r.pc.machine.usbOs, 'empty');
  const again = run(restart(r.pc), 'timeout');
  assert.equal(again.pc.screen.kind, 'old-windows');
  assert.deepEqual(again.effects, [], 'the stick was the mistake, not the boot order');
  assert.ok(!bootMenuEntries(again.pc).some((e) => e.target === 'usb'), 'an empty stick is not in the Boot Menu');
});

test('with the old Windows deleted and the stick empty, the PC has nothing to boot (still no extra mistake)', () => {
  const pc = confirmBackup(toSetup(powerOn(chaiPc)));
  const r = tap(pc, ...TO_LOCATION, ...wipe('1-2'), ...wipe('0-1'));
  assert.equal(r.pc.machine.diskHasData, false);
  const again = run(restart(r.pc), 'timeout');
  assert.equal(again.pc.screen.kind, 'no-boot');
  assert.deepEqual(again.effects, []);
});

test('a stick made again in Rufus boots Setup again, which remembers the backup answer and the blame', () => {
  // Asked first: wiping the disk after the new stick costs nothing.
  const asked = tap(confirmBackup(toSetup(powerOn(chaiPc))), ...TO_LOCATION, ...wipe('0-1')).pc;
  const fresh = toSetup(insertUsb(asked, GOOD_STICK));
  assert.equal(setupOf(fresh).backupConfirmed, true);
  assert.deepEqual(tap(fresh, ...TO_LOCATION, ...wipe('1-2'), ...wipe('1-1')).effects, []);

  // Not asked and already blamed once: no second backup mistake after the new stick.
  const blamed = tap(toSetup(powerOn(chaiPc)), ...TO_LOCATION, ...wipe('1-1'), ...wipe('0-1'));
  assert.deepEqual(
    blamed.effects.map((e) => e.type === 'mistake' && e.reason),
    ['no-backup-check', 'deleted-installer'],
  );
  const later = tap(toSetup(insertUsb(blamed.pc, GOOD_STICK)), ...TO_LOCATION, ...wipe('1-2'));
  assert.deepEqual(later.effects, []);
});

test('the backup answer given before Setup starts is passed to it', () => {
  const pc = toSetup(confirmBackup(powerOn(chaiPc)));
  assert.equal(setupOf(pc).backupConfirmed, true);
});

test('no key and another edition: installed with the edition noted, activation left for later', () => {
  const pc = toSetup(powerOn({ ...chaiPc, productKey: false, diskHasData: false }));
  const r = tap(
    pc,
    NEXT,
    NEXT,
    { type: 'agree', on: true },
    NEXT,
    { type: 'no-key' },
    { type: 'pick-edition', edition: 'Windows 11 Pro' },
    NEXT,
    { type: 'accept' },
    ...INSTALL,
  );
  assert.deepEqual(r.effects, [{ type: 'installed', wrongEdition: true, activateLater: true }]);
  assert.equal(r.pc.machine.windowsEdition, 'Windows 11 Pro');
  assert.equal(r.pc.machine.activateLater, true);
});

test('Setup taps do nothing on other screens', () => {
  const pc = powerOn(chaiPc);
  assert.deepEqual(setupAction(pc, NEXT), { pc, effects: [] });
});

// ---- case 4: "This PC can't run Windows 11" (Ton's PC: TPM, maybe Secure Boot, turned off in the BIOS) ----

const c04 = CaseSchema.parse(data('cases/c04-security-chip.json'));
/** s1: TPM off only · s3: TPM and Secure Boot off (seeds checked against the case file). */
const tonPc = (seed: 's1' | 's3') => generateCase(c04, { problems, brands: [classic] }, seed).machine;
/** POST boots the stick (it is first already), a key starts Setup. */
const BOOT: (Key | 'timeout')[] = ['timeout', 'Enter'];
/** F2, Advanced, Trusted Computing, Security Device Support = Enabled (still inside the BIOS). */
const TPM_ON: Key[] = ['F2', 'Right', 'Down', 'Enter', 'Enter', 'Up', 'Enter'];
/** From that submenu: back out, over to Security, Secure Boot, Secure Boot = Enabled. */
const SB_ON: Key[] = ['Esc', 'Right', 'Right', 'Right', 'Enter', 'Enter', 'Up', 'Enter'];
const SAVE: Key[] = ['F10', 'Enter'];
const screenOf = (pc: Pc) => pc.screen;

test("case 4 content: Ton's PC is fine but for TPM (and maybe Secure Boot) turned off; the stick boots first", () => {
  assert.equal(tonPc('s1').tpmEnabled, false);
  assert.equal(tonPc('s1').secureBoot, true);
  assert.equal(tonPc('s3').secureBoot, false);
  assert.equal(tonPc('s1').usbFirst, true);
  assert.deepEqual(cantRunReasons(tonPc('s1')), [CANT_RUN_REASONS.tpm]);
  assert.deepEqual(cantRunReasons(tonPc('s3')), [CANT_RUN_REASONS.tpm, CANT_RUN_REASONS.secureBoot]);
});

test('the first "can\'t run" is what Ton saw, not a mistake; TPM on in the BIOS, F10, and Setup starts', () => {
  const first = run(powerOn(tonPc('s1')), ...BOOT);
  assert.deepEqual(screenOf(first.pc), { kind: 'cant-run', reasons: [CANT_RUN_REASONS.tpm] });
  assert.deepEqual(first.effects, [{ type: 'cant-run', reasons: [CANT_RUN_REASONS.tpm] }]);
  const fixed = run(restart(first.pc), ...TPM_ON, ...SAVE, ...BOOT);
  assert.equal(fixed.pc.machine.tpmEnabled, true);
  assert.equal(screenOf(fixed.pc).kind, 'setup');
  assert.deepEqual(fixed.effects, [{ type: 'reached-setup', route: 'bios', bypassedChecks: false }]);
});

test('trap: TPM turned on but left with Esc (not saved): the same reasons again, one mistake each time', () => {
  const first = run(powerOn(tonPc('s1')), ...BOOT).pc;
  const discard = run(restart(first), ...TPM_ON, 'Esc', 'Esc', 'Enter', ...BOOT);
  assert.equal(discard.pc.machine.tpmEnabled, false);
  assert.deepEqual(discard.effects, [{ type: 'mistake', reason: 'still-cant-run' }]);
  assert.deepEqual(run(restart(discard.pc), ...BOOT).effects, [{ type: 'mistake', reason: 'still-cant-run' }]);
});

test('TPM and Secure Boot off: both reasons; TPM alone leaves one (progress, no mistake); both on and Setup starts', () => {
  const first = run(powerOn(tonPc('s3')), ...BOOT);
  assert.deepEqual(screenOf(first.pc), { kind: 'cant-run', reasons: [CANT_RUN_REASONS.tpm, CANT_RUN_REASONS.secureBoot] });
  const half = run(restart(first.pc), ...TPM_ON, ...SAVE, ...BOOT);
  assert.deepEqual(screenOf(half.pc), { kind: 'cant-run', reasons: [CANT_RUN_REASONS.secureBoot] });
  assert.deepEqual(half.effects, [{ type: 'cant-run', reasons: [CANT_RUN_REASONS.secureBoot] }]);
  const both = run(restart(half.pc), ...TPM_ON, ...SB_ON, ...SAVE, ...BOOT);
  assert.equal(both.pc.machine.secureBoot, true);
  assert.equal(screenOf(both.pc).kind, 'setup');
  // Turning both on in one visit works the same.
  assert.equal(screenOf(run(restart(first.pc), ...TPM_ON, ...SB_ON, ...SAVE, ...BOOT).pc).kind, 'setup');
});

test('trap: CSM turned on in case 4: the GPT stick no longer boots, the old Windows comes up (a mistake)', () => {
  const r = run(powerOn(tonPc('s1')), ...CSM_ON, 'timeout');
  assert.equal(screenOf(r.pc).kind, 'old-windows');
  assert.deepEqual(r.effects, [{ type: 'mistake', reason: 'booted-old-windows' }]);
});

test('the reasons follow the machine: processor, TPM missing or off, legacy, memory; a "checks removed" stick skips TPM, Secure Boot and memory', () => {
  const ok = healthyMachine('classic');
  assert.deepEqual(cantRunReasons(ok), []);
  assert.deepEqual(cantRunReasons({ ...ok, cpuWin11: false }), [CANT_RUN_REASONS.cpu]);
  assert.deepEqual(cantRunReasons({ ...ok, tpm: 'none' }), [CANT_RUN_REASONS.tpm]);
  assert.deepEqual(cantRunReasons({ ...ok, bootMode: 'legacy' }), [CANT_RUN_REASONS.secureBoot]);
  assert.deepEqual(cantRunReasons({ ...ok, ramGB: 2 }), [CANT_RUN_REASONS.ram]);
  const bypass = { ...ok, usbBypassChecks: true, tpmEnabled: false, secureBoot: false, ramGB: 2 };
  assert.deepEqual(cantRunReasons(bypass), []);
  assert.deepEqual(cantRunReasons({ ...bypass, bootMode: 'legacy' }), [CANT_RUN_REASONS.secureBoot], 'legacy is refused either way');
  assert.deepEqual(cantRunReasons({ ...bypass, cpuWin11: false }), [CANT_RUN_REASONS.cpu], 'the processor is still checked');
});

// ---- case 5: Teacher Wilai's lab PC came in legacy (CSM on, Secure Boot off, MBR disk and stick) ----

const c05 = CaseSchema.parse(data('cases/c05-lab-upgrade.json'));
/** s1: legacy only · s3: no product key too · s5: TPM off too. */
const wilaiPc = (seed: 's1' | 's3' | 's5') => generateCase(c05, { problems, brands: [classic] }, seed).machine;
/** F2, Boot, Boot Settings Configuration, CSM Support = Disabled, then over to Security, Secure Boot = Enabled (inside the BIOS). */
const UEFI_ON: Key[] = [...TO_BOOT_TAB, 'Enter', 'Minus', 'Esc', 'Right', 'Enter', 'Enter', 'Up', 'Enter'];

test('case 5 content: the lab PC is legacy with an MBR disk holding Windows 10 and an MBR stick; s5 has TPM off', () => {
  const m = wilaiPc('s1');
  assert.deepEqual([m.bootMode, m.secureBoot, m.diskStyle, m.usbScheme, m.diskHasData, m.usbFirst], ['legacy', false, 'mbr', 'mbr', true, true]);
  assert.equal(wilaiPc('s5').tpmEnabled, false);
  assert.equal(wilaiPc('s3').productKey, false);
});

test('case 5: the first "can\'t run" on a PC that came in legacy is what the teacher saw; the same again is a mistake', () => {
  const first = run(powerOn(wilaiPc('s1')), ...BOOT);
  assert.deepEqual(screenOf(first.pc), { kind: 'cant-run', reasons: [CANT_RUN_REASONS.secureBoot] });
  assert.deepEqual(first.effects, [{ type: 'cant-run', reasons: [CANT_RUN_REASONS.secureBoot] }]);
  assert.deepEqual(run(restart(first.pc), ...BOOT).effects, [{ type: 'mistake', reason: 'still-cant-run' }]);
  // Secure Boot turned on but CSM left on: still legacy, still the same line.
  const sbOnly = run(restart(first.pc), 'F2', 'Right', 'Right', 'Right', 'Right', 'Enter', 'Enter', 'Up', 'Enter', ...SAVE, ...BOOT);
  assert.equal(sbOnly.pc.machine.bootMode, 'legacy');
  assert.deepEqual(sbOnly.effects, [{ type: 'mistake', reason: 'still-cant-run' }]);
});

test('case 5: CSM off leaves nothing to boot (legacy Windows, MBR stick): free once, then a mistake; the Boot Menu lists neither', () => {
  const first = run(powerOn(wilaiPc('s1')), ...BOOT).pc;
  const uefi = run(restart(first), ...UEFI_ON, ...SAVE).pc;
  assert.deepEqual([uefi.machine.bootMode, uefi.machine.secureBoot], ['uefi', true]);
  assert.deepEqual(bootMenuEntries(uefi).map((e) => e.target), ['setup'], 'no UEFI entry for the old Windows, and the MBR stick does not show');
  const dark = run(uefi, 'timeout');
  assert.equal(screenOf(dark.pc).kind, 'no-boot');
  assert.deepEqual(dark.effects, [{ type: 'legacy-no-boot' }]);
  assert.deepEqual(run(restart(dark.pc), 'timeout').effects, [{ type: 'mistake', reason: 'no-boot-device' }]);
  assert.deepEqual(run(restart(dark.pc), 'F8', 'Esc').effects, [{ type: 'mistake', reason: 'no-boot-device' }], 'Boot Menu Esc boots the defaults');
});

test('case 5: the stick remade as GPT boots and Setup starts; the MBR disk shows the red text, deleted and installed', () => {
  const first = run(powerOn(wilaiPc('s1')), ...BOOT).pc;
  const dark = run(restart(first), ...UEFI_ON, ...SAVE, 'timeout').pc;
  const setup = run(insertUsb(dark, STICK), ...BOOT);
  assert.equal(screenOf(setup.pc).kind, 'setup');
  assert.deepEqual(setup.effects, [{ type: 'reached-setup', route: 'bios', bypassedChecks: false }]);
  const atLocation = tap(confirmBackup(setup.pc), ...TO_LOCATION, { type: 'select', id: '1-2' }).pc;
  assert.match(locationError(setupOf(atLocation)) ?? '', /MBR partition table/);
  const done = tap(atLocation, ...wipe('1-1'), ...wipe('1-2'), ...INSTALL);
  assert.ok(done.effects.some((e) => e.type === 'installed'));
  assert.equal(done.pc.machine.diskStyle, 'gpt');
});

test('case 5: CSM off but Secure Boot forgotten: the GPT stick is refused for Secure Boot again, progress (no mistake)', () => {
  const first = run(powerOn(wilaiPc('s1')), ...BOOT).pc;
  const csmOff = run(restart(first), ...TO_BOOT_TAB, 'Enter', 'Minus', ...SAVE, 'timeout').pc;
  const r = run(insertUsb(csmOff, STICK), ...BOOT);
  assert.deepEqual(screenOf(r.pc), { kind: 'cant-run', reasons: [CANT_RUN_REASONS.secureBoot] });
  assert.deepEqual(r.effects, [{ type: 'cant-run', reasons: [CANT_RUN_REASONS.secureBoot] }]);
  assert.deepEqual(run(restart(r.pc), ...BOOT).effects, [{ type: 'mistake', reason: 'still-cant-run' }], 'the same in UEFI again counts');
});

test('case 5 with TPM off too: both reasons in legacy; TPM, CSM and Secure Boot fixed in one visit, and Setup starts', () => {
  const first = run(powerOn(wilaiPc('s5')), ...BOOT);
  assert.deepEqual(screenOf(first.pc), { kind: 'cant-run', reasons: [CANT_RUN_REASONS.tpm, CANT_RUN_REASONS.secureBoot] });
  assert.deepEqual(first.effects, [{ type: 'cant-run', reasons: [CANT_RUN_REASONS.tpm, CANT_RUN_REASONS.secureBoot] }]);
  const all = run(restart(first.pc), ...TPM_ON, 'Esc', 'Right', 'Right', 'Enter', 'Minus', 'Esc', 'Right', 'Enter', 'Enter', 'Up', 'Enter', ...SAVE);
  assert.deepEqual([all.pc.machine.tpmEnabled, all.pc.machine.bootMode, all.pc.machine.secureBoot], [true, 'uefi', true]);
  assert.equal(screenOf(run(insertUsb(all.pc, STICK), ...BOOT).pc).kind, 'setup');
});

test('a PC that came in with UEFI keeps its old Windows bootable with CSM on, and a legacy boot there is still a mistake', () => {
  const r = run(powerOn(tonPc('s1')), ...CSM_ON);
  assert.equal(r.pc.arrivedIn, 'uefi');
  assert.ok(bootMenuEntries(r.pc).some((e) => e.target === 'ssd'));
});

// ---- case 5: after the install the PC restarts into the new Windows' first-time setup (src/core/oobe.ts) ----

/** Lung Chai's PC with a blank disk: Setup straight to the finished install. */
function installed(): Pc {
  const pc = toSetup(powerOn({ ...chaiPc, diskHasData: false }));
  const r = tap(pc, ...TO_LOCATION, ...INSTALL);
  assert.equal(setupOf(r.pc).page, 'done');
  return r.pc;
}

test('the install leaves the new Windows on the disk; the PC restarts by itself and, with the stick left first, asks "Press any key"', () => {
  const pc = installed();
  assert.equal(pc.fresh?.page, 'region');
  assert.equal(pc.fresh?.edition, pc.machine.windowsEdition);
  const again = run(pc, 'timeout');
  assert.equal(screenOf(again.pc).kind, 'post');
  assert.equal(screenOf(run(again.pc, 'timeout').pc).kind, 'press-any-key');
  // Letting it time out boots the disk: first-time setup, not the old Windows and no mistake.
  const first = run(again.pc, 'timeout', 'timeout');
  assert.deepEqual(screenOf(first.pc), { kind: 'oobe', oobe: pc.fresh });
  assert.deepEqual(first.effects, []);
});

test('the Boot Menu entry for the disk starts the new Windows too, without a mistake', () => {
  const pc = run(installed(), 'timeout', 'F8').pc;
  const i = bootMenuEntries(pc).findIndex((e) => e.target === 'ssd');
  const r = run(pc, ...(Array(i).fill('Down') as Key[]), 'Enter');
  assert.equal(screenOf(r.pc).kind, 'oobe');
  assert.deepEqual(r.effects, []);
});

test('first-time setup through the PC: its effects come out as notes and the desktop; a restart picks up where it was', () => {
  const oobe = run(installed(), 'timeout', 'timeout', 'timeout').pc;
  const tapO = (start: Pc, ...as: OobeAction[]) => {
    let pc = start;
    const effects: Effect[] = [];
    for (const a of as) {
      const r = oobeAction(pc, a);
      pc = r.pc;
      effects.push(...r.effects);
    }
    return { pc, effects };
  };
  const named = tapO(oobe, { type: 'pick-region', region: 'Thailand' }, { type: 'yes' }, { type: 'yes' }, { type: 'skip' }, { type: 'plug-cable' }, { type: 'next' }, { type: 'tick', ms: UPDATES_MS }, { type: 'skip' });
  assert.equal(named.pc.fresh?.page, 'account');
  const back = run(restart(named.pc), 'timeout', 'timeout');
  const resumed = screenOf(back.pc);
  assert.equal(resumed.kind === 'oobe' ? resumed.oobe.page : resumed.kind, 'account', 'resumed after a restart');
  const r = tapO(back.pc, { type: 'ask-password' }, { type: 'hand-over' }, { type: 'tick', ms: CUSTOMER_MS }, { type: 'tick', ms: CUSTOMER_MS }, { type: 'ask-privacy' }, { type: 'accept' }, { type: 'skip' }, { type: 'skip' }, { type: 'skip' }, { type: 'tick', ms: FINISHING_MS });
  assert.deepEqual(
    r.effects.map((e) => (e.type === 'oobe-note' ? e.note : e.type === 'mistake' ? e.reason : e.type)),
    ['asked-password', 'handed-over', 'handed-back', 'privacy-asked', 'desktop'],
  );
  assert.equal(r.pc.fresh?.page, 'desktop');
  const later = screenOf(run(restart(r.pc), 'timeout', 'timeout').pc);
  assert.equal(later.kind === 'oobe' ? later.oobe.page : later.kind, 'desktop', 'the desktop again after a restart');
});

test('first-time setup taps do nothing on other screens', () => {
  const pc = powerOn(chaiPc);
  assert.deepEqual(oobeAction(pc, { type: 'yes' }), { pc, effects: [] });
});
