// Free play (โหมดอิสระ, docs/phase3-plan.md tasks A and B, src/core/free.ts, src/core/visits.ts): from the start page
// with no name and no test, its own save; from the class's menu once the class's work is over; customers at random,
// each with a problem mixed in from another case; and nothing played there is sent to the teacher's sheet or
// changes the class's save.

import { expect, test, type Page, type Route } from '@playwright/test';
import { ALL_TALKS, C1_DIAGNOSIS, expectStage, LEARNED, LEARNER } from './helpers';
import problemsJson from '../src/content/data/problems.json' with { type: 'json' };

const TO = 'AKfycbx_abcdefghijklmnopqrstuvwxyz0123456789-XY';
const CLASS = 'ปวช.1/2';
const CASES = ['c01-boot-order', 'c02-rufus-scheme', 'c03-red-text', 'c04-security-chip', 'c05-lab-upgrade'];
const sitting = { score: 8, total: 10, answers: {}, at: 1, seconds: 60 };
/** A learner whose class work is over: every case played, the post-test and the reflection done. */
const FINISHED = {
  learner: LEARNER,
  ...LEARNED,
  done: [...LEARNED.done, 'reflect'],
  pre: { ...sitting, score: 4 },
  post: sitting,
  cases: Object.fromEntries(CASES.map((c) => [c, { stars: 2, plays: 1, first: 2 }])),
  reflect: { self: {}, write: {}, sat: {}, suggest: '', at: 1 },
  seen: ALL_TALKS,
  coins: 640,
};
const free = (page: Page) => page.getByTestId('free-menu');
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};

async function seed(page: Page, progress: Record<string, unknown>) {
  await page.addInitScript((v) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('shop.progress.v2', v);
    localStorage.setItem('seeded', '1');
  }, JSON.stringify(progress));
}

test('a new device: free play from the start page, no name, no case list, kept on reload, and back out', async ({ page }, info) => {
  await page.goto('/');
  const boot = page.getByTestId('boot');
  await expect(boot).toBeVisible({ timeout: 15_000 });
  await boot.getByRole('button', { name: 'Press any key to start' }).click();
  const start = page.getByTestId('start');
  // The class's button stays the main one; free play is the second.
  await expect(start.getByRole('button', { name: 'เริ่มฝึกงาน!' })).toBeVisible();
  await shot(page, 'free-start', info.project.name);
  await start.getByTestId('start-free').click();

  await expect(free(page)).toBeVisible();
  await expect(page.getByTestId('menu')).toHaveCount(0);
  await expect(page.getByLabel('ชื่อ-สกุล')).toHaveCount(0);
  await expect(free(page).getByTestId('free-note')).toContainText('ไม่บันทึกผล ไม่ส่งครู');
  // No cases 1–5 to pick: customers come at random.
  await expect(free(page).locator('[data-case]')).toHaveCount(0);
  await expect(free(page).getByTestId('free-jobs')).toContainText('0/29 แบบ');
  await expect(free(page).locator('[data-step]')).toHaveCount(3);
  await expect(free(page).getByTestId('open-book')).toContainText('สะสมแล้ว 0/16');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'free');
  await shot(page, 'free-menu', info.project.name);

  // A reload stays in free play; the tests' addresses lead to its menu.
  await page.reload();
  await expect(free(page)).toBeVisible({ timeout: 15_000 });
  await page.goto('/#/pre');
  await expect(free(page)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/#\/learn$/);
  await expect(page.getByTestId('quiz')).toHaveCount(0);

  // Into the shop with no name given: a customer comes, the HUD says free play; back to its menu.
  await free(page).getByRole('button', { name: /เปิดร้านรับลูกค้า/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop', { timeout: 15_000 });
  await expect(page.getByTestId('hud-mode')).toHaveText('เล่นอิสระ');
  await shot(page, 'free-shop', info.project.name);
  await page.getByRole('button', { name: '☰ เมนู' }).click();
  await expect(free(page)).toBeVisible({ timeout: 15_000 });

  // Out again: the start page, and the class's save was never touched.
  await free(page).getByRole('button', { name: 'ออกจากโหมดอิสระ' }).click();
  await expect(start).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'class');
  const cls = await page.evaluate(() => localStorage.getItem('shop.progress.v2'));
  expect(cls === null || JSON.parse(cls).learner === null).toBe(true);
});

test('still learning: the class menu does not offer free play', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same at every size');
  await seed(page, { learner: LEARNER, ...LEARNED, pre: sitting });
  await page.goto('/');
  await expect(page.getByTestId('menu')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('go-free')).toHaveCount(0);
});

