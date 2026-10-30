// The step-ordering game (docs/order-plan.md, approved 29 Oct 2026). Pure data in, data out.
// Part 1, colour hints: a round's steps are dealt in a shuffled row, the learner taps them into slots and checks;
// each slot is marked right, near (one slot off) or off. Five checks a round, a hint from the senior after two.
// Part 2, the boss belt: the full sequence rides a belt with traps mixed in; tap the step that comes next before
// it falls off the end. Time is passed in (tick), so a seed gives the same belt everywhere and tests can drive it.

import { createRng } from './rng';

export const MAX_TRIES = 5;
/** The senior starts hinting once this many checks have failed. */
export const HINT_AFTER = 2;

export type Mark = 'right' | 'near' | 'off';

/** Per slot: the step is where it belongs, one slot away, or further (or not a step of this round). */
export function marks(answer: readonly string[], guess: readonly string[]): Mark[] {
  return guess.map((id, k) => {
    const at = answer.indexOf(id);
    if (at < 0) return 'off';
    const d = Math.abs(at - k);
    return d === 0 ? 'right' : d === 1 ? 'near' : 'off';
  });
}

export interface Round {
  /** The round's steps in the shuffled order they were dealt. */
  deck: string[];
  /** The row being built: a step id per slot, or null while empty. */
  slots: (string | null)[];
  /** Every check so far: the row as it was, and its marks. */
  tries: { guess: string[]; marks: Mark[] }[];
}

/** A new round: the steps dealt in an order that is never already the answer. */
export function deal(answer: readonly string[], seed: string): Round {
  const rng = createRng(`order:${seed}`);
  const shuffled = rng.shuffle(answer);
  // Shuffled back into order: turned one slot round instead.
  const deck = shuffled.join() === answer.join() ? [...shuffled.slice(1), shuffled[0]!] : shuffled;
  return { deck, slots: answer.map(() => null), tries: [] };
}

/** Puts a dealt step into the first empty slot (nothing happens if it is already placed or the row is full). */
export function place(r: Round, id: string): Round {
  const k = r.slots.indexOf(null);
  if (k < 0 || !r.deck.includes(id) || r.slots.includes(id)) return r;
  return { ...r, slots: r.slots.map((s, i) => (i === k ? id : s)) };
}

/** Takes the step out of a slot, back to the dealt cards. */
export function lift(r: Round, slot: number): Round {
  if (r.slots[slot] == null) return r;
  return { ...r, slots: r.slots.map((s, i) => (i === slot ? null : s)) };
}

export const full = (r: Round) => r.slots.every((s) => s !== null);
export const solved = (r: Round) => r.tries.length > 0 && r.tries.at(-1)!.marks.every((m) => m === 'right');
/** Solved, or out of checks: the senior then shows the answer. */
export const over = (r: Round) => solved(r) || r.tries.length >= MAX_TRIES;

/** The row is just as it was at the last check, so checking again would only use up a try. */
export const unchanged = (r: Round) => r.tries.length > 0 && r.tries.at(-1)!.guess.join() === r.slots.join();

/** Marks the row as it stands; only a full row that changed since the last check, and only while the round is
 *  not over. The cards stay put. */
export function check(r: Round, answer: readonly string[]): Round {
  if (!full(r) || over(r) || unchanged(r)) return r;
  const guess = r.slots as string[];
  return { ...r, tries: [...r.tries, { guess: [...guess], marks: marks(answer, guess) }] };
}

/** The step the senior hints at once HINT_AFTER checks have failed: the one that belongs in the first slot that
 *  was still wrong at the last check. */
export function hintFor(r: Round, answer: readonly string[]): string | null {
  if (r.tries.length < HINT_AFTER || over(r)) return null;
  const k = r.tries.at(-1)!.marks.findIndex((m) => m !== 'right');
  return k < 0 ? null : answer[k]!;
}

// The boss belt. Positions are in belt widths: a card comes on at 0 and falls off at 1.

export const HEARTS = 3;
/** Belt widths a second: crossing in 10 s, or about 17 s in slow mode. */
export const SPEED = { normal: 0.1, slow: 0.06 } as const;
/** Each right tap speeds the belt up a little, up to this much over its start. */
const SPEED_UP = 1.03;
const SPEED_MAX = 1.6;
/** Space between cards coming on. */
export const GAP = 0.25;
/** The step needed next comes on at least once in this many cards. */
const NEEDED_EVERY = 3;
/** Longest step of time taken at once, so coming back to a hidden tab does not drop every card at once. */
export const MAX_TICK_MS = 250;

export interface BeltCard {
  key: number;
  id: string;
  /** How far along the belt (0 came on, 1 falls off). */
  x: number;
}

export interface Belt {
  seed: string;
  seq: readonly string[];
  traps: readonly string[];
  /** Index in `seq` of the step needed next. */
  at: number;
  cards: BeltCard[];
  hearts: number;
  /** Hearts lost so far. */
  lost: number;
  combo: number;
  bestCombo: number;
  slow: boolean;
  /** Speed over the mode's start speed (grows with right taps). */
  pace: number;
  /** Distance travelled since the last card came on. */
  sinceSpawn: number;
  /** Cards that came on so far (their keys, and the dice for each). */
  spawned: number;
  /** Cards since the step needed next last came on. */
  sinceNeeded: number;
}

export type BeltEvent =
  | { kind: 'right'; id: string }
  | { kind: 'early'; id: string; needed: string }
  | { kind: 'trap'; id: string }
  | { kind: 'missed'; id: string }
  | { kind: 'done' }
  | { kind: 'out' };

