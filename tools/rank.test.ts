// Free play's technician ranks (src/core/rank.ts, docs/phase3-plan.md task C): worked out from its jobs, the problems
// met and the book's cards; the way to the next rank; and every problem free play can bring.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CaseSchema, ProblemsSchema, RanksSchema } from '../src/content/schema';
import { EMPTY, PLAYABLE, type Progress } from '../src/core/path';
import { rankIndex, rankStats, toNext } from '../src/core/rank';
import { MIX_EXTRAS, mixedVisits, visitProblems } from '../src/core/visits';

const data = (path: string) => JSON.parse(readFileSync(new URL(`../src/content/data/${path}`, import.meta.url), 'utf8'));
const { ranks } = RanksSchema.parse(data('ranks.json'));
const rawProblems = data('problems.json');
const problems = ProblemsSchema.parse(rawProblems.problems ?? rawProblems);
const cases = PLAYABLE.map((id) => CaseSchema.parse(data(`cases/${id}.json`)));
const ALL = visitProblems(cases, mixedVisits(cases, problems));

/** Free play's save with these jobs; `met` problems of all (default none). */
const save = (count: number, three: number, met: readonly string[] = []): Progress => ({ ...EMPTY, jobs: { count, three, pairs: [], problems: [...met] } });
const at = (p: Progress, cards = 0) => rankIndex(ranks, rankStats(p, ALL, cards, 16));
const name = (i: number) => ranks[i]!.nameTh;

test('four ranks, from the intern up', () => {
  assert.deepEqual(ranks.map((r) => r.nameTh), ['เด็กฝึกงาน', 'ช่างผู้ช่วย', 'ช่างประจำร้าน', 'หัวหน้าช่าง']);
});

test('every problem free play can bring: each case\'s own and each extra, once', () => {
  for (const c of cases) assert.ok(ALL.includes(c.problems.fixed[0]!), c.id);
  for (const id of MIX_EXTRAS) assert.ok(ALL.includes(id), id);
  assert.equal(new Set(ALL).size, ALL.length);
  assert.equal(ALL.length, 8);
});

test('the rank by jobs, three-star jobs, then every problem met and every card', () => {
  assert.equal(name(at(save(0, 0))), 'เด็กฝึกงาน');
  assert.equal(name(at(save(4, 4))), 'เด็กฝึกงาน');
  assert.equal(name(at(save(5, 0))), 'ช่างผู้ช่วย');
  assert.equal(name(at(save(15, 4))), 'ช่างผู้ช่วย', 'enough jobs, not enough with three stars');
  assert.equal(name(at(save(15, 5))), 'ช่างประจำร้าน');
  assert.equal(name(at(save(30, 15, ALL.slice(1)), 16)), 'ช่างประจำร้าน', 'one problem never met');
  assert.equal(name(at(save(30, 15, ALL), 15)), 'ช่างประจำร้าน', 'one card missing');
  assert.equal(name(at(save(29, 15, ALL), 16)), 'ช่างประจำร้าน', 'one job short');
  assert.equal(name(at(save(30, 15, ALL), 16)), 'หัวหน้าช่าง');
  // Problems met outside the list (none should be) do not count towards it.
  assert.equal(rankStats(save(0, 0, ['raid-mode', ALL[0]!]), ALL, 0, 16).problems, 1);
});

test('the way to the next rank: what it needs, how far along (each part counts the same), nothing past the top', () => {
  const a = toNext(ranks, rankStats(save(2, 1), ALL, 0, 16))!;
  assert.equal(a.rank.nameTh, 'ช่างผู้ช่วย');
  assert.deepEqual(a.steps, [{ id: 'jobs', have: 2, need: 5 }]);
  assert.equal(a.progress, 0.4);
  const b = toNext(ranks, rankStats(save(10, 7), ALL, 3, 16))!;
  assert.equal(b.rank.nameTh, 'ช่างประจำร้าน');
  assert.deepEqual(b.steps.map((x) => x.id), ['jobs', 'three']);
  // Ten of 15 jobs, and more three-star jobs than needed counts as that part done, not more.
  assert.equal(b.progress, (10 / 15 + 1) / 2);
  const c = toNext(ranks, rankStats(save(20, 15, ALL.slice(0, 4)), ALL, 8, 16))!;
  assert.deepEqual(c.steps, [
    { id: 'jobs', have: 20, need: 30 },
    { id: 'three', have: 15, need: 15 },
    { id: 'problems', have: 4, need: 8 },
    { id: 'cards', have: 8, need: 16 },
  ]);
  assert.equal(toNext(ranks, rankStats(save(30, 15, ALL), ALL, 16, 16)), null);
});
