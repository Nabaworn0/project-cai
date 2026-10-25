// Case 3 task C: Windows 11 Setup on Lung Chai's PC, tried through the content viewer's "หน้าจอจำลอง" tab
// (before task D puts the case in the shop). Screenshots go to test-results/.

import { expect, test, type Page, type TestInfo } from '@playwright/test';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const setupPage = (page: Page) => page.locator('body');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true }).click();
const row = (page: Page, id: string) => page.locator(`[data-part="${id}"]`);

/** Opens Lung Chai's PC in the lab and boots the stick: POST (Enter), then "Press any key". */
async function openChai(page: Page, o: { noKey?: boolean; backedUp?: boolean } = {}) {
  await page.goto('/?view=content#sims');
  if (o.noKey) await page.getByLabel('ลูกค้าไม่มี Product Key').check();
  if (o.backedUp) await page.getByLabel('ถามลูกค้าแล้วว่าสำรองข้อมูลไว้').check();
  await page.getByRole('button', { name: 'เปิดเครื่องลุงชัย' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'post');
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'press-any-key');
  await page.keyboard.press('Enter');
  await expect(setupPage(page)).toHaveAttribute('data-setup-page', 'language');
}

/** Language, keyboard, the "everything will be deleted" box, the key, the license: the partition page. */
async function toLocation(page: Page, o: { noKey?: boolean } = {}) {
  await next(page);
  await next(page);
  const option = page.getByRole('button', { name: 'Next', exact: true });
  await expect(option, 'Next waits for the box').toBeDisabled();
  await page.getByRole('checkbox', { name: 'I agree everything' }).check();
  await next(page);
  if (o.noKey) {
    await page.getByRole('button', { name: "I don't have a product key" }).click();
    await page.getByRole('option', { name: 'Windows 11 Home', exact: true }).click();
  } else await page.getByTestId('product-key').click();
  await next(page);
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(setupPage(page)).toHaveAttribute('data-setup-page', 'location');
}

async function deletePart(page: Page, id: string) {
  await row(page, id).click();
  await page.getByRole('button', { name: 'Delete Partition' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('any data stored on it will be lost');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
}

test('the textbook way through Setup: red text on the MBR disk, Delete both partitions, install', async ({ page }, info) => {
  await openChai(page, { backedUp: true });
  await expect(page.locator('.keybar')).toBeHidden();
  await shot(page, info, 'c3-language');
  await toLocation(page);
  await row(page, '1-2').click();
  await expect(page.getByTestId('setup-error')).toContainText('The selected disk has an MBR partition table');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await shot(page, info, 'c3-red-text');
  await deletePart(page, '1-2');
  await expect(page.getByTestId('setup-error'), 'System Reserved is still there').toBeVisible();
  await deletePart(page, '1-1');
  await row(page, '1-free').click();
  await expect(page.getByTestId('setup-error')).toBeHidden();
  await shot(page, info, 'c3-unallocated');
  await next(page);
  await expect(page.getByRole('heading', { name: 'Ready to install' })).toBeVisible();
  await page.getByRole('button', { name: 'Install' }).click();
  await expect(setupPage(page)).toHaveAttribute('data-setup-page', 'done', { timeout: 10_000 });
  await expect(page.getByTestId('setup-progress')).toHaveText('100% complete');
  await expect(page.getByRole('status')).toHaveText('ติดตั้ง Windows 11 เสร็จแล้ว');
  await expect(page.getByTestId('pc-win')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-sfx', /fixed/);
});

test('trap: deleting before asking about the backup is a mistake; Format leaves the red text', async ({ page }) => {
  await openChai(page);
  await toLocation(page);
  await row(page, '1-2').click();
  await page.getByRole('button', { name: 'Format Partition' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('If you format this partition');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('ก่อนถามลูกค้าเรื่องสำรองข้อมูล');
  await expect(page.getByTestId('setup-error')).toContainText('MBR partition table');
});

test('Cancel in the confirm box keeps the partition', async ({ page }) => {
  await openChai(page, { backedUp: true });
  await toLocation(page);
  await row(page, '1-2').click();
  await page.getByRole('button', { name: 'Delete Partition' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(row(page, '1-2')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toBeHidden();
});

test('trap: deleting the USB stick: Setup loses its files, OK restarts, and the PC no longer boots the stick', async ({ page }, info) => {
  await openChai(page, { noKey: true });
  await toLocation(page, { noKey: true });
  await row(page, '0-1').click();
  await expect(page.getByTestId('setup-error')).toHaveText("Windows can't be installed to this drive.");
  await deletePart(page, '0-1');
  await expect(setupPage(page)).toHaveAttribute('data-setup-page', 'media-error');
  await expect(page.getByRole('status')).toContainText('ต้องไปทำ USB ใหม่');
  await shot(page, info, 'c3-media-error');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'post');
  await expect(page.locator('.keybar')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'old-windows');
});

test('Setup fits the screen: no sideways scrolling, every control reachable and big enough to tap', async ({ page }) => {
  await openChai(page, { backedUp: true });
  await toLocation(page);
  await row(page, '1-2').click();
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  // The partition page has no Back button, like the real one.
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  for (const name of ['Next', 'Delete Partition', 'Format Partition', 'Refresh']) {
    const b = page.getByRole('button', { name, exact: true });
    await b.scrollIntoViewIfNeeded();
    await expect(b).toBeInViewport();
    const box = (await b.boundingBox())!;
    // Touch screens get 32px controls; with a mouse the buttons keep the real window's size.
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(touch ? 32 : 22);
  }
  const fontPx = await page.locator('.w11-screen').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(fontPx).toBeGreaterThanOrEqual(13);
  const sideways = await page.locator('.w11-screen').evaluate((e) => e.scrollWidth - e.clientWidth);
  expect(sideways).toBeLessThanOrEqual(0);
});
