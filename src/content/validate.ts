// Content validator: schema checks plus game-rule checks (every case fixable, no
// contradictory hidden problems, BIOS screens expose the settings a fix needs, the course test answerable).
// Pure function so the CLI, unit tests and (later) an in-game editor can all use it.

import { z } from 'zod';
import { ACTIONS, ACTION_IDS } from '../core/actions';
import { brandShows, conflicts, generateCase, solve } from '../core/cases';
import { applyPatch, healthyMachine, matches, type Machine, type MachinePatch } from '../core/machine';
import { DRIVES, OPTION_VALUES } from '../core/pc';
import { BLOCKER_IDS, findBlockers, hardwareLimits } from '../core/requirements';
import {
  BIOS_SETTINGS,
  BrandSchema,
  CardsSchema,
  CUTSCENE_FACES,
  CutscenesSchema,
  Win11CheckSchema,
  CaseSchema,
  CustomersSchema,
  ObjectivesSchema,
  ProblemsSchema,
  CourseTestSchema,
  OrderSchema,
  LessonsSchema,
  type Brand,
  type Cards,
  type Cutscenes,
  type Win11Check,
  type Case,
  type CaseQuestion,
  type Customer,
  type Objectives,
  type Problem,
  type CourseTest,
  type Order,
  type Lessons,
} from './schema';
import { WIN11_CHECK_IDS } from '../core/win11check';
import { nameError } from '../core/oobe';
import type { VoiceIndex } from '../core/lesson';
import { STEPS, STEP_INFO } from '../core/path';

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
  customers: Customer[];
  test?: CourseTest;
  cards?: Cards;
  win11Check?: Win11Check;
  cutscenes?: Cutscenes;
  order?: Order;
  lessons?: Lessons;
}

export interface ValidateOptions {
  seedsPerCase?: number;
  /** The lesson voice (src/assets/voice/index.json) and the mp3 files there, when the caller can read them. */
  voice?: { index: VoiceIndex | null; files: readonly string[] };
}

export function validateContent(files: readonly ContentFile[], opts: ValidateOptions = {}): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = parseAll(files, errors);
  const seeds = opts.seedsPerCase ?? 40;

  const loIds = new Set(parsed.objectives?.items.map((o) => o.id) ?? []);
  if (!parsed.objectives) errors.push('objectives.json: missing');
  else {
    dupes(
      parsed.objectives.items.map((o) => o.id),
      'objectives.json: duplicate objective',
      errors,
    );
    if (parsed.objectives.draft) warnings.push('objectives.json: ยังเป็นร่าง (draft) ต้องแทนด้วยวัตถุประสงค์จริงของรายวิชา');
  }
  const checkLo = (where: string, los: readonly string[]) => {
    for (const lo of los) if (!loIds.has(lo)) errors.push(`${where}: unknown objective ${lo}`);
  };

  checkBrands(parsed.brands, errors, warnings);
  checkProblems(parsed, checkLo, errors);
  const generated = checkCases(parsed, seeds, checkLo, errors, warnings);
  checkTest(parsed.test, errors, warnings);
  checkOrder(parsed.order, errors, warnings);
  checkCards(parsed, errors, warnings);
  checkWin11Check(parsed, errors);
  checkCutscenes(parsed, errors, warnings);
  checkLessons(parsed.lessons, opts.voice, errors, warnings);

  return {
    errors,
    warnings,
    stats: {
      cases: parsed.cases.length,
      problems: parsed.problems.length,
      brands: parsed.brands.length,
      testItems: parsed.test?.items.length ?? 0,
      orderSteps: parsed.order?.rounds.reduce((n, r) => n + r.steps.length, 0) ?? 0,
      cards: parsed.cards?.cards.length ?? 0,
      lessonLines: parsed.lessons?.lessons.reduce((n, l) => n + l.lines.length, 0) ?? 0,
      machinesChecked: generated,
    },
  };
}

/** Schema-parses every file (applying defaults); problems go into `errors`. */
export function parseAll(files: readonly ContentFile[], errors: string[]): ParsedContent {
  const out: ParsedContent = { problems: [], brands: [], cases: [], customers: [] };
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
    else if (f.path === 'customers.json') out.customers = parse(CustomersSchema, f) ?? [];
    else if (f.path === 'win11-check.json') out.win11Check = parse(Win11CheckSchema, f);
    else if (f.path === 'cutscenes.json') out.cutscenes = parse(CutscenesSchema, f);
    else if (f.path.startsWith('brands/')) push(out.brands, parse(BrandSchema, f), f.path, errors);
    else if (f.path.startsWith('cases/')) push(out.cases, parse(CaseSchema, f), f.path, errors);
    else if (f.path === 'test.json') out.test = parse(CourseTestSchema, f);
    else if (f.path === 'order.json') out.order = parse(OrderSchema, f);
    else if (f.path === 'lessons.json') out.lessons = parse(LessonsSchema, f);
    else
      errors.push(
        `${f.path}: not a known content file (expected objectives, problems, customers, cards, win11-check, cutscenes, test, order, lessons, brands/, cases/)`,
      );
  }
  return out;
}

