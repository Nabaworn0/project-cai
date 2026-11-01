// Free play's decorations (docs/phase3-plan.md task D): bought with its coins, kept for good, and one in each of the
// shop's places at a time. Switching to one already bought is free; some need a rank before they can be bought.

import type { Decor } from '../content/schema';
import type { Progress } from './path';
import type { Rank } from './rank';

export type DecorItem = Decor['items'][number];

/** What an item offers the technician now. */
export type Offer =
  | { kind: 'placed' }
  /** Bought, not in the shop now: put it out for free. */
  | { kind: 'owned' }
  /** Needs this rank first. */
  | { kind: 'locked'; rank: Rank }
  /** Not enough coins: this many more. */
  | { kind: 'short'; more: number }
  | { kind: 'buy' };

/** `rank` is the technician's rank now, an index into `ranks` (lowest first). */
export function offer(item: DecorItem, p: Progress, ranks: readonly Rank[], rank: number): Offer {
  if (p.decor.placed[item.slot] === item.id) return { kind: 'placed' };
  if (p.decor.owned.includes(item.id)) return { kind: 'owned' };
  const needs = item.rank ? ranks.findIndex((r) => r.id === item.rank) : -1;
  if (needs > rank) return { kind: 'locked', rank: ranks[needs]! };
  if (p.coins < item.price) return { kind: 'short', more: item.price - p.coins };
  return { kind: 'buy' };
}

/** Buys the item and puts it out; unchanged if it cannot be bought now. */
export function buy(p: Progress, item: DecorItem, ranks: readonly Rank[], rank: number): Progress {
  if (offer(item, p, ranks, rank).kind !== 'buy') return p;
  return place({ ...p, coins: p.coins - item.price, decor: { ...p.decor, owned: [...p.decor.owned, item.id] } }, item);
}

/** Puts an item already bought in its place (instead of what was there). */
export function place(p: Progress, item: DecorItem): Progress {
  if (!p.decor.owned.includes(item.id)) return p;
  return { ...p, decor: { ...p.decor, placed: { ...p.decor.placed, [item.slot]: item.id } } };
}

/** Takes what is in a place back off (it stays bought). */
export function takeOff(p: Progress, slot: string): Progress {
  if (!(slot in p.decor.placed)) return p;
  const { [slot]: _gone, ...placed } = p.decor.placed;
  return { ...p, decor: { ...p.decor, placed } };
}
