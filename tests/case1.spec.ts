// Case 1 (Somsri, boot order) played start to finish like a student would (case1-plan task E/G):
// customer -> ticket -> guess the cause -> repair on the PC -> explain -> summary, on every screen size.
// Screenshots of each stage are saved in test-results/ for looking at by eye.

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { C1_DIAGNOSIS, expectStage, openShop, playToRepair } from './helpers';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const panel = (page: Page) => page.locator('.case-panel');

/** The customer's and the technician's faces are not hidden under the case panel or the HUD. */
async function facesVisible(page: Page) {
  for (const who of ['customerAt', 'techAt'] as const) {
    const [x, y] = (await page.evaluate((a) => document.body.dataset[a] ?? '', who)).split(',').map(Number) as [number, number];
    const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x, y });
    expect(top, `${who} is covered`).toBe('CANVAS');
  }
}

/** The textbook repair on the key bar: F2, Boot, Hard Disk Drives, 1st Drive = USB, F10, Ok, boot, any key. */
async function repairWithBios(page: Page) {
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  for (const k of ['F2', 'Right', 'Right', 'Right', 'Down', 'Down', 'Enter', 'Enter', 'Down', 'Enter', 'F10', 'Enter', 'Enter', 'Enter']) {
    await page.locator(`.keybar [data-key="${k}"]`).click();
  }
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
}

test('a perfect run: three stars, full coins, Somsri leaves happy, and the next customer walks in', async ({ page }, info) => {
  await openShop(page);
  await expectStage(page, 'intro');
  await expect(panel(page)).toContainText('ป้าสมศรี');
  await expect(panel(page)).toContainText('ป้าดูคลิปแล้วทำตาม');
  await facesVisible(page);
  await shot(page, info, '1-intro');

  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  const ticket = page.getByRole('group', { name: 'ใบรับงาน' });
  await expect(ticket).toContainText('ลง Windows 11');
  await expect(ticket).toContainText('BIOS คลาสสิก (AMI)');
  await expect(ticket, 'the ticket shows symptoms, never the cause').not.toContainText('Boot Device Priority');
  await facesVisible(page);
  await shot(page, info, '2-ticket');

  await page.getByRole('button', { name: 'รับงาน' }).click();
  await expectStage(page, 'diagnose');
  await page.getByRole('button', { name: C1_DIAGNOSIS }).click();
  await expect(panel(page).locator('.feedback')).toContainText('ถูกต้อง');
  await expect(page.getByRole('button', { name: C1_DIAGNOSIS })).toBeDisabled();
  await facesVisible(page);
  await shot(page, info, '3-diagnose');

  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await expectStage(page, 'repair');
  await facesVisible(page);
  await shot(page, info, '4-repair');
  await repairWithBios(page);
  await expect(page.locator('body')).toHaveAttribute('data-customer-mood', 'happy');
  await expect(page.getByTestId('customer-says')).toContainText('ขึ้นหน้าใหม่แล้ว!');
  await shot(page, info, '5-fixed');
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();

  await expectStage(page, 'explain');
  await expect(panel(page)).toContainText('ทำไมเสียบแล้วมันไม่ไปเองล่ะคะ');
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await expect(panel(page).locator('.feedback')).toContainText('ถูกต้อง');
  await facesVisible(page);
  await shot(page, info, '6-explain');
  await page.getByRole('button', { name: 'ต่อไป' }).click();

  await expectStage(page, 'summary');
  const summary = page.getByRole('group', { name: 'สรุปผล' });
  await expect(summary.locator('.stars')).toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(summary).toContainText('ซ่อมได้ไม่พลาดเลย');
  await expect(summary).toContainText('+150');
  await expect(summary).toContainText('หนังสือ น.48–51');
  await expect(page.getByTestId('goodbye')).toContainText('ไว้ป้าจะเอาขนมมาฝาก');
  await expect(page.getByTestId('coins')).toContainText('150');
  await expect(page.locator('body')).toHaveAttribute('data-customer-mood', 'happy');
  await facesVisible(page);
  await shot(page, info, '7-summary');

  await page.getByRole('button', { name: 'รับลูกค้าคนถัดไป' }).click();
  await expectStage(page, 'intro');
  await expect(page.getByTestId('coins'), 'coins are kept for the next customer').toContainText('150');
});