function push<T extends { id: string }>(list: T[], item: T | undefined, path: string, errors: string[]): void {
  if (!item) return;
  const stem = path
    .split('/')
    .pop()!
    .replace(/\.json$/, '');
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
  dupes(
    brands.map((b) => b.id),
    'brands: duplicate brand',
    errors,
  );
  for (const b of brands) {
    const where = `brands/${b.id}.json`;
    if (!b.verified) warnings.push(`${where}: ยังไม่ได้เทียบกับเครื่องจริงในห้องปฏิบัติการ (verified: false)`);
    const shown = new Set(b.pages.flatMap((p) => p.items.map((i) => i.setting)));
    const missing = BIOS_SETTINGS.filter((s) => !shown.has(s) && !(s === 'supervisorPassword' && !b.quirks.secureBootNeedsSupervisorPassword));
    if (b.phase === 'mvp' && missing.length) errors.push(`${where}: MVP brand is missing BIOS settings: ${missing.join(', ')}`);
    if (b.pages.some((p) => p.items.some((i) => i.advancedOnly)) && !b.quirks.hasAdvancedMode) {
      errors.push(`${where}: items are advancedOnly but quirks.hasAdvancedMode is false`);
    }
    if (b.phase === 'mvp' && !b.menu) errors.push(`${where}: MVP brand has no playable "menu"`);
    if (b.menu) checkMenu(b, where, shown, errors, warnings);
  }
}

/** The playable menu must be well-linked, editable by src/core/pc.ts, and offer the same settings as `pages`. */
function checkMenu(b: Brand, where: string, shown: ReadonlySet<string>, errors: string[], warnings: string[]): void {
  const menu = b.menu!;
  const exists = (id: string, from: string) => menu.menus[id] || errors.push(`${where}: ${from} links to unknown menu "${id}"`);
  menu.tabs.forEach((t) => exists(t.menu, `tab ${t.label}`));
  const inMenu = new Set<string>();
  const reached = new Set(menu.tabs.map((t) => t.menu));
  for (const [id, page] of Object.entries(menu.menus)) {
    for (const r of page.rows) {
      const at = `menu "${id}" row "${r.label}"`;
      if (r.type === 'submenu') exists(r.menu, at) && reached.add(r.menu);
      if (r.type === 'option') {
        inMenu.add(r.setting);
        const allowed = OPTION_VALUES[r.setting];
        if (!allowed) errors.push(`${where}: ${at}: setting ${r.setting} cannot be an option`);
        else {
          const bad = r.choices.filter((c) => !allowed.includes(c.value));
          if (bad.length)
            errors.push(
              `${where}: ${at}: ${r.setting} cannot be ${bad.map((c) => JSON.stringify(c.value)).join(', ')} (allowed: ${allowed.join(', ')})`,
            );
          dupes(
            r.choices.map((c) => String(c.value)),
            `${where}: ${at}: duplicate choice`,
            errors,
          );
        }
      }
      if (r.type === 'drive' || r.type === 'bootDevice') {
        inMenu.add('bootOrder');
        if (r.slot >= DRIVES.length) errors.push(`${where}: ${at}: slot ${r.slot} but the machine has ${DRIVES.length} drives`);
      }
    }
  }
  for (const id of Object.keys(menu.menus)) if (!reached.has(id)) warnings.push(`${where}: menu "${id}" cannot be reached from any tab`);
  if (!Object.values(menu.menus).some((p) => p.rows.some((r) => r.type === 'exit' && r.action === 'save'))) {
    errors.push(`${where}: menu has no "Save Changes and Exit" row`);
  }
  const notPlayable = [...shown].filter((s) => !inMenu.has(s));
  const notListed = [...inMenu].filter((s) => !shown.has(s));
  if (notPlayable.length) errors.push(`${where}: pages list ${notPlayable.join(', ')} but the playable menu has no row for it`);
  if (notListed.length) errors.push(`${where}: the playable menu edits ${notListed.join(', ')} but pages do not list it`);
}

