// The learning page the game opens on (docs/learning-path-plan.md, a page of its own since
// docs/learning-page-plan.md): the learner's name the first time, then the learning path as cards, a "ทำต่อ"
// button for the recommended step, and "ผู้เรียนคนใหม่" for shared lab PCs.
// What is open is decided in src/core/path.ts; this only draws it and reports taps.

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { learnerError, pathView, STEP_INFO, type Learner, type PathOptions, type Progress, type StepId } from '../../core/path';
import type { Content } from '../../content';
import './menu.css';

interface Props {
  content: Content;
  progress: Progress;
  options: PathOptions;
  onLearner: (l: Learner) => void;
  onReset: () => void;
  onEnter: (step: StepId, caseId?: string, opts?: { replayIntro?: boolean }) => void;
  /** The coin purse, shown in the page's header. */
  coins: ComponentChildren;
  /** The class the results are sent to (opened from the class's link), if any. */
  className?: string | null;
  /** Opens the start page again ("เกี่ยวกับเกม"). */
  onAbout?: () => void;
  aboutLabel?: string;
  /** Said under the name form when the class typed is not the link's ({typed}, {class}). */
  roomMismatch?: string;
}

const STATUS_TH = { soon: 'เร็วๆ นี้', locked: 'ยังไม่เปิด', open: 'ยังไม่ทำ', done: 'ทำแล้ว' } as const;
const STATUS_ICON = { soon: '…', locked: '🔒', open: '▶', done: '✓' } as const;

