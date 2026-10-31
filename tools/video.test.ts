// npm run test:unit — the lesson videos' running order (src/core/video.ts).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lesson } from '../src/content/schema';
import type { VoiceIndex } from '../src/core/lesson';
import { ASK_MS, audioCues, countdown, demoAt, END_MS, FPS, frames, GAP_MS, lineStart, shotAt, TAIL_MS, timeline, TITLE_MS } from '../src/core/video';

const line = (say: string) => ({ say, board: '', cue: '', set: 'desk', pose: 'stand', face: 'neutral', intern: 'neutral' }) as const;
/** Three lines, a question after the second. */
const LESSON: Lesson = {
  id: 'lesson-os',
  titleTh: 'ทดสอบ',
  objective: 1,
  lines: [line('หนึ่ง'), line('สอง'), line('สาม')],
  questions: [{ after: 2, replay: 1, stemTh: 'ถาม', choicesTh: ['ก', 'ข'], answer: 0, right: { say: 'ถูก' }, wrong: { say: 'อธิบาย' } }],
};
const VOICE: VoiceIndex = {
  voice: 'v',
  rate: '+0%',
  // Each recording runs on 700 ms past its line: the silence the voice leaves after the last word.
  lines: Object.fromEntries(
    ['หนึ่ง', 'สอง', 'สาม', 'อธิบาย'].map((t, i) => [t, { file: `${t}.mp3`, ms: 1000 * (i + 1) + 700, words: [[0, 100], [200, 1000 * (i + 1) - TAIL_MS]] }]),
  ),
};

test('a line lasts until a moment after its last word, not to the end of its recording', () => {
  const tl = timeline(LESSON, VOICE);
  assert.equal(tl.shots[1]!.ms, 1000, 'last word at 850, ends 150 later; the recording is 1700');
  const late: VoiceIndex = { ...VOICE, lines: { ...VOICE.lines, หนึ่ง: { file: 'x.mp3', ms: 900, words: [[0, 850]] } } };
  assert.equal(timeline(LESSON, late).shots[1]!.ms, 900, 'never longer than the recording');
});

test('the running order: title, the lines with gaps, the question after its line then its answer explained, the end', () => {
  const tl = timeline(LESSON, VOICE);
  assert.deepEqual(
    tl.shots.map((s) => [s.kind, s.start, s.ms]),
    [
      ['title', 0, TITLE_MS],
      ['line', TITLE_MS + GAP_MS, 1000],
      ['line', TITLE_MS + 2 * GAP_MS + 1000, 2000],
      ['ask', TITLE_MS + 3 * GAP_MS + 3000, ASK_MS],
      ['reveal', TITLE_MS + 4 * GAP_MS + 3000 + ASK_MS, 4000],
      ['line', TITLE_MS + 5 * GAP_MS + 7000 + ASK_MS, 3000],
      ['end', TITLE_MS + 6 * GAP_MS + 10_000 + ASK_MS, END_MS],
    ],
  );
  assert.equal(tl.ms, TITLE_MS + 6 * GAP_MS + 10_000 + ASK_MS + END_MS, 'no gap after the end');
  const reveal = tl.shots[4]!;
  assert.ok(reveal.kind === 'reveal' && reveal.say === 'อธิบาย' && reveal.q === 0, 'the explanation a wrong answer gets');
  assert.equal(frames(tl), Math.ceil((tl.ms * FPS) / 1000));
});

test('the voice: each recording where its shot starts; a line without one has its reading time and no cue', () => {
  const tl = timeline(LESSON, VOICE);
  assert.deepEqual(audioCues(tl), [
    { file: 'หนึ่ง.mp3', at: TITLE_MS + GAP_MS },
    { file: 'สอง.mp3', at: TITLE_MS + 2 * GAP_MS + 1000 },
    { file: 'อธิบาย.mp3', at: TITLE_MS + 4 * GAP_MS + 3000 + ASK_MS },
    { file: 'สาม.mp3', at: TITLE_MS + 5 * GAP_MS + 7000 + ASK_MS },
  ]);
  const silent = timeline(LESSON, null);
  assert.deepEqual(audioCues(silent), []);
  assert.ok(silent.shots.every((s) => s.ms > 0));
});

