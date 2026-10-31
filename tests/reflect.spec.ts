// The reflection after learning (docs/reflect-plan.md task B, src/ui/reflect/): opens after the post-test; the
// learner's own stars per objective, three written answers, the satisfaction form; what is left is shown before
// sending; a draft survives leaving; sent once, then thanks, and the card is done.

import { expect, test, type Page } from '@playwright/test';
import reflect from '../src/content/data/reflect.json' with { type: 'json' };
import { ALL_TALKS, LEARNED, LEARNER, PRE_DONE } from './helpers';

const CASES = ['c01-boot-order', 'c02-rufus-scheme', 'c03-red-text', 'c04-security-chip', 'c05-lab-upgrade'];
const AFTER_POST = {
  learner: LEARNER,
  ...LEARNED,
  cases: Object.fromEntries(CASES.map((c) => [c, { stars: 2, plays: 1 }])),
  post: { ...PRE_DONE, score: 8 },
  seen: ALL_TALKS,
};
const page_ = (page: Page) => page.getByTestId('reflect');
const menu = (page: Page) => page.getByTestId('menu');
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('shop.progress.v2')!));
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png`, fullPage: false });
};

async function open(page: Page, progress: Record<string, unknown> = AFTER_POST) {
  await page.addInitScript((v) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('shop.progress.v2', v);
    localStorage.setItem('seeded', '1');
  }, JSON.stringify(progress));
  await page.goto('/');
  await menu(page).getByRole('button', { name: 'ทำต่อ: สะท้อนผลและประเมินความพึงพอใจ' }).click();
  await expect(page_(page)).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
}
const stars = (page: Page, id: string, n: number) =>
  page_(page).locator(`#r-${id}`).getByRole('radio', { name: `${n} ดาว` }).click();
const level = (page: Page, id: string, n: number) =>
  page_(page)
    .locator(`#r-${id}`)
    .getByRole('radio', { name: new RegExp(`^${n} `) })
    .click();
const write = (page: Page, id: string, text: string) => page_(page).locator(`#r-${id} textarea`).fill(text);

