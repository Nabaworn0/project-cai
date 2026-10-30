// npm run test:unit — the lesson cartoons' clock (src/core/lesson.ts) and their saved progress (src/core/path.ts).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lesson } from '../src/content/schema';
import {
  answer,
  BLINK_MS,
  blinking,
  finished,
  firstAnswers,
  MOUTH_MS,
  mouthAt,
  readMs,
  saying,
  scenes,
  seek,
  startClip,
  step,
  subtitle,
  tryAgain,
  utterance,
  watchAgain,
  type ClipState,
  type VoiceIndex,
} from '../src/core/lesson';
import { EMPTY, parseProgress, recordLesson } from '../src/core/path';

const line = (say: string, set: Lesson['lines'][number]['set'] = 'desk') =>
  ({ say, board: '', cue: '', set, pose: 'stand', face: 'neutral', intern: 'neutral' }) as const;
/** Four lines; a question after line 2 (back to line 1 when wrong) and one after line 4. */
const LESSON: Lesson = {
  id: 'lesson-os',
  titleTh: 'ทดสอบ',
  objective: 1,
  lines: [line('หนึ่ง'), line('สอง'), line('สาม', 'screen'), line('สี่', 'screen')],
  questions: [
    { after: 2, replay: 1, stemTh: 'ถาม 1', choicesTh: ['ก', 'ข', 'ค'], answer: 1, right: { say: 'ถูก 1' }, wrong: { say: 'ผิด 1' } },
    { after: 4, replay: 3, stemTh: 'ถาม 2', choicesTh: ['ก', 'ข'], answer: 0, right: { say: 'ถูก 2' }, wrong: { say: 'ผิด 2' } },
  ],
};
/** Every line 1 s, except "สอง" (2 s); the answers' feedback 0.5 s. */
const VOICE: VoiceIndex = {
  voice: 'v',
  rate: '+0%',
  lines: Object.fromEntries(
    ['หนึ่ง', 'สอง', 'สาม', 'สี่', 'ถูก 1', 'ผิด 1', 'ถูก 2', 'ผิด 2'].map((t) => [
      t,
      { file: `${t}.mp3`, ms: t === 'สอง' ? 2000 : t.startsWith('ถูก') || t.startsWith('ผิด') ? 500 : 1000, words: [[0, 300]] },
    ]),
  ),
};
const run = (s: ClipState, ms: number, speed = 1) => step(LESSON, s, ms, VOICE, speed);

test("subtitles: the spelt-out English words as on screen, longer ones first; a line's own text wins", () => {
  const words = { วินโดวส์: 'Windows', 'วินโดวส์ สิบเอ็ด': 'Windows 11', โอเอส: 'OS', ไอโอเอส: 'iOS' };
  assert.equal(subtitle({ say: 'ตัวอย่างคือวินโดวส์ สิบเอ็ด และวินโดวส์' }, words), 'ตัวอย่างคือWindows 11 และWindows');
  assert.equal(subtitle({ say: 'แอนดรอยด์ และไอโอเอส ต่างจากโอเอสอื่น' }, words), 'แอนดรอยด์ และiOS ต่างจากOSอื่น');
  assert.equal(subtitle({ say: 'วินโดวส์', th: 'เขียนเอง' }, words), 'เขียนเอง');
  assert.equal(subtitle({ say: 'ไม่มีคำ (a+b)' }, {}), 'ไม่มีคำ (a+b)');
  assert.equal(subtitle({ say: 'a.b axb' }, { 'a.b': 'X' }), 'X axb', 'a dot in a word is a dot, not any letter');
});

test("a recorded line takes its recording's time; without one, its reading time, the mouth still moving", () => {
  assert.deepEqual(utterance('สอง', VOICE), { say: 'สอง', ms: 2000, words: [[0, 300]], file: 'สอง.mp3' });
  const u = utterance('ไม่มีเสียงประโยคนี้', VOICE);
  assert.equal(u.file, null);
  assert.equal(u.ms, readMs('ไม่มีเสียงประโยคนี้'));
  assert.equal(readMs('abcd'), 1200 + 4 * 70);
  assert.ok(u.words.length >= 3, 'pretend words');
  assert.ok(
    u.words.every(([a, b], i) => a < b && b <= u.ms && (i === 0 || a > u.words[i - 1]![1])),
    'in order, apart, inside the line',
  );
  assert.equal(utterance('สอง', null).file, null);
});

