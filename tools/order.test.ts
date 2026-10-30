// npm run test:unit — the step-ordering game (src/core/order.ts, docs/order-plan.md) on the real content.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { OrderSchema } from '../src/content/schema';
import {
  beltDone,
  beltOut,
  bossSequence,
  check,
  deal,
  full,
  GAP,
  HEARTS,
  hintFor,
  lift,
  marks,
  MAX_TICK_MS,
  MAX_TRIES,
  needed,
  orderStars,
  over,
  place,
  setSlow,
  solved,
  speed,
  SPEED,
  startBelt,
  tap,
  tick,
  type Belt,
  type BeltEvent,
  type Round,
} from '../src/core/order';
import { EMPTY, parseProgress, recordOrder } from '../src/core/path';

const order = OrderSchema.parse(JSON.parse(readFileSync(new URL('../src/content/data/order.json', import.meta.url), 'utf8')));
const overview = order.rounds[0]!.steps.map((s) => s.id);
const setup = order.rounds[1]!.steps.map((s) => s.id);
const traps = order.traps.map((t) => t.id);
const SEQ = bossSequence(order.rounds, order.boss);

const fill = (r: Round, ids: readonly string[]) => ids.reduce(place, r);
const fresh = (r: Round) => r.slots.reduce<Round>((acc, _, k) => lift(acc, k), r);

