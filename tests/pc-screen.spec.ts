// The customer's PC screen (src/ui/sim) driven like a player would: the on-screen key bar (phones)
// and the real keyboard (PCs), on every project's screen size. Each test also saves screenshots of
// the screens it passes through, for looking at by eye (test-results/).

import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function openPc(page: Page) {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop');
  await expect(page.locator('#splash')).toHaveCount(0);
  await page.getByRole('button', { name: 'เปิดหน้าจอจำลอง' }).click();
  await expectScreen(page, 'post');
}

const expectScreen = (page: Page, kind: string) => expect(page.locator('body')).toHaveAttribute('data-pc-screen', kind);
/** Taps keys on the on-screen key bar. */
const tap = async (page: Page, ...keys: string[]) => {
  for (const k of keys) await page.locator(`.keybar [data-key="${k}"]`).click();
};
const shot = async (page: Page, info: TestInfo, name: string) =>
  page.locator('.pc-monitor').screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });

test('the screen keeps 4:3, fits the window, and every key on the bar is reachable', async ({ page }, info) => {
  await openPc(page);
  const vp = page.viewportSize()!;
  const box = (await page.locator('.pc').boundingBox())!;
  expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.02);
  for (const el of [page.locator('.pc'), page.locator('.keybar'), page.getByRole('button', { name: 'ปิด' })]) {
    const b = (await el.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 0.5);
  }
  const keys = page.locator('.keybar .key');
  await expect(keys).toHaveCount(11);
  for (const k of await keys.all()) {
    const b = (await k.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(40); // big enough to tap
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, info, '1-post');
});

test('the textbook route on the key bar: F2, Boot, Hard Disk Drives, 1st Drive = USB, F10, Ok, then Setup', async ({ page }, info) => {
  await openPc(page);
  await tap(page, 'F2');
  await expectScreen(page, 'bios');
  await expect(page.locator('.bios-title')).toHaveText('BIOS SETUP UTILITY');
  await expect(page.locator('.bios-rows li.sel'), 'Main is read-only: nothing highlighted').toHaveCount(0);
  await shot(page, info, '2-bios-main');

  await tap(page, 'Right', 'Right', 'Right', 'Down', 'Down', 'Enter');
  await expect(page.locator('.bios-heading')).toHaveText('Hard Disk Drives');
  await tap(page, 'Enter');
  await expect(page.locator('.bios-popup')).toContainText('Options');
  await shot(page, info, '3-bios-options');
  await tap(page, 'Down', 'Enter', 'Esc', 'Up', 'Enter');
  await expect(page.locator('.bios-heading')).toHaveText('Boot Device Priority');
  await expect(page.locator('.bios-rows li').first()).toContainText('[USB: Flash Disk 16GB]');
  await shot(page, info, '4-bios-priority');

  await tap(page, 'F10');
  await expect(page.getByRole('alertdialog', { name: 'Save configuration changes and exit setup?' })).toBeVisible();
  await shot(page, info, '5-bios-save');
  await tap(page, 'Enter');
  await expectScreen(page, 'post');
  await tap(page, 'Enter'); // carry on booting without waiting for the POST timer
  await expectScreen(page, 'press-any-key');
  await expect(page.locator('.pc')).toContainText('Press any key to boot from CD or DVD');
  await shot(page, info, '6-press-any-key');
  await tap(page, 'Down');
  await expectScreen(page, 'setup');
  await expect(page.getByRole('heading', { name: 'Select language settings' })).toBeVisible();
  await expect(page.locator('.pc-status')).toHaveText('บูตจาก USB สำเร็จ เข้าหน้าติดตั้ง Windows แล้ว');
  await shot(page, info, '7-setup');
});

test('the Boot Menu route with the real keyboard: F8, the UEFI USB entry, any key', async ({ page }, info) => {
  await openPc(page);
  await page.keyboard.press('F8');
  await expectScreen(page, 'boot-menu');
  const entries = page.getByRole('listbox', { name: 'Please select boot device' }).getByRole('option');
  await expect(entries).toHaveText([/^Windows Boot Manager/, 'UEFI: USB Flash Disk 16GB', 'Enter Setup']);
  await shot(page, info, '8-boot-menu');
  await page.keyboard.press('ArrowDown');
  await expect(entries.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expectScreen(page, 'press-any-key');
  await page.keyboard.press('a'); // really any key
  await expectScreen(page, 'setup');
});

test('the Esc trap boots the old Windows and says it was a mistake; restart starts again', async ({ page }, info) => {
  await openPc(page);
  await page.keyboard.press('F2');
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'Enter', 'Enter', 'ArrowDown', 'Enter', 'Escape', 'Escape']) await page.keyboard.press(k);
  await expect(page.getByRole('alertdialog', { name: 'Discard changes and exit setup?' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expectScreen(page, 'post');
  await page.keyboard.press('Enter');
  await expectScreen(page, 'old-windows');
  await expect(page.locator('.pc-status')).toHaveText('เครื่องบูตเข้า Windows ตัวเดิม (นับว่าพลาด)');
  await shot(page, info, '9-old-windows');
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  await expectScreen(page, 'post');
  await expect(page.locator('.pc-status')).toHaveText('');
});

test('the screens move on by themselves: POST boots, "Press any key" gives up (not a mistake)', async ({ page }) => {
  await page.clock.install();
  await openPc(page);
  await page.clock.runFor(8_100);
  await expectScreen(page, 'old-windows');
  await expect(page.locator('.pc-status')).toContainText('นับว่าพลาด');

  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  await tap(page, 'F8', 'Down', 'Enter');
  await expectScreen(page, 'press-any-key');
  await page.clock.runFor(5_100);
  await expectScreen(page, 'old-windows');
  await expect(page.locator('.pc-status')).toHaveText('', { timeout: 1000 });
});

test('Enter on a key bar button does not also click the button (focus stays on the screen)', async ({ page }) => {
  await openPc(page);
  await tap(page, 'F2', 'Right');
  await expect(page.locator('.bios-tabs [aria-selected="true"]')).toHaveText('Advanced');
  await page.keyboard.press('Enter'); // opens SATA Configuration once, not twice
  await expect(page.locator('.bios-heading')).toHaveText('SATA Configuration');
  await page.keyboard.press('Escape');
  await expect(page.locator('.bios-heading')).toHaveText('Advanced Settings');
});
