// Free play (โหมดอิสระ, docs/phase3-plan.md task A): practice at home that sends nothing to the teacher. It has a
// save of its own, apart from the class's, so playing it never changes what the teacher's sheet holds; every case is
// open at once, and the two lessons and the ordering game are there too, for the technician's book's cards.

import type { Progress, StepId } from './path';
import { EMPTY } from './path';
import type { Route } from './routes';

export const FREE_STORAGE_KEY = 'shop.free.v1';
/** 'free' while the learner is in free play, kept so a reload stays there. */
export const MODE_KEY = 'shop.mode.v1';
export type Mode = 'class' | 'free';

/** Pages free play has: its own menu (on #/learn), the lessons, the ordering game and the shop. No tests, no results. */
export const FREE_ROUTES: readonly Route[] = ['learn', 'lesson-os', 'lesson-types', 'order', 'shop'];
export const freeRoute = (r: Route): Route => (FREE_ROUTES.includes(r) ? r : 'learn');

/** The class's work is over once the reflection is sent after the post-test: the class menu then offers free play. */
export const classFinished = (p: Progress) => p.post !== null && p.reflect !== null;

/** What free play keeps of the class's steps: the lessons and the ordering game (they give cards). */
const PRACTICE: readonly StepId[] = ['lesson-os', 'lesson-types', 'order'];

/**
 * Free play's first save. On a device whose class work is over it starts with what was earned there (coins, the
 * cases and steps the book's cards come from, the cards read, the talks seen); anywhere else, from nothing. Nothing
 * of the learner (name, tests, reflection) is copied, and nothing is ever written back.
 */
export function freeStart(cls: Progress): Progress {
  if (!classFinished(cls)) return EMPTY;
  return {
    ...EMPTY,
    coins: cls.coins,
    done: cls.done.filter((id) => PRACTICE.includes(id)),
    cases: cls.cases,
    order: cls.order,
    lessons: cls.lessons,
    cardsRead: cls.cardsRead,
    seen: cls.seen,
  };
}
