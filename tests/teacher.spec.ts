// The teacher's page (?view=teacher, docs/results-plan.md task C) against a stand-in for the teacher's Apps Script
// web app holding a class of 30: connecting, the class link and its QR code, reading the class from the sheet or
// from files, the class figures as src/core/results.ts works them out, the CSV, and the sheet's errors.

import { expect, test, type Page, type Route } from '@playwright/test';
import qrcode from 'qrcode-generator';
import { readFileSync } from 'node:fs';
import lessons from '../src/content/data/lessons.json' with { type: 'json' };
import reflect from '../src/content/data/reflect.json' with { type: 'json' };
import testJson from '../src/content/data/test.json' with { type: 'json' };
import type { Lesson, Reflect } from '../src/content/schema';
import { EMPTY, PLAYABLE, type Progress } from '../src/core/path';
import { classFigures, resultsFile, type ResultsContent } from '../src/core/results';

const TO = 'AKfycbx_abcdefghijklmnopqrstuvwxyz0123456789-XY';
const KEY = 'ครู1234';
const CLASS = 'ปวช.1/2';
const items = testJson.items;
const RC: ResultsContent = { test: items, lessons: lessons.lessons as Lesson[], reflect: reflect as Reflect, caseIds: PLAYABLE };
const teacher = (page: Page) => page.getByTestId('teacher');

/** Learner n of 30: pre-test 2–6 right, post-test 5–10, satisfaction 3–5, a few without the post-test. */
function learner(n: number): Progress {
  const sit = (right: number) => ({
    score: right,
    total: items.length,
    answers: Object.fromEntries(items.map((it, i) => [it.id, i < right ? it.answer : (it.answer + 1 + (n % 2)) % it.choicesTh.length])),
    at: 1,
    seconds: 300,
  });
  return {
    ...EMPTY,
    learner: { name: `นักเรียน ${n}`, room: CLASS, no: String(n) },
    pre: sit(2 + (n % 5)),
    post: n > 27 ? null : sit(5 + (n % 6)),
    order: { stars: 3, plays: 1, first: { tries: [n % 4, 2], solved: [true, true], lost: n % 3 } },
    cases: { 'c01-boot-order': { stars: 3, plays: 1, first: 1 + (n % 3) } },
    reflect: n > 25 ? null : { self: { 'self-os': 1 + (n % 5) }, write: { learned: n === 3 ? 'ได้รู้เรื่อง BIOS' : '' }, sat: Object.fromEntries(reflect.satisfaction.map((s, i) => [s.id, 3 + ((n + i) % 3)])), suggest: '', at: 1 },
  };
}
const CLASS30 = Array.from({ length: 30 }, (_, i) => learner(i + 1));
const files = CLASS30.map((p, i) => resultsFile(p, 1000 + i));

