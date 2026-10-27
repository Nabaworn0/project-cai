// Case 5 (Teacher Wilai, "upgrade the lab PC to Windows 11") in the shop, played start to finish like a student
// would (docs/case5-plan.md task D): legacy to UEFI in the BIOS, a new GPT stick on the shop laptop, the red text
// in Setup, and Windows' first-time setup to the desktop with the teacher signing in herself.
// ?seed= fixes her PC: s1 legacy only, s3 no product key too, s5 TPM off too.

import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectStage } from './helpers';

const shot = (page: Page, info: TestInfo, name: string) => page.screenshot({ path: info.outputPath(`${info.project.name}-${name}.png`) });
const body = (page: Page) => page.locator('body');
const says = (page: Page) => page.getByTestId('customer-says');
const status = (page: Page) => page.locator('.pc-status');
const pcButton = (page: Page, name: string) => page.locator('.pc').getByRole('button', { name, exact: true });
const oobePage = (page: Page, p: string, timeout = 10_000) => expect(body(page)).toHaveAttribute('data-oobe-page', p, { timeout });
const keys = async (page: Page, ...ks: string[]) => {
  for (const k of ks) await page.keyboard.press(k);
};
const RIGHT: Record<string, string> = { cpu: 'ผ่าน', ram: 'ผ่าน', storage: 'ผ่าน', 'secure-boot': 'ต้องดูใน BIOS', tpm: 'ต้องดูใน BIOS' };
/** F2, Boot, Boot Settings Configuration, CSM Support = Disabled, then Security, Secure Boot = Enabled. */
const UEFI_ON = ['F2', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter', 'Minus', 'Escape', 'ArrowRight', 'Enter', 'Enter', 'ArrowUp', 'Enter'];
const SAVE = ['F10', 'Enter'];

/** Her case up to the repair stage. */
async function toRepair(page: Page, seed: string, info?: TestInfo, ticketHas?: string, open: () => Promise<unknown> = () => page.goto(`/?case=c05-lab-upgrade&seed=${seed}`)) {
  await open();
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('ครูวิไล');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  await expect(page.getByRole('group', { name: 'ใบรับงาน' })).toContainText('LAB-PC01');
  await expect(page.getByRole('group', { name: 'ใบรับงาน' })).toContainText('Windows 11 Pro');
  if (ticketHas) await expect(page.getByRole('group', { name: 'ใบรับงาน' })).toContainText(ticketHas);
  for (const [id, a] of Object.entries(RIGHT)) await page.locator(`[data-check="${id}"]`).getByRole('button', { name: a, exact: true }).click();
  if (info) await shot(page, info, 'g1-ticket');
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await expect(page.getByTestId('error-photo')).toContainText("This PC doesn't currently meet Windows 11 system requirements.");
  await page.getByRole('button', { name: 'เครื่องตั้งค่าไว้สำหรับ Windows 10 แบบ Legacy ต้องเปลี่ยนเป็น UEFI' }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await expectStage(page, 'repair');
}

/** The refusal she saw, CSM off and Secure Boot on, nothing left to boot, a GPT stick from the laptop, Setup. */
async function toSetup(page: Page, info?: TestInfo) {
  await expect(page.getByRole('button', { name: 'เปิดโน้ตบุ๊กร้าน' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ถามเรื่องสำรองข้อมูล' }), 'she said the files are not needed').toHaveCount(0);
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await keys(page, 'Enter', 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'cant-run');
  await expect(says(page)).toContainText('หน้านี้แหละที่ครูเจอ');
  await expect(status(page), 'the first refusal is the symptom').not.toContainText('นับว่าพลาด');

  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  await keys(page, ...UEFI_ON, ...SAVE);
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await keys(page, 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'no-boot');
  await expect(says(page)).toContainText('แฟลชไดรฟ์ของครูใช้ไม่ได้แล้วเหรอคะ');
  await expect(status(page)).toContainText('ต้องทำ USB ใหม่เป็น GPT');
  await expect(status(page)).not.toContainText('นับว่าพลาด');
  if (info) await shot(page, info, 'g2-no-boot');

  await page.getByRole('button', { name: 'โน้ตบุ๊กร้าน', exact: true }).click();
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: 'Win11_24H2_Thai_x64.iso' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('group', { name: 'Rufus' }).getByLabel('Partition scheme').selectOption('GPT');
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('usb-note')).toContainText('เสียบกลับเครื่องครูวิไลให้แล้ว', { timeout: 8000 });
  await page.getByRole('button', { name: 'ไปที่เครื่องลูกค้า' }).click();
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await keys(page, 'Enter', 'Enter');
  await expect(body(page)).toHaveAttribute('data-setup-page', 'language');
  await expect(says(page)).toContainText('ครูไม่เคยมาถึงหน้านี้เลยค่ะ');
}

/** Setup with the key (or without one, telling Setup an edition), the red text, both old partitions deleted
 *  (no backup question), install, and the restart. */
async function installAndRestart(page: Page, info?: TestInfo, o: { noKeyEdition?: string } = {}) {
  await pcButton(page, 'Next').click();
  await pcButton(page, 'Next').click();
  await page.getByRole('checkbox', { name: 'I agree everything' }).check();
  await pcButton(page, 'Next').click();
  if (o.noKeyEdition) {
    await page.getByRole('button', { name: "I don't have a product key" }).click();
    await page.getByRole('option', { name: o.noKeyEdition, exact: true }).click();
  } else await page.getByTestId('product-key').click();
  await pcButton(page, 'Next').click();
  await pcButton(page, 'Accept').click();
  await page.locator('[data-part="1-2"]').click();
  await expect(page.getByTestId('setup-error')).toContainText('MBR partition table');
  for (const id of ['1-2', '1-1']) {
    await page.locator(`[data-part="${id}"]`).click();
    await page.getByRole('button', { name: 'Delete Partition' }).click();
    await pcButton(page, 'OK').click();
  }
  await expect(status(page), 'no backup question for her: deleting is fine').not.toContainText('นับว่าพลาด');
  await page.locator('[data-part="1-free"]').click();
  await pcButton(page, 'Next').click();
  await pcButton(page, 'Install').click();
  await expect(body(page)).toHaveAttribute('data-setup-page', 'done', { timeout: 10_000 });
  await expect(says(page)).toContainText('ต่อจากนี้ต้องตั้งค่าอะไรบ้างคะ');
  await expect(page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }), 'not done yet').toHaveCount(0);
  if (info) await shot(page, info, 'g3-installed');
  // The PC restarts by itself; the stick is still first, so "Press any key" is left to time out.
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post', { timeout: 6000 });
  await keys(page, 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'press-any-key');
  await oobePage(page, 'region');
}

/** First-time setup to the account page: Thailand, the US keyboard plus Thai (unless skipped), the cable, the name, personal use. */
async function toAccount(page: Page, o: { thai?: boolean; name?: string; home?: boolean } = {}) {
  await page.getByRole('option', { name: 'Thailand' }).click();
  await pcButton(page, 'Yes').click();
  await pcButton(page, 'Yes').click();
  if (o.thai === false) await pcButton(page, 'Skip').click();
  else {
    await pcButton(page, 'Add layout').click();
    await page.getByRole('option', { name: 'Thai Kedmanee' }).click();
    await pcButton(page, 'Add layout').click();
  }
  await page.getByRole('button', { name: 'เสียบสายแลน' }).click();
  await pcButton(page, 'Next').click();
  await oobePage(page, 'name');
  await page.getByTestId('oobe-name').fill(o.name ?? 'LAB-PC01');
  await pcButton(page, 'Next').click();
  // Only Pro asks "personal or work or school".
  if (!o.home) {
    await page.getByRole('radio', { name: /personal use/ }).click();
    await pcButton(page, 'Next').click();
  }
  await oobePage(page, 'account');
}

/** From the privacy page to the desktop, skipping every offer. */
async function toDesktop(page: Page) {
  await pcButton(page, 'Accept').click();
  await pcButton(page, 'Skip').click();
  await pcButton(page, 'Skip').click();
  await pcButton(page, 'Only save files to this PC').click();
  await oobePage(page, 'desktop');
  await expect(page.getByTestId('pc-win')).toBeVisible();
}

/** Back at the counter: her two questions and the summary. */
async function finish(page: Page) {
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /USB เดิมทำแบบ MBR/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await page.getByRole('button', { name: /ดิสก์เดิมเป็น MBR เครื่อง UEFI/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
}
const stars = (page: Page) => page.getByRole('group', { name: 'สรุปผล' }).locator('.stars');

test("Teacher Wilai's whole job: UEFI, a GPT stick, the red text, install, first-time setup with her signing in; 3 stars", async ({ page }, info) => {
  test.setTimeout(120_000);
  await toRepair(page, 's1', info);
  await toSetup(page, info);
  await installAndRestart(page, info);
  await toAccount(page);
  await page.getByRole('button', { name: 'ยื่นเครื่องให้ครูวิไลลงชื่อเอง' }).click();
  await expect(says(page)).toContainText('ให้ครูพิมพ์เองใช่ไหมคะ');
  await expect(status(page)).toContainText('ครูวิไลกำลังลงชื่อบัญชี');
  await oobePage(page, 'privacy');
  await page.getByRole('button', { name: 'ถามครูวิไลเรื่องความเป็นส่วนตัว' }).click();
  await expect(says(page)).toContainText('ปิดโฆษณากับตำแหน่งไว้ค่ะ');
  await page.getByRole('switch', { name: 'Advertising ID' }).click();
  await page.getByRole('switch', { name: 'Location' }).click();
  await toDesktop(page);
  await expect(says(page)).toContainText('ครูจดครบทุกขั้นเลยค่ะ');
  await shot(page, info, 'g4-desktop');
  await finish(page);
  await expect(stars(page)).toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(page.locator('.techlog')).toContainText('ถามลูกค้าก่อนตั้งค่าความเป็นส่วนตัว');
  await expect(page.locator('.techlog')).toContainText('ช่างยื่นเครื่องให้ลูกค้าพิมพ์เอง');
  await expect(page.locator('.techlog')).not.toContainText('ไม่ได้เพิ่มแป้นพิมพ์ภาษาไทย');
  await shot(page, info, 'g5-summary');
});

test('traps on first-time setup: typing her account and asking her password each count once; no Thai keyboard and another name are noted', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'the long route runs at every size above; the traps once are enough');
  test.setTimeout(120_000);
  await toRepair(page, 's1');
  await toSetup(page);
  await installAndRestart(page);
  await toAccount(page, { thai: false, name: 'PC-ROOM1' });
  await page.getByTestId('oobe-account-field').click();
  await page.getByRole('button', { name: 'พิมพ์ให้เลย ถามอีเมลจากครูวิไล' }).click();
  await expect(says(page)).toContainText('รหัสผ่านครูไม่สะดวกบอก');
  await expect(status(page)).toContainText('นับว่าพลาด');
  await page.getByTestId('oobe-account-field').click();
  await page.getByRole('button', { name: 'ขอรหัสผ่านจากครูวิไล' }).click();
  await page.getByTestId('oobe-account-field').click();
  await page.getByRole('button', { name: 'ยื่นเครื่องให้ครูวิไลพิมพ์เอง' }).click();
  await oobePage(page, 'privacy');
  await toDesktop(page);
  await expect(says(page)).toContainText('เด็กๆ จะพิมพ์ภาษาไทยไม่ได้');
  await finish(page);
  // Two account mistakes: one is free, the second costs a star.
  await expect(stars(page)).toHaveAttribute('aria-label', '2 ดาว จาก 3');
  await expect(page.locator('.lost').first()).toContainText('ลงมือพลาด 2 ครั้ง');
  const log = page.locator('.techlog');
  await expect(log).toContainText('ไม่ได้เพิ่มแป้นพิมพ์ภาษาไทย');
  await expect(log).toContainText('PC-ROOM1 ไม่ตรงกับใบงาน (LAB-PC01)');
  await expect(log).toContainText('หน้าความเป็นส่วนตัวควรถามลูกค้าก่อนกด Accept');
});

test('TPM off too (s5): both reasons in legacy mode; TPM, CSM and Secure Boot in one BIOS visit; the GPT stick reaches Setup', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'one size is enough for this variant');
  await toRepair(page, 's5');
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await keys(page, 'Enter', 'Enter');
  await expect(page.getByTestId('cant-run-reasons').locator('li')).toHaveText(['The PC must support TPM 2.0', 'The PC must support Secure Boot']);
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  // Advanced > Trusted Computing > TPM on, back out, Boot > CSM off, Security > Secure Boot on, F10.
  await keys(
    page,
    'F2',
    'ArrowRight',
    'ArrowDown',
    'Enter',
    'Enter',
    'ArrowUp',
    'Enter',
    'Escape',
    'ArrowRight',
    'ArrowRight',
    'Enter',
    'Minus',
    'Escape',
  );
  await keys(page, 'ArrowRight', 'Enter', 'Enter', 'ArrowUp', 'Enter', ...SAVE);
  await page.getByRole('button', { name: 'โน้ตบุ๊กร้าน', exact: true }).click();
  await page.getByRole('button', { name: 'SELECT' }).click();
  await page.getByRole('button', { name: 'Win11_24H2_Thai_x64.iso' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('group', { name: 'Rufus' }).getByLabel('Partition scheme').selectOption('GPT');
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByTestId('usb-note')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'ไปที่เครื่องลูกค้า' }).click();
  await keys(page, 'Enter', 'Enter');
  await expect(body(page)).toHaveAttribute('data-setup-page', 'language');
  await expect(status(page)).not.toContainText('นับว่าพลาด');
});

