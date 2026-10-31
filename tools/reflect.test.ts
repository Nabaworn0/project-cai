// npm run test:unit — the reflection after learning (src/core/reflect.ts) and how it is saved (src/core/path.ts).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ReflectSchema } from '../src/content/schema';
import { EMPTY, parseProgress, pathView, recordReflect, type PathOptions } from '../src/core/path';
import { MAX_WRITE, MIN_WRITE, missing, NO_ANSWERS, sent, type ReflectAnswers } from '../src/core/reflect';

const R = ReflectSchema.parse(JSON.parse(readFileSync(new URL('../src/content/data/reflect.json', import.meta.url), 'utf8')));
/** Every item answered. */
const full = (): ReflectAnswers => ({
  self: Object.fromEntries(R.self.map((s, i) => [s.id, (i % 5) + 1])),
  write: Object.fromEntries(R.write.map((w) => [w.id, 'ได้เรียนรู้มาก'])),
  sat: Object.fromEntries(R.satisfaction.map((s) => [s.id, 4])),
  suggest: '',
});

test('what is still to answer, in page order; the suggestions are not needed', () => {
  assert.deepEqual(missing(R, NO_ANSWERS), [...R.self, ...R.write, ...R.satisfaction].map((i) => i.id));
  assert.deepEqual(missing(R, full()), []);
  const a = full();
  delete a.self[R.self[2]!.id];
  delete a.sat[R.satisfaction.at(-1)!.id];
  assert.deepEqual(missing(R, a), [R.self[2]!.id, R.satisfaction.at(-1)!.id]);
});

test(`a written answer needs ${MIN_WRITE} letters, spaces not counted`, () => {
  const a = full();
  const w = R.write[0]!.id;
  a.write[w] = ' ก ข ค ง  ';
  assert.deepEqual(missing(R, a), [w], 'four letters and spaces');
  a.write[w] = 'กขคงจ';
  assert.deepEqual(missing(R, a), []);
});

test("what is sent: this form's items only, the texts trimmed and cut, the time it was sent", () => {
  const a = { ...full(), suggest: `  ${'ก'.repeat(MAX_WRITE + 10)}  ` };
  a.self['old-item'] = 3;
  a.write[R.write[0]!.id] = '  เรียนสนุก  ';
  const r = sent(R, a, 1234);
  assert.equal(r.at, 1234);
  assert.equal(r.self['old-item'], undefined);
  assert.equal(r.write[R.write[0]!.id], 'เรียนสนุก');
  assert.equal(r.suggest.length, MAX_WRITE);
  assert.deepEqual(Object.keys(r.sat), R.satisfaction.map((s) => s.id));
});

test('sent once: the step is done and taken once, the draft gone; a second sending does not replace the first', () => {
  const draft = { ...EMPTY, reflectDraft: full() };
  const first = sent(R, full(), 1);
  let p = recordReflect(draft, first);
  assert.equal(p.reflect, first);
  assert.equal(p.reflectDraft, null);
  assert.ok(p.done.includes('reflect'));
  const o: PathOptions = { built: new Set(['reflect']), caseIds: [] };
  assert.deepEqual(
    pathView(p, o).steps.find((s) => s.id === 'reflect'),
    { id: 'reflect', status: 'done', canEnter: false },
    'like the tests, not taken again',
  );
  p = recordReflect(p, sent(R, full(), 2));
  assert.equal(p.reflect!.at, 1, 'the first one stands');
});

test('saved reflections and drafts are read back; broken ones are dropped', () => {
  const p = recordReflect({ ...EMPTY, reflectDraft: null }, sent(R, full(), 99));
  const back = parseProgress(JSON.stringify({ ...p, reflectDraft: full() }));
  assert.deepEqual(back.reflect, p.reflect);
  assert.deepEqual(back.reflectDraft, full());
  const bad = (x: unknown) => parseProgress(JSON.stringify({ reflect: x, reflectDraft: x }));
  for (const x of [
    { ...full(), at: 1, self: { a: 6 } },
    { ...full(), at: 1, sat: { a: 0 } },
    { ...full(), at: 1, sat: { a: 2.5 } },
    { ...full(), at: 1, write: { a: 3 } },
    { ...full(), at: 1, suggest: 'ก'.repeat(MAX_WRITE + 1) },
    { ...full(), at: 1, suggest: null },
    [1, 2],
  ]) {
    assert.equal(bad(x).reflect, null, JSON.stringify(x).slice(0, 60));
    assert.equal(bad(x).reflectDraft, null);
  }
  assert.equal(bad({ ...full() }).reflect, null, 'no time: not a sent one');
  assert.deepEqual(bad({ ...full() }).reflectDraft, full(), 'but a fine draft');
  assert.equal(parseProgress(null).reflect, null);
});
