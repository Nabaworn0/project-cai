// npm run test:unit — the learning path behind the menu (src/core/path.ts, docs/learning-path-plan.md).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EMPTY,
  learnerError,
  markDone,
  parseProgress,
  pathView,
  recordCase,
  recordQuiz,
  STEPS,
  type PathOptions,
  type Progress,
  type QuizResult,
  type StepId,
} from '../src/core/path';

const CASES = ['c1', 'c2', 'c3'];
const ALL: PathOptions = { built: new Set(STEPS), caseIds: CASES };
const quiz: QuizResult = { score: 6, total: 10, answers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1], at: 1 };
const status = (p: Progress, o: PathOptions, id: StepId) => pathView(p, o).steps.find((s) => s.id === id)!;
const playAll = (p: Progress) => CASES.reduce((acc, c) => recordCase(acc, c, 2), p);

test('with every step built, only the pre-test and results are open at first', () => {
  const v = pathView(EMPTY, ALL);
  assert.deepEqual(
    v.steps.map((s) => [s.id, s.status]),
    [
      ['pre', 'open'],
      ['lesson-os', 'locked'],
      ['lesson-types', 'locked'],
      ['order', 'locked'],
      ['cases', 'locked'],
      ['post', 'locked'],
      ['reflect', 'locked'],
      ['results', 'open'],
    ],
  );
  assert.deepEqual(
    v.cases.map((c) => c.status),
    ['locked', 'locked', 'locked'],
  );
  assert.deepEqual(v.next, { step: 'pre' });
});

test('after the pre-test the lessons, ordering and case 1 open; the pre-test cannot be taken again', () => {
  const p = recordQuiz(EMPTY, 'pre', quiz);
  const v = pathView(p, ALL);
  assert.deepEqual(status(p, ALL, 'pre'), { id: 'pre', status: 'done', canEnter: false });
  for (const id of ['lesson-os', 'lesson-types', 'order', 'cases'] as const) assert.equal(status(p, ALL, id).status, 'open', id);
  assert.equal(status(p, ALL, 'post').status, 'locked');
  assert.deepEqual(
    v.cases.map((c) => c.status),
    ['open', 'locked', 'locked'],
  );
  assert.deepEqual(v.next, { step: 'lesson-os' });
});

test('cases open one after another and keep the best stars', () => {
  let p = recordQuiz(EMPTY, 'pre', quiz);
  p = recordCase(p, 'c1', 3);
  p = recordCase(p, 'c1', 1);
  const v = pathView(p, ALL);
  assert.deepEqual(v.cases, [
    { id: 'c1', status: 'done', stars: 3 },
    { id: 'c2', status: 'open', stars: null },
    { id: 'c3', status: 'locked', stars: null },
  ]);
  assert.equal(p.cases.c1!.plays, 2);
});

test('"ทำต่อ" follows the recommended order, through the cases to the post-test, reflection and results', () => {
  let p = recordQuiz(EMPTY, 'pre', quiz);
  for (const id of ['lesson-os', 'lesson-types', 'order'] as const) {
    assert.deepEqual(pathView(p, ALL).next, { step: id });
    p = markDone(p, id);
  }
  for (const c of CASES) {
    assert.deepEqual(pathView(p, ALL).next, { step: 'cases', caseId: c });
    p = recordCase(p, c, 2);
  }
  assert.equal(status(p, ALL, 'cases').status, 'done');
  assert.deepEqual(pathView(p, ALL).next, { step: 'post' });
  p = recordQuiz(p, 'post', quiz);
  assert.deepEqual(status(p, ALL, 'post'), { id: 'post', status: 'done', canEnter: false });
  assert.deepEqual(pathView(p, ALL).next, { step: 'reflect' });
  p = markDone(p, 'reflect');
  assert.deepEqual(pathView(p, ALL).next, { step: 'results' });
});

test('lessons and ordering are recommended but not required for the post-test', () => {
  const p = playAll(recordQuiz(EMPTY, 'pre', quiz));
  assert.equal(status(p, ALL, 'post').status, 'open');
  assert.equal(status(p, ALL, 'reflect').status, 'locked', 'reflection waits for the post-test');
  assert.deepEqual(pathView(p, ALL).next, { step: 'lesson-os' });
});

