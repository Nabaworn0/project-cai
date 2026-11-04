// The step-ordering game (docs/order-plan.md, approved 29 Oct 2026). Pure data in, data out.
// Part 1, colour hints: a round's steps are dealt in a shuffled row, the learner taps them into slots and checks;
// each slot is marked right, near (one slot off) or off. Five checks a round, a hint from the senior after two.
// After the rounds come the stars. (A boss belt once followed the rounds; it was taken out on 4 Nov 2026.)

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


// The result kept for the learning path and the teacher's page.

export interface OrderResult {
  /** Checks used in each round. */
  tries: number[];
  /** Whether each round was solved (not shown the answer). */
  solved: boolean[];
}

/** ⭐ finished · ⭐ every round solved without the senior's answer · ⭐ every round solved within 3 checks. */
export function orderStars(r: OrderResult): number {
  return 1 + (r.solved.every(Boolean) ? 1 : 0) + (r.tries.every((t, k) => r.solved[k] && t <= 3) ? 1 : 0);
}
