// npm run test:unit — Rufus on the shop laptop (src/core/rufus.ts): the textbook way to make the stick
// (p.45–48), the case 2 traps (MBR again, the wrong image), and what the finished stick holds.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, COPY_MS, ISO_FILES, openRufus, rufusView, targetSystem, type Rufus, type RufusAction, type RufusEffect, type Usb } from '../src/core/rufus';

/** Beam's stick: the right image, but made MBR from an old video. */
const BEAM_USB: Usb = { scheme: 'mbr', os: 'win11', label: 'CCCOMA_X64FRE_TH-TH_DV9', bypassChecks: false };
const WIN11 = 'Win11_24H2_Thai_x64.iso';

function run(start: Rufus, ...actions: RufusAction[]): { rufus: Rufus; effects: RufusEffect[] } {
  let rufus = start;
  const effects: RufusEffect[] = [];
  for (const a of actions) {
    const r = act(rufus, a);
    rufus = r.rufus;
    effects.push(...r.effects);
  }
  return { rufus, effects };
}

const pick = (name: string): RufusAction[] => [{ type: 'open-picker' }, { type: 'pick-iso', name }];
/** START, OK on Customize (if asked), OK on the warning, then wait for the copy. */
const write: RufusAction[] = [{ type: 'start' }, { type: 'ok' }, { type: 'ok' }, { type: 'tick', ms: COPY_MS }];

test('Rufus opens with the scheme the customer used (MBR) and no image picked; START waits for an image', () => {
  const r = openRufus(BEAM_USB);
  const v = rufusView(r);
  assert.equal(v.scheme, 'mbr');
  assert.equal(v.target, 'BIOS (or UEFI-CSM)');
  assert.equal(v.bootSelection, 'Disk or ISO image (Please select)');
  assert.equal(v.device, 'CCCOMA_X64FRE_TH-TH_DV9 (E:) [16 GB]');
  assert.equal(v.status, 'READY');
  assert.equal(v.canStart, false);
  assert.deepEqual(act(r, { type: 'start' }).rufus, r, 'START does nothing without an image');
});

test('the textbook way: pick the Windows 11 image, GPT (target becomes UEFI), START, OK, OK, wait: a GPT Windows 11 stick', () => {
  const { rufus, effects } = run(openRufus(BEAM_USB), ...pick(WIN11), { type: 'set-scheme', scheme: 'gpt' }, ...write);
  assert.equal(rufusView(rufus).target, 'UEFI (non CSM)');
  assert.deepEqual(effects, [{ type: 'usb-written', usb: { scheme: 'gpt', os: 'win11', label: 'CCCOMA_X64FRE_TH-TH_DV9', bypassChecks: false } }]);
  assert.equal(rufus.phase, 'done');
  assert.equal(rufusView(rufus).status, 'READY');
  assert.equal(rufusView(rufus).progress, 1);
});

test('Target system always follows the partition scheme', () => {
  assert.equal(targetSystem('gpt'), 'UEFI (non CSM)');
  assert.equal(targetSystem('mbr'), 'BIOS (or UEFI-CSM)');
});

test('the order of the dialogs: Windows images ask Customize first then warn; Ubuntu only warns; Cancel goes back', () => {
  const win = run(openRufus(BEAM_USB), ...pick(WIN11), { type: 'start' }).rufus;
  assert.equal(win.dialog?.kind, 'customize');
  assert.equal(run(win, { type: 'ok' }).rufus.dialog?.kind, 'warning');
  assert.match(rufusView(win).warning, /WILL BE DESTROYED/);
  const cancelled = run(win, { type: 'ok' }, { type: 'close-dialog' }).rufus;
  assert.equal(cancelled.dialog, null);
  assert.equal(cancelled.phase, 'ready', 'Cancel on the warning writes nothing');

  const ubuntu = run(openRufus(BEAM_USB), ...pick('ubuntu-24.04-desktop-amd64.iso'), { type: 'start' }).rufus;
  assert.equal(ubuntu.dialog?.kind, 'warning');
});

