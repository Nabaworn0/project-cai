// Free play's customers (โหมดอิสระ, docs/phase3-plan.md task B): no cases 1–5 in order, but customers at random,
// each with a problem mixed in from another case. A job is one of the five customers with their own problem (their
// story and "guess the cause" are written for it) plus one problem more: another case's own problem, or one of the
// extras. Pairs whose problems change the same setting are never made; tools/validate-content.ts proves that every
// pair can be fixed. A pair not met yet comes before one met already, as in a shuffled deck.

import type { Case, Problem } from '../content/schema';
import { conflicts, generateCase, type CaseLibrary, type GeneratedCase } from './cases';

/** Problems that are no case's own but can be mixed in. */
export const MIX_EXTRAS: readonly string[] = ['secure-boot-off', 'no-product-key', 'bios-not-saved'];
/** Fixes made inside Setup (product key, partitions): a problem fixed there only shows past Setup's first page. */
export const SETUP_FIXES: readonly string[] = ['setup-delete-all', 'skip-product-key'];

export interface Visit {
  /** The case whose customer comes, with their own problem. */
  host: string;
  /** The problem mixed in. */
  extra: string;
}
export const visitKey = (v: Visit) => `${v.host}+${v.extra}`;

const problemOf = (problems: readonly Problem[], id: string) => {
  const p = problems.find((x) => x.id === id);
  if (!p) throw new Error(`unknown problem ${id}`);
  return p;
};

/** Every pair that can be made: each case's customer with each other case's own problem and each extra, unless the
 *  two problems clash. Unknown problems are left out (the validator reports them on their own). */
export function mixedVisits(cases: readonly Case[], problems: readonly Problem[]): Visit[] {
  const known = (id: string) => problems.some((p) => p.id === id);
  const extras = [...new Set([...cases.map((c) => c.problems.fixed[0]!), ...MIX_EXTRAS])].filter(known);
  return cases.flatMap((host) => {
    if (!host.problems.fixed.every(known)) return [];
    const own = host.problems.fixed.map((id) => problemOf(problems, id));
    return extras
      .filter((id) => !host.problems.fixed.includes(id) && !conflicts(own, problemOf(problems, id)))
      .map((extra) => ({ host: host.id, extra }));
  });
}

/** The host's case with the extra problem added. The job goes on as far as the further of the two needs: a problem
 *  fixed inside Setup takes a job that ended on Setup's first page on to the install. */
export function mixedTemplate(host: Case, extra: Problem): Case {
  const inSetup = extra.fixes.some((f) => SETUP_FIXES.includes(f));
  return {
    ...host,
    goal: inSetup && host.goal === 'setup' ? 'install' : host.goal,
    problems: { fixed: [...host.problems.fixed, extra.id], pool: [], extra: [0, 0] },
  };
}

export function mixedCase(cases: readonly Case[], lib: CaseLibrary, v: Visit, seed: string): GeneratedCase {
  const host = cases.find((c) => c.id === v.host);
  if (!host) throw new Error(`unknown case ${v.host}`);
  return { ...generateCase(mixedTemplate(host, problemOf(lib.problems, v.extra)), lib, seed), mixed: v };
}

/**
 * The next pair: one not met yet if any (else any), and not the same customer as the last one when another can come.
 * `rand` in [0, 1).
 */
export function pickVisit(visits: readonly Visit[], met: readonly string[], lastHost: string | null, rand: () => number): Visit {
  if (!visits.length) throw new Error('no pairs to pick from');
  const fresh = visits.filter((v) => !met.includes(visitKey(v)));
  const pool = fresh.length ? fresh : visits;
  const other = pool.filter((v) => v.host !== lastHost);
  const from = other.length ? other : pool;
  return from[Math.min(from.length - 1, Math.floor(rand() * from.length))]!;
}

/** Every problem free play can bring: each customer's own and each one mixed in (the top rank needs them all met). */
export function visitProblems(cases: readonly Case[], visits: readonly Visit[]): string[] {
  const own = (host: string) => cases.find((c) => c.id === host)?.problems.fixed ?? [];
  return [...new Set(visits.flatMap((v) => [...own(v.host), v.extra]))];
}
