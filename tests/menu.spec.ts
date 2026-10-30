// The menu the game opens on (docs/learning-path-plan.md, task B): the name form, the learning path cards,
// saved progress, "ผู้เรียนคนใหม่", and the links that skip it (?case=) or open everything (?unlock=all).

import { expect, test, type Page } from '@playwright/test';
import { expectStage, LEARNED, LEARNER, passMenu, reopenGame, skipOrder, skipTalk, takePreTest } from './helpers';

/** Set SHOTS=<folder> to keep a picture of the menu per screen size, for checking the layout by eye. */
const shot = async (page: Page, name: string, project: string) => {
  await expect(page.locator('#splash')).toHaveCount(0);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};

const seed = (page: Page, key: string, value: unknown) =>
  page.addInitScript(
    ([k, v]) => !localStorage.getItem('seeded') && (localStorage.setItem(k!, v!), localStorage.setItem('seeded', '1')),
    [key, JSON.stringify(value)],
  );

const menu = (page: Page) => page.getByTestId('menu');
const step = (page: Page, id: string) => menu(page).locator(`[data-step="${id}"]`);
const caseRow = (page: Page, id: string) => menu(page).locator(`[data-case="${id}"]`);

async function fitsScreen(page: Page) {
  const r = await page.evaluate(() => {
    const box = document.querySelector('.menu')!.getBoundingClientRect();
    const scroll = document.querySelector('.menu-scroll')!;
    return {
      page: document.documentElement.scrollWidth - window.innerWidth,
      inner: scroll.scrollWidth - scroll.clientWidth,
      inside: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 0.5 && box.bottom <= window.innerHeight + 0.5,
    };
  });
  expect(r).toEqual({ page: 0, inner: 0, inside: true });
}

test('a first visit asks for the name, checks it, then shows the path with case 1 next', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(menu(page)).toBeVisible();
  // No customer walks in while the menu is up.
  await expect(page.locator('.case-panel')).toHaveCount(0);
  await fitsScreen(page);
  await shot(page, 'menu-form', info.project.name);

  const save = menu(page).getByRole('button', { name: 'เริ่มเรียน' });
  await save.click();
  await expect(menu(page).getByRole('alert')).toHaveText('กรอกชื่อ-สกุล');
  await menu(page).getByLabel('ชื่อ-สกุล').fill(LEARNER.name);
  await menu(page).getByLabel('ชั้น').fill(LEARNER.room);
  await menu(page).getByLabel('เลขที่').fill('0');
  await save.click();
  await expect(menu(page).getByRole('alert')).toHaveText('เลขที่ต้องเป็นตัวเลข 1-99');
  await menu(page).getByLabel('เลขที่').fill('07');
  await save.click();

  await expect(menu(page).getByTestId('learner')).toHaveText('สมชาย ใจดี · ปวช.1/2 เลขที่ 7');
  // The pre-test comes first; the shop and the post-test are shut until then.
  await expect(menu(page).getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' })).toBeVisible();
  await expect(step(page, 'pre')).toHaveAttribute('data-status', 'open');
  for (const id of ['order', 'cases', 'post']) {
    await expect(step(page, id)).toHaveAttribute('data-status', 'locked');
    await expect(step(page, id).locator('.path-row')).toBeDisabled();
  }
  // Steps not built yet say so and cannot be tapped.
  for (const id of ['lesson-os', 'lesson-types', 'reflect', 'results']) {
    await expect(step(page, id)).toHaveAttribute('data-status', 'soon');
    await expect(step(page, id).locator('.path-row')).toBeDisabled();
  }
  await expect(step(page, 'lesson-os')).toContainText('วัตถุประสงค์ข้อ 1');
  for (const id of ['c01-boot-order', 'c02-rufus-scheme', 'c03-red-text', 'c04-security-chip', 'c05-lab-upgrade']) {
    await expect(caseRow(page, id)).toHaveAttribute('data-status', 'locked');
    await expect(caseRow(page, id).getByRole('button')).toBeDisabled();
  }
  await fitsScreen(page);
  await expect(menu(page).locator('.menu-scroll')).toHaveJSProperty('scrollTop', 0);
  await shot(page, 'menu-path', info.project.name);
  // The bottom of the list can be scrolled to on the smallest screen.
  await menu(page).getByRole('button', { name: 'ผู้เรียนคนใหม่' }).scrollIntoViewIfNeeded();
  await expect(menu(page).getByRole('button', { name: 'ผู้เรียนคนใหม่' })).toBeInViewport();

  // After the pre-test the ordering game opens, the shop still shut (tests/quiz.spec.ts and order.spec.ts cover them).
  await takePreTest(page);
  await expect(step(page, 'pre')).toHaveAttribute('data-status', 'done');
  await expect(step(page, 'order')).toHaveAttribute('data-status', 'open');
  await expect(step(page, 'cases')).toHaveAttribute('data-status', 'locked');
  await expect(menu(page).getByRole('button', { name: 'ทำต่อ: เรียงขั้นตอนการติดตั้ง' })).toBeVisible();
  // Then the cases open one by one.
  await skipOrder(page);
  await expect(step(page, 'cases')).toHaveAttribute('data-status', 'open');
  await expect(caseRow(page, 'c01-boot-order').getByRole('button')).toBeEnabled();
  await expect(caseRow(page, 'c02-rufus-scheme')).toHaveAttribute('data-status', 'locked');
  await menu(page).getByRole('button', { name: 'ทำต่อ: ฝึกงานที่ร้าน · เคส 1 ป้าสมศรี' }).click();
  await expect(menu(page)).toHaveCount(0);
  // The first time in the shop the senior comes over to talk first (tests/talk.spec.ts).
  await skipTalk(page);
  await expect(page.locator('.case-panel')).toContainText('ป้าสมศรี');
  expect(errors).toEqual([]);
});

