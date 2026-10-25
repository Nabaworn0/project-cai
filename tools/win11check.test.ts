// npm run test:unit — the Windows 11 requirements table on the work ticket (src/core/win11check.ts, case 4):
// what the ticket can tell, what only the BIOS can, and how the session scores it.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { generateCase } from '../src/core/cases';
import { healthyMachine } from '../src/core/machine';
import { blockedNext, SCORING, startSession, step, summarize, type Session, type SessionEvent } from '../src/core/session';
import { checkAnswer, checkValueTh, WIN11_CHECK_IDS, type CheckAnswer } from '../src/core/win11check';
import { BrandSchema, CaseSchema, ProblemsSchema, Win11CheckSchema } from '../src/content/schema';

const data = (path: string) => JSON.parse(readFileSync(new URL(`../src/content/data/${path}`, import.meta.url), 'utf8'));
const lib = { problems: ProblemsSchema.parse(data('problems.json')), brands: [BrandSchema.parse(data('brands/classic.json'))] };
const c04 = CaseSchema.parse(data('cases/c04-security-chip.json'));
const c01 = CaseSchema.parse(data('cases/c01-boot-order.json'));
const ton = generateCase(c04, lib, 's1');
const RIGHT: Record<string, CheckAnswer> = { cpu: 'pass', ram: 'pass', storage: 'pass', 'secure-boot': 'bios', tpm: 'bios' };

const play = (gc: typeof ton, events: SessionEvent[], s: Session = startSession(gc)) => events.reduce((acc, e) => step(gc, acc, e), s);
const NEXT: SessionEvent = { type: 'next' };
const answerAll = (wrong: string[] = []): SessionEvent[] =>
  WIN11_CHECK_IDS.map((id) => ({ type: 'check', id, answer: wrong.includes(id) ? (RIGHT[id] === 'pass' ? 'fail' : 'pass') : RIGHT[id]! }));

test("Ton's PC: CPU, RAM and disk pass from the ticket; Secure Boot and TPM can only be seen in the BIOS", () => {
  for (const id of WIN11_CHECK_IDS) assert.equal(checkAnswer(id, ton.machine), RIGHT[id], id);
  assert.equal(checkValueTh('ram', ton.machine), 'RAM 16 GB');
  assert.equal(checkValueTh('tpm', ton.machine), 'ใบงานไม่ได้บอก');
  // TPM is off on his PC, yet the ticket cannot show it: the answer is still "look in the BIOS".
  assert.equal(ton.machine.tpmEnabled, false);
});

test('a PC that falls short fails on the ticket: old CPU, 2 GB of RAM, a 32 GB disk', () => {
  const m = { ...healthyMachine('classic'), cpuWin11: false, ramGB: 2, storageGB: 32 };
  assert.deepEqual(
    ['cpu', 'ram', 'storage'].map((id) => checkAnswer(id as 'cpu', m)),
    ['fail', 'fail', 'fail'],
  );
  assert.equal(checkAnswer('ram', { ...m, ramGB: 4 }), 'pass', '4 GB is enough');
  assert.equal(checkAnswer('storage', { ...m, storageGB: 64 }), 'pass', '64 GB is enough');
});

test('case 4 cannot take the job until every row is answered; case 1 has no table', () => {
  const ticket = play(ton, [NEXT]);
  assert.equal(ticket.stage, 'ticket');
  assert.notEqual(blockedNext(ticket, ton), null);
  assert.throws(() => step(ton, ticket, NEXT));
  const done = play(ton, answerAll(), ticket);
  assert.equal(blockedNext(done, ton), null);
  assert.equal(step(ton, done, NEXT).stage, 'diagnose');

  const somsri = generateCase(c01, lib, 's1');
  const t1 = play(somsri, [NEXT]);
  assert.equal(blockedNext(t1, somsri), null);
  assert.throws(() => step(somsri, t1, { type: 'check', id: 'cpu', answer: 'pass' }), /no requirements table/);
});

test('each row is answered once, only on the ticket', () => {
  const ticket = play(ton, [NEXT]);
  const once = step(ton, ticket, { type: 'check', id: 'tpm', answer: 'bios' });
  assert.deepEqual(once.checks, [{ id: 'tpm', answer: 'bios', correct: true }]);
  assert.throws(() => step(ton, once, { type: 'check', id: 'tpm', answer: 'pass' }), /already answered/);
  assert.throws(() => step(ton, startSession(ton), { type: 'check', id: 'cpu', answer: 'pass' }), /no requirements table/);
});

test('right rows earn coins, wrong ones cost nothing: no stars, no satisfaction', () => {
  const finish = (wrong: string[]) =>
    summarize(
      ton,
      play(ton, [
        NEXT,
        ...answerAll(wrong),
        NEXT,
        { type: 'diagnose', choice: c04.diagnosis.answer },
        NEXT,
        { type: 'repaired', route: 'bios' },
        NEXT,
        ...c04.customerQuestions.map((q): SessionEvent => ({ type: 'answer', choice: q.answer })),
        NEXT,
      ]),
    );
  const all = finish([]);
  const two = finish(['tpm', 'cpu']);
  assert.deepEqual(all.check, { correct: 5, total: 5 });
  assert.deepEqual(two.check, { correct: 3, total: 5 });
  assert.equal(all.coins - two.coins, 2 * SCORING.checkCoin);
  assert.equal(two.stars, 3);
  assert.equal(two.satisfaction, all.satisfaction);
  assert.equal(summarize(generateCase(c01, lib, 's1'), startSession(generateCase(c01, lib, 's1'))).check, null);
});

test('the table file has each requirement once, in Thai', () => {
  const t = Win11CheckSchema.parse(data('win11-check.json'));
  assert.deepEqual(
    t.rows.map((r) => r.id),
    [...WIN11_CHECK_IDS],
  );
  assert.ok(t.rows.every((r) => /[ก-๙]/.test(r.requirementTh) || /\d/.test(r.requirementTh)));
});
