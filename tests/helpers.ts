// Shared steps for the Playwright tests: open the shop, play case 1 up to the repair, open the PC.

import { expect, type Page } from '@playwright/test';

export async function openShop(page: Page) {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop');
  await expect(page.locator('#splash')).toHaveCount(0);
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
