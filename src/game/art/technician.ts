// Placeholder pixel-art technician (32×39 art px), drawn as text rows in the 16-bit palette.
// Replaced by the ChatGPT character sheet once it is pixelized (tools/pixelize.ts); the expression
// names stay the same so the scene code does not change.

import { overlay, type PixelRows } from './pixels';

export const EXPRESSIONS = ['neutral', 'happy', 'thinking', 'surprised'] as const;
export type Expression = (typeof EXPRESSIONS)[number];

const BASE: PixelRows = [
  '..........KKKKKKKKKKKK..........',
  '........KKHHHHHHHHHHHHKK........',
  '.......KHHHHHhHHHHHhHHHHK.......',
  '......KHHHHHHHHHHHHHHHHHHK......',
  '.....KkKHHHHHHHHHHHHHHHHKkK.....',
  '.....KkHHHHHHHHHHHHHHHHHHkK.....',
  '....KkKHHHSSHHHHHHHHSSHHHKkK....',
  '....KkKHHSSSSHHHHHHSSSSHHKkK....',
  '....KkKHSSSSSSSHHSSSSSSSHKkK....',
  '....KkKSSSSSSSSSSSSSSSSSSKkK....',
  '...KkkKSSSSSSSSSSSSSSSSSSKkkK...',
  '...KkkKSSSSSSSSSSSSSSSSSSKkkK...',
  '...KkkKSSSSSSSSSSSSSSSSSSKkkK...',
  '...KkkKSSSSSSSSSSSSSSSSSSKkkK...',
  '...KkkKSSSSSSSSSSSSSSSSSSKkkK...',
  '.....kKSSSSSSSSSSSSSSSSSSK......',
  '......KSSSSSSSSSSSSSSSSSSK......',
  '.......KSSSSSSSSSSSSSSSSK.......',
  '........KsSSSSSSSSSSSSsK........',
  '..........KKKKKKKKKKKK..........',
  '..............KssK..............',
  '........KKKKKKwSSwKKKKKK........',
  '......KTTTTTTTwwwwTTTTTTTK......',
  '.....KTTTTTTTTTwwTTTTTTTTTK.....',
  '....KTTTTTTTTTTTTTTTTTTTTTTK....',
  '....KTTKTTTTTTTTTTTTTTTTKTTK....',
  '...KTTTKTTTTTTTTTTKKKKTTKTTTK...',
  '...KTTTKTTTTTTTTTTKYYKTTKTTTK...',
  '...KTTTKTTTTTTTTTTKKKKTTKTTTK...',
  '...KtTTKTTTTTTTTTTTTTTTTKTTtK...',
  '...KtTTKTTTTTTTTTTTTTTTTKTTtK...',
  '...KtTTKTTTTTTTTTTTTTTTTKTTtK...',
  '...KtTTKTTTTTTTTTTTTTTTTKTTtK...',
  '...KtTTKTTTTTTTTTTTTTTTTKTTtK...',
  '...KtTTKTTTTTTTTTTTTTTTTKTTtK...',
  '...KtTTKTTTTTTTTTTTTTTTTKTTtK...',
  '...KSSSKTTTTTTTTTTTTTTTTKSSSK...',
  '...KSSSKTTTTTTTTTTTTTTTTKSSSK...',
  '....KKKKttttttttttttttttKKKK....',
];

/** Face rows 10–16, columns 7–24 (18 px), per expression. */
const FACES: Record<Expression, PixelRows> = {
  neutral: [
    'SSKKKSSSSSSSSKKKSS',
    'SSSKKSSSSSSSSKKSSS',
    'SSSKKSSSSSSSSKKSSS',
    'SSSSSSSSssSSSSSSSS',
    'SSSSSSSSSSSSSSSSSS',
    'SSSSSSKSSSSKSSSSSS',
    'SSSSSSSKKKKSSSSSSS',
  ],
  happy: [
    'SSSSSSSSSSSSSSSSSS',
    'SSSKKSSSSSSSSKKSSS',
    'SSKSSKSSSSSSKSSKSS',
    'SCCSSSSSssSSSSSCCS',
    'SSSSSKKKKKKKKSSSSS',
    'SSSSSKCCCCCCKSSSSS',
    'SSSSSSKKKKKKSSSSSS',
  ],
  thinking: [
    'SSSSSSSSSSSSSKKKSS',
    'SSKKKSSSSSSSSSSSSS',
    'SSSSKKSSSSSSSSSKKS',
    'SSSSKKSSSSSSSSSKKS',
    'SSSSSSSSssSSSSSSSS',
    'SSSSSSSSSSKKKSSSSS',
    'SSSSSSSSSSSSSSSSSS',
  ],
  surprised: [
    'SKKKSSSSSSSSSSKKKS',
    'SSWWWSSSSSSSSWWWSS',
    'SSWKWSSSSSSSSWKWSS',
    'SSWWWSSSSSSSSWWWSS',
    'SSSSSSSSssSSSSSSSS',
    'SSSSSSSKKKKSSSSSSS',
    'SSSSSSSKCCKSSSSSSS',
  ],
};

/** Headset microphone, drawn over every face. */
const MIC: PixelRows = ['kkkC'];

export function technicianRows(e: Expression): string[] {
  return overlay(overlay(BASE, FACES[e], 7, 10), MIC, 7, 16);
}

export const TECH_W = BASE[0]!.length;
export const TECH_H = BASE.length;
/** Where the face is, in art px from the sprite's top-left (tap target for tests). */
export const TECH_FACE = { x: 16, y: 12 };
