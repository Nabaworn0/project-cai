// The lesson videos' running order (docs/lessons-plan.md, "ส่วนต่อ 2"): a title, the script's lines one after another
// at the voice's pace, each review question shown with a countdown to pause and answer then its answer explained,
// and an end card. Pure: the studio page draws any moment of it, tools/video.ts films it frame by frame.

import type { Lesson } from '../content/schema';
import { utterance, type VoiceIndex } from './lesson';

export const FPS = 30;
export const TITLE_MS = 3500;
/** Silence between two things said, on top of the voice's own breath before its first word. */
export const GAP_MS = 250;
/** A line ends this long after its last word: the recordings carry most of a second of silence after it. */
export const TAIL_MS = 150;
/** The question on screen before its answer: "pause and try", counting down. */
export const ASK_MS = 6000;
export const COUNTDOWN = 5;
export const END_MS = 5000;

interface Said {
  say: string;
  words: [number, number][];
  /** The recording, if there is one. */
  file: string | null;
}
export type Shot = { start: number; ms: number } & (
  { kind: 'title' } | ({ kind: 'line'; at: number } & Said) | { kind: 'ask'; q: number } | ({ kind: 'reveal'; q: number } & Said) | { kind: 'end' }
);

/** A shot before it is given its place. */
type Unstarted = { [K in Shot['kind']]: Omit<Extract<Shot, { kind: K }>, 'start'> }[Shot['kind']];

export interface Timeline {
  shots: Shot[];
  ms: number;
}

/** The whole video: every shot with its start and length (ms). */
export function timeline(lesson: Lesson, voice: VoiceIndex | null): Timeline {
  const shots: Shot[] = [];
  let t = 0;
  const add = (s: Unstarted) => {
    shots.push({ ...s, start: t } as Shot);
    t += s.ms + GAP_MS;
  };
  const said = (say: string) => {
    const u = utterance(say, voice);
    const last = u.words.at(-1)?.[1];
    return { say, words: u.words, file: u.file, ms: last === undefined ? u.ms : Math.min(u.ms, last + TAIL_MS) };
  };
  add({ kind: 'title', ms: TITLE_MS });
  lesson.lines.forEach((l, at) => {
    add({ kind: 'line', at, ...said(l.say) });
    lesson.questions.forEach((q, i) => {
      if (q.after !== at + 1) return;
      add({ kind: 'ask', q: i, ms: ASK_MS });
      // The answer, explained in the words a wrong answer gets in the game.
      add({ kind: 'reveal', q: i, ...said(q.wrong.say) });
    });
  });
  add({ kind: 'end', ms: END_MS });
  return { shots, ms: t - GAP_MS };
}

/** The shot showing at `t` and how far into it; a pause after a shot still shows it. */
export function shotAt(tl: Timeline, t: number): { shot: Shot; t: number } {
  let shot = tl.shots[0]!;
  for (const s of tl.shots) if (s.start <= t) shot = s;
  return { shot, t: t - shot.start };
}

/** Where each recording starts in the video (ms). */
export function audioCues(tl: Timeline): { file: string; at: number }[] {
  return tl.shots.flatMap((s) => ('file' in s && s.file ? [{ file: s.file, at: s.start }] : []));
}

/** Frames in the video. */
export const frames = (tl: Timeline) => Math.ceil((tl.ms * FPS) / 1000);

/** The countdown number `t` ms into a question: 5 … 1. */
export function countdown(t: number): number {
  return Math.max(1, COUNTDOWN - Math.floor(t / ((ASK_MS - 1000) / COUNTDOWN)));
}

/** The demonstration showing at `t` and how far through it (0-1): lines in a row with the same demo share one run,
 *  from the first one's start to the last one's end (questions between them do not break it). `part` is which line
 *  of the run is being said (0 for the first), so a demo can change with the words. Null outside lines. */
export function demoAt(
  tl: Timeline,
  lesson: Lesson,
  t: number,
): { demo: NonNullable<Lesson['lines'][number]['demo']>; p: number; part: number } | null {
  const { shot } = shotAt(tl, t);
  if (shot.kind !== 'line') return null;
  const demo = lesson.lines[shot.at]!.demo;
  if (!demo) return null;
  const lines = tl.shots.filter((s) => s.kind === 'line');
  const k = lines.indexOf(shot);
  let a = k;
  let b = k;
  const same = (i: number) => lines[i]?.kind === 'line' && lesson.lines[lines[i].at]!.demo === demo;
  while (a > 0 && same(a - 1)) a--;
  while (b < lines.length - 1 && same(b + 1)) b++;
  const start = lines[a]!.start;
  const end = lines[b]!.start + lines[b]!.ms;
  return { demo, p: Math.min(1, Math.max(0, (t - start) / (end - start))), part: k - a };
}

/** Where line `at` starts in the video (ms): "watch that part again" after a wrong answer. */
export function lineStart(tl: Timeline, at: number): number {
  return tl.shots.find((s) => s.kind === 'line' && s.at === at)?.start ?? 0;
}
