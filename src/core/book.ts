// The technician's book (docs/book-plan.md): which knowledge cards the learner has, worked out from the progress
// already saved (a lesson or the ordering game done, a case played), never stored on its own; which of them are
// still unread; and the card that explains a problem or a repair mistake, for the case summary's links.

import type { Cards } from '../content/schema';
import { PLAYABLE, STEP_INFO, STEPS, type Progress, type StepId } from './path';

export type Card = Cards['cards'][number];

const isStep = (id: string): id is StepId => (STEPS as readonly string[]).includes(id);

/** The learner has this card: its lesson or the ordering game is done, or its case has been played. */
export function hasCard(card: Card, p: Progress): boolean {
  if (isStep(card.from)) return p.done.includes(card.from);
  return (p.cases[card.from]?.plays ?? 0) > 0;
}

export const unlockedCards = (cards: readonly Card[], p: Progress) => new Set(cards.filter((c) => hasCard(c, p)).map((c) => c.id));

/** Cards the learner has but has not opened yet ("ใหม่!"). */
export const unreadCards = (cards: readonly Card[], p: Progress) => cards.filter((c) => hasCard(c, p) && !p.cardsRead.includes(c.id)).map((c) => c.id);

/** How a card not got yet is got, for its "???" tile. */
export function howToGet(card: Card): string {
  if (card.from === 'order') return `เล่น${STEP_INFO.order.th}จบ`;
  if (isStep(card.from)) return `ดูคลิป${STEP_INFO[card.from].th.replace('บทเรียน: ', ' "')}" จบ`;
  return `ผ่านเคส ${PLAYABLE.indexOf(card.from) + 1}`;
}

export const cardForSlip = (cards: readonly Card[], slip: string) => cards.find((c) => c.slips.includes(slip)) ?? null;
export const cardForProblem = (cards: readonly Card[], problem: string) => cards.find((c) => c.problems.includes(problem)) ?? null;
