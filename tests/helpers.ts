// Shared steps for the Playwright tests: open the shop, play case 1 up to the repair, open the PC.

import { expect, type Page } from '@playwright/test';

export const LEARNER = { name: 'สมชาย ใจดี', room: 'ปวช.1/2', no: '7' };

/** A pre-test already taken, for seeding progress: the shop stays shut until there is one. */
export const PRE_DONE = { score: 4, total: 10, answers: {}, at: 1, seconds: 300 };

/** Closing the tab and opening the game again: the address without its page (#/shop …) opens the learning page,
 *  where a reload would stay on the same page (tests/routes.spec.ts). */
export async function reopenGame(page: Page) {
  await page.evaluate(() => history.replaceState(null, '', location.pathname + location.search));
  await page.reload();
}

/** The learning before the shop, done (the pre-test, both lessons and the ordering game), for seeding progress. */
export const LEARNED = {
  pre: PRE_DONE,
  done: ['lesson-os', 'lesson-types', 'order'],
  order: { stars: 2, plays: 1, first: { tries: [3, 4], solved: [true, true], lost: 1 } },
};

/** The lessons and the ordering game marked done on this device and the page reloaded: tests about the shop do not
 *  play them (tests/lesson.spec.ts and tests/order.spec.ts do). */
export async function skipOrder(page: Page) {
  await page.evaluate((learned) => {
    const p = JSON.parse(localStorage.getItem('shop.progress.v2') ?? '{}');
    localStorage.setItem('shop.progress.v2', JSON.stringify({ ...p, done: [...(p.done ?? []), ...learned.done], order: learned.order }));
  }, LEARNED);
  await page.reload();
  await expect(page.getByTestId('menu')).toBeVisible({ timeout: 15_000 });
}

/** From the learning page, the pre-test start to finish (always the first choice), back to the page. */
export async function takePreTest(page: Page) {
  await page.getByTestId('menu').getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' }).click();
  const quiz = page.getByTestId('quiz');
  await quiz.getByRole('button', { name: 'เริ่มทำแบบทดสอบ' }).click();
  for (let n = 1; n <= 10; n++) {
    await expect(quiz.getByTestId('quiz-count')).toHaveText(`ข้อ ${n} จาก 10`);
    await quiz.locator('.quiz-choice').first().click();
    await quiz.getByRole('button', { name: n === 10 ? 'ตรวจก่อนส่ง' : 'ข้อต่อไป →' }).click();
  }
  await quiz.getByRole('button', { name: 'ส่งคำตอบ' }).click();
  await quiz.getByRole('button', { name: 'ไปเรียนต่อ' }).click();
  await expect(page.getByTestId('menu')).toBeVisible();
}

/** The menu the game opens on: give the learner's name the first time, take the pre-test and skip the lessons and
 *  the ordering game if they are still to do, then "ทำต่อ". */
export async function passMenu(page: Page) {
  const menu = page.getByTestId('menu');
  // The first load (fonts, then the page) can take a while when every test runs at once.
  await expect(menu).toBeVisible({ timeout: 15_000 });
  if (await menu.getByLabel('ชื่อ-สกุล').isVisible()) {
    await menu.getByLabel('ชื่อ-สกุล').fill(LEARNER.name);
    await menu.getByLabel('ชั้น').fill(LEARNER.room);
    await menu.getByLabel('เลขที่').fill(LEARNER.no);
    await menu.getByRole('button', { name: 'เริ่มเรียน' }).click();
  }
  if (await menu.getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' }).isVisible()) await takePreTest(page);
  if (await menu.getByRole('button', { name: /^ทำต่อ: (บทเรียน|เรียงขั้นตอน)/ }).isVisible()) await skipOrder(page);
  await menu.getByRole('button', { name: /^ทำต่อ/ }).click();
  await expect(menu).toHaveCount(0);
  // The shutter between pages is fully up again (src/ui/Shutter.tsx).
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
}

/** Every talk with the senior marked as already seen, so tests about other things go straight to the customer. */
export const ALL_TALKS = ['intro', 'c01-boot-order', 'c02-rufus-scheme', 'c03-red-text', 'c04-security-chip', 'c05-lab-upgrade'];

/** A first visit: the learning page, then through it to the shop and the first customer (pre-test and ordering game done, talks
 *  already seen, unless `talks` is set: tests/talk.spec.ts covers them, and then the pre-test is taken here). */
export async function openShop(page: Page, { talks = false } = {}) {
  if (!talks)
    await page.addInitScript(
      ([seen, learned]) =>
        !localStorage.getItem('talks-seeded') &&
        (localStorage.setItem('shop.progress.v2', JSON.stringify({ seen, ...learned })), localStorage.setItem('talks-seeded', '1')),
      [ALL_TALKS, LEARNED] as const,
    );
  await page.goto('/');
  await expect(page.locator('#splash')).toHaveCount(0);
  await passMenu(page);
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop');
}

export const expectStage = (page: Page, stage: string) => expect(page.locator('body')).toHaveAttribute('data-case-stage', stage, { timeout: 8000 });

/** Case 1's right answer to "guess the cause" (c01-boot-order.json). */
export const C1_DIAGNOSIS = 'เครื่องตั้งให้บูตจากฮาร์ดดิสก์ก่อน USB';

/** From the shop opening to the repair stage, answering the diagnosis with `diagnosis`. */
export async function playToRepair(page: Page, diagnosis = C1_DIAGNOSIS) {
  await openShop(page);
  await expectStage(page, 'intro');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: diagnosis }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await expectStage(page, 'repair');
}

/** Case 1 up to the customer's PC showing POST. */
export async function openPc(page: Page) {
  await playToRepair(page);
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'post');
}

/** Case 1 from its intro to the summary, the textbook route on the keyboard: 3 stars. */
export async function playCase1(page: Page) {
  await expectStage(page, 'intro');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: C1_DIAGNOSIS }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  for (const k of [
    'F2',
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
    'ArrowDown',
    'ArrowDown',
    'Enter',
    'Enter',
    'ArrowDown',
    'Enter',
    'F10',
    'Enter',
    'Enter',
    'x',
  ]) {
    await page.keyboard.press(k);
  }
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
}

/** A talk with the senior is on screen: skip it and wait for the customer. */
export async function skipTalk(page: Page) {
  await expect(page.getByTestId('talk')).toBeVisible({ timeout: 8000 });
  await page.getByTestId('talk').getByRole('button', { name: 'ข้าม' }).click();
  await expectStage(page, 'intro');
}
