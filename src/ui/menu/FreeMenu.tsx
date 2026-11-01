// Free play's menu (โหมดอิสระ, docs/phase3-plan.md tasks A and B), on the same notice board as the learning path: open
// the shop for customers (at random, each with a problem mixed in from another case: no cases 1–5 here), the jobs
// done so far, the technician's rank, decorating the shop, the lessons and the ordering game to go over again, and the technician's book. Nothing played here is
// sent to the teacher; the page says so under its title.

import type { ComponentChildren } from 'preact';
import type { Progress, StepId } from '../../core/path';
import { STEP_INFO } from '../../core/path';
import type { Rank, Step } from '../../core/rank';
import { BookButton, LearnPage } from './MenuScreen';
import { RankBadge } from './RankBadge';
import '../decor/decor.css';
import './menu.css';

interface Props {
  progress: Progress;
  /** How many customer + problem pairs there are to meet. */
  pairs: number;
  /** The technician's rank now, and the next one with what is left to do (null at the top). */
  rank: { now: Rank; next: { rank: Rank; steps: Step[]; progress: number } | null };
  onEnter: (step: StepId, caseId?: string) => void;
  /** Back to the class mode (the start page, or the learning path if a name is given there). */
  onLeave: () => void;
  coins: ComponentChildren;
  book: { got: number; total: number; fresh: number; onOpen: () => void };
  /** Decorating the shop: how many of its places have something put out. */
  decor: { placed: number; slots: number; onOpen: () => void };
  /** Opens the play guide (docs/guide-pin-plan.md task H). */
  onGuide: () => void;
}

/** What can be gone over again: the two lessons and the ordering game. */
const REVIEW: readonly StepId[] = ['lesson-os', 'lesson-types', 'order'];

export function FreeMenu({ progress, pairs, rank, onEnter, onLeave, coins, book, decor, onGuide }: Props) {
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
      <button class="btn ghost menu-decor" type="button" data-testid="open-decor" onClick={decor.onOpen}>
        🛋️ แต่งร้าน · วางของแล้ว {decor.placed}/{decor.slots} จุด
      </button>
      <button class="btn ghost menu-guide" type="button" data-testid="open-guide" onClick={onGuide}>
        ❓ วิธีเล่น · ปุ่ม ดาว เหรียญ และปัญหาที่พบบ่อย
      </button>

      <RankCard {...rank} />

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

const STEP_TH: Record<Step['id'], (have: number, need: number) => string> = {
  jobs: (h, n) => `ซ่อมสำเร็จ ${h}/${n} งาน`,
  three: (h, n) => `ได้ 3 ดาว ${h}/${n} งาน`,
  problems: (h, n) => `เจอปัญหาครบทุกแบบ ${h}/${n} แบบ`,
  cards: (h, n) => `สะสมการ์ดในสมุดช่าง ${h}/${n} ใบ`,
};

/** The technician's rank (docs/phase3-plan.md task C): now, and the way to the next one. */
function RankCard({ now, next }: Props['rank']) {
  const pct = next ? Math.round(100 * next.progress) : 100;
  return (
    <section class="free-rank" data-testid="free-rank" aria-label="ยศช่าง">
      <div class="free-rank-now">
        <RankBadge rank={now} big />
        <span>
          <small>ยศช่างตอนนี้</small>
          <b data-testid="rank-name">{now.nameTh}</b>
        </span>
      </div>
      {next ? (
        <>
          <p class="free-rank-next">
            ยศถัดไป: <RankBadge rank={next.rank} /> {next.rank.nameTh}
          </p>
          <div class="free-rank-bar" role="progressbar" aria-label="ความคืบหน้าไปยศถัดไป" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <ul class="free-rank-steps">
            {next.steps.map((x) => (
              <li key={x.id} data-need={x.id} class={x.have >= x.need ? 'done' : ''}>
                <span aria-hidden="true">{x.have >= x.need ? '✓' : '•'}</span> {STEP_TH[x.id](Math.min(x.have, x.need), x.need)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p class="free-rank-next">ยศสูงสุดแล้ว เก่งมาก!</p>
      )}
    </section>
  );
}
