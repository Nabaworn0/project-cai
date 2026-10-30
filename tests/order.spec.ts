// The step-ordering game on the learning page (docs/order-plan.md tasks B-C, src/ui/order/): tap cards into slots,
// check for colour marks, the senior's hint after two misses, his answer with reasons, two rounds, then the boss
// belt in 2.5D and the stars, which open the shop. The belt runs on Playwright's clock, moved on by hand.

import { expect, test, type Page } from '@playwright/test';
import orderData from '../src/content/data/order.json' with { type: 'json' };
import { bossSequence, marks } from '../src/core/order';
import { LEARNED, LEARNER, PRE_DONE } from './helpers';

const [overview, setup] = orderData.rounds.map((r) => r.steps);
const ids = (steps: typeof overview) => steps!.map((s) => s.id);
const textOf = (id: string) => [...orderData.rounds.flatMap((r) => r.steps), ...orderData.traps].find((s) => s.id === id)!.th;
const SEQ = bossSequence(orderData.rounds, orderData.boss);
const TRAPS = orderData.traps.map((t) => t.id);
const boss = (page: Page) => page.getByTestId('boss');
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

/** Both rounds put right at the first check, on to the boss. */
async function toBoss(page: Page) {
  await menu(page).getByRole('button', { name: 'ทำต่อ: เรียงขั้นตอนการติดตั้ง' }).click();
  await box(page).getByRole('button', { name: 'เริ่มรอบ 1' }).click();
  for (const [k, a] of [ids(overview), ids(setup)].entries()) {
    await arrange(page, a);
    await checkRow(page);
    await box(page)
      .getByRole('button', { name: k === 0 ? 'ไปรอบ 2' : 'ไปด่านบอส' })
      .click();
  }
  await expect(boss(page)).toHaveAttribute('data-phase', 'ready');
}

/** The belt started on a stopped clock (the clock is moved by hand from here on). With the page's animation frames
 *  on that clock, Playwright cannot see a card as "stable", so taps from here on use force: the cards do stand still
 *  between clock moves. */
async function startBelt(page: Page) {
  await page.clock.install();
  await boss(page).getByRole('button', { name: 'เริ่มสายพาน' }).click();
  await expect(boss(page)).toHaveAttribute('data-phase', 'run');
}

/** How far along the belt (0-1) a card at `top`% is: the inverse of BossBelt's place(). */
const along = (top: number) => Math.max(0, (top - 24) / 62) ** 0.8;
/** Where a card `dx` further along the belt shows (top, %). */
const topAfter = (top: number, dx: number) => 24 + 62 * (along(top) + dx) ** 1.25;

/** Card `id`'s place: how far down the belt (%), and its size on screen. */
const where = async (page: Page, id: string) => {
  const card = boss(page).locator(`.boss-card[data-step="${id}"]`);
  return { top: parseFloat(await card.evaluate((e) => (e as HTMLElement).style.top)), box: (await card.boundingBox())! };
};

/** Runs the belt a quarter second at a time, tapping the step needed next once it is a little way down the belt
 *  (and, if asked, one trap first), until the run ends. */
