// Content validator: schema checks plus game-rule checks (every case fixable, no
// contradictory hidden problems, BIOS screens expose the settings a fix needs, A/B quizzes parallel).
// Pure function so the CLI, unit tests and (later) an in-game editor can all use it.

import { z } from 'zod';
import { ACTIONS, ACTION_IDS } from '../core/actions';
import { brandShows, conflicts, generateCase, solve } from '../core/cases';
import { applyPatch, healthyMachine, matches, type Machine, type MachinePatch } from '../core/machine';
import { BLOCKER_IDS, findBlockers, hardwareLimits } from '../core/win11';
import {
  BIOS_SETTINGS,
  BrandSchema,
  CardsSchema,
  CaseSchema,
  ObjectivesSchema,
  ProblemsSchema,
  QuizSchema,
  type Brand,
  type Cards,
  type Case,
  type Objectives,
  type Problem,
  type Quiz,
} from './schema';

export const MINIGAME_IDS = ['boot-order', 'mbr-gpt', 'win11-check', 'usb-prep', 'partition', 'drivers'] as const;

export interface ContentFile {
  /** Path relative to src/content/data, with forward slashes. */
  path: string;
  data: unknown;
}

export interface Report {
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
}

export interface ParsedContent {
  objectives?: Objectives;
  problems: Problem[];
  brands: Brand[];
  cases: Case[];
  quizzes: Quiz[];
  cards?: Cards;
}

export function validateContent(files: readonly ContentFile[], opts: { seedsPerCase?: number } = {}): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = parseAll(files, errors);
  const seeds = opts.seedsPerCase ?? 40;

  const loIds = new Set(parsed.objectives?.items.map((o) => o.id) ?? []);
  if (!parsed.objectives) errors.push('objectives.json: missing');
  else {
    dupes(parsed.objectives.items.map((o) => o.id), 'objectives.json: duplicate objective', errors);
    if (parsed.objectives.draft) warnings.push('objectives.json: ยังเป็นร่าง (draft) ต้องแทนด้วยวัตถุประสงค์จริงของรายวิชา');
  }
  const checkLo = (where: string, los: readonly string[]) => {
    for (const lo of los) if (!loIds.has(lo)) errors.push(`${where}: unknown objective ${lo}`);
  };

  checkBrands(parsed.brands, errors, warnings);
  checkProblems(parsed, checkLo, errors);
  const generated = checkCases(parsed, seeds, checkLo, errors, warnings);
  checkQuizzes(parsed.quizzes, checkLo, errors, warnings);
  checkCards(parsed, errors, warnings);

  return {
    errors,
    warnings,
    stats: {
      cases: parsed.cases.length,
      problems: parsed.problems.length,
      brands: parsed.brands.length,
      quizzes: parsed.quizzes.length,
      cards: parsed.cards?.cards.length ?? 0,
      machinesChecked: generated,
    },
  };
}

function parseAll(files: readonly ContentFile[], errors: string[]): ParsedContent {
  const out: ParsedContent = { problems: [], brands: [], cases: [], quizzes: [] };
  const parse = <S extends z.ZodType>(schema: S, f: ContentFile): z.infer<S> | undefined => {
    const r = schema.safeParse(f.data);
    if (r.success) return r.data;
    for (const issue of r.error.issues) errors.push(`${f.path}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    return undefined;
  };
  for (const f of files) {
    if (f.path === 'objectives.json') out.objectives = parse(ObjectivesSchema, f);
    else if (f.path === 'problems.json') out.problems = parse(ProblemsSchema, f) ?? [];
    else if (f.path === 'cards.json') out.cards = parse(CardsSchema, f);
    else if (f.path.startsWith('brands/')) push(out.brands, parse(BrandSchema, f), f.path, errors);
    else if (f.path.startsWith('cases/')) push(out.cases, parse(CaseSchema, f), f.path, errors);
    else if (f.path.startsWith('quizzes/')) push(out.quizzes, parse(QuizSchema, f), f.path, errors);
    else errors.push(`${f.path}: not a known content file (expected objectives, problems, cards, brands/, cases/, quizzes/)`);
  }
  return out;
}

function push<T extends { id: string }>(list: T[], item: T | undefined, path: string, errors: string[]): void {
  if (!item) return;
  const stem = path.split('/').pop()!.replace(/\.json$/, '');
  if (stem !== item.id) errors.push(`${path}: file name must match id "${item.id}"`);
  list.push(item);
}

function dupes(ids: readonly string[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${label} "${id}"`);
    seen.add(id);
  }
}

