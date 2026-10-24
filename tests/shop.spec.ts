import { expect, test, type Page } from '@playwright/test';
import { playToRepair } from './helpers';

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

async function openShop(page: Page) {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop');
  await expect(page.locator('#splash')).toHaveCount(0);
}

async function tapAt(page: Page, attr: 'techAt' | 'pcAt') {
  const at = await page.evaluate((a) => document.body.dataset[a], attr);
  const [x, y] = at!.split(',').map(Number) as [number, number];
  await page.mouse.click(x, y);
}

test('the shop scene opens with the character and the simulation badge, without errors or sideways scroll', async ({ page }) => {
  const errors = errorsOf(page);
  await openShop(page);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('โหมดจำลอง');
  await expect(page.locator('.narration')).toBeVisible({ timeout: 8000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // The narration box must sit inside the viewport.
  const box = (await page.locator('.narration').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(errors).toEqual([]);
});

test('pixel art: each art pixel is a whole number of device pixels, drawn without smoothing', async ({ page }) => {
  await openShop(page);
  const r = await page.evaluate(() => {
    const c = document.querySelector('#game canvas') as HTMLCanvasElement;
    const rect = c.getBoundingClientRect();
    return {
      devicePerArt: (rect.width * window.devicePixelRatio) / c.width,
      devicePerArtY: (rect.height * window.devicePixelRatio) / c.height,
      shortSide: Math.min(c.width, c.height),
      rendering: getComputedStyle(c).imageRendering,
      fits: rect.right <= window.innerWidth + 0.5 && rect.bottom <= window.innerHeight + 0.5,
    };
  });
  expect(Math.abs(r.devicePerArt - Math.round(r.devicePerArt))).toBeLessThan(0.01);
  expect(Math.abs(r.devicePerArtY - Math.round(r.devicePerArtY))).toBeLessThan(0.01);
  expect(r.shortSide).toBeGreaterThanOrEqual(110);
  expect(r.shortSide).toBeLessThanOrEqual(240);
  expect(r.rendering).toBe('pixelated');
  expect(r.fits).toBe(true);
});

test('the shop name sits on the sign board, inside the screen and clear of the HUD chips', async ({ page }) => {
  await openShop(page);
  const sign = page.locator('.sign-label');
  await expect(sign).toHaveText('ร้านซ่อมคอม');
  const s = (await sign.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(s.x).toBeGreaterThanOrEqual(0);
  expect(s.x + s.width).toBeLessThanOrEqual(vp.width);
  for (const chip of await page.locator('.hud .chip').all()) {
    const c = (await chip.boundingBox())!;
    const overlap = s.x < c.x + c.width && c.x < s.x + s.width && s.y < c.y + c.height && c.y < s.y + s.height;
    expect(overlap, 'sign overlaps a HUD chip').toBe(false);
  }
  // The text must fit inside the board.
  const fits = await sign.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(fits).toBe(true);
});

test('the HUD only blocks taps on its chips; the rest of the top strip reaches the game', async ({ page }) => {
  await openShop(page);
  const hit = await page.evaluate(() => document.elementFromPoint(window.innerWidth / 2, 8)?.tagName);
  expect(hit).toBe('CANVAS');
});

test('the scene re-lays out when the window size changes (phone rotation)', async ({ page }) => {
  await openShop(page);
  const vp = page.viewportSize()!;
  const before = await page.evaluate(() => document.body.dataset.techAt);
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await expect.poll(() => page.evaluate(() => document.body.dataset.techAt)).not.toBe(before);
  await tapAt(page, 'techAt');
  await expect(page.locator('body')).toHaveAttribute('data-expression', 'happy');
});

test('tapping the technician changes their expression', async ({ page }) => {
  await openShop(page);
  await expect(page.locator('body')).toHaveAttribute('data-expression', 'neutral');
  await tapAt(page, 'techAt');
  await expect(page.locator('body')).toHaveAttribute('data-expression', 'happy');
});

test("the PC on the counter opens the customer's screen; only the close button closes it (Esc belongs to the BIOS)", async ({ page }) => {
  await playToRepair(page);
  await tapAt(page, 'pcAt');
  const dialog = page.getByRole('dialog', { name: 'หน้าจอจำลอง' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Press F2 to enter SETUP, F8 for Boot Menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'ปิด' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await expect(dialog).toBeVisible();
});

test('installable PWA that keeps working offline', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'service worker check runs once');
  await openShop(page);
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
    return (await fetch(href)).json();
  });
  expect(manifest.name).toBe('ร้านซ่อมคอม');
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);

  await page.waitForFunction(() => navigator.serviceWorker.controller !== null || document.body.dataset.offlineReady === 'true', null, { timeout: 15_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop');
  await expect(page.getByRole('status')).toHaveText('โหมดจำลอง');
  await context.setOffline(false);
});
