// Free play's technician ranks (docs/phase3-plan.md task C): worked out from what free play's save already keeps (its
// jobs, the problems met, the book's cards), never stored. The ranks and what each needs are in ranks.json.

import type { Ranks } from '../content/schema';
import type { Progress } from './path';

export type Rank = Ranks['ranks'][number];
export type Needs = Rank['needs'];

export interface RankStats {
  jobs: number;
  three: number;
  /** Problems met of all that free play can bring. */
  problems: number;
  problemsAll: number;
  /** Cards got of all in the book. */
  cards: number;
  cardsAll: number;
}

export function rankStats(p: Progress, problemsAll: readonly string[], cards: number, cardsAll: number): RankStats {
  return {
    jobs: p.jobs.count,
    three: p.jobs.three,
    problems: problemsAll.filter((id) => p.jobs.problems.includes(id)).length,
    problemsAll: problemsAll.length,
    cards,
    cardsAll,
  };
}

/** One thing still to do for the next rank: how far along, of how much. */
export interface Step {
  id: 'jobs' | 'three' | 'problems' | 'cards';
  have: number;
  need: number;
}

/** What a rank needs, as steps (only those it asks for). */
export function steps(needs: Needs, s: RankStats): Step[] {
  const out: Step[] = [];
  if (needs.jobs) out.push({ id: 'jobs', have: s.jobs, need: needs.jobs });
  if (needs.three) out.push({ id: 'three', have: s.three, need: needs.three });
  if (needs.allProblems) out.push({ id: 'problems', have: s.problems, need: s.problemsAll });
  if (needs.allCards) out.push({ id: 'cards', have: s.cards, need: s.cardsAll });
  return out;
}

export const meets = (needs: Needs, s: RankStats) => steps(needs, s).every((x) => x.have >= x.need);

/** The highest rank reached (ranks.json is lowest first, each needing more than the last). */
export function rankIndex(ranks: readonly Rank[], s: RankStats): number {
  let i = 0;
  while (i + 1 < ranks.length && meets(ranks[i + 1]!.needs, s)) i++;
  return i;
}

/** The next rank and how far along it is (0–1, each step counting the same), or null at the top. */
export function toNext(ranks: readonly Rank[], s: RankStats): { rank: Rank; steps: Step[]; progress: number } | null {
  const next = ranks[rankIndex(ranks, s) + 1];
  if (!next) return null;
  const st = steps(next.needs, s);
  const progress = st.reduce((sum, x) => sum + Math.min(1, x.have / x.need), 0) / st.length;
  return { rank: next, steps: st, progress };
}
