// Case 4 (Ton, "fast PC but Windows 11 says no") in the shop, played start to finish like a student would
// (docs/case4-plan.md task E): the requirements table, "This PC can't run Windows 11", TPM and Secure Boot
// in the BIOS, and the traps. ?seed= fixes his PC: s1 has TPM off, s3 has TPM and Secure Boot off.

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectStage } from './helpers';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const body = (page: Page) => page.locator('body');
const says = (page: Page) => page.getByTestId('customer-says');
const status = (page: Page) => page.locator('.pc-status');
const reasons = (page: Page) => page.getByTestId('cant-run-reasons').locator('li');
const keys = async (page: Page, ...ks: string[]) => {
  for (const k of ks) await page.keyboard.press(k);
};
const RIGHT: Record<string, string> = { cpu: 'ผ่าน', ram: 'ผ่าน', storage: 'ผ่าน', 'secure-boot': 'ต้องดูใน BIOS', tpm: 'ต้องดูใน BIOS' };
/** F2, Advanced, Trusted Computing, Security Device Support = Enabled. */
const TPM_ON = ['F2', 'ArrowRight', 'ArrowDown', 'Enter', 'Enter', 'ArrowUp', 'Enter'];
/** From there: back out, over to Security, Secure Boot = Enabled. */
const SB_ON = ['Escape', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter', 'Enter', 'ArrowUp', 'Enter'];
/** F2, Boot, Boot Settings Configuration, CSM Support +, F10, Ok. */
const CSM_ON = ['F2', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter', '=', 'F10', 'Enter'];
const SAVE = ['F10', 'Enter'];

/** The requirements table; \`wrong\` rows get another answer than the right one. */
async function answerTable(page: Page, wrong: string[] = []) {
  for (const [id, right] of Object.entries(RIGHT)) {
    const answer = wrong.includes(id) ? (right === 'ผ่าน' ? 'ไม่ผ่าน' : 'ผ่าน') : right;
    await page.locator(`[data-check="${id}"]`).getByRole('button', { name: answer, exact: true }).click();
  }
}

/** Ton's case up to the repair stage. */
async function toRepair(page: Page, seed: string, o: { wrong?: string[]; info?: TestInfo } = {}) {
  await page.goto(`/?case=c04-security-chip&seed=${seed}`);
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('พี่ต้น');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await answerTable(page, o.wrong);
  if (o.info) await shot(page, o.info, 'f1-table');
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await expect(page.getByTestId('error-photo')).toContainText('The PC must support TPM 2.0');
  await page.getByRole('button', { name: 'ฟีเจอร์ความปลอดภัยใน BIOS ถูกปิดไว้' }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await expectStage(page, 'repair');
}

/** Open his PC (or restart it) and boot the stick: POST, then any key. */
async function boot(page: Page) {
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await keys(page, 'Enter', 'Enter');
}
const restart = (page: Page) => page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();

/** Back at the counter: his question and the summary. */
async function finish(page: Page) {
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /บังคับต้องมี TPM 2.0 และ Secure Boot/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
}
const stars = (page: Page) => page.getByRole('group', { name: 'สรุปผล' }).locator('.stars');

test("Ton's whole repair (TPM off): the table, the refusal, TPM on in the BIOS, Setup starts; 3 stars and the table's coins", async ({
  page,
}, info) => {
  await toRepair(page, 's1', { info });
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await boot(page);
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'cant-run');
  await expect(reasons(page)).toHaveText(['The PC must support TPM 2.0']);
  await expect(says(page)).toContainText('หน้านี้แหละที่ผมเจอ');
  await expect(status(page), 'the first refusal is the symptom, not a mistake').not.toContainText('นับว่าพลาด');
  await expect(page.locator('.keybar')).toBeHidden();
  await shot(page, info, 'f2-cant-run');

  await restart(page);
  await expect(page.locator('.keybar')).toBeVisible();
  await keys(page, ...TPM_ON, ...SAVE);
  await boot(page);
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'setup');
  await expect(page.getByTestId('pc-win')).toBeVisible();
  await expect(says(page)).toContainText('ไม่ได้โดนหลอก');
  await shot(page, info, 'f3-fixed');

  await finish(page);
  await expect(stars(page)).toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(page.getByTestId('check-score')).toHaveText('เทียบข้อกำหนด Windows 11 ถูก 5/5 ข้อ (+50 เหรียญ)');
  await expect(page.getByTestId('goodbye')).toContainText('อธิบายข้อกำหนดทีละข้อ');
  await expect(page.locator('.techlog')).toContainText('TPM');
  await shot(page, info, 'f4-summary');
});

test('TPM and Secure Boot off: TPM alone leaves one reason (progress, no mistake); Secure Boot too and Setup starts', async ({ page }) => {
  await toRepair(page, 's3');
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await boot(page);
  await expect(reasons(page)).toHaveText(['The PC must support TPM 2.0', 'The PC must support Secure Boot']);
  await restart(page);
  await keys(page, ...TPM_ON, ...SAVE);
  await boot(page);
  await expect(reasons(page)).toHaveText(['The PC must support Secure Boot']);
  await expect(status(page)).not.toContainText('นับว่าพลาด');
  await restart(page);
  await keys(page, ...TPM_ON, ...SB_ON, ...SAVE);
  await boot(page);
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'setup');
  await finish(page);
  await expect(stars(page)).toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(page.locator('.lost').first()).toHaveText('ซ่อมได้ไม่พลาดเลย');
});

