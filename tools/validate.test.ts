// npm run test:unit — proves the validator accepts the real content and catches broken content.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generateCase, solve } from '../src/core/cases';
import { dailySeeds } from '../src/core/rng';
import { BrandSchema, CaseSchema, ProblemsSchema } from '../src/content/schema';
import { validateContent, type ContentFile } from '../src/content/validate';

const root = fileURLToPath(new URL('../src/content/data', import.meta.url));
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const real = (): ContentFile[] =>
  walk(root).map((f) => ({ path: relative(root, f).split(sep).join('/'), data: JSON.parse(readFileSync(f, 'utf8')) }));

const get = (files: ContentFile[], path: string) => files.find((f) => f.path === path)!.data as Record<string, any>;
const run = (files: ContentFile[]) => validateContent(files, { seedsPerCase: 20 });
const hasError = (files: ContentFile[], text: string) => {
  const { errors } = run(files);
  assert.ok(errors.some((e) => e.includes(text)), `expected an error containing "${text}", got:\n${errors.join('\n')}`);
};

test('the shipped content passes', () => {
  assert.deepEqual(run(real()).errors, []);
});

test('contradicting hidden problems are rejected', () => {
  const files = real();
  get(files, 'cases/c01-uefi-mbr.json').problems.fixed = ['uefi-mbr', 'legacy-mbr'];
  hasError(files, 'contradict each other');
});

test('a keep-my-files customer cannot need a destructive-only fix', () => {
  const files = real();
  get(files, 'cases/c03-keep-my-files.json').problems = { fixed: ['storage-low'], pool: [], extra: [0, 0] };
  hasError(files, 'no listed fix is allowed');
});

test('a machine that is broken before problems are added is rejected', () => {
  const files = real();
  get(files, 'cases/c01-uefi-mbr.json').machine.ramGB = [2];
  hasError(files, 'already broken');
});

test('a brand whose BIOS lacks the needed setting makes the case unsolvable', () => {
  const files = real();
  const hp = get(files, 'brands/hp.json');
  hp.phase = 'next';
  hp.pages = hp.pages.filter((p: { id: string }) => p.id !== 'security'); // removes the TPM setting
  const c02 = get(files, 'cases/c02-security-chip.json');
  c02.brands = ['hp'];
  hasError(files, 'no sequence of repairs fixes this machine');
});

test('a fix that does not repair its problem is rejected', () => {
  const files = real();
  (get(files, 'problems.json') as unknown as { id: string; fixes: string[] }[]).find((p) => p.id === 'tpm-disabled')!.fixes = ['upgrade-ram'];
  hasError(files, 'fix "upgrade-ram" does not clear blocker tpm-disabled');
});

test('A/B quiz items must be parallel and test the same objective', () => {
  const files = real();
  get(files, 'quizzes/pre-b.json').items[1].lo = 'LO5';
  hasError(files, 'tests LO2 in pre-a but LO5 in pre-b');
});

test('unknown references are reported', () => {
  const files = real();
  get(files, 'cases/c02-security-chip.json').brands = ['dell'];
  hasError(files, 'unknown brand dell');
});

test('Acer needs a supervisor password before Secure Boot can be turned on', () => {
  const files = real();
  const brand = BrandSchema.parse(get(files, 'brands/acer.json'));
  const problems = ProblemsSchema.parse(get(files, 'problems.json'));
  const template = CaseSchema.parse({ ...get(files, 'cases/c02-security-chip.json'), brands: ['acer'], problems: { fixed: ['secure-boot-off'] } });
  const g = generateCase(template, { problems, brands: [brand] }, 'x');
  assert.deepEqual(solve(g.machine, brand, { keepData: false }), ['set-supervisor-password', 'enable-secure-boot']);
});

test('the same seed always builds the same machine', () => {
  const files = real();
  const lib = { problems: ProblemsSchema.parse(get(files, 'problems.json')), brands: [BrandSchema.parse(get(files, 'brands/asus.json'))] };
  const c = CaseSchema.parse(get(files, 'cases/c03-keep-my-files.json'));
  assert.deepEqual(generateCase(c, lib, 'abc').machine, generateCase(c, lib, 'abc').machine);
});

test('daily case: every player gets the same problems, but spec details vary between players', () => {
  const files = real();
  const lib = { problems: ProblemsSchema.parse(get(files, 'problems.json')), brands: [BrandSchema.parse(get(files, 'brands/asus.json'))] };
  const c = CaseSchema.parse({ ...get(files, 'cases/c02-security-chip.json'), machine: { ramGB: [8, 16, 32], storageGB: [256, 512, 1024], cpu: ['A', 'B', 'C'] } });
  const players = Array.from({ length: 12 }, (_, i) => dailySeeds('2026-10-22', `student-${i}`));
  const built = players.map((p) => generateCase(c, lib, p.caseSeed, p.detailSeed));
  const problemSets = new Set(built.map((g) => g.problems.map((p) => p.id).join(',')));
  assert.equal(problemSets.size, 1, 'all players must share the hidden problems');
  const details = new Set(built.map((g) => `${g.machine.ramGB}/${g.machine.storageGB}/${g.machine.cpu}`));
  assert.ok(details.size > 1, 'spec details should differ between players');
});

test('a customer with an old Windows on the disk can be fixed with mbr2gpt (prototype path 3)', () => {
  const files = real();
  const lib = { problems: ProblemsSchema.parse(get(files, 'problems.json')), brands: [BrandSchema.parse(get(files, 'brands/asus.json'))] };
  const c = CaseSchema.parse(get(files, 'cases/c01-uefi-mbr.json'));
  const g = generateCase(c, lib, 'any');
  assert.equal(g.machine.diskHasData, true);
  assert.deepEqual(solve(g.machine, g.brand, { keepData: true }), ['mbr2gpt']);
});

test('keep-my-files customer on an empty disk is rejected', () => {
  const files = real();
  get(files, 'cases/c03-keep-my-files.json').machine.diskHasData = false;
  hasError(files, 'machine.diskHasData is false');
});

test('problems that need different values of the same field cannot be combined', () => {
  const files = real();
  const problems = get(files, 'problems.json') as unknown as Record<string, unknown>[];
  problems.push({ ...problems.find((p) => p.id === 'tpm-disabled')!, id: 'legacy-only', requires: { bootMode: 'legacy' } });
  get(files, 'cases/c02-security-chip.json').problems = { fixed: ['secure-boot-off', 'legacy-only'], pool: [], extra: [0, 0] };
  hasError(files, 'need different values of bootMode');
});
