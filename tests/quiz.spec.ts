// The course test on the learning page (docs/quiz-plan.md task B, src/ui/quiz/QuizScreen.tsx): one question at a
// time, back to change an answer, a check before sending, the score; the post-test compares with the pre-test
// per objective and explains every answer. A sitting left half way carries on later; a test is taken once.

import { expect, test, type Page } from '@playwright/test';
import courseTest from '../src/content/data/test.json' with { type: 'json' };
import { LEARNED, LEARNER, PRE_DONE } from './helpers';

const items = courseTest.items;
const CASES = ['c01-boot-order', 'c02-rufus-scheme', 'c03-red-text', 'c04-security-chip', 'c05-lab-upgrade'];
const menu = (page: Page) => page.getByTestId('menu');
const quiz = (page: Page) => page.getByTestId('quiz');
const step = (page: Page, id: string) => menu(page).locator(`[data-step="${id}"]`);
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('shop.progress.v2')!));
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};

const seed = (page: Page, progress: unknown) =>
  page.addInitScript(
    (v) => !localStorage.getItem('seeded') && (localStorage.setItem('shop.progress.v2', v), localStorage.setItem('seeded', '1')),
    JSON.stringify(progress),
  );

/** The item on screen, found by its question. */
async function current(page: Page) {
  const stem = await quiz(page).locator('.quiz-stem').innerText();
  const it = items.find((i) => i.stemTh === stem);
  expect(it, stem).toBeTruthy();
  return it!;
}

/** Answers the question on screen, rightly or not, by the choice's text (the order is shuffled). */
async function answer(page: Page, right: boolean) {
  const it = await current(page);
  const k = right ? it.answer : (it.answer + 1) % it.choicesTh.length;
  await quiz(page).getByRole('button', { name: it.choicesTh[k], exact: true }).click();
  return it;
}

/** The board is on screen whole, nothing sticks out sideways, and the picture behind cannot slide (focus or a
 *  scroll into view once slid the wider-than-the-screen picture 170px sideways). */
async function fits(page: Page) {
  const r = await page.evaluate(() => {
    document.querySelector('.learn-page')!.scrollLeft = 200;
    const box = document.querySelector('.menu')!.getBoundingClientRect();
    const scroll = document.querySelector('.menu-scroll')!;
    return {
      page: document.documentElement.scrollWidth - window.innerWidth,
      inner: scroll.scrollWidth - scroll.clientWidth,
      slid: document.querySelector('.learn-page')!.scrollLeft,
      inside: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 0.5 && box.bottom <= window.innerHeight + 0.5,
    };
  });
  expect(r).toEqual({ page: 0, inner: 0, slid: 0, inside: true });
}

