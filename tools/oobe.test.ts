// npm run test:unit — Windows 11 first-time setup (src/core/oobe.ts, case 5): the pages in order, the
// customer signing in themself, the account traps, the name rules, privacy and the offers.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  act,
  CUSTOMER_MS,
  FINISHING_MS,
  nameError,
  oobeView,
  openOobe,
  UPDATES_MS,
  type Oobe,
  type OobeAction,
  type OobeEffect,
} from '../src/core/oobe';

function run(start: Oobe, ...actions: OobeAction[]): { oobe: Oobe; effects: OobeEffect[] } {
  let oobe = start;
  const effects: OobeEffect[] = [];
  for (const a of actions) {
    const r = act(oobe, a);
    oobe = r.oobe;
    effects.push(...r.effects);
  }
  return { oobe, effects };
}

const home = () => openOobe('Windows 11 Home');
const pro = () => openOobe('Windows 11 Pro');
const tick = (ms: number): OobeAction => ({ type: 'tick', ms });
/** Thailand, US keyboard, Thai Kedmanee added, cable in, updates checked. */
const TO_NAME: OobeAction[] = [
  { type: 'pick-region', region: 'Thailand' },
  { type: 'yes' },
  { type: 'yes' },
  { type: 'add-layout' },
  { type: 'pick-layout', layout: 'Thai Kedmanee' },
  { type: 'plug-cable' },
  { type: 'next' },
  tick(UPDATES_MS),
];
const NAMED: OobeAction[] = [...TO_NAME, { type: 'name', value: 'LAB-PC01' }, { type: 'next' }];
/** The customer signs in and makes the PIN; the PC comes back on the privacy page. */
const CUSTOMER: OobeAction[] = [{ type: 'hand-over' }, tick(CUSTOMER_MS), tick(CUSTOMER_MS)];
const TO_END: OobeAction[] = [{ type: 'accept' }, { type: 'skip' }, { type: 'skip' }, { type: 'skip' }, tick(FINISHING_MS)];

test('Home: the pages in the real order, up to the desktop, without "personal or work"', () => {
  const pages: string[] = [];
  let o = home();
  for (const a of [...NAMED, ...CUSTOMER, ...TO_END]) {
    if (pages.at(-1) !== o.page) pages.push(o.page);
    o = act(o, a).oobe;
  }
  pages.push(o.page);
  assert.deepEqual(pages, [
    'region',
    'keyboard',
    'second-keyboard',
    'network',
    'updates',
    'name',
    'account',
    'pin',
    'privacy',
    'customize',
    'phone',
    'onedrive',
    'finishing',
    'desktop',
  ]);
});

test('the desktop effect reports what was chosen: Thailand, a Thai keyboard, the name, nothing extra', () => {
  const r = run(home(), ...NAMED, ...CUSTOMER, ...TO_END);
  const desktop = r.effects.find((e) => e.type === 'desktop');
  assert.deepEqual(desktop, {
    type: 'desktop',
    result: {
      region: 'Thailand',
      thaiKeyboard: true,
      deviceName: 'LAB-PC01',
      setupType: null,
      privacyAsked: false,
      privacy: { location: true, 'find-device': true, diagnostic: true, inking: true, tailored: true, ads: true },
      extras: [],
    },
  });
  assert.deepEqual(
    r.effects.filter((e) => e.type !== 'desktop'),
    [{ type: 'handed-over' }, { type: 'handed-back' }],
  );
});

test('Pro asks "personal or work or school" after the name; Next waits for a choice', () => {
  const at = run(pro(), ...NAMED).oobe;
  assert.equal(at.page, 'setup-type');
  assert.equal(run(at, { type: 'next' }).oobe.page, 'setup-type');
  const r = run(at, { type: 'pick-setup-type', setupType: 'personal' }, { type: 'next' });
  assert.equal(r.oobe.page, 'account');
  assert.equal(run(r.oobe, ...CUSTOMER, ...TO_END).effects.at(-1)!.type, 'desktop');
});

