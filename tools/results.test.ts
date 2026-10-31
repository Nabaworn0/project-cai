// npm run test:unit — the results by objective, the results file and the class figures (src/core/results.ts),
// checked against figures worked out by hand.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CourseTestSchema, LessonsSchema, ReflectSchema } from '../src/content/schema';
import { EMPTY, recordCase, type Progress, type QuizResult } from '../src/core/path';
import {
  checksum,
  classCsv,
  classFigures,
  duringPercent,
  interpret,
  latestPerLearner,
  learnerSummary,
  mean,
  pairedT,
  readResultsFile,
  resultsFile,
  resultsFileName,
  resultsText,
  sd,
  tUpper,
  type ResultsContent,
} from '../src/core/results';

const json = (f: string) => JSON.parse(readFileSync(new URL(`../src/content/data/${f}`, import.meta.url), 'utf8'));
const test_ = CourseTestSchema.parse(json('test.json')).items;
const lessons = LessonsSchema.parse(json('lessons.json')).lessons;
const reflect = ReflectSchema.parse(json('reflect.json'));
const C: ResultsContent = { test: test_, lessons, reflect, caseIds: ['c1', 'c2'] };

/** A test sitting with the first `right` items right and the rest wrong. */
function sitting(right: number): QuizResult {
  const answers = Object.fromEntries(test_.map((it, i) => [it.id, i < right ? it.answer : (it.answer + 1) % it.choicesTh.length]));
  return { score: right, total: test_.length, answers, at: 1, seconds: 60 };
}
const learner = (no: string, name = 'สมชาย ใจดี', room = 'ปวช.1/2') => ({ name, room, no });

test('one learner by the four objectives: before, while learning, after and their own stars', () => {
  const os = lessons.find((l) => l.id === 'lesson-os')!;
  let p: Progress = {
    ...EMPTY,
    learner: learner('7'),
    pre: sitting(3),
    post: sitting(10),
    done: ['lesson-os', 'order', 'reflect'],
    lessons: { 'lesson-os': { at: 0, first: [os.questions[0]!.answer, (os.questions[1]!.answer + 1) % 3] } },
    order: { stars: 3, plays: 2, first: { tries: [2, 5], solved: [true, true], lost: 1 } },
    reflect: { self: { 'self-os': 4, 'self-install': 2 }, write: {}, sat: {}, suggest: '', at: 1 },
  };
  p = recordCase(recordCase(p, 'c1', 2), 'c1', 3);
  const s = learnerSummary(p, C);
  const objOf = (o: number) => test_.filter((i) => i.objective === o);
  const preRight = (o: number) => objOf(o).filter((i) => test_.indexOf(i) < 3).length;
  assert.deepEqual(s.rows[0], { objective: 1, pre: { got: preRight(1), max: objOf(1).length }, post: { got: objOf(1).length, max: objOf(1).length }, during: { got: 1, max: 2 }, self: 4 });
  assert.equal(s.rows[1]!.during, null, 'lesson 2 not answered yet');
  assert.equal(s.rows[1]!.self, null);
  assert.deepEqual(s.rows[2]!.during, { got: 2, max: 3 }, 'the ordering game: its first play (a round over 3 checks), not its best 3');
  assert.deepEqual(s.rows[3]!.during, { got: 2, max: 3 }, 'case 1 first played for 2 stars; case 2 not played');
  assert.equal(s.rows[3]!.pre, null, 'objective 4 is not in the test');
  assert.deepEqual([s.pre, s.post], [{ got: 3, max: 10 }, { got: 10, max: 10 }]);
  assert.deepEqual(s.cases, { got: 1, max: 2 });
  // pre, lesson-os, order, post, reflect: 5 of the 7 steps to do (cases not all played, lesson-types not done).
  assert.deepEqual(s.steps, { got: 5, max: 7 });
  assert.equal(duringPercent(s), (100 * (1 + 2 + 2)) / (2 + 3 + 3));
  assert.equal(duringPercent(learnerSummary(EMPTY, C)), null);
  // A case played before first plays were kept counts its best.
  const old = { ...EMPTY, cases: { c2: { stars: 3, plays: 4, first: null } } };
  assert.deepEqual(learnerSummary(old, C).rows[3]!.during, { got: 3, max: 3 });
});

