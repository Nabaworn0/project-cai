// A lesson (docs/lessons-plan.md V4, src/ui/lesson/): the cartoon video (public/videos, made by tools/video.ts), then
// its two review questions once it has been watched; a wrong answer is explained and can be tried again or that part
// of the video watched again; done once both are right, the first answers kept for the teacher.

import { expect, test, type Page } from '@playwright/test';
import lessons from '../src/content/data/lessons.json' with { type: 'json' };
import voice from '../src/assets/voice/index.json' with { type: 'json' };
import { subtitle, type VoiceIndex } from '../src/core/lesson';
import { lineStart, timeline } from '../src/core/video';
import type { Lesson } from '../src/content/schema';
import { LEARNER, PRE_DONE } from './helpers';

const OS = lessons.lessons[0] as Lesson;
const lesson = (page: Page) => page.getByTestId('lesson');
const clip = (page: Page) => lesson(page).locator('.lesson');
const video = (page: Page) => lesson(page).locator('video');
const menu = (page: Page) => page.getByTestId('menu');
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('shop.progress.v2')!));
const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${project}.png` });
};

async function open(page: Page, progress: Record<string, unknown> = {}) {
  await page.addInitScript((v) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('shop.progress.v2', v);
    localStorage.setItem('seeded', '1');
  }, JSON.stringify({ learner: LEARNER, pre: PRE_DONE, ...progress }));
  await page.goto('/');
  await menu(page).getByRole('button', { name: 'ทำต่อ: บทเรียน: ระบบปฏิบัติการคืออะไร' }).click();
  await expect(lesson(page)).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-shutter', 'idle', { timeout: 15_000 });
}
/** The video played to its end (the browser under test may not decode it, so the end is announced by hand). */
const watchToEnd = (page: Page) => video(page).evaluate((v) => v.dispatchEvent(new Event('ended')));

test('the lesson is its video: served from the game, with the AI note; the questions wait until it has been watched', async ({ page, request }, info) => {
  await open(page);
  await expect(page).toHaveURL(/#\/lesson-os$/);
  await expect(video(page)).toHaveAttribute('src', /\/videos\/lesson-os\.mp4$/);
  await expect(video(page)).toHaveAttribute('controls', '');
  const res = await request.get((await video(page).getAttribute('src'))!);
  expect([res.status(), res.headers()['content-type']]).toEqual([200, 'video/mp4']);
  await expect(lesson(page)).toContainText('ภาพสร้างด้วย AI (ChatGPT) · เสียงพากย์สร้างด้วย AI (Microsoft Edge TTS)');
  await expect(lesson(page).getByTestId('lesson-q')).toHaveCount(0);
  await expect(lesson(page).locator('.lesson-hint')).toContainText('ดูคลิปให้จบ');
  // The whole video fits on the screen at every size, with no sideways scroll.
  await expect(video(page)).toBeInViewport({ ratio: 0.98 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, 'lesson-video', info.project.name);
  expect((await saved(page)).lessons?.['lesson-os']).toBeUndefined();

  // Watched: the two questions, and the lesson remembers it was watched.
  await watchToEnd(page);
  await expect(lesson(page).getByTestId('lesson-q')).toHaveCount(OS.questions.length);
  await expect(lesson(page).locator('.lesson-hint')).toHaveCount(0);
  await expect(clip(page)).toHaveAttribute('data-watched', 'true');
  expect((await saved(page)).lessons['lesson-os']).toEqual({ at: 1, first: [-1, -1] });
  await lesson(page).getByTestId('lesson-q').first().scrollIntoViewIfNeeded();
  await shot(page, 'lesson-questions', info.project.name);
});

test('a wrong answer is explained, can be tried again or its part watched again; both right finishes the lesson', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the page itself is checked at every size above');
  const [q1, q2] = OS.questions;
  await open(page);
  await watchToEnd(page);
  const q = lesson(page).getByTestId('lesson-q');
  await expect(q.first().locator('.lesson-stem')).toHaveText(`1. ${q1!.stemTh}`);

  // Wrong: marked, explained in the senior's words, the choices still open.
  const wrong = q1!.answer === 0 ? 1 : 0;
  await q.first().locator('.lesson-choice').nth(wrong).click();
  await expect(q.first().locator('.lesson-choice').nth(wrong)).toHaveClass(/wrong/);
  await expect(q.first().locator('.lesson-why')).toHaveText(`ยังไม่ถูก ${subtitle(q1!.wrong, lessons.subtitles)}`);
  await expect(q.first().locator('.lesson-choice').nth(q1!.answer)).toBeEnabled();
  // Watch that part again: the video goes to the line the question is about.
  const at = lineStart(timeline(OS, voice as unknown as VoiceIndex), q1!.replay - 1) / 1000;
  expect(at).toBeGreaterThan(5);
  await video(page).evaluate((v) => {
    // The browser under test may not decode the video, so where it is asked to go is noted instead.
    Object.defineProperty(v, 'currentTime', { set: (x: number) => ((v as HTMLElement).dataset.went = String(x)), configurable: true });
  });
  await q.first().getByRole('button', { name: '▶ ดูช่วงนั้นในคลิปอีกครั้ง' }).click();
  expect(Number(await video(page).getAttribute('data-went'))).toBeCloseTo(at, 3);

  // Right: marked, explained, closed; the first answer is still the wrong one.
  await q.first().locator('.lesson-choice').nth(q1!.answer).click();
  await expect(q.first().locator('.lesson-choice').nth(q1!.answer)).toHaveClass(/right/);
  await expect(q.first().locator('.lesson-why')).toHaveText(`ถูกต้อง! ${subtitle(q1!.right, lessons.subtitles)}`);
  await expect(q.first().locator('.lesson-choice').first()).toBeDisabled();
  await expect(q.first().getByRole('button', { name: /ดูช่วงนั้น/ })).toHaveCount(0);
  expect((await saved(page)).done ?? []).not.toContain('lesson-os');
  await q.nth(1).locator('.lesson-choice').nth(q2!.answer).click();
  await expect(lesson(page)).toContainText('จบบทเรียนแล้ว เก่งมาก!');
  await shot(page, 'lesson-end', info.project.name);
  // Done: the first answers kept for the teacher, the card done.
  expect((await saved(page)).lessons['lesson-os']).toEqual({ at: 0, first: [wrong, q2!.answer] });
  expect((await saved(page)).done).toContain('lesson-os');
  await lesson(page).getByRole('button', { name: 'กลับเส้นทางเรียน' }).click();
  await expect(menu(page).locator('[data-step="lesson-os"]')).toHaveAttribute('data-status', 'done');
});

test('watched before: the questions are open straight away', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the page itself is checked at every size above');
  await open(page, { lessons: { 'lesson-os': { at: 1, first: [-1, -1] } } });
  await expect(lesson(page).getByTestId('lesson-q')).toHaveCount(2);
});

test('reaching the end card counts as watched, without waiting for the very end', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the page itself is checked at every size above');
  await open(page);
  await expect(lesson(page).getByTestId('lesson-q')).toHaveCount(0);
  await video(page).evaluate((v) => {
    Object.defineProperty(v, 'duration', { value: 100 });
    Object.defineProperty(v, 'currentTime', { value: 94, configurable: true });
    v.dispatchEvent(new Event('timeupdate'));
  });
  await expect(lesson(page).getByTestId('lesson-q')).toHaveCount(0, { timeout: 500 });
  await video(page).evaluate((v) => {
    Object.defineProperty(v, 'currentTime', { value: 96, configurable: true });
    v.dispatchEvent(new Event('timeupdate'));
  });
  await expect(lesson(page).getByTestId('lesson-q')).toHaveCount(2);
});
