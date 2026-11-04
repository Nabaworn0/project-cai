// Big screens (src/ui/scale.ts): on a 1920×1080 lab monitor or projector the boards, the HUD and the talk box are
// drawn bigger, about as much of the screen as on a laptop, and everything still fits on the screen. The sign's name
// stays on the shop's sign. Small screens are left as they were.

import { expect, test, type Page } from '@playwright/test';
import { hudFits, LEARNED, LEARNER, openPc, openShop, PRE_DONE } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'one screen size, set here'));

const menu = (page: Page) => page.getByTestId('menu');
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};
const seed = (page: Page, progress: unknown) =>
  page.addInitScript(
    (v) => !localStorage.getItem('seeded') && (localStorage.setItem('shop.progress.v2', v), localStorage.setItem('seeded', '1')),
    JSON.stringify(progress),
  );

/** Nothing reaches past the screen, and the page does not scroll sideways. */
async function onScreen(page: Page, selector: string) {
  const r = await page.evaluate((sel) => {
    const b = document.querySelector(sel)!.getBoundingClientRect();
    return {
      page: document.documentElement.scrollWidth - window.innerWidth,
      inside: b.left >= -0.5 && b.top >= -0.5 && b.right <= window.innerWidth + 0.5 && b.bottom <= window.innerHeight + 0.5,
    };
  }, selector);
  expect(r).toEqual({ page: 0, inside: true });
}

test('the learning page drawn twice as big, the test about 1.7 times; both fit', async ({ page }) => {
  await seed(page, { learner: LEARNER });
  await page.goto('/');
  await expect(menu(page)).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui').trim())).toBe('1.69');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-big').trim())).toBe('1.18');
  // 560 px wide on a laptop.
  const board = (await page.locator('.learn-page .menu').boundingBox())!;
  expect(board.width).toBeCloseTo(560 * 1.69 * 1.18, -1);
  await onScreen(page, '.learn-page .menu');
  // The sign's name in the picture is still on its board, under the board's pin.
  const sign = (await page.locator('.entrance-sign').boundingBox())!;
  expect(sign.y + sign.height).toBeLessThanOrEqual(board.y);
  await shot(page, 'scale-menu');

  await menu(page).getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' }).click();
  const quiz = page.getByTestId('quiz');
  await quiz.getByRole('button', { name: 'เริ่มทำแบบทดสอบ' }).click();
  await expect(quiz.locator('.quiz-choice').first()).toBeVisible();
  // The question reads at about 17 px × 1.69 on screen.
  const box = (await quiz.locator('.quiz-choice').first().boundingBox())!;
  expect(box.height).toBeGreaterThan(70);
  // The test's board is not the learning path's: 1.69 only.
  expect((await page.locator('.learn-page .menu').boundingBox())!.width).toBeCloseTo(560 * 1.69, -1);
  await onScreen(page, '.learn-page .menu');
  await shot(page, 'scale-quiz');
});

test('a lesson and the ordering game fit on the big screen', async ({ page }) => {
  await seed(page, { learner: LEARNER, pre: PRE_DONE, done: ['lesson-os', 'lesson-types'] });
  await page.goto('/');
  await menu(page).locator('[data-step="lesson-os"] .path-row').click();
  await expect(page.getByTestId('lesson').locator('video')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
  await onScreen(page, '.learn-page .menu');
  await shot(page, 'scale-lesson');
  await page.getByTestId('lesson').getByRole('button', { name: '☰ เมนู' }).click();
  await menu(page).getByRole('button', { name: 'ทำต่อ: เรียงขั้นตอนการติดตั้ง' }).click();
  await page.getByTestId('order').getByRole('button', { name: 'เริ่มเรียงขั้นตอน' }).click();
  await onScreen(page, '.learn-page .menu');
  await shot(page, 'scale-order');
});

test('the shop: the HUD and the customer talk are bigger and fit, the talk in the middle; the sign keeps its name', async ({ page }) => {
  await openShop(page);
  await expect(page.getByRole('button', { name: 'รับเรื่อง' })).toBeVisible();
  const chip = (await page.locator('.hud .menu-chip').boundingBox())!;
  // About 29 px tall on a laptop.
  expect(chip.height).toBeGreaterThan(45);
  await hudFits(page);
  await onScreen(page, '.hud');
  await onScreen(page, '.case-panel');
  // The customer's talk stands in the middle at the bottom, under the faces: 640 px wide on a laptop, drawn 2× here
  // but kept to 65% of the screen's width.
  const panel = (await page.locator('.case-panel').boundingBox())!;
  expect(panel.x + panel.width / 2).toBeCloseTo(960, -1);
  expect(panel.width).toBeCloseTo(1920 * 0.65, -1);
  expect(panel.y).toBeGreaterThan(1080 * 0.6 - 1);
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  // The work ticket comes up as a big sheet in the middle of the screen, all of it and its button in sight.
  const sheet = page.locator('.case-panel[data-stage="ticket"]');
  const ticket = (await sheet.boundingBox())!;
  expect(ticket.x + ticket.width / 2).toBeCloseTo(960, -1);
  expect(ticket.y + ticket.height / 2).toBeCloseTo(540, -1);
  expect(ticket.width).toBeGreaterThan(1500);
  await expect(sheet.getByRole('button', { name: 'รับงาน' })).toBeInViewport({ ratio: 1 });
  await shot(page, 'scale-ticket');
  await page.getByRole('button', { name: 'รับงาน' }).click();
  // The four guesses two by two: all in sight without scrolling the panel.
  for (const c of await page.locator('.case-panel .choice').all()) await expect(c).toBeInViewport({ ratio: 1 });
  // The name sits on the sign drawn in the canvas, not zoomed off it.
  const label = (await page.locator('.sign-label').boundingBox())!;
  expect(label.x + label.width / 2).toBeCloseTo(960, -1);
  expect(label.y).toBeLessThan(150);
  await shot(page, 'scale-shop');
});

test("the customer's PC fits the big screen", async ({ page }) => {
  await openPc(page);
  await onScreen(page, '.pc-monitor');
  await shot(page, 'scale-pc');
});

test('a laptop and a phone are not scaled', async ({ page }) => {
  await seed(page, { learner: LEARNER, ...LEARNED });
  for (const [w, h] of [
    [1100, 640],
    [412, 915],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await expect(menu(page)).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui').trim())).toBe('1');
  }
  // The window made bigger: the scale follows.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui').trim())).toBe('1.69');
});
