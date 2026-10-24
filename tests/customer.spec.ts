// The customer in the shop scene (ShopScene, case1-plan task D): walks in, stands in front of the
// counter where nothing covers them, keeps their place on rotation, and changes expression.
// Saves a full-page screenshot per screen size for looking at by eye (test-results/).

import { expect, test, type Page } from '@playwright/test';
import { openPc, openShop } from './helpers';

const point = async (page: Page, attr: 'customerAt' | 'techAt' | 'pcAt') => {
  const at = await page.evaluate((a) => document.body.dataset[a] ?? '', attr);
  const [x, y] = at.split(',').map(Number) as [number, number];
  return { x, y };
};

/** What the player would touch at a point: the game canvas, or an HTML panel on top of it. */
const hitAt = (page: Page, p: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el?.tagName === 'CANVAS' ? 'canvas' : (el?.closest('[class]')?.className ?? String(el?.tagName));
  }, p);

test("case 1's customer walks in, worried, and stands where nothing covers them", async ({ page }, info) => {
  await openShop(page);
  await expect(page.locator('body')).toHaveAttribute('data-customer', 'somsri', { timeout: 5000 });
  await expect(page.locator('body')).toHaveAttribute('data-customer-mood', 'worried');

  const vp = page.viewportSize()!;
  const head = await point(page, 'customerAt');
  expect(head.x).toBeGreaterThan(0);
  expect(head.x).toBeLessThan(vp.width);
  expect(head.y).toBeGreaterThan(0);
  expect(head.y).toBeLessThan(vp.height);
  expect(await hitAt(page, head), 'the face is not under the narration box or the HUD').toBe('canvas');

  // Standing beside the technician, not on top of them or the PC.
  const tech = await point(page, 'techAt');
  const pc = await point(page, 'pcAt');
  expect(head.x).toBeLessThan(tech.x);
  expect(head.x).toBeLessThan(pc.x);
  await page.screenshot({ path: info.outputPath(`${info.project.name}-customer.png`) });
});

test('the customer keeps their place when the screen rotates', async ({ page }) => {
  await openShop(page);
  await expect(page.locator('body')).toHaveAttribute('data-customer', 'somsri', { timeout: 5000 });
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await expect
    .poll(async () => {
      const head = await point(page, 'customerAt');
      return head.x > 0 && head.x < vp.height && head.y > 0 && head.y < vp.width && (await hitAt(page, head)) === 'canvas';
    })
    .toBe(true);
});

test('the customer smiles once their PC boots from the USB', async ({ page }) => {
  await openPc(page);
  await expect(page.locator('body')).toHaveAttribute('data-customer-mood', 'worried');
  await page.keyboard.press('F8');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
  await expect(page.locator('body')).toHaveAttribute('data-customer-mood', 'happy');
});
