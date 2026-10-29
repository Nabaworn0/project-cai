// The course test on the learning page (docs/quiz-plan.md task B): one question at a time with big ก–ง
// choices, back to change an answer, a check before sending, and the result. The pre-test shows the score
// only; the post-test compares it with the pre-test per objective and goes through every answer.
// The sitting is saved after every tap (App keeps it in the progress), so leaving half way loses nothing.
// The test logic is src/core/quiz.ts; this only draws it.

import { useRef, useState } from 'preact/hooks';
import { STEP_INFO, type QuizResult } from '../../core/path';
import { finish, grade, pick, resumable, shown, startTest, unanswered, type TestDraft, type TestItem, type TestKind } from '../../core/quiz';
import { LearnPage } from '../menu/MenuScreen';
import './quiz.css';

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ'];

/** The course objectives the test measures (objective 4 is measured by the cases' stars). */
const OBJECTIVE_TH: Record<number, string> = {
  1: 'ความหมายของระบบปฏิบัติการ',
  2: 'ประเภทของระบบปฏิบัติการ',
  3: 'ขั้นตอนการติดตั้ง Windows 11',
  4: 'ลงมือติดตั้ง Windows 11',
};

interface Props {
  items: readonly TestItem[];
  kind: TestKind;
  /** The half-done sitting kept on this device, if any. */
  draft: TestDraft | null;
  /** The pre-test result, for the post-test's comparison. */
  pre: QuizResult | null;
  /** ?seed= fixes the shuffle (tests, teachers); otherwise a new one each sitting. */
  seed: string | null;
  onDraft: (d: TestDraft) => void;
  onFinish: (r: QuizResult) => void;
  onBack: () => void;
}

type Phase = { at: 'intro' } | { at: 'question'; n: number } | { at: 'check' } | { at: 'result'; result: QuizResult };

export function QuizScreen({ items, kind, draft, pre, seed, onDraft, onFinish, onBack }: Props) {
  const resumed = resumable(items, draft, kind);
  const [d, setD] = useState<TestDraft>(() => (resumed ? draft : startTest(items, kind, seed ?? Math.random().toString(36).slice(2), Date.now())));
  const [phase, setPhase] = useState<Phase>({ at: 'intro' });
  const total = items.length;
  const answered = total - unanswered(d).length;

  const save = (next: TestDraft) => {
    setD(next);
    onDraft(next);
  };
  const begin = () => {
    // A new sitting is timed from here, not from opening the page.
    if (!resumed) save({ ...d, startedAt: Date.now() });
    const gap = unanswered(d)[0];
    setPhase(gap === undefined ? { at: 'check' } : { at: 'question', n: gap - 1 });
  };
  const send = () => {
    const result = finish(items, d, Date.now());
    if (!result) return;
    onFinish(result);
    setPhase({ at: 'result', result });
  };

  const scrollKey = phase.at === 'question' ? `q${phase.n}` : phase.at;
  return (
    <LearnPage
      title={STEP_INFO[kind].th}
      testid="quiz"
      who={
        phase.at === 'question' && (
          <p class="menu-who" data-testid="quiz-count">
            ข้อ {phase.n + 1} จาก {total}
          </p>
        )
      }
      aside={
        <button class="chip menu-chip" type="button" onClick={onBack}>
          ☰ เมนู
        </button>
      }
      scrollKey={scrollKey}
      tall
    >
      {phase.at === 'intro' && (
        <div class="quiz-intro">
          {resumed ? (
            <p>
              ทำค้างไว้ {answered} จาก {total} ข้อ คำตอบเดิมยังอยู่ ทำต่อจากข้อที่ยังไม่ได้ตอบได้เลย
            </p>
          ) : (
            <p>{total} ข้อ เลือกคำตอบที่ถูกที่สุดข้อละ 1 คำตอบ ไม่จำกัดเวลา ย้อนกลับไปแก้คำตอบได้จนกว่าจะส่ง</p>
          )}
          {kind === 'pre' ? (
            <p>ยังไม่ได้เรียนก็ไม่เป็นไร ตอบตามที่เข้าใจตอนนี้ คะแนนนี้ไม่ได้ตัดสินอะไร ใช้ดูว่าเรียนแล้วเก่งขึ้นแค่ไหน</p>
          ) : (
            <p>ข้อสอบชุดเดียวกับก่อนเรียน แต่สลับข้อและตัวเลือก ส่งแล้วจะได้เห็นคะแนนเทียบกับก่อนเรียน พร้อมเฉลยทุกข้อ</p>
          )}
          <p class="quiz-note">ทำได้ครั้งเดียว ถ้าออกไปก่อน คำตอบที่ทำไว้จะเก็บไว้ในเครื่องนี้</p>
          <div class="actions">
            <button class="btn" type="button" onClick={begin}>
              {resumed ? 'ทำต่อ' : 'เริ่มทำแบบทดสอบ'}
            </button>
          </div>
        </div>
      )}

      {phase.at === 'question' && (
        <Question
          {...shown(items, d, phase.n)}
          n={phase.n}
          total={total}
          answered={answered}
          onPick={(k) => save(pick(d, phase.n, k))}
          onPrev={() => setPhase({ at: 'question', n: phase.n - 1 })}
          onNext={() => setPhase(phase.n + 1 < total ? { at: 'question', n: phase.n + 1 } : { at: 'check' })}
        />
      )}

      {phase.at === 'check' && <Check missing={unanswered(d)} total={total} onGo={(n) => setPhase({ at: 'question', n })} onSend={send} />}

      {phase.at === 'result' &&
        (kind === 'pre' ? (
          <PreResult result={phase.result} onBack={onBack} />
        ) : (
          <PostResult items={items} result={phase.result} pre={pre} onBack={onBack} />
        ))}
    </LearnPage>
  );
}

