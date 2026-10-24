// One case from the customer walking in to the summary (docs/case1-plan.md section 1).
// The rules live in src/core/session.ts; this component shows each stage in the panel at the bottom of
// the screen, opens the customer's PC for the repair, and keeps the customer's expression in step.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { bus } from '../../core/bus';
import { generateCase, type GeneratedCase } from '../../core/cases';
import type { Effect, Pc } from '../../core/pc';
import { goodbyeLine, reactionLine } from '../../core/reactions';
import {
  currentQuestion,
  customerMood,
  shownHints,
  startSession,
  step,
  summarize,
  type Answer,
  type Session,
  type SessionEvent,
} from '../../core/session';
import type { Content } from '../../content';
import { PcScreen } from '../sim/PcScreen';
import { play } from '../sound';
import { ChoiceList, Feedback } from './parts';
import { SummaryCard } from './SummaryCard';
import { TicketCard } from './TicketCard';

interface Props {
  content: Content;
  /** The shop scene is on screen, so the customer can walk in. */
  ready: boolean;
  /** Coins earned, once per finished case. */
  onCoins: (coins: number) => void;
}

/** Phase 1 plays case 1 (the next cases come after case1-plan). A new seed gives a new machine each time. */
function newCase(content: Content): GeneratedCase {
  return generateCase(content.cases[0]!, content, `${Date.now()}`);
}

