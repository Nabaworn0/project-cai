// Case 5 task C: Windows 11's first-time setup and the desktop on Teacher Wilai's lab PC, tried through the
// content viewer's "หน้าจอจำลอง" tab (before task D puts the case in the shop). Screenshots go to test-results/.

import { expect, test, type Page, type TestInfo } from '@playwright/test';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const body = (page: Page) => page.locator('body');
const pcButton = (page: Page, name: string) => page.locator('.pc').getByRole('button', { name, exact: true });
const oobePage = (page: Page, p: string) => expect(body(page)).toHaveAttribute('data-oobe-page', p, { timeout: 10_000 });

/** Nothing on the screen scrolls sideways, and on touch screens every control is at least 32px tall. */
async function checkFit(page: Page, touch: boolean) {
  const r = await page.evaluate(() => {
    const scr = document.querySelector('.oobe-screen, .w11-desktop') as HTMLElement;
    const small = [...document.querySelectorAll('.pc button, .pc input, .oobe-actions button')]
      .filter((e) => (e as HTMLElement).offsetParent && e.getBoundingClientRect().height < 31.5)
      .map((e) => e.textContent || e.getAttribute('aria-label'));
    return { sideways: scr.scrollWidth - scr.clientWidth, small };
  });
  expect(r.sideways, 'no sideways scrolling').toBeLessThanOrEqual(1);
  if (touch) expect(r.small, 'touch targets').toEqual([]);
}