export const needed = (b: Belt) => b.seq[b.at];
export const beltDone = (b: Belt) => b.at >= b.seq.length;
export const beltOut = (b: Belt) => b.hearts <= 0;
export const speed = (b: Belt) => (b.slow ? SPEED.slow : SPEED.normal) * b.pace;

/** The belt's full sequence: the first round with step `expand` opened up into round `into`'s steps. */
export function bossSequence(rounds: readonly { id: string; steps: readonly { id: string }[] }[], boss: { expand: string; into: string }): string[] {
  const into = rounds.find((r) => r.id === boss.into)!.steps.map((s) => s.id);
  return rounds[0]!.steps.flatMap((s) => (s.id === boss.expand ? into : [s.id]));
}

export function startBelt(seq: readonly string[], traps: readonly string[], seed: string, slow: boolean): Belt {
  const b: Belt = {
    seed,
    seq,
    traps,
    at: 0,
    cards: [],
    hearts: HEARTS,
    lost: 0,
    combo: 0,
    bestCombo: 0,
    slow,
    pace: 1,
    sinceSpawn: 0,
    spawned: 0,
    // The first card is the first step, so the run opens with something to tap.
    sinceNeeded: NEEDED_EVERY - 1,
  };
  return spawn(b, 0);
}

export const setSlow = (b: Belt, slow: boolean): Belt => ({ ...b, slow });

/** One more card at position `x`: the step needed next if it is due (or by chance), else a later step or a trap
 *  not already on the belt. */
function spawn(b: Belt, x: number): Belt {
  const rng = createRng(`belt:${b.seed}:${b.spawned}`);
  const on = new Set(b.cards.map((c) => c.id));
  const want = needed(b);
  const others = [...b.seq.slice(b.at + 1, b.at + 5), ...b.traps].filter((id) => !on.has(id));
  let id: string | undefined;
  if (want !== undefined && !on.has(want) && (b.sinceNeeded >= NEEDED_EVERY - 1 || others.length === 0 || rng.chance(0.4))) id = want;
  else if (others.length) id = rng.pick(others);
  if (id === undefined) return b;
  return {
    ...b,
    cards: [...b.cards, { key: b.spawned, id, x }],
    spawned: b.spawned + 1,
    sinceNeeded: id === want ? 0 : b.sinceNeeded + 1,
  };
}

const loseHeart = (b: Belt): Belt => ({ ...b, hearts: b.hearts - 1, lost: b.lost + 1, combo: 0 });

/** Time passes: cards move along, the needed step falling off costs a heart, new cards come on. */
export function tick(b: Belt, ms: number): { belt: Belt; events: BeltEvent[] } {
  if (beltDone(b) || beltOut(b) || ms <= 0) return { belt: b, events: [] };
  const dx = (speed(b) * Math.min(ms, MAX_TICK_MS)) / 1000;
  const events: BeltEvent[] = [];
  let next: Belt = { ...b, cards: b.cards.map((c) => ({ ...c, x: c.x + dx })) };
  for (const c of next.cards.filter((c) => c.x >= 1)) {
    if (c.id === needed(next)) {
      next = loseHeart(next);
      events.push({ kind: 'missed', id: c.id });
    }
  }
  next = { ...next, cards: next.cards.filter((c) => c.x < 1), sinceSpawn: next.sinceSpawn + dx };
  // One card at most: a tick moves far less than GAP (MAX_TICK_MS).
  if (next.sinceSpawn >= GAP) {
    next = { ...next, sinceSpawn: next.sinceSpawn - GAP };
    next = spawn(next, next.sinceSpawn);
  }
  if (beltOut(next)) events.push({ kind: 'out' });
  return { belt: next, events };
}

/** A card is tapped: the needed step moves the job on; anything else costs a heart. Either way it leaves the belt. */
export function tap(b: Belt, key: number): { belt: Belt; events: BeltEvent[] } {
  const card = b.cards.find((c) => c.key === key);
  if (!card || beltDone(b) || beltOut(b)) return { belt: b, events: [] };
  const rest = { ...b, cards: b.cards.filter((c) => c.key !== key) };
  if (card.id === needed(b)) {
    const combo = b.combo + 1;
    const belt = { ...rest, at: b.at + 1, combo, bestCombo: Math.max(b.bestCombo, combo), pace: Math.min(b.pace * SPEED_UP, SPEED_MAX) };
    return { belt, events: beltDone(belt) ? [{ kind: 'right', id: card.id }, { kind: 'done' }] : [{ kind: 'right', id: card.id }] };
  }
  const belt = loseHeart(rest);
  const why: BeltEvent = b.traps.includes(card.id) ? { kind: 'trap', id: card.id } : { kind: 'early', id: card.id, needed: needed(b)! };
  return { belt, events: beltOut(belt) ? [why, { kind: 'out' }] : [why] };
}

// The result kept for the learning path and the teacher's page.

export interface OrderResult {
  /** Checks used in each round of part 1. */
  tries: number[];
  /** Whether each round was solved (not shown the answer). */
  solved: boolean[];
  /** Hearts lost on the boss run that finished. */
  lost: number;
}

/** ⭐ the boss finished · ⭐ every round solved within 3 checks (a round not solved used all 5) · ⭐ at most one
 *  heart lost on the boss. */
export function orderStars(r: OrderResult): number {
  return 1 + (r.tries.every((t) => t <= 3) ? 1 : 0) + (r.lost <= 1 ? 1 : 0);
}
