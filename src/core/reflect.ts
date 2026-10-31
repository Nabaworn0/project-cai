// The reflection after learning (docs/reflect-plan.md): the learner's own stars for the four objectives, three
// short written answers and the satisfaction form. Pure: the page keeps the answers, this says what is missing.
// Sent once; the teacher's page (item 7) reads what was sent.

import type { Reflect } from '../content/schema';

/** The satisfaction form's five levels, highest first (the usual Thai Likert wording). */
export const LEVELS = [
  { value: 5, th: 'มากที่สุด' },
  { value: 4, th: 'มาก' },
  { value: 3, th: 'ปานกลาง' },
  { value: 2, th: 'น้อย' },
  { value: 1, th: 'น้อยที่สุด' },
] as const;

/** A written answer needs at least this many letters (spaces not counted). */
export const MIN_WRITE = 5;
/** Longest written answer kept. */
export const MAX_WRITE = 500;

export interface ReflectAnswers {
  /** Self-check id -> stars 1-5. */
  self: Record<string, number>;
  /** Written question id -> text. */
  write: Record<string, string>;
  /** Satisfaction item id -> level 1-5. */
  sat: Record<string, number>;
  /** Suggestions, may be empty. */
  suggest: string;
}

/** What was sent, and when (ms since 1970). */
export interface ReflectResult extends ReflectAnswers {
  at: number;
}

export const NO_ANSWERS: ReflectAnswers = { self: {}, write: {}, sat: {}, suggest: '' };

const letters = (s: string) => s.replace(/\s/g, '').length;

/** The ids still to answer, in the order they are on the page (empty: ready to send). */
export function missing(r: Reflect, a: ReflectAnswers): string[] {
  return [
    ...r.self.filter((s) => !a.self[s.id]).map((s) => s.id),
    ...r.write.filter((w) => letters(a.write[w.id] ?? '') < MIN_WRITE).map((w) => w.id),
    ...r.satisfaction.filter((s) => !a.sat[s.id]).map((s) => s.id),
  ];
}

/** The answers as sent: only this form's items, the texts trimmed and cut to MAX_WRITE. */
export function sent(r: Reflect, a: ReflectAnswers, at: number): ReflectResult {
  const pick = <T>(m: Record<string, T>, ids: { id: string }[]) => Object.fromEntries(ids.filter((i) => m[i.id] !== undefined).map((i) => [i.id, m[i.id]!]));
  const write = Object.fromEntries(Object.entries(pick(a.write, r.write)).map(([k, v]) => [k, v.trim().slice(0, MAX_WRITE)]));
  return { self: pick(a.self, r.self), write, sat: pick(a.sat, r.satisfaction), suggest: a.suggest.trim().slice(0, MAX_WRITE), at };
}
