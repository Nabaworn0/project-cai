// The lesson video studio (?view=studio, src/studio): each moment of the running order (src/core/video.ts) drawn
// as tools/video.ts films it: the title, a line with the senior talking and its subtitle, a question counting down,
// its answer explained, and the end card naming the AI used.

import { expect, test, type Page } from '@playwright/test';
import lessons from '../src/content/data/lessons.json' with { type: 'json' };
import voice from '../src/assets/voice/index.json' with { type: 'json' };
import type { Lesson } from '../src/content/schema';
import type { VoiceIndex } from '../src/core/lesson';
import { subtitle } from '../src/core/lesson';
import { ASK_MS, timeline } from '../src/core/video';

const OS = lessons.lessons[0] as Lesson;
const tl = timeline(OS, voice as unknown as VoiceIndex);
const studio = (page: Page) => page.locator('.studio');
const seek = (page: Page, t: number) => page.evaluate((x) => window.studio!.seek(x), t);

test.use({ viewport: { width: 1280, height: 720 } });

test('every moment of the video, drawn as it is filmed', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the video is one size');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?view=studio&lesson=lesson-os');
  await page.waitForFunction(() => window.studio?.ready);
  expect(await page.evaluate(() => [window.studio!.ms, window.studio!.cues.length])).toEqual([
    tl.ms,
    tl.shots.filter((s) => 'file' in s && s.file).length,
  ]);
  const box = (await studio(page).boundingBox())!;
  expect([box.width, box.height]).toEqual([1280, 720]);

  // The moment already showing answers too (the film starts at 0).
  await seek(page, 0);
  await seek(page, 1000);
  await expect(studio(page)).toHaveAttribute('data-kind', 'title');
  await expect(studio(page).locator('.studio-card h1')).toHaveText(OS.titleTh);

  // A line: its words on the screen, its subtitle, his pose; his mouth open during a word, shut between.
  const shot = tl.shots.find((s) => s.kind === 'line' && OS.lines[s.at]!.pose === 'point-right')!;
  if (shot.kind !== 'line') throw new Error('no line');
  const l = OS.lines[shot.at]!;
  const [a, b] = shot.words[1]!;
  await seek(page, shot.start + a + 1);
  await expect(studio(page)).toHaveAttribute('data-kind', 'line');
  await expect(studio(page)).toHaveAttribute('data-pose', 'point-right');
  await expect(studio(page)).toHaveAttribute('data-mouth', 'small');
  await expect(studio(page).locator('[data-frame="mouth-small"]')).toHaveCount(1);
  // The script's words for the line in the tag over the screen (the screen shows the working).
  await expect(studio(page).locator('.studio-caption')).toHaveText(l.board);
  await expect(studio(page).locator('.studio-sub')).toHaveText(subtitle(l, lessons.subtitles));
  await seek(page, shot.start + shot.ms + 100);
  await expect(studio(page)).toHaveAttribute('data-mouth', 'closed', { timeout: 1 });
  await expect(studio(page).locator('[data-frame^="mouth-"]')).toHaveCount(0);
  expect(b).toBeGreaterThan(a);

  // The screen shows the working, not words: the boot goes from the power button to the desktop as the line goes on.
  const boot = tl.shots.find((s) => s.kind === 'line' && OS.lines[s.at]!.demo === 'boot')!;
  const stages: string[] = [];
  for (const f of [0.05, 0.3, 0.55, 0.9]) {
    await seek(page, boot.start + boot.ms * f);
    await expect(studio(page)).toHaveAttribute('data-demo', 'boot');
    stages.push((await studio(page).locator('.d-boot').getAttribute('data-stage'))!);
  }
  expect(stages).toEqual(['off', 'post', 'loading', 'desktop']);
  // Printing: the report in Word, then File > Print, the job on its way, and only at the end of the three lines the paper.
  const prints = tl.shots.filter((s) => s.kind === 'line' && OS.lines[s.at]!.demo === 'print').slice(0, 3);
  const printSteps: string[] = [];
  for (const f of [0.05, 0.38, 0.6, 0.9]) {
    await seek(page, prints[0]!.start + (prints[2]!.start + prints[2]!.ms - prints[0]!.start) * f);
    printSteps.push((await studio(page).locator('.studio-screen [data-step]').getAttribute('data-step'))!);
  }
  expect(printSteps).toEqual(['doc', 'print', 'send', 'paper']);
  await expect(studio(page).locator('.d-paper')).toHaveCount(1);
  await seek(page, prints[2]!.start + prints[2]!.ms - 50);
  expect(
    await studio(page)
      .locator('.d-paper')
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeGreaterThan(30);
  // Every demo moves: its screen at the start of its run is not what it is near the end.
  const groups = new Map<string, { start: number; end: number }>();
  for (const sh of tl.shots) {
    if (sh.kind !== 'line' || !OS.lines[sh.at]!.demo) continue;
    const id = OS.lines[sh.at]!.demo!;
    const g = groups.get(id) ?? { start: sh.start, end: 0 };
    if (!groups.has(id)) groups.set(id, g);
    if (sh.start - g.end < 20_000 || g.end === 0) g.end = sh.start + sh.ms;
  }
  expect(groups.size).toBe(14);
  for (const [id, g] of groups) {
    await seek(page, g.start + 50);
    const first = await studio(page).locator('.studio-screen').innerHTML();
    await seek(page, g.end - 100);
    expect(await studio(page).locator('.studio-screen').innerHTML(), `${id} moves`).not.toBe(first);
  }
  // And moves the right way: what is read at the start of the run, then near its end.
  const step = () => studio(page).locator('.studio-screen [data-step]').getAttribute('data-step').then(String);
  const read: Record<string, () => Promise<string>> = {
    driver: step,
    app: () =>
      studio(page)
        .locator('.d-typed')
        .allTextContents()
        .then((t) => String(t.join('').length > 20)),
    files: step,
    login: step,
    memory: () => studio(page).locator('.d-cells i:not(.free)').count().then(String),
    'no-boot': () => studio(page).locator('.d-nob').getAttribute('data-stage').then(String),
  };
  const expected: Record<string, [string, string]> = {
    driver: ['plug', 'send'],
    app: ['false', 'true'],
    files: ['doc', 'open'],
    login: ['lock', 'desktop'],
    memory: ['1', '5'],
    'no-boot': ['search', 'error'],
  };
  for (const [id, [a, b]] of Object.entries(expected)) {
    const g = groups.get(id)!;
    await seek(page, g.start + 50);
    expect(await read[id]!(), `${id} at the start`).toBe(a);
    await seek(page, g.end - 100);
    expect(await read[id]!(), `${id} near the end`).toBe(b);
  }
  // Saved half way (Save As, then the notice), found in File Explorer, opened again at the end.
  const files = groups.get('files')!;
  await seek(page, files.start + (files.end - files.start) * 0.25);
  expect(await read.files!()).toBe('save');
  await seek(page, files.start + (files.end - files.start) * 0.46);
  expect(await read.files!()).toBe('saved');
  await seek(page, files.start + (files.end - files.start) * 0.65);
  expect(await read.files!()).toBe('explorer');
  // The driver is installed before anything is sent through it, its bar filling up.
  const driver = groups.get('driver')!;
  await seek(page, driver.start + (driver.end - driver.start) * 0.3);
  expect(await read.driver!()).toBe('install');
  expect(await studio(page).locator('.d-bar i').evaluate((e) => parseFloat((e as HTMLElement).style.width))).toBeGreaterThan(20);

  // His face follows the script.
  const happy = tl.shots.find((s) => s.kind === 'line' && OS.lines[s.at]!.face === 'happy')!;
  await seek(page, happy.start + 10);
  await expect(studio(page).locator('[data-frame="face-happy"]')).toHaveCount(1);

  // A question: the choices and the countdown, then the right one marked and explained.
  const ask = tl.shots.find((s) => s.kind === 'ask')!;
  const q = OS.questions[0]!;
  await seek(page, ask.start + 10);
  await expect(studio(page)).toHaveAttribute('data-kind', 'ask');
  await expect(studio(page).locator('.studio-q')).toHaveText(q.stemTh);
  await expect(studio(page).locator('.studio-count b')).toHaveText('5');
  await seek(page, ask.start + ASK_MS - 1500);
  await expect(studio(page).locator('.studio-count b')).toHaveText('1');
  await expect(studio(page).locator('li.right')).toHaveCount(0);
  await seek(page, ask.start + ASK_MS + 500);
  await expect(studio(page)).toHaveAttribute('data-kind', 'reveal');
  await expect(studio(page).locator('li.right')).toContainText(q.choicesTh[q.answer]!);
  await expect(studio(page).locator('.studio-sub')).toHaveText(subtitle(q.wrong, lessons.subtitles));

  await seek(page, tl.ms - 100);
  await expect(studio(page)).toHaveAttribute('data-kind', 'end');
  await expect(studio(page)).toContainText('ภาพสร้างด้วย AI (ChatGPT) · เสียงพากย์สร้างด้วย AI (Microsoft Edge TTS)');
  expect(errors).toEqual([]);
});

