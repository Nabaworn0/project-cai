// The step-ordering game on the learning page (docs/order-plan.md task B, src/ui/order/): tap cards into slots,
// check for colour marks, the senior's hint after two misses, his answer with reasons, two rounds, then the stars,
// which open the shop.

import { expect, test, type Page } from '@playwright/test';
import orderData from '../src/content/data/order.json' with { type: 'json' };
import { marks } from '../src/core/order';
import { LEARNED, LEARNER, PRE_DONE } from './helpers';

const [overview, setup] = orderData.rounds.map((r) => r.steps);
const ids = (steps: typeof overview) => steps!.map((s) => s.id);
const textOf = (id: string) => orderData.rounds.flatMap((r) => r.steps).find((s) => s.id === id)!.th;
/** Both lessons watched, so the ordering game is what "ทำต่อ" opens next (the lessons: tests/lesson.spec.ts). */
const LESSONS = ['lesson-os', 'lesson-types'];
const box = (page: Page) => page.getByTestId('order');
const menu = (page: Page) => page.getByTestId('menu');
const step = (page: Page, id: string) => menu(page).locator(`[data-step="${id}"]`);
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('shop.progress.v2')!));
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};
const seed = (page: Page, progress: unknown) =>
  page.addInitScript(
    (v) => !localStorage.getItem('seeded') && (localStorage.setItem('shop.progress.v2', v), localStorage.setItem('seeded', '1')),
    JSON.stringify(progress),
  );

/** The row cleared, then the cards tapped in this order. */
async function arrange(page: Page, row: readonly string[]) {
  const filled = box(page).locator('.order-slot.filled');
  while ((await filled.count()) > 0) await filled.first().click();
  for (const id of row)
    await box(page)
      .locator('.order-card', { hasText: textOf(id) })
      .click();
}
const checkRow = (page: Page) => box(page).getByRole('button', { name: 'ตรวจลำดับ' }).click();
/** The answer with two neighbouring steps swapped. */
const swapped = (a: readonly string[], k: number) => a.map((id, i) => (i === k ? a[k + 1]! : i === k + 1 ? a[k]! : id));


async function fits(page: Page) {
  const r = await page.evaluate(() => {
    const b = document.querySelector('.menu')!.getBoundingClientRect();
    const scroll = document.querySelector('.menu-scroll')!;
    return {
      page: document.documentElement.scrollWidth - window.innerWidth,
      inner: scroll.scrollWidth - scroll.clientWidth,
      inside: b.left >= 0 && b.top >= 0 && b.right <= window.innerWidth + 0.5 && b.bottom <= window.innerHeight + 0.5,
    };
  });
  expect(r).toEqual({ page: 0, inner: 0, inside: true });
}