test('finished lessons and cases can be entered again', () => {
  const p = recordCase(markDone(recordQuiz(EMPTY, 'pre', quiz), 'lesson-os'), 'c1', 0);
  assert.deepEqual(status(p, ALL, 'lesson-os'), { id: 'lesson-os', status: 'done', canEnter: true });
  assert.equal(pathView(p, ALL).cases[0]!.status, 'done');
});

test('steps not built yet are "soon" and lock nothing', () => {
  const o: PathOptions = { built: new Set<StepId>(['cases', 'results']), caseIds: CASES };
  const v = pathView(EMPTY, o);
  assert.deepEqual(status(EMPTY, o, 'pre'), { id: 'pre', status: 'soon', canEnter: false });
  assert.equal(status(EMPTY, o, 'cases').status, 'open');
  assert.equal(v.cases[0]!.status, 'open');
  assert.deepEqual(v.next, { step: 'cases', caseId: 'c1' });
  // Without a post-test, reflection would follow the cases (once it exists).
  const o2: PathOptions = { built: new Set<StepId>(['cases', 'reflect', 'results']), caseIds: CASES };
  assert.equal(status(EMPTY, o2, 'reflect').status, 'locked');
  assert.equal(status(playAll(EMPTY), o2, 'reflect').status, 'open');
});

test('?unlock=all opens every step and case, and lets the teacher retake the tests', () => {
  const o: PathOptions = { ...ALL, unlockAll: true };
  const v = pathView(recordQuiz(EMPTY, 'pre', quiz), o);
  assert.ok(v.steps.every((s) => s.canEnter));
  assert.ok(v.steps.every((s) => s.status !== 'locked'));
  assert.deepEqual(
    v.cases.map((c) => c.status),
    ['open', 'open', 'open'],
  );
});

test('a test result is kept once: the first one stands', () => {
  const p = recordQuiz(recordQuiz(EMPTY, 'pre', quiz), 'pre', { ...quiz, score: 10 });
  assert.equal(p.pre!.score, 6);
  assert.equal(markDone(markDone(EMPTY, 'order'), 'order').done.length, 1);
});

test('the name form needs a name, a class and a number 1-99', () => {
  const ok = { name: 'สมชาย ใจดี', room: 'ปวช.1/2', no: '7' };
  assert.equal(learnerError(ok), null);
  assert.match(learnerError({ ...ok, name: '  ' })!, /ชื่อ/);
  assert.match(learnerError({ ...ok, name: 'ก'.repeat(61) })!, /60/);
  assert.match(learnerError({ ...ok, room: '' })!, /ชั้น/);
  assert.match(learnerError({ ...ok, room: 'x'.repeat(21) })!, /20/);
  for (const no of ['', '0', '100', 'ก', '1.5', '-1']) assert.match(learnerError({ ...ok, no })!, /เลขที่/, no);
  assert.equal(learnerError({ ...ok, no: '99' }), null);
});

test('saved progress round-trips', () => {
  let p: Progress = { ...EMPTY, coins: 40, learner: { name: 'สมชาย ใจดี', room: 'ปวช.1/2', no: '7' } };
  p = recordCase(markDone(recordQuiz(p, 'pre', quiz), 'order'), 'c1', 3);
  assert.deepEqual(parseProgress(JSON.stringify(p)), p);
});

test('version 1 (coins only) is carried over; version 2 wins when both exist', () => {
  assert.deepEqual(parseProgress(null, '{"coins":25}'), { ...EMPTY, coins: 25 });
  assert.equal(parseProgress('{"coins":5}', '{"coins":25}').coins, 5);
});

test('broken or missing storage gives a fresh start and never throws', () => {
  for (const raw of [null, '', '{', 'null', '[]', '42', '"x"']) assert.deepEqual(parseProgress(raw), EMPTY, String(raw));
});

test('bad fields are dropped one by one, keeping the rest', () => {
  const p = parseProgress(
    JSON.stringify({
      coins: -3,
      learner: { name: '', room: 'ปวช.1/2', no: '7' },
      pre: { score: 11, total: 10, answers: [], at: 1 },
      post: { ...quiz, answers: ['a'] },
      done: ['order', 'nope', 'order', 5],
      cases: { c1: { stars: 4, plays: 1 }, c2: { stars: 2, plays: 1.5 }, c3: 'x', c4: { stars: 2, plays: 3 } },
    }),
  );
  assert.deepEqual(p, { ...EMPTY, done: ['order'], cases: { c4: { stars: 2, plays: 3 } } });
});