test('first-time setup page by page to the desktop: Thai keyboard, the cable, the name rules, the customer signs in, privacy', async ({
  page,
}, info) => {
  const touch = info.project.name !== 'desktop';
  await page.goto('/?view=content#sims');
  await page.getByLabel('ข้ามไปหน้าตั้งค่าเริ่มต้นเลย (ติดตั้งเสร็จแล้ว)').check();
  await page.getByRole('button', { name: 'เปิดเครื่องครูวิไล' }).click();
  await oobePage(page, 'region');
  await expect(page.locator('.keybar')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Is this the right country or region?' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'United States' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('option', { name: 'Thailand' }).click();
  await checkFit(page, touch);
  await pcButton(page, 'Yes').click();
  await oobePage(page, 'keyboard');
  await pcButton(page, 'Yes').click();
  await oobePage(page, 'second-keyboard');
  await pcButton(page, 'Add layout').click();
  await page.getByRole('option', { name: 'Thai Kedmanee' }).click();
  await pcButton(page, 'Add layout').click();

  await oobePage(page, 'network');
  await expect(pcButton(page, 'Next')).toBeDisabled();
  await expect(page.getByTestId('oobe-ethernet')).toContainText('Network cable unplugged');
  await page.getByRole('button', { name: 'เสียบสายแลน' }).click();
  await expect(page.getByTestId('oobe-ethernet')).toContainText('Connected');
  await pcButton(page, 'Next').click();
  await oobePage(page, 'updates');
  await oobePage(page, 'name');

  await page.getByTestId('oobe-name').fill('LAB PC01');
  await expect(page.locator('.oobe-rules li.broken')).toContainText('No spaces');
  await expect(pcButton(page, 'Next')).toBeDisabled();
  await page.getByTestId('oobe-name').fill('LAB-PC01');
  await expect(page.locator('.oobe-rules li.broken')).toHaveCount(0);
  await checkFit(page, touch);
  await pcButton(page, 'Next').click();

  await oobePage(page, 'setup-type');
  await page.getByRole('radio', { name: /personal use/ }).click();
  await pcButton(page, 'Next').click();

  await oobePage(page, 'account');
  await page.getByTestId('oobe-account-field').click();
  await expect(page.getByRole('dialog', { name: 'ช่องลงชื่อบัญชีของลูกค้า' })).toBeVisible();
  await shot(page, info, 'c5-account-ask');
  await page.getByRole('button', { name: 'ขอรหัสผ่านจากครูวิไล' }).click();
  await expect(page.getByRole('status')).toContainText('นับว่าพลาด');
  await expect(body(page)).toHaveAttribute('data-sfx', /mistake/);
  await page.getByRole('button', { name: 'ยื่นเครื่องให้ครูวิไลลงชื่อเอง' }).click();
  await expect(page.getByRole('status')).toContainText('ครูวิไลกำลังลงชื่อบัญชี');
  await expect(page.getByTestId('oobe-account-field')).toBeDisabled();
  await oobePage(page, 'pin');
  await oobePage(page, 'privacy');

  await page.getByRole('button', { name: 'ถามครูวิไลเรื่องความเป็นส่วนตัว' }).click();
  await expect(page.getByRole('button', { name: 'ถามครูวิไลเรื่องความเป็นส่วนตัว' })).toHaveCount(0);
  const ads = page.getByRole('switch', { name: 'Advertising ID' });
  await ads.click();
  await expect(ads).toHaveAttribute('aria-checked', 'false');
  await checkFit(page, touch);
  await shot(page, info, 'c5-privacy');
  await pcButton(page, 'Accept').click();
  await oobePage(page, 'customize');
  await pcButton(page, 'Skip').click();
  await oobePage(page, 'phone');
  await pcButton(page, 'Skip').click();
  await oobePage(page, 'onedrive');
  await pcButton(page, 'Only save files to this PC').click();
  await oobePage(page, 'finishing');
  await oobePage(page, 'desktop');
  await expect(page.getByTestId('desktop')).toBeVisible();
  await expect(page.getByTestId('pc-win')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('ตั้งค่าเสร็จ เข้าเดสก์ท็อป Windows 11 แล้ว');
  await checkFit(page, touch);
  await shot(page, info, 'c5-desktop');
});

test('the account field: typing the email for the customer is a mistake too; Cancel does nothing', async ({ page }) => {
  await page.goto('/?view=content#sims');
  await page.getByLabel('ข้ามไปหน้าตั้งค่าเริ่มต้นเลย (ติดตั้งเสร็จแล้ว)').check();
  await page.getByRole('button', { name: 'เปิดเครื่องครูวิไล' }).click();
  for (const b of ['Yes', 'Yes', 'Skip']) await pcButton(page, b).click();
  await page.getByRole('button', { name: 'เสียบสายแลน' }).click();
  await pcButton(page, 'Next').click();
  await oobePage(page, 'name');
  await pcButton(page, 'Skip for now').click();
  await page.getByRole('radio', { name: /personal use/ }).click();
  await pcButton(page, 'Next').click();
  await oobePage(page, 'account');
  await page.getByTestId('oobe-account-field').click();
  await page.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(page.getByRole('dialog', { name: 'ช่องลงชื่อบัญชีของลูกค้า' })).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('');
  await page.getByTestId('oobe-account-field').click();
  await page.getByRole('button', { name: 'พิมพ์ให้เลย ถามอีเมลจากครูวิไล' }).click();
  await expect(page.getByRole('status')).toContainText('พิมพ์บัญชีแทนลูกค้า');
  await expect(body(page)).toHaveAttribute('data-oobe-page', 'account');
});

test('the whole lab PC: CSM off and Secure Boot on, a GPT stick, Setup, then the PC restarts by itself into first-time setup', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'one long route is enough; the pages are checked at every size above');
  test.setTimeout(90_000);
  await page.goto('/?view=content#sims');
  await page.getByRole('button', { name: 'เปิด Rufus' }).click();
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: 'Win11_24H2_Thai_x64.iso' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.locator('.rufus').getByLabel('Partition scheme').selectOption('GPT');
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(body(page)).toHaveAttribute('data-rufus', 'done', { timeout: 8000 });
  await page.getByRole('button', { name: 'CLOSE' }).click();
  await expect(page.getByTestId('lab-usb')).toContainText('GPT');

  await page.getByRole('button', { name: 'เปิดเครื่องครูวิไล' }).click();
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  // Boot > Boot Settings Configuration > CSM Support = Disabled, Security > Secure Boot = Enabled, F10.
  for (const k of [
    'F2',
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
    'Enter',
    'Minus',
    'Escape',
    'ArrowRight',
    'Enter',
    'Enter',
    'ArrowUp',
    'Enter',
    'F10',
    'Enter',
  ])
    await page.keyboard.press(k);
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'press-any-key');
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-setup-page', 'language');

  for (const b of ['Next', 'Next']) await pcButton(page, b).click();
  await page.getByRole('checkbox', { name: 'I agree everything' }).check();
  await pcButton(page, 'Next').click();
  await page.getByTestId('product-key').click();
  await pcButton(page, 'Next').click();
  await pcButton(page, 'Accept').click();
  for (const id of ['1-2', '1-1']) {
    await page.locator(`[data-part="${id}"]`).click();
    await page.getByRole('button', { name: 'Delete Partition' }).click();
    await pcButton(page, 'OK').click();
  }
  await page.locator('[data-part="1-free"]').click();
  await pcButton(page, 'Next').click();
  await pcButton(page, 'Install').click();
  await expect(body(page)).toHaveAttribute('data-setup-page', 'done', { timeout: 10_000 });
  await expect(page.getByRole('status')).toContainText('เครื่องจะรีสตาร์ตเอง');
  await expect(page.getByTestId('pc-win')).toHaveCount(0);
  // It restarts by itself; the stick is still first, so "Press any key" comes up and is left to time out.
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post', { timeout: 6000 });
  await page.keyboard.press('Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'press-any-key');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'oobe', { timeout: 8000 });
  await oobePage(page, 'region');
  await shot(page, info, 'c5-first-boot');
});