test('the results file: what is sent, read back the same; a hand edit is noticed; anything else refused', () => {
  const p: Progress = { ...EMPTY, learner: learner('7'), pre: sitting(4), coins: 99, reflectDraft: { self: {}, write: {}, sat: {}, suggest: '' } };
  const f = resultsFile(p, 1000);
  assert.equal(f.exportedAt, 1000);
  assert.equal('coins' in f.data || 'reflectDraft' in f.data, false, 'only what the teacher needs');
  const back = readResultsFile(JSON.stringify(f));
  assert.ok(back.ok);
  assert.deepEqual([back.data.learner, back.data.pre, back.edited, back.exportedAt], [p.learner, p.pre, false, 1000]);
  // Edited by hand: still read, but flagged.
  const edited = JSON.parse(JSON.stringify(f));
  edited.data.pre.score = 10;
  const e = readResultsFile(JSON.stringify(edited));
  assert.ok(e.ok && e.edited);
  for (const [text, why] of [
    ['not json', 'อ่านไม่ได้'],
    ['{"app":"other"}', 'ไม่ใช่ไฟล์ผลการเรียนของเกมนี้'],
    [JSON.stringify({ ...f, version: 2 }), 'รุ่น 2'],
    [JSON.stringify({ ...f, data: { ...f.data, learner: null } }), 'ไม่มีชื่อ'],
  ] as const) {
    const r = readResultsFile(text);
    assert.ok(!r.ok && r.why.includes(why), `${text.slice(0, 30)}: ${!r.ok && r.why}`);
  }
  assert.notEqual(checksum('a'), checksum('b'));
  assert.deepEqual([checksum(''), checksum('a'), checksum('foobar')], ['811c9dc5', 'e40c292c', 'bf9cf968'], 'FNV-1a 32-bit reference values');
});

test('file names say who it is, without characters a file name cannot have', () => {
  assert.equal(resultsFileName(learner('7', 'สมชาย ใจดี', 'ปวช.1/2')), 'ผลการเรียน-ปวช.1-2-เลขที่07-สมชาย.json');
  assert.equal(resultsFileName(learner('12', 'a:b', 'x y')), 'ผลการเรียน-x-y-เลขที่12-a-b.json');
  assert.equal(resultsFileName(null), 'ผลการเรียน.json');
});

test('one file per learner, the latest; sorted by room then number', () => {
  const f = (no: string, at: number, room = 'ปวช.1/2') => ({ data: { ...EMPTY, learner: learner(no, `n${at}`, room) }, exportedAt: at });
  const out = latestPerLearner([f('10', 1), f('2', 5), f('10', 9), f('02', 3), f('1', 1, 'ปวช.1/1')]);
  assert.deepEqual(
    out.map((x) => [x.data.learner!.room, x.data.learner!.no, x.exportedAt]),
    [
      ['ปวช.1/1', '1', 1],
      ['ปวช.1/2', '2', 5],
      ['ปวช.1/2', '10', 9],
    ],
    '"02" and "2" are the same number',
  );
});

test('mean, S.D. (n − 1) and the five-level reading', () => {
  assert.equal(mean([2, 4, 4, 4, 5, 5, 7, 9]), 5);
  assert.equal(sd([2, 4, 4, 4, 5, 5, 7, 9]).toFixed(4), '2.1381');
  assert.ok(Number.isNaN(sd([3])));
  assert.deepEqual([4.51, 4.5, 3.51, 3.5, 2.51, 2.5, 1.51, 1.5, 1].map(interpret), ['มากที่สุด', 'มาก', 'มาก', 'ปานกลาง', 'ปานกลาง', 'น้อย', 'น้อย', 'น้อยที่สุด', 'น้อยที่สุด']);
  assert.equal(interpret(NaN), '-');
});