test('the name stays after a reload, and the case 1 card also starts the case', async ({ page }) => {
  await page.goto('/');
  await passMenu(page);
  await reopenGame(page);
  await expect(menu(page).getByTestId('learner')).toContainText(LEARNER.name);
  await expect(menu(page).getByLabel('ชื่อ-สกุล')).toHaveCount(0);
  await caseRow(page, 'c01-boot-order').getByRole('button').click();
  await expect(menu(page)).toHaveCount(0);
  await skipTalk(page);
});

test('saved stars show on the case cards and the next case opens', async ({ page }, info) => {
  await seed(page, 'shop.progress.v2', { coins: 30, learner: LEARNER, ...LEARNED, cases: { 'c01-boot-order': { stars: 2, plays: 1 } } });
  await page.goto('/');
  await expect(caseRow(page, 'c01-boot-order')).toHaveAttribute('data-status', 'done');
  await expect(caseRow(page, 'c01-boot-order').getByLabel('ได้ 2 ดาว')).toBeVisible();
  await expect(caseRow(page, 'c02-rufus-scheme')).toHaveAttribute('data-status', 'open');
  await expect(caseRow(page, 'c03-red-text')).toHaveAttribute('data-status', 'locked');
  await expect(menu(page).getByRole('button', { name: 'ทำต่อ: ฝึกงานที่ร้าน · เคส 2 น้องบีม' })).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveAttribute('aria-label', 'เหรียญ 30');
  await fitsScreen(page);
  await shot(page, 'menu-stars', info.project.name);
});

test('"ผู้เรียนคนใหม่" asks first, then clears the name, stars and coins', async ({ page }) => {
  await seed(page, 'shop.progress.v2', { coins: 30, learner: LEARNER, ...LEARNED, cases: { 'c01-boot-order': { stars: 3, plays: 2 } } });
  await page.goto('/');
  await menu(page).getByRole('button', { name: 'ผู้เรียนคนใหม่' }).click();
  const ask = menu(page).getByRole('alertdialog');
  await expect(ask).toContainText(LEARNER.name);
  await ask.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(menu(page).getByTestId('learner')).toBeVisible();

  await menu(page).getByRole('button', { name: 'ผู้เรียนคนใหม่' }).click();
  await menu(page).getByRole('button', { name: 'ล้างและเริ่มใหม่' }).click();
  await expect(menu(page).getByLabel('ชื่อ-สกุล')).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveAttribute('aria-label', 'เหรียญ 0');
  await page.reload();
  await expect(menu(page).getByLabel('ชื่อ-สกุล')).toBeVisible();
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('shop.progress.v2')))!).cases).toEqual({});
});

test('coins saved by the old version are carried over', async ({ page }) => {
  await seed(page, 'shop.progress.v1', { coins: 25 });
  await page.goto('/');
  await expect(page.getByTestId('coins')).toHaveAttribute('aria-label', 'เหรียญ 25');
  await expect(menu(page).getByLabel('ชื่อ-สกุล')).toBeVisible();
});

test('?case= skips the menu; ?unlock=all opens every case', async ({ page }) => {
  await page.goto('/?case=c02-rufus-scheme');
  await expectStage(page, 'intro');
  await expect(menu(page)).toHaveCount(0);

  await seed(page, 'shop.progress.v2', { learner: LEARNER, ...LEARNED });
  await page.goto('/?unlock=all');
  for (const id of ['c02-rufus-scheme', 'c05-lab-upgrade']) await expect(caseRow(page, id).getByRole('button')).toBeEnabled();
});

test('the learning page is a page of its own: no shop behind it, and the shop scene loads only on the way there', async ({ page }, info) => {
  const scripts = () => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/game-[^/]*\.js$/.test(e.name)).length);
  await seed(page, 'shop.progress.v2', { coins: 30, learner: LEARNER, ...LEARNED });
  await page.goto('/');
  await expect(menu(page)).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'menu');
  await expect(page.locator('#game canvas')).toHaveCount(0);
  expect(await scripts()).toBe(0);
  // The shop's own HUD is not on this page; the coins are in the page's header.
  await expect(page.getByRole('button', { name: '☰ เมนู' })).toHaveCount(0);
  await expect(page.getByText('โหมดจำลอง')).toHaveCount(0);
  await expect(menu(page).getByTestId('coins')).toHaveAttribute('aria-label', 'เหรียญ 30');
  // Dark ink on the light chip, not the header's white.
  await expect(menu(page).getByTestId('coins')).toHaveCSS('color', 'rgb(27, 42, 74)');
  await shot(page, 'learn-page', info.project.name);

  await menu(page)
    .getByRole('button', { name: /^ทำต่อ/ })
    .click();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop');
  await skipTalk(page);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-shop-running', 'true');

  await page.getByRole('button', { name: '☰ เมนู' }).click();
  await expect(menu(page)).toBeVisible();
  await expect(page.locator('#game canvas')).toBeHidden();
  // Paused once the customer has walked out.
  await expect(page.locator('body')).toHaveAttribute('data-shop-running', 'false', { timeout: 8000 });

  await menu(page)
    .getByRole('button', { name: /^ทำต่อ/ })
    .click();
  await expectStage(page, 'intro');
  await expect(page.locator('body')).toHaveAttribute('data-shop-running', 'true');
  await expect(page.locator('#game canvas')).toHaveCount(1);
  expect(await scripts()).toBe(1);
});
