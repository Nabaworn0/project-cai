// What the learner and the teacher see of the learning (docs/results-plan.md, item 7): one learner's results by the
// four objectives, the results file a learner sends the teacher, and the class figures the teacher's page shows
// (mean and S.D., the test item by item, satisfaction with its usual Thai reading, a dependent t-test and E1/E2).
// Pure: the pages pass the content and the saved progress (or the files) in.

import type { CourseTest, Lesson, Reflect } from '../content/schema';
import { orderStars } from './order';
import { parseProgress, STEPS, type Learner, type Progress } from './path';
import { grade } from './quiz';

/** What the summary needs of the game's content. */
export interface ResultsContent {
  test: CourseTest['items'];
  lessons: readonly Lesson[];
  reflect: Reflect;
  caseIds: readonly string[];
}

/** Points got out of points possible. */
export interface Score {
  got: number;
  max: number;
}

export interface ObjectiveRow {
  objective: 1 | 2 | 3 | 4;
  pre: Score | null;
  post: Score | null;
  /** While learning: the lesson's questions answered right first time, the ordering game's or the cases' stars
   *  of their first play. Null when not done yet. */
  during: Score | null;
  /** The learner's own stars (1-5) from the reflection. */
  self: number | null;
}

export interface LearnerSummary {
  rows: ObjectiveRow[];
  pre: Score | null;
  post: Score | null;
  /** Steps of the path done (the results step itself is not one to do). */
  steps: Score;
  /** Cases played at least once. */
  cases: Score;
}

const LESSON_FOR: Record<1 | 2, string> = { 1: 'lesson-os', 2: 'lesson-types' };

/** The first answers to a lesson's questions: how many were right, or null if none was answered yet. */
function lessonDuring(p: Progress, lessons: readonly Lesson[], id: string): Score | null {
  const lesson = lessons.find((l) => l.id === id);
  const first = p.lessons[id]?.first ?? [];
  if (!lesson || !first.some((a) => a >= 0)) return null;
  return { got: lesson.questions.filter((q, i) => first[i] === q.answer).length, max: lesson.questions.length };
}

/** Stars of each played case's first play (its best when the first was not kept). */
function casesDuring(p: Progress, caseIds: readonly string[]): Score | null {
  const played = caseIds.map((id) => p.cases[id]).filter((r) => r && r.plays > 0);
  if (!played.length) return null;
  return { got: played.reduce((s, r) => s + (r!.first ?? r!.stars), 0), max: 3 * played.length };
}

export function learnerSummary(p: Progress, c: ResultsContent): LearnerSummary {
  const pre = p.pre ? grade(c.test, p.pre.answers) : null;
  const post = p.post ? grade(c.test, p.post.answers) : null;
  const byObj = (g: ReturnType<typeof grade> | null, o: number): Score | null => {
    const row = g?.byObjective.find((b) => b.objective === o);
    return row ? { got: row.right, max: row.total } : null;
  };
  const self = (o: number) => {
    const item = c.reflect.self.find((s) => s.objective === o);
    return (item && p.reflect?.self[item.id]) ?? null;
  };
  const during = (o: 1 | 2 | 3 | 4): Score | null =>
    o === 1 || o === 2 ? lessonDuring(p, c.lessons, LESSON_FOR[o]) : o === 3 ? (p.order ? { got: orderStars(p.order.first), max: 3 } : null) : casesDuring(p, c.caseIds);
  const rows = ([1, 2, 3, 4] as const).map((objective) => ({
    objective,
    pre: byObj(pre, objective),
    post: byObj(post, objective),
    during: during(objective),
    self: self(objective),
  }));
  const todo = STEPS.filter((s) => s !== 'results');
  const doneSteps = todo.filter((s) =>
    s === 'pre' ? !!p.pre : s === 'post' ? !!p.post : s === 'cases' ? c.caseIds.every((id) => (p.cases[id]?.plays ?? 0) > 0) : p.done.includes(s),
  );
  return {
    rows,
    pre: pre && { got: pre.score, max: pre.total },
    post: post && { got: post.score, max: post.total },
    steps: { got: doneSteps.length, max: todo.length },
    cases: { got: c.caseIds.filter((id) => (p.cases[id]?.plays ?? 0) > 0).length, max: c.caseIds.length },
  };
}

/** E1 for one learner: everything done while learning, as a percentage (null before any of it). */
export function duringPercent(s: LearnerSummary): number | null {
  const parts = s.rows.map((r) => r.during).filter((d): d is Score => d !== null);
  if (!parts.length) return null;
  const got = parts.reduce((a, d) => a + d.got, 0);
  const max = parts.reduce((a, d) => a + d.max, 0);
  return (100 * got) / max;
}

