// Free play's menu (โหมดอิสระ, docs/phase3-plan.md tasks A and B), on the same notice board as the learning path: open
// the shop for customers (at random, each with a problem mixed in from another case: no cases 1–5 here), the jobs
// done so far, the lessons and the ordering game to go over again, and the technician's book. Nothing played here is
// sent to the teacher; the page says so under its title.

import type { ComponentChildren } from 'preact';
import type { Progress, StepId } from '../../core/path';
import { STEP_INFO } from '../../core/path';
import { BookButton, LearnPage } from './MenuScreen';
import './menu.css';

interface Props {
  progress: Progress;
  /** How many customer + problem pairs there are to meet. */
  pairs: number;
  onEnter: (step: StepId, caseId?: string) => void;
  /** Back to the class mode (the start page, or the learning path if a name is given there). */
  onLeave: () => void;
  coins: ComponentChildren;
  book: { got: number; total: number; fresh: number; onOpen: () => void };
}

/** What can be gone over again: the two lessons and the ordering game. */
const REVIEW: readonly StepId[] = ['lesson-os', 'lesson-types', 'order'];

export function FreeMenu({ progress, pairs, onEnter, onLeave, coins, book }: Props) {
  const jobs = progress.jobs;

  return (
    <LearnPage
      title="เล่นอิสระ"
      testid="free-menu"
      who={
        <p class="menu-who free-note" data-testid="free-note">
          ฝึกได้ไม่จำกัด · <b>ไม่บันทึกผล ไม่ส่งครู</b>
        </p>
      }
      aside={coins}
      scrollKey="free"
    >
      <button class="btn menu-next" type="button" onClick={() => onEnter('cases')}>
        🏪 เปิดร้านรับลูกค้า
      </button>
      <BookButton {...book} />

      <h2 class="free-head">งานที่ทำแล้ว</h2>
      <dl class="free-jobs" data-testid="free-jobs">
        <div>
          <dt>ซ่อมสำเร็จ</dt>
          <dd data-jobs="count">{jobs.count} งาน</dd>
        </div>
        <div>
          <dt>ได้ 3 ดาว</dt>
          <dd data-jobs="three">{jobs.three} งาน</dd>
        </div>
        <div>
          <dt>เจอปัญหาแบบปนแล้ว</dt>
          <dd data-jobs="pairs">
            {jobs.pairs.length}/{pairs} แบบ
          </dd>
        </div>
      </dl>

      <h2 class="free-head">ทบทวนบทเรียน</h2>
      <ol class="case-list free-list">
        {REVIEW.map((id) => {
          const done = progress.done.includes(id);
          return (
            <li key={id} data-step={id} data-status={done ? 'done' : 'open'}>
              <button class="case-row" type="button" onClick={() => onEnter(id)}>
                <span class="case-text">
                  <b>{STEP_INFO[id].th}</b>
                </span>
                <span class="case-status">{done ? '✓ ทำแล้ว' : '▶ ยังไม่ทำ'}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div class="menu-foot">
        <button class="btn ghost small" type="button" onClick={onLeave}>
          ออกจากโหมดอิสระ
        </button>
      </div>
    </LearnPage>
  );
}
