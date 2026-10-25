// Case 4 task B: "This PC can't run Windows 11" with the reasons from the machine, tried on Ton's PC in the
// content viewer's "หน้าจอจำลอง" tab (before task D puts the case in the shop). Screenshots go to test-results/.

import { expect, test, type Page, type TestInfo } from '@playwright/test';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const screen = (page: Page) => page.locator('body');
const reasons = (page: Page) => page.getByTestId('cant-run-reasons').locator('li');
const keys = async (page: Page, ...ks: string[]) => {
  for (const k of ks) await page.keyboard.press(k);
};
/** POST: Enter boots the stick (first already); any key starts Setup. */
const boot = (page: Page) => keys(page, 'Enter', 'Enter');
/** F2, Advanced, Trusted Computing, Security Device Support = Enabled. */
const TPM_ON = ['F2', 'ArrowRight', 'ArrowDown', 'Enter', 'Enter', 'ArrowUp', 'Enter'];
/** Back out, over to Security, Secure Boot = Enabled. */
const SB_ON = ['Escape', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter', 'Enter', 'ArrowUp', 'Enter'];

async function openTon(page: Page, sbOff = false) {
  await page.goto('/?view=content#sims');
  if (sbOff) await page.getByLabel('Secure Boot ปิดด้วย').check();
  await page.getByRole('button', { name: 'เปิดเครื่องพี่ต้น' }).click();
  await expect(screen(page)).toHaveAttribute('data-pc-screen', 'post');
}

test('TPM and Secure Boot off: both reasons, TPM on leaves one, both on and Setup starts', async ({ page }, info) => {
  await openTon(page, true);
  await boot(page);
  await expect(screen(page)).toHaveAttribute('data-pc-screen', 'cant-run');
  await expect(page.locator('.pc')).toContainText("This PC can't run Windows 11");
  await expect(page.locator('.pc')).toContainText("This PC doesn't currently meet Windows 11 system requirements.");
  await expect(page.locator('.pc')).toContainText('https://aka.ms/WindowsSysReq');
  await expect(reasons(page)).toHaveText(['The PC must support TPM 2.0', 'The PC must support Secure Boot']);
  await expect(page.locator('.pc-status')).toContainText('รีสตาร์ตเครื่องเข้า BIOS');
  await shot(page, info, 'b1-two-reasons');

  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  await keys(page, ...TPM_ON, 'F10', 'Enter');
  await boot(page);
  await expect(reasons(page)).toHaveText(['The PC must support Secure Boot']);
  await expect(page.locator('.pc-status'), 'progress, not a mistake').not.toContainText('นับว่าพลาด');
  await shot(page, info, 'b2-one-reason');

  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  await keys(page, ...TPM_ON, ...SB_ON, 'F10', 'Enter');
  await boot(page);
  await expect(screen(page)).toHaveAttribute('data-pc-screen', 'setup');
  await expect(page.getByTestId('pc-win')).toBeVisible();
});

test('trap: TPM turned on but the BIOS left without saving: the same reason again counts as a mistake', async ({ page }) => {
  await openTon(page);
  await boot(page);
  await expect(reasons(page)).toHaveText(['The PC must support TPM 2.0']);
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  await keys(page, ...TPM_ON, 'Escape', 'Escape', 'Enter');
  await expect(screen(page)).toHaveAttribute('data-pc-screen', 'post');
  await boot(page);
  await expect(reasons(page)).toHaveText(['The PC must support TPM 2.0']);
  await expect(page.locator('.pc-status')).toContainText('ขึ้นหน้าเดิมด้วยเหตุผลเดิม');
  await expect(screen(page)).toHaveAttribute('data-sfx', /mistake/);
});

test("the can't-run screen fits: every line readable inside the PC screen, no sideways scrolling", async ({ page }, info) => {
  await openTon(page, true);
  await boot(page);
  await expect(reasons(page)).toHaveCount(2);
  const pc = (await page.locator('.pc').boundingBox())!;
  const win = (await page.locator('.pc .w11').boundingBox())!;
  expect(win.y + win.height, 'the Setup box ends inside the screen').toBeLessThanOrEqual(pc.y + pc.height + 1);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sideways).toBeLessThanOrEqual(0);
  await shot(page, info, 'b3-fit');
});
