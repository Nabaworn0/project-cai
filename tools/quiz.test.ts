// npm run test:unit — the course test (src/core/quiz.ts, docs/quiz-plan.md) on the real 10 items.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CourseTestSchema } from '../src/content/schema';
import { finish, grade, pick, resumable, shown, startTest, unanswered, type TestDraft } from '../src/core/quiz';

const items = CourseTestSchema.parse(JSON.parse(readFileSync(new URL('../src/content/data/test.json', import.meta.url), 'utf8'))).items;
const ids = items.map((i) => i.id);

/** Answers every question through what the learner sees: right ones for the first `right` positions. */
function answerAll(d: TestDraft, right: number): TestDraft {
  return d.order.reduce((acc, id, n) => {
    const s = shown(items, acc, n);
    const want = n < right ? s.item.answer : (s.item.answer + 1) % s.item.choicesTh.length;
    return pick(acc, n, acc.choices[id]!.indexOf(want));
  }, d);
}

test('the real test: 10 items, objectives 1-3, four choices each', () => {
  assert.equal(items.length, 10);
  assert.deepEqual(
    [1, 2, 3].map((o) => items.filter((i) => i.objective === o).length),
    [3, 3, 4],
  );
  assert.ok(items.every((i) => i.choicesTh.length === 4));
});

test("a sitting shuffles the items and every item's choices; the same seed gives the same sitting", () => {
  const d = startTest(items, 'pre', 's1', 0);
  assert.deepEqual([...d.order].sort(), [...ids].sort());
  assert.notDeepEqual(d.order, ids, 'the order is shuffled');
  assert.ok(
    items.some((i) => d.choices[i.id]!.join() !== '0,1,2,3'),
    'choices are shuffled',
  );
  for (const i of items) assert.deepEqual([...d.choices[i.id]!].sort(), [0, 1, 2, 3]);
  assert.deepEqual(startTest(items, 'pre', 's1', 0), d);
  assert.notDeepEqual(startTest(items, 'post', 's1', 0).order, d.order, 'the post-test is shuffled differently');
});

test('what the learner sees is the real choice text, and a pick is stored as the original choice', () => {
  const d = startTest(items, 'pre', 's2', 0);
  const s = shown(items, d, 0);
  assert.equal(s.item.id, d.order[0]);
  assert.deepEqual(
    s.choicesTh,
    d.choices[s.item.id]!.map((k) => s.item.choicesTh[k]),
  );
  assert.equal(s.picked, null);
  const d2 = pick(d, 0, 2);
  assert.equal(d2.answers[s.item.id], d.choices[s.item.id]![2]);
  assert.equal(shown(items, d2, 0).picked, 2);
  assert.equal(pick(d2, 0, 3).answers[s.item.id], d.choices[s.item.id]![3], 'an answer can be changed');
  assert.equal(pick(d, 0, 9), d, 'a position that does not exist changes nothing');
  assert.deepEqual(d.answers, {}, 'the sitting itself is not changed');
});

test('finishing needs every answer; the result scores by original answers', () => {
  const d = startTest(items, 'post', 's3', 1000);
  const partly = pick(d, 0, 0);
  assert.deepEqual(unanswered(partly), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(finish(items, partly, 2000), null);
  const done = answerAll(d, 7);
  assert.deepEqual(unanswered(done), []);
  const r = finish(items, done, 61_000)!;
  assert.equal(r.score, 7);
  assert.equal(r.total, 10);
  assert.equal(r.seconds, 60);
  assert.equal(r.at, 61_000);
  assert.deepEqual(Object.keys(r.answers).sort(), [...ids].sort());
});

test('grades per objective', () => {
  const all = Object.fromEntries(items.map((i) => [i.id, i.answer]));
  assert.deepEqual(grade(items, all), {
    score: 10,
    total: 10,
    byObjective: [
      { objective: 1, right: 3, total: 3 },
      { objective: 2, right: 3, total: 3 },
      { objective: 3, right: 4, total: 4 },
    ],
  });
  const wrongOs = { ...all, 'os-meaning': 0, 'os-server': 0 };
  assert.deepEqual(
    grade(items, wrongOs).byObjective.map((o) => o.right),
    [2, 2, 4],
  );
  assert.equal(grade(items, {}).score, 0);
});

test('a saved sitting is resumed only if it still fits the test', () => {
  const d = pick(startTest(items, 'pre', 's4', 0), 0, 1);
  // A plain boolean, so asserting "not resumable" does not narrow `d` away.
  const fits = (x: TestDraft | null, kind: 'pre' | 'post' = 'pre'): boolean => resumable(items, x, kind);
  assert.ok(fits(d));
  assert.ok(!fits(d, 'post'), 'a pre sitting is not a post sitting');
  assert.ok(!fits(null));
  assert.ok(!fits({ ...d, order: d.order.slice(1) }), 'an item missing');
  assert.ok(!fits({ ...d, order: [...d.order.slice(1), 'gone'] }), 'an unknown item');
  assert.ok(!fits({ ...d, order: [d.order[0]!, ...d.order.slice(0, -1)] }), 'an item twice');
  assert.ok(!fits({ ...d, choices: { ...d.choices, [ids[0]!]: [0, 1, 2] } }), 'a choice missing');
  assert.ok(!fits({ ...d, choices: { ...d.choices, [ids[0]!]: [0, 1, 1, 3] } }), 'a choice twice');
  assert.ok(!fits({ ...d, answers: { [ids[0]!]: 4 } }), 'an answer out of range');
});