test('the real content: 8 overview steps, 7 Setup steps, and the boss runs 14 with Setup opened up in the middle', () => {
  assert.equal(overview.length, 8);
  assert.equal(setup.length, 7);
  assert.deepEqual(SEQ, [...overview.slice(0, 4), ...setup, ...overview.slice(5)]);
  assert.equal(SEQ.length, 14);
  assert.ok(traps.length >= 4);
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

/** Runs the belt in steps of `ms`, tapping the needed step whenever it is past `tapAt` (or never). */
function play(b: Belt, { ms = 100, tapAt = 0.2, wrongEvery = 0, limit = 5000 } = {}) {
  const events: BeltEvent[] = [];
  let taps = 0;
  for (let i = 0; i < limit && !beltDone(b) && !beltOut(b); i++) {
    const t = tick(b, ms);
    b = t.belt;
    events.push(...t.events);
    const card = b.cards.find((c) => c.id === needed(b) && c.x >= tapAt);
    if (tapAt <= 1 && card) {
      taps++;
      const wrong = wrongEvery && taps % wrongEvery === 0 ? b.cards.find((c) => c.id !== needed(b)) : undefined;
      const r = tap(b, (wrong ?? card).key);
      b = r.belt;
      events.push(...r.events);
    }
  }
  return { b, events };
}

test('the belt: a learner who always taps the needed step finishes the 14 steps with every heart', () => {
  const { b, events } = play(startBelt(SEQ, traps, 'x', false));
  assert.ok(beltDone(b));
  assert.equal(b.hearts, HEARTS);
  assert.equal(b.bestCombo, 14);
  assert.deepEqual(
    events.filter((e) => e.kind === 'right').map((e) => (e as { id: string }).id),
    SEQ,
  );
  assert.equal(events.at(-1)!.kind, 'done');
  assert.ok(b.pace > 1, 'the belt sped up');
  assert.equal(tick(b, 100).belt, b, 'nothing moves once done');
});

test('while the needed step is off the belt, it comes back within three cards; traps and later steps in between', () => {
  for (const seed of ['a', 'b', 'c', 'd']) {
    let b = startBelt(SEQ, traps, seed, false);
    const seen: string[] = [];
    let gap = 0;
    let worst = 0;
    // Never tap: the needed step keeps coming back.
    for (let i = 0; i < 400 && !beltOut(b); i++) {
      const before = b;
      b = tick(b, 100).belt;
      // At most one card comes on per 100 ms (GAP / speed is 3 s).
      const c = b.cards.find((c) => c.key >= before.spawned);
      if (!c) continue;
      seen.push(c.id);
      const waiting = !before.cards.some((x) => x.id === SEQ[0] && x.x + 0.01 < 1);
      gap = c.id === SEQ[0] || !waiting ? 0 : gap + 1;
      worst = Math.max(worst, gap);
    }
    assert.ok(worst <= 2, `${seed}: ${worst} cards in a row without the needed one`);
    assert.ok(
      seen.some((id) => traps.includes(id)),
      `${seed}: a trap came`,
    );
    assert.ok(
      seen.some((id) => SEQ.slice(1).includes(id)),
      `${seed}: a later step came`,
    );
    assert.ok(
      seen.every((id) => id === SEQ[0] || traps.includes(id) || SEQ.slice(1, 5).includes(id)),
      `${seed}: only the next few steps`,
    );
  }
});

test('the belt never shows the same card twice at once, and keeps cards a gap apart', () => {
  // Many seeds, played well into the job, so twins would have had their chance.
  for (let n = 0; n < 30; n++) {
    let b = startBelt(SEQ, traps, `gap${n}`, false);
    for (let i = 0; i < 1500 && !beltOut(b) && !beltDone(b); i++) {
      b = tick(b, 50).belt;
      const card = b.cards.find((c) => c.id === needed(b) && c.x > 0.3);
      if (card) b = tap(b, card.key).belt;
      const ids = b.cards.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, `gap${n}: ${ids}`);
      const xs = b.cards.map((c) => c.x).sort((p, q) => p - q);
      for (let k = 1; k < xs.length; k++) assert.ok(xs[k]! - xs[k - 1]! >= GAP - 1e-9);
    }
  }
});

test('the needed step falling off costs a heart; three and the run is over', () => {
  const { b, events } = play(startBelt(SEQ, traps, 'y', false), { tapAt: 2 });
  assert.ok(beltOut(b));
  assert.equal(b.lost, HEARTS);
  assert.deepEqual(
    events.filter((e) => e.kind === 'missed').map((e) => (e as { id: string }).id),
    [SEQ[0], SEQ[0], SEQ[0]],
  );
  assert.equal(events.at(-1)!.kind, 'out');
  assert.equal(b.at, 0);
  assert.equal(tap(b, b.cards[0]?.key ?? 0).belt, b, 'no taps after the run is over');
});

test('tapping a trap or a step too early costs a heart and breaks the combo; the card leaves the belt', () => {
  let b = startBelt(SEQ, traps, 'z', false);
  // Run until a wrong card is on the belt, after one right tap for a combo.
  while (!b.cards.some((c) => c.id === needed(b))) b = tick(b, 100).belt;
  b = tap(b, b.cards.find((c) => c.id === needed(b))!.key).belt;
  assert.equal(b.combo, 1);
  let trap: BeltEvent[] = [];
  let early: BeltEvent[] = [];
  for (let i = 0; i < 500 && (!trap.length || !early.length) && !beltOut(b); i++) {
    b = tick(b, 100).belt;
    const t = b.cards.find((c) => traps.includes(c.id));
    const e = b.cards.find((c) => !traps.includes(c.id) && c.id !== needed(b));
    const card = !trap.length ? t : !early.length ? e : undefined;
    if (!card) continue;
    const before = b;
    const r = tap(b, card.key);
    b = r.belt;
    assert.equal(b.hearts, before.hearts - 1);
    assert.equal(b.combo, 0);
    assert.ok(!b.cards.some((c) => c.key === card.key));
    assert.equal(b.at, before.at, 'the job does not move on');
    if (traps.includes(card.id)) trap = r.events;
    else early = r.events;
  }
  assert.equal(trap[0]?.kind, 'trap');
  assert.deepEqual(early[0], { kind: 'early', id: (early[0] as { id: string }).id, needed: SEQ[1] });
});

test('slow mode runs slower; a long pause is taken a quarter second at a time', () => {
  const b = startBelt(SEQ, traps, 's', false);
  assert.equal(speed(b), SPEED.normal);
  assert.equal(speed(setSlow(b, true)), SPEED.slow);
  const moved = (ms: number) => tick(b, ms).belt.cards[0]!.x;
  assert.equal(moved(60_000), moved(MAX_TICK_MS));
  assert.equal(tick(b, 0).belt, b);
  assert.deepEqual(startBelt(SEQ, traps, 's', false), b, 'the same seed, the same belt');
  for (const seed of ['a', 'b', 'c'])
    assert.deepEqual(
      startBelt(SEQ, traps, seed, false).cards.map((c) => c.id),
      [SEQ[0]],
      'the run opens on the first step',
    );
});

test('stars: one for the boss, one for both rounds within three checks, one for at most one heart lost', () => {
  assert.equal(orderStars({ tries: [1, 3], solved: [true, true], lost: 1 }), 3);
  assert.equal(orderStars({ tries: [4, 1], solved: [true, true], lost: 0 }), 2);
  assert.equal(orderStars({ tries: [2, 5], solved: [true, false], lost: 0 }), 2, 'shown the answer');
  assert.equal(orderStars({ tries: [1, 1], solved: [true, true], lost: 2 }), 2);
  assert.equal(orderStars({ tries: [5, 5], solved: [false, false], lost: 2 }), 1);
});

test('the result is kept: the step done, the best stars, the first play as it went; saved and read back', () => {
  const first = { tries: [4, 5], solved: [true, false], lost: 2 };
  let p = recordOrder(EMPTY, first);
  assert.ok(p.done.includes('order'));
  assert.deepEqual(p.order, { stars: 1, plays: 1, first });
  p = recordOrder(p, { tries: [1, 2], solved: [true, true], lost: 0 });
  p = recordOrder(p, { tries: [3, 3], solved: [true, true], lost: 2 });
  assert.deepEqual(p.order, { stars: 3, plays: 3, first });
  assert.equal(p.done.filter((d) => d === 'order').length, 1);
  assert.deepEqual(parseProgress(JSON.stringify(p)), p);
  for (const bad of [
    { stars: 4, plays: 1, first },
    { stars: 2, plays: 0, first },
    { stars: 2, plays: 1, first: { ...first, tries: ['x'] } },
    { stars: 2, plays: 1 },
  ])
    assert.equal(parseProgress(JSON.stringify({ order: bad })).order, null, JSON.stringify(bad));
});
