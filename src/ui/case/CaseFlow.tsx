// One case from the customer walking in to the summary (docs/case1-plan.md section 1).
// The rules live in src/core/session.ts; this component shows each stage in the panel at the bottom of
// the screen, opens the customer's PC (and in case 2 the shop laptop with Rufus) for the repair, and keeps
// the customer's expression in step. The install USB is one stick shared by both: whatever Rufus writes
// goes back into the customer's PC (docs/case2-plan.md).

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { bus } from '../../core/bus';
import { generateCase, nextCase, type GeneratedCase } from '../../core/cases';
import { insertUsb, powerOn, type Effect, type Pc } from '../../core/pc';
import { ISO_FILES, openRufus, type Rufus, type RufusEffect, type Usb } from '../../core/rufus';
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
import { RufusScreen } from '../sim/RufusScreen';
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

/** Cases whose screens exist so far (Rufus came with case 2; Setup's partition screen comes with case 3). */
const PLAYABLE = ['c01-boot-order', 'c02-rufus-scheme'];

/**
 * The next customer: case 1, then 2, then mixed (nextCase). The first one can be chosen with ?case=<id>
 * (for teachers and tests). A new seed gives a new machine each time.
 */
function newCase(content: Content, lastId: string | null): GeneratedCase {
  const playable = content.cases.filter((c) => PLAYABLE.includes(c.id));
  const wanted = lastId === null ? new URLSearchParams(location.search).get('case') : null;
  const template = playable.find((c) => c.id === wanted) ?? nextCase(playable, lastId, Math.random);
  return generateCase(template, content, `${Date.now()}`);
}

/** The install stick the customer brought, as the machine describes it. */
function usbOf(gc: GeneratedCase): Usb {
  const m = gc.machine;
  const label = ISO_FILES.find((f) => f.os === m.usbOs)?.label ?? 'USB';
  return { scheme: m.usbScheme, os: m.usbOs, label, bypassChecks: m.usbBypassChecks };
}

/** Cases whose fix is remaking the stick get the shop laptop. */
const needsLaptop = (gc: GeneratedCase) => gc.problems.some((p) => p.fixes.includes('remake-usb'));

