// Case 3 (Lung Chai, "red text") in the shop, played start to finish like a student would
// (docs/case3-plan.md task E): Windows 11 Setup to the install, the backup question, and the traps.
// ?seed= fixes his machine: s4 has the product key sticker, s1 has no key. Screenshots go to test-results/.

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectStage } from './helpers';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const body = (page: Page) => page.locator('body');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true }).click();
const row = (page: Page, id: string) => page.locator(`[data-part="${id}"]`);
const says = (page: Page) => page.getByTestId('customer-says');
const KEY_SEED = 's4';
const NO_KEY_SEED = 's1';

/** Lung Chai's case up to the repair stage, with the right guess. */
async function toRepair(page: Page, seed: string, info?: TestInfo) {
  await page.goto(`/?case=c03-red-text&seed=${seed}`);
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('ลุงชัย');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  if (info) await shot(page, info, 'e1-ticket');
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await expect(page.getByTestId('error-photo')).toContainText('The selected disk has an MBR partition table');
  if (info) await shot(page, info, 'e2-photo');
  await page.getByRole('button', { name: 'ดิสก์เป็น MBR แต่เครื่องบูตแบบ UEFI' }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await expectStage(page, 'repair');
}

/** Opens his PC, lets POST boot the stick (it is first already), presses a key: Setup's first page. */
async function bootSetup(page: Page) {
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'press-any-key');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-setup-page', 'language');
}

/** Language, keyboard, the box, the key (or none and an edition), the license: the partition page. */
async function toLocation(page: Page, o: { key: boolean; edition?: string }) {
  await next(page);
  await next(page);
  await page.getByRole('checkbox', { name: 'I agree everything' }).check();
  await next(page);
  if (o.key) await page.getByTestId('product-key').click();
  else {
    await page.getByRole('button', { name: "I don't have a product key" }).click();
    await page.getByRole('option', { name: o.edition ?? 'Windows 11 Home', exact: true }).click();
  }
  await next(page);
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(body(page)).toHaveAttribute('data-setup-page', 'location');
}