// ---- The results file -------------------------------------------------------------------------------------

export const FILE_APP = 'shop-results';
export const FILE_VERSION = 1;

/** What goes to the teacher: the saved progress without what is only for this device (coins, drafts, cutscenes). */
export type ResultsData = Pick<Progress, 'learner' | 'pre' | 'post' | 'done' | 'cases' | 'order' | 'lessons' | 'reflect'>;

export interface ResultsFile {
  app: typeof FILE_APP;
  version: typeof FILE_VERSION;
  exportedAt: number;
  data: ResultsData;
  /** Changes when the data is edited by hand (a warning on the teacher's page, not a lock). */
  check: string;
}

/** FNV-1a, 32 bits, as hex: enough to notice a hand edit, not a security measure. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function resultsFile(p: Progress, now: number): ResultsFile {
  const data: ResultsData = { learner: p.learner, pre: p.pre, post: p.post, done: p.done, cases: p.cases, order: p.order, lessons: p.lessons, reflect: p.reflect };
  return { app: FILE_APP, version: FILE_VERSION, exportedAt: now, data, check: checksum(JSON.stringify(data)) };
}

/** A safe file name: room, number and name, e.g. ผลการเรียน-ปวช.1-2-เลขที่07-สมชาย.json */
export function resultsFileName(l: Learner | null): string {
  const clean = (s: string) => s.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-');
  if (!l) return 'ผลการเรียน.json';
  return `ผลการเรียน-${clean(l.room)}-เลขที่${l.no.trim().padStart(2, '0')}-${clean(l.name.split(/\s+/)[0] ?? '')}.json`;
}

export type ReadFile = { ok: true; data: Progress; exportedAt: number; edited: boolean } | { ok: false; why: string };

/** Reads a results file back. Anything unreadable in it is dropped the way saved progress is (parseProgress). */
export function readResultsFile(text: string): ReadFile {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, why: 'ไม่ใช่ไฟล์ผลการเรียน (อ่านไม่ได้)' };
  }
  const f = v as Partial<ResultsFile> | null;
  if (!f || typeof f !== 'object' || f.app !== FILE_APP) return { ok: false, why: 'ไม่ใช่ไฟล์ผลการเรียนของเกมนี้' };
  if (f.version !== FILE_VERSION) return { ok: false, why: `ไฟล์รุ่น ${String(f.version)} อ่านไม่ได้` };
  const data = parseProgress(JSON.stringify(f.data ?? null));
  if (!data.learner) return { ok: false, why: 'ไม่มีชื่อผู้เรียนในไฟล์' };
  const exportedAt = Number.isFinite(f.exportedAt) ? (f.exportedAt as number) : 0;
  return { ok: true, data, exportedAt, edited: f.check !== checksum(JSON.stringify(f.data)) };
}

/** One learner per room and number: the file exported last wins. */
export function latestPerLearner<T extends { data: Progress; exportedAt: number }>(files: readonly T[]): T[] {
  const key = (f: T) => `${f.data.learner!.room.trim()}|${Number(f.data.learner!.no)}`;
  const best = new Map<string, T>();
  for (const f of files) {
    const k = key(f);
    const had = best.get(k);
    if (!had || f.exportedAt >= had.exportedAt) best.set(k, f);
  }
  return [...best.values()].sort((a, b) => a.data.learner!.room.localeCompare(b.data.learner!.room) || Number(a.data.learner!.no) - Number(b.data.learner!.no));
}

// ---- Class figures ----------------------------------------------------------------------------------------

export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
/** The sample standard deviation (n − 1), as research reports use. */
export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** The usual five-level reading of a mean rating. */
export function interpret(m: number): string {
  if (!Number.isFinite(m)) return '-';
  return m > 4.5 ? 'มากที่สุด' : m > 3.5 ? 'มาก' : m > 2.5 ? 'ปานกลาง' : m > 1.5 ? 'น้อย' : 'น้อยที่สุด';
}

function logGamma(x: number): number {
  // Lanczos (g = 7, n = 9).
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0]!;
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** The regularized incomplete beta function I_x(a, b), by its continued fraction. */
function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x > (a + 1) / (a + b + 2)) return 1 - betaInc(1 - x, b, a);
  let f = 1;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
  f = d;
  for (let m = 1; m <= 200; m++) {
    for (const k of [0, 1]) {
      const num = k === 0 ? (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m)) : -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
      d = 1 + num * d;
      d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
      c = 1 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      f *= c * d;
    }
    if (Math.abs(c * d - 1) < 1e-12) break;
  }
  return (front * f) / a;
}

