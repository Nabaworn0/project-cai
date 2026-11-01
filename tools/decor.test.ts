// Free play's decorations (src/core/decor.ts, docs/phase3-plan.md task D): what each offers, buying (coins, rank),
// putting out and taking off, and how the save keeps them.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DecorSchema, RanksSchema } from '../src/content/schema';
import { buy, offer, place, takeOff, type DecorItem } from '../src/core/decor';
import { EMPTY, parseProgress, type Progress } from '../src/core/path';

const data = (path: string) => JSON.parse(readFileSync(new URL(`../src/content/data/${path}`, import.meta.url), 'utf8'));
const { ranks } = RanksSchema.parse(data('ranks.json'));
const decor = DecorSchema.parse(data('decor.json'));
const item = (id: string) => decor.items.find((i) => i.id === id)!;
const INTERN = 0;
const HEAD = 3;
const coins = (n: number, d: Progress['decor'] = EMPTY.decor): Progress => ({ ...EMPTY, coins: n, decor: d });

const plant = item('counter-plant');
const cat = item('counter-cat');
const trophy = item('counter-trophy');

test('four places, three to choose from in each, priced 150–600, some needing a rank', () => {
  assert.deepEqual(decor.slots.map((s) => s.id), ['sign', 'counter', 'wall', 'floor']);
  for (const s of decor.slots) assert.equal(decor.items.filter((i) => i.slot === s.id).length, 3, s.id);
  for (const i of decor.items) assert.ok(i.price >= 150 && i.price <= 600, i.id);
  assert.equal(trophy.rank, 'head');
});

test('what an item offers: put out, bought, needing a rank, short of coins, or to buy', () => {
  assert.deepEqual(offer(plant, coins(150), ranks, INTERN), { kind: 'buy' });
  assert.deepEqual(offer(plant, coins(100), ranks, INTERN), { kind: 'short', more: 50 });
  // The rank is checked before the coins: rich enough is not enough.
  const locked = offer(trophy, coins(9999), ranks, INTERN);
  assert.equal(locked.kind, 'locked');
  assert.equal(locked.kind === 'locked' && locked.rank.id, 'head');
  assert.equal(offer(trophy, coins(9999), ranks, HEAD - 1).kind, 'locked', 'one rank short');
  assert.deepEqual(offer(trophy, coins(600), ranks, HEAD), { kind: 'buy' });
  assert.deepEqual(offer(plant, coins(0, { owned: ['counter-plant'], placed: {} }), ranks, INTERN), { kind: 'owned' });
  assert.deepEqual(offer(plant, coins(0, { owned: ['counter-plant'], placed: { counter: 'counter-plant' } }), ranks, INTERN), { kind: 'placed' });
});

test('buying takes the price, keeps the item and puts it out in its place (instead of what was there)', () => {
  const a = buy(coins(500), plant, ranks, INTERN);
  assert.equal(a.coins, 350);
  assert.deepEqual(a.decor, { owned: ['counter-plant'], placed: { counter: 'counter-plant' } });
  const b = buy(a, cat, ranks, INTERN);
  assert.equal(b.coins, 50);
  assert.deepEqual(b.decor, { owned: ['counter-plant', 'counter-cat'], placed: { counter: 'counter-cat' } });
  // Another place is left as it is.
  const poster = item('wall-poster');
  const c = buy({ ...b, coins: 150 }, poster, ranks, INTERN);
  assert.deepEqual(c.decor.placed, { counter: 'counter-cat', wall: 'wall-poster' });
  assert.equal(c.coins, 0);
});

test('nothing is bought without the coins or the rank, or twice', () => {
  const poor = coins(149);
  assert.equal(buy(poor, plant, ranks, INTERN), poor);
  const low = coins(9999);
  assert.equal(buy(low, trophy, ranks, INTERN), low);
  const once = buy(coins(300), plant, ranks, INTERN);
  assert.equal(buy(once, plant, ranks, INTERN), once);
});

test('switching to one already bought is free; taking off keeps it bought', () => {
  const both = coins(10, { owned: ['counter-plant', 'counter-cat'], placed: { counter: 'counter-cat' } });
  const p = place(both, plant);
  assert.equal(p.coins, 10);
  assert.deepEqual(p.decor.placed, { counter: 'counter-plant' });
  const off = takeOff(p, 'counter');
  assert.deepEqual(off.decor, { owned: ['counter-plant', 'counter-cat'], placed: {} });
  assert.equal(takeOff(off, 'counter'), off);
  // Not bought: not put out.
  const none = coins(9999);
  assert.equal(place(none, plant as DecorItem), none);
});

test('the save keeps what was bought and put out; an item put out but never bought is dropped', () => {
  const d = { owned: ['counter-plant', 'wall-clock'], placed: { counter: 'counter-plant', wall: 'wall-clock' } };
  assert.deepEqual(parseProgress(JSON.stringify({ decor: d })).decor, d);
  assert.deepEqual(parseProgress('{}').decor, EMPTY.decor);
  assert.deepEqual(parseProgress(JSON.stringify({ decor: { owned: 'x', placed: [] } })).decor, EMPTY.decor);
  assert.deepEqual(parseProgress(JSON.stringify({ decor: { owned: ['wall-clock'], placed: { counter: 'counter-cat', wall: 'wall-clock', sign: 3 } } })).decor, {
    owned: ['wall-clock'],
    placed: { wall: 'wall-clock' },
  });
});
