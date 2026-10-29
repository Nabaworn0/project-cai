// The course test taken before and after learning (docs/quiz-plan.md, approved 29 Oct 2026). Pure data in,
// data out: one sitting is a TestDraft (shuffled order, shuffled choices, answers so far), kept on the device so
// leaving half way loses nothing; finishing turns it into a QuizResult for the learning path (path.ts).
// Answers are stored by item id and original choice index, so results compare across shuffles.

import { createRng } from './rng';
import type { QuizResult } from './path';

export interface TestItem {
  id: string;
  /** One of the four course objectives. */
  objective: number;
  stemTh: string;
  choicesTh: readonly string[];
  answer: number;
  explainTh: string;
}

export type TestKind = 'pre' | 'post';

export interface TestDraft {
  kind: TestKind;
  /** Item ids in the order shown. */
  order: string[];
  /** Per item, the original choice index shown in each position. */
  choices: Record<string, number[]>;
  /** Per item, the original index of the choice picked. */
  answers: Record<string, number>;
  startedAt: number;
}

/** A new sitting: items and their choices in a fresh shuffled order. */
export function startTest(items: readonly TestItem[], kind: TestKind, seed: string, now: number): TestDraft {
  const rng = createRng(`${kind}:${seed}`);
  const choices: Record<string, number[]> = {};
  for (const it of items) choices[it.id] = rng.shuffle(it.choicesTh.map((_, k) => k));
  return { kind, order: rng.shuffle(items.map((i) => i.id)), choices, answers: {}, startedAt: now };
}

/** A saved sitting still fits the items (the test may have changed since): same ids, whole choice lists. */
export function resumable(items: readonly TestItem[], d: TestDraft | null | undefined, kind: TestKind): d is TestDraft {
  if (!d || d.kind !== kind || d.order.length !== items.length) return false;
  const ids = new Set(items.map((i) => i.id));
  if (new Set(d.order).size !== d.order.length || d.order.some((id) => !ids.has(id))) return false;
  return items.every((it) => {
    const c = d.choices[it.id];
    const a = d.answers[it.id];
    const whole = !!c && c.length === it.choicesTh.length && [...c].sort((x, y) => x - y).every((v, k) => v === k);
    return whole && (a === undefined || (Number.isInteger(a) && a >= 0 && a < it.choicesTh.length));
  });
}

/** The question in position `n` with its choices in shown order. */
export function shown(items: readonly TestItem[], d: TestDraft, n: number) {
  const item = items.find((i) => i.id === d.order[n])!;
  const order = d.choices[item.id]!;
  const picked = d.answers[item.id];
  return {
    item,
    choicesTh: order.map((k) => item.choicesTh[k]!),
    /** Shown position of the picked choice, or null. */
    picked: picked === undefined ? null : order.indexOf(picked),
  };
}

/** Picks the choice shown at `position` for the question in position `n`. */
export function pick(d: TestDraft, n: number, position: number): TestDraft {
  const id = d.order[n]!;
  const original = d.choices[id]![position];
  if (original === undefined) return d;
  return { ...d, answers: { ...d.answers, [id]: original } };
}

/** Positions still unanswered (1-based, as the learner sees them). */
export const unanswered = (d: TestDraft) => d.order.flatMap((id, n) => (d.answers[id] === undefined ? [n + 1] : []));

export interface Grade {
  score: number;
  total: number;
  byObjective: { objective: number; right: number; total: number }[];
}

/** Right answers overall and per objective (in objective order). */
export function grade(items: readonly TestItem[], answers: Readonly<Record<string, number>>): Grade {
  const objectives = [...new Set(items.map((i) => i.objective))].sort((a, b) => a - b);
  const right = (it: TestItem) => answers[it.id] === it.answer;
  return {
    score: items.filter(right).length,
    total: items.length,
    byObjective: objectives.map((objective) => {
      const its = items.filter((i) => i.objective === objective);
      return { objective, right: its.filter(right).length, total: its.length };
    }),
  };
}

/** The finished sitting as the learning path keeps it; null while any question is unanswered. */
export function finish(items: readonly TestItem[], d: TestDraft, now: number): QuizResult | null {
  if (unanswered(d).length) return null;
  const g = grade(items, d.answers);
  return { score: g.score, total: g.total, answers: { ...d.answers }, at: now, seconds: Math.max(0, Math.round((now - d.startedAt) / 1000)) };
}