/** The stand-in web app: checks the key, lists the class, gives its files. */
async function sheet(page: Page) {
  const asked: Record<string, unknown>[] = [];
  await page.route(`https://script.google.com/macros/s/${TO}/exec`, async (route: Route) => {
    const body = JSON.parse(route.request().postData()!) as { action: string; key: string; class?: string };
    asked.push(body);
    const reply = body.key !== KEY ? { ok: false, error: 'key' } : body.action === 'classes' ? { ok: true, classes: [CLASS] } : { ok: true, files };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  return asked;
}

async function connect(page: Page, key = KEY) {
  await page.goto('/?view=teacher');
  await teacher(page).getByLabel('ลิงก์ Web app').fill(`https://script.google.com/macros/s/${TO}/exec`);
  await teacher(page).getByLabel(/รหัสครู/).fill(key);
  await teacher(page).getByRole('button', { name: 'บันทึก' }).click();
}

test('connect, make the class link with its QR code, and read the class of 30 from the sheet', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'checked on a phone below');
  const asked = await sheet(page);
  await page.goto('/?view=teacher');
  await teacher(page).getByLabel('ลิงก์ Web app').fill('https://example.com/not-it');
  await teacher(page).getByRole('button', { name: 'บันทึก' }).click();
  await expect(teacher(page).locator('.teacher-msg')).toContainText('ลิงก์ Web app ไม่ถูกต้อง');
  await connect(page);
  await expect(teacher(page).locator('.teacher-msg')).toHaveText('บันทึกแล้ว (เก็บไว้ในเครื่องนี้)');

  // The class link: the game's address with the class and the sheet; a QR code of it.
  await teacher(page).getByLabel(/ชื่อห้อง/).fill(CLASS);
  const link = new URL((await teacher(page).getByTestId('class-link').textContent())!);
  expect([link.searchParams.get('class'), link.searchParams.get('to'), link.searchParams.get('view')]).toEqual([CLASS, TO, null]);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await teacher(page).getByRole('button', { name: 'คัดลอกลิงก์' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).searchParams.get('class')).toBe(CLASS);
  // Copied as a link, the Thai in it encoded.
  expect(copied).not.toMatch(/[฀-๿]/);
  // The QR code is the copied link's.
  const q = qrcode(0, 'M');
  q.addData(copied, 'Byte');
  q.make();
  const want = /<path d="([^"]+)"/.exec(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }))![1];
  expect(await teacher(page).locator('.teacher-qr path').getAttribute('d')).toBe(want);
  await teacher(page).getByLabel(/ชื่อห้อง/).fill('a<b');
  await expect(teacher(page).getByTestId('class-link')).toHaveCount(0);

  // The sheet: its classes, then one class's results, the key in the body every time.
  await teacher(page).getByRole('button', { name: 'ดูห้องใน Sheet' }).click();
  await teacher(page).getByRole('button', { name: 'ดึงผล' }).click();
  await expect(teacher(page).getByTestId('teacher-count')).toHaveText('ผู้เรียน 30 คน · ทำแบบทดสอบครบก่อนและหลัง 27 คน');
  expect(asked).toEqual([
    { action: 'classes', key: KEY },
    { action: 'read', key: KEY, class: CLASS },
  ]);
  // The figures are the ones the results core works out.
  const f = classFigures(CLASS30, RC);
  await expect(teacher(page).getByTestId('pre-mean')).toHaveText(`${f.pre.mean.toFixed(2)} (${f.pre.sd.toFixed(2)})`);
  await expect(teacher(page).getByTestId('post-mean')).toHaveText(`${f.post.mean.toFixed(2)} (${f.post.sd.toFixed(2)})`);
  await expect(teacher(page).getByTestId('e1e2')).toHaveText(`${f.e1.toFixed(2)}/${f.e2.toFixed(2)}`);
  await expect(teacher(page).getByTestId('ttest')).toContainText(`t = ${f.t!.t.toFixed(3)}, df = 26`);
  await expect(teacher(page).getByTestId('ttest')).toContainText('อย่างมีนัยสำคัญทางสถิติที่ระดับ .05');
  await expect(teacher(page).getByTestId('overall-mean')).toHaveText(f.overall.stat.mean.toFixed(2));
  await expect(teacher(page).getByTestId('learners').locator('tbody tr')).toHaveCount(30);
  await expect(teacher(page).getByTestId('learners').locator('tbody tr').nth(9).locator('td').nth(1)).toHaveText('10');
  await expect(teacher(page).getByTestId('items').locator('tbody tr')).toHaveCount(items.length);
  await expect(teacher(page).getByTestId('items').locator('tbody tr.low')).toHaveCount(f.items.filter((i) => i.post < 50).length);
  await expect(teacher(page).locator('.teacher-writes').first()).toContainText('เลขที่ 3: ได้รู้เรื่อง BIOS');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/teacher-desktop.png`, fullPage: true });

  // The CSV for Excel: a mark so Thai reads right, a heading and one row per learner.
  const [download] = await Promise.all([page.waitForEvent('download'), teacher(page).getByRole('button', { name: 'ดาวน์โหลด CSV (Excel)' }).click()]);
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv.startsWith('﻿ชั้น,เลขที่,ชื่อ-สกุล')).toBe(true);
  expect(csv.trim().split('\r\n')).toHaveLength(31);
});

test('results files: the latest per learner, an edited one flagged, an unreadable one skipped with its name', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'checked on a phone below');
  await page.goto('/?view=teacher');
  const edited = JSON.parse(JSON.stringify(files[1]!));
  edited.data.post.score = 10;
  const older = { ...files[0]!, exportedAt: 1 };
  const as = (name: string, v: unknown) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)) });
  await teacher(page)
    .locator('input[type="file"]')
    .setInputFiles([as('a.json', files[0]), as('a-old.json', older), as('b.json', edited), as('c.json', files[2]), as('notes.json', 'hello')]);
  await expect(teacher(page).getByTestId('teacher-count')).toHaveText('ผู้เรียน 3 คน · ทำแบบทดสอบครบก่อนและหลัง 3 คน');
  await expect(teacher(page).locator('.teacher-skipped summary')).toHaveText('ข้าม 1 รายการที่อ่านไม่ได้');
  await expect(teacher(page).locator('.teacher-skipped li')).toHaveText(['notes.json: ไม่ใช่ไฟล์ผลการเรียน (อ่านไม่ได้)']);
  await expect(teacher(page).locator('.teacher-warn')).toContainText('เลขที่ 2 ถูกแก้ไขหลังดาวน์โหลด');
  await expect(teacher(page).getByTestId('learners').locator('tbody tr.edited')).toHaveCount(1);
  await expect(teacher(page).getByTestId('ttest')).toContainText('อย่างน้อย 5 คน (ตอนนี้ 3 คน)');
});

test("the sheet's Apps Script is on the page to copy or save; a row broken in the sheet is named by its row", async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'checked on a phone below');
  const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  await page.goto('/?view=teacher');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await teacher(page).getByRole('button', { name: 'คัดลอกโค้ด Apps Script' }).click();
  await expect(teacher(page).locator('.teacher-msg')).toHaveText('คัดลอกโค้ดแล้ว นำไปวางใน Apps Script ของ Sheet');
  // Windows' clipboard hands lines back with CRLF; the code is the same.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(code);
  const [download] = await Promise.all([page.waitForEvent('download'), teacher(page).getByRole('link', { name: 'ดาวน์โหลดโค้ด (Code.gs)' }).click()]);
  expect(download.suggestedFilename()).toBe('Code.gs');
  expect(readFileSync((await download.path())!, 'utf8')).toBe(code);

  await page.route(`https://script.google.com/macros/s/${TO}/exec`, (route: Route) => {
    const body = JSON.parse(route.request().postData()!) as { action: string };
    const reply = body.action === 'classes' ? { ok: true, classes: [CLASS] } : { ok: true, files: [JSON.stringify(files[0]), '{"app":"shop-results", แก้'], rows: [2, 5] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  await connect(page);
  await teacher(page).getByRole('button', { name: 'ดูห้องใน Sheet' }).click();
  await teacher(page).getByRole('button', { name: 'ดึงผล' }).click();
  await expect(teacher(page).getByTestId('teacher-count')).toContainText('ผู้เรียน 1 คน');
  await expect(teacher(page).locator('.teacher-skipped li')).toHaveText(['แถวที่ 5: ไม่ใช่ไฟล์ผลการเรียน (อ่านไม่ได้)']);
});

