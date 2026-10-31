// The start page before the name form (docs/start-page-plan.md): the boot screen the first time on a device, the
// WINSTALL title with its animations (skipped by a tap, or not run for those who ask for less motion) on one screen,
// what the game teaches folded under it, the class's badge with "not my class", the class-mismatch note in the name form, and "เกี่ยวกับเกม".

import { expect, test, type Page, type Route } from '@playwright/test';
import start from '../src/content/data/start.json' with { type: 'json' };
import { LEARNED, LEARNER, pastStart } from './helpers';

const CLASS = 'ปวช.1/2';
const TO = 'AKfycbx_abcdefghijklmnopqrstuvwxyz0123456789-XY';
const link = `/?class=${encodeURIComponent(CLASS)}&to=${TO}`;
const boot = (page: Page) => page.getByTestId('boot');
const startPage = (page: Page) => page.getByTestId('start');
const menu = (page: Page) => page.getByTestId('menu');

test('a first visit: the boot screen, then the start page, then the name form', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(boot(page)).toContainText('USB drive detected... OK');
  await expect(boot(page)).toContainText('Press any key to start');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/start-boot-${info.project.name}.png` });
  // A tap anywhere on a phone, any key on a computer.
  if (info.project.name === 'desktop') await page.keyboard.press('Enter');
  else await boot(page).click({ position: { x: 20, y: 20 } });

  const s = startPage(page);
  await expect(s.getByRole('heading', { level: 1 })).toHaveText('WINSTALL');
  await expect(s).toContainText(start.tagline);
  await expect(s).toContainText(start.time);
  await expect(s.getByRole('link', { name: start.teacherLink })).toHaveAttribute('href', /\?view=teacher$/);
  // The steps are the menu's to show; what the game teaches is folded away, there to open.
  await expect(s.locator('.start-steps, .start-how')).toHaveCount(0);
  await expect(s.locator('.start-goals li').first()).toBeHidden();
  // No class link: nothing about sending.
  await expect(s.getByTestId('start-class')).toHaveCount(0);
  // Everything in place on its own, and the page fits the screen's width.
  await expect(s).toHaveAttribute('data-settled', 'true', { timeout: 6000 });
  await expect(s.locator('.start-bubble')).toContainText(start.greeting);
  expect(await page.evaluate(() => document.querySelector('.start-scroll')!.scrollWidth - document.querySelector('.start-scroll')!.clientWidth)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  // One screen: nothing to scroll to, the button to start in full view.
  expect(await page.evaluate(() => document.querySelector('.start-scroll')!.scrollHeight - document.querySelector('.start-scroll')!.clientHeight)).toBeLessThanOrEqual(0);
  const go = (await s.getByRole('button', { name: start.start }).boundingBox())!;
  expect(go.y + go.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/start-${info.project.name}.png` });
  await s.getByText(start.goalsTitle).click();
  await expect(s.locator('.start-goals li')).toHaveText(start.goals);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/start-goals-${info.project.name}.png` });

  await s.getByRole('button', { name: start.start }).click();
  await expect(menu(page).getByLabel('ชื่อ-สกุล')).toBeVisible();
  // The boot screen is once per device; the start page is for each new learner.
  await page.reload();
  await expect(startPage(page)).toBeVisible();
  await expect(boot(page)).toHaveCount(0);
  await startPage(page).getByRole('button', { name: start.start }).click();
  await menu(page).getByLabel('ชื่อ-สกุล').fill(LEARNER.name);
  await menu(page).getByLabel('ชั้น').fill(LEARNER.room);
  await menu(page).getByLabel('เลขที่').fill(LEARNER.no);
  await menu(page).getByRole('button', { name: 'เริ่มเรียน' }).click();
  await menu(page).getByRole('button', { name: 'ผู้เรียนคนใหม่' }).click();
  await menu(page).getByRole('button', { name: 'ล้างและเริ่มใหม่' }).click();
  await expect(startPage(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('a tap puts everything in place at once: the greeting in full, the senior done talking', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same at every size');
  await page.addInitScript(() => localStorage.setItem('shop.boot.v1', '1'));
  await page.goto('/');
  const s = startPage(page);
  await expect(s).toHaveAttribute('data-settled', 'false');
  await expect(s.locator('[data-frame="teach-stand"]')).toBeVisible();
  await s.locator('.start-top').click();
  // Straight away, not when it would have settled anyway (4.2 s).
  await expect(s).toHaveAttribute('data-settled', 'true', { timeout: 1000 });
  await expect(s.locator('.start-bubble [aria-hidden="true"]')).toHaveText(start.greeting, { timeout: 1000 });
  await expect(s.locator('.start-senior img').first()).toHaveAttribute('data-frame', 'teach-thumbs', { timeout: 1000 });
  // The intern keeps waving the USB drive.
  const frames = new Set<string>();
  for (let i = 0; i < 8 && frames.size < 2; i++) {
    frames.add((await s.locator('.start-intern img').getAttribute('data-frame'))!);
    await page.waitForTimeout(250);
  }
  expect([...frames].sort()).toEqual(['tech-usb-hold', 'tech-usb-up']);
});

test('asking for less motion: the boot text and the page are all there at once', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same at every size');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // At once, not typed out or played: read straight away, without waiting.
  await expect(boot(page)).toBeVisible();
  expect(await boot(page).locator('pre').textContent()).toContain('Press any key to start');
  await page.keyboard.press('Enter');
  await expect(startPage(page)).toBeVisible();
  expect(await startPage(page).getAttribute('data-settled')).toBe('true');
  await expect(startPage(page).locator('.start-bubble [aria-hidden="true"]')).toHaveText(start.greeting);
  expect(await startPage(page).locator('.start-logo').evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
});

test('the sound button on the start page is the game\'s sound setting', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same at every size');
  await page.addInitScript(() => localStorage.setItem('shop.boot.v1', '1'));
  await page.goto('/');
  const sound = startPage(page).getByRole('button', { name: /เสียง/ });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await expect(sound).toContainText(start.soundOn);
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await expect(sound).toContainText(start.soundOff);
  expect(await page.evaluate(() => localStorage.getItem('shop.muted'))).toBe('1');
});

test('from a class link: the class is named; "not my class" stops anything being sent to it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sending is the same at every size');
  const sent: unknown[] = [];
  await page.route('https://script.google.com/**', (route: Route) => {
    sent.push(route.request().postData());
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.addInitScript(() => localStorage.setItem('shop.boot.v1', '1'));
  await page.goto(link);
  const badge = startPage(page).getByTestId('start-class');
  await expect(badge).toHaveText(new RegExp(start.classBadge.replace('{class}', CLASS).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
  await expect(badge.locator('b')).toHaveText(CLASS);
  await badge.getByRole('button', { name: start.notMyClass }).click();
  await expect(badge.getByRole('status')).toHaveText(start.notMyClassDone);
  // Forgotten here and in the address, so a reload does not bring it back.
  expect(await page.evaluate(() => [localStorage.getItem('shop.class.v1'), new URL(location.href).searchParams.get('class')])).toEqual([null, null]);

  await startPage(page).getByRole('button', { name: start.start }).click();
  await expect(menu(page).getByTestId('class-notice')).toHaveCount(0);
  await menu(page).getByLabel('ชื่อ-สกุล').fill(LEARNER.name);
  await menu(page).getByLabel('ชั้น').fill(LEARNER.room);
  await menu(page).getByLabel('เลขที่').fill(LEARNER.no);
  await menu(page).getByRole('button', { name: 'เริ่มเรียน' }).click();
  await expect(menu(page).getByTestId('learner')).toBeVisible();
  await page.waitForTimeout(2500);
  expect(sent).toEqual([]);
  await page.reload();
  await expect(menu(page)).toBeVisible();
  await page.waitForTimeout(2500);
  expect(sent).toEqual([]);
});

test('the name form notices a class typed unlike the link\'s, but lets it through', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same at every size');
  await page.route('https://script.google.com/**', (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.goto(link);
  await pastStart(page);
  const room = menu(page).getByLabel('ชั้น');
  const note = menu(page).getByTestId('room-mismatch');
  await room.fill('ปวช.1/3');
  await expect(note).toHaveText(start.roomMismatch.replace('{typed}', 'ปวช.1/3').replace('{class}', CLASS));
  // Spaces and dots aside, it is the same class.
  for (const same of ['ปวช. 1/2', 'ปวช1/2', CLASS]) {
    await room.fill(same);
    await expect(note).toHaveCount(0);
  }
  await room.fill('ปวช.1/3');
  await menu(page).getByLabel('ชื่อ-สกุล').fill(LEARNER.name);
  await menu(page).getByLabel('เลขที่').fill(LEARNER.no);
  await menu(page).getByRole('button', { name: 'เริ่มเรียน' }).click();
  await expect(menu(page).getByTestId('learner')).toContainText('ปวช.1/3');
});

test('"เกี่ยวกับเกม" in the menu opens the start page again, without the boot screen, and goes back', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same at every size');
  await page.addInitScript((learned) => localStorage.setItem('shop.progress.v2', JSON.stringify(learned)), { learner: LEARNER, ...LEARNED });
  await page.goto('/');
  // A learner with a name goes straight to the menu, even on a device that never saw the boot screen.
  await expect(menu(page)).toBeVisible();
  await expect(boot(page)).toHaveCount(0);
  await menu(page).getByRole('button', { name: start.aboutLink }).click();
  await expect(startPage(page)).toBeVisible();
  await expect(boot(page)).toHaveCount(0);
  await startPage(page).getByRole('button', { name: 'กลับไปเมนู' }).click();
  await expect(menu(page).getByTestId('learner')).toBeVisible();
});
