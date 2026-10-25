// One play-through of a case: which stage the player is at, what they chose, and the score.
// Pure data in, data out (no Phaser, no DOM), so the UI only renders it and the rules are unit-tested.
// Flow and scoring: docs/case1-plan.md sections 1 and 3, from the brief's stars-and-hints rules.

import type { GeneratedCase } from './cases';

export type Stage = 'intro' | 'ticket' | 'diagnose' | 'repair' | 'explain' | 'summary';
export const STAGES: readonly Stage[] = ['intro', 'ticket', 'diagnose', 'repair', 'explain', 'summary'];

export type CustomerMood = 'neutral' | 'worried' | 'happy' | 'angry';

/** Every number the scoring uses, in one place so they are easy to tune. */
export const SCORING = {
  maxStars: 3,
  minStars: 1,
  hintLimit: 2,
  /** Repair mistakes allowed before a star is lost ("more than one mistake" costs a star). */
  freeMistakes: 1,
  repairCoins: 100,
  /** Bonus coins by hints used: none, one, two. */
  hintBonus: [50, 25, 0],
  satisfaction: { perHint: 15, perMistake: 10, perWrongAnswer: 10 },
} as const;

export interface Answer {
  choice: number;
  correct: boolean;
}

export interface Session {
  caseId: string;
  stage: Stage;
  /** The "guess the cause" answer, once given. */
  diagnosis: Answer | null;
  /** One entry per customer question answered so far, in order. */
  answers: Answer[];
  questionCount: number;
  /** Wrong moves on the simulated screen (e.g. leaving the BIOS with Esc). Not counted: waiting too long at "Press any key". */
  mistakes: number;
  /** How the machine was fixed, e.g. "bios" or "boot-menu"; both earn full marks. */
  route: string | null;
  /** The working USB was made with Rufus' Windows 11 checks removed: noted in the log, never scored (case2-plan decision 4). */
  bypassedChecks: boolean;
  /** No key, and Setup was told another edition than the PC had: noted in the log, never scored (case3-plan decision 3). */
  wrongEdition: boolean;
  hints: readonly string[];
  hintsUsed: number;
}

export type SessionEvent =
  /** Move to the next stage; only allowed once the current stage is finished. */
  | { type: 'next' }
  | { type: 'diagnose'; choice: number }
  | { type: 'mistake' }
  | { type: 'hint' }
  | { type: 'repaired'; route: string; bypassedChecks?: boolean; wrongEdition?: boolean }
  | { type: 'answer'; choice: number };

export interface LogEntry {
  textTh: string;
  bookPage?: string;
}

export interface Summary {
  stars: number;
  /** Why stars were lost, as short Thai reasons for the summary screen. */
  lostTh: string[];
  coins: number;
  /** 0–100. */
  satisfaction: number;
  /** Repair mistakes, including the free one that cost no star. */
  mistakes: number;
  /** The technician's log: what this case taught, with the textbook pages. */
  log: LogEntry[];
}

export function startSession(gc: GeneratedCase): Session {
  return {
    caseId: gc.template.id,
    stage: 'intro',
    diagnosis: null,
    answers: [],
    questionCount: gc.template.customerQuestions.length,
    mistakes: 0,
    route: null,
    bypassedChecks: false,
    wrongEdition: false,
    // Two hints per machine (the brief), taken from the hidden problems in order.
    hints: gc.problems.flatMap((p) => p.hintsTh).slice(0, SCORING.hintLimit),
    hintsUsed: 0,
  };
}

/** Why `next` is not allowed yet, or null when the stage is done. */
export function blockedNext(s: Session): string | null {
  switch (s.stage) {
    case 'diagnose':
      return s.diagnosis ? null : 'answer the diagnosis first';
    case 'repair':
      return s.route ? null : 'the machine is not fixed yet';
    case 'explain':
      return s.answers.length >= s.questionCount ? null : 'answer every customer question first';
    case 'summary':
      return 'the case is over';
    default:
      return null;
  }
}

