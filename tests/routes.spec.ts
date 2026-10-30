// Each page has its own address (docs/pages-plan.md task A, src/core/routes.ts): taps change it, Back and Forward
// move between pages, a reload stays on the page, an address that cannot open yet lands on the learning page, and
// Back in the middle of a case asks first, as "☰ เมนู" does.

import { expect, test, type Page } from '@playwright/test';
import { ALL_TALKS, expectStage, LEARNED, LEARNER, openShop, PRE_DONE } from './helpers';

const menu = (page: Page) => page.getByTestId('menu');
const at = (page: Page, route: string) => expect(page).toHaveURL(new RegExp(`#/${route}$`));
const seed = (page: Page, progress: unknown) =>
  page.addInitScript(
    (v) => !localStorage.getItem('seeded') && (localStorage.setItem('shop.progress.v2', v), localStorage.setItem('seeded', '1')),
    JSON.stringify(progress),
  );

test('taps change the address; Back and Forward move between the pages', async ({ page }) => {
  await seed(page, { learner: LEARNER });
  await page.goto('/');
  await expect(menu(page)).toBeVisible({ timeout: 15_000 });
  await at(page, 'learn');
  await menu(page).getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' }).click();
  await expect(page.getByTestId('quiz')).toBeVisible();
  await at(page, 'pre');
  await page.getByTestId('quiz').getByRole('button', { name: '☰ เมนู' }).click();
  await expect(menu(page)).toBeVisible();
  await at(page, 'learn');
  await page.goBack();
  await expect(page.getByTestId('quiz')).toBeVisible();
  await at(page, 'pre');
  await page.goBack();
  await expect(menu(page)).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId('quiz').getByRole('heading', { name: 'แบบทดสอบก่อนเรียน' })).toBeVisible();
});

test('a reload stays on the page: the ordering game, and the shop with the case that is due', async ({ page }) => {
  await seed(page, { learner: LEARNER, ...LEARNED, seen: ALL_TALKS });
  await page.goto('/#/order');
  await expect(page.getByTestId('order').getByRole('button', { name: 'เริ่มรอบ 1' })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByTestId('order').getByRole('button', { name: 'เริ่มรอบ 1' })).toBeVisible({ timeout: 15_000 });
  await at(page, 'order');
  await page.goto('/#/shop');
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('ป้าสมศรี');
  await page.reload();
  await expectStage(page, 'intro');
  await at(page, 'shop');
});

test('an address that cannot open yet lands on the learning page, and says so', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'addresses do not depend on the screen size');
  // No name yet: only the learning page, with the name form.
  await page.goto('/#/pre');
  await expect(menu(page).getByLabel('ชื่อ-สกุล')).toBeVisible({ timeout: 15_000 });
  await at(page, 'learn');

  await seed(page, { learner: LEARNER, pre: PRE_DONE });
  for (const [route, why] of [
    ['shop', 'the ordering game is not done'],
    ['post', 'the cases are not played'],
    ['pre', 'the pre-test is taken once'],
    ['nonsense', 'no such page'],
  ]) {
    await page.goto(`/#/${route}`);
    await expect(menu(page), why).toBeVisible({ timeout: 15_000 });
    await at(page, 'learn');
  }
  // The teacher's ?unlock=all opens them.
  await page.goto('/?unlock=all#/post');
  await expect(page.getByTestId('quiz').getByRole('heading', { name: 'แบบทดสอบหลังเรียน' })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\?unlock=all#\/post$/);
});

test('Back in the middle of a case asks first; before the job starts it just goes back', async ({ page }) => {
  await openShop(page);
  await at(page, 'shop');
  await expectStage(page, 'intro');
  // The customer has not been taken on yet: Back goes straight to the learning page.
  await page.goBack();
  await expect(menu(page)).toBeVisible();
  await page.goForward();
  await expectStage(page, 'intro');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await expectStage(page, 'ticket');

  await page.goBack();
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('เคสนี้จะเริ่มใหม่');
  await at(page, 'shop');
  await ask.getByRole('button', { name: 'ทำเคสต่อ' }).click();
  await expect(ask).toHaveCount(0);
  await expectStage(page, 'ticket');

  await page.goBack();
  await page.getByRole('alertdialog').getByRole('button', { name: 'กลับเมนู' }).click();
  await expect(menu(page)).toBeVisible();
  await at(page, 'learn');
});

test('?case= links go straight to the customer, whatever the address says', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'addresses do not depend on the screen size');
  await page.goto('/?case=c02-rufus-scheme#/learn');
  await expectStage(page, 'intro');
  await expect(menu(page)).toHaveCount(0);
});