export function CaseFlow({ content, ready, onCoins }: Props) {
  const [gc, setGc] = useState(() => newCase(content, null));
  const [s, setS] = useState<Session>(() => startSession(gc));
  const [arrived, setArrived] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  /** The answer just given, shown until the player moves on. */
  const [feedback, setFeedback] = useState<Answer | null>(null);
  const pcRef = useRef<Pc | undefined>(undefined);
  /** The shop laptop: open, where Rufus was left, the stick as it is now, and whether a write just finished. */
  const [laptopOpen, setLaptopOpen] = useState(false);
  const rufusRef = useRef<Rufus | undefined>(undefined);
  const usbRef = useRef<Usb>(usbOf(gc));
  const [written, setWritten] = useState(false);
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
  useEffect(
    () =>
      bus.on('ui:open-laptop', () => {
        if (latest.current.s.stage === 'repair' && needsLaptop(latest.current.gc)) openLaptop();
      }),
    [],
  );

  // Back at the counter after the fix (whichever button closed the PC), the customer hops for joy once.
  const cheered = useRef(false);
  useEffect(() => {
    if (simOpen || laptopOpen || !s.route || cheered.current) return;
    cheered.current = true;
    bus.emit('customer:cheer', {});
  }, [simOpen, laptopOpen, s.route]);

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
    setLaptopOpen(false);
    setSimOpen(true);
    setOpened(true);
  };
  const openLaptop = () => {
    setSimOpen(false);
    setWritten(false);
    setLaptopOpen(true);
    setOpened(true);
  };
  const closeScreens = () => {
    setSimOpen(false);
    setLaptopOpen(false);
    bus.emit('ui:close-sim', {});
  };

  /** Rufus finished: the new stick goes back into the customer's PC, which starts again from POST. */
  const onRufusEffect = (e: RufusEffect) => {
    usbRef.current = e.usb;
    if (pcRef.current) pcRef.current = insertUsb(pcRef.current, e.usb);
    setWritten(true);
    setSaid(null); // what the customer said was about the old stick
  };

  const onEffect = (e: Effect) => {
    // After the fix the PC is just for looking: a later mistake does not count against the player.
    const cur = latest.current.s;
    if (cur.stage !== 'repair' || cur.route) return;
    act(e.type === 'mistake' ? { type: 'mistake' } : { type: 'repaired', route: e.route, bypassedChecks: e.bypassedChecks });
    const r = latest.current.gc.template.customer.reactionsTh;
    const coachNow = latest.current.gc.template.coach;
    if (e.type === 'mistake' && coachNow && latest.current.s.mistakes === 1) setNudge(coachNow.firstMistakeTh);
    if (e.type === 'reached-setup') {
      setNudge(null);
      setSaid(reactionLine(r, 'fixed'));
    } else if (e.reason === 'no-boot-device') setSaid(reactionLine(r, 'no-boot'));
    else if (e.reason === 'wrong-image') setSaid(reactionLine(r, 'wrong-image'));
    else if (e.reason === 'legacy-boot') setSaid(reactionLine(r, 'cant-run'));
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
      const g = newCase(content, latest.current.gc.template.id);
      pcRef.current = undefined;
      rufusRef.current = undefined;
      usbRef.current = usbOf(g);
      setWritten(false);
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

  const notes = (saying || nudge || hintList) && (
    <div class="pc-notes">
      {saying}
      {nudge && tip(nudge)}
      {hintList}
    </div>
  );

  if (laptopOpen) {
    return (
      <RufusScreen
        initial={rufusRef.current ?? openRufus(usbRef.current)}
        onRufus={(r) => (rufusRef.current = r)}
        onEffect={onRufusEffect}
        onClose={closeScreens}
        footer={
          <div class="pc-footer">
            {written && (
              <p class="usb-note" role="status" data-testid="usb-note">
                ✔ ทำ USB เสร็จแล้ว เสียบกลับเครื่อง{name}ให้แล้ว
              </p>
            )}
            {notes}
            <div class="pc-actions">
              {hintButton}
              <button class={`btn small${written ? '' : ' ghost'}`} type="button" onClick={openSim}>
                ไปที่เครื่องลูกค้า
              </button>
            </div>
          </div>
        }
      />
    );
  }

  if (simOpen) {
    return (
      <PcScreen
        brand={gc.brand}
        machine={gc.machine}
        initial={pcRef.current ?? insertUsb(powerOn(gc.machine), usbRef.current)}
        onPc={(pc) => (pcRef.current = pc)}
        onEffect={onEffect}
        coach={!!coach}
        onClose={closeScreens}
        footer={
          <div class="pc-footer">
            {/* Text scrolls when space is short (phones on their side); the buttons below always stay in view. */}
            {notes}
            <div class="pc-actions">
              {hintButton}
              {needsLaptop(gc) && !s.route && (
                <button class="btn ghost small" type="button" onClick={openLaptop}>
                  โน้ตบุ๊กร้าน
                </button>
              )}
              {s.route && (
                <button
                  class="btn small"
                  type="button"
                  onClick={() => {
                    closeScreens();
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
          <p class="ask">
            {s.route
              ? 'บูตจาก USB ได้แล้ว กลับไปคุยกับลูกค้า'
              : needsLaptop(gc)
                ? 'มีเครื่องลูกค้ากับโน้ตบุ๊กของร้านบนเคาน์เตอร์ แตะเครื่องที่จะใช้ แล้วทำให้เครื่องลูกค้าบูตจาก USB'
                : 'แตะคอมบนเคาน์เตอร์เพื่อเปิดเครื่องของลูกค้า แล้วทำให้เครื่องบูตจาก USB'}
          </p>
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
            {needsLaptop(gc) && !s.route && (
              <button class="btn ghost" type="button" onClick={openLaptop}>
                เปิดโน้ตบุ๊กร้าน
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