async function deletePart(page: Page, id: string) {
  await row(page, id).click();
  await page.getByRole('button', { name: 'Delete Partition' }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
}

/** The free space, Next, Install, and wait for the install to finish. */
async function install(page: Page) {
  await row(page, '1-free').click();
  await next(page);
  await page.getByRole('button', { name: 'Install' }).click();
  await expect(body(page)).toHaveAttribute('data-setup-page', 'done', { timeout: 10_000 });
}

/** Back at the counter: his question, then the summary. */
async function finish(page: Page) {
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /ต้องลบเพื่อให้ตัวติดตั้งทำดิสก์เป็น GPT/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
}
const stars = (page: Page) => page.getByRole('group', { name: 'สรุปผล' }).locator('.stars');

test("Lung Chai's whole repair with the key: the photo, ask about the backup, delete both partitions, install; 3 stars", async ({ page }, info) => {
  await toRepair(page, KEY_SEED, info);
  // The ticket said "the customer says it is backed up"; the technician asks anyway.
  await page.getByRole('button', { name: 'ถามเรื่องสำรองข้อมูล' }).click();
  await expect(says(page)).toContainText('ก๊อปใส่แฟลชไดรฟ์ไว้หมดแล้ว');
  await expect(page.getByRole('button', { name: 'ถามเรื่องสำรองข้อมูล' }), 'asked once').toHaveCount(0);
  await expect(page.getByRole('button', { name: 'เปิดโน้ตบุ๊กร้าน' }), 'no laptop: his stick is fine').toHaveCount(0);
  await shot(page, info, 'e3-repair');

  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await bootSetup(page);
  await expect(says(page)).toContainText('หลานลุงทำมาถึงตรงนี้');
  await expect(page.getByTestId('pc-win'), 'reaching Setup is not the fix in case 3').toHaveCount(0);
  await toLocation(page, { key: true });
  await row(page, '1-2').click();
  await expect(page.getByTestId('setup-error')).toBeVisible();
  await shot(page, info, 'e4-red-text');
  await deletePart(page, '1-2');
  await deletePart(page, '1-1');
  await install(page);
  await expect(page.getByTestId('pc-win')).toBeVisible();
  await expect(says(page)).toContainText('ตัวแดงหายไปแล้ว');
  await shot(page, info, 'e5-installed');

  await finish(page);
  await expect(stars(page)).toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(page.getByTestId('goodbye')).toContainText('เก่งจริง เร็วด้วย');
  await expect(page.locator('.techlog')).toContainText('หนังสือ น.47, 55');
  await shot(page, info, 'e6-summary');
});

test('no key: "I don\'t have a product key", the edition from the ticket, asked about the backup while Setup is open', async ({ page }) => {
  await toRepair(page, NO_KEY_SEED);
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await bootSetup(page);
  await toLocation(page, { key: false });
  // The ask button under the PC works with Setup on screen.
  await page.getByRole('button', { name: 'ถามเรื่องสำรองข้อมูล' }).click();
  await expect(says(page)).toContainText('ลบได้เลย');
  await deletePart(page, '1-2');
  await deletePart(page, '1-1');
  await expect(page.locator('.pc-status')).not.toContainText('นับว่าพลาด');
  await install(page);
  await finish(page);
  await expect(stars(page)).toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(page.locator('.lost')).toHaveText('ซ่อมได้ไม่พลาดเลย');
  await expect(page.locator('.techlog')).toContainText("I don't have a product key");
});

test('another edition without a key: installs with no mistake, and the tech log says why it will not activate', async ({ page }) => {
  await toRepair(page, NO_KEY_SEED);
  await page.getByRole('button', { name: 'ถามเรื่องสำรองข้อมูล' }).click();
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await bootSetup(page);
  await toLocation(page, { key: false, edition: 'Windows 11 Pro' });
  await deletePart(page, '1-2');
  await deletePart(page, '1-1');
  await install(page);
  await finish(page);
  await expect(stars(page)).toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(page.locator('.techlog')).toContainText('เลือกรุ่น Windows ไม่ตรงกับที่เครื่องเคยใช้');
});

test('both traps: wiping before asking, then deleting the stick; Lung reacts, the laptop remakes it, Setup again, install; 2 stars', async ({
  page,
}, info) => {
  await toRepair(page, KEY_SEED);
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await bootSetup(page);
  await toLocation(page, { key: true });

  // Trap 1: Delete before asking. Lung stops him (his files happen to be backed up).
  await deletePart(page, '1-2');
  await expect(says(page)).toContainText('ยังไม่ถามลุงเลยว่าเก็บข้อมูลไว้หรือยัง');
  await expect(page.locator('.pc-status')).toContainText('ก่อนถามลูกค้าเรื่องสำรองข้อมูล');

  // Trap 2: delete the stick's own partition. Setup loses its files; the laptop comes out.
  await deletePart(page, '0-1');
  await expect(body(page)).toHaveAttribute('data-setup-page', 'media-error');
  await expect(says(page)).toContainText('แฟลชไดรฟ์ที่หลานทำให้พังแล้วเหรอ');
  await shot(page, info, 'e7-wiped');
  await page.getByRole('button', { name: 'โน้ตบุ๊กร้าน', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Rufus' }).getByRole('combobox', { name: 'Device' })).toHaveText('NO_LABEL (E:) [16 GB]');
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: 'Win11_24H2_Thai_x64.iso' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('group', { name: 'Rufus' }).getByLabel('Partition scheme').selectOption('GPT');
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('usb-note')).toContainText('เสียบกลับเครื่องลุงชัยให้แล้ว', { timeout: 8000 });

  // Back on his PC: the new stick boots Setup again; his old Windows is gone, so the disk is free space.
  await page.getByRole('button', { name: 'ไปที่เครื่องลูกค้า' }).click();
  await bootSetup(page);
  await toLocation(page, { key: true });
  await expect(row(page, '1-1')).toHaveCount(0);
  await install(page);
  await finish(page);
  await expect(stars(page)).toHaveAttribute('aria-label', '2 ดาว จาก 3');
  await expect(page.locator('.lost')).toContainText('ลงมือพลาด 2 ครั้ง');
});

test('Setup in the shop fits: the partition page, the ask and hint buttons all reachable without sideways scrolling', async ({ page }, info) => {
  await toRepair(page, KEY_SEED);
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await bootSetup(page);
  await toLocation(page, { key: true });
  await row(page, '1-2').click();
  for (const b of [
    page.getByRole('button', { name: 'Next', exact: true }),
    page.getByRole('button', { name: 'Delete Partition' }),
    page.getByRole('button', { name: 'ถามเรื่องสำรองข้อมูล' }),
    page.getByRole('button', { name: /คำใบ้/ }),
  ]) {
    await b.scrollIntoViewIfNeeded();
    await expect(b).toBeInViewport();
  }
  const pcHeight = (await page.locator('.pc').boundingBox())!.height;
  expect(pcHeight, 'the Setup screen keeps a usable height under the footer').toBeGreaterThanOrEqual(200);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sideways).toBeLessThanOrEqual(0);
  await shot(page, info, 'e8-fit');
});

test('rotating the phone in the middle of Setup keeps the page, the selection and the deleted partitions', async ({ page }) => {
  await toRepair(page, KEY_SEED);
  await page.getByRole('button', { name: 'ถามเรื่องสำรองข้อมูล' }).click();
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await bootSetup(page);
  await toLocation(page, { key: true });
  await deletePart(page, '1-2');
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await expect(body(page)).toHaveAttribute('data-setup-page', 'location');
  await expect(row(page, '1-free')).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, '1-2')).toHaveCount(0);
});