test('lines one after another, at the speed picked; the clip starts where it was left', () => {
  let s = startClip(LESSON);
  assert.deepEqual([s.phase, s.at, s.t], ['line', 0, 0]);
  s = run(s, 600);
  assert.deepEqual([s.phase, s.at, s.t], ['line', 0, 600]);
  s = run(s, 399);
  assert.deepEqual([s.phase, s.at, s.t], ['line', 0, 999], 'still saying it 1 ms before its end');
  s = run(s, 1);
  assert.deepEqual([s.phase, s.at, s.t], ['line', 1, 0], 'the next line once the first is said');
  s = run(s, 800, 1.25);
  assert.equal(s.t, 1000, '0.8 s at 1.25x is 1 s of the line');
  assert.equal(startClip(LESSON, 2).at, 2);
  assert.equal(startClip(LESSON, 99).at, 3, 'a saved place past the end is the last line');
  assert.equal(startClip(LESSON, -5).at, 0);
  assert.deepEqual(startClip(LESSON).answers, [[], []]);
});

test('a question after its line: nothing moves until it is answered; wrong says why, then watch again or try again', () => {
  let s = run(run(startClip(LESSON), 1000), 2000);
  assert.deepEqual([s.phase, s.q, s.at], ['ask', 0, 1]);
  assert.equal(saying(LESSON, s, VOICE), null);
  assert.deepEqual(run(s, 5000), s, 'waiting for the learner');
  s = answer(LESSON, s, 2);
  assert.deepEqual([s.phase, s.right], ['feedback', false]);
  assert.equal(saying(LESSON, s, VOICE)!.say, 'ผิด 1');
  s = run(s, 500);
  assert.equal(s.phase, 'retry');
  assert.deepEqual(run(s, 5000), s, 'waiting for the learner');
  // Watch again: back to the line the question is about, then asked again after line 2.
  const again = watchAgain(LESSON, s);
  assert.deepEqual([again.phase, again.at, again.t], ['line', 0, 0]);
  assert.equal(run(run(again, 1000), 2000).phase, 'ask', 'still unsolved, so asked again');
  // Try again: right this time; why it is right, then on to line 3.
  s = tryAgain(s);
  assert.equal(s.phase, 'ask');
  s = answer(LESSON, s, 1);
  assert.deepEqual([s.phase, s.right], ['feedback', true]);
  assert.equal(saying(LESSON, s, VOICE)!.say, 'ถูก 1');
  s = run(s, 500);
  assert.deepEqual([s.phase, s.at, s.q], ['line', 2, null]);
  assert.deepEqual(s.answers, [[2, 1], []]);
  assert.deepEqual(firstAnswers(s), [2, -1], 'the first answer is what the teacher sees');
});

test('answering, trying again and watching again only work when they should', () => {
  const s = startClip(LESSON);
  assert.equal(answer(LESSON, s, 0), s, 'no question being asked');
  assert.equal(tryAgain(s), s);
  assert.equal(watchAgain(LESSON, s), s);
});

test('finished at the end with every question answered right; skipping past a question does not count it', () => {
  let s = run(run(startClip(LESSON), 1000), 2000);
  s = run(answer(LESSON, s, 1), 500);
  s = run(run(s, 1000), 1000);
  assert.deepEqual([s.phase, s.q], ['ask', 1]);
  s = run(answer(LESSON, s, 0), 500);
  assert.equal(s.phase, 'end');
  assert.equal(finished(LESSON, s), true);
  assert.deepEqual(firstAnswers(s), [1, 0]);

  // Jump to the last line: question 1 never asked.
  let skip = seek(LESSON, startClip(LESSON), 3);
  skip = run(skip, 1000);
  skip = run(answer(LESSON, skip, 0), 500);
  assert.equal(skip.phase, 'end');
  assert.equal(finished(LESSON, skip), false);
  // A question answered right is not asked again when its line is watched again.
  const back = run(seek(LESSON, s, 1), 2000);
  assert.deepEqual([back.phase, back.at], ['line', 2]);
  assert.deepEqual(seek(LESSON, s, 99).at, 3);
});

