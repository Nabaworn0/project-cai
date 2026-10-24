// Small pieces shared by the case panels: multiple-choice answers and the feedback after answering.

import type { Answer } from '../../core/session';

interface ChoiceProps {
  choices: readonly string[];
  /** The answer already given (choices lock and show right/wrong), or null while still open. */
  answered: Answer | null;
  correct: number;
  onChoose: (choice: number) => void;
}

export function ChoiceList({ choices, answered, correct, onChoose }: ChoiceProps) {
  return (
    <ol class="choices">
      {choices.map((c, i) => {
        const mark = !answered ? '' : i === correct ? ' right' : i === answered.choice ? ' wrong' : ' dim';
        return (
          <li key={c}>
            <button class={`choice${mark}`} type="button" disabled={!!answered} aria-pressed={answered?.choice === i} onClick={() => onChoose(i)}>
              <span class="choice-key">{'กขคงจ'[i]}</span>
              {c}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function Feedback({ answer, explain }: { answer: Answer; explain: string }) {
  return (
    <p class={`feedback ${answer.correct ? 'right' : 'wrong'}`} role="status">
      <b>{answer.correct ? '✓ ถูกต้อง' : '✗ ยังไม่ใช่'}</b> {explain}
    </p>
  );
}
