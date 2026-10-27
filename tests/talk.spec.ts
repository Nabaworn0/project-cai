// Talks with the senior technician (docs/learning-page-plan.md task D, src/ui/case/TalkBox.tsx): he walks over from
// his bench, the lines go one tap at a time with the speaker's face, he walks back, then the customer comes in.
// The welcome plays once, each case's talk on its first visit; both can be replayed; ?case= links have none.

import { expect, test, type Page } from '@playwright/test';
import cutscenes from '../src/content/data/cutscenes.json' with { type: 'json' };
import { expectStage, LEARNER, openShop, passMenu, playCase1, skipTalk } from './helpers';

const talk = (page: Page) => page.getByTestId('talk');
const body = (page: Page) => page.locator('body');
const linesOf = (id: string) => cutscenes.scenes.find((s) => s.id === id)!.lines;
const seen = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('shop.progress.v2') ?? '{}').seen ?? []);
const NAME = { senior: 'พี่ช่าง', intern: 'เด็กฝึกงาน (คุณ)' } as const;

/** Taps through every line, checking each one's speaker, text and face. */
async function readAll(page: Page, lines: { who: 'senior' | 'intern'; face?: string; th: string }[]) {
  for (const [i, l] of lines.entries()) {
    await expect(talk(page).locator('.says')).toHaveText(`“${l.th}”`);
    await expect(talk(page).locator('.speaker')).toHaveText(NAME[l.who]);
    await expect(talk(page).locator('.talk-count')).toHaveText(`${i + 1}/${lines.length}`);
    if (l.who === 'senior') await expect(body(page)).toHaveAttribute('data-senior-face', l.face ?? 'neutral');
    else await expect(body(page)).toHaveAttribute('data-expression', l.face ?? 'neutral');
    const last = i + 1 === lines.length;
    await expect(talk(page).getByRole('button', { name: 'ข้าม' })).toHaveCount(last ? 0 : 1);
    await talk(page)
      .getByRole('button', { name: last ? 'เริ่มงาน' : 'ต่อไป' })
      .click();
  }
}

test('the first time in the shop: the senior walks over, the welcome and the case 1 talk, he walks back, then Somsri comes in', async ({
  page,
}, info) => {
  await page.goto('/');
  await passMenu(page);
  await expect(body(page)).toHaveAttribute('data-case-stage', 'talk');
  await expect(body(page)).toHaveAttribute('data-senior', 'here', { timeout: 8000 });
  // He left his stool in the back-room window empty.
  await expect(body(page)).toHaveAttribute('data-workshop', 'empty');
  await expect(page.locator('.case-panel:not(.talk)')).toHaveCount(0);
  // Nobody walks in while they talk.
  await expect(body(page)).not.toHaveAttribute('data-customer-mood', /./);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/talk-${info.project.name}.png` });
  await readAll(page, [...linesOf('intro'), ...linesOf('c01-boot-order')] as never);
  await expect(body(page)).toHaveAttribute('data-senior', 'away', { timeout: 8000 });
  await expect(body(page)).toHaveAttribute('data-workshop', 'busy');
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('ป้าสมศรี');
  expect(await seen(page)).toEqual(['intro', 'c01-boot-order']);

  // Seen once: next time straight to the customer.
  await page.reload();
  await page
    .getByTestId('menu')
    .getByRole('button', { name: /^ทำต่อ/ })
    .click();
  await expectStage(page, 'intro');
  await expect(talk(page)).toHaveCount(0);
});

test('"ข้าม" ends the talk at once and counts as seen', async ({ page }) => {
  await page.goto('/');
  await passMenu(page);
  await skipTalk(page);
  await expect(body(page)).toHaveAttribute('data-senior', 'away');
  expect(await seen(page)).toEqual(['intro', 'c01-boot-order']);
});

test("a case talk can be heard again from the customer's first line, and the customer stays", async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the talk box itself is checked at every size above');
  await openShop(page);
  await expectStage(page, 'intro');
  await page.getByRole('button', { name: 'ฟังพี่ช่างอีกครั้ง' }).click();
  await readAll(page, linesOf('c01-boot-order') as never);
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('ป้าสมศรี');
  await expect(body(page)).toHaveAttribute('data-customer', 'somsri');
});

test('the menu replays the welcome; a new case has its own talk the first time', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the talk box itself is checked at every size above');
  await page.addInitScript(
    (v) => !localStorage.getItem('seeded') && (localStorage.setItem('shop.progress.v2', v), localStorage.setItem('seeded', '1')),
    JSON.stringify({ learner: LEARNER, seen: ['intro', 'c01-boot-order'] }),
  );
  await page.goto('/');
  await page.getByTestId('menu').getByRole('button', { name: 'ดูฉากต้อนรับของพี่ช่างอีกครั้ง' }).click();
  await expect(talk(page).locator('.talk-count')).toHaveText(`1/${linesOf('intro').length}`, { timeout: 8000 });
  await skipTalk(page);

  // Case 1 done, then the next customer: Beam's talk comes first.
  await playCase1(page);
  await page.getByRole('button', { name: 'รับลูกค้าคนถัดไป' }).click();
  await expect(talk(page).locator('.talk-count')).toHaveText(`1/${linesOf('c02-rufus-scheme').length}`, { timeout: 8000 });
  await expect(talk(page)).toContainText('น้องบีม');
  await skipTalk(page);
  await expect(page.locator('.case-panel')).toContainText('น้องบีม');
});

test('leaving in the middle of a talk: back to the menu at once, the senior goes back, and the talk is not counted', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the talk box itself is checked at every size above');
  await page.goto('/');
  await passMenu(page);
  await expect(talk(page)).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: '☰ เมนู' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByTestId('menu')).toBeVisible();
  await expect(body(page)).toHaveAttribute('data-senior', 'away', { timeout: 8000 });
  expect(await seen(page)).toEqual([]);
});

test('?case= links have no talks', async ({ page }) => {
  await page.goto('/?case=c01-boot-order');
  await expectStage(page, 'intro');
  await expect(talk(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ฟังพี่ช่างอีกครั้ง' })).toHaveCount(0);
  // With the senior at his bench, his place at the counter stays free: the PC is right of it, not over the intern.
  const x = async (attr: string) => Number((await body(page).getAttribute(attr))!.split(',')[0]);
  await expect(body(page)).toHaveAttribute('data-senior-at', /,/);
  expect(await x('data-pc-at')).toBeGreaterThan(await x('data-senior-at'));
  expect(await x('data-senior-at')).toBeGreaterThan(await x('data-tech-at'));
});
