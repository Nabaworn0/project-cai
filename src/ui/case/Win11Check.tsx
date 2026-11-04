// The Windows 11 requirements table under the work ticket (case 4 task C, src/core/win11check.ts).
// One requirement at a time: what Windows 11 needs, what the ticket says about this PC, and three answers. Each
// answer is marked right or wrong at once, with how to tell, and "ข้อต่อไป" moves on once it has been read; a strip
// above shows every row, answered or not. Nothing here costs stars.

import { useState } from 'preact/hooks';
import type { Machine } from '../../core/machine';
import { ANSWER_TH, checkAnswer, checkValueTh, type CheckAnswer } from '../../core/win11check';
import type { CheckResult } from '../../core/session';
import type { Win11Check } from '../../content/schema';

interface Props {
  rows: Win11Check['rows'];
  machine: Machine;
  answers: readonly CheckResult[];
  onAnswer: (id: Win11Check['rows'][number]['id'], answer: CheckAnswer) => void;
}

const ORDER: CheckAnswer[] = ['pass', 'bios', 'fail'];
/** Each row's name in the strip. */
const SHORT: Record<string, string> = { cpu: 'CPU', ram: 'RAM', storage: 'ความจุ', 'secure-boot': 'Secure Boot', tpm: 'TPM' };

export function Win11CheckTable({ rows, machine, answers, onAnswer }: Props) {
  const given = (id: string) => answers.find((a) => a.id === id);
  // Back from the menu: on at the first row still to answer (the last one once all are).
  const [at, setAt] = useState(() => {
    const k = rows.findIndex((r) => !given(r.id));
    return k < 0 ? rows.length - 1 : k;
  });
  const row = rows[at]!;
  const mine = given(row.id);
  const right = checkAnswer(row.id, machine);
  const last = at === rows.length - 1;
  return (
    <div class="w11check" role="group" aria-label="เทียบข้อกำหนด Windows 11" data-testid="win11-check">
      <p class="ask">ก่อนรับงาน: เทียบเครื่องนี้กับข้อกำหนดของ Windows 11 ทีละข้อ</p>
      <ol class="w11check-strip" aria-label="ความคืบหน้า">
        {rows.map((r, k) => {
          const g = given(r.id);
          return (
            <li key={r.id} class={`${k === at ? 'now' : ''}${g ? (g.correct ? ' ok' : ' no') : ''}`} aria-current={k === at ? 'step' : undefined}>
              {g ? (g.correct ? '✔ ' : '✘ ') : ''}
              {SHORT[r.id] ?? r.id}
            </li>
          );
        })}
      </ol>
      <div key={row.id} class="w11check-row" data-check={row.id}>
        <p class="w11check-count" data-testid="check-count">
          ข้อ {at + 1} จาก {rows.length}
        </p>
        <div class="w11check-need">{row.requirementTh}</div>
        <div class="w11check-value">เครื่องนี้: {checkValueTh(row.id, machine)}</div>
        <div class="w11check-choices">
          {ORDER.map((a) => (
            <button
              key={a}
              type="button"
              class={`btn small ghost${mine?.answer === a ? (mine.correct ? ' right' : ' wrong') : ''}${mine && a === right && !mine.correct ? ' right-answer' : ''}`}
              disabled={!!mine}
              aria-pressed={mine?.answer === a}
              onClick={() => onAnswer(row.id, a)}
            >
              {ANSWER_TH[a]}
            </button>
          ))}
        </div>
        {mine && (
          <p class={`w11check-feedback ${mine.correct ? 'ok' : 'no'}`}>
            {mine.correct ? '✔ ถูก' : `✘ ไม่ใช่ คำตอบคือ "${ANSWER_TH[right]}"`} · {row.explainTh}
          </p>
        )}
        {mine && !last && (
          <div class="w11check-next">
            <button class="btn" type="button" onClick={() => setAt(at + 1)}>
              ข้อต่อไป →
            </button>
          </div>
        )}
        {mine && last && answers.length >= rows.length && <p class="w11check-done">ตอบครบ {rows.length} ข้อแล้ว กด "รับงาน" ได้เลย</p>}
      </div>
    </div>
  );
}
