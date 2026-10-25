// npm run test:unit — the case flow and scoring (src/core/session.ts), played on the real case 1 content.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { generateCase, nextCase } from '../src/core/cases';
import { BYPASS_NOTE_TH, EDITION_NOTE_TH, blockedNext, currentQuestion, customerMood, SCORING, shownHints, startSession, step, summarize, type Session, type SessionEvent } from '../src/core/session';
import { BrandSchema, CaseSchema, ProblemsSchema } from '../src/content/schema';

const data = (path: string) => JSON.parse(readFileSync(new URL(`../src/content/data/${path}`, import.meta.url), 'utf8'));
const lib = { problems: ProblemsSchema.parse(data('problems.json')), brands: [BrandSchema.parse(data('brands/classic.json'))] };
const c01 = CaseSchema.parse(data('cases/c01-boot-order.json'));
const gc = generateCase(c01, lib, 'test-seed');
const right = { diagnosis: c01.diagnosis.answer, answers: c01.customerQuestions.map((q) => q.answer) };
const wrong = (q: { answer: number }) => (q.answer + 1) % 2;

const play = (events: SessionEvent[], s: Session = startSession(gc)) => events.reduce((acc, e) => step(gc, acc, e), s);
const NEXT: SessionEvent = { type: 'next' };

/** A whole case. Repair mistakes and hints are inserted before the repair finishes. */
function playCase(
  o: { diagnosis?: number; mistakes?: number; hints?: number; route?: string; bypassedChecks?: boolean; wrongEdition?: boolean; answers?: number[] } = {},
) {
  return play([
    NEXT, // intro -> ticket
    NEXT, // ticket -> diagnose
    { type: 'diagnose', choice: o.diagnosis ?? right.diagnosis },
    NEXT, // -> repair
    ...Array.from({ length: o.mistakes ?? 0 }, (): SessionEvent => ({ type: 'mistake' })),
    ...Array.from({ length: o.hints ?? 0 }, (): SessionEvent => ({ type: 'hint' })),
    { type: 'repaired', route: o.route ?? 'bios', bypassedChecks: o.bypassedChecks, wrongEdition: o.wrongEdition },
    NEXT, // -> explain
    ...(o.answers ?? right.answers).map((choice): SessionEvent => ({ type: 'answer', choice })),
    NEXT, // -> summary
  ]);
}

test('a clean run through case 1 earns 3 stars, full coins and full satisfaction', () => {
  const s = playCase();
  assert.equal(s.stage, 'summary');
  const sum = summarize(gc, s);
  assert.equal(sum.stars, 3);
  assert.deepEqual(sum.lostTh, []);
  assert.equal(sum.coins, SCORING.repairCoins + SCORING.hintBonus[0]);
  assert.equal(sum.satisfaction, 100);
  assert.equal(customerMood(gc, s), 'happy');
});

test('the Boot Menu shortcut (F8) earns full stars, like the BIOS route', () => {
  assert.equal(summarize(gc, playCase({ route: 'boot-menu' })).stars, 3);
});

test('each kind of error costs one star: wrong guess, more than one repair mistake, wrong explanation', () => {
  assert.equal(summarize(gc, playCase({ diagnosis: wrong(c01.diagnosis) })).stars, 2);
  assert.equal(summarize(gc, playCase({ mistakes: 1 })).stars, 3, 'one mistake is free');
  assert.equal(summarize(gc, playCase({ mistakes: 2 })).stars, 2);
  assert.equal(summarize(gc, playCase({ mistakes: 5 })).stars, 2, 'many mistakes still cost only one star');
  assert.equal(summarize(gc, playCase({ answers: c01.customerQuestions.map(wrong) })).stars, 2);
});

test('stars never drop below 1, and the customer leaves angry', () => {
  const s = playCase({ diagnosis: wrong(c01.diagnosis), mistakes: 3, answers: c01.customerQuestions.map(wrong) });
  const sum = summarize(gc, s);
  assert.equal(sum.stars, SCORING.minStars);
  assert.equal(sum.lostTh.length, 3);
  assert.equal(customerMood(gc, s), 'angry');
  assert.equal(customerMood(gc, playCase({ mistakes: 2 })), 'neutral');
});

test('hints cost bonus coins and satisfaction, never stars', () => {
  const [none, one, two] = [0, 1, 2].map((hints) => summarize(gc, playCase({ hints })));
  for (const sum of [none, one, two]) assert.equal(sum!.stars, 3);
  assert.ok(none!.coins > one!.coins && one!.coins > two!.coins, 'each hint costs coins');
  assert.equal(two!.coins, SCORING.repairCoins, 'two hints leave no bonus, but the repair is still paid');
  assert.ok(none!.satisfaction > one!.satisfaction && one!.satisfaction > two!.satisfaction);
});

test('hints come from the hidden problem, are shown one at a time, and run out', () => {
  let s = play([NEXT, NEXT, { type: 'diagnose', choice: 0 }, NEXT]);
  assert.deepEqual(shownHints(s), []);
  assert.ok(s.hints.length >= 1 && s.hints.length <= SCORING.hintLimit);
  assert.deepEqual(s.hints, gc.problems[0]!.hintsTh.slice(0, SCORING.hintLimit));
  for (let i = 1; i <= s.hints.length; i++) {
    s = step(gc, s, { type: 'hint' });
    assert.deepEqual(shownHints(s), s.hints.slice(0, i));
  }
  assert.throws(() => step(gc, s, { type: 'hint' }), /no hints left/);
});

