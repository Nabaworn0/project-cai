// npm run test:unit — proves the validator accepts the real content and catches broken content.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generateCase, solve } from '../src/core/cases';
import { healthyMachine } from '../src/core/machine';
import { findBlockers, hardwareLimits } from '../src/core/requirements';
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
  get(files, 'cases/c03-red-text.json').problems.fixed = ['uefi-mbr', 'legacy-mbr'];
  hasError(files, 'contradict each other');
});

test('a keep-my-files customer cannot need a destructive-only fix', () => {
  const files = real();
  get(files, 'cases/adv-keep-my-files.json').problems = { fixed: ['storage-low'], pool: [], extra: [0, 0] };
  hasError(files, 'no listed fix is allowed');
});

test('a machine that is broken before problems are added is rejected', () => {
  const files = real();
  get(files, 'cases/c03-red-text.json').machine.ramGB = [2];
  hasError(files, 'already broken');
});

test('a brand whose BIOS lacks the needed setting makes the case unsolvable', () => {
  const files = real();
  const hp = get(files, 'brands/hp.json');
  hp.phase = 'next';
  hp.pages = hp.pages.filter((p: { id: string }) => p.id !== 'security'); // removes the TPM setting
  const c02 = get(files, 'cases/c04-security-chip.json');
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
  hasError(files, 'tests LO1 in pre-a but LO5 in pre-b');
});

test('unknown references are reported', () => {
  const files = real();
  get(files, 'cases/c04-security-chip.json').brands = ['dell'];
  hasError(files, 'unknown brand dell');
});

test('Acer needs a supervisor password before Secure Boot can be turned on', () => {
  const files = real();
  const brand = BrandSchema.parse(get(files, 'brands/acer.json'));
  const problems = ProblemsSchema.parse(get(files, 'problems.json'));
  const template = CaseSchema.parse({ ...get(files, 'cases/c04-security-chip.json'), brands: ['acer'], problems: { fixed: ['secure-boot-off'] } });
  const g = generateCase(template, { problems, brands: [brand] }, 'x');
  assert.deepEqual(solve(g.machine, brand, { keepData: false }), ['set-supervisor-password', 'enable-secure-boot']);
});

test('the same seed always builds the same machine', () => {
  const files = real();
  const lib = { problems: ProblemsSchema.parse(get(files, 'problems.json')), brands: [BrandSchema.parse(get(files, 'brands/classic.json'))] };
  const c = CaseSchema.parse(get(files, 'cases/adv-keep-my-files.json'));
  assert.deepEqual(generateCase(c, lib, 'abc').machine, generateCase(c, lib, 'abc').machine);
});

test('daily case: every player gets the same problems, but spec details vary between players', () => {
  const files = real();
  const lib = { problems: ProblemsSchema.parse(get(files, 'problems.json')), brands: [BrandSchema.parse(get(files, 'brands/classic.json'))] };
  const c = CaseSchema.parse({ ...get(files, 'cases/c04-security-chip.json'), machine: { ramGB: [8, 16, 32], storageGB: [256, 512, 1024], cpu: ['A', 'B', 'C'] } });
  const players = Array.from({ length: 12 }, (_, i) => dailySeeds('2026-10-22', `student-${i}`));
  const built = players.map((p) => generateCase(c, lib, p.caseSeed, p.detailSeed));
  const problemSets = new Set(built.map((g) => g.problems.map((p) => p.id).join(',')));
  assert.equal(problemSets.size, 1, 'all players must share the hidden problems');
  const details = new Set(built.map((g) => `${g.machine.ramGB}/${g.machine.storageGB}/${g.machine.cpu}`));
  assert.ok(details.size > 1, 'spec details should differ between players');
});

test('a customer with an old Windows on the disk can be fixed with mbr2gpt (prototype path 3)', () => {
  const files = real();
  const lib = { problems: ProblemsSchema.parse(get(files, 'problems.json')), brands: [BrandSchema.parse(get(files, 'brands/classic.json'))] };
  const c = CaseSchema.parse({ ...get(files, 'cases/c03-red-text.json'), problems: { fixed: ['uefi-mbr'] } });
  const g = generateCase(c, lib, 'any');
  assert.equal(g.machine.diskHasData, true);
  assert.deepEqual(solve(g.machine, g.brand, { keepData: true }), ['mbr2gpt']);
});

test('keep-my-files customer on an empty disk is rejected', () => {
  const files = real();
  get(files, 'cases/adv-keep-my-files.json').machine.diskHasData = false;
  hasError(files, 'machine.diskHasData is false');
});

test('problems that need different values of the same field cannot be combined', () => {
  const files = real();
  const problems = get(files, 'problems.json') as unknown as Record<string, unknown>[];
  problems.push({ ...problems.find((p) => p.id === 'tpm-disabled')!, id: 'legacy-only', requires: { bootMode: 'legacy' } });
  get(files, 'cases/c04-security-chip.json').problems = { fixed: ['secure-boot-off', 'legacy-only'], pool: [], extra: [0, 0] };
  hasError(files, 'need different values of bootMode');
});

// --- Windows 11 only (decided 2026-10-24; Windows 10 is just the customers' old system) ---

test('Windows 11 rejects a Legacy BIOS machine, even one set up correctly for it (MBR disk and USB)', () => {
  const legacy = { ...healthyMachine('classic'), bootMode: 'legacy' as const, secureBoot: false, diskStyle: 'mbr' as const, usbScheme: 'mbr' as const };
  assert.deepEqual(findBlockers(legacy), ['legacy-boot']);
});

