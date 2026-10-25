// The Windows 11 requirements table under the work ticket (case 4 task C, src/core/win11check.ts).
// One card per requirement: what Windows 11 needs, what the ticket says about this PC, and three answers.
// Each answer is marked right or wrong at once, with how to tell; nothing here costs stars.

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

export function Win11CheckTable({ rows, machine, answers, onAnswer }: Props) {
  return (
    <div class="w11check" role="group" aria-label="เทียบข้อกำหนด Windows 11" data-testid="win11-check">
      <p class="ask">ก่อนรับงาน: เทียบเครื่องนี้กับข้อกำหนดของ Windows 11 ทีละข้อ</p>
      {rows.map((row) => {
        const given = answers.find((a) => a.id === row.id);
        const right = checkAnswer(row.id, machine);
        return (
          <div key={row.id} class="w11check-row" data-check={row.id}>
            <div class="w11check-need">{row.requirementTh}</div>
            <div class="w11check-value">เครื่องนี้: {checkValueTh(row.id, machine)}</div>
            <div class="w11check-choices">
              {ORDER.map((a) => (
                <button
                  key={a}
                  type="button"
                  class={`btn small ghost${given?.answer === a ? (given.correct ? ' right' : ' wrong') : ''}${given && a === right && !given.correct ? ' right-answer' : ''}`}
                  disabled={!!given}
                  aria-pressed={given?.answer === a}
                  onClick={() => onAnswer(row.id, a)}
                >
                  {ANSWER_TH[a]}
                </button>
              ))}
            </div>
            {given && (
              <p class={`w11check-feedback ${given.correct ? 'ok' : 'no'}`}>
                {given.correct ? '✔ ถูก' : `✘ ไม่ใช่ คำตอบคือ "${ANSWER_TH[right]}"`} · {row.explainTh}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
