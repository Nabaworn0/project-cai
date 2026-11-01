// The technician's book (src/core/book.ts, docs/book-plan.md): cards got from the saved progress, unread ones,
// how a missing card is got, and the card for a repair mistake or a problem.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cardForProblem, cardForSlip, hasCard, howToGet, unlockedCards, unreadCards } from '../src/core/book';
import { CardsSchema, FeedbackSchema } from '../src/content/schema';
import { EMPTY, markCardRead, parseProgress, PLAYABLE, recordCase, type Progress } from '../src/core/path';

const data = (path: string) => JSON.parse(readFileSync(new URL(`../src/content/data/${path}`, import.meta.url), 'utf8'));
const { cards, sets } = CardsSchema.parse(data('cards.json'));
const card = (id: string) => cards.find((c) => c.id === id)!;
const slips = Object.keys(FeedbackSchema.parse(data('feedback.json')).slips);

test('sixteen cards in four sets, every set used', () => {
  assert.equal(cards.length, 16);
  assert.equal(sets.length, 4);
  for (const s of sets) assert.ok(cards.some((c) => c.set === s.id), s.id);
});

test('a new learner has no cards; each lesson, the ordering game and each case gives its own', () => {
  assert.equal(unlockedCards(cards, EMPTY).size, 0);
  const lessonOs: Progress = { ...EMPTY, done: ['lesson-os'] };
  assert.deepEqual([...unlockedCards(cards, lessonOs)], ['os-jobs']);
  assert.deepEqual([...unlockedCards(cards, { ...EMPTY, done: ['order'] })], ['install-steps']);
  const case1 = recordCase(EMPTY, 'c01-boot-order', 1);
  assert.deepEqual([...unlockedCards(cards, case1)].sort(), ['boot-menu', 'boot-order']);
  assert.equal(hasCard(card('rufus'), case1), false);
  // Everything done: every card.
  const all = PLAYABLE.reduce((p, id) => recordCase(p, id, 3), { ...EMPTY, done: ['lesson-os', 'lesson-types', 'order'] } as Progress);
  assert.equal(unlockedCards(cards, all).size, cards.length);
});

test('a card is new until opened; opening it twice keeps one record', () => {
  const p = recordCase(EMPTY, 'c01-boot-order', 3);
  assert.deepEqual(unreadCards(cards, p).sort(), ['boot-menu', 'boot-order']);
  const read = markCardRead(markCardRead(p, 'boot-order'), 'boot-order');
  assert.deepEqual(read.cardsRead, ['boot-order']);
  assert.deepEqual(unreadCards(cards, read), ['boot-menu']);
  // A card read but not got (an old save) is not counted as new or got.
  assert.deepEqual(unreadCards(cards, { ...EMPTY, cardsRead: ['rufus'] }), []);
});

test('cards read are saved with the progress; anything else in the list is dropped', () => {
  const p = parseProgress(JSON.stringify({ cardsRead: ['tpm', 'tpm', 3, '', 'rufus'] }));
  assert.deepEqual(p.cardsRead, ['tpm', 'rufus']);
  assert.deepEqual(parseProgress(JSON.stringify({ coins: 5 })).cardsRead, []);
});

test('how a missing card is got: the lesson by name, the ordering game, or the case by number', () => {
  assert.equal(howToGet(card('os-jobs')), 'ดูคลิป "ระบบปฏิบัติการคืออะไร" จบ');
  assert.equal(howToGet(card('os-types')), 'ดูคลิป "ประเภทของระบบปฏิบัติการ" จบ');
  assert.equal(howToGet(card('install-steps')), 'เล่นเรียงขั้นตอนการติดตั้งจบ');
  assert.equal(howToGet(card('boot-order')), 'ผ่านเคส 1');
  assert.equal(howToGet(card('first-setup')), 'ผ่านเคส 5');
});

test('every repair mistake and every case problem opens a card', () => {
  for (const s of slips) assert.ok(cardForSlip(cards, s), s);
  assert.equal(cardForSlip(cards, 'booted-old-windows')!.id, 'boot-order');
  assert.equal(cardForProblem(cards, 'usb-wrong-scheme')!.id, 'gpt-mbr');
  assert.equal(cardForProblem(cards, 'raid-mode'), null);
});
