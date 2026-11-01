// Free play's technician ranks (docs/phase3-plan.md task C, src/core/rank.ts): the rank and the way to the next one
// on free play's menu, the rank in the shop's HUD at every size, and the step up told on the summary of the job that
// earns it. The class mode has no ranks.

import { expect, test, type Page } from '@playwright/test';
import ranksJson from '../src/content/data/ranks.json' with { type: 'json' };
import { ALL_TALKS, expectStage, fixSomsriMixed, hasBadge, hudFits, openShop, takeSomsriMixed } from './helpers';

const free = (page: Page) => page.getByTestId('free-menu');
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};

/** Straight into free play with these jobs done (talks seen, the boot screen too). */
async function seedFree(page: Page, jobs: { count: number; three: number }) {
  await page.addInitScript((save) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('shop.boot.v1', '1');
    localStorage.setItem('shop.mode.v1', 'free');
    localStorage.setItem('shop.free.v1', save);
    localStorage.setItem('seeded', '1');
  }, JSON.stringify({ seen: ALL_TALKS, jobs: { ...jobs, pairs: [], problems: [] } }));
  await page.goto('/');
  await expect(free(page)).toBeVisible({ timeout: 15_000 });
}

test('the rank on free play\'s menu with the way to the next one, and in the HUD without crowding it', async ({ page }, info) => {
  await seedFree(page, { count: 7, three: 2 });
  const card = free(page).getByTestId('free-rank');
  await expect(card.getByTestId('rank-name')).toHaveText('ช่างผู้ช่วย');
  await expect(card).toContainText('ยศถัดไป: ช่างประจำร้าน');
  await hasBadge(card.locator('.free-rank-now'), 'assistant');
  expect((await card.locator('.free-rank-now .rank-badge').boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await hasBadge(card.locator('.free-rank-next'), 'regular');
  await expect(card.locator('[data-need="jobs"]')).toContainText('ซ่อมสำเร็จ 7/15 งาน');
  await expect(card.locator('[data-need="three"]')).toContainText('ได้ 3 ดาว 2/5 งาน');
  // (7/15 + 2/5) / 2, as a percentage.
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '43');
  await shot(page, 'rank-menu', info.project.name);

  // The HUD with the longest rank's name.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('shop.free.v1')!);
    localStorage.setItem('shop.free.v1', JSON.stringify({ ...save, jobs: { ...save.jobs, count: 15, three: 5 } }));
  });
  await page.reload();
  await expect(free(page).getByTestId('rank-name')).toHaveText('ช่างประจำร้าน', { timeout: 15_000 });
  await expect(free(page).getByTestId('free-rank').locator('[data-need]')).toHaveCount(4);
  await free(page).getByRole('button', { name: /เปิดร้านรับลูกค้า/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'shop', { timeout: 15_000 });
  await expect(page.getByTestId('hud-rank')).toHaveText('ช่างประจำร้าน');
  await expect(page.getByTestId('hud-rank')).toBeVisible();
  await hasBadge(page.getByTestId('hud-rank'), 'regular');
  // The rank's chip and the chips on the right stay apart, inside the screen; on phones the rank shows as its badge.
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
  await hudFits(page);
  const w = page.viewportSize()!.width;
  if (w > 400) await expect(page.locator('.hud .brand')).toBeVisible();
  if (w > 400 && w <= 520) expect((await page.locator('.hud .rank-name').boundingBox())!.width).toBeLessThanOrEqual(1);
  await shot(page, 'rank-hud', info.project.name);
});

test('the job that earns a rank tells it on the summary, with the senior\'s praise; the next customer does not', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the menu and HUD are checked at every size above');
  // Somsri with a stick made MBR, as in tests/free.spec.ts.
  await page.addInitScript(() => (Math.random = () => 0));
  await seedFree(page, { count: 4, three: 0 });
  await expect(free(page).getByTestId('rank-name')).toHaveText('เด็กฝึกงาน');
  await free(page).getByRole('button', { name: /เปิดร้านรับลูกค้า/ }).click();
  await expect(page.getByTestId('hud-rank')).toHaveText('เด็กฝึกงาน', { timeout: 15_000 });
  await hasBadge(page.getByTestId('hud-rank'), 'intern');
  await takeSomsriMixed(page);
  await fixSomsriMixed(page);

  const up = page.getByTestId('rank-up');
  await expect(up).toContainText('เลื่อนขั้นเป็น ช่างผู้ช่วย!');
  await hasBadge(up, 'assistant');
  await expect(up).toContainText(ranksJson.ranks[1]!.praiseTh!);
  await expect(page.getByTestId('hud-rank')).toHaveText('ช่างผู้ช่วย');
  await shot(page, 'rank-up', info.project.name);

  // The next customer (Beam, with Somsri's problem mixed in): his job earns no rank, so his summary tells none.
  await page.getByRole('button', { name: 'รับลูกค้าคนถัดไป' }).click();
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('น้องบีม');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: 'USB ทำแบบ MBR แต่เครื่องบูตแบบ UEFI' }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await expectStage(page, 'repair');
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
  // USB not first in his BIOS either: the Boot Menu picks it for this boot.
  await page.locator('.keybar [data-key="F8"]').click();
  const items = await page.locator('.bootmenu li').allInnerTexts();
  const usb = items.findIndex((t) => t.includes('UEFI: USB'));
  expect(usb).toBeGreaterThan(0);
  for (let k = 0; k < usb; k++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /คลิปทำสำหรับเครื่องเก่าที่บูตแบบ BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
  await expect(page.getByTestId('rank-up')).toHaveCount(0);
  await expect(page.getByTestId('hud-rank')).toHaveText('ช่างผู้ช่วย');
});

test('the class mode has no rank, and its HUD fits at every size', async ({ page }, info) => {
  await openShop(page);
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
  await expect(page.getByTestId('hud-rank')).toHaveCount(0);
  // The shop's name on wide screens; on phones the sign in the scene names it and the chip is read out only.
  if (page.viewportSize()!.width > 520) await expect(page.locator('.hud .brand')).toBeVisible();
  await expect(page.locator('.hud .brand')).toContainText('ร้านซ่อมคอม');
  await hudFits(page);
  await shot(page, 'class-hud', info.project.name);
});
