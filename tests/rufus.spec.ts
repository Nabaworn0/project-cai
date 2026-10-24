// Case 2 task C: the Rufus screen on the shop laptop and the wrong-boot screens, tried through the content
// viewer's "หน้าจอจำลอง" tab (before task D puts them in the shop). Screenshots go to test-results/.

import { expect, test, type Page, type TestInfo } from '@playwright/test';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const rufus = (page: Page) => page.getByRole('group', { name: 'Rufus' });

async function openLab(page: Page) {
  await page.goto('/?view=content#sims');
  await expect(page.getByRole('heading', { name: 'หน้าจอจำลอง' })).toBeVisible();
}

/** Opens Rufus, picks an image, sets the scheme, and writes the stick (OK on every dialog). */
async function makeStick(page: Page, iso: string, scheme: 'MBR' | 'GPT', info?: TestInfo) {
  await page.getByRole('button', { name: 'เปิด Rufus' }).click();
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: iso }).click();
  if (info) await shot(page, info, 'c2-picker');
  await page.getByRole('button', { name: 'Open' }).click();
  await rufus(page).getByLabel('Partition scheme').selectOption(scheme);
  if (info) await shot(page, info, 'c2-ready');
  await page.getByRole('button', { name: 'START' }).click();
  if (!iso.startsWith('ubuntu')) {
    await expect(page.getByRole('dialog', { name: 'Windows User Experience' })).toBeVisible();
    if (info) await shot(page, info, 'c2-customize');
    await page.getByRole('button', { name: 'OK' }).click();
  }
  await expect(page.getByRole('alertdialog', { name: 'Rufus' })).toContainText('WILL BE DESTROYED');
  if (info) await shot(page, info, 'c2-warning');
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('rufus-status')).toContainText('Copying ISO files');
  if (info) await shot(page, info, 'c2-copying');
  await expect(page.locator('body')).toHaveAttribute('data-rufus', 'done', { timeout: 8000 });
  await expect(page.getByTestId('rufus-status')).toHaveText('READY');
  await page.getByRole('button', { name: 'CLOSE' }).click();
}

/** Boots the lab PC from the current stick with the Boot Menu (F8, the stick is listed first). */
async function bootStick(page: Page) {
  await page.getByRole('button', { name: 'บูตด้วย USB นี้' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'post');
  for (const k of ['F8', 'Enter']) await page.locator(`.keybar [data-key="${k}"]`).click();
}

test('Rufus opens like Beam left it: his MBR stick, no image, START greyed out', async ({ page }, info) => {
  await openLab(page);
  await page.getByRole('button', { name: 'เปิด Rufus' }).click();
  const r = rufus(page);
  await expect(r.getByRole('combobox', { name: 'Device' })).toHaveText('CCCOMA_X64FRE_TH-TH_DV9 (E:) [16 GB]');
  await expect(r.getByLabel('Partition scheme')).toHaveValue('mbr');
  await expect(r.getByRole('combobox', { name: 'Target system' })).toHaveText('BIOS (or UEFI-CSM)');
  await expect(r.getByRole('combobox', { name: 'Boot selection' })).toHaveText('Disk or ISO image (Please select)');
  await expect(page.getByRole('button', { name: 'START' })).toBeDisabled();
  await r.getByLabel('Partition scheme').selectOption('GPT');
  await expect(r.getByRole('combobox', { name: 'Target system' })).toHaveText('UEFI (non CSM)');
  await shot(page, info, 'c2-open');
  // The whole window fits the screen's width, and START can be reached (the desktop scrolls if needed).
  const vp = page.viewportSize()!;
  const box = (await r.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
  await page.getByRole('button', { name: 'CLOSE' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'CLOSE' })).toBeInViewport();
});

test('the textbook way: Windows 11 image, GPT, START: the stick boots to Windows 11 Setup', async ({ page }, info) => {
  await openLab(page);
  await makeStick(page, 'Win11_24H2_Thai_x64.iso', 'GPT', info);
  await expect(page.getByTestId('lab-usb')).toContainText('GPT · Windows 11');
  await bootStick(page);
  await page.locator('.keybar [data-key="Enter"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup');
});

test('trap: MBR again: the stick is still missing from the Boot Menu', async ({ page }) => {
  await openLab(page);
  await makeStick(page, 'Win11_24H2_Thai_x64.iso', 'MBR');
  await page.getByRole('button', { name: 'บูตด้วย USB นี้' }).click();
  await page.locator('.keybar [data-key="F8"]').click();
  await expect(page.locator('.bootmenu')).not.toContainText('USB');
});

test('trap: the wrong image: Windows 10 Setup, or Ubuntu GRUB; each counts as a mistake', async ({ page }, info) => {
  await openLab(page);
  await makeStick(page, 'Win10_22H2_Thai_x64.iso', 'GPT');
  await bootStick(page);
  await page.locator('.keybar [data-key="Enter"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'setup-win10');
  await expect(page.locator('.pc-status')).toContainText('ไม่ใช่ Windows 11');
  await shot(page, info, 'c2-win10');
  await page.getByRole('button', { name: 'ปิด', exact: true }).click();

  await makeStick(page, 'ubuntu-24.04-desktop-amd64.iso', 'GPT');
  await expect(page.getByTestId('lab-usb')).toContainText('Ubuntu');
  await bootStick(page);
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'grub');
  await shot(page, info, 'c2-grub');
});

test('trap: CSM on makes the MBR stick boot, then "This PC can\'t run Windows 11"', async ({ page }, info) => {
  await openLab(page);
  await page.getByLabel('เปิด CSM Support ไว้แล้ว (กับดักเคส 2)').check();
  await bootStick(page);
  await page.locator('.keybar [data-key="Enter"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-pc-screen', 'cant-run');
  await expect(page.locator('.pc')).toContainText("This PC can't run Windows 11");
  await expect(page.locator('.pc-status')).toContainText('Legacy (CSM)');
  await shot(page, info, 'c2-cantrun');
});

test('Cancel on the warning writes nothing; Customize remembers a ticked box on the stick', async ({ page }) => {
  await openLab(page);
  await page.getByRole('button', { name: 'เปิด Rufus' }).click();
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: 'Win11_24H2_Thai_x64.iso' }).dblclick();
  await rufus(page).getByLabel('Partition scheme').selectOption('GPT');
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByLabel('Remove requirement for 4GB+ RAM, Secure Boot and TPM 2.0').check();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('rufus-status')).toHaveText('READY');
  await expect(page.locator('body')).toHaveAttribute('data-rufus', 'ready');
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByLabel('Remove requirement for 4GB+ RAM, Secure Boot and TPM 2.0').check();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-rufus', 'done', { timeout: 8000 });
  await page.getByRole('button', { name: 'CLOSE' }).click();
  await expect(page.getByTestId('lab-usb')).toContainText('ยกเลิกการตรวจ TPM/Secure Boot');
});
