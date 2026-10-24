// npm run test:unit — the customer's lines during a repair (src/core/reactions.ts, case1-plan task F).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GENERIC_REACTIONS, goodbyeLine, reactionLine } from '../src/core/reactions';
import { CaseSchema } from '../src/content/schema';

const c01 = CaseSchema.parse(JSON.parse(readFileSync(new URL('../src/content/data/cases/c01-boot-order.json', import.meta.url), 'utf8')));
const somsri = c01.customer.reactionsTh;

test("Somsri has her own lines for every moment of case 1", () => {
  assert.ok(somsri.oldWindowsTh && somsri.oldWindowsTh.length >= 2);
  assert.ok(somsri.noBootTh && somsri.fixedTh && somsri.goodbyeTh);
  for (const line of [...somsri.oldWindowsTh!, somsri.noBootTh!, somsri.fixedTh!, ...somsri.goodbyeTh!]) {
    assert.ok(!Object.values(GENERIC_REACTIONS).flat().includes(line), `"${line}" should be Somsri's own, not a generic line`);
  }
});

test('each boot into the old Windows gets the next line, starting again after the last', () => {
  const lines = somsri.oldWindowsTh!;
  lines.forEach((l, i) => assert.equal(reactionLine(somsri, 'old-windows', i + 1), l));
  assert.equal(reactionLine(somsri, 'old-windows', lines.length + 1), lines[0]);
  assert.equal(reactionLine(somsri, 'no-boot'), somsri.noBootTh);
  assert.equal(reactionLine(somsri, 'fixed'), somsri.fixedTh);
});

test('the goodbye follows the stars (1, 2, 3) and stays in range', () => {
  assert.equal(goodbyeLine(somsri, 1), somsri.goodbyeTh![0]);
  assert.equal(goodbyeLine(somsri, 2), somsri.goodbyeTh![1]);
  assert.equal(goodbyeLine(somsri, 3), somsri.goodbyeTh![2]);
  assert.equal(goodbyeLine(somsri, 0), somsri.goodbyeTh![0]);
  assert.equal(goodbyeLine(somsri, 9), somsri.goodbyeTh![2]);
});

test('a case without its own lines falls back to the generic ones', () => {
  assert.equal(reactionLine({}, 'old-windows', 1), GENERIC_REACTIONS.oldWindowsTh[0]);
  assert.equal(reactionLine({}, 'no-boot'), GENERIC_REACTIONS.noBootTh);
  assert.equal(reactionLine({}, 'fixed'), GENERIC_REACTIONS.fixedTh);
  assert.equal(goodbyeLine({}, 3), GENERIC_REACTIONS.goodbyeTh[2]);
  // Only some lines given: the rest still fall back.
  assert.equal(reactionLine({ fixedTh: 'เย้' }, 'no-boot'), GENERIC_REACTIONS.noBootTh);
});

test('reaction lines are checked: goodbye needs exactly three, and misspelled keys are errors', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/content/data/cases/c01-boot-order.json', import.meta.url), 'utf8'));
  raw.customer.reactionsTh.goodbyeTh = ['หนึ่ง', 'สอง'];
  assert.equal(CaseSchema.safeParse(raw).success, false);
  raw.customer.reactionsTh = { fixTh: 'สะกดผิด' };
  assert.equal(CaseSchema.safeParse(raw).success, false);
});
