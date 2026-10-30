// The shop's rolling shutter between pages (docs/pages-plan.md task B, src/ui/Shutter.tsx): it rolls down, the page
// changes behind it, it rolls up; the first trip to the shop holds it down until the scene is ready; with less
// motion asked for it fades. Every change of the shutter and the page is logged in the page (with the time, and
// whether the shutter covers the middle of the screen) to check the order afterwards. Real time: the shutter's
// timers and Preact's effects both run on the page's clock, so a frozen test clock would stop them all.

import { expect, test, type Page } from '@playwright/test';
import { ALL_TALKS, LEARNED, LEARNER } from './helpers';

const menu = (page: Page) => page.getByTestId('menu');
const shutter = (page: Page) => page.getByTestId('shutter');
type Step = { shutter?: string; view?: string; scene?: string; at: number; covered: boolean };
const log = (page: Page) => page.evaluate(() => (window as unknown as { __log: Step[] }).__log);

async function start(page: Page, progress: unknown) {
  await page.addInitScript((v) => {
    if (!localStorage.getItem('seeded')) (localStorage.setItem('shop.progress.v2', v), localStorage.setItem('seeded', '1'));
    const rec: Step[] = [];
    (window as unknown as { __log: Step[] }).__log = rec;
    new MutationObserver(() => {
      const d = document.body?.dataset ?? {};
      const last = rec.at(-1);
      if (last && last.shutter === d.shutter && last.view === d.view && last.scene === d.scene) return;
      const top = document.body ? document.elementFromPoint(innerWidth / 2, innerHeight / 2) : null;
      rec.push({ shutter: d.shutter, view: d.view, scene: d.scene, at: performance.now(), covered: !!top?.closest('[data-testid="shutter"]') });
      // document, not document.documentElement: init scripts run before the <html> element exists.
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-shutter', 'data-view', 'data-scene'] });
  }, JSON.stringify(progress));
  await page.goto('/');
  await expect(menu(page)).toBeVisible({ timeout: 15_000 });
}

test('down, the page changes behind it, up; once down it covers the screen', async ({ page }) => {
  await start(page, { learner: LEARNER });
  await menu(page).getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' }).click();
  await expect(shutter(page)).toContainText('กำลังไปที่ แบบทดสอบก่อนเรียน…');
  await expect(page.getByTestId('quiz')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle');
  await expect(shutter(page)).toHaveCount(0);

  const steps = await log(page);
  const phases = steps.map((s) => s.shutter).filter((s, i, a) => s && s !== a[i - 1]);
  expect(phases).toEqual(['idle', 'down', 'closed', 'up', 'idle']);
  // The page changed while the shutter was down, and it was rolled all the way down then (nothing to tap through).
  const changed = steps.find((s) => s.view === 'test')!;
  expect(changed.shutter).toBe('closed');
  expect(changed.covered).toBe(true);
  // It took its time rolling down (timers never fire early, so this cannot fail under load).
  const down = steps.find((s) => s.shutter === 'down')!;
  expect(changed.at - down.at).toBeGreaterThanOrEqual(290);
});

test('the first trip to the shop holds the shutter down until the scene is ready', async ({ page }, info) => {
  await start(page, { learner: LEARNER, ...LEARNED, seen: ALL_TALKS });
  await menu(page)
    .getByRole('button', { name: /^ทำต่อ: ฝึกงานที่ร้าน/ })
    .click();
  await expect(shutter(page)).toContainText('กำลังไปที่ ร้านซ่อมคอม…');
  // A picture while it waits for the shop, if the shop is slow enough to catch it.
  if (
    process.env.SHOTS &&
    (await page
      .locator('body[data-shutter="closed"]')
      .waitFor({ timeout: 3000 })
      .then(
        () => true,
        () => false,
      ))
  )
    await page.screenshot({ path: `${process.env.SHOTS}/shutter-${info.project.name}.png` });
  await expect(page.locator('body')).toHaveAttribute('data-case-stage', 'intro', { timeout: 15_000 });
  await expect(shutter(page)).toHaveCount(0);
  const steps = await log(page);
  const up = steps.find((s) => s.shutter === 'up')!;
  expect(up.scene, 'the scene was ready before the shutter went up').toBe('shop');
  // Back to the learning page: the scene is loaded now, so the shutter goes straight up again.
  await page.getByRole('button', { name: '☰ เมนู' }).click();
  await expect(menu(page)).toBeVisible();
  await expect(shutter(page)).toHaveCount(0);
});

test('with less motion asked for, the shutter fades instead of rolling', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the shutter itself is checked at every size above');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, { learner: LEARNER });
  await menu(page).getByRole('button', { name: 'ทำต่อ: แบบทดสอบก่อนเรียน' }).click();
  await expect(shutter(page)).toHaveClass(/fade/);
  await expect(shutter(page)).toHaveCSS('animation-name', /shutter-fade-(in|out)/);
  await expect(page.getByTestId('quiz')).toBeVisible();
});
