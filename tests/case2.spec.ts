// Case 2 (Beam, Rufus) in the shop: the laptop on the counter, both machines during the repair, and the
// stick moving from Rufus back into Beam's PC (docs/case2-plan.md task D). Started with ?case=, since the
// order of customers (case 1 then 2) comes with task E. Screenshots go to test-results/.

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectStage } from './helpers';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const key = (page: Page, k: string) => page.locator(`.keybar [data-key="${k}"]`).click();
const tapAt = async (page: Page, attr: 'laptopAt' | 'pcAt') => {
  const [x, y] = (await page.evaluate((a) => document.body.dataset[a]!, attr)).split(',').map(Number) as [number, number];
  await page.mouse.click(x, y);
};

/** Beam's case up to the repair, with the right guess. */
async function toRepair(page: Page) {
  await page.goto('/?case=c02-rufus-scheme');
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('น้องบีม');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: 'USB ทำแบบ MBR แต่เครื่องบูตแบบ UEFI' }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await expectStage(page, 'repair');
}

/** In Rufus: the Windows 11 image, GPT, START, OK, OK, and wait for READY. */
async function remakeStick(page: Page) {
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: 'Win11_24H2_Thai_x64.iso' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('group', { name: 'Rufus' }).getByLabel('Partition scheme').selectOption('GPT');
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('usb-note')).toBeVisible({ timeout: 8000 });
}

test('the laptop sits on the counter, not hidden under the case panel, and only opens once the job is taken', async ({ page }, info) => {
  await page.goto('/?case=c02-rufus-scheme');
  await expectStage(page, 'intro');
  await shot(page, info, 'd1-counter');
  await tapAt(page, 'laptopAt');
  await expect(page.getByRole('dialog', { name: 'โน้ตบุ๊กของร้าน' })).toHaveCount(0);
  await toRepair(page);
  // Right of the PC in portrait, at the left end of the counter in landscape (the panel covers the right).
  const [lx, ly] = (await page.evaluate(() => document.body.dataset.laptopAt!)).split(',').map(Number) as [number, number];
  const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x: lx, y: ly });
  expect(top, 'nothing covers the laptop during the repair').toBe('CANVAS');
});

test("Beam's whole repair: his stick is missing at F8, Rufus remakes it GPT, it boots Setup; 3 stars", async ({ page }, info) => {
  await toRepair(page);
  await expect(page.getByRole('button', { name: 'เปิดโน้ตบุ๊กร้าน' })).toBeVisible();
  await shot(page, info, 'd2-repair');

  // His PC first: the Boot Menu does not list the stick.
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await key(page, 'F8');
  await expect(page.locator('.bootmenu')).not.toContainText('USB');
  await key(page, 'Esc'); // boots the old Windows: a mistake (the first one is free)
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'old-windows');

  // Over to the laptop from the PC's own button, remake the stick.
  await page.getByRole('button', { name: 'โน้ตบุ๊กร้าน' }).click();
  await expect(page.getByRole('dialog', { name: 'โน้ตบุ๊กของร้าน' })).toBeVisible();
  await remakeStick(page);
  await expect(page.getByTestId('usb-note')).toContainText('เสียบกลับเครื่องน้องบีมให้แล้ว');
  await shot(page, info, 'd3-written');

  // Back to his PC: it starts again from POST with the new stick, which F8 now lists first.
  await page.getByRole('button', { name: 'ไปที่เครื่องลูกค้า' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'post');
  await key(page, 'F8');
  await expect(page.locator('.bootmenu li').first()).toHaveText('UEFI: USB Flash Disk 16GB');
  await key(page, 'Enter');
  await key(page, 'Enter');
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
  await expect(page.getByRole('button', { name: 'โน้ตบุ๊กร้าน' }), 'no laptop button once fixed').toHaveCount(0);
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();

  await page.getByRole('button', { name: /คลิปทำสำหรับเครื่องเก่าที่บูตแบบ BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
  await expect(page.getByRole('group', { name: 'สรุปผล' }).locator('.stars')).toHaveAttribute('aria-label', '3 ดาว จาก 3');
});

test('tapping the laptop on the counter opens Rufus too, and Rufus keeps its state when closed and reopened', async ({ page }) => {
  await toRepair(page);
  await tapAt(page, 'laptopAt');
  await expect(page.getByRole('dialog', { name: 'โน้ตบุ๊กของร้าน' })).toBeVisible();
  await page.getByRole('group', { name: 'Rufus' }).getByLabel('Partition scheme').selectOption('GPT');
  await page.getByRole('button', { name: 'CLOSE' }).click();
  await expectStage(page, 'repair');
  await page.getByRole('button', { name: 'เปิดโน้ตบุ๊กร้าน' }).click();
  await expect(page.getByRole('group', { name: 'Rufus' }).getByLabel('Partition scheme')).toHaveValue('gpt');
});

test('a stick written before the PC was ever opened is the one the PC boots', async ({ page }) => {
  await toRepair(page);
  await page.getByRole('button', { name: 'เปิดโน้ตบุ๊กร้าน' }).click();
  await remakeStick(page);
  await page.getByRole('button', { name: 'ไปที่เครื่องลูกค้า' }).click();
  await key(page, 'F8');
  await expect(page.locator('.bootmenu')).toContainText('UEFI: USB Flash Disk 16GB');
});

test('case 1 has no laptop button and tapping the laptop there does nothing', async ({ page }) => {
  await page.goto('/');
  await expectStage(page, 'intro');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: 'เครื่องตั้งให้บูตจากฮาร์ดดิสก์ก่อน USB' }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await expectStage(page, 'repair');
  await expect(page.getByRole('button', { name: 'เปิดโน้ตบุ๊กร้าน' })).toHaveCount(0);
  await tapAt(page, 'laptopAt');
  await expect(page.getByRole('dialog', { name: 'โน้ตบุ๊กของร้าน' })).toHaveCount(0);
});

test("Beam's own words on a wrong image, and the tech log notes a stick made with the Windows 11 checks removed", async ({ page }, info) => {
  await toRepair(page);
  await expect(page.locator('.case-panel')).not.toContainText('ใช้ประโยคกลาง');
  // First a Windows 10 stick: he notices.
  await page.getByRole('button', { name: 'เปิดโน้ตบุ๊กร้าน' }).click();
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: 'Win10_22H2_Thai_x64.iso' }).dblclick();
  await page.getByRole('group', { name: 'Rufus' }).getByLabel('Partition scheme').selectOption('GPT');
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('usb-note')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'ไปที่เครื่องลูกค้า' }).click();
  for (const k of ['F8', 'Enter', 'Enter']) await key(page, k);
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup-win10');
  await expect(page.getByTestId('customer-says')).toContainText('นี่มันไม่ใช่ Windows 11 นะ');
  await shot(page, info, 'e1-wrong-image');

  // Then the right image, with "Remove requirement … TPM 2.0" ticked.
  await page.getByRole('button', { name: 'โน้ตบุ๊กร้าน' }).click();
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: 'Win11_24H2_Thai_x64.iso' }).dblclick();
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByLabel('Remove requirement for 4GB+ RAM, Secure Boot and TPM 2.0').check();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('usb-note')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'ไปที่เครื่องลูกค้า' }).click();
  for (const k of ['F8', 'Enter', 'Enter']) await key(page, k);
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /คลิปทำสำหรับเครื่องเก่าที่บูตแบบ BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  const summary = page.getByRole('group', { name: 'สรุปผล' });
  await expect(summary.locator('.techlog')).toContainText('ไมโครซอฟต์ไม่รองรับ');
  await expect(summary.locator('.stars'), 'one mistake is free; the ticked box costs nothing').toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(summary).toContainText('พลาด 1 ครั้ง (ครั้งแรกไม่เสียดาว)');
  await shot(page, info, 'e2-summary');
});