test('the traps: TPM left unsaved (same reason again) and CSM turned on (old Windows); two mistakes cost a star', async ({ page }) => {
  await toRepair(page, 's1', { wrong: ['tpm', 'cpu'] });
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await boot(page);
  await expect(reasons(page)).toHaveText(['The PC must support TPM 2.0']);

  // Trap 1: TPM turned on, then Esc and "Discard changes": the same refusal again.
  await restart(page);
  await keys(page, ...TPM_ON, 'Escape', 'Escape', 'Enter');
  await boot(page);
  await expect(reasons(page)).toHaveText(['The PC must support TPM 2.0']);
  await expect(status(page)).toContainText('ขึ้นหน้าเดิมด้วยเหตุผลเดิม');
  await expect(says(page)).toContainText('ยังขึ้นเหมือนเดิมเลยครับ');

  // Trap 2: CSM on: his GPT stick no longer boots, Windows 10 comes up.
  await restart(page);
  await keys(page, ...CSM_ON);
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await keys(page, 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'old-windows');
  await expect(says(page)).toContainText('Windows 10 ตัวเดิม');

  // The fix: CSM back off (Boot > Boot Settings Configuration), back out, over to Advanced, TPM on, save.
  await restart(page);
  await keys(page, ...CSM_ON.slice(0, 5), '-', 'Escape', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'Enter', 'Enter', 'ArrowUp', 'Enter', ...SAVE);
  await boot(page);
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'setup');
  await finish(page);
  await expect(stars(page)).toHaveAttribute('aria-label', '2 ดาว จาก 3');
  await expect(page.locator('.lost').first()).toContainText('ลงมือพลาด 2 ครั้ง');
  // Wrong rows in the table cost no star, only their coins.
  await expect(page.getByTestId('check-score')).toHaveText('เทียบข้อกำหนด Windows 11 ถูก 3/5 ข้อ (+30 เหรียญ)');
});

test('the job cannot be taken until every row of the table is answered; each row answers once', async ({ page }, info) => {
  await page.goto('/?case=c04-security-chip&seed=s1');
  await expectStage(page, 'intro');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  const take = page.getByRole('button', { name: 'รับงาน' });
  await expect(take).toBeDisabled();
  const tpm = page.locator('[data-check="tpm"]');
  await tpm.getByRole('button', { name: 'ผ่าน', exact: true }).click();
  await expect(tpm).toContainText('คำตอบคือ "ต้องดูใน BIOS"');
  await expect(tpm.getByRole('button', { name: 'ต้องดูใน BIOS' })).toBeDisabled();
  await expect(take).toBeDisabled();
  await shot(page, info, 'f5-table-wrong');
  for (const id of ['cpu', 'ram', 'storage', 'secure-boot']) {
    await page.locator(`[data-check="${id}"]`).getByRole('button', { name: RIGHT[id], exact: true }).click();
  }
  await expect(take).toBeEnabled();
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sideways).toBeLessThanOrEqual(0);
});