test('an MBR install USB on a UEFI machine is a mismatch (textbook p.47)', () => {
  assert.deepEqual(findBlockers({ ...healthyMachine('classic'), usbScheme: 'mbr' }), ['usb-scheme-mismatch']);
});

test('no TPM chip or an unlisted CPU are hardware limits: upgrade the hardware or advise the customer', () => {
  const old = { ...healthyMachine('classic'), tpm: 'none' as const, cpuWin11: false };
  assert.deepEqual(hardwareLimits(old), ['tpm-missing', 'cpu-unsupported']);
  assert.deepEqual(hardwareLimits(healthyMachine('classic')), []);
});

test('the textbook problems are repaired the textbook way', () => {
  const files = real();
  const brand = BrandSchema.parse(get(files, 'brands/classic.json'));
  const problems = ProblemsSchema.parse(get(files, 'problems.json'));
  const fixWith = (problem: string) => {
    const template = CaseSchema.parse({ ...get(files, 'cases/c03-red-text.json'), problems: { fixed: [problem] } });
    const g = generateCase(template, { problems, brands: [brand] }, 'x');
    return solve(g.machine, brand, { keepData: false });
  };
  assert.deepEqual(fixWith('usb-wrong-scheme'), ['remake-usb']);
  assert.deepEqual(fixWith('bios-not-saved'), ['set-usb-first']);
  assert.deepEqual(fixWith('no-product-key'), ['skip-product-key']);
  assert.deepEqual(fixWith('missing-display-driver'), ['install-drivers']);
});

test('unknown fields in cases and problems are errors, so leftovers like "targetOs" or typos are not silently ignored', () => {
  const files = real();
  get(files, 'cases/adv-old-office-pc.json').targetOs = 'win10';
  hasError(files, 'targetOs');
  const typo = real();
  get(typo, 'problems.json')[0].hintTh = ['สะกดผิด'];
  hasError(typo, 'hintTh');
});

test('the first five cases are warned when they use topics beyond the textbook', () => {
  const files = real();
  get(files, 'cases/c04-security-chip.json').problems = { fixed: ['raid-mode'], pool: [], extra: [0, 0] };
  const { warnings } = run(files);
  assert.ok(warnings.some((w) => w.includes('c04-security-chip') && w.includes('นอกหนังสือ')), warnings.join('\n'));
});

// --- Phase 1 cases (docs/phase1-cases.md) ---

test('the five main cases keep the approved difficulty curve (shortest repair: 1, 1, 1–2, 1–2, 4–5 steps)', () => {
  const files = real();
  const lib = { problems: ProblemsSchema.parse(get(files, 'problems.json')), brands: [BrandSchema.parse(get(files, 'brands/classic.json'))] };
  const expected: [string, number, number][] = [
    ['c01-boot-order', 1, 1],
    ['c02-rufus-scheme', 1, 1],
    ['c03-red-text', 1, 2],
    ['c04-security-chip', 1, 2],
    ['c05-lab-upgrade', 4, 5],
  ];
  for (const [id, min, max] of expected) {
    const c = CaseSchema.parse(get(files, `cases/${id}.json`));
    for (let s = 0; s < 40; s++) {
      const g = generateCase(c, lib, `curve${s}`);
      const steps = solve(g.machine, g.brand, { keepData: c.customer.keepData })!.length;
      assert.ok(steps >= min && steps <= max, `${id} seed curve${s}: ${steps} steps, expected ${min}–${max}`);
    }
  }
});

test('a case must name a customer from customers.json', () => {
  const files = real();
  get(files, 'cases/c01-boot-order.json').customer.id = 'nobody';
  hasError(files, 'unknown customer nobody');
});

test("a practice case's tip must name the keys of its BIOS brand", () => {
  const files = real();
  get(files, 'cases/c01-boot-order.json').coach.beforePcTh = 'กด DEL เข้า BIOS';
  hasError(files, 'coach.beforePcTh does not name F2, F8 (keys of brand classic)');
});

test('case questions are checked: answers in range and customer questions say what the customer asks', () => {
  const files = real();
  const c = get(files, 'cases/c02-rufus-scheme.json');
  c.diagnosis.answer = 9;
  delete c.customerQuestions[0].askTh;
  hasError(files, 'c02-rufus-scheme.json diagnosis: answer 9 is out of range');
  hasError(files, 'customerQuestions[0]: missing askTh');
});

test('the playable BIOS menu is checked against the engine and the settings list', () => {
  const broken = (edit: (menu: Record<string, any>) => void, text: string) => {
    const files = real();
    edit(get(files, 'brands/classic.json').menu);
    hasError(files, text);
  };
  broken((m) => (m.menus.boot.rows[1].menu = 'nowhere'), 'links to unknown menu "nowhere"');
  broken((m) => (m.menus['boot-settings'].rows[1].choices[0].value = 'turbo'), 'bootMode cannot be "turbo"');
  broken((m) => (m.menus['hard-disks'].rows[1].slot = 5), 'slot 5 but the machine has 2 drives');
  broken((m) => (m.menus.exit.rows = m.menus.exit.rows.filter((r: any) => r.action !== 'save')), 'no "Save Changes and Exit" row');
  broken((m) => (m.menus['secure-boot'].rows = [{ type: 'info', label: 'Secure Boot', value: '' }]), 'pages list secureBoot but the playable menu has no row');
  broken((m) => m.menus.sata.rows.push({ type: 'option', label: 'Password', setting: 'supervisorPassword', choices: [{ label: 'On', value: true }, { label: 'Off', value: false }] }), 'supervisorPassword cannot be an option');
  const files = real();
  delete get(files, 'brands/classic.json').menu;
  hasError(files, 'MVP brand has no playable "menu"');
});