function checkBrands(brands: readonly Brand[], errors: string[], warnings: string[]): void {
  dupes(brands.map((b) => b.id), 'brands: duplicate brand', errors);
  for (const b of brands) {
    const where = `brands/${b.id}.json`;
    if (!b.verified) warnings.push(`${where}: ยังไม่ได้เทียบกับเครื่องจริงในห้องปฏิบัติการ (verified: false)`);
    const shown = new Set(b.pages.flatMap((p) => p.items.map((i) => i.setting)));
    const missing = BIOS_SETTINGS.filter((s) => !shown.has(s) && !(s === 'supervisorPassword' && !b.quirks.secureBootNeedsSupervisorPassword));
    if (b.phase === 'mvp' && missing.length) errors.push(`${where}: MVP brand is missing BIOS settings: ${missing.join(', ')}`);
    if (b.pages.some((p) => p.items.some((i) => i.advancedOnly)) && !b.quirks.hasAdvancedMode) {
      errors.push(`${where}: items are advancedOnly but quirks.hasAdvancedMode is false`);
    }
  }
}

function checkProblems(parsed: ParsedContent, checkLo: (w: string, l: readonly string[]) => void, errors: string[]): void {
  dupes(parsed.problems.map((p) => p.id), 'problems.json: duplicate problem', errors);
  const prep = ACTIONS.filter((a) => a.prep).map((a) => a.id);
  for (const p of parsed.problems) {
    const where = `problems.json[${p.id}]`;
    checkLo(where, p.lo);
    if (!(BLOCKER_IDS as readonly string[]).includes(p.blocker)) errors.push(`${where}: unknown blocker ${p.blocker}`);
    if (Object.keys(p.patch).length === 0) errors.push(`${where}: patch is empty, so the problem changes nothing`);
    for (const f of p.fixes) if (!ACTION_IDS.includes(f)) errors.push(`${where}: unknown fix action ${f}`);

    // Each listed fix must clear this problem's blocker on its own (plus unlock-only prep steps) on some brand.
    // It may reveal a follow-up blocker (legacy -> UEFI exposes an MBR disk); whole cases are solved separately.
    for (const f of p.fixes.filter((x) => ACTION_IDS.includes(x))) {
      const works = parsed.brands.some((brand) =>
        [false, true].some((hasData) => {
          const start = applyPatch(applyPatch({ ...healthyMachine(brand.id), diskHasData: hasData }, p.requires), p.patch);
          if (!findBlockers(start).includes(p.blocker as never)) return false;
          const cleared = (m: Machine) => !findBlockers(m).includes(p.blocker as never);
          return solve(start, brand, { keepData: false, allowed: new Set([...prep, f]), maxDepth: 3, until: cleared }) !== null;
        }),
      );
      if (!works) errors.push(`${where}: fix "${f}" does not clear blocker ${p.blocker} on any brand`);
    }
  }
}

function checkCases(
  parsed: ParsedContent,
  seeds: number,
  checkLo: (w: string, l: readonly string[]) => void,
  errors: string[],
  warnings: string[],
): number {
  dupes(parsed.cases.map((c) => c.id), 'cases: duplicate case', errors);
  dupes(parsed.cases.map((c) => String(c.order)), 'cases: duplicate order', errors);
  const brandIds = new Set(parsed.brands.map((b) => b.id));
  const problemIds = new Set(parsed.problems.map((p) => p.id));
  let checked = 0;

  for (const c of [...parsed.cases].sort((a, b) => a.order - b.order)) {
    const where = `cases/${c.id}.json`;
    checkLo(where, c.lo);
    let refsOk = true;
    for (const b of c.brands) if (!brandIds.has(b)) (errors.push(`${where}: unknown brand ${b}`), (refsOk = false));
    for (const pid of [...c.problems.fixed, ...c.problems.pool]) {
      if (!problemIds.has(pid)) (errors.push(`${where}: unknown problem ${pid}`), (refsOk = false));
    }
    for (const m of c.minigames) if (!(MINIGAME_IDS as readonly string[]).includes(m)) errors.push(`${where}: unknown minigame ${m}`);
    if (c.problems.fixed.length + c.problems.extra[1] === 0) errors.push(`${where}: case has no problems to fix`);
    if (c.problems.extra[1] > c.problems.pool.length) errors.push(`${where}: extra max ${c.problems.extra[1]} is larger than the pool`);
    if (c.problems.extra[1] > 2) warnings.push(`${where}: up to ${c.problems.extra[1]} extra hidden problems (the design allows 0–2)`);
    if (c.customer.keepData && !c.machine.diskHasData) errors.push(`${where}: customer wants to keep files but machine.diskHasData is false`);
    dupes([...c.problems.fixed, ...c.problems.pool], `${where}: problem listed twice`, errors);
    if (c.order === 1 && (c.problems.fixed.length > 1 || c.problems.extra[1] > 0)) warnings.push(`${where}: the first customer should be easy (one fixed problem)`);
    if (!refsOk) continue;

    const fixed = c.problems.fixed.map((id) => parsed.problems.find((p) => p.id === id)!);
    fixed.forEach((p, i) => {
      const why = conflicts(fixed.slice(0, i), p);
      if (why) errors.push(`${where}: fixed problems contradict each other: ${why}`);
    });

    const failures = new Map<string, string>();
    for (let s = 0; s < seeds; s++) {
      const g = generateCase(c, parsed, `v${s}`);
      checked++;
      const tag = (msg: string) => failures.has(msg) || failures.set(msg, `seed v${s}, brand ${g.brand.id}`);
      const baseBlockers = findBlockers(g.base);
      if (baseBlockers.length) tag(`machine is already broken before problems are added (${baseBlockers.join(', ')}); use a problem instead`);
      const limits = hardwareLimits(g.base);
      if (limits.length) tag(`machine can never run Windows 11 (${limits.join(', ')})`);
      const blockers = findBlockers(g.machine);
      for (const p of g.problems) {
        const others = Object.fromEntries(Object.entries(p.requires).filter(([k]) => !(k in p.patch))) as MachinePatch;
        if (!matches(g.machine, others)) tag(`problem ${p.id}: its requirements are not met on this machine`);
        if (!blockers.includes(p.blocker as never)) tag(`problem ${p.id} is hidden by another problem (blocker ${p.blocker} never shows)`);
        const usable = p.fixes.filter((f) => {
          const a = ACTIONS.find((x) => x.id === f);
          return a && !(c.customer.keepData && a.destructive) && brandShows(g.brand, a);
        });
        if (usable.length === 0) tag(`problem ${p.id}: no listed fix is allowed here (keepData=${c.customer.keepData}, brand ${g.brand.id})`);
      }
      if (!solve(g.machine, g.brand, { keepData: c.customer.keepData })) tag('no sequence of repairs fixes this machine');
    }
    for (const [msg, at] of failures) errors.push(`${where}: ${msg} [${at}]`);
  }
  return checked;
}

