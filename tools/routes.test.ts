// npm run test:unit — the pages' addresses (src/core/routes.ts, docs/pages-plan.md).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY, markDone, pathView, recordCase, recordQuiz, STEPS, type PathOptions, type Progress, type QuizResult } from '../src/core/path';
import { allowedRoute, parseRoute, ROUTES, routeHash } from '../src/core/routes';

const CASES = ['c1', 'c2'];
const BUILT: PathOptions = { built: new Set(['pre', 'lesson-os', 'lesson-types', 'order', 'cases', 'post', 'reflect']), caseIds: CASES };
const quiz: QuizResult = { score: 5, total: 10, answers: {}, at: 1, seconds: 60 };
const named: Progress = { ...EMPTY, learner: { name: 'สมชาย ใจดี', room: 'ปวช.1/2', no: '7' } };
const allowed = (p: Progress, o: PathOptions = BUILT) => ROUTES.filter((r) => allowedRoute(r, !!p.learner, pathView(p, o)) === r);

test('addresses: each page by its name, anything else is the learning page', () => {
  for (const r of ROUTES) assert.equal(parseRoute(routeHash(r)), r);
  for (const h of ['', '#', '#/', '#/nope', '#/shop/x', '#shop', '#/SHOP', '#/learn?x', '#/lesson_os', '#/lesson-'])
    assert.equal(parseRoute(h), 'learn', h);
});

test('before a name is given only the learning page opens, even with everything unlocked', () => {
  assert.deepEqual(allowed(EMPTY), ['learn']);
  assert.deepEqual(allowed(EMPTY, { ...BUILT, unlockAll: true }), ['learn']);
});

test('a page opens when its card could be tapped: the pre-test first, then the lessons and the ordering, then the shop, then the post-test, then the reflection', () => {
  assert.deepEqual(allowed(named), ['learn', 'pre']);
  let p = recordQuiz(named, 'pre', quiz);
  const learning = ['lesson-os', 'lesson-types', 'order'];
  assert.deepEqual(allowed(p), ['learn', ...learning], 'the pre-test is taken once');
  p = markDone(markDone(p, 'order'), 'lesson-os');
  assert.deepEqual(allowed(p), ['learn', ...learning], 'the shop waits for both lessons');
  p = markDone(p, 'lesson-types');
  assert.deepEqual(allowed(p), ['learn', ...learning, 'shop']);
  p = CASES.reduce((acc, c) => recordCase(acc, c, 2), p);
  assert.deepEqual(allowed(p), ['learn', 'post', ...learning, 'shop']);
  p = recordQuiz(p, 'post', quiz);
  assert.deepEqual(allowed(p), ['learn', ...learning, 'shop', 'reflect']);
  assert.deepEqual(allowed(markDone(p, 'reflect')), ['learn', ...learning, 'shop'], 'the reflection is sent once');
});

test('?unlock=all opens every page; a step not built yet stays shut', () => {
  assert.deepEqual(allowed(named, { ...BUILT, unlockAll: true }), [...ROUTES]);
  assert.deepEqual(allowed(named, { built: new Set(STEPS.filter((s) => s !== 'order')), caseIds: CASES }), ['learn', 'pre']);
  assert.deepEqual(allowed(named, { built: new Set(['cases']), caseIds: CASES }), ['learn', 'shop'], 'nothing before the shop built yet');
});