test('a machine with several problems still gets only two hints', () => {
  const p = gc.problems[0]!;
  const twoProblems = { ...gc, problems: [p, { ...p, id: 'other', hintsTh: ['คำใบ้ 3', 'คำใบ้ 4'] }] };
  assert.deepEqual(startSession(twoProblems).hints, [...p.hintsTh, 'คำใบ้ 3', 'คำใบ้ 4'].slice(0, SCORING.hintLimit));
});

test('a stage cannot be skipped: guess first, fix the PC first, answer the customer first', () => {
  const atDiagnose = play([NEXT, NEXT]);
  assert.equal(atDiagnose.stage, 'diagnose');
  assert.ok(blockedNext(atDiagnose));
  assert.throws(() => step(gc, atDiagnose, NEXT), /answer the diagnosis first/);

  const atRepair = play([{ type: 'diagnose', choice: 0 }, NEXT], atDiagnose);
  assert.throws(() => step(gc, atRepair, NEXT), /not fixed yet/);

  const atExplain = play([{ type: 'repaired', route: 'bios' }, NEXT], atRepair);
  assert.equal(currentQuestion(gc, atExplain), c01.customerQuestions[0]);
  assert.throws(() => step(gc, atExplain, NEXT), /answer every customer question first/);

  assert.throws(() => step(gc, playCase(), NEXT), /the case is over/);
});

test('actions outside their stage are refused (UI bugs surface instead of corrupting the score)', () => {
  const start = startSession(gc);
  assert.throws(() => step(gc, start, { type: 'mistake' }), /not repairing/);
  assert.throws(() => step(gc, start, { type: 'answer', choice: 0 }), /wrong stage/);
  const atDiagnose = play([NEXT, NEXT]);
  assert.throws(() => step(gc, atDiagnose, { type: 'diagnose', choice: 99 }), /no choice 99/);
  const answered = step(gc, atDiagnose, { type: 'diagnose', choice: 0 });
  assert.throws(() => step(gc, answered, { type: 'diagnose', choice: 1 }), /already answered/);
  const fixed = play([NEXT, { type: 'repaired', route: 'bios' }], answered);
  assert.throws(() => step(gc, fixed, { type: 'mistake' }), /not repairing/, 'no mistakes after the fix');
  assert.throws(() => step(gc, fixed, { type: 'repaired', route: 'bios' }), /not repairing/);
  const atRepair = play([NEXT], answered);
  assert.throws(() => step(gc, atRepair, { type: 'repaired', route: '' }), /no route given/);
});

test('the customer is worried until the PC is fixed, then pleased', () => {
  const atRepair = play([NEXT, NEXT, { type: 'diagnose', choice: right.diagnosis }, NEXT]);
  assert.equal(customerMood(gc, startSession(gc)), 'worried');
  assert.equal(customerMood(gc, atRepair), 'worried');
  assert.equal(customerMood(gc, step(gc, atRepair, { type: 'repaired', route: 'bios' })), 'happy');
});

test("the technician's log teaches the hidden problem with its textbook page", () => {
  const { log } = summarize(gc, playCase());
  assert.deepEqual(log, [{ textTh: gc.problems[0]!.explainTh, bookPage: '48–51' }]);
});

test('steps never change the session they were given', () => {
  const s = play([NEXT, NEXT]);
  const copy = structuredClone(s);
  step(gc, s, { type: 'diagnose', choice: 0 });
  assert.deepEqual(s, copy);
});

test('customers come in order (case 1, then 2), then at random but never the same case twice in a row', () => {
  const cases = [{ id: 'c02', order: 2 }, { id: 'c01', order: 1 }, { id: 'c03', order: 3 }];
  assert.equal(nextCase(cases, null, () => 0).id, 'c01', 'a new player starts with case 1');
  assert.equal(nextCase(cases, 'c01', () => 0).id, 'c02');
  assert.equal(nextCase(cases, 'c02', () => 0).id, 'c03');
  const after = new Set([0, 0.3, 0.6, 0.99].map((r) => nextCase(cases, 'c03', () => r).id));
  assert.deepEqual([...after].sort(), ['c01', 'c02'], 'after the last one: any other case');
  assert.equal(nextCase([{ id: 'c01', order: 1 }], 'c01', () => 0.5).id, 'c01', 'only one case: it repeats');
  assert.equal(nextCase(cases, 'not-playable', () => 0).id, 'c01');
});

test("a USB made with Rufus' checks removed is noted in the tech log but costs nothing", () => {
  const clean = summarize(gc, playCase());
  const bypassed = summarize(gc, playCase({ bypassedChecks: true }));
  assert.equal(bypassed.stars, 3);
  assert.equal(bypassed.coins, clean.coins);
  assert.equal(bypassed.satisfaction, clean.satisfaction);
  assert.deepEqual(bypassed.log, [...clean.log, { textTh: BYPASS_NOTE_TH }]);
  assert.ok(!clean.log.some((l) => l.textTh === BYPASS_NOTE_TH));
});

test('another edition than the PC had (no key) is noted in the tech log but costs nothing', () => {
  const clean = summarize(gc, playCase({ route: 'install' }));
  const wrong = summarize(gc, playCase({ route: 'install', wrongEdition: true }));
  assert.equal(wrong.stars, 3);
  assert.deepEqual(wrong.log, [...clean.log, { textTh: EDITION_NOTE_TH }]);
});