test("the t-test against the textbook table: the one-tailed .05 and .025 critical values", () => {
  assert.equal(tUpper(1.833, 9).toFixed(3), '0.050');
  assert.equal(tUpper(2.262, 9).toFixed(3), '0.025');
  assert.equal(tUpper(1.725, 20).toFixed(3), '0.050');
  assert.equal(tUpper(0, 5), 0.5);
  assert.equal(tUpper(-1.833, 9).toFixed(3), '0.950');
  // Before 3,4,5,6,2 after 7,8,6,9,6: d = 4,4,1,3,4; mean 3.2, S.D. 1.3038; t = 3.2 / (1.3038/√5) = 5.488.
  const t = pairedT([3, 4, 5, 6, 2], [7, 8, 6, 9, 6])!;
  assert.deepEqual([t.n, t.df, t.t.toFixed(3)], [5, 4, '5.488']);
  assert.ok(t.p < 0.01);
  assert.equal(pairedT([1], [2]), null, 'one pair');
  assert.equal(pairedT([1, 2], [3, 4]), null, 'every gain the same: no spread');
});

test('the class: tests before and after, each item, satisfaction by item, group and all, E1/E2', () => {
  const sat = (v: number) => Object.fromEntries(reflect.satisfaction.map((s, i) => [s.id, i === 0 ? v : 4]));
  const a: Progress = {
    ...EMPTY,
    learner: learner('1'),
    pre: sitting(3),
    post: sitting(8),
    order: { stars: 3, plays: 1, first: { tries: [1, 1], solved: [true, true], lost: 0 } },
    reflect: { self: { 'self-os': 5 }, write: {}, sat: sat(5), suggest: '', at: 1 },
  };
  const b: Progress = { ...a, learner: learner('2'), pre: sitting(5), post: sitting(9), order: { stars: 1, plays: 1, first: { tries: [4, 4], solved: [true, true], lost: 2 } }, reflect: { ...a.reflect!, self: { 'self-os': 3 }, sat: sat(2) } };
  const none: Progress = { ...EMPTY, learner: learner('3'), pre: sitting(1) };
  const f = classFigures([a, b, none], C);
  assert.equal(f.learners, 3);
  assert.deepEqual([f.pre.n, f.pre.mean, f.post.mean, f.gain.mean], [2, 4, 8.5, 4.5], 'only those with both tests');
  // Gains 5 and 4: mean 4.5, S.D. 0.7071, t = 4.5 / (0.7071/√2) = 9; with 1 df, P(T > 9) = 1/2 − atan(9)/π.
  assert.deepEqual([f.t!.t.toFixed(6), f.t!.df], ['9.000000', 1]);
  assert.equal(f.t!.p.toFixed(6), (0.5 - Math.atan(9) / Math.PI).toFixed(6));
  // Item 1 right for everyone before and after; item 4 right before only for b (and none's pre counts).
  assert.deepEqual([f.items[0]!.pre, f.items[0]!.post], [100, 100]);
  assert.equal(f.items[3]!.pre, (100 * 1) / 3, 'b had 5 right, a 3, none 1');
  assert.equal(f.items[9]!.post, 0);
  assert.deepEqual(f.items[9]!.commonWrong, { choice: (test_[9]!.answer + 1) % test_[9]!.choicesTh.length, count: 2 });
  assert.equal(f.items[0]!.commonWrong, null);
  // E1: a's ordering game 3/3, b's 1/3 (nothing else done while learning): (100 + 33.3) / 2. E2: (80 + 90) / 2.
  assert.equal(f.e1.toFixed(2), ((100 + 100 / 3) / 2).toFixed(2));
  assert.equal(f.e2, 85);
  // Satisfaction: item 1 rated 5 and 2, the rest 4 by both.
  assert.deepEqual([f.satisfaction[0]!.stat.mean, f.satisfaction[0]!.reading], [3.5, 'ปานกลาง']);
  assert.equal(f.satisfaction[0]!.stat.sd.toFixed(4), '2.1213');
  assert.deepEqual([f.satisfaction[1]!.stat.mean, f.satisfaction[1]!.reading], [4, 'มาก']);
  const g0 = reflect.satisfaction.filter((s) => s.group === reflect.groups[0]!.id).length;
  assert.equal(f.groups[0]!.stat.n, 2 * g0);
  assert.equal(f.groups[0]!.stat.mean, (5 + 2 + 4 * 2 * (g0 - 1)) / (2 * g0));
  assert.equal(f.overall.stat.n, 2 * reflect.satisfaction.length);
  assert.deepEqual(f.self[0], { objective: 1, stat: { n: 2, mean: 4, sd: Math.SQRT2 } });
  assert.equal(f.self[1]!.stat.n, 0);
  // Per objective, percent right before and after.
  const o1 = test_.filter((i) => i.objective === 1).length;
  assert.equal(f.objectives[0]!.post, 100);
  assert.equal(o1, 3);
});

