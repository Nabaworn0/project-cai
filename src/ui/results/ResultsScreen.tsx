// The learner's results (docs/results-plan.md task B): the tests before and after, and each of the four objectives
// measured every way the game measures it (the test, while learning, the learner's own stars); the steps still to do
// with a way to each; and the results to send the teacher, as a file or as text. The figures are src/core/results.ts.

import { useState } from 'preact/hooks';
import { STEP_INFO, STEPS, type Progress, type StepId } from '../../core/path';
import { learnerSummary, OBJECTIVE_TH, resultsFile, resultsFileName, resultsText, type ResultsContent, type Score } from '../../core/results';
import { LearnPage } from '../menu/MenuScreen';
import type { Sync } from '../sync';
import './results.css';

interface Props {
  progress: Progress;
  content: ResultsContent;
  /** Steps the learner may go into now (their cards could be tapped). */
  canEnter: (step: StepId) => boolean;
  onEnter: (step: StepId) => void;
  onBack: () => void;
  sync: Sync;
}

const clock = (ms: number) => new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Where the sending to the teacher's sheet stands (only with a class link). */
function SyncStatus({ sync }: { sync: Sync }) {
  const { cls, state, sending, pending } = sync;
  if (!cls) return null;
  const status = sending ? 'sending' : !pending ? 'sent' : state.failed ? 'failed' : 'waiting';
  return (
    <div class={`results-sync ${status}`} data-status={status} role="status">
      <p>
        {status === 'sending'
          ? `กำลังส่งผลให้ครูห้อง ${cls.name}…`
          : status === 'sent'
            ? `ส่งผลให้ครูห้อง ${cls.name} แล้ว ✓${state.at ? ` (${clock(state.at)})` : ''}`
            : status === 'failed'
              ? 'ยังส่งผลให้ครูไม่ได้ (อินเทอร์เน็ตอาจหลุด) จะลองส่งใหม่เอง'
              : `มีผลใหม่ กำลังจะส่งให้ครูห้อง ${cls.name}`}
      </p>
      {status === 'failed' && (
        <button class="chip" type="button" onClick={sync.sendNow}>
          ส่งตอนนี้
        </button>
      )}
    </div>
  );
}

const DURING_TH: Record<number, string> = { 1: 'คำถามท้ายคลิป 1', 2: 'คำถามท้ายคลิป 2', 3: 'เกมเรียงขั้นตอน (ดาว)', 4: 'เคสในร้าน (ดาวรอบแรก)' };

function Cell({ label, s, note }: { label: string; s: Score | null; note?: string }) {
  return (
    <div class={`results-cell${s ? '' : ' empty'}`}>
      <small>{label}</small>
      <b>{s ? `${s.got}/${s.max}` : '-'}</b>
      {note && <span>{note}</span>}
    </div>
  );
}

export function ResultsScreen({ progress, content, canEnter, onEnter, onBack, sync }: Props) {
  const s = learnerSummary(progress, content);
  const l = progress.learner;
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('');
  const gain = s.pre && s.post ? s.post.got - s.pre.got : null;
  const todo = STEPS.filter((id) => id !== 'results').filter((id) =>
    id === 'pre' ? !progress.pre : id === 'post' ? !progress.post : id === 'cases' ? s.cases.got < s.cases.max : !progress.done.includes(id),
  );

  const download = () => {
    const blob = new Blob([JSON.stringify(resultsFile(progress, Date.now()), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = resultsFileName(l);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resultsText(progress, content));
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  return (
    <LearnPage
      title={STEP_INFO.results.th}
      testid="results"
      who={
        l && (
          <p class="menu-who">
            {l.name} · {l.room} · เลขที่ {l.no}
          </p>
        )
      }
      aside={
        <button class="chip menu-chip" type="button" onClick={onBack}>
          ☰ เมนู
        </button>
      }
      scrollKey="results"
      tall
    >
      <div class="results">
        <div class="results-top">
          <p class="results-steps" data-testid="results-steps">
            ทำครบ <b>{s.steps.got}</b> จาก {s.steps.max} ขั้น
          </p>
          <div class="quiz-scores">
            <div class="quiz-score">
              <small>ก่อนเรียน</small>
              <b>{s.pre ? s.pre.got : '-'}</b>
              <span>/ {content.test.length}</span>
            </div>
            <span class="quiz-arrow" aria-hidden="true">
              →
            </span>
            <div class="quiz-score">
              <small>หลังเรียน</small>
              <b>{s.post ? s.post.got : '-'}</b>
              <span>/ {content.test.length}</span>
            </div>
          </div>
          {gain !== null && <p class="quiz-gain">{gain > 0 ? `เก่งขึ้น ${gain} ข้อ` : gain === 0 ? 'คะแนนเท่าเดิม' : `คะแนนลดลง ${-gain} ข้อ`}</p>}
        </div>

        <h2 class="results-h">ผลตามวัตถุประสงค์</h2>
        {s.rows.map((r) => (
          <section key={r.objective} class="results-obj" data-objective={r.objective}>
            <h3>
              {r.objective}. {OBJECTIVE_TH[r.objective]}
            </h3>
            <div class="results-cells">
              <Cell label="ก่อนเรียน" s={r.pre} note={r.objective === 4 ? 'วัดจากเคส' : undefined} />
              <Cell label="ระหว่างเรียน" s={r.during} note={DURING_TH[r.objective]} />
              <Cell label="หลังเรียน" s={r.post} note={r.objective === 4 ? 'วัดจากเคส' : undefined} />
              <div class={`results-cell${r.self ? '' : ' empty'}`}>
                <small>ประเมินตนเอง</small>
                <b aria-label={r.self ? `${r.self} ดาว` : 'ยังไม่ได้ประเมิน'}>{r.self ? '★'.repeat(r.self) : '-'}</b>
              </div>
            </div>
          </section>
        ))}

        {todo.length > 0 && (
          <>
            <h2 class="results-h">ยังไม่ได้ทำ</h2>
            <ul class="results-todo">
              {todo.map((id) => (
                <li key={id} data-step={id}>
                  <span>
                    {STEP_INFO[id].th}
                    {id === 'cases' && ` (เล่นแล้ว ${s.cases.got}/${s.cases.max} เคส)`}
                  </span>
                  {canEnter(id) && (
                    <button class="chip" type="button" onClick={() => onEnter(id)}>
                      ไปทำ
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 class="results-h">ส่งผลให้ครู</h2>
        <SyncStatus sync={sync} />
        <p class="results-how">
          {sync.cls ? 'ทางสำรอง (เช่น ไม่มีอินเทอร์เน็ต): ' : ''}ดาวน์โหลดไฟล์ผลแล้วส่งให้ครูตามที่ครูบอก หรือคัดลอกเป็นข้อความไปวางในแชต
        </p>
        <div class="actions results-send">
          <button class="btn" type="button" onClick={download} disabled={!l}>
            ดาวน์โหลดไฟล์ผล
          </button>
          <button class="btn ghost" type="button" onClick={() => void copy()}>
            คัดลอกผลเป็นข้อความ
          </button>
        </div>
        {copied && (
          <p class={`results-copied ${copied}`} role="status">
            {copied === 'ok' ? 'คัดลอกแล้ว นำไปวางได้เลย' : 'คัดลอกไม่ได้ ลองใช้ปุ่มดาวน์โหลดไฟล์ผลแทน'}
          </p>
        )}
      </div>
    </LearnPage>
  );
}