test('no product key (s3), Home told to Setup instead of Pro: installs, no "personal or work" page, and the log notes the edition', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'the long route runs at every size above');
  test.setTimeout(120_000);
  await toRepair(page, 's3', undefined, 'ลูกค้าไม่ได้นำมา');
  await toSetup(page);
  await installAndRestart(page, undefined, { noKeyEdition: 'Windows 11 Home' });
  await toAccount(page, { home: true });
  await page.getByRole('button', { name: 'ยื่นเครื่องให้ครูวิไลลงชื่อเอง' }).click();
  await oobePage(page, 'privacy');
  await toDesktop(page);
  await finish(page);
  await expect(stars(page), 'the wrong edition is noted, not scored').toHaveAttribute('aria-label', '3 ดาว จาก 3');
  await expect(page.locator('.techlog')).toContainText('เลือกรุ่น Windows ไม่ตรงกับที่เครื่องเคยใช้');
  await expect(page.locator('.techlog')).toContainText("I don't have a product key");
});

test('BIOS traps: leaving with Esc brings the same refusal (a mistake); "no boot device" again without a new stick (a mistake)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'one size is enough for the traps');
  await toRepair(page, 's1');
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await keys(page, 'Enter', 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'cant-run');
  // CSM off and Secure Boot on, then Esc and "discard": nothing saved, the same refusal.
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  await keys(page, ...UEFI_ON, 'Escape', 'Escape', 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await keys(page, 'Enter', 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'cant-run');
  await expect(says(page)).toContainText('ขั้นนี้ครูจดไว้ว่ายังไม่ได้ผล');
  await expect(status(page)).toContainText('นับว่าพลาด');
  // Saved this time: the first "no boot device" is free, the second (stick not remade) counts.
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  await keys(page, ...UEFI_ON, ...SAVE, 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'no-boot');
  await expect(status(page)).not.toContainText('นับว่าพลาด');
  await page.getByRole('button', { name: 'รีสตาร์ตเครื่อง' }).click();
  await keys(page, 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'no-boot');
  await expect(status(page)).toContainText('นับว่าพลาด');
  await expect(page.getByRole('button', { name: /คำใบ้/ })).toBeVisible();
});