test('the form: senior first, every item on the page, buttons big enough, nothing off the side', async ({ page }, info) => {
  await open(page);
  await expect(page).toHaveURL(/#\/reflect$/);
  await expect(page_(page).locator('.reflect-senior')).toContainText(reflect.introTh);
  await expect(page_(page).locator('[role="radiogroup"]')).toHaveCount(reflect.self.length + reflect.satisfaction.length);
  await expect(page_(page).locator('textarea')).toHaveCount(reflect.write.length + 1);
  for (const g of reflect.groups) await expect(page_(page).locator('legend', { hasText: g.th })).toBeVisible();
  await expect(page_(page).locator(`#r-${reflect.write[0]!.id} textarea`)).toHaveAttribute('placeholder', reflect.write[0]!.hintTh);
  // Every choice is a fair size to tap, and the page does not scroll sideways.
  for (const b of await page_(page).locator('[role="radio"]').all()) {
    const box = (await b.boundingBox())!;
    expect(box.height, 'tap height').toBeGreaterThanOrEqual(44);
    expect(box.width, 'tap width').toBeGreaterThanOrEqual(40);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, 'reflect-top', info.project.name);
  await page_(page).locator('.reflect-group').first().scrollIntoViewIfNeeded();
  await shot(page, 'reflect-form', info.project.name);
});

test('what is left is marked before sending; a draft survives leaving; sent once, then thanks and the card done', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the page itself is checked at every size above');
  await open(page);
  // Stars light up to the one picked.
  await stars(page, reflect.self[0]!.id, 4);
  await expect(page_(page).locator(`#r-${reflect.self[0]!.id} button.lit`)).toHaveCount(4);
  await expect(page_(page).locator(`#r-${reflect.self[0]!.id}`).getByRole('radio', { name: '4 ดาว' })).toHaveAttribute('aria-checked', 'true');
  await expect(page_(page).locator(`#r-${reflect.self[0]!.id} .reflect-means`)).toHaveText(reflect.starsTh[3]!);
  // Sending too soon: the count of what is left, each one marked, the first brought into view.
  await page_(page).getByRole('button', { name: 'ตรวจและส่ง' }).click();
  const total = reflect.self.length + reflect.write.length + reflect.satisfaction.length;
  await expect(page_(page).locator('.reflect-left')).toHaveText(`ยังไม่ได้ตอบ ${total - 1} ข้อ (ข้อที่มีกรอบแดง)`);
  await expect(page_(page).locator('.reflect-item.left')).toHaveCount(total - 1);
  await expect(page_(page).locator(`#r-${reflect.self[1]!.id}`)).toBeInViewport();
  await expect(page_(page).locator(`#r-${reflect.self[0]!.id}`)).not.toHaveClass(/left/);

  // Half done, then away to the menu and back: everything given is still there.
  await stars(page, reflect.self[1]!.id, 2);
  await write(page, reflect.write[0]!.id, 'ได้รู้วิธีตั้ง BIOS');
  await level(page, reflect.satisfaction[0]!.id, 5);
  expect((await saved(page)).reflectDraft.sat).toEqual({ [reflect.satisfaction[0]!.id]: 5 });
  await page_(page).getByRole('button', { name: '☰ เมนู' }).click();
  await menu(page).getByRole('button', { name: 'ทำต่อ: สะท้อนผลและประเมินความพึงพอใจ' }).click();
  await expect(page_(page).locator(`#r-${reflect.self[1]!.id} button.lit`)).toHaveCount(2);
  await expect(page_(page).locator(`#r-${reflect.write[0]!.id} textarea`)).toHaveValue('ได้รู้วิธีตั้ง BIOS');
  await expect(page_(page).locator(`#r-${reflect.satisfaction[0]!.id}`).getByRole('radio', { name: /^5 / })).toHaveAttribute('aria-checked', 'true');

  // The rest; a written answer too short is still left.
  for (const s of reflect.self.slice(2)) await stars(page, s.id, 3);
  await write(page, reflect.write[1]!.id, 'MBR');
  await write(page, reflect.write[2]!.id, 'ลงวินโดวส์ให้ที่บ้าน');
  for (const s of reflect.satisfaction.slice(1)) await level(page, s.id, 4);
  await page_(page).getByRole('button', { name: 'ตรวจและส่ง' }).click();
  await expect(page_(page).locator('.reflect-item.left')).toHaveCount(1);
  await expect(page_(page).locator(`#r-${reflect.write[1]!.id}`)).toContainText('เขียนอย่างน้อย 5 ตัวอักษร');
  await write(page, reflect.write[1]!.id, 'ยังงง MBR กับ GPT');
  await page_(page).getByRole('textbox').last().fill('อยากให้มีเคสเพิ่ม');
  await page_(page).getByRole('button', { name: 'ตรวจและส่ง' }).click();

  // Asked first; back to look over, then send.
  await expect(page_(page).getByRole('alertdialog')).toContainText('ส่งแล้วจะกลับมาแก้ไม่ได้');
  await page_(page).getByRole('button', { name: 'กลับไปทบทวน' }).click();
  await expect(page_(page).getByRole('alertdialog')).toHaveCount(0);
  await page_(page).getByRole('button', { name: 'ตรวจและส่ง' }).click();
  await page_(page).getByRole('button', { name: 'ส่งคำตอบ' }).click();
  await expect(page_(page).locator('.reflect-thanks')).toContainText(reflect.thanksTh);
  await shot(page, 'reflect-thanks', info.project.name);
  const p = await saved(page);
  expect(p.reflectDraft).toBeNull();
  expect(p.reflect.self).toEqual({ [reflect.self[0]!.id]: 4, [reflect.self[1]!.id]: 2, [reflect.self[2]!.id]: 3, [reflect.self[3]!.id]: 3 });
  expect(p.reflect.write[reflect.write[1]!.id]).toBe('ยังงง MBR กับ GPT');
  expect(Object.keys(p.reflect.sat)).toHaveLength(reflect.satisfaction.length);
  expect(p.reflect.suggest).toBe('อยากให้มีเคสเพิ่ม');
  expect(p.done).toContain('reflect');
  // Done and taken once: the card cannot be opened again, nor its address.
  await page_(page).getByRole('button', { name: 'กลับเส้นทางเรียน' }).click();
  const card = menu(page).locator('[data-step="reflect"]');
  await expect(card).toHaveAttribute('data-status', 'done');
  await expect(card.locator('.path-row')).toBeDisabled();
  await page.goto('/#/reflect');
  await expect(menu(page)).toBeVisible();
  await expect(page_(page)).toHaveCount(0);
});

test('shut until the post-test is taken', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the page itself is checked at every size above');
  await page.addInitScript((v) => localStorage.setItem('shop.progress.v2', v), JSON.stringify({ ...AFTER_POST, post: null }));
  await page.goto('/#/reflect');
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).locator('[data-step="reflect"]')).toHaveAttribute('data-status', 'locked');
  await expect(page_(page)).toHaveCount(0);
});