test("the customer signs in and makes the PIN themself; the technician's taps do nothing meanwhile", () => {
  const account = run(home(), ...NAMED).oobe;
  const handed = run(account, { type: 'hand-over' });
  assert.equal(handed.oobe.holder, 'customer');
  assert.ok(oobeView(handed.oobe).customerTyping);
  assert.equal(run(handed.oobe, { type: 'type-for-customer' }, { type: 'ask-password' }, { type: 'next' }).effects.length, 0);
  const half = run(handed.oobe, tick(CUSTOMER_MS / 2)).oobe;
  assert.equal(half.page, 'account');
  assert.equal(oobeView(half).progress, 0.5);
  const pin = run(half, tick(CUSTOMER_MS / 2)).oobe;
  assert.deepEqual([pin.page, pin.holder], ['pin', 'customer']);
  const back = run(pin, tick(CUSTOMER_MS));
  assert.deepEqual([back.oobe.page, back.oobe.holder], ['privacy', 'tech']);
  assert.deepEqual(back.effects, [{ type: 'handed-back' }]);
});

test('trap: typing the account for the customer, or asking their password: one mistake each, once, and the page waits', () => {
  const account = run(home(), ...NAMED).oobe;
  const typed = run(account, { type: 'type-for-customer' }, { type: 'type-for-customer' });
  assert.deepEqual(typed.effects, [{ type: 'mistake', reason: 'typed-for-customer' }]);
  assert.equal(typed.oobe.page, 'account');
  const asked = run(typed.oobe, { type: 'ask-password' }, { type: 'ask-password' });
  assert.deepEqual(asked.effects, [{ type: 'mistake', reason: 'asked-password' }]);
  assert.equal(run(asked.oobe, { type: 'next' }, { type: 'skip' }).oobe.page, 'account', 'no way round the customer');
  assert.equal(run(asked.oobe, ...CUSTOMER).oobe.page, 'privacy');
});

test('device names follow the three rules on the page: not digits only, 15 at most, only hyphen, dashes and underscore; Skip leaves Windows to name it', () => {
  assert.equal(nameError('LAB-PC01'), null);
  assert.equal(nameError('LAB_PC–01'), null);
  assert.equal(nameError('A23456789012345'), null);
  assert.equal(nameError('A234567890123456'), 'length');
  assert.equal(nameError('LAB PC01'), 'chars');
  assert.equal(nameError('LAB_PC#1'), 'chars');
  assert.equal(nameError('ห้อง1'), 'chars');
  assert.equal(nameError('12345'), 'numbers');
  const at = run(home(), ...TO_NAME).oobe;
  assert.equal(at.page, 'name');
  assert.equal(oobeView(at).canNext, false, 'empty');
  const bad = run(at, { type: 'name', value: 'LAB PC01' }, { type: 'next' }).oobe;
  assert.equal(bad.page, 'name');
  assert.equal(oobeView(bad).nameError, 'chars');
  const skipped = run(bad, { type: 'skip' }, ...CUSTOMER, ...TO_END).effects.find((e) => e.type === 'desktop');
  assert.equal(skipped?.type === 'desktop' && skipped.result.deviceName, null);
});

test('the network page needs the cable (the lab PC has no Wi-Fi); "Checking for updates" moves on by itself', () => {
  const net = run(home(), ...TO_NAME.slice(0, 5)).oobe;
  assert.equal(net.page, 'network');
  assert.equal(run(net, { type: 'next' }).oobe.page, 'network');
  const updates = run(net, { type: 'plug-cable' }, { type: 'next' }).oobe;
  assert.equal(updates.page, 'updates');
  assert.equal(run(updates, tick(UPDATES_MS - 1)).oobe.page, 'updates');
  assert.equal(run(updates, tick(UPDATES_MS - 1), tick(1)).oobe.page, 'name');
});

test('keyboards: Skip adds nothing (no Thai); Thai as the first layout counts; the first layout is not added twice', () => {
  const second = run(home(), { type: 'yes' }, { type: 'yes' }).oobe;
  assert.equal(second.page, 'second-keyboard');
  const skipped = run(second, { type: 'skip' }).oobe;
  assert.deepEqual([skipped.page, skipped.secondLayout], ['network', null]);
  const end = (o: Oobe) =>
    run(o, { type: 'plug-cable' }, { type: 'next' }, tick(UPDATES_MS), { type: 'skip' }, ...CUSTOMER, ...TO_END).effects.at(-1)!;
  const noThai = end(skipped);
  assert.ok(noThai.type === 'desktop' && !noThai.result.thaiKeyboard);
  const thaiFirst = run(home(), { type: 'yes' }, { type: 'pick-layout', layout: 'Thai Kedmanee' }, { type: 'yes' }).oobe;
  assert.equal(run(thaiFirst, { type: 'add-layout' }, { type: 'pick-layout', layout: 'Thai Kedmanee' }).oobe.page, 'second-keyboard');
  const thai = end(run(thaiFirst, { type: 'skip' }).oobe);
  assert.ok(thai.type === 'desktop' && thai.result.thaiKeyboard);
  assert.equal(run(second, { type: 'pick-layout', layout: 'Thai Kedmanee' }).oobe.secondLayout, null, 'the list opens with Add layout');
});