function checkQuizzes(quizzes: readonly Quiz[], checkLo: (w: string, l: readonly string[]) => void, errors: string[], warnings: string[]): void {
  dupes(quizzes.map((q) => q.id), 'quizzes: duplicate quiz', errors);
  dupes(quizzes.flatMap((q) => q.items.map((i) => i.id)), 'quizzes: duplicate question id', errors);
  for (const q of quizzes) {
    const where = `quizzes/${q.id}.json`;
    if (q.draft) warnings.push(`${where}: ข้อสอบยังเป็นร่าง`);
    dupes(q.items.map((i) => i.pair), `${where}: duplicate pair`, errors);
    for (const it of q.items) {
      checkLo(`${where}[${it.id}]`, [it.lo]);
      if (it.answer >= it.choicesTh.length) errors.push(`${where}[${it.id}]: answer ${it.answer} is out of range`);
      dupes(it.choicesTh, `${where}[${it.id}]: duplicate choice`, errors);
    }
  }
  for (const kind of ['pre', 'mid', 'post'] as const) {
    const a = quizzes.find((q) => q.kind === kind && q.form === 'A');
    const b = quizzes.find((q) => q.kind === kind && q.form === 'B');
    if (!a && !b) continue;
    if (!a || !b) {
      errors.push(`quizzes: ${kind}-test has form ${a ? 'A' : 'B'} but no parallel form ${a ? 'B' : 'A'}`);
      continue;
    }
    for (const ia of a.items) {
      const ib = b.items.find((x) => x.pair === ia.pair);
      if (!ib) errors.push(`quizzes: ${a.id} pair "${ia.pair}" has no parallel item in ${b.id}`);
      else if (ib.lo !== ia.lo) errors.push(`quizzes: pair "${ia.pair}" tests ${ia.lo} in ${a.id} but ${ib.lo} in ${b.id}`);
    }
    for (const ib of b.items) if (!a.items.some((x) => x.pair === ib.pair)) errors.push(`quizzes: ${b.id} pair "${ib.pair}" has no parallel item in ${a.id}`);
  }
}

function checkCards(parsed: ParsedContent, errors: string[], warnings: string[]): void {
  const cards = parsed.cards;
  if (!cards) return;
  dupes(cards.cards.map((c) => c.id), 'cards.json: duplicate card', errors);
  const setIds = new Set(cards.sets.map((s) => s.id));
  const problemIds = new Set(parsed.problems.map((p) => p.id));
  for (const c of cards.cards) {
    if (!setIds.has(c.set)) errors.push(`cards.json[${c.id}]: unknown set ${c.set}`);
    for (const p of c.linkedProblems) if (!problemIds.has(p)) errors.push(`cards.json[${c.id}]: unknown problem ${p}`);
  }
  if (cards.draft) warnings.push('cards.json: เนื้อหาการ์ดยังเป็นร่าง');
  if (cards.sets.length !== 6 || cards.cards.length !== 30) {
    warnings.push(`cards.json: แผนคือ 30 ใบ 6 ชุด ตอนนี้มี ${cards.cards.length} ใบ ${cards.sets.length} ชุด`);
  }
}
