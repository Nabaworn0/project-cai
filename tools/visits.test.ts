// Free play's customers (src/core/visits.ts, docs/phase3-plan.md task B): which customer + problem pairs are made,
// how far a mixed job goes, the next pair as from a shuffled deck, the job record, and a hint for each problem.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BrandSchema, CaseSchema, ProblemsSchema } from '../src/content/schema';
import { conflicts, generateCase, regenerate } from '../src/core/cases';
import { EMPTY, parseProgress, PLAYABLE, recordJob } from '../src/core/path';
import { startSession } from '../src/core/session';
import { MIX_EXTRAS, mixedCase, mixedTemplate, mixedVisits, pickVisit, visitKey, type Visit } from '../src/core/visits';

const data = (path: string) => JSON.parse(readFileSync(new URL(`../src/content/data/${path}`, import.meta.url), 'utf8'));
const rawProblems = data('problems.json');
const problems = ProblemsSchema.parse(rawProblems.problems ?? rawProblems);
const brands = readdirSync(new URL('../src/content/data/brands', import.meta.url)).map((f) => BrandSchema.parse(data(`brands/${f}`)));
const cases = PLAYABLE.map((id) => CaseSchema.parse(data(`cases/${id}.json`)));
const lib = { problems, brands };
const visits = mixedVisits(cases, problems);
const problem = (id: string) => problems.find((p) => p.id === id)!;
const host = (id: string) => cases.find((c) => c.id === id)!;
const has = (h: string, e: string) => visits.some((v) => v.host === h && v.extra === e);

test("every customer gets several problems from other cases, never their own, never one that clashes", () => {
  assert.equal(visits.length, 29);
  for (const c of cases) assert.ok(visits.filter((v) => v.host === c.id).length >= 4, c.id);
  for (const v of visits) {
    const h = host(v.host);
    assert.ok(!h.problems.fixed.includes(v.extra), visitKey(v));
    assert.equal(conflicts(h.problems.fixed.map(problem), problem(v.extra)), null, visitKey(v));
  }
  // The examples from the plan, and the clashing pairs left out.
  assert.ok(has('c01-boot-order', 'usb-wrong-scheme'));
  assert.ok(has('c03-red-text', 'tpm-disabled'));
  assert.ok(!has('c05-lab-upgrade', 'uefi-mbr'));
  assert.ok(!has('c02-rufus-scheme', 'legacy-mbr'));
  // Every other case's own problem and every extra is mixed in somewhere.
  for (const id of [...cases.map((c) => c.problems.fixed[0]!), ...MIX_EXTRAS]) assert.ok(visits.some((v) => v.extra === id), id);
});

test('a mixed job goes as far as either problem needs: a problem fixed inside Setup takes it on to the install', () => {
  assert.equal(mixedTemplate(host('c01-boot-order'), problem('no-product-key')).goal, 'install');
  assert.equal(mixedTemplate(host('c01-boot-order'), problem('uefi-mbr')).goal, 'install');
  assert.equal(mixedTemplate(host('c01-boot-order'), problem('tpm-disabled')).goal, 'setup');
  assert.equal(mixedTemplate(host('c05-lab-upgrade'), problem('no-product-key')).goal, 'desktop');
  const t = mixedTemplate(host('c03-red-text'), problem('tpm-disabled'));
  assert.deepEqual(t.problems, { fixed: ['uefi-mbr', 'tpm-disabled'], pool: [], extra: [0, 0] });
  // The customer, their story and their questions stay theirs.
  assert.equal(t.id, 'c03-red-text');
  assert.equal(t.diagnosis, host('c03-red-text').diagnosis);
});

test('a mixed job has both problems on the machine, and one hint for each', () => {
  const v: Visit = { host: 'c01-boot-order', extra: 'usb-wrong-scheme' };
  for (const seed of ['a', 'b', 'c']) {
    const g = mixedCase(cases, lib, v, seed);
    assert.deepEqual(g.mixed, v);
    assert.deepEqual(g.problems.map((p) => p.id), ['usb-not-first', 'usb-wrong-scheme']);
    assert.equal(g.machine.usbFirst, false);
    assert.equal(g.machine.usbScheme, 'mbr');
    assert.deepEqual(startSession(g).hints, [problem('usb-not-first').hintsTh[0], problem('usb-wrong-scheme').hintsTh[0]]);
  }
});

test('trying again keeps the pair (a free play job) or none (a case), on a new machine', () => {
  const g = mixedCase(cases, lib, { host: 'c03-red-text', extra: 'tpm-disabled' }, 'a');
  const again = regenerate(g, lib, 'b');
  assert.deepEqual(again.mixed, g.mixed);
  assert.deepEqual(again.problems.map((p) => p.id), ['uefi-mbr', 'tpm-disabled']);
  assert.equal(again.template.goal, 'install');
  assert.equal('mixed' in regenerate(generateCase(host('c01-boot-order'), lib, 'a'), lib, 'b'), false);
});

test('the next pair: one not met yet, not the same customer twice in a row, and round again once all are met', () => {
  const first = pickVisit(visits, [], null, () => 0);
  assert.deepEqual(first, visits[0]);
  // Not the customer just served, while another can come.
  for (let r = 0; r < 1; r += 0.05) assert.notEqual(pickVisit(visits, [], 'c01-boot-order', () => r).host, 'c01-boot-order');
  // Met pairs wait until every pair has been met.
  const met = visits.slice(0, -1).map(visitKey);
  for (let r = 0; r < 1; r += 0.05) assert.deepEqual(pickVisit(visits, met, null, () => r), visits.at(-1));
  const all = visits.map(visitKey);
  const seen = new Set<string>();
  for (let r = 0; r < 1; r += 0.01) seen.add(visitKey(pickVisit(visits, all, null, () => r)));
  assert.equal(seen.size, visits.length);
  // The last pair left is taken even by the customer just served.
  assert.deepEqual(pickVisit([visits[0]!], [], visits[0]!.host, () => 0.5), visits[0]);
});

test('free play keeps its jobs: counted, three stars counted, each pair and problem once; kept through a reload', () => {
  let p = recordJob(EMPTY, 'c01-boot-order+usb-wrong-scheme', ['usb-not-first', 'usb-wrong-scheme'], 3);
  p = recordJob(p, 'c01-boot-order+usb-wrong-scheme', ['usb-not-first', 'usb-wrong-scheme'], 2);
  p = recordJob(p, 'c03-red-text+tpm-disabled', ['uefi-mbr', 'tpm-disabled'], 3);
  assert.deepEqual(p.jobs, {
    count: 3,
    three: 2,
    pairs: ['c01-boot-order+usb-wrong-scheme', 'c03-red-text+tpm-disabled'],
    problems: ['usb-not-first', 'usb-wrong-scheme', 'uefi-mbr', 'tpm-disabled'],
  });
  assert.deepEqual(parseProgress(JSON.stringify(p)).jobs, p.jobs);
  // Missing or broken: no jobs yet.
  assert.deepEqual(parseProgress('{}').jobs, EMPTY.jobs);
  assert.deepEqual(parseProgress(JSON.stringify({ jobs: { count: -1, three: 'x', pairs: [3], problems: null } })).jobs, EMPTY.jobs);
});
