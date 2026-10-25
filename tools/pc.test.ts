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
  powerOn,
  press,
  restart,
  setupAction,
  timeout,
  type Effect,
  type Key,
  type Pc,
} from '../src/core/pc';
import { INSTALL_MS, type SetupAction } from '../src/core/setup';
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
  assert.equal(r.pc.screen.kind, 'cant-run');
  assert.deepEqual(r.effects, [{ type: 'mistake', reason: 'legacy-boot' }]);
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