test('scenes start where the set changes', () => {
  assert.deepEqual(scenes(LESSON), [0, 2]);
});

test('the mouth: shut between words, small and wide in turn during one', () => {
  const words: [number, number][] = [
    [100, 400],
    [500, 600],
  ];
  assert.equal(mouthAt(words, 0), 'closed');
  assert.equal(mouthAt(words, 100), 'small');
  assert.equal(mouthAt(words, 100 + MOUTH_MS - 1), 'small');
  assert.equal(mouthAt(words, 100 + MOUTH_MS), 'wide');
  assert.equal(mouthAt(words, 100 + 2 * MOUTH_MS), 'small');
  assert.equal(mouthAt(words, 400), 'closed', 'the word is over');
  assert.equal(mouthAt(words, 450), 'closed');
  assert.equal(mouthAt(words, 500), 'small');
  assert.equal(mouthAt([], 100), 'closed');
});

test('blinks: a moment at the end of each uneven gap, and the pattern repeats', () => {
  assert.equal(blinking(0), false);
  assert.equal(blinking(3100 - BLINK_MS - 1), false);
  assert.equal(blinking(3100 - BLINK_MS), true);
  assert.equal(blinking(3099), true);
  assert.equal(blinking(3100), false);
  assert.equal(blinking(3100 + 4300 - 1), true, 'the second gap is longer');
  assert.equal(blinking(3100 + 3000), false);
  const cycle = 3100 + 4300 + 2600 + 3700;
  for (const t of [0, 3000, 3050, 7399, 9999, 13699]) assert.equal(blinking(t + cycle), blinking(t));
  let shut = 0;
  for (let t = 0; t < cycle; t += 10) shut += blinking(t) ? 10 : 0;
  assert.equal(shut, 4 * BLINK_MS, 'four blinks a cycle');
});

test('lesson progress: where it was left and the first answers; done marks the step and starts it over', () => {
  let p = recordLesson(EMPTY, 'lesson-os', { at: 5, first: [2, -1], done: false });
  assert.deepEqual(p.lessons['lesson-os'], { at: 5, first: [2, -1] });
  assert.equal(p.done.includes('lesson-os'), false);
  p = recordLesson(p, 'lesson-os', { at: 9, first: [1, 0], done: false });
  assert.deepEqual(p.lessons['lesson-os'], { at: 9, first: [2, 0] }, 'a first answer stays, a new one is added');
  p = recordLesson(p, 'lesson-os', { at: 21, first: [1, 1], done: true });
  assert.deepEqual(p.lessons['lesson-os'], { at: 0, first: [2, 0] });
  assert.ok(p.done.includes('lesson-os'));
  assert.deepEqual(parseProgress(JSON.stringify(p)).lessons, p.lessons, 'saved and read back');
});

test('saved lesson progress that cannot be right is dropped, entry by entry', () => {
  const p = parseProgress(
    JSON.stringify({
      lessons: {
        'lesson-os': { at: 3, first: [0, -1] },
        'lesson-types': { at: -1, first: [] },
        nonsense: { at: 1, first: [] },
        order: { at: 1, first: [0.5] },
      },
    }),
  );
  assert.deepEqual(p.lessons, { 'lesson-os': { at: 3, first: [0, -1] } });
  assert.deepEqual(parseProgress(JSON.stringify({ lessons: [1, 2] })).lessons, {});
  assert.deepEqual(parseProgress(JSON.stringify({ lessons: { 'lesson-os': { at: 1, first: [-2] } } })).lessons, {});
  assert.deepEqual(parseProgress(null).lessons, {});
});