test('trap: writing MBR again gives the same kind of stick the customer already had', () => {
  const { effects } = run(openRufus(BEAM_USB), ...pick(WIN11), ...write);
  assert.equal(effects[0]!.usb.scheme, 'mbr');
});

test('trap: the wrong image ends up on the stick (Windows 10, Ubuntu)', () => {
  const win10 = run(openRufus(BEAM_USB), ...pick('Win10_22H2_Thai_x64.iso'), { type: 'set-scheme', scheme: 'gpt' }, ...write);
  assert.equal(win10.effects[0]!.usb.os, 'win10');
  const ubuntu = run(openRufus(BEAM_USB), ...pick('ubuntu-24.04-desktop-amd64.iso'), { type: 'set-scheme', scheme: 'gpt' }, { type: 'start' }, { type: 'ok' }, { type: 'tick', ms: COPY_MS });
  assert.deepEqual(ubuntu.effects[0]!.usb, { scheme: 'gpt', os: 'ubuntu', label: 'Ubuntu 24.04 LTS amd64', bypassChecks: false });
});

test('ticking "Remove requirement … TPM 2.0" is remembered on the stick; unticking it again clears it', () => {
  const ticked = run(openRufus(BEAM_USB), ...pick(WIN11), { type: 'start' }, { type: 'toggle', id: 'bypassChecks' }, { type: 'ok' }, { type: 'ok' }, { type: 'tick', ms: COPY_MS });
  assert.equal(ticked.effects[0]!.usb.bypassChecks, true);
  const untick = run(openRufus(BEAM_USB), ...pick(WIN11), { type: 'start' }, { type: 'toggle', id: 'bypassChecks' }, { type: 'toggle', id: 'bypassChecks' }, { type: 'ok' }, { type: 'ok' }, { type: 'tick', ms: COPY_MS });
  assert.equal(untick.effects[0]!.usb.bypassChecks, false);
  const other = run(openRufus(BEAM_USB), ...pick(WIN11), { type: 'start' }, { type: 'toggle', id: 'noBitLocker' }, { type: 'ok' }, { type: 'ok' }, { type: 'tick', ms: COPY_MS });
  assert.equal(other.effects[0]!.usb.bypassChecks, false, 'other options do not count as skipping the checks');
});

test('while copying, Rufus is busy: buttons do nothing, progress shows, and the stick is written exactly once', () => {
  const copying = run(openRufus(BEAM_USB), ...pick(WIN11), { type: 'start' }, { type: 'ok' }, { type: 'ok' }, { type: 'tick', ms: COPY_MS / 2 }).rufus;
  assert.equal(rufusView(copying).busy, true);
  assert.equal(rufusView(copying).status, 'Copying ISO files: 50%');
  assert.equal(rufusView(copying).canStart, false);
  for (const a of [{ type: 'set-scheme', scheme: 'gpt' }, { type: 'open-picker' }, { type: 'start' }] as RufusAction[]) {
    assert.deepEqual(act(copying, a).rufus, copying, `${a.type} is ignored while copying`);
  }
  const { effects } = run(copying, { type: 'tick', ms: COPY_MS }, { type: 'tick', ms: COPY_MS });
  assert.equal(effects.length, 1);
});

test('after a write, picking another image or scheme starts a new job that can be written again', () => {
  const first = run(openRufus(BEAM_USB), ...pick(WIN11), ...write).rufus;
  const again = run(first, { type: 'set-scheme', scheme: 'gpt' });
  assert.equal(again.rufus.phase, 'ready');
  const { effects } = run(again.rufus, ...write);
  assert.equal(effects[0]!.usb.scheme, 'gpt');
});

test('the picker lists three images, only one of them Windows 11, and ignores files that are not in it', () => {
  assert.equal(ISO_FILES.length, 3);
  assert.equal(ISO_FILES.filter((f) => f.os === 'win11').length, 1);
  const r = run(openRufus(BEAM_USB), { type: 'open-picker' }, { type: 'pick-iso', name: 'virus.exe' }).rufus;
  assert.equal(r.iso, null);
  assert.equal(r.dialog?.kind, 'pick-iso', 'still choosing');
});