export function CaseFlow({ content, ready, onCoins }: Props) {
  const [gc, setGc] = useState(() => newCase(content));
  const [s, setS] = useState<Session>(() => startSession(gc));
  const [arrived, setArrived] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  /** The answer just given, shown until the player moves on. */
  const [feedback, setFeedback] = useState<Answer | null>(null);
  const pcRef = useRef<Pc | undefined>(undefined);
  /** What the customer just said about the repair, and how often the PC came up with the old Windows. */
  const [said, setSaid] = useState<string | null>(null);
  const oldWindowsCount = useRef(0);
  /** Practice cases: the PC has been opened once (the tip before it goes), and the senior technician's nudge after a mistake. */
  const [opened, setOpened] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  /** The customer is walking out: further "next customer" taps are ignored. */
  const leaving = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ gc, s });
  latest.current = { gc, s };

  const coach = gc.template.coach;
  const customer = content.customers.find((c) => c.id === gc.template.customer.id);
  const name = customer?.nameTh ?? gc.template.customer.id;

  const act = (e: SessionEvent) => {
    const next = step(latest.current.gc, latest.current.s, e);
    latest.current.s = next;
    setS(next);
    return next;
  };

  // The customer walks in when the shop is ready, and again for every new case.
  useEffect(() => {
    if (!ready) return;
    setArrived(false);
    const off = bus.on('customer:arrived', ({ id }) => id === gc.template.customer.id && setArrived(true));
    bus.emit('customer:enter', { id: gc.template.customer.id, mood: customerMood(gc, startSession(gc)) });
    play('bell');
    return off;
  }, [ready, gc]);

  // The face follows the session (worried until fixed, then by the result).
  const mood = customerMood(gc, s);
  useEffect(() => {
    if (ready) bus.emit('customer:mood', { mood });
  }, [ready, mood]);

  // Tapping the PC on the counter opens it, but only once the job is taken.
  useEffect(
    () =>
      bus.on('ui:open-sim', () => {
        if (latest.current.s.stage === 'repair') openSim();
      }),
    [],
  );

  // Back at the counter after the fix (whichever button closed the PC), the customer hops for joy once.
  const cheered = useRef(false);
  useEffect(() => {
    if (simOpen || !s.route || cheered.current) return;
    cheered.current = true;
    bus.emit('customer:cheer', {});
  }, [simOpen, s.route]);

  // Coins once per case, when the summary appears.
  const summary = useMemo(() => (s.stage === 'summary' ? summarize(gc, s) : null), [gc, s]);
  useEffect(() => {
    if (!summary) return;
    onCoins(summary.coins);
    if (summary.stars >= 2) bus.emit('customer:cheer', {});
  }, [summary !== null]);

  // A long panel scrolls: bring the answer's explanation into view, and start each stage at the top.
  useEffect(() => {
    const p = panelRef.current;
    if (p) p.scrollTop = feedback ? p.scrollHeight : 0;
  }, [feedback, s.stage]);

  useEffect(() => {
    document.body.dataset.caseStage = arrived ? s.stage : 'arriving';
  }, [arrived, s.stage]);

  const openSim = () => {
    setSimOpen(true);
    setOpened(true);
  };

  const onEffect = (e: Effect) => {
    // After the fix the PC is just for looking: a later mistake does not count against the player.
    const cur = latest.current.s;
    if (cur.stage !== 'repair' || cur.route) return;
    act(e.type === 'mistake' ? { type: 'mistake' } : { type: 'repaired', route: e.route });
    const r = latest.current.gc.template.customer.reactionsTh;
    const coachNow = latest.current.gc.template.coach;
    if (e.type === 'mistake' && coachNow && latest.current.s.mistakes === 1) setNudge(coachNow.firstMistakeTh);
    if (e.type === 'reached-setup') {
      setNudge(null);
      setSaid(reactionLine(r, 'fixed'));
    } else if (e.reason === 'no-boot-device') setSaid(reactionLine(r, 'no-boot'));
    else setSaid(reactionLine(r, 'old-windows', ++oldWindowsCount.current));
  };

  /** A chosen answer: its sound, and it stays on screen with its explanation. */
  const answered = (a: Answer) => {
    play(a.correct ? 'right' : 'mistake');
    setFeedback(a);
  };

  const nextCustomer = () => {
    if (leaving.current) return;
    leaving.current = true;
    const off = bus.on('customer:left', () => {
      off();
      leaving.current = false;
      const g = newCase(content);
      pcRef.current = undefined;
      oldWindowsCount.current = 0;
      cheered.current = false;
      setSaid(null);
      setNudge(null);
      setOpened(false);
      setFeedback(null);
      setS(startSession(g));
      setGc(g);
    });
    bus.emit('customer:leave', {});
  };

  const hintButton = s.stage === 'repair' && !s.route && (
    <button class="btn ghost small" type="button" disabled={s.hintsUsed >= s.hints.length} onClick={() => act({ type: 'hint' })}>
      คำใบ้ ({s.hints.length - s.hintsUsed})
    </button>
  );
  const saying = said && (
    <p class="says customer-says" data-testid="customer-says">
      <span class="speaker">{name}</span> “{said}”
    </p>
  );
  const tip = (text: string) => (
    <p class="coach-tip" data-testid="coach-tip">
      <span class="speaker">พี่ช่าง</span> {text}
    </p>
  );
  const hints = shownHints(s);
  const hintList = hints.length > 0 && (
    <ol class="hints" aria-label="คำใบ้">
      {hints.map((h) => (
        <li key={h}>💡 {h}</li>
      ))}
    </ol>
  );

  if (simOpen) {
    return (
      <PcScreen
        brand={gc.brand}
        machine={gc.machine}
        initial={pcRef.current}
        onPc={(pc) => (pcRef.current = pc)}
        onEffect={onEffect}
        coach={!!coach}
        onClose={() => {
          setSimOpen(false);
          bus.emit('ui:close-sim', {});
        }}
        footer={
          <div class="pc-footer">
            {/* Text scrolls when space is short (phones on their side); the buttons below always stay in view. */}
            {(saying || nudge || hintList) && (
              <div class="pc-notes">
                {saying}
                {nudge && tip(nudge)}
                {hintList}
              </div>
            )}
            <div class="pc-actions">
              {hintButton}
              {s.route && (
                <button
                  class="btn small"
                  type="button"
                  onClick={() => {
                    setSimOpen(false);
                    bus.emit('ui:close-sim', {});
                    act({ type: 'next' });
                  }}
                >
                  กลับไปคุยกับลูกค้า
                </button>
              )}
            </div>
          </div>
        }
      />
    );
  }

  if (!ready || !arrived) return null;

  const speaker = <span class="speaker">{name}</span>;
  let body;
  switch (s.stage) {
    case 'intro':
      body = (
        <>
          {speaker}
          <p class="says">“{gc.template.customer.lineTh}”</p>
          <div class="actions">
            <button class="btn" type="button" onClick={() => act({ type: 'next' })}>
              รับเรื่อง
            </button>
          </div>
        </>
      );
      break;
    case 'ticket':
      body = (
        <>
          <TicketCard gc={gc} customerName={name} />
          <div class="actions">
            <button class="btn" type="button" onClick={() => act({ type: 'next' })}>
              รับงาน
            </button>
          </div>
        </>
      );
      break;
    case 'diagnose': {
      const q = gc.template.diagnosis;
      body = (
        <>
          <p class="ask">ก่อนลงมือ ลองเดาก่อนว่าสาเหตุคืออะไร</p>
          <ChoiceList
            choices={q.choicesTh}
            answered={s.diagnosis}
            correct={q.answer}
            onChoose={(choice) => answered(act({ type: 'diagnose', choice }).diagnosis!)}
          />
          {feedback && <Feedback answer={feedback} explain={q.explainTh} />}
          {s.diagnosis && (
            <div class="actions">
              <button
                class="btn"
                type="button"
                onClick={() => {
                  setFeedback(null);
                  act({ type: 'next' });
                }}
              >
                ไปซ่อมเครื่อง
              </button>
            </div>
          )}
        </>
      );
      break;
    }
    case 'repair':
      body = (
        <>
          <p class="ask">{s.route ? 'บูตจาก USB ได้แล้ว กลับไปคุยกับลูกค้า' : 'แตะคอมบนเคาน์เตอร์เพื่อเปิดเครื่องของลูกค้า แล้วทำให้เครื่องบูตจาก USB'}</p>
          {coach && !opened && !s.route && tip(coach.beforePcTh)}
          {saying}
          {nudge && tip(nudge)}
          {hintList}
          <div class="actions">
            {s.route ? (
              <button class="btn" type="button" onClick={() => act({ type: 'next' })}>
                คุยกับลูกค้า
              </button>
            ) : (
              <button class="btn" type="button" onClick={openSim}>
                เปิดเครื่องลูกค้า
              </button>
            )}
            {hintButton}
          </div>
        </>
      );
      break;
    case 'explain': {
      // While feedback is up, keep showing the question it answers.
      const q = feedback ? gc.template.customerQuestions[s.answers.length - 1]! : currentQuestion(gc, s)!;
      body = (
        <>
          {speaker}
          <p class="says">“{q.askTh}”</p>
          <ChoiceList
            choices={q.choicesTh}
            answered={feedback}
            correct={q.answer}
            onChoose={(choice) => answered(act({ type: 'answer', choice }).answers.at(-1)!)}
          />
          {feedback && <Feedback answer={feedback} explain={q.explainTh} />}
          {feedback && (
            <div class="actions">
              <button
                class="btn"
                type="button"
                onClick={() => {
                  setFeedback(null);
                  if (!currentQuestion(gc, latest.current.s)) act({ type: 'next' });
                }}
              >
                ต่อไป
              </button>
            </div>
          )}
        </>
      );
      break;
    }
    case 'summary':
      body = (
        <>
          {speaker}
          <p class="says" data-testid="goodbye">“{goodbyeLine(gc.template.customer.reactionsTh, summary!.stars)}”</p>
          <SummaryCard summary={summary!} />
          <div class="actions">
            <button class="btn" type="button" onClick={nextCustomer}>
              รับลูกค้าคนถัดไป
            </button>
          </div>
        </>
      );
      break;
  }

  return (
    <section class="narration case-panel" data-stage={s.stage} aria-live="polite">
      <div ref={panelRef} class="case-scroll">
        {body}
      </div>
    </section>
  );
}
