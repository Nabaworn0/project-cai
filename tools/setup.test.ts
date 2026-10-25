// npm run test:unit — Windows 11 Setup (src/core/setup.ts): every page in order, the partition page of
// case 3 (MBR disk on a UEFI PC, textbook p.55), and its traps (no backup check, wiping the install USB).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { healthyMachine, type Machine } from '../src/core/machine';
import {
  act,
  formatSize,
  INSTALL_MS,
  locationError,
  openSetup,
  partsOf,
  setupView,
  STICKER_KEY,
  type Setup,
  type SetupAction,
  type SetupEffect,
} from '../src/core/setup';

/** Lung Chai's PC: UEFI, a 500 GB disk still MBR with his old Windows on it. */
const CHAI: Machine = { ...healthyMachine('classic'), storageGB: 500, diskStyle: 'mbr', diskHasData: true };
const opts = { ticketEdition: 'Windows 11 Home' as const };

function run(start: Setup, ...actions: SetupAction[]): { setup: Setup; effects: SetupEffect[] } {
  let setup = start;
  const effects: SetupEffect[] = [];
  for (const a of actions) {
    const r = act(setup, a);
    setup = r.setup;
    effects.push(...r.effects);
  }
  return { setup, effects };
}

const next: SetupAction = { type: 'next' };
/** Language, keyboard, setup option (ticked), product key from the sticker, license: the location page. */
const toLocation: SetupAction[] = [next, next, { type: 'agree', on: true }, next, { type: 'enter-key' }, next, { type: 'accept' }];
const del = (id: string): SetupAction[] => [{ type: 'select', id }, { type: 'delete' }, { type: 'ok' }];
const finish: SetupAction[] = [{ type: 'select', id: '1-free' }, next, { type: 'install' }, { type: 'tick', ms: INSTALL_MS }];

test('the pages in order with a key: Select image is skipped because the key decides the edition', () => {
  const pages: string[] = [];
  let s = openSetup(CHAI, opts);
  for (const a of toLocation) {
    s = act(s, a).setup;
    pages.push(s.page);
  }
  assert.deepEqual(pages, ['keyboard', 'option', 'option', 'product-key', 'product-key', 'license', 'location']);
  assert.equal(setupView(s).title, 'Select location to install Windows 11');
});

test('Next waits on each page: the "everything will be deleted" box, then a key', () => {
  const option = run(openSetup(CHAI, opts), next, next).setup;
  assert.equal(setupView(option).canNext, false);
  assert.equal(act(option, next).setup.page, 'option');
  const key = run(option, { type: 'agree', on: true }, next).setup;
  assert.equal(key.page, 'product-key');
  assert.equal(setupView(key).canNext, false);
  const typed = act(key, { type: 'enter-key' }).setup;
  assert.equal(setupView(typed).key, STICKER_KEY);
  assert.equal(setupView(typed).canNext, true);
});

test('no key: "I don\'t have a product key" opens Select image; Next waits for an edition; Back returns there', () => {
  const noKey = { ...CHAI, productKey: false };
  const key = run(openSetup(noKey, opts), next, next, { type: 'agree', on: true }, next).setup;
  assert.equal(act(key, { type: 'enter-key' }).setup.keyEntered, false, 'nothing on the sticker to enter');
  const image = act(key, { type: 'no-key' }).setup;
  assert.equal(image.page, 'image');
  assert.equal(setupView(image).canNext, false);
  const license = run(image, { type: 'pick-edition', edition: 'Windows 11 Home' }, next).setup;
  assert.equal(license.page, 'license');
  assert.equal(act(license, { type: 'back' }).setup.page, 'image');
});

test('Decline on the license goes back to the first page', () => {
  const license = run(openSetup(CHAI, opts), ...toLocation.slice(0, -1)).setup;
  assert.equal(license.page, 'license');
  assert.equal(act(license, { type: 'decline' }).setup.page, 'language');
});