test('the order of customers: after Ton (case 4) comes Teacher Wilai (case 5)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the order is the same at every size');
  await page.goto('/?case=c04-security-chip&seed=s1');
  await expectStage(page, 'intro');
  await page.getByRole('button', { name: 'รับเรื่อง' }).click();
  for (const [id, a] of Object.entries(RIGHT)) await page.locator(`[data-check="${id}"]`).getByRole('button', { name: a, exact: true }).click();
  await page.getByRole('button', { name: 'รับงาน' }).click();
  await page.getByRole('button', { name: 'ฟีเจอร์ความปลอดภัยใน BIOS ถูกปิดไว้' }).click();
  await page.getByRole('button', { name: 'ไปซ่อมเครื่อง' }).click();
  await page.getByRole('button', { name: 'เปิดเครื่องลูกค้า' }).click();
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'post');
  await keys(page, 'F2', 'ArrowRight', 'ArrowDown', 'Enter', 'Enter', 'ArrowUp', 'Enter', ...SAVE, 'Enter', 'Enter');
  await expect(body(page)).toHaveAttribute('data-pc-screen', 'setup');
  await page.getByRole('button', { name: 'กลับไปคุยกับลูกค้า' }).click();
  await page.getByRole('button', { name: /บังคับต้องมี TPM 2.0 และ Secure Boot/ }).click();
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expectStage(page, 'summary');
  await page.getByRole('button', { name: 'รับลูกค้าคนถัดไป' }).click();
  await expectStage(page, 'intro');
  await expect(page.locator('.case-panel')).toContainText('ครูวิไล');
  await expect(page.locator('.case-panel')).toContainText('ข้อมูลในเครื่องไม่ต้องเก็บนะคะ');
});