export function MenuScreen({ content, progress, options, onLearner, onReset, onEnter, coins, className = null, onAbout, aboutLabel, roomMismatch }: Props) {
  const view = pathView(progress, options);
  const caseName = (id: string) => {
    const t = content.cases.find((c) => c.id === id);
    const who = content.customers.find((c) => c.id === t?.customer.id)?.nameTh;
    return { who: who ?? id, title: t?.titleTh ?? '' };
  };
  const next = view.next;
  const nextStep = view.steps.find((s) => s.id === next.step);
  const nextOk = next.caseId ? view.cases.some((c) => c.id === next.caseId && c.status === 'open') : !!nextStep?.canEnter;
  const nextLabel = next.caseId
    ? `${STEP_INFO.cases.th} · เคส ${options.caseIds.indexOf(next.caseId) + 1} ${caseName(next.caseId).who}`
    : STEP_INFO[next.step].th;

  return (
    <LearnPage
      title="เส้นทางเด็กฝึกงาน"
      testid="menu"
      who={
        progress.learner && (
          <p class="menu-who" data-testid="learner">
            {progress.learner.name} · {progress.learner.room} เลขที่ {progress.learner.no}
          </p>
        )
      }
      aside={coins}
      // Keyed so the path starts at the top after the name form, not where the form was scrolled.
      scrollKey={progress.learner ? 'path' : 'form'}
    >
      {!progress.learner ? (
        <LearnerForm onSave={onLearner} className={className} roomMismatch={roomMismatch} />
      ) : (
        <>
          {nextOk && (
            <button class="btn menu-next" type="button" onClick={() => onEnter(next.step, next.caseId)}>
              ทำต่อ: {nextLabel}
            </button>
          )}
          <ol class="path">
            {view.steps.map((s, i) => {
              const info = STEP_INFO[s.id];
              return (
                <li key={s.id} class={`path-step ${s.status}`} data-step={s.id} data-status={s.status}>
                  <button class="path-row" type="button" disabled={!s.canEnter} onClick={() => onEnter(s.id)}>
                    <span class="path-no" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span class="path-text">
                      <b>{info.th}</b>
                      {info.objective && <small>วัตถุประสงค์ข้อ {info.objective}</small>}
                    </span>
                    <span class="path-status">
                      <span aria-hidden="true">{STATUS_ICON[s.status]}</span>{' '}
                      {s.status === 'open' && progress.testDraft?.kind === s.id ? 'ทำค้างไว้' : STATUS_TH[s.status]}
                      {s.id === 'pre' && progress.pre && ` ${progress.pre.score}/${progress.pre.total}`}
                      {s.id === 'post' && progress.post && ` ${progress.post.score}/${progress.post.total}`}
                      {s.id === 'order' && progress.order && (
                        <span class="case-stars" aria-label={`ได้ ${progress.order.stars} ดาว`}>
                          {' '}
                          {'★'.repeat(progress.order.stars)}
                          <span class="off">{'★'.repeat(3 - progress.order.stars)}</span>
                        </span>
                      )}
                    </span>
                  </button>
                  {s.id === 'cases' && s.status !== 'soon' && (
                    <ol class="case-list">
                      {view.cases.map((c, k) => {
                        const n = caseName(c.id);
                        return (
                          <li key={c.id} data-case={c.id} data-status={c.status}>
                            <button class="case-row" type="button" disabled={c.status === 'locked'} onClick={() => onEnter('cases', c.id)}>
                              <span class="case-text">
                                <b>
                                  เคส {k + 1} {n.who}
                                </b>
                                <small>{n.title}</small>
                              </span>
                              <span class="case-status">
                                {c.stars !== null ? (
                                  <span class="case-stars" aria-label={`ได้ ${c.stars} ดาว`}>
                                    {'★'.repeat(c.stars)}
                                    <span class="off">{'★'.repeat(3 - c.stars)}</span>
                                  </span>
                                ) : (
                                  <>
                                    <span aria-hidden="true">{STATUS_ICON[c.status]}</span> {STATUS_TH[c.status]}
                                  </>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
          {progress.seen.includes('intro') && view.steps.find((st) => st.id === 'cases')?.canEnter && (
            <div class="menu-foot">
              <button class="btn ghost small" type="button" onClick={() => onEnter('cases', undefined, { replayIntro: true })}>
                ดูฉากต้อนรับของพี่ช่างอีกครั้ง
              </button>
            </div>
          )}
          <ResetButton name={progress.learner.name} onReset={onReset} />
          {onAbout && (
            <div class="menu-foot">
              <button class="btn ghost small" type="button" onClick={onAbout}>
                {aboutLabel}
              </button>
            </div>
          )}
        </>
      )}
    </LearnPage>
  );
}

/** The page outside the shop with its notice board, for the learning path and the tests. */
export function LearnPage(props: {
  title: string;
  testid: string;
  /** Under the title (the learner's name). */
  who?: ComponentChildren;
  /** Right of the title (the coins, or the way back). */
  aside?: ComponentChildren;
  /** A new key scrolls the board back to the top. */
  scrollKey: string;
  /** The board rises over the sign and takes the whole height (the test, which needs the room). */
  tall?: boolean;
  /** A wider board (the lesson cartoons). */
  wide?: boolean;
  /** The picture behind the board: the shop's entrance (the sign in it says the shop's name), or the belt room. */
  scene?: 'entrance' | 'room';
  children: ComponentChildren;
}) {
  const scene = props.scene ?? 'entrance';
  return (
    <main
      class={`learn-page${props.tall ? ' tall' : ''}${props.wide ? ' wide' : ''}`}
      aria-labelledby="menu-title"
      data-testid={props.testid}
      data-backdrop={scene}
    >
      {scene === 'room' ? (
        <div class="room-scene" aria-hidden="true" />
      ) : (
        <div class="entrance" aria-hidden="true">
          <span class="entrance-sign">ร้านซ่อมคอม</span>
        </div>
      )}
      <div class="menu pixel-box">
        <header class="menu-head">
          <div class="menu-head-text">
            <p class="menu-shop">WINSTALL · ร้านซ่อมคอมพี่ช่าง</p>
            <h1 id="menu-title">{props.title}</h1>
            {props.who}
          </div>
          {props.aside}
        </header>
        <div class="menu-scroll" key={props.scrollKey}>
          {props.children}
        </div>
      </div>
    </main>
  );
}

function LearnerForm({ onSave, className, roomMismatch }: { onSave: (l: Learner) => void; className: string | null; roomMismatch?: string }) {
  const [l, setL] = useState<Learner>({ name: '', room: '', no: '' });
  const [error, setError] = useState<string | null>(null);
  const field = (k: keyof Learner) => (e: Event) => setL({ ...l, [k]: (e.target as HTMLInputElement).value });
  const submit = (e: Event) => {
    e.preventDefault();
    const err = learnerError(l);
    setError(err);
    if (!err) onSave({ name: l.name.trim(), room: l.room.trim(), no: String(Number(l.no.trim())) });
  };
  return (
    <form class="learner-form" onSubmit={submit} noValidate>
      {className ? (
        <p data-testid="class-notice">
          สวัสดีเด็กฝึกงานคนใหม่ กรอกชื่อก่อนเริ่มเรียน · <b>ผลการเรียนพร้อมชื่อนี้จะส่งให้ครูของห้อง {className}</b> ทุกครั้งที่ทำขั้นไหนเสร็จ
        </p>
      ) : (
        <p>สวัสดีเด็กฝึกงานคนใหม่ กรอกชื่อก่อนเริ่มเรียน ชื่อนี้ใช้ในหน้าสรุปผลที่ส่งครู และเก็บไว้ในเครื่องนี้เท่านั้น</p>
      )}
      <label>
        ชื่อ-สกุล
        <input value={l.name} onInput={field('name')} autocomplete="name" maxLength={60} />
      </label>
      <div class="learner-row">
        <label>
          ชั้น
          <input value={l.room} onInput={field('room')} placeholder="ปวช.1/2" maxLength={20} />
        </label>
        <label>
          เลขที่
          <input value={l.no} onInput={field('no')} inputMode="numeric" maxLength={2} />
        </label>
      </div>
      {className && roomMismatch && l.room.trim() && !sameRoom(l.room, className) && (
        <p class="form-note" data-testid="room-mismatch">
          {roomMismatch.replace('{typed}', l.room.trim()).replace('{class}', className)}
        </p>
      )}
      {error && (
        <p class="form-error" role="alert">
          {error}
        </p>
      )}
      <div class="actions">
        <button class="btn" type="submit">
          เริ่มเรียน
        </button>
      </div>
    </form>
  );
}

/** The class a learner typed and the link's, alike once spaces and dots are ignored (ปวช. 1/2 = ปวช.1/2). */
export const sameRoom = (a: string, b: string) => {
  const k = (s: string) => s.replace(/[\s.]/g, '').toLowerCase();
  return k(a) === k(b);
};

function ResetButton({ name, onReset }: { name: string; onReset: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <div class="menu-foot">
        <button class="btn ghost small" type="button" onClick={() => setAsking(true)}>
          ผู้เรียนคนใหม่
        </button>
      </div>
    );
  return (
    <div class="reset-ask" role="alertdialog" aria-labelledby="reset-q">
      <p id="reset-q">ล้างชื่อ คะแนน ดาว และเหรียญของ {name} ทั้งหมด แล้วให้ผู้เรียนคนใหม่เริ่มต้น ใช่ไหม</p>
      <div class="actions">
        <button class="btn ghost small" type="button" onClick={() => setAsking(false)}>
          ยกเลิก
        </button>
        <button class="btn small danger" type="button" onClick={onReset}>
          ล้างและเริ่มใหม่
        </button>
      </div>
    </div>
  );
}
