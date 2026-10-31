// npm run test:unit — the class link and when results are sent to the teacher's sheet (src/core/sync.ts).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY, recordCase, type Progress } from '../src/core/path';
import {
  classFromQuery,
  classUrl,
  deploymentFrom,
  due,
  endpoint,
  NOT_SENT,
  parseClass,
  parseSync,
  payload,
  readRequest,
  received,
  sheetClasses,
  sheetFiles,
  signature,
  validClassName,
} from '../src/core/sync';

const TO = 'AKfycbx_abcdefghijklmnopqrstuvwxyz0123456789-XY';
const learner = { name: 'สมชาย ใจดี', room: 'ปวช.1/2', no: '7' };

test('the class link: a name and a deployment id, both well formed, or nothing', () => {
  assert.deepEqual(classFromQuery(`?class=${encodeURIComponent('ปวช.1/2')}&to=${TO}`), { name: 'ปวช.1/2', to: TO });
  assert.deepEqual(classFromQuery(`?seed=s1&class=ม.4-1&to=${TO}`)?.name, 'ม.4-1');
  for (const q of [
    `?to=${TO}`,
    '?class=a',
    `?class=&to=${TO}`,
    `?class=${'ก'.repeat(31)}&to=${TO}`,
    `?class=a<b&to=${TO}`,
    '?class=a&to=short',
    `?class=a&to=${TO}/../x`,
    `?class=a&to=${'x'.repeat(121)}`,
  ])
    assert.equal(classFromQuery(q), null, q);
  assert.equal(endpoint({ name: 'a', to: TO }), `https://script.google.com/macros/s/${TO}/exec`);
});

test('the class kept on the device is checked again when read', () => {
  assert.deepEqual(parseClass(JSON.stringify({ name: 'ปวช.1/2', to: TO })), { name: 'ปวช.1/2', to: TO });
  for (const raw of [null, 'not json', '[]', JSON.stringify({ name: 'a' }), JSON.stringify({ name: 'a', to: 'bad id' })]) assert.equal(parseClass(raw), null, String(raw));
});

test("the class's game link: the class and the sheet added, the page's own query kept, no #page", () => {
  const u = new URL(classUrl('https://x.github.io/project-cai/?unlock=all#/results', { name: 'ปวช.1/2', to: TO }));
  assert.equal(u.pathname, '/project-cai/');
  assert.equal(u.hash, '');
  assert.deepEqual([u.searchParams.get('unlock'), u.searchParams.get('class'), u.searchParams.get('to')], ['all', 'ปวช.1/2', TO]);
  assert.deepEqual(classFromQuery(u.search), { name: 'ปวช.1/2', to: TO }, 'the game reads its own link back');
});

test('something is due when there is a class, a learner, and results unlike the last ones sent', () => {
  const c = { name: 'ปวช.1/2', to: TO };
  const p: Progress = { ...EMPTY, learner };
  assert.equal(due(p, c, NOT_SENT), true);
  assert.equal(due(p, null, NOT_SENT), false, 'no class: nothing goes anywhere');
  assert.equal(due(EMPTY, c, NOT_SENT), false, 'no name yet');
  const sent = { sent: signature(p), at: 5, failed: false };
  assert.equal(due(p, c, sent), false, 'already there');
  assert.equal(due(recordCase(p, 'c1', 2), c, sent), true, 'a case played since');
  assert.equal(due({ ...p, coins: 50, reflectDraft: { self: {}, write: {}, sat: {}, suggest: 'x' } }, c, sent), false, 'coins and drafts are not sent');
});

test('the payload is the class and the results file; only {"ok": true} counts as received', () => {
  const p: Progress = { ...EMPTY, learner };
  const body = payload(p, { name: 'ปวช.1/2', to: TO }, 77);
  assert.equal(body.class, 'ปวช.1/2');
  assert.deepEqual([body.file.app, body.file.exportedAt, body.file.data.learner], ['shop-results', 77, learner]);
  assert.equal(received({ ok: true }), true);
  for (const b of [{ ok: 'true' }, { ok: false }, null, 'ok', {}]) assert.equal(received(b), false);
});

test('what was sent is remembered; anything unreadable is "not sent yet"', () => {
  assert.deepEqual(parseSync(JSON.stringify({ sent: 'abc', at: 9, failed: true })), { sent: 'abc', at: 9, failed: true });
  assert.deepEqual(parseSync(JSON.stringify({ sent: 3, at: 'x', failed: 'yes' })), NOT_SENT);
  assert.deepEqual(parseSync('{'), NOT_SENT);
  assert.deepEqual(parseSync(null), NOT_SENT);
});

test("the teacher's set-up: the web app's link or its bare id; class names the link can carry", () => {
  assert.equal(deploymentFrom(`https://script.google.com/macros/s/${TO}/exec`), TO);
  assert.equal(deploymentFrom(`  https://script.google.com/macros/s/${TO}/dev?x=1 `), TO);
  assert.equal(deploymentFrom(TO), TO);
  for (const t of ['', 'https://script.google.com/macros/s/short/exec', 'https://example.com/', `${TO}!`]) assert.equal(deploymentFrom(t), null, t);
  assert.equal(validClassName(' ปวช.1/2 '), true);
  assert.equal(validClassName('a<b'), false);
});

test("reading the sheet: the key in the body; the classes or the files; the sheet's errors in Thai", () => {
  assert.deepEqual(JSON.parse(readRequest('k1')), { action: 'classes', key: 'k1' });
  assert.deepEqual(JSON.parse(readRequest('k1', 'ปวช.1/2')), { action: 'read', key: 'k1', class: 'ปวช.1/2' });
  assert.deepEqual(sheetClasses({ ok: true, classes: ['ปวช.1/2', 'bad<', 3] }), { ok: true, value: ['ปวช.1/2'] });
  assert.deepEqual(sheetFiles({ ok: true, files: [{ app: 'x' }, '{"a":1}'] }), { ok: true, value: [{ text: '{"app":"x"}', row: null }, { text: '{"a":1}', row: null }] });
  assert.deepEqual(sheetFiles({ ok: true, files: ['a', 'b', 'c'], rows: [2, 'x', 4.5] }), {
    ok: true,
    value: [{ text: 'a', row: 2 }, { text: 'b', row: null }, { text: 'c', row: null }],
  });
  assert.deepEqual(sheetClasses({ ok: false, error: 'key' }), { ok: false, why: 'รหัสครูไม่ถูกต้อง' });
  assert.deepEqual(sheetFiles({ ok: false, error: 'class' }), { ok: false, why: 'ไม่มีห้องนี้ใน Sheet' });
  assert.equal(sheetFiles({ ok: true }).ok, false);
  assert.ok(!sheetClasses('<html>').ok && sheetClasses('<html>').ok === false);
});
