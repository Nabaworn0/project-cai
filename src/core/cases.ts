// Turns a case template + seed into a concrete customer machine, and finds repair paths.
// Shared by the game (to build the case) and the validator (to prove every case is fixable).

import { ACTIONS, type Action } from './actions';
import { applyPatch, healthyMachine, machineKey, matches, type Machine } from './machine';
import { createRng } from './rng';
import { findBlockers } from './requirements';
import type { Brand, Case, Problem } from '../content/schema';

export interface GeneratedCase {
  template: Case;
  seed: string;
  brand: Brand;
  /** The machine before the hidden problems were applied. */
  base: Machine;
  machine: Machine;
  problems: Problem[];
}

export interface CaseLibrary {
  problems: readonly Problem[];
  brands: readonly Brand[];
}

/** Why `candidate` cannot join `chosen`: same field patched twice, a requirement undone, or requirements that disagree. */
export function conflicts(chosen: readonly Problem[], candidate: Problem): string | null {
  for (const p of chosen) {
    const shared = Object.keys(candidate.patch).filter((k) => k in p.patch);
    if (shared.length) return `${candidate.id} and ${p.id} both change ${shared.join(', ')}`;
    for (const [k, v] of Object.entries(candidate.patch)) {
      if (k in p.requires && JSON.stringify((p.requires as Record<string, unknown>)[k]) !== JSON.stringify(v)) {
        return `${candidate.id} sets ${k}, which ${p.id} requires to be ${JSON.stringify((p.requires as Record<string, unknown>)[k])}`;
      }
    }
    for (const [k, v] of Object.entries(p.patch)) {
      if (k in candidate.requires && JSON.stringify((candidate.requires as Record<string, unknown>)[k]) !== JSON.stringify(v)) {
        return `${p.id} sets ${k}, which ${candidate.id} requires to be ${JSON.stringify((candidate.requires as Record<string, unknown>)[k])}`;
      }
    }
    for (const [k, v] of Object.entries(candidate.requires)) {
      if (k in p.requires && JSON.stringify((p.requires as Record<string, unknown>)[k]) !== JSON.stringify(v)) {
        return `${candidate.id} and ${p.id} need different values of ${k}`;
      }
    }
  }
  return null;
}

/**
 * `seed` picks the brand and hidden problems; `detailSeed` picks spec details (RAM, disk, CPU).
 * Daily cases pass the shared day seed plus a per-player detail seed: same puzzle, different machine.
 */
export function generateCase(template: Case, lib: CaseLibrary, seed: string, detailSeed: string = seed): GeneratedCase {
  const rng = createRng(`${template.id}:${seed}`);
  const detail = createRng(`${template.id}:detail:${detailSeed}`);
  const brandId = rng.pick(template.brands);
  const brand = lib.brands.find((b) => b.id === brandId);
  if (!brand) throw new Error(`Case ${template.id}: unknown brand ${brandId}`);

  const base: Machine = {
    ...healthyMachine(brand.id),
    ramGB: detail.pick(template.machine.ramGB),
    storageGB: detail.pick(template.machine.storageGB),
    cpu: detail.pick(template.machine.cpu),
    diskHasData: template.machine.diskHasData,
  };

  const byId = (pid: string): Problem => {
    const p = lib.problems.find((x) => x.id === pid);
    if (!p) throw new Error(`Case ${template.id}: unknown problem ${pid}`);
    return p;
  };
  const problems = template.problems.fixed.map(byId);
  const want = rng.int(template.problems.extra[0], template.problems.extra[1]);
  for (const pid of rng.shuffle(template.problems.pool)) {
    if (problems.length - template.problems.fixed.length >= want) break;
    const p = byId(pid);
    if (problems.includes(p) || conflicts(problems, p) || !matches(base, p.requires)) continue;
    problems.push(p);
  }

  const machine = problems.reduce((m, p) => applyPatch(m, p.patch), base);
  return { template, seed, brand, base, machine, problems };
}

export interface SolveOptions {
  keepData: boolean;
  /** Restrict to these action ids (default: all actions). */
  allowed?: ReadonlySet<string>;
  maxDepth?: number;
  /** Stop when this holds (default: no blockers left). */
  until?: (m: Machine) => boolean;
}

/** Shortest action sequence that clears every blocker (or reaches `until`), or null when none exists. */
export function solve(start: Machine, brand: Brand, opts: SolveOptions): string[] | null {
  const usable: Action[] = ACTIONS.filter(
    (a) => (!opts.allowed || opts.allowed.has(a.id)) && !(opts.keepData && a.destructive) && brandShows(brand, a),
  );
  const maxDepth = opts.maxDepth ?? 8;
  const done = opts.until ?? ((m: Machine) => findBlockers(m).length === 0);
  const seen = new Set([machineKey(start)]);
  let frontier: { m: Machine; path: string[] }[] = [{ m: start, path: [] }];
  for (let depth = 0; depth <= maxDepth; depth++) {
    const next: typeof frontier = [];
    for (const { m, path } of frontier) {
      if (done(m)) return path;
      for (const a of usable) {
        if (a.blockedBy(m, { brand })) continue;
        const after = a.apply(m);
        const key = machineKey(after);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ m: after, path: [...path, a.id] });
      }
    }
    frontier = next;
  }
  return null;
}

/** A BIOS action is only possible if this brand's BIOS has that setting somewhere. */
export function brandShows(brand: Brand, a: Action): boolean {
  return !a.biosSetting || brand.pages.some((pg) => pg.items.some((it) => it.setting === a.biosSetting));
}
