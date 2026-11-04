// npm run test:unit — the step-ordering game (src/core/order.ts, docs/order-plan.md) on the real content.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { OrderSchema } from '../src/content/schema';
import { check, deal, full, hintFor, lift, marks, MAX_TRIES, orderStars, over, place, solved, type Round } from '../src/core/order';
import { EMPTY, parseProgress, recordOrder } from '../src/core/path';

const order = OrderSchema.parse(JSON.parse(readFileSync(new URL('../src/content/data/order.json', import.meta.url), 'utf8')));
const setup = order.rounds[0]!.steps.map((s) => s.id);
/** An eight-step row for the rules (the whole job, as the game's first round once had it). */
const overview = ['check-spec', 'backup', 'make-usb', 'bios-boot', 'run-setup', 'restart', 'oobe', 'update'];

const fill = (r: Round, ids: readonly string[]) => ids.reduce(place, r);
const fresh = (r: Round) => r.slots.reduce<Round>((acc, _, k) => lift(acc, k), r);

test('the real content: one round, the 7 steps on the Windows Setup screens', () => {
  assert.equal(order.rounds.length, 1);
  assert.equal(setup.length, 7);
});

test('marks: right in place, near one slot off, off further or not a step of the round', () => {
  assert.deepEqual(marks(['a', 'b', 'c', 'd'], ['a', 'c', 'b', 'd']), ['right', 'near', 'near', 'right']);
  assert.deepEqual(marks(['a', 'b', 'c', 'd'], ['d', 'b', 'c', 'a']), ['off', 'right', 'right', 'off']);
  assert.deepEqual(marks(['a', 'b', 'c', 'd'], ['c', 'b', 'a', 'd']), ['off', 'right', 'off', 'right'], 'two slots off');
  assert.deepEqual(marks(['a', 'b', 'c', 'd'], ['x', 'b', 'c', 'd']), ['off', 'right', 'right', 'right']);
});

test('a round is dealt shuffled, never already in order, the same for the same seed', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const r = deal(overview, seed);
    assert.notDeepEqual(r.deck, overview, seed);
    assert.deepEqual([...r.deck].sort(), [...overview].sort());
    assert.deepEqual(r.slots, Array(8).fill(null));
  }
  assert.deepEqual(deal(overview, 'x'), deal(overview, 'x'));
  // Even a two-step round, where most shuffles give the answer back.
  for (const seed of ['a', 'b', 'c']) assert.deepEqual(deal(['p', 'q'], seed).deck, ['q', 'p']);
});

test('tapping places into the first empty slot; a placed card cannot go twice; lifting frees its slot', () => {
  let r = deal(overview, 's');
  r = place(r, 'backup');
  r = place(r, 'oobe');
  assert.deepEqual(r.slots.slice(0, 3), ['backup', 'oobe', null]);
  assert.equal(place(r, 'backup'), r, 'already placed');
  assert.equal(place(r, 'not-a-step'), r, 'not dealt');
  r = lift(r, 0);
  assert.deepEqual(r.slots.slice(0, 2), [null, 'oobe']);
  assert.equal(lift(r, 0), r, 'an empty slot');
  r = place(r, 'update');
  assert.deepEqual(r.slots.slice(0, 2), ['update', 'oobe'], 'the first empty slot, even before others');
  const all = fill(fresh(r), r.deck);
  assert.ok(full(all));
  assert.equal(place(all, 'backup'), all, 'a full row');
});

test('checking: only a full row; marks are kept per check and the cards stay; solved ends the round', () => {
  let r = deal(overview, 's');
  assert.equal(check(r, overview), r, 'not full');
  const wrong = [...overview.slice(1), overview[0]!];
  r = check(fill(r, wrong), overview);
  assert.equal(r.tries.length, 1);
  assert.deepEqual(r.tries[0]!.guess, wrong);
  assert.deepEqual(r.tries[0]!.marks, marks(overview, wrong));
  assert.deepEqual(r.slots, wrong, 'the row stays to be fixed');
  assert.equal(check(r, overview), r, 'an unchanged row is not checked again');
  assert.ok(!solved(r) && !over(r));
  r = check(fill(fresh(r), overview), overview);
  assert.ok(solved(r) && over(r));
  assert.equal(check(r, overview), r, 'no more checks once solved');
});

test('five checks at most; the senior hints after two failed ones, at the first slot still wrong', () => {
  /** The answer with two neighbouring steps swapped. */
  const swapped = (k: number) => setup.map((id, i) => (i === k ? setup[k + 1]! : i === k + 1 ? setup[k]! : id));
  const retry = (r: Round, row: string[]) => check(fill(fresh(r), row), setup);
  let r = retry(deal(setup, 's'), swapped(0));
  assert.equal(hintFor(r, setup), null, 'not after one');
  // Right but the last two swapped: the first wrong slot is the sixth.
  r = retry(r, swapped(5));
  assert.equal(hintFor(r, setup), setup[5]);
  for (const k of [1, 2, 3]) r = retry(r, swapped(k));
  assert.equal(r.tries.length, 5);
  assert.equal(MAX_TRIES, 5);
  assert.ok(over(r) && !solved(r));
  assert.deepEqual(retry(r, swapped(4)).tries, r.tries, 'out of checks');
  assert.equal(hintFor(r, setup), null, 'the answer is shown instead');
});

test('stars: one for finishing, one for solving every round, one for every round within three checks', () => {
  assert.equal(orderStars({ tries: [1, 3], solved: [true, true] }), 3);
  assert.equal(orderStars({ tries: [4, 1], solved: [true, true] }), 2);
  assert.equal(orderStars({ tries: [5, 5], solved: [true, true] }), 2, 'right at the last check');
  assert.equal(orderStars({ tries: [2, 5], solved: [true, false] }), 1, 'shown the answer');
  assert.equal(orderStars({ tries: [5, 5], solved: [false, false] }), 1);
});

test('the result is kept: the step done, the best stars, the first play as it went; saved and read back', () => {
  const first = { tries: [4, 5], solved: [true, false] };
  let p = recordOrder(EMPTY, first);
  assert.ok(p.done.includes('order'));
  assert.deepEqual(p.order, { stars: 1, plays: 1, first });
  p = recordOrder(p, { tries: [1, 2], solved: [true, true] });
  p = recordOrder(p, { tries: [4, 3], solved: [true, true] });
  assert.deepEqual(p.order, { stars: 3, plays: 3, first });
  assert.equal(p.done.filter((d) => d === 'order').length, 1);
  assert.deepEqual(parseProgress(JSON.stringify(p)), p);
  // A play saved while the boss belt was still in the game (before 4 Nov 2026): its hearts lost are dropped.
  const old = { stars: 3, plays: 1, first: { ...first, lost: 2 } };
  assert.deepEqual(parseProgress(JSON.stringify({ order: old })).order, { stars: 3, plays: 1, first });
  for (const bad of [
    { stars: 4, plays: 1, first },
    { stars: 2, plays: 0, first },
    { stars: 2, plays: 1, first: { ...first, tries: ['x'] } },
    { stars: 2, plays: 1 },
  ])
    assert.equal(parseProgress(JSON.stringify({ order: bad })).order, null, JSON.stringify(bad));
});
