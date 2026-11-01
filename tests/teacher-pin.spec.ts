// The teacher's page asks its PIN first (docs/guide-pin-plan.md task G): nothing of the page before it is right, a
// wrong one counted, five in a row a wait, open for the rest of the tab, locked again by its button.

import { expect, test, type Page } from '@playwright/test';
import { TEACHER_PIN } from '../playwright.config';
import { openTeacher } from './helpers';

const gate = (page: Page) => page.getByTestId('teacher-gate');
const pinBox = (page: Page) => gate(page).getByLabel('รหัสเข้าหน้าครู');
const enter = (page: Page) => gate(page).getByRole('button', { name: 'เข้าหน้าครู' });
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};
async function tryPin(page: Page, pin: string) {
  await pinBox(page).fill(pin);
  await enter(page).click();
}

test('the PIN first; a wrong one is counted and nothing opens; the right one opens it for the rest of the tab', async ({ page, context }, info) => {
  // A teacher's sheet saved on this computer earlier: exactly what the PIN keeps from a learner using it after.
  await page.addInitScript(() => localStorage.setItem('shop.teacher.v1', JSON.stringify({ to: 'AKfycbx_abcdefghijklmnopqrstuvwxyz0123456789-XY', key: 'ครู1234' })));
  await page.goto('/?view=teacher');
  await expect(pinBox(page)).toBeFocused();
  await expect(page.getByTestId('teacher')).toHaveCount(0);
  await expect(page.getByText('เชื่อมกับ Google Sheet ของครู')).toHaveCount(0);
  await expect(enter(page)).toBeDisabled();
  await shot(page, 'teacher-gate', info.project.name);

  await tryPin(page, 'wrong-pin');
  await expect(gate(page).getByTestId('gate-msg')).toHaveText('รหัสไม่ถูกต้อง (ผิด 1 ครั้ง)');
  await expect(pinBox(page)).toHaveValue('');
  await expect(page.getByTestId('teacher')).toHaveCount(0);

  await tryPin(page, TEACHER_PIN);
  await expect(page.getByTestId('teacher')).toBeVisible();
  await expect(page.getByTestId('no-pin')).toHaveCount(0);
  // Its saved sheet is there behind the PIN.
  await expect(page.getByLabel(/รหัสครู/)).toHaveValue('ครู1234');
  // Reloaded in this tab: still open. A new tab asks again.
  await page.reload();
  await expect(page.getByTestId('teacher')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/?view=teacher');
  await expect(gate(other).getByLabel('รหัสเข้าหน้าครู')).toBeVisible();
  await expect(other.getByTestId('teacher')).toHaveCount(0);
  await other.close();

  // Locked again at once.
  await page.getByRole('button', { name: '🔒 ล็อกหน้าครู' }).click();
  await expect(pinBox(page)).toBeVisible();
  await expect(page.getByTestId('teacher')).toHaveCount(0);
  await page.reload();
  await expect(pinBox(page)).toBeVisible();
  await shot(page, 'teacher-locked', info.project.name);
});

test('five wrong PINs in a row: a wait of 30 seconds, then it can be tried again', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same on every screen');
  await page.clock.install();
  await page.goto('/?view=teacher');
  for (let i = 1; i <= 4; i++) {
    await tryPin(page, `wrong-${i}x`);
    await expect(gate(page).getByTestId('gate-msg')).toHaveText(`รหัสไม่ถูกต้อง (ผิด ${i} ครั้ง)`);
  }
  await tryPin(page, 'wrong-5x');
  await expect(gate(page).getByTestId('gate-msg')).toHaveText('รหัสไม่ถูกต้องหลายครั้ง · ลองใหม่ได้ในอีก 30 วินาที');
  await expect(pinBox(page)).toBeDisabled();
  // A reload does not end the wait.
  await page.reload();
  await expect(pinBox(page)).toBeDisabled();
  await page.clock.fastForward(20_000);
  await expect(gate(page).getByTestId('gate-msg')).toContainText('ลองใหม่ได้ในอีก 10 วินาที');
  await page.clock.fastForward(11_000);
  await expect(pinBox(page)).toBeEnabled();
  await tryPin(page, TEACHER_PIN);
  await expect(page.getByTestId('teacher')).toBeVisible();
});

test('on every screen: the gate and the lock button fit, the way back goes to the game', async ({ page }, info) => {
  await openTeacher(page);
  const lock = (await page.getByRole('button', { name: '🔒 ล็อกหน้าครู' }).boundingBox())!;
  // The title's text itself (the heading's box is as wide as the page).
  const title = await page.locator('.teacher-head h1').evaluate((h) => {
    const r = document.createRange();
    r.selectNodeContents(h);
    const b = r.getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  });
  const view = page.viewportSize()!;
  expect(lock.x + lock.width).toBeLessThanOrEqual(view.width);
  // The button does not sit on the title.
  expect(lock.y + lock.height <= title.y || lock.x >= title.x + title.width || title.y + title.height <= lock.y).toBe(true);
  await shot(page, 'teacher-open', info.project.name);
  await page.getByRole('button', { name: '🔒 ล็อกหน้าครู' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(view.width);
  await gate(page).getByRole('link', { name: 'กลับไปหน้าเกม' }).click();
  await expect(page).toHaveURL(/\/$/);
});
