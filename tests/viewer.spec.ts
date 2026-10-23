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
    await expect(page.locator('[data-testid^="case-"]')).toHaveCount(3);
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
    const case1 = page.getByTestId('case-c01-uefi-mbr');
    await expect(case1.getByTestId('solution').locator('li')).toHaveCount(1);
    await expect(case1).toContainText('MBR (ปกติ: GPT) ← ปัญหาซ่อน');
    // Files are backed up, so the shortest fix may wipe the disk, and it is flagged as such.
    await expect(case1.getByTestId('solution').locator('.v-badge.bad')).toHaveCount(1);

    // A keep-my-files customer: the solution never wipes the disk.
    const case3 = page.getByTestId('case-c03-keep-my-files');
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