test("the table Setup finds on Lung Chai's PC: the USB is Disk 0, then System Reserved and C: on Disk 1", () => {
  const v = setupView(run(openSetup(CHAI, opts), ...toLocation).setup);
  assert.deepEqual(
    v.rows.map((r) => [r.name, r.total, r.type]),
    [
      ['Disk 0 Partition 1: ESD-USB', '14.9 GB', 'Primary'],
      ['Disk 1 Partition 1: System Reserved', '50.0 MB', 'System'],
      ['Disk 1 Partition 2', '465.6 GB', 'Primary'],
    ],
  );
  assert.equal(v.canNext, false, 'nothing selected');
});

test('an empty disk is one Unallocated Space line; a GPT disk with Windows has four partitions', () => {
  assert.deepEqual(
    partsOf(healthyMachine('classic')).map((p) => p.name),
    ['Disk 0 Partition 1: ESD-USB', 'Disk 1 Unallocated Space'],
  );
  const gpt = partsOf({ ...healthyMachine('classic'), diskHasData: true }).map((p) => p.type);
  assert.deepEqual(gpt, ['Primary', 'System', 'MSR (Reserved)', 'Primary', 'Recovery']);
});

test('the red text: any line of an MBR disk on a UEFI PC is refused, and Next stays off', () => {
  const loc = run(openSetup(CHAI, opts), ...toLocation).setup;
  for (const id of ['1-1', '1-2']) {
    const s = act(loc, { type: 'select', id }).setup;
    assert.match(locationError(s) ?? '', /MBR partition table\. On EFI systems, Windows can only be installed to GPT disks\./);
    assert.equal(setupView(s).canNext, false);
  }
});

test('the textbook fix: ask about the backup, Delete both partitions, pick the free space: installs, disk made GPT', () => {
  const { setup, effects } = run(openSetup(CHAI, opts), ...toLocation, { type: 'backup-confirmed' }, ...del('1-2'), ...del('1-1'), ...finish);
  assert.deepEqual(effects, [{ type: 'installed', edition: 'Windows 11 Home', activateLater: false, wrongEdition: false, diskStyle: 'gpt' }]);
  assert.equal(setup.page, 'done');
});

test('deleting only C: leaves System Reserved, so the free space is still on an MBR disk: red text', () => {
  const s = run(openSetup(CHAI, opts), ...toLocation, { type: 'backup-confirmed' }, ...del('1-2')).setup;
  assert.deepEqual(
    setupView(s).rows.map((r) => r.name),
    ['Disk 0 Partition 1: ESD-USB', 'Disk 1 Partition 1: System Reserved', 'Disk 1 Unallocated Space'],
  );
  assert.equal(s.selected, '1-free');
  assert.notEqual(locationError(s), null);
  assert.equal(setupView(s).canNext, false);
});

test('Format is not the fix: the partition table stays MBR, so the red text stays', () => {
  const s = run(
    openSetup(CHAI, opts),
    ...toLocation,
    { type: 'backup-confirmed' },
    { type: 'select', id: '1-2' },
    { type: 'format' },
    { type: 'ok' },
  ).setup;
  assert.deepEqual(
    setupView(s).rows.map((r) => [r.name, r.type, r.free]),
    [
      ['Disk 0 Partition 1: ESD-USB', 'Primary', '9.3 GB'],
      ['Disk 1 Partition 1: System Reserved', 'System', '18.0 MB'],
      ['Disk 1 Partition 2', 'Primary', '465.6 GB'],
    ],
    'the partition is still there, now empty',
  );
  assert.notEqual(locationError(s), null);
});

test('wiping the disk before asking about a backup is one mistake, counted once; asking first is none', () => {
  const blamed = run(openSetup(CHAI, opts), ...toLocation, ...del('1-2'), ...del('1-1'), ...finish).effects;
  assert.deepEqual(
    blamed.filter((e) => e.type === 'mistake'),
    [{ type: 'mistake', reason: 'no-backup-check' }],
  );
  // System Reserved first, so C: still holds the files on the second Delete: still one mistake.
  const reservedFirst = run(openSetup(CHAI, opts), ...toLocation, ...del('1-1'), ...del('1-2')).effects;
  assert.deepEqual(reservedFirst, [{ type: 'mistake', reason: 'no-backup-check' }]);
  const formatFirst = run(openSetup(CHAI, opts), ...toLocation, { type: 'select', id: '1-2' }, { type: 'format' }, { type: 'ok' }).effects;
  assert.deepEqual(formatFirst, [{ type: 'mistake', reason: 'no-backup-check' }]);
});

