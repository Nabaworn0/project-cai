// Decorating the shop in free play (docs/phase3-plan.md task D, src/core/decor.ts): from its menu and the shop's HUD,
// buying with a yes asked first, items needing a rank or more coins, switching for free, taking off, and the save
// keeping it all. The class mode has no decorating.

import { expect, test, type Page } from '@playwright/test';
import { ALL_TALKS, hasBadge, hudFits, openShop } from './helpers';

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
  await expect(tile(page, 'counter-trophy')).toContainText('🔒 ต้องเป็น หัวหน้าช่าง');
  await hasBadge(tile(page, 'counter-trophy'), 'head');
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
  await expect(tile(page, 'floor-cabinet')).toContainText('ต้องเป็น ช่างผู้ช่วย');
  await tile(page, 'wall-award').scrollIntoViewIfNeeded();
  await expect(tile(page, 'wall-clock')).toHaveAttribute('data-offer', 'buy');
  await tile(page, 'wall-clock').getByRole('button', { name: 'ซื้อ 🪙 250' }).click();
  await tile(page, 'wall-clock').getByRole('button', { name: 'ซื้อเลย' }).click();
  await expect(decor(page).getByTestId('decor-coins')).toHaveText('มีเหรียญ 🪙 100');
  await expect(tile(page, 'floor-water')).toHaveAttribute('data-offer', 'short');
  await expect(tile(page, 'floor-water')).toContainText('🪙 150 · ขาดอีก 50');

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
  // Even a class save that somehow holds decorations draws none.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('shop.progress.v2')!);
    localStorage.setItem('shop.progress.v2', JSON.stringify({ ...save, decor: { owned: ['wall-clock'], placed: { wall: 'wall-clock' } } }));
  });
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop', { timeout: 15_000 });
  await expect(page.locator('body')).toHaveAttribute('data-decor-drawn', '0');
});

/** The decorations the shop's scene drew: by place, the item and its box in CSS px. */
async function drawn(page: Page) {
  const raw = (await page.locator('body').getAttribute('data-decor-at')) ?? '';
  return Object.fromEntries(
    raw
      .split(' ')
      .filter(Boolean)
      .map((d) => {
        const [slot, rest] = d.split(':') as [string, string];
        const [id, box] = rest.split('@') as [string, string];
        const [x, y, width, height] = box.split(',').map(Number) as [number, number, number, number];
        return [slot, { id, x, y, width, height }];
      }),
  );
}
type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const holds = (a: Box, [x, y]: number[]) => x! >= a.x && x! <= a.x + a.width && y! >= a.y && y! <= a.y + a.height;

/** Every place's item is in view, clear of the HUD, the case panel, the faces and the PC, apart from each other, and in
 *  its own place: on the sign, on the counter left of the PC, on the wall above the counter, in front of the counter. */
async function checkPlaces(page: Page) {
  const d = await drawn(page);
  expect(Object.fromEntries(Object.entries(d).map(([s, x]) => [s, x.id]))).toEqual({ sign: 'sign-led', counter: 'counter-trophy', wall: 'wall-clock', floor: 'floor-bench' });
  await expect(page.locator('body')).toHaveAttribute('data-decor-drawn', '4');
  const view = page.viewportSize()!;
  const chips = await Promise.all((await page.locator('.hud .chip').all()).map((c) => c.boundingBox()));
  const panel = (await page.locator('.case-panel').boundingBox())!;
  const point = async (name: string) => ((await page.locator('body').getAttribute(name)) ?? '').split(',').map(Number);
  const pc = await point('data-pc-at');
  const faces = [await point('data-tech-at'), pc, await point('data-customer-at'), await point('data-senior-at')];
  for (const [slot, box] of Object.entries(d)) {
    expect(box.x, slot).toBeGreaterThanOrEqual(0);
    expect(box.y, slot).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, slot).toBeLessThanOrEqual(view.width);
    expect(box.y + box.height, slot).toBeLessThanOrEqual(view.height);
    for (const c of chips) if (c && c.width > 1) expect(overlaps(box, c), `${slot} under a HUD chip`).toBe(false);
    expect(overlaps(box, panel), `${slot} under the case panel`).toBe(false);
    for (const f of faces) expect(holds(box, f), `${slot} over a face or the PC`).toBe(false);
  }
  const all = Object.values(d);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlaps(all[i]!, all[j]!)).toBe(false);

  const sign = (await page.locator('.sign-label').boundingBox())!;
  // The sign itself is clear of the chips too (the HUD is wider in free play).
  for (const c of chips) if (c && c.width > 1) expect(overlaps(sign, c), 'the sign under a HUD chip').toBe(false);
  expect(d.sign!.x).toBeGreaterThanOrEqual(sign.x);
  expect(d.sign!.x + d.sign!.width).toBeLessThanOrEqual(sign.x + sign.width / 4);
  // The shop's name keeps right of it, whole.
  const name = await page.locator('.sign-label').evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return { x: r.x, width: r.width, clipped: el.scrollWidth > el.clientWidth };
  });
  expect(name.x, 'the shop name over the sign decoration').toBeGreaterThan(d.sign!.x + d.sign!.width);
  expect(name.x + name.width).toBeLessThanOrEqual(sign.x + sign.width);
  expect(name.clipped, 'the shop name cut off').toBe(false);
  expect(d.sign!.y).toBeGreaterThanOrEqual(sign.y);
  expect(d.sign!.y + d.sign!.height).toBeLessThanOrEqual(sign.y + sign.height + 1);
  const counterY = Number(await page.locator('body').getAttribute('data-counter-y'));
  const floorY = Number(await page.locator('body').getAttribute('data-floor-y'));
  const tech = await point('data-tech-at');
  // On the counter's top, right of the intern and left of the PC.
  expect(Math.abs(d.counter!.y + d.counter!.height - counterY)).toBeLessThanOrEqual(10);
  expect(d.counter!.x).toBeGreaterThan(tech[0]!);
  expect(d.counter!.x + d.counter!.width).toBeLessThan(pc[0]!);
  // On the wall: under the sign, above the counter.
  expect(d.wall!.y).toBeGreaterThan(sign.y + sign.height);
  expect(d.wall!.y + d.wall!.height).toBeLessThan(counterY);
  // Standing on the floor in front of the counter: under the intern, or, where the panel stands in the middle at the
  // bottom (computers and tablets on their side, case.css), left of the panel.
  expect(Math.abs(d.floor!.y + d.floor!.height - floorY)).toBeLessThanOrEqual(12);
  const centred = view.width > view.height && view.height > 520;
  if (centred) expect(d.floor!.x + d.floor!.width).toBeLessThanOrEqual(panel.x);
  else {
    expect(d.floor!.x).toBeLessThan(tech[0]!);
    expect(d.floor!.x + d.floor!.width).toBeGreaterThan(tech[0]!);
  }
}

