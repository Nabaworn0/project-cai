// Task H: sounds, little animations, and coins kept on this device. Sounds cannot be heard in a test, so
// each request is checked through body[data-sfx] (src/ui/sound.ts); whether they sound good is for a person.

import { expect, test, type Page } from '@playwright/test';
import { C1_DIAGNOSIS, expectStage, openPc, openShop, playToRepair } from './helpers';

const sfx = (page: Page) => page.evaluate(() => (document.body.dataset.sfx ?? '').split(' ').filter(Boolean));
const key = (page: Page, k: string) => page.locator(`.keybar [data-key="${k}"]`).click();

/** From the repair stage: the Boot Menu route, back to the customer, the right explanation, the summary. */
async function finishCase(page: Page) {
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await key(page, k);
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
}

test('sounds play at the right moments: bell, keys, a mistake, the fix, right answers, stars and coins', async ({ page }) => {
  await openShop(page);
  await expectStage(page, 'intro');
  expect(await sfx(page), 'the door bell when the customer walks in').toContain('bell');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: C1_DIAGNOSIS }).click();
  expect((await sfx(page)).at(-1)).toBe('right');
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();

  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await key(page, 'Enter'); // boots the old Windows
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'old-windows');
  expect((await sfx(page)).slice(-2)).toEqual(['key', 'mistake']);
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await key(page, k);
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
  expect((await sfx(page)).at(-1)).toBe('fixed');

  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /เพราะแฟลชไดรฟ์ของป้าช้าเกินไป/ }).click();
  expect((await sfx(page)).at(-1), 'a wrong answer buzzes').toBe('mistake');
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
  // 2 stars (one wrong explanation): two star sounds, then the purse.
  await expect.poll(() => sfx(page).then((s) => s.slice(-3))).toEqual(['star', 'star', 'coin']);
});

test('the sound button is a toggle that mutes and is remembered after closing the page', async ({ page }) => {
  await openShop(page);
  const btn = page.getByRole('button', { name: 'เสียงในเกม' });
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toHaveText('🔊');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect(btn).toHaveText('🔇');
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop');
  await expect(page.getByRole('button', { name: 'เสียงในเกม' })).toHaveAttribute('aria-pressed', 'false');
});

test('coins count up into the purse and are still there after closing and reopening the page', async ({ page }) => {
  await playToRepair(page);
  await finishCase(page);
  const summaryCoins = page.getByRole('group', { name: 'สรุปผล' }).locator('.coins');
  await expect(summaryCoins).toHaveText('+150');
  await expect(page.getByTestId('coins')).toHaveAttribute('aria-label', 'เหรียญ 150');
  await expect(page.getByTestId('coins')).toHaveText(/^🪙 150/);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop');
  await expect(page.getByTestId('coins'), 'saved on this device').toHaveText(/^🪙 150/);
});

test('stars fill one by one; the fix shows a banner; a mistake shakes the screen; Somsri hops when it is fixed', async ({ page }) => {
  await openPc(page);
  await key(page, 'Enter');
  await expect(page.locator('.pc')).toHaveClass(/shake/);
  await expect(page.locator('.pc')).not.toHaveClass(/shake/);
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await key(page, k);
  await expect(page.getByTestId('pc-win')).toHaveText('ซ่อมสำเร็จ!');
  await expect(page.getByTestId('pc-win'), 'the banner goes, Setup stays').toHaveCount(0, { timeout: 5000 });
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-customer-hop', 'up');
  await expect(page.locator('body')).toHaveAttribute('data-customer-hop', '');

  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  const stars = page.getByRole('group', { name: 'สรุปผล' }).locator('.stars');
  await expect(stars.locator('.star-on')).toHaveCount(1);
  await expect(stars.locator('.star-on')).toHaveCount(3);
});

// Windows with "Animation effects" off reports reduced motion (the user's own PC does): the feedback must not vanish.
test('with reduced motion: the screen does not shake, but Somsri still hops (gently) and the stars still fill one by one', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPc(page);
  await key(page, 'Enter');
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'old-windows');
  await expect(page.locator('.pc')).not.toHaveClass(/shake/);
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await key(page, k);
  await expect(page.getByTestId('pc-win')).toBeVisible();
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-customer-hop', 'up');
  await expect(page.locator('body')).toHaveAttribute('data-customer-hop', '');
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  const stars = page.getByRole('group', { name: 'สรุปผล' }).locator('.stars');
  await expect(stars.locator('.star-on')).toHaveCount(1);
  await expect(stars.locator('.star-on')).toHaveCount(3);
  await expect(page.getByRole('group', { name: 'สรุปผล' }).locator('.coins')).toHaveText('+150');
});

test('the hop really moves the customer on the canvas, up and back down to the same spot', async ({ page }) => {
  await openPc(page);
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await key(page, k);
  const [x, y] = (await page.evaluate(() => document.body.dataset.customerAt!)).split(',').map(Number) as [number, number];
  // Her head only (customerAt is her face): the case panel below changes between the shots.
  const box = { x: x - 40, y: y - 50, width: 80, height: 70 };
  await page.getByRole('button', { name: 'ปิด' }).click();
  await page.waitForTimeout(800); // the hop from closing is over
  const still = await page.screenshot({ clip: box });
  await page.getByRole('button', { name: 'คุยกับลูกค้า' }).click(); // no hop here: she already cheered once
  // Trigger one more hop through the summary (3 stars), and catch a frame mid-hop.
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-customer-hop', 'up');
  const mid = await page.screenshot({ clip: box });
  expect(mid.equals(still), 'the customer moved during the hop').toBe(false);
  await expect(page.locator('body')).toHaveAttribute('data-customer-hop', '');
  await page.waitForTimeout(100);
  const after = await page.screenshot({ clip: box });
  expect(after.equals(still), 'back on the same spot after the hop').toBe(true);
});