test('Back on the first pages only; the region is kept', () => {
  const second = run(home(), { type: 'pick-region', region: 'Thailand' }, { type: 'yes' }, { type: 'yes' }).oobe;
  const region = run(second, { type: 'back' }, { type: 'back' }).oobe;
  assert.deepEqual([region.page, region.region], ['region', 'Thailand']);
  assert.equal(oobeView(region).canBack, false);
  const name = run(home(), ...TO_NAME).oobe;
  assert.equal(run(name, { type: 'back' }).oobe.page, 'name');
});

test('privacy: switches start on Yes and toggle; asking the customer is noted once; Accept moves on', () => {
  const privacy = run(home(), ...NAMED, ...CUSTOMER).oobe;
  assert.equal(privacy.page, 'privacy');
  const r = run(privacy, { type: 'toggle', id: 'ads' }, { type: 'toggle', id: 'location' }, { type: 'ask-privacy' }, { type: 'ask-privacy' });
  assert.deepEqual(r.effects, [{ type: 'privacy-asked' }]);
  assert.equal(r.oobe.privacy.ads, false);
  assert.equal(r.oobe.privacy.location, false);
  assert.equal(r.oobe.privacy.diagnostic, true);
  const end = run(r.oobe, ...TO_END).effects.at(-1)!;
  assert.ok(end.type === 'desktop' && end.result.privacyAsked && !end.result.privacy.ads);
});

test('offers taken instead of skipped are noted; Accept elsewhere does nothing', () => {
  const offers = run(home(), ...NAMED, ...CUSTOMER, { type: 'accept' }).oobe;
  assert.equal(offers.page, 'customize');
  const r = run(offers, { type: 'accept' }, { type: 'skip' }, { type: 'accept' }, tick(FINISHING_MS));
  const end = r.effects.at(-1)!;
  assert.ok(end.type === 'desktop');
  assert.deepEqual(end.type === 'desktop' && end.result.extras, ['customize', 'onedrive']);
  assert.equal(run(home(), { type: 'accept' }).oobe.page, 'region');
});

test('"This might take a few minutes" waits, then the desktop; the desktop takes no more actions', () => {
  const finishing = run(home(), ...NAMED, ...CUSTOMER, ...TO_END.slice(0, 4)).oobe;
  assert.equal(finishing.page, 'finishing');
  assert.equal(oobeView(run(finishing, tick(FINISHING_MS / 2)).oobe).progress, 0.5);
  const desktop = run(finishing, tick(FINISHING_MS)).oobe;
  assert.equal(desktop.page, 'desktop');
  for (const a of [{ type: 'next' }, { type: 'skip' }, { type: 'accept' }, tick(99999)] as OobeAction[]) {
    assert.deepEqual(act(desktop, a), { oobe: desktop, effects: [] });
  }
});

test('random taps never skip the customer or reach the desktop without the hand-over', () => {
  const all: OobeAction[] = [
    { type: 'yes' },
    { type: 'next' },
    { type: 'back' },
    { type: 'skip' },
    { type: 'accept' },
    { type: 'add-layout' },
    { type: 'plug-cable' },
    { type: 'name', value: 'PC1' },
    { type: 'pick-setup-type', setupType: 'work' },
    { type: 'type-for-customer' },
    { type: 'ask-password' },
    { type: 'toggle', id: 'ads' },
    tick(5000),
  ];
  let seed = 7;
  for (let round = 0; round < 200; round++) {
    let o = round % 2 ? pro() : home();
    for (let i = 0; i < 60; i++) {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      o = act(o, all[seed % all.length]!).oobe;
      assert.notEqual(o.page, 'pin');
      assert.notEqual(o.page, 'desktop');
    }
  }
});
