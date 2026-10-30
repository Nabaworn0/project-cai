// The lesson cartoons' clock (docs/lessons-plan.md task B): the senior says the lines one by one, stops at a
// question until it is answered right, says why after each answer, and the clip ends after the last line.
// Pure: the player passes the time that went by; the voice's timings come from src/assets/voice/index.json
// (tools/voice.py). Without a recording a line takes its reading time, and his mouth still moves.

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

/** Playback speeds the learner can pick. */
export const SPEEDS = [1, 1.25] as const;

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
 *  Longer words first, so "วินโดวส์ สิบเอ็ด" becomes "Windows 11", not "Windows สิบเอ็ด". */
export function subtitle(line: { say: string; th?: string }, words: Record<string, string>): string {
  if (line.th) return line.th;
  const keys = Object.keys(words).sort((a, b) => b.length - a.length);
  if (!keys.length) return line.say;
  const re = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return line.say.replace(re, (k) => words[k]!);
}

/** Where a clip is. `line`: saying line `at` · `ask`: waiting for an answer to question `q` · `feedback`: saying
 *  why the answer was right or wrong · `retry`: after a wrong answer, waiting for "watch again" or "try again" ·
 *  `end`: after the last line. `t` is the time into what is being said. */
export type Phase = 'line' | 'ask' | 'feedback' | 'retry' | 'end';
export interface ClipState {
  phase: Phase;
  at: number;
  t: number;
  /** The question being asked or answered. */
  q: number | null;
  /** Whether the last answer was right (for `feedback`). */
  right: boolean;
  /** Every answer given, per question, in order: the first is what the teacher sees. */
  answers: number[][];
}

export function startClip(lesson: Lesson, at = 0): ClipState {
  return {
    phase: 'line',
    at: Math.min(Math.max(0, at), lesson.lines.length - 1),
    t: 0,
    q: null,
    right: false,
    answers: lesson.questions.map(() => []),
  };
}

const solved = (lesson: Lesson, s: ClipState, q: number) => s.answers[q]!.includes(lesson.questions[q]!.answer);

/** What is being said now, if anything. */
export function saying(lesson: Lesson, s: ClipState, voice: VoiceIndex | null): Utterance | null {
  if (s.phase === 'line') return utterance(lesson.lines[s.at]!.say, voice);
  if (s.phase === 'feedback') {
    const q = lesson.questions[s.q!]!;
    return utterance((s.right ? q.right : q.wrong).say, voice);
  }
  return null;
}

/** After line `at` has been said: its unsolved question, the next line, or the end. */
function afterLine(lesson: Lesson, s: ClipState): ClipState {
  const q = lesson.questions.findIndex((x, i) => x.after === s.at + 1 && !solved(lesson, s, i));
  if (q >= 0) return { ...s, phase: 'ask', q, t: 0 };
  if (s.at + 1 < lesson.lines.length) return { ...s, phase: 'line', at: s.at + 1, t: 0, q: null };
  return { ...s, phase: 'end', t: 0, q: null };
}

/** Moves the clip on by `dt` ms of play at `speed`. Waiting for the learner, nothing moves. */
export function step(lesson: Lesson, s: ClipState, dt: number, voice: VoiceIndex | null, speed = 1): ClipState {
  const u = saying(lesson, s, voice);
  if (!u) return s;
  const t = s.t + dt * speed;
  if (t < u.ms) return { ...s, t };
  if (s.phase === 'line') return afterLine(lesson, s);
  // Feedback said: on to the next line when right, else the learner chooses.
  return s.right ? afterLine(lesson, { ...s, at: lesson.questions[s.q!]!.after - 1 }) : { ...s, phase: 'retry', t: 0 };
}

/** The learner's answer to the question being asked. */
export function answer(lesson: Lesson, s: ClipState, choice: number): ClipState {
  if (s.phase !== 'ask' || s.q === null) return s;
  const answers = s.answers.map((a, i) => (i === s.q ? [...a, choice] : a));
  return { ...s, phase: 'feedback', t: 0, right: choice === lesson.questions[s.q]!.answer, answers };
}

/** After a wrong answer: ask again. */
export function tryAgain(s: ClipState): ClipState {
  return s.phase === 'retry' ? { ...s, phase: 'ask', t: 0 } : s;
}

/** Jumps to line `at` (the scene bar, back/next, "watch that part again"). Answers are kept. */
export function seek(lesson: Lesson, s: ClipState, at: number): ClipState {
  return { ...s, phase: 'line', at: Math.min(Math.max(0, at), lesson.lines.length - 1), t: 0, q: null };
}

/** After a wrong answer: back to the part the question is about. */
export function watchAgain(lesson: Lesson, s: ClipState): ClipState {
  return s.phase === 'retry' && s.q !== null ? seek(lesson, s, lesson.questions[s.q]!.replay - 1) : s;
}

/** Done once the end is reached with every question answered right (skipping ahead does not count them). */
export function finished(lesson: Lesson, s: ClipState): boolean {
  return s.phase === 'end' && lesson.questions.every((_, i) => solved(lesson, s, i));
}

/** The first answer to each question, for the teacher's page (-1 when not answered). */
export function firstAnswers(s: ClipState): number[] {
  return s.answers.map((a) => a[0] ?? -1);
}

/** Scenes for the progress bar: runs of lines on the same set, by their first line. */
export function scenes(lesson: Lesson): number[] {
  return lesson.lines.flatMap((l, i) => (i === 0 || lesson.lines[i - 1]!.set !== l.set ? [i] : []));
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