/** P(T > t) for Student's t with `df` degrees of freedom. */
export function tUpper(t: number, df: number): number {
  const tail = 0.5 * betaInc(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? tail : 1 - tail;
}

export interface PairedT {
  n: number;
  t: number;
  df: number;
  /** One-tailed: the post-test is higher than the pre-test. */
  p: number;
}

/** The dependent (paired) t-test of `after` against `before`; null without two pairs or with no spread at all. */
export function pairedT(before: readonly number[], after: readonly number[]): PairedT | null {
  const d = after.map((a, i) => a - before[i]!);
  const s = sd(d);
  if (d.length < 2 || !(s > 0)) return null;
  const t = mean(d) / (s / Math.sqrt(d.length));
  return { n: d.length, t, df: d.length - 1, p: tUpper(t, d.length - 1) };
}

export interface Stat {
  n: number;
  mean: number;
  sd: number;
}
const stat = (xs: readonly number[]): Stat => ({ n: xs.length, mean: mean(xs), sd: sd(xs) });

export interface ItemRow {
  id: string;
  objective: number;
  /** Percent right, of those who took that test. */
  pre: number;
  post: number;
  /** The wrong choice picked most on the post-test, and by how many. */
  commonWrong: { choice: number; count: number } | null;
}

export interface ClassFigures {
  learners: number;
  /** Learners with both tests: their scores. */
  pre: Stat;
  post: Stat;
  gain: Stat;
  t: PairedT | null;
  /** Per objective, mean percent right before and after (learners with both tests). */
  objectives: { objective: number; pre: number; post: number }[];
  items: ItemRow[];
  /** E1 (while learning) and E2 (post-test), percent, over learners who took the post-test. */
  e1: number;
  e2: number;
  satisfaction: { id: string; group: string; stat: Stat; reading: string }[];
  groups: { id: string; stat: Stat; reading: string }[];
  overall: { stat: Stat; reading: string };
  self: { objective: number; stat: Stat }[];
}

export function classFigures(ps: readonly Progress[], c: ResultsContent): ClassFigures {
  const both = ps.filter((p) => p.pre && p.post);
  const preScores = both.map((p) => grade(c.test, p.pre!.answers).score);
  const postScores = both.map((p) => grade(c.test, p.post!.answers).score);
  const total = c.test.length;
  const objectives = [...new Set(c.test.map((i) => i.objective))].sort((a, b) => a - b).map((objective) => {
    const its = c.test.filter((i) => i.objective === objective);
    const pct = (answers: Record<string, number>) => (100 * its.filter((i) => answers[i.id] === i.answer).length) / its.length;
    return { objective, pre: mean(both.map((p) => pct(p.pre!.answers))), post: mean(both.map((p) => pct(p.post!.answers))) };
  });
  const items = c.test.map((it): ItemRow => {
    const right = (rs: (Record<string, number> | undefined)[]) => {
      const answered = rs.filter((a): a is Record<string, number> => !!a && a[it.id] !== undefined);
      return answered.length ? (100 * answered.filter((a) => a[it.id] === it.answer).length) / answered.length : NaN;
    };
    const wrong = new Map<number, number>();
    for (const p of ps) {
      const a = p.post?.answers[it.id];
      if (a !== undefined && a !== it.answer) wrong.set(a, (wrong.get(a) ?? 0) + 1);
    }
    const top = [...wrong.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    return {
      id: it.id,
      objective: it.objective,
      pre: right(ps.map((p) => p.pre?.answers)),
      post: right(ps.map((p) => p.post?.answers)),
      commonWrong: top ? { choice: top[0], count: top[1] } : null,
    };
  });
  const finished = ps.filter((p) => p.post);
  const e1s = finished.map((p) => duringPercent(learnerSummary(p, c))).filter((x): x is number => x !== null);
  const sent = ps.map((p) => p.reflect).filter((r) => r !== null);
  const ratings = (ids: string[]) => sent.flatMap((r) => ids.map((id) => r!.sat[id]).filter((x): x is number => x !== undefined));
  const withReading = (s: Stat) => ({ stat: s, reading: interpret(s.mean) });
  return {
    learners: ps.length,
    pre: stat(preScores),
    post: stat(postScores),
    gain: stat(postScores.map((x, i) => x - preScores[i]!)),
    t: pairedT(preScores, postScores),
    objectives,
    items,
    e1: mean(e1s),
    e2: mean(finished.map((p) => (100 * grade(c.test, p.post!.answers).score) / total)),
    satisfaction: c.reflect.satisfaction.map((s) => ({ id: s.id, group: s.group, ...withReading(stat(ratings([s.id]))) })),
    groups: c.reflect.groups.map((g) => ({ id: g.id, ...withReading(stat(ratings(c.reflect.satisfaction.filter((s) => s.group === g.id).map((s) => s.id)))) })),
    overall: withReading(stat(ratings(c.reflect.satisfaction.map((s) => s.id)))),
    self: c.reflect.self.map((s) => ({
      objective: s.objective,
      stat: stat(sent.map((r) => r!.self[s.id]).filter((x): x is number => x !== undefined)),
    })),
  };
}

// ---- CSV for Excel -----------------------------------------------------------------------------------------

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per learner, with a byte-order mark so Excel reads the Thai right. */
export function classCsv(ps: readonly Progress[], c: ResultsContent): string {
  const head = [
    'ชั้น',
    'เลขที่',
    'ชื่อ-สกุล',
    'ก่อนเรียน',
    'หลังเรียน',
    'ผลต่าง',
    ...[1, 2, 3, 4].flatMap((o) => [`วัตถุประสงค์ ${o} ก่อน`, `วัตถุประสงค์ ${o} ระหว่างเรียน`, `วัตถุประสงค์ ${o} หลัง`, `วัตถุประสงค์ ${o} ประเมินตนเอง`]),
    'ระหว่างเรียน (%)',
    'ทำครบ (ขั้น)',
    ...c.reflect.satisfaction.map((s) => s.th),
    ...c.reflect.write.map((w) => w.th),
    c.reflect.suggestTh,
  ];
  const score = (s: Score | null) => (s ? `${s.got}/${s.max}` : '');
  const rows = ps.map((p) => {
    const s = learnerSummary(p, c);
    const e1 = duringPercent(s);
    return [
      p.learner?.room,
      p.learner?.no,
      p.learner?.name,
      s.pre?.got,
      s.post?.got,
      s.pre && s.post ? s.post.got - s.pre.got : null,
      ...s.rows.flatMap((r) => [score(r.pre), score(r.during), score(r.post), r.self]),
      e1 === null ? null : Math.round(e1 * 10) / 10,
      `${s.steps.got}/${s.steps.max}`,
      ...c.reflect.satisfaction.map((x) => p.reflect?.sat[x.id]),
      ...c.reflect.write.map((w) => p.reflect?.write[w.id]),
      p.reflect?.suggest,
    ];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

// ---- The learner's results as text, to paste in a chat or on Padlet -----------------------------------------

/** The four objectives, short. */
export const OBJECTIVE_TH: Record<number, string> = {
  1: 'ความหมายและหน้าที่ของระบบปฏิบัติการ',
  2: 'ประเภทของระบบปฏิบัติการ',
  3: 'ขั้นตอนการติดตั้ง Windows 11',
  4: 'ลงมือติดตั้ง Windows 11',
};

const fmt = (s: Score | null) => (s ? `${s.got}/${s.max}` : '-');

export function resultsText(p: Progress, c: ResultsContent): string {
  const s = learnerSummary(p, c);
  const l = p.learner;
  const gain = s.pre && s.post ? s.post.got - s.pre.got : null;
  return [
    'สรุปผลการเรียน · เกม WINSTALL (รายวิชา 21910-2001)',
    l ? `${l.name} · ${l.room} · เลขที่ ${l.no}` : 'ยังไม่ได้กรอกชื่อ',
    `ทำครบ ${s.steps.got}/${s.steps.max} ขั้น`,
    `แบบทดสอบ: ก่อนเรียน ${fmt(s.pre)} → หลังเรียน ${fmt(s.post)}${gain === null ? '' : ` (${gain >= 0 ? '+' : ''}${gain})`}`,
    ...s.rows.map(
      (r) =>
        `วัตถุประสงค์ ${r.objective} ${OBJECTIVE_TH[r.objective]}: ก่อน ${fmt(r.pre)} · ระหว่างเรียน ${fmt(r.during)} · หลัง ${fmt(r.post)} · ประเมินตนเอง ${r.self ? `${r.self} ดาว` : '-'}`,
    ),
    `เคสที่เล่นแล้ว ${fmt(s.cases)}`,
  ].join('\n');
}