test('a wrong teacher key is said plainly; nothing is read', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'checked on a phone below');
  await sheet(page);
  await connect(page, 'wrong');
  await teacher(page).getByRole('button', { name: 'ดูห้องใน Sheet' }).click();
  await expect(teacher(page).locator('.teacher-msg')).toHaveText('รหัสครูไม่ถูกต้อง');
  await expect(teacher(page).getByTestId('teacher-report')).toHaveCount(0);
});

test('on a phone: the page reads, wide tables scroll inside their box, nothing off the side', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'the desktop is checked above');
  await sheet(page);
  await connect(page);
  await teacher(page).getByLabel(/ชื่อห้อง/).fill(CLASS);
  await expect(teacher(page).locator('.teacher-qr svg')).toBeVisible();
  await teacher(page).getByRole('button', { name: 'ดูห้องใน Sheet' }).click();
  await teacher(page).getByRole('button', { name: 'ดึงผล' }).click();
  await expect(teacher(page).getByTestId('teacher-count')).toContainText('ผู้เรียน 30 คน');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/teacher-${info.project.name}.png` });
});

test('a small gain is reported as not significant', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'checked on a phone above');
  await page.goto('/?view=teacher');
  // Before 5,5,5,5,5 after 6,4,6,5,5: gains 1,−1,1,0,0, t = 0.535, p (one-tailed) ≈ .31.
  const five = [6, 4, 6, 5, 5].map((post, i) => {
    const p = learner(i + 1);
    const sit = (right: number) => ({ ...p.pre!, score: right, answers: Object.fromEntries(items.map((it, k) => [it.id, k < right ? it.answer : (it.answer + 1) % it.choicesTh.length])) });
    return resultsFile({ ...p, pre: sit(5), post: sit(post) }, 1);
  });
  await teacher(page)
    .locator('input[type="file"]')
    .setInputFiles(five.map((f, i) => ({ name: `${i}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(f)) })));
  await expect(teacher(page).getByTestId('ttest')).toContainText('t = 0.535, df = 4, p (ทางเดียว) = 0.31');
  await expect(teacher(page).getByTestId('ttest')).toContainText('อย่างไม่มีนัยสำคัญที่ระดับ .05');
});