const TYPES = lessons.lessons[1] as Lesson;
const tl2 = timeline(TYPES, voice as unknown as VoiceIndex);

test('clip 2: every line shows its devices, the screen changing with the words and nothing spilling off it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the video is one size');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?view=studio&lesson=lesson-types');
  await page.waitForFunction(() => window.studio?.ready);
  const step = () => studio(page).locator('.studio-screen [data-step]').getAttribute('data-step');
  const lines = tl2.shots.filter((s) => s.kind === 'line');
  const seen: Record<string, string[]> = {};
  for (const sh of lines) {
    if (sh.kind !== 'line') continue;
    const demo = TYPES.lines[sh.at]!.demo!;
    expect(demo, `line ${sh.at + 1} has a demo`).toBeTruthy();
    await seek(page, sh.start + sh.ms * 0.9);
    await expect(studio(page)).toHaveAttribute('data-demo', demo);
    if (await studio(page).locator('.studio-screen [data-step]').count()) (seen[demo] ??= []).push((await step())!);
    // Everything the demo puts up stays inside the screen.
    const out = await page.evaluate(() => {
      const s = document.querySelector('.studio-screen')!.getBoundingClientRect();
      return [...document.querySelectorAll('.studio-screen .t-slot.on, .studio-screen .t-kind, .studio-screen .t-label, .studio-screen .d-tag, .studio-screen .t-bin')]
        .map((e) => [e.className, e.getBoundingClientRect()] as const)
        .filter(([, r]) => r.width && (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1))
        .map(([c]) => c);
    });
    expect(out, `line ${sh.at + 1} (${demo}) stays on the screen`).toEqual([]);
  }
  // The pictures change with the words: one system per line, then all three; the phones named, then sorted.
  expect(seen['pc-os']).toEqual(['Windows 11', 'macOS', 'Linux', 'all']);
  expect(seen['mobile']).toEqual(['devices', 'systems', 'sorted']);
  expect(seen['server-os']).toEqual(['windows', 'linux']);
  expect(seen['license']).toEqual(['open', 'compare']);
  expect(seen['look-alike']![0]).toBe('look');
  expect(seen['look-alike']![1]).toBe('sorted');
  expect(seen['three-types']).toEqual(['examples', 'kinds', 'examples']);
  // ChatGPT's pictures are the devices.
  await seek(page, lines[0]!.start + lines[0]!.ms * 0.9);
  for (const c of ['.t-phone img', 'img.t-rack']) await expect(studio(page).locator(c).first()).toBeVisible();
  // The server sends things out to the office: its parcels move along the lines.
  const server = lines.find((s) => s.kind === 'line' && TYPES.lines[s.at]!.demo === 'server')!;
  await seek(page, server.start + server.ms * 0.5);
  const a = await studio(page).locator('.t-packet').first().getAttribute('style');
  await seek(page, server.start + server.ms * 0.55);
  expect(await studio(page).locator('.t-packet').first().getAttribute('style')).not.toBe(a);
  // The two look-alikes start with dark screens, the same.
  const alike = lines.find((s) => s.kind === 'line' && TYPES.lines[s.at]!.demo === 'look-alike')!;
  await seek(page, alike.start + 50);
  expect(await step()).toBe('same');
  expect(errors).toEqual([]);
});