test('the pre-test: one question at a time, back to change, a check before sending, then the score only', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page, { learner: LEARNER });
  await page.goto('/');
  await menu(page).getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' }).click();
  await expect(quiz(page).getByRole('heading', { name: 'แบบทดสอบก่อนเรียน' })).toBeVisible();
  await expect(quiz(page)).toContainText('ยังไม่ได้เรียนก็ไม่เป็นไร');
  await expect(quiz(page)).toContainText('ทำได้ครั้งเดียว');
  await fits(page);
  await shot(page, 'quiz-intro', info.project.name);
  await quiz(page).getByRole('button', { name: 'เริ่มทำแบบทดสอบ' }).click();

  const next = quiz(page).getByRole('button', { name: 'ข้อต่อไป →' });
  const prev = quiz(page).getByRole('button', { name: '← ข้อก่อนหน้า' });
  const bar = quiz(page).getByRole('progressbar');
  await expect(quiz(page).getByTestId('quiz-count')).toHaveText('ข้อ 1 จาก 10');
  await expect(quiz(page).locator('.quiz-choice')).toHaveCount(4);
  await expect(quiz(page).locator('.quiz-letter')).toHaveText(['ก', 'ข', 'ค', 'ง']);
  await expect(prev).toBeDisabled();
  await expect(next).toBeDisabled();
  await expect(bar).toHaveAttribute('aria-valuenow', '0');

  // A wrong answer first, changed after going on and coming back.
  const first = await answer(page, false);
  await expect(quiz(page).locator('.quiz-choice[aria-pressed="true"]')).toHaveCount(1);
  await expect(bar).toHaveAttribute('aria-valuenow', '1');
  // The way on is in sight once a choice is made, even on a phone on its side.
  await expect(next).toBeInViewport({ ratio: 0.95 }); // not 1: the edge can land half a pixel out (sub-pixel rounding)
  await fits(page);
  await shot(page, 'quiz-question', info.project.name);
  await next.click();
  await expect(quiz(page).getByTestId('quiz-count')).toHaveText('ข้อ 2 จาก 10');
  await expect(quiz(page).locator('.quiz-choice[aria-pressed="true"]')).toHaveCount(0);
  await prev.click();
  expect((await current(page)).id).toBe(first.id);
  await expect(quiz(page).locator('.quiz-choice[aria-pressed="true"]')).toContainText(first.choicesTh[(first.answer + 1) % 4]!);
  await answer(page, true);
  await expect(quiz(page).locator('.quiz-choice[aria-pressed="true"]')).toContainText(first.choicesTh[first.answer]!);
  await expect(bar).toHaveAttribute('aria-valuenow', '1');

  // Six right in all: questions 1-6 right, 7-10 wrong. Every item comes once.
  const seen = new Set([first.id]);
  for (let n = 2; n <= 10; n++) {
    await next.or(quiz(page).getByRole('button', { name: 'ตรวจก่อนส่ง' })).click();
    await expect(quiz(page).getByTestId('quiz-count')).toHaveText(`ข้อ ${n} จาก 10`);
    seen.add((await answer(page, n <= 6)).id);
  }
  expect(seen.size).toBe(10);
  await expect(next).toHaveCount(0);
  await quiz(page).getByRole('button', { name: 'ตรวจก่อนส่ง' }).click();

  const check = quiz(page).getByRole('alertdialog');
  await expect(check).toContainText('ตอบครบ 10 ข้อแล้ว');
  await expect(check).toContainText('ส่งแล้วจะกลับมาแก้ไม่ได้');
  await shot(page, 'quiz-check', info.project.name);
  // Not yet: back to look again, from question 1.
  await check.getByRole('button', { name: 'กลับไปทบทวน' }).click();
  await expect(quiz(page).getByTestId('quiz-count')).toHaveText('ข้อ 1 จาก 10');
  expect((await saved(page)).pre).toBeNull();
  for (let n = 1; n < 10; n++) await next.click();
  await quiz(page).getByRole('button', { name: 'ตรวจก่อนส่ง' }).click();
  await quiz(page).getByRole('alertdialog').getByRole('button', { name: 'ส่งคำตอบ' }).click();

  const result = quiz(page).getByTestId('quiz-result');
  await expect(result.locator('.quiz-score b')).toHaveText('6');
  await expect(result).toContainText('ไม่ต้องกังวล');
  // The pre-test gives nothing away.
  await expect(result).not.toContainText('เฉลยทุกข้อ');
  await expect(result).not.toContainText(first.explainTh);
  await expect(result.locator('.quiz-objectives')).toHaveCount(0);
  await fits(page);
  await shot(page, 'quiz-pre-result', info.project.name);

  const p = await saved(page);
  expect(p.pre).toMatchObject({ score: 6, total: 10 });
  expect(Object.keys(p.pre.answers).sort()).toEqual(items.map((i) => i.id).sort());
  expect(p.pre.answers[first.id]).toBe(first.answer);
  expect(p.testDraft).toBeNull();

  await result.getByRole('button', { name: 'ไปเรียนต่อ' }).click();
  await expect(step(page, 'pre')).toHaveAttribute('data-status', 'done');
  await expect(step(page, 'pre')).toContainText('6/10');
  // Taken once: the card cannot be opened again.
  await expect(step(page, 'pre').locator('.path-row')).toBeDisabled();
  // Next come the lessons (tests/lesson.spec.ts) and the ordering game (tests/order.spec.ts), then the shop.
  await expect(step(page, 'order')).toHaveAttribute('data-status', 'open');
  await expect(menu(page).getByRole('button', { name: 'ทำต่อ: บทเรียน: ระบบปฏิบัติการคืออะไร' })).toBeVisible();
  await fits(page);
  expect(errors).toEqual([]);
});

test('leaving half way keeps the answers, also after closing the page; the test carries on where it stopped', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the screens themselves are checked at every size above');
  await seed(page, { learner: LEARNER });
  await page.goto('/');
  await menu(page).getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' }).click();
  await quiz(page).getByRole('button', { name: 'เริ่มทำแบบทดสอบ' }).click();
  const done = [];
  for (let n = 1; n <= 3; n++) {
    done.push(await answer(page, true));
    await quiz(page).getByRole('button', { name: 'ข้อต่อไป →' }).click();
  }
  await quiz(page).getByRole('button', { name: '☰ เมนู' }).click();
  await expect(step(page, 'pre')).toContainText('ทำค้างไว้');
  await expect(step(page, 'cases')).toHaveAttribute('data-status', 'locked');

  await page.reload();
  await menu(page).getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' }).click();
  await expect(quiz(page)).toContainText('ทำค้างไว้ 3 จาก 10 ข้อ');
  await quiz(page).getByRole('button', { name: 'ทำต่อ' }).click();
  await expect(quiz(page).getByTestId('quiz-count')).toHaveText('ข้อ 4 จาก 10');
  await expect(quiz(page).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  // Same order and the old answers are still picked.
  for (let n = 3; n >= 1; n--) {
    await quiz(page).getByRole('button', { name: '← ข้อก่อนหน้า' }).click();
    expect((await current(page)).id).toBe(done[n - 1]!.id);
    await expect(quiz(page).locator('.quiz-choice[aria-pressed="true"]')).toContainText(done[n - 1]!.choicesTh[done[n - 1]!.answer]!);
  }
});