test('two rounds: tap into slots, colour marks, a hint after two misses, the answer with reasons; the stars open the shop', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page, { learner: LEARNER, pre: PRE_DONE, done: LESSONS });
  await page.goto('/?seed=t1');
  await expect(step(page, 'cases')).toHaveAttribute('data-status', 'locked');
  await menu(page).getByRole('button', { name: 'ทำต่อ: เรียงขั้นตอนการติดตั้ง' }).click();
  await expect(box(page).getByTestId('senior-says')).toContainText('2 รอบ: ภาพรวมทั้งงาน แล้วก็ ในหน้า Windows Setup');
  await expect(box(page).locator('.order-legend li')).toHaveText([/ถูกตำแหน่ง/, /ห่างไป 1 ช่อง/, /ยังห่าง/]);
  // The page stands in the back room, not outside the shop.
  await expect(box(page)).toHaveAttribute('data-backdrop', 'room');
  await expect(box(page).locator('.room-scene')).toHaveCSS('background-image', /order-room/);
  await expect(box(page).locator('.entrance')).toHaveCount(0);
  await fits(page);
  await shot(page, 'order-intro', info.project.name);
  await box(page).getByRole('button', { name: 'เริ่มรอบ 1' }).click();

  // Round 1: eight empty slots and eight cards; nothing to check yet.
  const answer1 = ids(overview);
  await expect(box(page).getByTestId('order-round')).toHaveText('รอบ 1/2 · ภาพรวมทั้งงาน');
  await expect(box(page).locator('.order-slot')).toHaveCount(8);
  await expect(box(page).locator('.order-slot.filled')).toHaveCount(0);
  await expect(box(page).locator('.order-card')).toHaveCount(8);
  await expect(box(page).getByRole('button', { name: 'ตรวจลำดับ' })).toBeDisabled();
  // The board rises over the shop's sign for the room (as in the test).
  expect((await box(page).locator('.menu').boundingBox())!.y).toBeLessThan(40);
  // A card goes to the first empty slot, and back to the deck when its slot is tapped.
  await box(page)
    .locator('.order-card', { hasText: textOf('backup') })
    .click();
  await expect(box(page).locator('.order-slot').first()).toContainText(textOf('backup'));
  await expect(box(page).locator('.order-card')).toHaveCount(7);
  await box(page).locator('.order-slot').first().click();
  await expect(box(page).locator('.order-card')).toHaveCount(8);

  // First check: the steps turned round by one; each slot marked as the rules say.
  const first = [...answer1.slice(1), answer1[0]!];
  await arrange(page, first);
  await fits(page);
  await shot(page, 'order-full', info.project.name);
  await checkRow(page);
  const want = marks(answer1, first);
  await expect(box(page).locator('.order-slot').first()).toHaveAttribute('data-mark', want[0]!);
  expect(
    await box(page)
      .locator('.order-slot')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-mark'))),
  ).toEqual(want);
  await expect(box(page).getByTestId('order-try')).toHaveCount(1);
  await expect(box(page).locator('.order-count')).toHaveText('ตรวจแล้ว 1/5 ครั้ง');
  // The same row again would only use up a check.
  await expect(box(page).getByRole('button', { name: 'ตรวจลำดับ' })).toBeDisabled();
  await expect(box(page)).toContainText('ย้ายการ์ดที่ยังไม่ถูกก่อน');
  await expect(box(page).getByTestId('senior-says')).toHaveCount(0);
  // A slot whose card is taken out loses its mark.
  await box(page).locator('.order-slot').nth(2).click();
  await expect(box(page).locator('.order-slot').nth(2)).toHaveAttribute('data-mark', '');

  // Second miss: the senior hints at the first slot still wrong.
  await arrange(page, swapped(answer1, 2));
  await checkRow(page);
  await expect(box(page).getByTestId('senior-says')).toHaveText(`พี่ช่าง: ${overview![2]!.hintTh}`);
  await fits(page);
  await shot(page, 'order-hint', info.project.name);

  // Third: right. The senior goes through every step's reason.
  await arrange(page, answer1);
  await checkRow(page);
  const answer = box(page).getByTestId('order-answer');
  await expect(answer).toContainText('เรียงถูกหมดในครั้งที่ 3');
  await expect(answer.locator('.order-why li')).toHaveCount(8);
  await expect(answer.locator('.order-why li').nth(1)).toContainText(overview![1]!.whyTh);
  await fits(page);
  await shot(page, 'order-answer', info.project.name);
  await answer.getByRole('button', { name: 'ไปรอบ 2' }).click();

  // Round 2: five misses, then the answer is shown anyway.
  const answer2 = ids(setup);
  await expect(box(page).getByTestId('order-round')).toHaveText('รอบ 2/2 · ในหน้า Windows Setup');
  for (const k of [0, 1, 2, 3, 4]) {
    await arrange(page, swapped(answer2, k));
    await checkRow(page);
  }
  await expect(answer).toContainText('ครบ 5 ครั้งแล้ว');
  await expect(answer.locator('.order-why li')).toHaveCount(7);
  await answer.getByRole('button', { name: 'ดูผล' }).click();

  const result = box(page).getByTestId('order-result');
  // Round 2 was not solved: no second star, so no third either.
  await expect(result.locator('.order-stars')).toHaveAttribute('aria-label', 'ได้ 1 ดาว จาก 3');
  await expect(result).toContainText('รอบ 1 ภาพรวมทั้งงาน: เรียงถูกในครั้งที่ 3');
  await expect(result).toContainText('รอบ 2 ในหน้า Windows Setup: ครบ 5 ครั้ง พี่ช่างเฉลย');
  await expect(result).not.toContainText('สายพาน');
  await fits(page);
  await shot(page, 'order-result', info.project.name);

  const p = await saved(page);
  expect(p.done).toContain('order');
  expect(p.order).toEqual({ stars: 1, plays: 1, first: { tries: [3, 5], solved: [true, false] } });
  await result.getByRole('button', { name: 'กลับเส้นทางเรียน' }).click();
  await expect(step(page, 'order')).toHaveAttribute('data-status', 'done');
  await expect(step(page, 'order').getByLabel('ได้ 1 ดาว')).toBeVisible();
  await expect(step(page, 'cases')).toHaveAttribute('data-status', 'open');
  await expect(menu(page).getByRole('button', { name: 'ทำต่อ: ฝึกงานที่ร้าน · เคส 1 ป้าสมศรี' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('quick taps in a row all land', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the screen itself is checked at every size above');
  await seed(page, { learner: LEARNER, pre: PRE_DONE, done: LESSONS });
  await page.goto('/?seed=t2');
  await menu(page).getByRole('button', { name: 'ทำต่อ: เรียงขั้นตอนการติดตั้ง' }).click();
  await box(page).getByRole('button', { name: 'เริ่มรอบ 1' }).click();
  // Every card clicked within one moment, before the screen redraws.
  await box(page)
    .locator('.order-card')
    .evaluateAll((cards) => cards.forEach((c) => (c as HTMLElement).click()));
  await expect(box(page).locator('.order-slot.filled')).toHaveCount(8);
  await expect(box(page).getByRole('button', { name: 'ตรวจลำดับ' })).toBeEnabled();
});

test('played again from its card: the best stars stay, the first play is kept as it went', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the screen itself is checked at every size above');
  // A play saved before the boss belt was taken out (4 Nov 2026) still holds its hearts lost; it loads all the same.
  await seed(page, { learner: LEARNER, ...LEARNED, order: { stars: 3, plays: 1, first: { tries: [1, 1], solved: [true, true], lost: 0 } } });
  await page.goto('/?seed=t3');
  await expect(step(page, 'order').getByLabel('ได้ 3 ดาว')).toBeVisible();
  await step(page, 'order').locator('.path-row').click();
  await box(page).getByRole('button', { name: 'เริ่มรอบ 1' }).click();
  for (const [k, a] of [ids(overview), ids(setup)].entries()) {
    // Four misses each, then right: both solved (the second star) but not within 3 checks.
    for (const row of [swapped(a, 0), swapped(a, 1), swapped(a, 2), swapped(a, 3)]) {
      await arrange(page, row);
      await checkRow(page);
    }
    await arrange(page, a);
    await checkRow(page);
    await box(page)
      .getByRole('button', { name: k === 0 ? 'ไปรอบ 2' : 'ดูผล' })
      .click();
  }
  await expect(box(page).locator('.order-stars')).toHaveAttribute('aria-label', 'ได้ 2 ดาว จาก 3');
  expect((await saved(page)).order).toEqual({ stars: 3, plays: 2, first: { tries: [1, 1], solved: [true, true] } });
});

test('both rounds right at the first check: three stars, straight after round 2', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the screen itself is checked at every size above');
  await seed(page, { learner: LEARNER, pre: PRE_DONE, done: LESSONS });
  await page.goto('/?seed=t4');
  await menu(page).getByRole('button', { name: 'ทำต่อ: เรียงขั้นตอนการติดตั้ง' }).click();
  await box(page).getByRole('button', { name: 'เริ่มรอบ 1' }).click();
  for (const [k, a] of [ids(overview), ids(setup)].entries()) {
    await arrange(page, a);
    await checkRow(page);
    await box(page)
      .getByRole('button', { name: k === 0 ? 'ไปรอบ 2' : 'ดูผล' })
      .click();
  }
  await expect(box(page).locator('.order-stars')).toHaveAttribute('aria-label', 'ได้ 3 ดาว จาก 3');
  await expect(box(page).locator('.order-summary li')).toHaveCount(2);
  expect((await saved(page)).order).toEqual({ stars: 3, plays: 1, first: { tries: [1, 1], solved: [true, true] } });
});
