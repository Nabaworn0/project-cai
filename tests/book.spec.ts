// The technician's book (docs/book-plan.md): open from the menu as soon as there is a name, every card "???" with
// how to get it at first; cards got from the lessons, the ordering game and the cases, "ใหม่!" until opened (and
// kept so); in the shop from the HUD and from the summary of a first play, which names the new cards.

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import cards from '../src/content/data/cards.json' with { type: 'json' };
import fb from '../src/content/data/feedback.json' with { type: 'json' };
import { C1_DIAGNOSIS, expectStage, LEARNED, LEARNER, pastStart, playToRepair } from './helpers';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const book = (page: Page) => page.getByTestId('book');
const menu = (page: Page) => page.getByTestId('menu');
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const total = cards.cards.length;

test('a new learner: the book is there from the name on, every card "???" with how to get it', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('shop.boot.v1', '1'));
  await page.goto('/');
  await pastStart(page);
  await expect(menu(page).getByTestId('open-book'), 'not before the name').toHaveCount(0);
  await menu(page).getByLabel('ชื่อ-สกุล').fill(LEARNER.name);
  await menu(page).getByLabel('ชั้น').fill(LEARNER.room);
  await menu(page).getByLabel('เลขที่').fill(LEARNER.no);
  await menu(page).getByRole('button', { name: 'เริ่มเรียน' }).click();
  const open = menu(page).getByTestId('open-book');
  await expect(open).toHaveText(`📖 สมุดช่าง · สะสมแล้ว 0/${total}`);
  await open.click();
  await expect(book(page).getByTestId('book-count')).toHaveText(`สะสมแล้ว 0/${total}`);
  await expect(book(page).locator('[data-locked="true"]')).toHaveCount(total);
  await expect(book(page).locator('[data-card="os-jobs"]')).toContainText('ดูคลิป "ระบบปฏิบัติการคืออะไร" จบ');
  await expect(book(page).locator('[data-card="first-setup"]')).toContainText('ผ่านเคส 5');
  await expect(book(page).getByRole('button', { name: 'ปิดสมุดช่าง' })).toBeFocused();
  expect(await noSideways(page)).toBe(0);
  expect(await book(page).locator('.book-scroll').evaluate((e) => e.scrollWidth - e.clientWidth)).toBe(0);
  await shot(page, info, 'book-empty');
  await page.keyboard.press('Escape');
  await expect(book(page)).toHaveCount(0);
  await expect(menu(page)).toBeVisible();
});

test('cards from the lessons, the ordering game and case 1; "ใหม่!" until opened, and that is kept', async ({ page }, info) => {
  await page.addInitScript(
    ([learner, learned]) =>
      !localStorage.getItem('seeded') &&
      (localStorage.setItem('shop.progress.v2', JSON.stringify({ learner, ...learned, cases: { 'c01-boot-order': { stars: 2, plays: 1, first: 2 } } })),
      localStorage.setItem('seeded', '1')),
    [LEARNER, LEARNED] as const,
  );
  await page.goto('/');
  // Both lessons (3 cards), the ordering game (1), case 1 (2).
  const open = menu(page).getByTestId('open-book');
  await expect(open).toContainText(`สะสมแล้ว 6/${total}`);
  await expect(open.locator('.book-new')).toHaveText('ใหม่ 6');
  await open.click();
  await expect(book(page).locator('[data-locked="true"]')).toHaveCount(total - 6);
  const tile = book(page).locator('button[data-card="boot-order"]');
  await expect(tile.locator('.book-new')).toHaveText('ใหม่!');
  await shot(page, info, 'book-some');
  await tile.click();
  const card = book(page).getByTestId('book-card');
  await expect(card).toContainText('ลำดับบูตและปุ่ม F10');
  const bootOrder = cards.cards.find((c) => c.id === 'boot-order')!;
  await expect(card.locator('.book-points li')).toHaveText(bootOrder.pointsTh);
  await expect(card).toContainText(`หนังสือ น.${bootOrder.bookPage}`);
  expect(await noSideways(page)).toBe(0);
  await shot(page, info, 'book-card');
  await card.getByRole('button', { name: '← การ์ดทั้งหมด' }).click();
  await expect(tile.locator('.book-new')).toHaveCount(0);
  await book(page).getByRole('button', { name: 'ปิดสมุดช่าง' }).click();
  await expect(open.locator('.book-new')).toHaveText('ใหม่ 5');
  await page.reload();
  await expect(menu(page).getByTestId('open-book').locator('.book-new'), 'kept on this device').toHaveText('ใหม่ 5');
});

test('in the shop: the HUD opens the book; a first play of case 1 names its new cards; trying again gives none', async ({ page }, info) => {
  test.setTimeout(60_000);
  await playToRepair(page);
  // The lessons' cards are new: the HUD says so with a dot, and fits beside the other chips.
  const hud = page.getByTestId('hud-book');
  await expect(hud.getByTestId('book-dot')).toBeVisible();
  expect(await noSideways(page)).toBe(0);
  const hudBox = (await page.locator('.hud').boundingBox())!;
  expect(hudBox.x + hudBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await shot(page, info, 'book-hud');
  await hud.click();
  await expect(book(page).getByTestId('book-count')).toHaveText(`สะสมแล้ว 4/${total}`);
  await book(page).getByRole('button', { name: 'ปิดสมุดช่าง' }).click();
  await expectStage(page, 'repair');

  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await page.locator(`.keybar [data-key="${k}"]`).click();
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /แฟลชไดรฟ์ของป้าช้าเกินไป/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
  const fresh = page.getByTestId('new-cards');
  await expect(fresh).toContainText('ได้การ์ดใหม่ 2 ใบ: ลำดับบูตและปุ่ม F10, เลือกบูตผ่าน Boot Menu');
  await shot(page, info, 'book-new-cards');
  await fresh.getByRole('button', { name: 'เปิดสมุดช่าง' }).click();
  await expect(book(page).getByTestId('book-count')).toHaveText(`สะสมแล้ว 6/${total}`);
  await expect(book(page).locator('button[data-card="boot-menu"] .book-new')).toBeVisible();
  await page.keyboard.press('Escape');
  await expectStage(page, 'summary');

  // The same case again: nothing new to give.
  await page.getByRole('button', { name: fb.retry }).click();
  await expectStage(page, 'intro');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: C1_DIAGNOSIS }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await page.locator(`.keybar [data-key="${k}"]`).click();
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
  await expect(page.getByTestId('new-cards')).toHaveCount(0);
});