async function playBelt(page: Page, { trap = false } = {}) {
  let trapped = !trap;
  for (let i = 0; i < 800 && (await boss(page).getAttribute('data-phase')) === 'run'; i++) {
    await page.clock.runFor(250);
    if (!trapped) {
      const t = boss(page).locator(TRAPS.map((id) => `.boss-card[data-step="${id}"]`).join(', '));
      if (await t.count()) {
        await t.first().click({ force: true });
        trapped = true;
        continue;
      }
    }
    const at = Number(await boss(page).getAttribute('data-at'));
    const card = boss(page).locator(`.boss-card[data-step="${SEQ[at]}"]`);
    if ((await card.count()) && (await where(page, SEQ[at]!)).top > 30) await card.click({ force: true });
  }
}

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
  await seed(page, { learner: LEARNER, pre: PRE_DONE });
  await page.goto('/?seed=t1');
  await expect(step(page, 'cases')).toHaveAttribute('data-status', 'locked');
  await menu(page).getByRole('button', { name: 'ทำต่อ: เรียงขั้นตอนการติดตั้ง' }).click();
  await expect(box(page).getByTestId('senior-says')).toContainText('2 รอบ: ภาพรวมทั้งงาน แล้วก็ ในหน้า Windows Setup แล้วปิดท้ายด้วยสายพานงานซ่อม');
  await expect(box(page).locator('.order-legend li')).toHaveText([/ถูกตำแหน่ง/, /ห่างไป 1 ช่อง/, /ยังห่าง/]);
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
  await answer.getByRole('button', { name: 'ไปด่านบอส' }).click();

  // The boss, every step tapped in time: no heart lost.
  await startBelt(page);
  await playBelt(page);
  await boss(page).getByRole('button', { name: 'ดูผล' }).click({ force: true });
  const result = box(page).getByTestId('order-result');
  // Round 2 took five checks: no second star.
  await expect(result.locator('.order-stars')).toHaveAttribute('aria-label', 'ได้ 2 ดาว จาก 3');
  await expect(result).toContainText('รอบ 1 ภาพรวมทั้งงาน: เรียงถูกในครั้งที่ 3');
  await expect(result).toContainText('รอบ 2 ในหน้า Windows Setup: ครบ 5 ครั้ง พี่ช่างเฉลย');
  await fits(page);
  await shot(page, 'order-result', info.project.name);

  const p = await saved(page);
  expect(p.done).toContain('order');
  expect(p.order).toEqual({ stars: 2, plays: 1, first: { tries: [3, 5], solved: [true, false], lost: 0 } });
  await result.getByRole('button', { name: 'กลับเส้นทางเรียน' }).click();
  await expect(step(page, 'order')).toHaveAttribute('data-status', 'done');
  await expect(step(page, 'order').getByLabel('ได้ 2 ดาว')).toBeVisible();
  await expect(step(page, 'cases')).toHaveAttribute('data-status', 'open');
  await expect(menu(page).getByRole('button', { name: 'ทำต่อ: ฝึกงานที่ร้าน · เคส 1 ป้าสมศรี' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('quick taps in a row all land', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the screen itself is checked at every size above');
  await seed(page, { learner: LEARNER, pre: PRE_DONE });
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
  await seed(page, { learner: LEARNER, ...LEARNED, order: { stars: 3, plays: 1, first: { tries: [1, 1], solved: [true, true], lost: 0 } } });
  await page.goto('/?seed=t3');
  await expect(step(page, 'order').getByLabel('ได้ 3 ดาว')).toBeVisible();
  await step(page, 'order').locator('.path-row').click();
  await box(page).getByRole('button', { name: 'เริ่มรอบ 1' }).click();
  for (const [k, a] of [ids(overview), ids(setup)].entries()) {
    // Two misses each: no second star this time.
    for (const row of [swapped(a, 0), swapped(a, 1), swapped(a, 2), swapped(a, 3)]) {
      await arrange(page, row);
      await checkRow(page);
    }
    await arrange(page, a);
    await checkRow(page);
    await box(page)
      .getByRole('button', { name: k === 0 ? 'ไปรอบ 2' : 'ไปด่านบอส' })
      .click();
  }
  await startBelt(page);
  await playBelt(page);
  await boss(page).getByRole('button', { name: 'ดูผล' }).click({ force: true });
  await expect(box(page).locator('.order-stars')).toHaveAttribute('aria-label', 'ได้ 2 ดาว จาก 3');
  expect((await saved(page)).order).toEqual({ stars: 3, plays: 2, first: { tries: [1, 1], solved: [true, true], lost: 0 } });
});

test('the boss belt in 2.5D: cards come from the back and grow; a trap costs a heart; 14 steps finish it', async ({ page }, info) => {
  await seed(page, { learner: LEARNER, pre: PRE_DONE });
  await page.goto('/?seed=b1');
  await toBoss(page);
  await expect(boss(page).getByTestId('senior-says')).toContainText('แตะขั้นที่ต้องทำต่อไปก่อนมันหลุดขอบ');
  await expect(boss(page).getByLabel('หัวใจ 3 จาก 3')).toBeVisible();
  await fits(page);
  await shot(page, 'boss-ready', info.project.name);
  await startBelt(page);

  // The run opens on the first step, coming from the far end of the belt.
  await expect(boss(page).locator('.boss-card')).toHaveCount(1);
  await expect(boss(page).locator('.boss-card')).toHaveText(textOf(SEQ[0]!));
  await expect(boss(page).getByTestId('boss-last')).toHaveText('เริ่มงาน: ขั้นแรกของการลง Windows 11 คืออะไร');
  const far = await where(page, SEQ[0]!);
  await page.clock.runFor(2000);
  const near = await where(page, SEQ[0]!);
  // 2 s at 0.1 belt widths a second: down the belt, and bigger on screen.
  expect(far.top).toBeLessThan(26);
  expect(near.top).toBeCloseTo(topAfter(far.top, 0.2), 0);
  expect(near.box.width).toBeGreaterThan(far.box.width * 1.05);
  await page.clock.runFor(2000);
  expect(await boss(page).locator('.boss-card').count()).toBeGreaterThan(1);
  await fits(page);
  // The hearts and the whole belt, down to its front edge, are in sight without scrolling.
  await expect(boss(page).locator('.boss-hearts')).toBeInViewport({ ratio: 1 });
  await expect(boss(page).locator('.boss-stage')).toBeInViewport({ ratio: 0.98 });
  await shot(page, 'boss-run', info.project.name);
  await boss(page).locator(`.boss-card[data-step="${SEQ[0]}"]`).click({ force: true });
  await expect(boss(page)).toHaveAttribute('data-at', '1');
  await expect(boss(page).getByTestId('boss-last')).toHaveText(`ล่าสุด: ${textOf(SEQ[0]!)}`);

  // A trap on the way: one heart gone.
  await playBelt(page, { trap: true });
  await expect(boss(page)).toHaveAttribute('data-phase', 'done');
  await expect(boss(page)).toHaveAttribute('data-hearts', '2');
  await expect(boss(page)).toHaveAttribute('data-at', String(SEQ.length));
  await expect(boss(page).getByTestId('senior-says')).toContainText(`ครบ ${SEQ.length} ขั้น`);
  await shot(page, 'boss-done', info.project.name);
  await boss(page).getByRole('button', { name: 'ดูผล' }).click({ force: true });
  // Both rounds right at once, one heart lost: three stars.
  await expect(box(page).locator('.order-stars')).toHaveAttribute('aria-label', 'ได้ 3 ดาว จาก 3');
  await expect(box(page).getByTestId('order-result')).toContainText('สายพานงานซ่อม: เสียหัวใจ 1 ดวง');
  expect((await saved(page)).order.first).toEqual({ tries: [1, 1], solved: [true, true], lost: 1 });
});

test('the senior explains each mistake: a trap, a step too early; three hearts gone and the belt starts over', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the belt itself is checked at every size above');
  await seed(page, { learner: LEARNER, pre: PRE_DONE });
  await page.goto('/?seed=b2');
  await toBoss(page);
  await startBelt(page);
  const say = boss(page).getByTestId('boss-say');
  const trapCard = boss(page).locator(TRAPS.map((id) => `.boss-card[data-step="${id}"]`).join(', '));
  const early = boss(page).locator(
    SEQ.slice(1)
      .map((id) => `.boss-card[data-step="${id}"]`)
      .join(', '),
  );
  for (let i = 0; i < 200 && !(await trapCard.count()); i++) await page.clock.runFor(250);
  const trapId = (await trapCard.first().getAttribute('data-step'))!;
  await trapCard.first().click({ force: true });
  await expect(say).toHaveText(`พี่ช่าง: ไม่ได้นะ! ${orderData.traps.find((t) => t.id === trapId)!.whyTh}`);
  await expect(boss(page)).toHaveAttribute('data-hearts', '2');
  for (let i = 0; i < 200 && !(await early.count()); i++) await page.clock.runFor(250);
  const earlyId = (await early.first().getAttribute('data-step'))!;
  await early.first().click({ force: true });
  await expect(say).toHaveText(`พี่ช่าง: "${textOf(earlyId)}" ยังไม่ถึงคิว ตอนนี้ต้อง "${textOf(SEQ[0]!)}" ก่อน`);
  await expect(boss(page)).toHaveAttribute('data-hearts', '1');
  // Nothing tapped from here: the first step reaches the front edge and falls.
  for (let i = 0; i < 200 && (await boss(page).getAttribute('data-phase')) === 'run'; i++) await page.clock.runFor(250);
  await expect(boss(page)).toHaveAttribute('data-phase', 'out');
  await expect(boss(page).getByRole('alert')).toContainText('หัวใจหมดแล้ว');
  await boss(page).getByRole('button', { name: 'ลองสายพานอีกครั้ง' }).click({ force: true });
  await expect(boss(page)).toHaveAttribute('data-hearts', '3');
  await expect(boss(page)).toHaveAttribute('data-at', '0');
  await expect(boss(page)).toHaveAttribute('data-phase', 'run');
});

test('a dropped step: the senior says it fell and will come round again', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the belt itself is checked at every size above');
  await seed(page, { learner: LEARNER, pre: PRE_DONE });
  await page.goto('/?seed=b3');
  await toBoss(page);
  await startBelt(page);
  for (let i = 0; i < 100 && (await boss(page).getAttribute('data-hearts')) === '3'; i++) await page.clock.runFor(250);
  await expect(boss(page).getByTestId('boss-say')).toHaveText(`พี่ช่าง: "${textOf(SEQ[0]!)}" หลุดไปแล้ว! ขั้นนี้ต้องทำตอนนี้ เดี๋ยวมันวนกลับมา`);
});

test('slow mode: the belt runs slower; it is on from the start when the device asks for less motion', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the belt itself is checked at every size above');
  await seed(page, { learner: LEARNER, pre: PRE_DONE });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=b4');
  await toBoss(page);
  const slow = boss(page).getByRole('button', { name: '🐢 โหมดช้า' });
  await expect(slow).toHaveAttribute('aria-pressed', 'true');
  await startBelt(page);
  const start = (await where(page, SEQ[0]!)).top;
  await page.clock.runFor(2000);
  // 2 s at 0.06 belt widths a second.
  const slowed = (await where(page, SEQ[0]!)).top;
  expect(slowed).toBeCloseTo(topAfter(start, 0.12), 0);
  await slow.click({ force: true });
  await expect(slow).toHaveAttribute('aria-pressed', 'false');
  await page.clock.runFor(1000);
  // 1 s more at 0.1.
  expect((await where(page, SEQ[0]!)).top).toBeCloseTo(topAfter(slowed, 0.1), 0);
});
