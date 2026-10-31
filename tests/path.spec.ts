// The menu and the shop together (docs/learning-path-plan.md, task C): a case started from the menu saves
// its stars, the summary leads back to the menu or on to the next customer, and "☰ เมนู" asks before
// leaving a job half done. Case 5 as the last case of the path is in case5.spec.ts.

import { expect, test, type Page } from '@playwright/test';
import { expectStage, openShop, playCase1 } from './helpers';

const SHOTS = process.env.SHOTS;
const menu = (page: Page) => page.getByTestId('menu');
const caseRow = (page: Page, id: string) => menu(page).locator(`[data-case="${id}"]`);
const menuChip = (page: Page) => page.getByRole('button', { name: '☰ เมนู' });

test('case 1 from the menu: its stars and coins are saved, and the menu then offers case 2', async ({ page }, info) => {
  await openShop(page);
  await playCase1(page);
  const panel = page.locator('.case-panel');
  await expect(panel.getByRole('button', { name: 'รับลูกค้าคนถัดไป' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/summary-${info.project.name}.png` });
  await panel.getByRole('button', { name: 'กลับเมนู' }).click();

  await expect(caseRow(page, 'c01-boot-order')).toHaveAttribute('data-status', 'done');
  await expect(caseRow(page, 'c01-boot-order').getByLabel('ได้ 3 ดาว')).toBeVisible();
  await expect(caseRow(page, 'c02-rufus-scheme')).toHaveAttribute('data-status', 'open');
  await expect(page.getByTestId('coins')).toHaveAttribute('aria-label', 'เหรียญ 150');
  await page.reload();
  await expect(caseRow(page, 'c01-boot-order').getByLabel('ได้ 3 ดาว')).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveAttribute('aria-label', 'เหรียญ 150');

  await menu(page).getByRole('button', { name: 'ทำต่อ: ฝึกงานที่ร้าน · เคส 2 น้องบีม' }).click();
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('น้องบีม');
});

test('a replay from its card starts that case, and a worse run keeps the best stars and the first play stars', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the menu itself is checked at every size in menu.spec.ts');
  await openShop(page);
  await playCase1(page);
  await page.locator('.case-panel').getByRole('button', { name: 'กลับเมนู' }).click();
  // Case 2 is open now, but the case 1 card replays case 1.
  await caseRow(page, 'c01-boot-order').getByRole('button').click();
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('ป้าสมศรี');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: 'แฟลชไดรฟ์เสีย' }).click();
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
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expect(page.getByRole('group', { name: 'สรุปผล' }).locator('.stars')).toHaveAttribute('aria-label', '2 ดาว จาก 3');
  await page.locator('.case-panel').getByRole('button', { name: 'กลับเมนู' }).click();
  await expect(caseRow(page, 'c01-boot-order').getByLabel('ได้ 3 ดาว')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shop.progress.v2')!).cases['c01-boot-order']);
  expect(saved).toEqual({ stars: 3, plays: 2, first: 3 });
});

test('"☰ เมนู": straight back before the job starts; in the middle it asks, and leaving starts the case over', async ({ page }, info) => {
  await openShop(page);
  await expectStage(page, 'intro');
  await menuChip(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(page.locator('.case-panel')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveAttribute('data-case-stage', /./);

  await menu(page)
    .getByRole('button', { name: /^ทำต่อ/ })
    .click();
  await expectStage(page, 'intro');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await expectStage(page, 'ticket');
  // The HUD still fits on one line with the extra chip.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const chip = (await menuChip(page).boundingBox())!;
  const coins = (await page.getByTestId('coins').boundingBox())!;
  expect(Math.abs(chip.y - coins.y)).toBeLessThan(4);
  await menuChip(page).click();
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('เคสนี้จะเริ่มใหม่');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/leave-${info.project.name}.png` });
  await ask.getByRole('button', { name: 'ทำเคสต่อ' }).click();
  await expect(ask).toHaveCount(0);
  await expectStage(page, 'ticket');

  await menuChip(page).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'กลับเมนู' }).click();
  await expect(menu(page)).toBeVisible();
  // The customer walks out of the shop behind the menu.
  await expect(page.locator('body')).toHaveAttribute('data-customer-mood', '', { timeout: 8000 });
  await expect(caseRow(page, 'c01-boot-order')).toHaveAttribute('data-status', 'open');
  await menu(page)
    .getByRole('button', { name: /^ทำต่อ/ })
    .click();
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('ป้าสมศรี');
});

test('?case= links still go from customer to customer', async ({ page }) => {
  await page.goto('/?case=c01-boot-order');
  await playCase1(page);
  await page.getByRole('button', { name: 'รับลูกค้าคนถัดไป' }).click();
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('น้องบีม');
});