/** Applies one player action. Throws on an action that makes no sense at this stage, which is always a UI bug. */
export function step(gc: GeneratedCase, s: Session, e: SessionEvent): Session {
  const fail = (why: string): never => {
    throw new Error(`${s.caseId}: cannot ${e.type} during ${s.stage} (${why})`);
  };
  switch (e.type) {
    case 'next': {
      const why = blockedNext(s);
      if (why) fail(why);
      return { ...s, stage: STAGES[STAGES.indexOf(s.stage) + 1]! };
    }
    case 'diagnose': {
      if (s.stage !== 'diagnose') fail('wrong stage');
      if (s.diagnosis) fail('already answered');
      return { ...s, diagnosis: grade(gc.template.diagnosis, e.choice, fail) };
    }
    case 'mistake': {
      if (s.stage !== 'repair' || s.route) fail('not repairing');
      return { ...s, mistakes: s.mistakes + 1 };
    }
    case 'hint': {
      if (s.stage !== 'repair' || s.route) fail('not repairing');
      if (s.hintsUsed >= s.hints.length) fail('no hints left');
      return { ...s, hintsUsed: s.hintsUsed + 1 };
    }
    case 'repaired': {
      if (s.stage !== 'repair' || s.route) fail('not repairing');
      if (!e.route) fail('no route given');
      return { ...s, route: e.route, bypassedChecks: !!e.bypassedChecks, wrongEdition: !!e.wrongEdition };
    }
    case 'answer': {
      if (s.stage !== 'explain') fail('wrong stage');
      const q = gc.template.customerQuestions[s.answers.length];
      if (!q) fail('every question is answered');
      return { ...s, answers: [...s.answers, grade(q!, e.choice, fail)] };
    }
  }
}

function grade(q: { choicesTh: readonly string[]; answer: number }, choice: number, fail: (why: string) => never): Answer {
  if (!Number.isInteger(choice) || choice < 0 || choice >= q.choicesTh.length) fail(`no choice ${choice}`);
  return { choice, correct: choice === q.answer };
}

/** The hints shown so far (the newest last). */
export function shownHints(s: Session): readonly string[] {
  return s.hints.slice(0, s.hintsUsed);
}

/** The customer question to ask now, or null when all are answered. */
export function currentQuestion(gc: GeneratedCase, s: Session) {
  return s.stage === 'explain' ? gc.template.customerQuestions[s.answers.length] ?? null : null;
}

export function summarize(gc: GeneratedCase, s: Session): Summary {
  const lostTh: string[] = [];
  if (s.diagnosis && !s.diagnosis.correct) lostTh.push('เดาสาเหตุผิด');
  if (s.mistakes > SCORING.freeMistakes) lostTh.push(`ลงมือพลาด ${s.mistakes} ครั้ง`);
  // One star for the explanation step as a whole, even when a case asks more than one question.
  if (s.answers.some((a) => !a.correct)) lostTh.push('อธิบายให้ลูกค้าฟังไม่ถูก');
  const stars = Math.max(SCORING.minStars, SCORING.maxStars - lostTh.length);

  const wrongAnswers = [s.diagnosis, ...s.answers].filter((a) => a && !a.correct).length;
  const { perHint, perMistake, perWrongAnswer } = SCORING.satisfaction;
  const satisfaction = clamp(100 - s.hintsUsed * perHint - s.mistakes * perMistake - wrongAnswers * perWrongAnswer, 0, 100);
  const coins = SCORING.repairCoins + (SCORING.hintBonus[Math.min(s.hintsUsed, SCORING.hintBonus.length - 1)] ?? 0);

  const log: LogEntry[] = gc.problems.map((p) => ({ textTh: p.explainTh, bookPage: p.bookPage }));
  if (s.bypassedChecks) log.push({ textTh: BYPASS_NOTE_TH });
  if (s.wrongEdition) log.push({ textTh: EDITION_NOTE_TH });
  return { stars, lostTh, coins, satisfaction, mistakes: s.mistakes, log };
}

/** How the customer looks: worried until the PC is fixed, pleased while asking, then by the result. */
export function customerMood(gc: GeneratedCase, s: Session): CustomerMood {
  if (s.stage === 'summary') {
    const { stars } = summarize(gc, s);
    return stars >= 3 ? 'happy' : stars === 2 ? 'neutral' : 'angry';
  }
  return s.route ? 'happy' : 'worried';
}

/** Tech log note for a stick made with Rufus' "remove requirement" box ticked. */
export const BYPASS_NOTE_TH =
  'USB นี้ทำแบบติ๊กยกเลิกการตรวจ TPM/Secure Boot ใน Rufus: ลงได้ แต่เป็นการติดตั้งที่ไมโครซอฟต์ไม่รองรับ เครื่องที่ผ่านข้อกำหนดอยู่แล้วไม่ต้องติ๊ก';

/** Tech log note when Setup was told another edition than the PC had (no product key). */
export const EDITION_NOTE_TH =
  'ตอนไม่มีคีย์ เลือกรุ่น Windows ไม่ตรงกับที่เครื่องเคยใช้: ลงได้ แต่ Windows จะไม่ Activate เองอัตโนมัติ ต้องเลือกรุ่นให้ตรงกับใบงาน';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