test('the shot at a moment: inside it, in the gap after it (still showing), and at the very start and end', () => {
  const tl = timeline(LESSON, VOICE);
  const first = tl.shots[1]!;
  assert.deepEqual([shotAt(tl, 0).shot.kind, shotAt(tl, 0).t], ['title', 0]);
  assert.deepEqual([shotAt(tl, first.start).shot, shotAt(tl, first.start).t], [first, 0]);
  assert.deepEqual([shotAt(tl, first.start + 999).shot, shotAt(tl, first.start + 999).t], [first, 999]);
  assert.equal(shotAt(tl, first.start + 1000 + GAP_MS - 1).shot, first, 'the pause after it');
  assert.equal(shotAt(tl, first.start + 1000 + GAP_MS).shot, tl.shots[2]);
  assert.equal(shotAt(tl, tl.ms).shot.kind, 'end');
});

test('the countdown: 5 down to 1, a second each, then stays at 1 until the answer', () => {
  assert.deepEqual([0, 999, 1000, 2500, 3999, 4000, 4999, 5000, ASK_MS - 1].map(countdown), [5, 5, 4, 3, 2, 1, 1, 1, 1]);
});

test('a demo runs from its first line to its last; lines in a row share it, a question between does not break it', () => {
  const shown: Lesson = {
    ...LESSON,
    lines: [
      { ...line('หนึ่ง'), demo: 'boot' },
      { ...line('สอง'), demo: 'print' },
      { ...line('สาม'), demo: 'print' },
    ],
  };
  const tl = timeline(shown, VOICE);
  const [, one, two, , , three] = tl.shots;
  assert.deepEqual(demoAt(tl, shown, one!.start), { demo: 'boot', p: 0, part: 0 });
  assert.deepEqual(demoAt(tl, shown, one!.start + 500), { demo: 'boot', p: 0.5, part: 0 });
  // "print" runs from line 2's start to line 3's end, over the question between them.
  const start = two!.start;
  const end = three!.start + three!.ms;
  assert.deepEqual(demoAt(tl, shown, start), { demo: 'print', p: 0, part: 0 });
  assert.equal(demoAt(tl, shown, start + 1000)!.p, 1000 / (end - start), 'from the first line, the whole run is the length');
  assert.equal(demoAt(tl, shown, three!.start)!.p, (three!.start - start) / (end - start));
  assert.equal(demoAt(tl, shown, three!.start)!.part, 1, 'the second line of the run, the question between not counted');
  assert.equal(demoAt(tl, shown, two!.start + two!.ms - 1)!.part, 0, 'to the end of the first');
  assert.equal(demoAt(tl, shown, end - 1)!.p < 1, true);
  assert.equal(demoAt(tl, shown, end + GAP_MS - 1)!.p, 1, 'held at its end in the pause after');
  // Not during the title, a question or the end, nor on a line without one.
  assert.equal(demoAt(tl, shown, 0), null);
  assert.equal(demoAt(tl, shown, tl.shots[3]!.start), null);
  assert.equal(demoAt(tl, shown, tl.ms), null);
  assert.equal(demoAt(timeline(LESSON, VOICE), LESSON, one!.start), null);
});

test('where a line starts in the video, for watching that part again', () => {
  const tl = timeline(LESSON, VOICE);
  assert.equal(lineStart(tl, 0), TITLE_MS + GAP_MS);
  assert.equal(lineStart(tl, 2), TITLE_MS + 5 * GAP_MS + 7000 + ASK_MS, 'after the question and its answer');
  assert.equal(lineStart(tl, 9), 0, 'no such line: the start');
});