test('the post-test: the score beside the pre-test, per objective, and every answer explained', async ({ page }, info) => {
  // Before: objective 1 all right, the rest wrong.
  const preAnswers = Object.fromEntries(items.map((i) => [i.id, i.objective === 1 ? i.answer : (i.answer + 1) % 4]));
  await seed(page, {
    learner: LEARNER,
    ...LEARNED,
    pre: { ...PRE_DONE, score: 3, answers: preAnswers },
    cases: Object.fromEntries(CASES.map((c) => [c, { stars: 2, plays: 1 }])),
  });
  await page.goto('/');
  await menu(page).getByRole('button', { name: 'ทำต่อ: แบบทดสอบหลังเรียน' }).click();
  await expect(quiz(page).getByRole('heading', { name: 'แบบทดสอบหลังเรียน' })).toBeVisible();
  await expect(quiz(page)).toContainText('ชุดเดียวกับก่อนเรียน');
  await quiz(page).getByRole('button', { name: 'เริ่มทำแบบทดสอบ' }).click();
  // All right but the TPM question.
  for (let n = 1; n <= 10; n++) {
    const it = await current(page);
    await answer(page, it.id !== 'w11-tpm');
    await quiz(page)
      .getByRole('button', { name: n === 10 ? 'ตรวจก่อนส่ง' : 'ข้อต่อไป →' })
      .click();
  }
  await quiz(page).getByRole('alertdialog').getByRole('button', { name: 'ส่งคำตอบ' }).click();

  const result = quiz(page).getByTestId('quiz-result');
  await expect(result.locator('.quiz-score b')).toHaveText(['3', '9']);
  await expect(result).toContainText('เก่งขึ้น 6 ข้อ');
  await expect(result.locator('.quiz-objectives tbody tr')).toHaveText([/ข้อ 1.*3\/3\s*3\/3/, /ข้อ 2.*0\/3\s*3\/3/, /ข้อ 3.*0\/4\s*3\/4/]);
  await fits(page);
  await shot(page, 'quiz-post-result', info.project.name);

  const key = result.locator('.quiz-key li');
  await expect(key).toHaveCount(10);
  await expect(result.locator('.quiz-key li.wrong')).toHaveCount(1);
  const tpm = items.find((i) => i.id === 'w11-tpm')!;
  const wrong = result.locator('[data-item="w11-tpm"]');
  await expect(wrong).toContainText('✗ ผิด');
  await expect(wrong.locator('.quiz-answer')).toHaveText(`คำตอบที่ถูก: ${tpm.choicesTh[tpm.answer]}`);
  await expect(wrong.locator('.quiz-explain')).toHaveText(tpm.explainTh);
  const os = items.find((i) => i.id === 'os-meaning')!;
  await expect(result.locator('[data-item="os-meaning"]')).toContainText('✓ ถูก');
  await expect(result.locator('[data-item="os-meaning"] .quiz-answer')).toHaveCount(0);
  await expect(result.locator('[data-item="os-meaning"] .quiz-explain')).toHaveText(os.explainTh);
  // The whole key can be scrolled to, down to the way back.
  await result.getByRole('button', { name: 'กลับเส้นทางเรียน' }).scrollIntoViewIfNeeded();
  await expect(result.getByRole('button', { name: 'กลับเส้นทางเรียน' })).toBeInViewport();
  await fits(page);
  await shot(page, 'quiz-post-key', info.project.name);

  expect((await saved(page)).post).toMatchObject({ score: 9, total: 10 });
  await result.getByRole('button', { name: 'กลับเส้นทางเรียน' }).click();
  await expect(step(page, 'post')).toContainText('9/10');
  await expect(step(page, 'post').locator('.path-row')).toBeDisabled();
});

test("?unlock=all: the teacher can take a test again, but the learner's first result stands", async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the screens themselves are checked at every size above');
  await seed(page, { learner: LEARNER, pre: PRE_DONE });
  await page.goto('/?unlock=all');
  await step(page, 'pre').locator('.path-row').click();
  await quiz(page).getByRole('button', { name: 'เริ่มทำแบบทดสอบ' }).click();
  for (let n = 1; n <= 10; n++) {
    await answer(page, true);
    await quiz(page)
      .getByRole('button', { name: n === 10 ? 'ตรวจก่อนส่ง' : 'ข้อต่อไป →' })
      .click();
  }
  await quiz(page).getByRole('alertdialog').getByRole('button', { name: 'ส่งคำตอบ' }).click();
  await expect(quiz(page).locator('.quiz-score b')).toHaveText('10');
  const p = await saved(page);
  expect(p.pre.score).toBe(PRE_DONE.score);
  expect(p.testDraft).toBeNull();
  await quiz(page).getByRole('button', { name: 'ไปเรียนต่อ' }).click();
  await expect(step(page, 'pre')).toContainText(`${PRE_DONE.score}/10`);
});
