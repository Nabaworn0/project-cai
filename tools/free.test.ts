// Free play (src/core/free.ts, docs/phase3-plan.md task A): which pages it has, when the class's work is over, and
// what its first save takes from the class's: only what was earned, never the learner, the tests or the reflection.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classFinished, FREE_ROUTES, freeRoute, freeStart } from '../src/core/free';
import { EMPTY, type Progress } from '../src/core/path';
import { ROUTES } from '../src/core/routes';

const sitting = { score: 8, total: 10, answers: {}, at: 1, seconds: 60 };
const reflect = { self: {}, write: {}, sat: {}, suggest: '', at: 1 };
const FINISHED: Progress = {
  ...EMPTY,
  coins: 640,
  learner: { name: 'สมชาย ใจดี', room: 'ปวช.1/2', no: '7' },
  pre: { ...sitting, score: 4 },
  post: sitting,
  done: ['lesson-os', 'lesson-types', 'order', 'reflect'],
  cases: { 'c01-boot-order': { stars: 3, plays: 2, first: 2 } },
  order: { stars: 2, plays: 1, first: { tries: [3, 4], solved: [true, true] } },
  lessons: { 'lesson-os': { at: 0, first: [1, 0] } },
  reflect: reflect as Progress['reflect'],
  cardsRead: ['boot-order'],
  seen: ['intro', 'c01-boot-order'],
};

test('free play opens its menu, the lessons, the ordering game and the shop; tests and results go to its menu', () => {
  assert.deepEqual(FREE_ROUTES, ['learn', 'lesson-os', 'lesson-types', 'order', 'shop']);
  for (const r of ROUTES) assert.equal(freeRoute(r), FREE_ROUTES.includes(r) ? r : 'learn', r);
  for (const r of ['pre', 'post', 'reflect', 'results'] as const) assert.equal(freeRoute(r), 'learn');
});

test("the class's work is over only with both the post-test and the reflection", () => {
  assert.equal(classFinished(FINISHED), true);
  assert.equal(classFinished({ ...FINISHED, reflect: null }), false);
  assert.equal(classFinished({ ...FINISHED, post: null }), false);
  assert.equal(classFinished(EMPTY), false);
});

test('a device still learning (or a new one) starts free play from nothing', () => {
  assert.deepEqual(freeStart(EMPTY), EMPTY);
  assert.deepEqual(freeStart({ ...FINISHED, reflect: null }), EMPTY);
});

test('a finished device carries over what was earned, and nothing of the learner', () => {
  const p = freeStart(FINISHED);
  assert.equal(p.coins, 640);
  assert.deepEqual(p.cases, FINISHED.cases);
  assert.deepEqual(p.order, FINISHED.order);
  assert.deepEqual(p.lessons, FINISHED.lessons);
  assert.deepEqual(p.cardsRead, ['boot-order']);
  assert.deepEqual(p.seen, ['intro', 'c01-boot-order']);
  // The steps that give cards, not the reflection.
  assert.deepEqual(p.done, ['lesson-os', 'lesson-types', 'order']);
  assert.equal(p.learner, null);
  assert.equal(p.pre, null);
  assert.equal(p.post, null);
  assert.equal(p.reflect, null);
  assert.equal(p.testDraft, null);
  assert.equal(p.reflectDraft, null);
});