/** In Rufus from the PC or the panel: write a stick with this image and scheme, then go back to Beam's PC. */
async function writeStick(page: Page, iso: string, scheme: 'MBR' | 'GPT') {
  await page.getByRole('button', { name: /^(โน้ตบุ๊กร้าน|เปิดโน้ตบุ๊กร้าน)$/ }).click();
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: iso }).dblclick();
  await page.getByRole('group', { name: 'Rufus' }).getByLabel('Partition scheme').selectOption(scheme);
  await page.getByRole('button', { name: 'START' }).click();
  if (!iso.startsWith('ubuntu')) await page.getByRole('button', { name: 'OK' }).click(); // Customize
  await page.getByRole('button', { name: 'OK' }).click(); // the wipe warning
  await expect(page.getByTestId('usb-note')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'ไปที่เครื่องลูกค้า' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'post');
}

test('every trap in the shop: MBR again, Ubuntu, CSM; each counts, Beam reacts, and 3 mistakes cost a star', async ({ page }, info) => {
  await toRepair(page);
  const says = page.getByTestId('customer-says');

  // 1. MBR again: the stick is still not in the Boot Menu; picking Windows Boot Manager boots the old Windows.
  await writeStick(page, 'Win11_24H2_Thai_x64.iso', 'MBR');
  await key(page, 'F8');
  await expect(page.locator('.bootmenu')).not.toContainText('USB');
  await key(page, 'Enter');
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'old-windows');
  await expect(says).toContainText('ผมบอกแล้วว่าแฟลชไดรฟ์ปลอม');

  // 2. Ubuntu: GRUB straight away.
  await writeStick(page, 'ubuntu-24.04-desktop-amd64.iso', 'GPT');
  for (const k of ['F8', 'Enter']) await key(page, k);
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'grub');
  await expect(says).toContainText('นี่มันไม่ใช่ Windows 11');

  // 3. CSM: an MBR stick boots once CSM is on, then Windows 11 refuses.
  await writeStick(page, 'Win11_24H2_Thai_x64.iso', 'MBR');
  for (const k of ['F2', 'Right', 'Right', 'Right', 'Enter', 'Plus', 'F10', 'Enter', 'Enter', 'Enter']) await key(page, k);
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'cant-run');
  await expect(says).toContainText('ลง 11 ไม่ได้เหรอพี่');
  await shot(page, info, 'f1-cantrun');

  // The fix: restart, CSM off again, a GPT Windows 11 stick, F8.
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  for (const k of ['F2', 'Right', 'Right', 'Right', 'Enter', 'Plus', 'F10', 'Enter']) await key(page, k);
  await writeStick(page, 'Win11_24H2_Thai_x64.iso', 'GPT');
  for (const k of ['F8', 'Enter', 'Enter']) await key(page, k);
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /คลิปทำสำหรับเครื่องเก่าที่บูตแบบ BIOS/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  const summary = page.getByRole('group', { name: 'สรุปผล' });
  await expect(summary).toContainText('ลงมือพลาด 3 ครั้ง');
  await expect(summary.locator('.stars')).toHaveAttribute('aria-label', '2 ดาว จาก 3');
  await expect(page.getByTestId('goodbye')).toContainText('ไปบอกเพื่อนที่ทำตามคลิปเดียวกัน');
});