test('mistakes cost stars: wrong guess, two boots into the old Windows, wrong explanation; never below one star', async ({ page }) => {
  await playToRepair(page, 'แฟลชไดรฟ์เสีย');
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  // Two mistakes: Enter at POST boots the old Windows, twice. Somsri says something different each time.
  const said = ['ขึ้นหน้าเดิมอีกแล้วค่ะ', 'ป้าถ่ายรูปไว้ให้ดูไหมคะ'];
  for (let i = 0; i < 2; i++) {
    await page.locator('.keybar [data-key="Enter"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'old-windows');
    await expect(page.getByTestId('customer-says')).toContainText(said[i]!);
    await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  }
  // Then the Boot Menu shortcut, which is a full-marks route.
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await page.locator(`.keybar [data-key="${k}"]`).click();
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /แฟลชไดรฟ์ของป้าช้าเกินไป/ }).click();
  await expect(panel(page).locator('.feedback')).toContainText('ยังไม่ใช่');
  await page.getByRole('button', { name: 'ต่อไป' }).click();

  const summary = page.getByRole('group', { name: 'สรุปผล' });
  await expect(summary.locator('.stars')).toHaveAttribute('aria-label', '1 ดาว จาก 3');
  await expect(summary).toContainText('เดาสาเหตุผิด');
  await expect(summary).toContainText('ลงมือพลาด 2 ครั้ง');
  await expect(summary).toContainText('อธิบายให้ลูกค้าฟังไม่ถูก');
  await expect(page.getByTestId('goodbye')).toContainText('ใจหายใจคว่ำ');
  await expect(page.locator('body')).toHaveAttribute('data-customer-mood', 'angry');
});

test('hints: two per case, shown in the panel and on the PC, costing bonus coins but no stars', async ({ page }) => {
  await playToRepair(page);
  await page.getByRole('button', { name: 'คำใบ้ (2)' }).click();
  await expect(panel(page).getByRole('list', { name: 'คำใบ้' }).locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await page.getByRole('button', { name: 'คำใบ้ (1)' }).click();
  await expect(page.getByRole('dialog').getByRole('list', { name: 'คำใบ้' }).locator('li')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'คำใบ้ (0)' })).toBeDisabled();
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await page.locator(`.keybar [data-key="${k}"]`).click();
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  const summary = page.getByRole('group', { name: 'สรุปผล' });
  await expect(summary.locator('.stars')).toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(summary).toContainText('+100');
});