test('the t-test appears with spread, in the direction of the gain', () => {
  const ps = [3, 4, 5, 6, 2].map((pre, i) => ({ ...EMPTY, learner: learner(String(i + 1)), pre: sitting(pre), post: sitting([7, 8, 6, 9, 6][i]!) }));
  const f = classFigures(ps, C);
  assert.equal(f.t!.t.toFixed(3), '5.488');
});

test('the CSV: a byte-order mark, a heading, one row per learner, quotes where needed', () => {
  const a: Progress = { ...EMPTY, learner: learner('1', 'ก "ข", ค'), pre: sitting(3), post: sitting(8), reflect: { self: {}, write: { learned: 'สอง\nบรรทัด' }, sat: {}, suggest: '', at: 1 } };
  const csv = classCsv([a], C);
  assert.ok(csv.startsWith('﻿ชั้น,เลขที่,ชื่อ-สกุล,ก่อนเรียน,หลังเรียน,ผลต่าง,'));
  const [, row] = csv.slice(1).split('\r\n');
  assert.ok(row!.startsWith('ปวช.1/2,1,"ก ""ข"", ค",3,8,5,'));
  assert.ok(csv.includes('"สอง\nบรรทัด"'));
  assert.equal(csv.split('\r\n').length, 3, 'heading, one learner, and the last line break');
});

test('the results as text: who, steps, the tests and each objective, "-" for what is not done', () => {
  const p: Progress = { ...EMPTY, learner: learner('7'), pre: sitting(3), post: sitting(8), reflect: { self: { 'self-os': 4 }, write: {}, sat: {}, suggest: '', at: 1 } };
  const lines = resultsText(p, C).split('\n');
  assert.equal(lines[1], 'สมชาย ใจดี · ปวช.1/2 · เลขที่ 7');
  assert.equal(lines[2], 'ทำครบ 2/7 ขั้น');
  assert.equal(lines[3], 'แบบทดสอบ: ก่อนเรียน 3/10 → หลังเรียน 8/10 (+5)');
  assert.equal(lines[4], 'วัตถุประสงค์ 1 ความหมายและหน้าที่ของระบบปฏิบัติการ: ก่อน 3/3 · ระหว่างเรียน - · หลัง 3/3 · ประเมินตนเอง 4 ดาว');
  assert.equal(lines[7], 'วัตถุประสงค์ 4 ลงมือติดตั้ง Windows 11: ก่อน - · ระหว่างเรียน - · หลัง - · ประเมินตนเอง -');
  assert.equal(lines[8], 'เคสที่เล่นแล้ว 0/2');
  const fresh = resultsText(EMPTY, C).split('\n');
  assert.deepEqual([fresh[1], fresh[3]], ['ยังไม่ได้กรอกชื่อ', 'แบบทดสอบ: ก่อนเรียน - → หลังเรียน -']);
  assert.ok(resultsText({ ...p, post: sitting(1) }, C).includes('(-2)'));
});
