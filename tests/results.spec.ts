// The learner's results (docs/results-plan.md task B, src/ui/results/): open from the start; the tests before and
// after, each objective every way it is measured, the steps still to do with a way there, and the results to send
// the teacher as a file (read back by the teacher's side) or as text.

import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import testJson from '../src/content/data/test.json' with { type: 'json' };
import { readResultsFile } from '../src/core/results';
import { ALL_TALKS, LEARNED, LEARNER, PRE_DONE } from './helpers';

const items = testJson.items;
/** A sitting with the first `right` items right. */
const sitting = (right: number) => ({
  score: right,
  total: items.length,
  answers: Object.fromEntries(items.map((it, i) => [it.id, i < right ? it.answer : (it.answer + 1) % it.choicesTh.length])),
  at: 1,
  seconds: 60,
});
const CASES = ['c01-boot-order', 'c02-rufus-scheme', 'c03-red-text', 'c04-security-chip', 'c05-lab-upgrade'];
const MOST = {
  learner: LEARNER,
  ...LEARNED,
  pre: sitting(3),
  post: sitting(8),
  cases: Object.fromEntries(CASES.slice(0, 3).map((c) => [c, { stars: 3, plays: 2, first: 2 }])),
  reflect: { self: { 'self-os': 4, 'self-install': 3 }, write: {}, sat: {}, suggest: '', at: 1 },
  seen: ALL_TALKS,
};
const results = (page: Page) => page.getByTestId('results');
const menu = (page: Page) => page.getByTestId('menu');
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};

async function open(page: Page, progress: Record<string, unknown>) {
  await page.addInitScript((v) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('shop.progress.v2', v);
    localStorage.setItem('seeded', '1');
  }, JSON.stringify(progress));
  await page.goto('/');
  await menu(page).locator('[data-step="results"] .path-row').click();
  await expect(results(page)).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
}

test('the results: tests before and after, each objective four ways, what is left with a way there', async ({ page }, info) => {
  await open(page, MOST);
  await expect(page).toHaveURL(/#\/results$/);
  await expect(results(page)).toContainText(`${LEARNER.name} · ${LEARNER.room} · เลขที่ ${LEARNER.no}`);
  await expect(results(page).locator('.quiz-score b')).toHaveText(['3', '8']);
  await expect(results(page).locator('.quiz-gain')).toHaveText('เก่งขึ้น 5 ข้อ');
  // pre, both lessons, order, post: 5 of 7 (cases 3 of 5, reflection not sent).
  await expect(results(page).getByTestId('results-steps')).toHaveText('ทำครบ 5 จาก 7 ขั้น');
  const o1 = results(page).locator('[data-objective="1"] .results-cell');
  await expect(o1.locator('b')).toHaveText(['3/3', '-', '3/3', '★★★★']);
  const o4 = results(page).locator('[data-objective="4"] .results-cell');
  await expect(o4.locator('b')).toHaveText(['-', '6/9', '-', '★★★']);
  await expect(results(page).locator('[data-objective="3"] .results-cell b').nth(1)).toHaveText('2/3');
  // Still to do, each with a way there when it is open.
  await expect(results(page).locator('.results-todo li')).toHaveCount(2);
  await expect(results(page).locator('[data-step="cases"]')).toContainText('(เล่นแล้ว 3/5 เคส)');
  await expect(results(page).locator('[data-step="reflect"] button')).toHaveText('ไปทำ');
  // Nothing off the side; on a phone the figures go two by two.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const cells = await o1.evaluateAll((cs) => new Set(cs.map((c) => Math.round(c.getBoundingClientRect().top))).size);
  expect(cells).toBe(info.project.name === 'desktop' || info.project.name === 'phone-landscape' ? 1 : 2);
  await shot(page, 'results-top', info.project.name);
  await results(page).locator('.results-send').scrollIntoViewIfNeeded();
  await shot(page, 'results-send', info.project.name);
  await results(page).locator('[data-step="cases"] button').click();
  await expect(page).toHaveURL(/#\/shop$/);
});

test('the results file downloads with a name that says who, and reads back as the same results', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the page itself is checked at every size above');
  await open(page, MOST);
  const [download] = await Promise.all([page.waitForEvent('download'), results(page).getByRole('button', { name: 'ดาวน์โหลดไฟล์ผล' }).click()]);
  expect(download.suggestedFilename()).toBe('ผลการเรียน-ปวช.1-2-เลขที่07-สมชาย.json');
  const back = readResultsFile(readFileSync((await download.path())!, 'utf8'));
  expect(back.ok).toBe(true);
  if (!back.ok) return;
  expect(back.edited).toBe(false);
  expect([back.data.learner, back.data.post?.score, back.data.cases['c01-boot-order']]).toEqual([LEARNER, 8, { stars: 3, plays: 2, first: 2 }]);
});

test('copied as text for a chat; a learner with nothing done sees dashes and every step to do', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'the page itself is checked at every size above');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, MOST);
  await results(page).getByRole('button', { name: 'คัดลอกผลเป็นข้อความ' }).click();
  await expect(results(page).locator('.results-copied')).toHaveText('คัดลอกแล้ว นำไปวางได้เลย');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('แบบทดสอบ: ก่อนเรียน 3/10 → หลังเรียน 8/10 (+5)');
  expect(text).toContain(`${LEARNER.name} · ${LEARNER.room} · เลขที่ ${LEARNER.no}`);

  const fresh = await context.newPage();
  await fresh.addInitScript((v) => localStorage.setItem('shop.progress.v2', v), JSON.stringify({ learner: LEARNER, pre: PRE_DONE }));
  await fresh.goto('/#/results');
  await expect(results(fresh)).toBeVisible();
  await expect(results(fresh).locator('.quiz-score b').nth(1)).toHaveText('-');
  await expect(results(fresh).locator('.quiz-gain')).toHaveCount(0);
  await expect(results(fresh).locator('.results-todo li')).toHaveCount(6);
  // A step not open yet is listed without a way there.
  await expect(results(fresh).locator('[data-step="post"] button')).toHaveCount(0);
  await expect(results(fresh).locator('[data-step="lesson-os"] button')).toHaveText('ไปทำ');
  await expect(results(fresh).locator('[data-objective="2"] .results-cell.empty')).toHaveCount(3, { timeout: 2000 });
});
