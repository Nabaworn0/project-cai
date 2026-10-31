// Sending the results to the teacher's Google Sheet (docs/results-plan.md part 3, task B2). The teacher's page makes
// a link for the class: the game's address with ?class= (the class's name, a sheet tab) and ?to= (the teacher's
// Apps Script web app, by its deployment id). Opened from that link, the game keeps the class on this device and
// sends the learner's latest results (the same data as the results file) whenever they change, until the sheet
// says it has them. Pure: src/ui/sync.ts keeps it and does the sending.

import type { Progress } from './path';
import { checksum, resultsFile, type ResultsFile } from './results';

export interface ClassLink {
  /** The class's name as the teacher typed it, e.g. ปวช.1/2 — also the sheet's tab. */
  name: string;
  /** The Apps Script web app's deployment id. */
  to: string;
}

const NAME = /^[\p{L}\p{M}\p{N} ./_-]{1,30}$/u;
const DEPLOYMENT = /^[A-Za-z0-9_-]{20,120}$/;

/** The class in an address's query, or null if there is none or it is not a well-formed one. */
export function classFromQuery(search: string): ClassLink | null {
  const q = new URLSearchParams(search);
  const name = q.get('class')?.trim() ?? '';
  const to = q.get('to')?.trim() ?? '';
  return NAME.test(name) && DEPLOYMENT.test(to) ? { name, to } : null;
}

/** A saved class, checked the same way. */
export function parseClass(raw: string | null): ClassLink | null {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<ClassLink> | null;
    return v && typeof v.name === 'string' && typeof v.to === 'string' ? classFromQuery(`?${new URLSearchParams({ class: v.name, to: v.to })}`) : null;
  } catch {
    return null;
  }
}

/** Where the results go. */
export const endpoint = (c: ClassLink) => `https://script.google.com/macros/s/${c.to}/exec`;

/** The game's link for a class (the teacher's page shows it and its QR code). */
export function classUrl(gameUrl: string, c: ClassLink): string {
  const u = new URL(gameUrl);
  u.hash = '';
  u.searchParams.set('class', c.name);
  u.searchParams.set('to', c.to);
  return u.toString();
}

/** Identifies what would be sent: when it has not changed since the last send that worked, nothing is sent. */
export const signature = (p: Progress) => checksum(JSON.stringify(resultsFile(p, 0).data));

export interface Payload {
  class: string;
  file: ResultsFile;
}
export const payload = (p: Progress, c: ClassLink, now: number): Payload => ({ class: c.name, file: resultsFile(p, now) });

/** What this device remembers about sending: the signature and time of the last send that worked, and whether
 *  the last try failed. */
export interface SyncState {
  sent: string | null;
  at: number | null;
  failed: boolean;
}
export const NOT_SENT: SyncState = { sent: null, at: null, failed: false };

export function parseSync(raw: string | null): SyncState {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<SyncState> | null;
    if (!v || typeof v !== 'object') return NOT_SENT;
    return {
      sent: typeof v.sent === 'string' ? v.sent : null,
      at: Number.isFinite(v.at) ? (v.at as number) : null,
      failed: v.failed === true,
    };
  } catch {
    return NOT_SENT;
  }
}

/** Whether there is something new to send: a class, a learner, and results unlike the last ones sent. */
export const due = (p: Progress, c: ClassLink | null, s: SyncState) => !!c && !!p.learner && signature(p) !== s.sent;

/** The sheet's answer: only {"ok": true} counts as received. */
export function received(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { ok?: unknown }).ok === true;
}

// ---- The teacher's side: setting it up and reading the sheet ------------------------------------------------

/** The web app's deployment id, from the link Apps Script gives on deploying (…/macros/s/<id>/exec) or the bare id. */
export function deploymentFrom(text: string): string | null {
  const t = text.trim();
  const m = /\/macros\/s\/([A-Za-z0-9_-]+)\/(?:exec|dev)\b/.exec(t);
  const id = m ? m[1]! : t;
  return DEPLOYMENT.test(id) ? id : null;
}

/** Whether a class name is one the link can carry. */
export const validClassName = (name: string) => NAME.test(name.trim());

/** What the teacher's page asks the web app: the classes in the sheet, or one class's results. The key goes in the
 *  body, not the address, so it is not kept in logs and histories. */
export const readRequest = (key: string, cls?: string) => JSON.stringify(cls ? { action: 'read', key, class: cls } : { action: 'classes', key });

export type SheetReply<T> = { ok: true; value: T } | { ok: false; why: string };

function sheetError(body: unknown): string {
  const e = (body as { error?: unknown } | null)?.error;
  return e === 'key' ? 'รหัสครูไม่ถูกต้อง' : e === 'class' ? 'ไม่พบห้องนี้ใน Sheet' : 'Sheet ตอบกลับมาไม่ถูกต้อง (ตรวจลิงก์ Web app และการ Deploy)';
}

/** {"ok": true, "classes": [...]} → the class names. */
export function sheetClasses(body: unknown): SheetReply<string[]> {
  const b = body as { ok?: unknown; classes?: unknown } | null;
  if (!received(b) || !Array.isArray(b!.classes)) return { ok: false, why: sheetError(body) };
  return { ok: true, value: b!.classes.filter((c): c is string => typeof c === 'string' && validClassName(c)) };
}

export interface SheetFile {
  text: string;
  /** Its row in the class's tab, when the sheet says. */
  row: number | null;
}

/** {"ok": true, "files": [...], "rows": [...]} → each results file as text, for readResultsFile, and its row. */
export function sheetFiles(body: unknown): SheetReply<SheetFile[]> {
  const b = body as { ok?: unknown; files?: unknown; rows?: unknown } | null;
  if (!received(b) || !Array.isArray(b!.files)) return { ok: false, why: sheetError(body) };
  const rows = Array.isArray(b!.rows) ? b!.rows : [];
  return {
    ok: true,
    value: b!.files.map((f, i) => ({ text: typeof f === 'string' ? f : JSON.stringify(f), row: Number.isInteger(rows[i]) ? (rows[i] as number) : null })),
  };
}
