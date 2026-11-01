// The play guide (docs/guide-pin-plan.md task H): opened from the start page, the class's menu and free play's menu,
// each on its own topic; one topic open at a time; the learning path's steps from the game; closed by ✕ or Esc.

import { expect, test, type Page } from '@playwright/test';
import guide from '../src/content/data/guide.json' with { type: 'json' };
import { STEP_INFO } from '../src/core/path';
import { LEARNER } from './helpers';

const dialog = (page: Page) => page.getByTestId('guide');
const topic = (page: Page, id: string) => dialog(page).locator(`[data-topic="${id}"]`);
const lines = (id: string) => guide.sections.find((s) => s.id === id)!.linesTh;
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};

/** Only this topic is open, showing its lines; the others show their titles only. */
async function onlyOpen(page: Page, id: string) {
  for (const s of guide.sections) {
    const t = topic(page, s.id);
    await expect(t.getByRole('button', { name: s.titleTh })).toHaveAttribute('aria-expanded', String(s.id === id));
    await expect(t.locator('.guide-body')).toBeVisible({ visible: s.id === id });
  }
  for (const l of lines(id)) await expect(topic(page, id)).toContainText(l);
}

/** In view, inside the screen, nothing off the side. */
async function fits(page: Page) {
  const view = page.viewportSize()!;
  const box = (await dialog(page).locator('.book').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(view.width);
}

async function toStart(page: Page) {
  await page.goto('/');
  const boot = page.getByTestId('boot');
  await expect(boot.or(page.getByTestId('start'))).toBeVisible({ timeout: 15_000 });
  if (await boot.isVisible()) await boot.getByRole('button', { name: 'Press any key to start' }).click();
  await expect(page.getByTestId('start')).toBeVisible();
}

test('from the start page: on "getting started", one topic at a time, the path\'s steps from the game, closed by ✕ and Esc', async ({ page }, info) => {
  await toStart(page);
  await page.getByTestId('start-guide').click();
  await expect(dialog(page).getByRole('button', { name: 'ปิดวิธีเล่น' })).toBeFocused();
  await onlyOpen(page, 'start');
  await fits(page);
  await shot(page, 'guide-start', info.project.name);

  // Another topic closes the first; the path lists every step of the learning path, in order.
  await topic(page, 'path').getByRole('button').click();
  await onlyOpen(page, 'path');
  await expect(topic(page, 'path').locator('.guide-steps li')).toHaveText(Object.values(STEP_INFO).map((s) => s.th));
  // Tapped again: closed, none open.
  await topic(page, 'path').getByRole('button').click();
  await expect(dialog(page).locator('.guide-body:visible')).toHaveCount(0);
  // The last topic can be reached and read on a small screen.
  const last = guide.sections.at(-1)!;
  await topic(page, last.id).getByRole('button').click();
  await expect(topic(page, last.id).getByRole('button')).toBeInViewport();
  await topic(page, last.id).locator('li').last().scrollIntoViewIfNeeded();
  await expect(topic(page, last.id).locator('li').last()).toBeInViewport();
  await fits(page);
  await shot(page, 'guide-help', info.project.name);

  await dialog(page).getByRole('button', { name: 'ปิดวิธีเล่น' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId('start')).toBeVisible();
  await page.getByTestId('start-guide').click();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test("from the class's menu on the learning path, and from free play's menu on free play", async ({ page }, info) => {
  await toStart(page);
  await page.getByTestId('start').getByRole('button', { name: 'เริ่มฝึกงาน!' }).click();
  const menu = page.getByTestId('menu');
  // Not before the learner has given a name: the form is the whole page then.
  await expect(menu.getByLabel('ชื่อ-สกุล')).toBeVisible();
  await expect(menu.getByTestId('open-guide')).toHaveCount(0);
  await menu.getByLabel('ชื่อ-สกุล').fill(LEARNER.name);
  await menu.getByLabel('ชั้น').fill(LEARNER.room);
  await menu.getByLabel('เลขที่').fill(LEARNER.no);
  await menu.getByRole('button', { name: 'เริ่มเรียน' }).click();
  await menu.getByTestId('open-guide').click();
  await onlyOpen(page, 'path');
  await fits(page);
  await shot(page, 'guide-menu', info.project.name);
  await page.keyboard.press('Escape');
  await expect(menu).toBeVisible();

  // Free play, from the start page ("เกี่ยวกับเกม" is not needed: a fresh page has the start page).
  await page.evaluate(() => localStorage.setItem('shop.mode.v1', 'free'));
  await page.reload();
  const free = page.getByTestId('free-menu');
  await expect(free).toBeVisible({ timeout: 15_000 });
  await free.getByTestId('open-guide').click();
  await onlyOpen(page, 'free');
  await fits(page);
  await shot(page, 'guide-free', info.project.name);
});
