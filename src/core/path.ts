// The learning path the menu shows (docs/learning-path-plan.md, approved 27 Oct 2026): pre-test, two lessons,
// step ordering, the shop's cases, post-test, reflection, results. Pure data in, data out: the UI keeps the
// saved progress (src/ui/progress.ts) and asks here what is open and what to do next.
// Steps not built yet are "soon" and lock nothing, so the path works while items 2-7 are being made.

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
  /** The chosen choice per item, in the order the items were shown. */
  answers: number[];
  at: number;
}

export interface CaseRecord {
  /** Best stars over all plays. */
  stars: number;
  plays: number;
}

export interface Progress {
  coins: number;
  learner: Learner | null;
  pre: QuizResult | null;
  post: QuizResult | null;
  /** Steps finished that keep no score of their own: the lessons, the ordering game, the reflection. */
  done: StepId[];
  cases: Record<string, CaseRecord>;
}

export const EMPTY: Progress = { coins: 0, learner: null, pre: null, post: null, done: [], cases: {} };

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
  const casesDone = done('cases');
  const afterPost = o.built.has('post') ? done('post') : casesDone;

  const opens: Record<StepId, boolean> = {
    pre: true,
    'lesson-os': gate,
    'lesson-types': gate,
    order: gate,
    cases: gate,
    post: gate && casesDone,
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
      : (gate && (i === 0 || played(p, o.caseIds[i - 1]))) || o.unlockAll
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

/** Stores a test result; the first one stands (tests are taken once). */
export function recordQuiz(p: Progress, kind: 'pre' | 'post', r: QuizResult): Progress {
  return p[kind] ? p : { ...p, [kind]: r };
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

function quiz(v: unknown): QuizResult | null {
  if (!isObj(v)) return null;
  const score = count(v.score);
  const total = count(v.total);
  const at = count(v.at);
  const answers = Array.isArray(v.answers) && v.answers.every((a) => count(a) !== null) ? (v.answers as number[]) : null;
  if (score === null || total === null || at === null || !answers || score > total) return null;
  return { score, total, answers, at };
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
  return { coins: count(v.coins) ?? 0, learner: learner(v.learner), pre: quiz(v.pre), post: quiz(v.post), done, cases };
}
