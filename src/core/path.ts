// The learning path the menu shows (docs/learning-path-plan.md, approved 27 Oct 2026): pre-test, two lessons,
// step ordering, the shop's cases, post-test, reflection, results. Pure data in, data out: the UI keeps the
// saved progress (src/ui/progress.ts) and asks here what is open and what to do next.
// Steps not built yet are "soon" and lock nothing, so the path works while items 2-7 are being made.
// The shop opens once the learning before it is done (docs/learning-page-plan.md, approved 28 Oct 2026).

import { orderStars, type OrderResult } from './order';
import type { TestDraft } from './quiz';

export const STEPS = ['pre', 'lesson-os', 'lesson-types', 'order', 'cases', 'post', 'reflect', 'results'] as const;
export type StepId = (typeof STEPS)[number];

/** Card titles, and which of the four objectives (docs/learning-path-plan.md) each step serves. */
export const STEP_INFO: Record<StepId, { th: string; objective: number | null }> = {
  pre: { th: 'แบบทดสอบก่อนเรียน', objective: null },
  'lesson-os': { th: 'บทเรียน: ระบบปฏิบัติการคืออะไร', objective: 1 },
  'lesson-types': { th: 'บทเรียน: ประเภทของระบบปฏิบัติการ', objective: 2 },
  order: { th: 'เรียงขั้นตอนการติดตั้ง', objective: 3 },
  cases: { th: 'ฝึกงานที่ร้าน', objective: 4 },
  post: { th: 'แบบทดสอบหลังเรียน', objective: null },
  reflect: { th: 'สะท้อนผลและประเมินความพึงพอใจ', objective: null },
  results: { th: 'สรุปผลการเรียน', objective: null },
};

/** Tests are taken once, so the pre/post comparison means something. */
const ONCE: ReadonlySet<StepId> = new Set(['pre', 'post']);

export interface Learner {
  name: string;
  room: string;
  no: string;
}

export interface QuizResult {
  score: number;
  total: number;
  /** Per item id, the original index of the choice picked (src/core/quiz.ts). */
  answers: Record<string, number>;
  at: number;
  /** Time taken. */
  seconds: number;
}

export interface CaseRecord {
  /** Best stars over all plays. */
  stars: number;
  plays: number;
}

export interface OrderRecord {
  /** Best stars over all plays (1-3). */
  stars: number;
  plays: number;
  /** The first play as it went, for the teacher's page. */
  first: OrderResult;
}

/** A lesson: 1 once its video was watched (else 0), and the first answer to each of its questions (-1: not answered yet). */
export interface LessonRecord {
  at: number;
  first: number[];
}

export interface Progress {
  coins: number;
  learner: Learner | null;
  pre: QuizResult | null;
  post: QuizResult | null;
  /** Steps finished that keep no score of their own: the lessons, the ordering game, the reflection. */
  done: StepId[];
  cases: Record<string, CaseRecord>;
  /** Cutscenes already shown on their own: 'intro' (the welcome) and case ids (the talk before a case). */
  seen: string[];
  /** A test left half way, to carry on with. */
  testDraft: TestDraft | null;
  /** The step-ordering game (docs/order-plan.md). */
  order: OrderRecord | null;
  /** The lesson cartoons by step id (docs/lessons-plan.md). */
  lessons: Record<string, LessonRecord>;
}

export const EMPTY: Progress = {
  coins: 0,
  learner: null,
  pre: null,
  post: null,
  done: [],
  cases: {},
  seen: [],
  testDraft: null,
  order: null,
  lessons: {},
};

/** What is learned before the shop: the pre-test, both lessons and the step ordering. */
const BEFORE_SHOP: readonly StepId[] = ['pre', 'lesson-os', 'lesson-types', 'order'];

export type Status = 'soon' | 'locked' | 'open' | 'done';

export interface PathView {
  steps: { id: StepId; status: Status; canEnter: boolean }[];
  /** The playable cases in order, each open once the one before it has been played. */
  cases: { id: string; status: Exclude<Status, 'soon'>; stars: number | null }[];
  /** What "ทำต่อ" opens. */
  next: { step: StepId; caseId?: string };
}

export interface PathOptions {
  /** Steps whose screens exist. */
  built: ReadonlySet<StepId>;
  /** Playable case ids in play order. */
  caseIds: readonly string[];
  /** ?unlock=all: the teacher's demo, every step open and enterable. */
  unlockAll?: boolean;
}

const played = (p: Progress, caseId: string | undefined) => caseId !== undefined && (p.cases[caseId]?.plays ?? 0) > 0;