test('through the menu, case 5 is the last: its summary leads back to the menu, which shows every case done', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the menu itself is checked at every size in menu.spec.ts');
  test.setTimeout(120_000);
  const played = Object.fromEntries(['c01-boot-order', 'c02-rufus-scheme', 'c03-red-text', 'c04-security-chip'].map((id) => [id, { stars: 2, plays: 1 }]));
  await page.addInitScript(
    (v) => !localStorage.getItem('seeded') && (localStorage.setItem('shop.progress.v2', v), localStorage.setItem('seeded', '1')),
    JSON.stringify({ coins: 0, learner: { name: 'สมชาย ใจดี', room: 'ปวช.1/2', no: '7' }, done: [], cases: played }),
  );
  await toRepair(page, 's1', undefined, undefined, async () => {
    await page.goto('/?seed=s1');
    await page.getByTestId('menu').getByRole('button', { name: 'ทำต่อ: ฝึกงานที่ร้าน · เคส 5 ครูวิไล' }).click();
  });
  await toSetup(page);
  await installAndRestart(page);
  await toAccount(page);
  await page.getByRole('button', { name: 'ยื่นเครื่องให้ครูวิไลลงชื่อเอง' }).click();
  await oobePage(page, 'privacy');
  await toDesktop(page);
  await finish(page);
  await expect(page.locator('.case-panel')).toContainText('ฝึกครบทุกเคสแล้ว');
  await expect(page.getByRole('button', { name: 'รับลูกค้าคนถัดไป' })).toHaveCount(0);
  await page.locator('.case-panel').getByRole('button', { name: 'กลับเมนู' }).click();
  const menu = page.getByTestId('menu');
  await expect(menu.locator('[data-step="cases"]')).toHaveAttribute('data-status', 'done');
  await expect(menu.locator('[data-case="c05-lab-upgrade"]')).toHaveAttribute('data-status', 'done');
  // Nothing else is built yet, so there is no "ทำต่อ".
  await expect(menu.getByRole('button', { name: /^ทำต่อ/ })).toHaveCount(0);
});
