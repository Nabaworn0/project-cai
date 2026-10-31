// The lesson cartoons' rules (docs/lessons-plan.md): what the senior says and when his mouth is open (the voice's
// timings come from src/assets/voice/index.json, tools/voice.py; without a recording a line takes its reading time),
// the words on the board and under the picture, and the review questions answered after the video.
// Pure: the video studio (src/studio) draws from it, the lesson page (src/ui/lesson) keeps the answers.

import type { Lesson } from '../content/schema';

/** One recorded line: its file, length and when each word starts and ends (ms). */
export interface VoiceLine {
  file: string;
  ms: number;
  words: [number, number][];
}
export interface VoiceIndex {
  voice: string;
  rate: string;
  lines: Record<string, VoiceLine>;
}

/** Something said: its text, how long it takes, and when the mouth is open. */
export interface Utterance {
  say: string;
  ms: number;
  words: [number, number][];
  /** The recording, if there is one. */
  file: string | null;
}

/** How long a line takes to read with no recording: a pause plus a little per letter. */
export function readMs(text: string): number {
  return 1200 + 70 * [...text].length;
}

/** Pretend words for a line with no recording, so the mouth still moves: about 4 a second, a beat apart. */
function fakeWords(ms: number): [number, number][] {
  const out: [number, number][] = [];
  for (let t = 150; t + 200 <= ms - 300; t += 260) out.push([t, t + 200]);
  return out;
}

export function utterance(say: string, voice: VoiceIndex | null): Utterance {
  const v = voice?.lines[say];
  if (v) return { say, ms: v.ms, words: v.words, file: v.file };
  const ms = readMs(say);
  return { say, ms, words: fakeWords(ms), file: null };
}

/** The subtitle of a line: its own `th`, or `say` with the spelt-out English words written as on screen.
 *  Longer words first, so "วินโดวส์ สิบเอ็ด" becomes "Windows 11", not "Windows สิบเอ็ด"; spaced from the Thai around it. */
export function subtitle(line: { say: string; th?: string }, words: Record<string, string>): string {
  if (line.th) return line.th;
  const keys = Object.keys(words).sort((a, b) => b.length - a.length);
  if (!keys.length) return line.say;
  const re = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  // Thai runs words together, English does not: a word swapped in gets a space where it touches Thai letters.
  const thai = (c: string | undefined) => !!c && /[฀-๿]/.test(c);
  return line.say.replace(re, (k, at: number, all: string) => `${thai(all[at - 1]) ? ' ' : ''}${words[k]!}${thai(all[at + k.length]) ? ' ' : ''}`);
}

/** Longer than this, a list on the board is shown one item at a time. */
export const BOARD_FITS = 60;

/** The board's words `t` ms into a line `ms` long: a list too long to show at once ("A → B → C", three or more
 *  items, longer than BOARD_FITS) shows one item at a time, each for an even share of the line; a short flow such
 *  as "OS → Driver → Printer" and anything else as it is. */
export function boardText(board: string, t: number, ms: number): string {
  const parts = board.split(' → ');
  if (parts.length < 3 || board.length <= BOARD_FITS) return board;
  return parts[Math.min(parts.length - 1, Math.floor((t / ms) * parts.length))]!;
}

/** The review questions after a lesson video: every answer given to each, in order (the first is what the
 *  teacher sees). A wrong answer can be tried again as often as needed. */
export type Answers = number[][];

export const noAnswers = (lesson: Lesson): Answers => lesson.questions.map(() => []);

/** The learner picks `choice` for question `q`; once it is answered right it takes no more answers. */
export function answerQuestion(lesson: Lesson, answers: Answers, q: number, choice: number): Answers {
  if (solved(lesson, answers, q)) return answers;
  return answers.map((a, i) => (i === q ? [...a, choice] : a));
}

/** Question `q` has been answered right (at any try). */
export const solved = (lesson: Lesson, answers: Answers, q: number) => answers[q]!.includes(lesson.questions[q]!.answer);

/** Every question answered right: the lesson is done. */
export const allSolved = (lesson: Lesson, answers: Answers) => lesson.questions.every((_, i) => solved(lesson, answers, i));

/** The first answer to each question, for the teacher's page (-1 when not answered). */
export function firstAnswers(answers: Answers): number[] {
  return answers.map((a) => a[0] ?? -1);
}

export type Mouth = 'closed' | 'small' | 'wide';
/** How long one mouth shape shows while a word is said. */
export const MOUTH_MS = 90;

/** The mouth `t` ms into an utterance: open during words, small and wide in turn, shut between them. */
export function mouthAt(words: readonly [number, number][], t: number): Mouth {
  const w = words.find(([a, b]) => t >= a && t < b);
  if (!w) return 'closed';
  return Math.floor((t - w[0]) / MOUTH_MS) % 2 ? 'wide' : 'small';
}

/** Eyes shut for a moment every few seconds, at uneven times so it does not look mechanical. */
export const BLINK_MS = 130;
export function blinking(time: number): boolean {
  const gaps = [3100, 4300, 2600, 3700];
  const cycle = gaps.reduce((a, b) => a + b, 0);
  let t = time % cycle;
  for (const g of gaps) {
    if (t < g) return t >= g - BLINK_MS;
    t -= g;
  }
  return false;
}
