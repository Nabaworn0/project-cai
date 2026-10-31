// npm run test:unit — the lesson cartoons' rules (src/core/lesson.ts) and their saved progress (src/core/path.ts).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lesson } from '../src/content/schema';
import {
  allSolved,
  answerQuestion,
  BLINK_MS,
  BOARD_FITS,
  blinking,
  boardText,
  firstAnswers,
  MOUTH_MS,
  mouthAt,
  noAnswers,
  readMs,
  solved,
  subtitle,
  utterance,
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

test("subtitles: the spelt-out English words as on screen, longer ones first; a line's own text wins", () => {
  const words = { วินโดวส์: 'Windows', 'วินโดวส์ สิบเอ็ด': 'Windows 11', โอเอส: 'OS', ไอโอเอส: 'iOS' };
  assert.equal(subtitle({ say: 'ตัวอย่างคือวินโดวส์ สิบเอ็ด และวินโดวส์' }, words), 'ตัวอย่างคือ Windows 11 และ Windows');
  assert.equal(
    subtitle({ say: 'แอนดรอยด์ และไอโอเอส ต่างจากโอเอสอื่น' }, words),
    'แอนดรอยด์ และ iOS ต่างจาก OS อื่น',
    'a space only where it touches Thai',
  );
  assert.equal(subtitle({ say: 'โอเอส (โอเอส)' }, words), 'OS (OS)');
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

test('the review questions: every answer kept in order, the first for the teacher; none taken once answered right', () => {
  let a = noAnswers(LESSON);
  assert.deepEqual(a, [[], []]);
  assert.deepEqual(firstAnswers(a), [-1, -1]);
  a = answerQuestion(LESSON, a, 0, 2);
  assert.equal(solved(LESSON, a, 0), false, 'a wrong answer');
  a = answerQuestion(LESSON, a, 0, 1);
  assert.equal(solved(LESSON, a, 0), true, 'right at the second try');
  assert.equal(answerQuestion(LESSON, a, 0, 0), a, 'answered right: no more answers');
  assert.equal(allSolved(LESSON, a), false, 'the second still open');
  a = answerQuestion(LESSON, a, 1, 0);
  assert.deepEqual(a, [[2, 1], [0]]);
  assert.deepEqual(firstAnswers(a), [2, 0], 'the first answer is what the teacher sees');
  assert.equal(allSolved(LESSON, a), true);
});

test('the board: a list too long to show at once shows one item at a time through the line; a short flow whole', () => {
  const item = (n: string) => `${n} (a fairly long English name)`;
  const list = [item('A'), item('B'), item('C'), item('D')].join(' → ');
  assert.ok(list.length > BOARD_FITS);
  assert.deepEqual(
    [0, 999, 1000, 2999, 3000, 3999, 4000, 9999].map((t) => boardText(list, t, 4000)),
    ['A', 'A', 'B', 'C', 'D', 'D', 'D', 'D'].map(item),
  );
  const flow = 'โปรแกรม → OS → Driver → เครื่องพิมพ์';
  assert.equal(boardText(flow, 3000, 4000), flow, 'a short flow is read whole');
  const exactly = `${'x'.repeat(BOARD_FITS - 8)} → b → c`;
  assert.equal(exactly.length, BOARD_FITS);
  assert.equal(boardText(exactly, 3000, 4000), exactly, 'as long as fits: whole');
  assert.equal(boardText(`${exactly}x`, 3000, 4000), 'cx', 'one letter more: one at a time');
  assert.equal(
    boardText('Power On → OS Starts and a long while more to make it longer than sixty letters', 3000, 4000).includes('→'),
    true,
    'two parts are one idea',
  );
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
