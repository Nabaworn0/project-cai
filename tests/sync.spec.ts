// Sending results to the teacher's Google Sheet (docs/results-plan.md task B2, src/ui/sync.ts), against a stand-in
// for the Apps Script web app: from a class link the learner is told, the results go after the name and after each
// change (not again when nothing changed), a failure is shown and sent again; without a class link nothing is sent.

import { expect, test, type Page, type Route } from '@playwright/test';
import { LEARNED, LEARNER } from './helpers';

const TO = 'AKfycbx_abcdefghijklmnopqrstuvwxyz0123456789-XY';
const CLASS = 'ปวช.1/2';
const link = `/?class=${encodeURIComponent(CLASS)}&to=${TO}`;
const menu = (page: Page) => page.getByTestId('menu');
const results = (page: Page) => page.getByTestId('results');

/** Stands in for the teacher's web app; `ok` decides the answer. Every body sent is kept. */
async function sheet(page: Page) {
  const got: { class: string; file: { app: string; data: Record<string, any> } }[] = [];
  const s = { ok: true, got };
  await page.route(`https://script.google.com/macros/s/${TO}/exec`, async (route: Route) => {
    got.push(JSON.parse(route.request().postData()!));
    if (s.ok) await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    else await route.fulfill({ status: 500, body: 'error' });
  });
  return s;
}

test('from the class link: the learner is told, the name is sent, then every change but not the same twice', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sending is the same at every size');
  const s = await sheet(page);
  await page.goto(link);
  await expect(menu(page).getByTestId('class-notice')).toContainText(`ผลการเรียนพร้อมชื่อนี้จะส่งให้ครูของห้อง ${CLASS}`);
  await menu(page).getByLabel('ชื่อ-สกุล').fill(LEARNER.name);
  await menu(page).getByLabel('ชั้น').fill(LEARNER.room);
  await menu(page).getByLabel('เลขที่').fill(LEARNER.no);
  await menu(page).getByRole('button', { name: 'เริ่มเรียน' }).click();
  await expect.poll(() => s.got.length, { timeout: 5000 }).toBe(1);
  expect(s.got[0]!.class).toBe(CLASS);
  expect(s.got[0]!.file.app).toBe('shop-results');
  expect(s.got[0]!.file.data.learner).toEqual(LEARNER);
  // The class is kept: opened later from the plain address, it still sends to the same sheet.
  await page.evaluate((learned) => {
    const p = JSON.parse(localStorage.getItem('shop.progress.v2')!);
    localStorage.setItem('shop.progress.v2', JSON.stringify({ ...p, ...learned }));
  }, LEARNED);
  await page.goto('/#/results');
  await expect.poll(() => s.got.length, { timeout: 5000 }).toBe(2);
  expect(s.got[1]!.file.data.done).toEqual(LEARNED.done);
  await expect(results(page).locator('.results-sync')).toHaveAttribute('data-status', 'sent');
  await expect(results(page).locator('.results-sync')).toContainText(`ส่งผลให้ครูห้อง ${CLASS} แล้ว ✓`);
  await expect(results(page).locator('.results-how')).toContainText('ทางสำรอง');
  // Nothing new: not sent again.
  await page.reload();
  await expect(results(page)).toBeVisible();
  await page.waitForTimeout(2500);
  expect(s.got).toHaveLength(2);
});

test('a failed send is shown, tried again by hand or on its own, and then marked sent', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sending is the same at every size');
  const s = await sheet(page);
  s.ok = false;
  await page.addInitScript((learner) => {
    if (!localStorage.getItem('shop.progress.v2')) localStorage.setItem('shop.progress.v2', JSON.stringify({ learner }));
  }, LEARNER);
  await page.goto(`${link}#/results`);
  const status = results(page).locator('.results-sync');
  await expect(status).toHaveAttribute('data-status', 'failed', { timeout: 5000 });
  await expect(status).toContainText('ยังส่งผลให้ครูไม่ได้');
  s.ok = true;
  await status.getByRole('button', { name: 'ส่งตอนนี้' }).click();
  await expect(status).toHaveAttribute('data-status', 'sent');
  expect(s.got).toHaveLength(2);
  // Back online also sends straight away (here: fail, then the browser says it is online again).
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('shop.progress.v2')!);
    localStorage.setItem('shop.progress.v2', JSON.stringify({ ...p, done: ['order'] }));
  });
  s.ok = false;
  await page.reload();
  await expect(status).toHaveAttribute('data-status', 'failed', { timeout: 5000 });
  s.ok = true;
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await expect(status).toHaveAttribute('data-status', 'sent');
});

test('without a class link nothing is sent anywhere and nothing about sending is shown', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sending is the same at every size');
  const s = await sheet(page);
  const outside: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) outside.push(r.url());
  });
  await page.addInitScript((v) => localStorage.setItem('shop.progress.v2', v), JSON.stringify({ learner: LEARNER, ...LEARNED }));
  await page.goto('/#/results');
  await expect(results(page)).toBeVisible();
  await page.waitForTimeout(2500);
  expect(s.got).toHaveLength(0);
  expect(outside.filter((u) => u.includes('script.google.com'))).toEqual([]);
  await expect(results(page).locator('.results-sync')).toHaveCount(0);
  // A link with a broken sheet id is no class at all.
  await page.goto(`/?class=x&to=bad#/results`);
  await expect(results(page)).toBeVisible();
  await expect(results(page).locator('.results-sync')).toHaveCount(0);
});

test('the status fits at every size', async ({ page }, info) => {
  const s = await sheet(page);
  await page.addInitScript((v) => localStorage.setItem('shop.progress.v2', v), JSON.stringify({ learner: LEARNER, ...LEARNED }));
  await page.goto(`${link}#/results`);
  await expect(results(page).locator('.results-sync')).toHaveAttribute('data-status', 'sent', { timeout: 5000 });
  expect(s.got.length).toBeGreaterThan(0);
  await results(page).locator('.results-sync').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/sync-${info.project.name}.png` });
});
