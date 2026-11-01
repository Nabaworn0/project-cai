// The teacher's page's PIN (src/teacher/pin.ts): the hash, the record, which PINs may be set, the wait after wrong ones.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failed, hashPin, makeRecord, pinIsSet, pinMatches, pinProblem, TRIES, waitLeft, WAIT_MS } from '../src/teacher/pin';
import saved from '../src/teacher/pin.json' with { type: 'json' };

test('the hash is PBKDF2-SHA256 (RFC 7914 / RFC 6070 vectors)', async () => {
  assert.equal(await hashPin('password', 'salt', 1), '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b');
  assert.equal(await hashPin('password', 'salt', 2), 'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43');
});

test('a record keeps a fresh salt and the hash, never the PIN; only its own PIN matches', async () => {
  const a = await makeRecord('ครูสมใจ99', 1000);
  const b = await makeRecord('ครูสมใจ99', 1000);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.ok(!JSON.stringify(a).includes('ครูสมใจ99'));
  assert.ok(pinIsSet(a));
  assert.equal(await pinMatches('ครูสมใจ99', a), true);
  assert.equal(await pinMatches('ครูสมใจ98', a), false);
  assert.equal(await pinMatches('', a), false);
  // No PIN set: nothing matches (the page opens with a note instead).
  assert.equal(pinIsSet({}), false);
  assert.equal(await pinMatches('ครูสมใจ99', {}), false);
});

test('the PIN kept for the site is a whole record or none', () => {
  const keys = Object.keys(saved).sort().join();
  assert.ok(keys === '' || keys === 'hash,iterations,salt', keys);
  if (keys) assert.ok((saved as { iterations: number }).iterations >= 100_000);
});

test('a PIN to set: six or more, no spaces', () => {
  assert.equal(pinProblem('12345'), 'รหัสต้องยาวอย่างน้อย 6 ตัว');
  assert.equal(pinProblem('123456'), null);
  assert.equal(pinProblem('ครูวิไล'), null);
  assert.equal(pinProblem('123 456'), 'รหัสต้องไม่มีช่องว่าง');
});

test('the fifth wrong PIN in a row starts a wait of 30 seconds, and the count starts again', () => {
  let t = { fails: 0, until: 0 };
  for (let i = 1; i < TRIES; i++) {
    t = failed(t, 1000);
    assert.deepEqual(t, { fails: i, until: 0 });
    assert.equal(waitLeft(t, 1000), 0);
  }
  t = failed(t, 1000);
  assert.deepEqual(t, { fails: 0, until: 1000 + WAIT_MS });
  assert.equal(waitLeft(t, 1000), 30);
  assert.equal(waitLeft(t, 1000 + 29_001), 1);
  assert.equal(waitLeft(t, 1000 + WAIT_MS), 0);
});
