import { expect, test } from '@playwright/test';

test.describe('content viewer (?view=content)', () => {
  test('opens without the game, runs the validator, and fits the screen', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/?view=content');
    await expect(page.getByRole('heading', { name: 'เนื้อหาเกม ร้านซ่อมคอม' })).toBeVisible();
    await expect(page.getByTestId('validator-status')).toContainText('ตัวตรวจผ่าน', { timeout: 15_000 });
    await expect(page.locator('#game canvas')).toHaveCount(0); // Phaser never started
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('every tab shows its content', async ({ page }) => {
    await page.goto('/?view=content');
    const tab = (name: string) => page.getByRole('navigation', { name: 'หมวดเนื้อหา' }).getByRole('button', { name, exact: true });
    await tab('เคส').click();
    await expect(page.locator('[data-testid^="case-"]')).toHaveCount(7);
    await tab('ปัญหา').click();
    await expect(page.getByRole('heading', { name: 'uefi-mbr', exact: true })).toBeVisible();
    await tab('BIOS').click();
    await expect(page.getByRole('heading', { name: 'Acer', exact: true })).toBeVisible();
    await tab('ข้อสอบ').click();
    await expect(page.getByRole('heading', { name: 'แบบทดสอบก่อนเรียน' })).toBeVisible();
    await tab('การ์ด').click();
    await expect(page.getByText('ผู้พิทักษ์ GPT')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the machine lab rolls machines from a seed and shows how to fix them', async ({ page }) => {
    await page.goto('/?view=content#cases');
    const case1 = page.getByTestId('case-c03-red-text');
    await expect(case1).toContainText('MBR (ปกติ: GPT) ← ปัญหาซ่อน');
    // Files are backed up, so the shortest fix may wipe the disk, and it is flagged as such.
    await expect(case1.getByTestId('solution').locator('.v-badge.bad')).toHaveCount(1);

    // A keep-my-files customer: the solution never wipes the disk.
    const case3 = page.getByTestId('case-adv-keep-my-files');
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      await case3.getByLabel('seed เคส', { exact: true }).fill(seed);
      await expect(case3.getByTestId('solution')).toBeVisible();
      await expect(case3.getByTestId('solution').locator('.v-badge.bad')).toHaveCount(0); // no step is marked as wiping data
    }

    // Same seed, same machine.
    await case3.getByLabel('seed เคส', { exact: true }).fill('repeat');
    const first = await case3.locator('.v-ticket').innerText();
    await case3.getByLabel('seed เคส', { exact: true }).fill('other');
    await case3.getByLabel('seed เคส', { exact: true }).fill('repeat');
    expect(await case3.locator('.v-ticket').innerText()).toBe(first);
  });
});

test('every case installs Windows 11, and the requirements table shows Windows 11 only', async ({ page }) => {
  await page.goto('/?view=content#cases');
  const office = page.getByTestId('case-adv-old-office-pc');
  await expect(office).toContainText('ลง Windows 11');
  await expect(office.getByTestId('solution')).toContainText('Rufus');
  await page.goto('/?view=content#overview');
  const table = page.locator('table.v-req');
  await expect(table).toContainText('UEFI อย่างเดียว');
  await expect(table).not.toContainText('Windows 10');
});

test('the tab follows the #hash: shared links, editing the address, and Back all work', async ({ page }) => {
  await page.goto('/?view=content#bios');
  const active = page.locator('.v-tabs button.on');
  await expect(active).toHaveText('BIOS');
  await page.evaluate(() => { location.hash = 'cases'; });
  await expect(active).toHaveText('เคส');
  await page.getByRole('navigation', { name: 'หมวดเนื้อหา' }).getByRole('button', { name: 'ปัญหา', exact: true }).click();
  await expect(active).toHaveText('ปัญหา');
  await page.goBack();
  await expect(active).toHaveText('เคส');
});

test('each case shows its customer, the guess-the-cause question and the customer questions with answers marked', async ({ page }) => {
  await page.goto('/?view=content#cases');
  const c1 = page.getByTestId('case-c01-boot-order');
  await expect(c1).toContainText('ป้าสมศรี');
  await expect(c1).toContainText('ขายขนมออนไลน์');
  await expect(c1.locator('.v-qs li.right').first()).toHaveText('เครื่องตั้งให้บูตจากฮาร์ดดิสก์ก่อน USB');
  const c5 = page.getByTestId('case-c05-lab-upgrade');
  await expect(c5.locator('.v-qs h5', { hasText: 'ลูกค้าถาม' })).toHaveCount(2);
});

test("each case shows the customer's lines during the repair, and marks the ones still generic", async ({ page }) => {
  await page.goto('/?view=content#cases');
  const somsri = page.getByTestId('case-c01-boot-order').getByTestId('reactions');
  await expect(somsri).toContainText('เหมือนที่ป้าเจอเลย');
  await expect(somsri).not.toContainText('ใช้ประโยคกลาง');
  // Beam has every line of his own, including the case 2 ones (wrong image, "can't run"); so do Lung Chai (case 3) and Ton (case 4); case 5 is still generic.
  const beam = page.getByTestId('case-c02-rufus-scheme').getByTestId('reactions');
  await expect(beam).toContainText('นี่มันไม่ใช่ Windows 11');
  await expect(beam).not.toContainText('ใช้ประโยคกลาง');
  const chai = page.getByTestId('case-c03-red-text').getByTestId('reactions');
  await expect(chai).toContainText('ลบพาร์ทิชันของ USB (พลาด)');
  await expect(chai).not.toContainText('ใช้ประโยคกลาง');
  const ton = page.getByTestId('case-c04-security-chip').getByTestId('reactions');
  await expect(ton).toContainText('ขึ้นว่าลงไม่ได้ซ้ำด้วยเหตุผลเดิม');
  await expect(ton).not.toContainText('ใช้ประโยคกลาง');
  await expect(page.getByTestId('case-c05-lab-upgrade').getByTestId('reactions')).toContainText('ใช้ประโยคกลาง');
});