test('a finished device: free play keeps the coins; Somsri comes with a stick made MBR mixed in; it sends nothing', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sending is the same at every size');
  const got: unknown[] = [];
  await page.route(`https://script.google.com/macros/s/${TO}/exec`, async (route: Route) => {
    got.push(JSON.parse(route.request().postData()!));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  // The first pair of the deck each time: Somsri (case 1) with case 2's problem, then Beam with case 1's.
  await page.addInitScript(() => (Math.random = () => 0));
  await seed(page, FINISHED);
  await page.goto(`/?class=${encodeURIComponent(CLASS)}&to=${TO}`);
  const menu = page.getByTestId('menu');
  await expect(menu).toBeVisible({ timeout: 15_000 });
  // The class's results go once, as before.
  await expect.poll(() => got.length, { timeout: 5000 }).toBe(1);
  const before = await page.evaluate(() => localStorage.getItem('shop.progress.v2'));

  await menu.getByTestId('go-free').click();
  await expect(free(page)).toBeVisible();
  await expect(free(page).getByTestId('coins')).toContainText('640');
  await expect(free(page).getByTestId('free-jobs').locator('[data-jobs="count"]')).toHaveText('0 งาน');

  await free(page).getByRole('button', { name: /เปิดร้านรับลูกค้า/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop', { timeout: 15_000 });
  await expect(page.getByTestId('hud-mode')).toHaveText('เล่นอิสระ');
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('ป้าสมศรี');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  // Her own problem is the one to guess.
  await page.getByRole('button', { name: C1_DIAGNOSIS }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await expectStage(page, 'repair');

  // A hint for each problem, hers first.
  const hint = (id: string) => problemsJson.find((p) => p.id === id)!.hintsTh[0]!;
  await page.getByRole('button', { name: /^คำใบ้/ }).click();
  await page.getByRole('button', { name: /^คำใบ้/ }).click();
  await expect(page.locator('.hints li')).toContainText([hint('usb-not-first'), hint('usb-wrong-scheme')]);

  // The stick she brought was made MBR: the shop's laptop is here (it never is in case 1), Rufus remakes it GPT.
  await page.getByRole('button', { name: 'เปิดโน้ตบุ๊กร้าน' }).click();
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: 'Win11_24H2_Thai_x64.iso' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('group', { name: 'Rufus' }).getByLabel('Partition scheme').selectOption('GPT');
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('usb-note')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'ไปที่เครื่องลูกค้า' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'post');
  // Then her own problem, as in case 1: USB first in the BIOS, F10 to save.
  for (const k of ['F2', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'Enter', 'Enter', 'ArrowDown', 'Enter', 'F10', 'Enter', 'Enter', 'x'])
    await page.keyboard.press(k);
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');

  // She is a regular now; the log explains both problems, each with its card.
  await expect(page.getByTestId('regular')).toContainText('ซ่อมให้ป้าสมศรีเป็นครั้งที่ 2');
  const log = page.locator('.techlog');
  await expect(log.locator('[data-problem]')).toHaveCount(2);
  await expect(log.locator('[data-problem="usb-not-first"] [data-card-link="boot-order"]')).toBeVisible();
  await expect(log.locator('[data-problem="usb-wrong-scheme"] [data-card-link="gpt-mbr"]')).toBeVisible();
  await shot(page, 'free-summary', info.project.name);

  // The next customer is someone else, with Somsri's problem mixed in.
  await page.getByRole('button', { name: 'รับลูกค้าคนถัดไป' }).click();
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('น้องบีม');

  await page.getByRole('button', { name: '☰ เมนู' }).click();
  await expect(free(page)).toBeVisible({ timeout: 15_000 });
  await expect(free(page).locator('[data-jobs="count"]')).toHaveText('1 งาน');
  await expect(free(page).locator('[data-jobs="pairs"]')).toHaveText('1/29 แบบ');
  await page.waitForTimeout(2500);
  expect(got).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('shop.progress.v2'))).toBe(before);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shop.free.v1')!));
  expect(saved.cases['c01-boot-order'].plays).toBe(2);
  expect(saved.jobs.pairs).toEqual(['c01-boot-order+usb-wrong-scheme']);
  expect(saved.learner).toBeNull();
});
