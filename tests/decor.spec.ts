// Decorating the shop in free play (docs/phase3-plan.md task D, src/core/decor.ts): from its menu and the shop's HUD,
// buying with a yes asked first, items needing a rank or more coins, switching for free, taking off, and the save
// keeping it all. The class mode has no decorating.

import { expect, test, type Page } from '@playwright/test';
import { ALL_TALKS, hudFits, openShop } from './helpers';

const free = (page: Page) => page.getByTestId('free-menu');
const decor = (page: Page) => page.getByTestId('decor');
const tile = (page: Page, id: string) => decor(page).locator(`[data-item="${id}"]`);
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};

/** Straight into free play with these coins and jobs (talks seen, the boot screen too). */
async function seedFree(page: Page, coins: number, jobs = { count: 0, three: 0 }) {
  await page.addInitScript((save) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('shop.boot.v1', '1');
    localStorage.setItem('shop.mode.v1', 'free');
    localStorage.setItem('shop.free.v1', save);
    localStorage.setItem('seeded', '1');
  }, JSON.stringify({ coins, seen: ALL_TALKS, jobs: { ...jobs, pairs: [], problems: [] } }));
  await page.goto('/');
  await expect(free(page)).toBeVisible({ timeout: 15_000 });
}

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('shop.free.v1')!) as { coins: number; decor: { owned: string[]; placed: Record<string, string> } });

test('buying from free play\'s menu: asked first, coins taken, put out; switching back is free; the save keeps it', async ({ page }, info) => {
  await seedFree(page, 800);
  await expect(free(page).getByTestId('open-decor')).toHaveText('🛋️ แต่งร้าน · วางของแล้ว 0/4 จุด');
  await free(page).getByTestId('open-decor').click();
  await expect(decor(page)).toBeVisible();
  await expect(decor(page).getByTestId('decor-coins')).toHaveText('มีเหรียญ 🪙 800');
  await expect(decor(page).locator('[data-slot]')).toHaveCount(4);
  await expect(decor(page).locator('[data-item]')).toHaveCount(12);
  // The close button has the focus, so Escape and Enter work straight away.
  await expect(decor(page).getByRole('button', { name: 'ปิดหน้าแต่งร้าน' })).toBeFocused();

  // Needs a rank: says which, however many coins there are.
  await expect(tile(page, 'counter-trophy')).toHaveAttribute('data-offer', 'locked');
  await expect(tile(page, 'counter-trophy')).toContainText('🔒 ต้องเป็น 🏆 หัวหน้าช่าง');
  await expect(tile(page, 'counter-trophy').getByRole('button')).toHaveCount(0);
  await shot(page, 'decor', info.project.name);

  // Asked first; "no" spends nothing.
  await tile(page, 'counter-plant').getByRole('button', { name: 'ซื้อ 🪙 150' }).click();
  await expect(tile(page, 'counter-plant')).toContainText('ใช้ 🪙 150 ซื้อ?');
  await tile(page, 'counter-plant').getByRole('button', { name: 'ไม่ซื้อ' }).click();
  await expect(decor(page).getByTestId('decor-coins')).toHaveText('มีเหรียญ 🪙 800');
  await expect(tile(page, 'counter-plant')).toHaveAttribute('data-offer', 'buy');

  await tile(page, 'counter-plant').getByRole('button', { name: 'ซื้อ 🪙 150' }).click();
  await tile(page, 'counter-plant').getByRole('button', { name: 'ซื้อเลย' }).click();
  await expect(decor(page).getByTestId('decor-coins')).toHaveText('มีเหรียญ 🪙 650');
  await expect(tile(page, 'counter-plant')).toHaveAttribute('data-offer', 'placed');
  await expect(tile(page, 'counter-plant')).toContainText('วางอยู่');

  // Another in the same place takes over from it; the first stays bought.
  await tile(page, 'counter-cat').getByRole('button', { name: 'ซื้อ 🪙 300' }).click();
  await tile(page, 'counter-cat').getByRole('button', { name: 'ซื้อเลย' }).click();
  await expect(decor(page).getByTestId('decor-coins')).toHaveText('มีเหรียญ 🪙 350');
  await expect(tile(page, 'counter-cat')).toHaveAttribute('data-offer', 'placed');
  await expect(tile(page, 'counter-plant')).toHaveAttribute('data-offer', 'owned');
  // Short of coins: how many more.
  await expect(tile(page, 'sign-gold')).toHaveAttribute('data-offer', 'locked');
  await expect(tile(page, 'floor-cabinet')).toContainText('ต้องเป็น 🔧 ช่างผู้ช่วย');
  await tile(page, 'wall-award').scrollIntoViewIfNeeded();
  await expect(tile(page, 'wall-clock')).toHaveAttribute('data-offer', 'buy');
  await tile(page, 'wall-clock').getByRole('button', { name: 'ซื้อ 🪙 250' }).click();
  await tile(page, 'wall-clock').getByRole('button', { name: 'ซื้อเลย' }).click();
  await expect(decor(page).getByTestId('decor-coins')).toHaveText('มีเหรียญ 🪙 100');
  await expect(tile(page, 'floor-mat')).toHaveAttribute('data-offer', 'short');
  await expect(tile(page, 'floor-mat')).toContainText('🪙 150 · ขาดอีก 50');

  // Back to the first: free.
  await tile(page, 'counter-plant').getByRole('button', { name: 'วางในร้าน' }).click();
  await expect(tile(page, 'counter-plant')).toHaveAttribute('data-offer', 'placed');
  await expect(tile(page, 'counter-cat')).toHaveAttribute('data-offer', 'owned');
  await expect(decor(page).getByTestId('decor-coins')).toHaveText('มีเหรียญ 🪙 100');
  // Taken off: still bought.
  await tile(page, 'wall-clock').getByRole('button', { name: 'เก็บออก' }).click();
  await expect(tile(page, 'wall-clock')).toHaveAttribute('data-offer', 'owned');
  await shot(page, 'decor-bought', info.project.name);

  await page.keyboard.press('Escape');
  await expect(decor(page)).toHaveCount(0);
  await expect(free(page).getByTestId('open-decor')).toContainText('วางของแล้ว 1/4 จุด');
  await expect(free(page).getByTestId('coins')).toHaveAttribute('aria-label', 'เหรียญ 100');
  expect(await saved(page)).toMatchObject({ coins: 100, decor: { owned: ['counter-plant', 'counter-cat', 'wall-clock'], placed: { counter: 'counter-plant' } } });

  await page.reload();
  await free(page).getByTestId('open-decor').click();
  await expect(tile(page, 'counter-plant')).toHaveAttribute('data-offer', 'placed');
  await expect(tile(page, 'counter-cat')).toHaveAttribute('data-offer', 'owned');
  await expect(tile(page, 'wall-clock')).toHaveAttribute('data-offer', 'owned');
  await expect(decor(page).getByTestId('decor-coins')).toHaveText('มีเหรียญ 🪙 100');
});