test('Cancel in the confirm box changes nothing and blames nothing', () => {
  const loc = run(openSetup(CHAI, opts), ...toLocation, { type: 'select', id: '1-2' }).setup;
  const asked = act(loc, { type: 'delete' }).setup;
  assert.equal(setupView(asked).confirm?.text, 'If you delete this partition, any data stored on it will be lost.');
  assert.equal(setupView(asked).canNext, false);
  const r = act(asked, { type: 'cancel' });
  assert.deepEqual(r.setup, loc);
  assert.deepEqual(r.effects, []);
});

test('deleting the install USB (Disk 0) is a mistake: Setup loses its own files and the stick must be made again', () => {
  const loc = run(openSetup(CHAI, opts), ...toLocation).setup;
  assert.equal(locationError(act(loc, { type: 'select', id: '0-1' }).setup), "Windows can't be installed to this drive.");
  for (const action of ['delete', 'format'] as const) {
    const { setup, effects } = run(loc, { type: 'select', id: '0-1' }, { type: action }, { type: 'ok' });
    assert.equal(setup.page, 'media-error');
    assert.deepEqual(effects, [{ type: 'mistake', reason: 'deleted-installer' }, { type: 'usb-wiped' }]);
    assert.equal(setupView(setup).canNext, false);
    assert.equal(setupView(setup).canBack, false);
  }
});

test('Delete and Format do nothing on free space or with nothing selected', () => {
  const loc = run(openSetup(CHAI, opts), ...toLocation).setup;
  assert.deepEqual(act(loc, { type: 'delete' }).setup, loc);
  const empty = run(openSetup(healthyMachine('classic'), opts), ...toLocation, { type: 'select', id: '1-free' }).setup;
  assert.equal(setupView(empty).canWipe, false);
  assert.deepEqual(act(empty, { type: 'format' }).setup, empty);
});

test('no key and another edition still installs, flagged for the tech log; activation is left for later', () => {
  const noKey = { ...CHAI, productKey: false, diskHasData: false };
  const { effects } = run(
    openSetup(noKey, opts),
    next,
    next,
    { type: 'agree', on: true },
    next,
    { type: 'no-key' },
    { type: 'pick-edition', edition: 'Windows 11 Pro' },
    next,
    { type: 'accept' },
    ...finish,
  );
  assert.deepEqual(effects, [{ type: 'installed', edition: 'Windows 11 Pro', activateLater: true, wrongEdition: true, diskStyle: 'gpt' }]);
});

test('Installing takes INSTALL_MS and ignores taps meanwhile', () => {
  const ready = run(openSetup(healthyMachine('classic'), opts), ...toLocation, { type: 'select', id: '1-free' }, next).setup;
  assert.equal(ready.page, 'ready');
  const half = run(ready, { type: 'install' }, { type: 'tick', ms: INSTALL_MS / 2 }, { type: 'back' }).setup;
  assert.equal(half.page, 'installing');
  assert.equal(setupView(half).progress, 0.5);
  assert.equal(act(half, { type: 'tick', ms: INSTALL_MS / 2 }).setup.page, 'done');
});

test('a legacy PC refuses a GPT disk with Windows on it, the other way round', () => {
  const legacy = { ...healthyMachine('classic'), bootMode: 'legacy' as const, diskHasData: true };
  const s = run(openSetup(legacy, opts), ...toLocation, { type: 'select', id: '1-3' }).setup;
  assert.match(locationError(s) ?? '', /GPT partition style/);
});

test('sizes print like Setup: MB below 1 GB, GB with one decimal', () => {
  assert.equal(formatSize(50), '50.0 MB');
  assert.equal(formatSize(1024), '1.0 GB');
  assert.equal(formatSize(476837), '465.7 GB');
});