function isDone(p: Progress, id: StepId, o: PathOptions): boolean {
  if (id === 'pre') return p.pre !== null;
  if (id === 'post') return p.post !== null;
  if (id === 'cases') return o.caseIds.length > 0 && o.caseIds.every((c) => played(p, c));
  if (id === 'results') return false;
  return p.done.includes(id);
}

/** Every step and case with its status, and the recommended next step. */
export function pathView(p: Progress, o: PathOptions): PathView {
  const done = (id: StepId) => isDone(p, id, o);
  // The pre-test comes first, but only once it exists.
  const gate = !o.built.has('pre') || done('pre');
  const learned = BEFORE_SHOP.every((id) => !o.built.has(id) || done(id));
  const casesDone = done('cases');
  const afterPost = o.built.has('post') ? done('post') : casesDone;

  const opens: Record<StepId, boolean> = {
    pre: true,
    'lesson-os': gate,
    'lesson-types': gate,
    order: gate,
    cases: learned,
    post: learned && casesDone,
    reflect: gate && afterPost,
    results: true,
  };

  const steps = STEPS.map((id) => {
    if (!o.built.has(id)) return { id, status: 'soon' as const, canEnter: false };
    const status: Status = done(id) ? 'done' : opens[id] || o.unlockAll ? 'open' : 'locked';
    const canEnter = !!o.unlockAll || status === 'open' || (status === 'done' && !ONCE.has(id));
    return { id, status, canEnter };
  });

  const cases = o.caseIds.map((id, i) => {
    const status: Exclude<Status, 'soon'> = played(p, id)
      ? 'done'
      : (learned && (i === 0 || played(p, o.caseIds[i - 1]))) || o.unlockAll
        ? 'open'
        : 'locked';
    return { id, status, stars: played(p, id) ? p.cases[id]!.stars : null };
  });

  return { steps, cases, next: nextStep(steps, cases) };
}

function nextStep(steps: PathView['steps'], cases: PathView['cases']): PathView['next'] {
  for (const s of steps) {
    if (s.status !== 'open') continue;
    if (s.id !== 'cases') return { step: s.id };
    const c = cases.find((x) => x.status === 'open');
    if (c) return { step: 'cases', caseId: c.id };
  }
  return { step: 'results' };
}

/** A case finished: count the play and keep the best stars. */
export function recordCase(p: Progress, caseId: string, stars: number): Progress {
  const rec = p.cases[caseId];
  return { ...p, cases: { ...p.cases, [caseId]: { stars: Math.max(stars, rec?.stars ?? 0), plays: (rec?.plays ?? 0) + 1 } } };
}

/** A lesson, the ordering game or the reflection finished. */
export function markDone(p: Progress, id: StepId): Progress {
  return p.done.includes(id) ? p : { ...p, done: [...p.done, id] };
}

/** The ordering game finished: the step is done, the best stars kept, the first play kept as it went. */
export function recordOrder(p: Progress, r: OrderResult): Progress {
  const rec = p.order;
  const order = { stars: Math.max(orderStars(r), rec?.stars ?? 0), plays: (rec?.plays ?? 0) + 1, first: rec?.first ?? r };
  return { ...markDone(p, 'order'), order };
}

/** Saves a lesson's state and its answers; a first answer once given stays. `at` is 1 once its video has been
 *  watched (its questions then open straight away). `done` when every question is answered right: the step is done
 *  and it starts from the top next time. */
export function recordLesson(p: Progress, id: StepId, r: { at: number; first: number[]; done: boolean }): Progress {
  const old = p.lessons[id]?.first ?? [];
  const first = r.first.map((a, i) => (old[i] !== undefined && old[i] >= 0 ? old[i] : a));
  const lessons = { ...p.lessons, [id]: { at: r.done ? 0 : r.at, first } };
  return { ...(r.done ? markDone(p, id) : p), lessons };
}

/** A cutscene was shown, so it does not start by itself again (it can still be replayed). */
export function markSeen(p: Progress, id: string): Progress {
  return p.seen.includes(id) ? p : { ...p, seen: [...p.seen, id] };
}

/** Stores a test result; the first one stands (tests are taken once, a teacher's retake is not kept).
 *  The finished sitting goes either way. */
export function recordQuiz(p: Progress, kind: 'pre' | 'post', r: QuizResult): Progress {
  const testDraft = p.testDraft?.kind === kind ? null : p.testDraft;
  return p[kind] ? { ...p, testDraft } : { ...p, [kind]: r, testDraft };
}

/** Why the name form cannot be saved yet, or null. */
export function learnerError(l: Learner): string | null {
  if (!l.name.trim()) return 'กรอกชื่อ-สกุล';
  if (l.name.trim().length > 60) return 'ชื่อ-สกุลยาวเกิน 60 ตัวอักษร';
  if (!l.room.trim()) return 'กรอกชั้น เช่น ปวช.1/2';
  if (l.room.trim().length > 20) return 'ชั้นยาวเกิน 20 ตัวอักษร';
  if (!/^\d{1,2}$/.test(l.no.trim()) || Number(l.no) < 1) return 'เลขที่ต้องเป็นตัวเลข 1-99';
  return null;
}