function checkProblems(parsed: ParsedContent, checkLo: (w: string, l: readonly string[]) => void, errors: string[]): void {
  dupes(
    parsed.problems.map((p) => p.id),
    'problems.json: duplicate problem',
    errors,
  );
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

/** The requirements table has every row once, and exists when a case uses it. */
function checkWin11Check(parsed: ParsedContent, errors: string[]): void {
  const rows = parsed.win11Check?.rows ?? [];
  dupes(
    rows.map((r) => r.id),
    'win11-check.json: duplicate row',
    errors,
  );
  for (const id of WIN11_CHECK_IDS) if (parsed.win11Check && !rows.some((r) => r.id === id)) errors.push(`win11-check.json: missing row ${id}`);
  const users = parsed.cases.filter((c) => c.minigames.includes('win11-check')).map((c) => c.id);
  if (users.length && !parsed.win11Check) errors.push(`win11-check.json: missing, but used by ${users.join(', ')}`);
}

/** Repairs done on Setup's later pages, not before it. */
const SETUP_FIXES: readonly string[] = ['setup-delete-all', 'skip-product-key'];

function checkCases(
  parsed: ParsedContent,
  seeds: number,
  checkLo: (w: string, l: readonly string[]) => void,
  errors: string[],
  warnings: string[],
): number {
  dupes(
    parsed.cases.map((c) => c.id),
    'cases: duplicate case',
    errors,
  );
  dupes(
    parsed.cases.map((c) => String(c.order)),
    'cases: duplicate order',
    errors,
  );
  const brandIds = new Set(parsed.brands.map((b) => b.id));
  const problemIds = new Set(parsed.problems.map((p) => p.id));
  const customerIds = new Set(parsed.customers.map((c) => c.id));
  dupes(
    parsed.customers.map((c) => c.id),
    'customers.json: duplicate customer',
    errors,
  );
  let checked = 0;

  for (const c of [...parsed.cases].sort((a, b) => a.order - b.order)) {
    const where = `cases/${c.id}.json`;
    checkLo(where, c.lo);
    if (!customerIds.has(c.customer.id)) errors.push(`${where}: unknown customer ${c.customer.id} (add it to customers.json)`);
    checkQuestion(`${where} diagnosis`, c.diagnosis, errors);
    c.customerQuestions.forEach((q, i) => {
      checkQuestion(`${where} customerQuestions[${i}]`, q, errors);
      if (!q.askTh) errors.push(`${where} customerQuestions[${i}]: missing askTh (what the customer asks)`);
    });
    let refsOk = true;
    for (const b of c.brands) if (!brandIds.has(b)) (errors.push(`${where}: unknown brand ${b}`), (refsOk = false));
    // The tip names the keys, so it must match every brand the case can draw.
    for (const b of c.coach ? parsed.brands.filter((x) => c.brands.includes(x.id)) : []) {
      const keys = [b.keys.setup[0]!, b.keys.bootMenu[0]!].filter((k) => !c.coach!.beforePcTh.includes(k));
      if (keys.length) errors.push(`${where}: coach.beforePcTh does not name ${keys.join(', ')} (keys of brand ${b.id})`);
    }
    for (const pid of [...c.problems.fixed, ...c.problems.pool]) {
      if (!problemIds.has(pid)) (errors.push(`${where}: unknown problem ${pid}`), (refsOk = false));
    }
    for (const m of c.minigames) if (!(MINIGAME_IDS as readonly string[]).includes(m)) errors.push(`${where}: unknown minigame ${m}`);
    if (c.problems.fixed.length + c.problems.extra[1] === 0) errors.push(`${where}: case has no problems to fix`);
    if (c.problems.extra[1] > c.problems.pool.length) errors.push(`${where}: extra max ${c.problems.extra[1]} is larger than the pool`);
    if (c.problems.extra[1] > 2) warnings.push(`${where}: up to ${c.problems.extra[1]} extra hidden problems (the design allows 0–2)`);
    if (c.customer.keepData && !c.machine.diskHasData) errors.push(`${where}: customer wants to keep files but machine.diskHasData is false`);
    if (c.customer.filesNotNeeded && c.customer.keepData) errors.push(`${where}: customer cannot both keep the files and not need them`);
    if (c.goal === 'desktop' && !c.deviceName) errors.push(`${where}: goal "desktop" needs the deviceName on the ticket`);
    if (c.deviceName && c.goal !== 'desktop') errors.push(`${where}: deviceName is only used when the goal is "desktop"`);
    if (c.deviceName && nameError(c.deviceName))
      errors.push(`${where}: deviceName ${c.deviceName} breaks Windows' naming rule (${nameError(c.deviceName)})`);
    dupes([...c.problems.fixed, ...c.problems.pool], `${where}: problem listed twice`, errors);
    if (c.order === 1 && (c.problems.fixed.length > 1 || c.problems.extra[1] > 0))
      warnings.push(`${where}: the first customer should be easy (one fixed problem)`);
    if (!refsOk) continue;

    const fixed = c.problems.fixed.map((id) => parsed.problems.find((p) => p.id === id)!);
    const pool = c.problems.pool.map((id) => parsed.problems.find((p) => p.id === id)!);
    // Problems fixed inside Setup (product key, partitions) only show after its first page.
    const inSetup = [...fixed, ...pool].filter((p) => p.fixes.some((f) => SETUP_FIXES.includes(f))).map((p) => p.id);
    const photo = c.diagnosisPhoto && fixed.find((p) => p.id === c.diagnosisPhoto!.problem);
    if (c.diagnosisPhoto && !photo?.screenText) errors.push(`${where}: diagnosisPhoto must name a fixed problem that has screenText`);
    if (c.goal === 'setup' && inSetup.length) errors.push(`${where}: ${inSetup.join(', ')} show only past Setup's first page; set "goal": "install"`);
    // The first five cases are the textbook part of the game: topics beyond the book belong in later cases.
    const beyond = [...fixed, ...pool].filter((p) => p.source === 'extra').map((p) => p.id);
    if (c.order <= 5 && beyond.length) warnings.push(`${where}: เคสช่วงต้นใช้เรื่องนอกหนังสือ (${beyond.join(', ')}) ควรย้ายไปเคสขั้นสูง`);
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

function checkQuestion(where: string, q: CaseQuestion, errors: string[]): void {
  if (q.answer >= q.choicesTh.length) errors.push(`${where}: answer ${q.answer} is out of range`);
  dupes(q.choicesTh, `${where}: duplicate choice`, errors);
}

/** Every answer is one of its choices, choices differ, and objectives 1-3 are each tested. */
function checkTest(test: CourseTest | undefined, errors: string[], warnings: string[]): void {
  if (!test) {
    errors.push('test.json: missing');
    return;
  }
  if (test.draft) warnings.push('test.json: ข้อสอบยังเป็นร่าง');
  dupes(
    test.items.map((i) => i.id),
    'test.json: duplicate question id',
    errors,
  );
  for (const it of test.items) {
    if (it.answer >= it.choicesTh.length) errors.push(`test.json[${it.id}]: answer ${it.answer} is out of range`);
    dupes(it.choicesTh, `test.json[${it.id}]: duplicate choice`, errors);
  }
  for (const o of [1, 2, 3]) if (!test.items.some((i) => i.objective === o)) errors.push(`test.json: no question for objective ${o}`);
}

/** The ordering game: every card is told apart by id and by its text (the learner sees only the text), and the
 *  boss opens up a step of the first round into another round. */
function checkOrder(order: Order | undefined, errors: string[], warnings: string[]): void {
  if (!order) {
    errors.push('order.json: missing');
    return;
  }
  if (order.draft) warnings.push('order.json: คำใบ้และการ์ดกับดักยังเป็นร่าง รอข้อความจาก ChatGPT');
  const cards = [...order.rounds.flatMap((r) => r.steps), ...order.traps];
  dupes(
    order.rounds.map((r) => r.id),
    'order.json: duplicate round',
    errors,
  );
  dupes(
    cards.map((c) => c.id),
    'order.json: duplicate card id',
    errors,
  );
  dupes(
    cards.map((c) => c.th),
    'order.json: duplicate card text',
    errors,
  );
  const [first, ...rest] = order.rounds;
  if (!first!.steps.some((s) => s.id === order.boss.expand))
    errors.push(`order.json: boss expands "${order.boss.expand}", not a step of the first round`);
  if (!rest.some((r) => r.id === order.boss.into)) errors.push(`order.json: boss opens into "${order.boss.into}", not a later round`);
  if (order.traps.length < 4) warnings.push(`order.json: มีการ์ดกับดักแค่ ${order.traps.length} ใบ (แผนคือ 4–6)`);
}

function checkCards(parsed: ParsedContent, errors: string[], warnings: string[]): void {
  const cards = parsed.cards;
  if (!cards) return;
  dupes(
    cards.cards.map((c) => c.id),
    'cards.json: duplicate card',
    errors,
  );
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

/** The welcome talk exists, every talk belongs to a case (or is the welcome), faces exist for their speaker. */
function checkCutscenes(parsed: ParsedContent, errors: string[], warnings: string[]): void {
  const cs = parsed.cutscenes;
  if (!cs) {
    errors.push('cutscenes.json: missing');
    return;
  }
  if (cs.draft) warnings.push('cutscenes.json: บทคุยกับพี่ช่างยังเป็นร่าง (draft) รอบทจริง');
  dupes(
    cs.scenes.map((s) => s.id),
    'cutscenes.json: duplicate scene',
    errors,
  );
  const caseIds = new Set(parsed.cases.map((c) => c.id));
  if (!cs.scenes.some((s) => s.id === 'intro')) errors.push('cutscenes.json: no "intro" scene (the welcome)');
  for (const s of cs.scenes) {
    if (s.id !== 'intro' && !caseIds.has(s.id)) errors.push(`cutscenes.json: scene "${s.id}" is not "intro" or a case id`);
    for (const [i, l] of s.lines.entries()) {
      const faces: readonly string[] = CUTSCENE_FACES[l.who];
      if (!faces.includes(l.face)) errors.push(`cutscenes.json: ${s.id} line ${i + 1}: ${l.who} has no "${l.face}" face`);
    }
  }
}

/** One cartoon per lesson step, for its objective; questions answerable and asked after a real line, each going
 *  back to a line before it; and, when the voice was given, a recording for everything said. */
function checkLessons(lessons: Lessons | undefined, voice: ValidateOptions['voice'], errors: string[], warnings: string[]): void {
  if (!lessons) {
    errors.push('lessons.json: missing');
    return;
  }
  if (lessons.draft) warnings.push('lessons.json: บทการ์ตูนบทเรียนยังเป็นร่าง รอบทฉบับแก้จาก ChatGPT');
  dupes(
    lessons.lessons.map((l) => l.id),
    'lessons.json: duplicate lesson',
    errors,
  );
  const steps = STEPS.filter((id) => id.startsWith('lesson-'));
  for (const id of steps) if (!lessons.lessons.some((l) => l.id === id)) errors.push(`lessons.json: no lesson for step "${id}"`);
  for (const l of lessons.lessons) {
    const where = `lessons.json[${l.id}]`;
    if (!(steps as readonly string[]).includes(l.id)) {
      errors.push(`${where}: not a lesson step (${steps.join(', ')})`);
      continue;
    }
    const objective = STEP_INFO[l.id as (typeof steps)[number]].objective;
    if (l.objective !== objective) errors.push(`${where}: objective ${l.objective}, but the step is for objective ${objective}`);
    const bare = l.lines.filter((x) => !x.demo).length;
    if (bare) warnings.push(`${where}: ยังไม่มีการสาธิตบนจอในคลิป ${bare} ประโยค`);
    dupes(
      l.questions.map((q) => String(q.after)),
      `${where}: two questions after line`,
      errors,
    );
    for (const [i, q] of l.questions.entries()) {
      const at = `${where} question ${i + 1}`;
      if (q.answer >= q.choicesTh.length) errors.push(`${at}: answer ${q.answer} is out of range`);
      dupes(q.choicesTh, `${at}: duplicate choice`, errors);
      if (q.after > l.lines.length) errors.push(`${at}: after line ${q.after}, but there are ${l.lines.length} lines`);
      if (q.replay > q.after) errors.push(`${at}: goes back to line ${q.replay}, after the question (line ${q.after})`);
    }
  }
  if (!voice) return;
  const said = lessons.lessons.flatMap((l) => [...l.lines.map((x) => x.say), ...l.questions.flatMap((q) => [q.right.say, q.wrong.say])]);
  const lines = voice.index?.lines ?? {};
  const missing = said.filter((t) => !lines[t]);
  if (missing.length)
    (lessons.draft ? warnings : errors).push(`lessons.json: ยังไม่มีเสียง ${missing.length} ประโยค (รัน npm run voice) เช่น "${missing[0]}"`);
  const files = new Set(voice.files);
  for (const t of said) if (lines[t] && !files.has(lines[t].file)) errors.push(`voice/index.json: "${t}" has no file ${lines[t].file}`);
  const unused = Object.keys(lines).filter((t) => !said.includes(t)).length;
  if (unused) warnings.push(`voice/index.json: เสียงที่ไม่ได้ใช้แล้ว ${unused} ประโยค (npm run voice -- --prune)`);
}