/** Free play with one of each place's items put out, at the counter with Somsri's words in the panel. */
async function shopWithAll(page: Page) {
  await page.addInitScript(() => (Math.random = () => 0));
  await seedFree(page, 0);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('shop.free.v1')!);
    // The widest picture in each place.
    const placed = { sign: 'sign-led', counter: 'counter-trophy', wall: 'wall-clock', floor: 'floor-bench' };
    localStorage.setItem('shop.free.v1', JSON.stringify({ ...save, decor: { owned: Object.values(placed), placed } }));
  });
  await page.reload();
  await free(page).getByRole('button', { name: /เปิดร้านรับลูกค้า/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
  await expect(page.locator('.case-panel')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body')).toHaveAttribute('data-customer', /./, { timeout: 15_000 });
  await page.waitForTimeout(400);
}

test('what is put out stands in its place in the shop, in view at every size, clear of the HUD, the panel and the faces', async ({ page }, info) => {
  await shopWithAll(page);
  await checkPlaces(page);
  await shot(page, 'decor-shop', info.project.name);
});

test('the sign moves clear of the HUD when its chips grow, and back when they shrink', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the HUD has room beside the sign only on wide screens');
  await shopWithAll(page);
  const sign = page.locator('.sign-label');
  const top = (await sign.boundingBox())!.y;
  // A chip as wide as a much larger purse would make it.
  await page.locator('.coins-chip').evaluate((el: HTMLElement) => (el.style.paddingLeft = '420px'));
  await expect.poll(async () => (await sign.boundingBox())!.y).toBeGreaterThan(top + 20);
  await checkPlaces(page);
  await page.locator('.coins-chip').evaluate((el: HTMLElement) => (el.style.paddingLeft = ''));
  await expect.poll(async () => (await sign.boundingBox())!.y).toBe(top);
});

test('the places hold at other screen sizes too (tablets, small laptops, short phones on their side)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sizes set here');
  await shopWithAll(page);
  for (const size of [
    { width: 1024, height: 768 },
    { width: 800, height: 600 },
    { width: 640, height: 360 },
    { width: 1366, height: 600 },
    { width: 768, height: 1024 },
    { width: 900, height: 420 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(500);
    await test.step(`${size.width}x${size.height}`, () => checkPlaces(page));
    await shot(page, `decor-shop-${size.width}x${size.height}`, info.project.name);
  }
});

test('what is bought from the HUD shows in the shop at once; the class mode\'s shop has none', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the places are checked at every size above');
  await seedFree(page, 300);
  await free(page).getByRole('button', { name: /เปิดร้านรับลูกค้า/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
  expect(await drawn(page)).toEqual({});
  await page.getByTestId('hud-decor').click();
  await tile(page, 'wall-poster').getByRole('button', { name: 'ซื้อ 🪙 150' }).click();
  await tile(page, 'wall-poster').getByRole('button', { name: 'ซื้อเลย' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await drawn(page)).wall?.id).toBe('wall-poster');
  await expect(page.locator('body')).toHaveAttribute('data-decor-drawn', '1');
  // Taken off: gone from the shop.
  await page.getByTestId('hud-decor').click();
  await tile(page, 'wall-poster').getByRole('button', { name: 'เก็บออก' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(async () => Object.keys(await drawn(page))).toEqual([]);
  await expect(page.locator('body')).toHaveAttribute('data-decor-drawn', '0');

  // Back to the class mode: its shop draws none of free play's.
  await page.getByTestId('hud-decor').click();
  await tile(page, 'wall-poster').getByRole('button', { name: 'วางในร้าน' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await drawn(page)).wall?.id).toBe('wall-poster');
  await page.getByRole('button', { name: '☰ เมนู' }).click();
  await free(page).getByRole('button', { name: 'ออกจากโหมดอิสระ' }).click();
  await openShop(page);
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
  expect(await drawn(page)).toEqual({});
});