// Saved progress. Version 1 kept only the coins; anything unreadable is dropped field by field so one bad
// value never costs the rest.

export const STORAGE_KEY = 'shop.progress.v2';
export const OLD_STORAGE_KEY = 'shop.progress.v1';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null);
const str = (v: unknown) => (typeof v === 'string' ? v : null);

/** { id: index } with whole numbers only. */
function indexMap(v: unknown): Record<string, number> | null {
  if (!isObj(v)) return null;
  return Object.values(v).every((a) => count(a) !== null) ? (v as Record<string, number>) : null;
}

function quiz(v: unknown): QuizResult | null {
  if (!isObj(v)) return null;
  const score = count(v.score);
  const total = count(v.total);
  const at = count(v.at);
  const seconds = count(v.seconds) ?? 0;
  const answers = indexMap(v.answers);
  if (score === null || total === null || at === null || !answers || score > total) return null;
  return { score, total, answers, at, seconds };
}

/** The shape only; whether it still fits the test is quiz.ts's resumable(). */
function draft(v: unknown): TestDraft | null {
  if (!isObj(v) || (v.kind !== 'pre' && v.kind !== 'post')) return null;
  const order = Array.isArray(v.order) && v.order.every((x) => typeof x === 'string') ? (v.order as string[]) : null;
  const answers = indexMap(v.answers);
  const startedAt = count(v.startedAt);
  if (!order || !answers || startedAt === null || !isObj(v.choices)) return null;
  const choices: Record<string, number[]> = {};
  for (const [id, c] of Object.entries(v.choices)) {
    if (!Array.isArray(c) || !c.every((x) => count(x) !== null)) return null;
    choices[id] = c as number[];
  }
  return { kind: v.kind, order, choices, answers, startedAt };
}

function orderRecord(v: unknown): OrderRecord | null {
  if (!isObj(v) || !isObj(v.first)) return null;
  const stars = count(v.stars);
  const plays = count(v.plays);
  const { tries, solved, lost } = v.first;
  const okTries = Array.isArray(tries) && tries.every((t) => count(t) !== null);
  const okSolved = Array.isArray(solved) && solved.every((s) => typeof s === 'boolean');
  if (stars === null || stars < 1 || stars > 3 || plays === null || plays < 1 || !okTries || !okSolved || count(lost) === null) return null;
  return { stars, plays, first: { tries: tries as number[], solved: solved as boolean[], lost: lost as number } };
}

function lessonRecords(v: unknown): Record<string, LessonRecord> {
  const out: Record<string, LessonRecord> = {};
  if (!isObj(v)) return out;
  for (const [id, r] of Object.entries(v)) {
    if (!isObj(r) || !(STEPS as readonly string[]).includes(id)) continue;
    const at = count(r.at);
    const first = r.first;
    if (at !== null && Array.isArray(first) && first.every((a) => Number.isInteger(a) && a >= -1)) out[id] = { at, first: first as number[] };
  }
  return out;
}

function learner(v: unknown): Learner | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  const room = str(v.room);
  const no = str(v.no);
  if (name === null || room === null || no === null) return null;
  const l = { name, room, no };
  return learnerError(l) ? null : l;
}

/** Reads saved progress: this version's raw JSON, or else version 1's. Never throws. */
export function parseProgress(raw: string | null, oldRaw: string | null = null): Progress {
  let v: unknown;
  try {
    v = JSON.parse(raw ?? oldRaw ?? 'null');
  } catch {
    return EMPTY;
  }
  if (!isObj(v)) return EMPTY;
  const cases: Record<string, CaseRecord> = {};
  if (isObj(v.cases))
    for (const [id, r] of Object.entries(v.cases)) {
      if (!isObj(r)) continue;
      const stars = count(r.stars);
      const plays = count(r.plays);
      if (stars !== null && stars <= 3 && plays !== null) cases[id] = { stars, plays };
    }
  const saved = v.done;
  const done = Array.isArray(saved) ? STEPS.filter((s) => saved.includes(s)) : [];
  const seen = Array.isArray(v.seen) ? [...new Set(v.seen.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 40))] : [];
  return {
    coins: count(v.coins) ?? 0,
    learner: learner(v.learner),
    pre: quiz(v.pre),
    post: quiz(v.post),
    done,
    cases,
    seen,
    testDraft: draft(v.testDraft),
    order: orderRecord(v.order),
    lessons: lessonRecords(v.lessons),
  };
}