test('a rank opens what needed it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the window is checked at every size above');
  // Head technician: 30 jobs, 15 with three stars, every problem met and every card got are the top rank's needs, so
  // a regular technician (15 jobs, 5 three-star) is used: the sign and the award open, the trophy stays locked.
  await seedFree(page, 600, { count: 15, three: 5 });
  await free(page).getByTestId('open-decor').click();
  await expect(tile(page, 'sign-gold')).toHaveAttribute('data-offer', 'buy');
  await expect(tile(page, 'wall-award')).toHaveAttribute('data-offer', 'buy');
  await expect(tile(page, 'floor-cabinet')).toHaveAttribute('data-offer', 'buy');
  await expect(tile(page, 'counter-trophy')).toHaveAttribute('data-offer', 'locked');
  // And buying it goes through.
  await tile(page, 'sign-gold').getByRole('button', { name: 'ซื้อ 🪙 600' }).click();
  await tile(page, 'sign-gold').getByRole('button', { name: 'ซื้อเลย' }).click();
  await expect(tile(page, 'sign-gold')).toHaveAttribute('data-offer', 'placed');
  await expect(decor(page).getByTestId('decor-coins')).toHaveText('มีเหรียญ 🪙 0');
});

test('from the shop\'s HUD in free play, with the HUD still fitting; the class mode has none', async ({ page }, info) => {
  await seedFree(page, 300);
  await free(page).getByRole('button', { name: /เปิดร้านรับลูกค้า/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop', { timeout: 15_000 });
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
  await hudFits(page);
  await shot(page, 'decor-hud', info.project.name);
  await page.getByTestId('hud-decor').click();
  await expect(decor(page)).toBeVisible();
  await tile(page, 'counter-cat').getByRole('button', { name: 'ซื้อ 🪙 300' }).click();
  await tile(page, 'counter-cat').getByRole('button', { name: 'ซื้อเลย' }).click();
  await decor(page).getByRole('button', { name: 'ปิดหน้าแต่งร้าน' }).click();
  await expect(decor(page)).toHaveCount(0);
  await expect(page.getByTestId('coins')).toHaveAttribute('aria-label', 'เหรียญ 0');
  // The customer's job goes on behind it as it was.
  await expect(page.locator('.case-panel')).toBeVisible();
  // The badge is always there, shortened on phones.
  await expect(page.locator('.sim-badge')).toHaveJSProperty('innerText', page.viewportSize()!.width <= 520 ? 'จำลอง' : 'โหมดจำลอง');
});

test('the class mode has no decorating, and its simulation badge stays in full', async ({ page }) => {
  await openShop(page);
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
  await expect(page.getByTestId('hud-decor')).toHaveCount(0);
  await expect(page.locator('.sim-badge')).toHaveJSProperty('innerText', 'โหมดจำลอง');
});