test('practice help: a tip before the PC, a Thai subtitle and lit F2/F8 at POST, a free nudge after the first mistake', async ({ page }, info) => {
  await playToRepair(page);
  await expect(panel(page).getByTestId('coach-tip')).toContainText('F2 เข้า BIOS');
  await facesVisible(page);
  await shot(page, info, 'coach-1-tip');

  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  const subtitle = page.getByTestId('pc-subtitle');
  await expect(subtitle).toContainText('กด F2 เพื่อเข้า BIOS');
  expect(parseFloat(await subtitle.evaluate((e) => getComputedStyle(e).fontSize)), 'Thai stays readable').toBeGreaterThanOrEqual(12);
  const sub = (await subtitle.boundingBox())!;
  const keysLine = (await page.locator('.post-keys').boundingBox())!;
  expect(sub.y, 'the subtitle does not cover the English line it translates').toBeGreaterThan(keysLine.y + keysLine.height);
  await expect(page.locator('.keybar .key.cue')).toHaveCount(2);
  await expect(page.locator('.keybar [data-key="F2"]')).toHaveClass(/cue/);
  await expect(page.locator('.keybar [data-key="F8"]')).toHaveClass(/cue/);
  await shot(page, info, 'coach-2-post');

  // The first mistake: the senior technician steps in, for free.
  await page.locator('.keybar [data-key="Enter"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'old-windows');
  await expect(subtitle).toHaveCount(0);
  await expect(page.locator('.keybar .key.cue')).toHaveCount(0);
  await expect(page.getByRole('dialog').getByTestId('coach-tip')).toContainText('รีสตาร์ตเครื่อง');
  await expect(page.getByRole('button', { name: 'คำใบ้ (2)' }), 'the nudge is not a hint').toBeVisible();
  await shot(page, info, 'coach-3-nudge');

  await page.getByRole('button', { name: 'ปิด' }).click();
  await expect(panel(page).getByTestId('coach-tip'), 'the tip before the PC is gone, the nudge stays').toHaveCount(1);
  await expect(panel(page).getByTestId('coach-tip')).toContainText('รีสตาร์ตเครื่อง');
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  for (const k of ['F8', 'Down', 'Enter', 'Enter']) await page.locator(`.keybar [data-key="${k}"]`).click();
  await expect(page.getByRole('dialog').getByTestId('coach-tip'), 'gone once fixed').toHaveCount(0);
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  const summary = page.getByRole('group', { name: 'สรุปผล' });
  await expect(summary.locator('.stars')).toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(summary).toContainText('+150');
});

test('the PC keeps its state when the monitor is closed and reopened, and only opens once the job is taken', async ({ page }) => {
  await openShop(page);
  await expectStage(page, 'intro');
  await page.evaluate(() => document.body.dataset.pcAt);
  const [x, y] = (await page.evaluate(() => document.body.dataset.pcAt!)).split(',').map(Number) as [number, number];
  await page.mouse.click(x, y);
  await expect(page.getByRole('dialog', { name: 'หน้าจอจำลอง' }), 'not before the job is taken').toHaveCount(0);

  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: C1_DIAGNOSIS }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await page.locator('.keybar [data-key="F2"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'bios');
  await page.getByRole('button', { name: 'ปิด' }).click();
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'bios');
});

test('two customers in a row with the real keyboard only, no console errors, and a double tap on "next customer"', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const round of [1, 2]) {
    if (round === 1) await playToRepair(page);
    else {
      await page.getByRole('button', { name: 'รับเรื่อง' }).click();
      await page.getByRole('button', { name: 'รับงาน' }).click();
      await page.getByRole('button', { name: C1_DIAGNOSIS }).click();
      await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
    }
    await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
    // The textbook route typed on the keyboard (no on-screen keys).
    for (const k of ['F2', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'Enter', 'Enter', 'ArrowDown', 'Enter', 'F10', 'Enter', 'Enter', 'x']) {
      await page.keyboard.press(k);
    }
    await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
    await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
    await page.getByRole('button', { name: /เครื่องเลือกบูตตามลำดับที่ตั้งไว้ใน BIOS/ }).click();
    await page.getByRole('button', { name: 'ต่อไป' }).click();
    await expectStage(page, 'summary');
    await expect(page.getByTestId('coins')).toContainText(String(150 * round));
    const next = page.getByRole('button', { name: 'รับลูกค้าคนถัดไป' });
    await next.click();
    if (round === 1) await next.click({ timeout: 1000 }).catch(() => undefined); // a second tap while she walks out
    await expectStage(page, 'intro');
  }
  await expect(page.getByTestId('coins'), 'one new case per tap, coins counted once each').toContainText('300');
  expect(errors).toEqual([]);
});

test('rotating the phone in the middle of the BIOS keeps the PC and the case where they were', async ({ page }) => {
  await playToRepair(page);
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  for (const k of ['F2', 'Right', 'Right', 'Right', 'Down', 'Down', 'Enter']) await page.locator(`.keybar [data-key="${k}"]`).click();
  await expect(page.locator('.bios-heading')).toHaveText('Hard Disk Drives');
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await expect(page.locator('.bios-heading')).toHaveText('Hard Disk Drives');
  await expect(page.locator('body')).toHaveAttribute('data-case-stage', 'repair');
  for (const el of await page.locator('.keybar .key').all()) {
    const b = (await el.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(vp.width + 0.5);
  }
  await page.getByRole('button', { name: 'ปิด' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-customer', 'somsri');
});