function Question(props: {
  item: TestItem;
  choicesTh: string[];
  picked: number | null;
  n: number;
  total: number;
  answered: number;
  onPick: (position: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const last = props.n + 1 === props.total;
  // On short screens (phones on their side) the way on can be below the fold: bring it up once a choice is made.
  const nav = useRef<HTMLDivElement>(null);
  const choose = (k: number) => {
    props.onPick(k);
    requestAnimationFrame(() => nav.current?.scrollIntoView({ block: 'nearest' }));
  };
  return (
    <div class="quiz-q">
      <div class="quiz-bar" role="progressbar" aria-label="ตอบแล้ว" aria-valuemin={0} aria-valuemax={props.total} aria-valuenow={props.answered}>
        <span style={{ width: `${(100 * props.answered) / props.total}%` }} />
      </div>
      <p class="quiz-stem" id="quiz-stem">
        {props.item.stemTh}
      </p>
      <div class="quiz-choices" role="group" aria-labelledby="quiz-stem">
        {props.choicesTh.map((c, k) => (
          <button key={c} class="quiz-choice" type="button" aria-pressed={props.picked === k} onClick={() => choose(k)}>
            <span class="quiz-letter" aria-hidden="true">
              {LETTERS[k]}
            </span>
            <span>{c}</span>
          </button>
        ))}
      </div>
      <div class="actions quiz-nav" ref={nav}>
        <button class="btn ghost" type="button" disabled={props.n === 0} onClick={props.onPrev}>
          ← ข้อก่อนหน้า
        </button>
        <button class="btn" type="button" disabled={props.picked === null} onClick={props.onNext}>
          {last ? 'ตรวจก่อนส่ง' : 'ข้อต่อไป →'}
        </button>
      </div>
    </div>
  );
}

function Check({ missing, total, onGo, onSend }: { missing: number[]; total: number; onGo: (n: number) => void; onSend: () => void }) {
  return (
    <div class="quiz-check" role="alertdialog" aria-labelledby="quiz-check-q">
      {missing.length ? (
        <p id="quiz-check-q">ยังไม่ได้ตอบข้อ {missing.join(', ')} ต้องตอบครบทุกข้อก่อนส่ง</p>
      ) : (
        <p id="quiz-check-q">ตอบครบ {total} ข้อแล้ว ส่งคำตอบเลยไหม ส่งแล้วจะกลับมาแก้ไม่ได้</p>
      )}
      <div class="actions">
        <button class="btn ghost" type="button" onClick={() => onGo(missing.length ? missing[0]! - 1 : 0)}>
          {missing.length ? `ไปข้อ ${missing[0]}` : 'กลับไปทบทวน'}
        </button>
        <button class="btn" type="button" disabled={missing.length > 0} onClick={onSend}>
          ส่งคำตอบ
        </button>
      </div>
    </div>
  );
}

const duration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} นาที ${s % 60} วินาที` : `${s} วินาที`);

function Score({ label, r }: { label: string; r: Pick<QuizResult, 'score' | 'total'> }) {
  return (
    <div class="quiz-score">
      <small>{label}</small>
      <b>{r.score}</b>
      <span>/ {r.total}</span>
    </div>
  );
}

function PreResult({ result, onBack }: { result: QuizResult; onBack: () => void }) {
  return (
    <div class="quiz-result" data-testid="quiz-result">
      <div class="quiz-scores">
        <Score label="คะแนนก่อนเรียน" r={result} />
      </div>
      <p>ไม่ต้องกังวล คะแนนนี้ใช้ดูว่าเรียนแล้วเก่งขึ้นแค่ไหน เฉลยจะได้ดูหลังทำแบบทดสอบหลังเรียน</p>
      <p class="quiz-note">ใช้เวลา {duration(result.seconds)}</p>
      <div class="actions">
        <button class="btn" type="button" onClick={onBack}>
          ไปเรียนต่อ
        </button>
      </div>
    </div>
  );
}

function PostResult({ items, result, pre, onBack }: { items: readonly TestItem[]; result: QuizResult; pre: QuizResult | null; onBack: () => void }) {
  const after = grade(items, result.answers);
  const before = pre ? grade(items, pre.answers) : null;
  const gain = pre ? result.score - pre.score : 0;
  return (
    <div class="quiz-result" data-testid="quiz-result">
      <div class="quiz-scores">
        {pre && (
          <>
            <Score label="ก่อนเรียน" r={pre} />
            <span class="quiz-arrow" aria-hidden="true">
              →
            </span>
          </>
        )}
        <Score label="หลังเรียน" r={result} />
      </div>
      {pre && (
        <p class="quiz-gain">
          {gain > 0
            ? `เก่งขึ้น ${gain} ข้อ เยี่ยมเลย`
            : gain === 0
              ? 'คะแนนเท่าเดิม ลองอ่านเฉลยข้อที่พลาดด้านล่าง'
              : 'คะแนนลดลง ลองอ่านเฉลยด้านล่างแล้วทบทวนบทเรียนอีกครั้ง'}
        </p>
      )}
      <table class="quiz-objectives">
        <caption>แยกตามวัตถุประสงค์</caption>
        <thead>
          <tr>
            <th scope="col">วัตถุประสงค์</th>
            {before && <th scope="col">ก่อน</th>}
            <th scope="col">หลัง</th>
          </tr>
        </thead>
        <tbody>
          {after.byObjective.map((o, k) => (
            <tr key={o.objective}>
              <th scope="row">
                ข้อ {o.objective} {OBJECTIVE_TH[o.objective]}
              </th>
              {before && (
                <td>
                  {before.byObjective[k]!.right}/{o.total}
                </td>
              )}
              <td>
                {o.right}/{o.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="quiz-note">ใช้เวลา {duration(result.seconds)}</p>

      <h2 class="quiz-key-title">เฉลยทุกข้อ</h2>
      <ol class="quiz-key">
        {items.map((it) => {
          const mine = result.answers[it.id];
          const right = mine === it.answer;
          return (
            <li key={it.id} class={right ? 'right' : 'wrong'} data-item={it.id}>
              <p class="quiz-key-stem">{it.stemTh}</p>
              <p class="quiz-mine">
                <span class="quiz-mark">{right ? '✓ ถูก' : '✗ ผิด'}</span> คำตอบของคุณ: {mine === undefined ? '-' : it.choicesTh[mine]}
              </p>
              {!right && <p class="quiz-answer">คำตอบที่ถูก: {it.choicesTh[it.answer]}</p>}
              <p class="quiz-explain">{it.explainTh}</p>
            </li>
          );
        })}
      </ol>
      <div class="actions">
        <button class="btn" type="button" onClick={onBack}>
          กลับเส้นทางเรียน
        </button>
      </div>
    </div>
  );
}
