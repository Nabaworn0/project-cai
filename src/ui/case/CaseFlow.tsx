// One case from the customer walking in to the summary (docs/case1-plan.md section 1).
// The rules live in src/core/session.ts; this component shows each stage in the panel at the bottom of
// the screen, opens the customer's PC (and in case 2 the shop laptop with Rufus) for the repair, and keeps
// the customer's expression in step. The install USB is one stick shared by both: whatever Rufus writes
// goes back into the customer's PC (docs/case2-plan.md). From case 3 the job goes on through Windows Setup
// to the install: the player asks the customer about a backup before wiping the disk, and a stick wiped
// in Setup brings out the shop laptop to make it again (docs/case3-plan.md). Case 5 goes on past the install
// to Windows' first-time setup and the desktop: the customer signs in themself (docs/case5-plan.md).

import { PLAYABLE } from '../../core/path';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { bus } from '../../core/bus';
import { generateCase, nextCase, type GeneratedCase } from '../../core/cases';
import { confirmBackup, insertUsb, powerOn, type Effect, type Pc } from '../../core/pc';
import { ISO_FILES, openRufus, type Rufus, type RufusEffect, type Usb } from '../../core/rufus';
import { goodbyeLine, reactionLine } from '../../core/reactions';
import {
  blockedNext,
  currentQuestion,
  customerMood,
  hasCheck,
  shownHints,
  startSession,
  step,
  summarize,
  type Answer,
  type Session,
  type SessionEvent,
} from '../../core/session';
import type { Content } from '../../content';
import type { Cutscenes } from '../../content/schema';
import { PcScreen } from '../sim/PcScreen';
import { RufusScreen } from '../sim/RufusScreen';
import { play } from '../sound';
import { ChoiceList, Feedback } from './parts';
import { SummaryCard } from './SummaryCard';
import { Win11CheckTable } from './Win11Check';
import { TalkBox } from './TalkBox';
import { TicketCard } from './TicketCard';

interface Props {
  content: Content;
  /** The shop scene is on screen, so the customer can walk in. */
  ready: boolean;
  /** The case picked in the menu; without one, ?case= or case 1. */
  first?: string;
  /** Started from the menu's learning path: after the last case the way on is the menu, not a random customer. */
  inPath: boolean;
  /** Once per finished case, when the summary appears: its stars and coins. */
  onFinish: (caseId: string, stars: number, coins: number) => void;
  onMenu: () => void;
  /** Where the case is, so the menu button knows whether leaving loses a job in progress. */
  onStage: (stage: string) => void;
  /** Talks with the senior already shown on their own ('intro', case ids); null skips every talk (?case= links). */
  seen: readonly string[] | null;
  onSeen: (id: string) => void;
  /** The menu's "ดูฉากต้อนรับอีกครั้ง": the welcome talk again before the customer. */
  replayIntro?: boolean;
}

export { PLAYABLE };

/**
 * The next customer: case 1, then 2, then 3, then mixed (nextCase). The first one is the menu's pick, or ?case=<id>
 * (for teachers and tests). A new seed gives a new machine each time.
 */
function newCase(content: Content, lastId: string | null, first?: string): GeneratedCase {
  const playable = content.cases.filter((c) => PLAYABLE.includes(c.id));
  const params = lastId === null ? new URLSearchParams(location.search) : null;
  const wanted = lastId === null ? (first ?? params?.get('case')) : null;
  const template = playable.find((c) => c.id === wanted) ?? nextCase(playable, lastId, Math.random);
  // ?seed= fixes the first customer's machine (hidden extras such as "no product key"), for tests and teachers.
  return generateCase(template, content, params?.get('seed') || `${Date.now()}`);
}

/** The install stick the customer brought, as the machine describes it. */
function usbOf(gc: GeneratedCase): Usb {
  const m = gc.machine;
  const label = ISO_FILES.find((f) => f.os === m.usbOs)?.label ?? 'USB';
  return { scheme: m.usbScheme, os: m.usbOs, label, bypassChecks: m.usbBypassChecks };
}

/** Cases whose fix is remaking the stick, or whose stick is MBR (Windows 11 needs GPT), get the shop laptop
 *  (others get it once the stick is wiped in Setup). */
const needsLaptop = (gc: GeneratedCase) => gc.problems.some((p) => p.fixes.includes('remake-usb')) || gc.machine.usbScheme === 'mbr';

/** Installs onto a disk that still holds the customer's files: ask about a backup before wiping it, unless the
 *  customer already said the files are not needed (case 5). */
const asksBackup = (gc: GeneratedCase) => gc.template.goal !== 'setup' && gc.machine.diskHasData && !gc.template.customer.filesNotNeeded;

/** The customer's PC as it comes in, with the stick they brought (and their word on the files, when given up front). */
function startPc(gc: GeneratedCase, usb: Usb): Pc {
  const pc = insertUsb(powerOn(gc.machine), usb);
  return gc.template.customer.filesNotNeeded ? confirmBackup(pc) : pc;
}

/** What Rufus finds on a stick whose partition Setup deleted. */
const WIPED_LABEL = 'NO_LABEL';

export function CaseFlow({ content, ready, first, inPath, onFinish, onMenu, onStage, seen, onSeen, replayIntro }: Props) {
  const [gc, setGc] = useState(() => newCase(content, null, first));
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
  /** Case 3: the customer said the files are backed up; the stick was wiped in Setup (the laptop comes out). */
  const [askedBackup, setAskedBackup] = useState(false);
  const [stickWiped, setStickWiped] = useState(false);
  const wipedRef = useRef(false);
  /** Case 5: the install finished (with or without the right edition); the repair ends on the desktop. */
  const installedRef = useRef<{ wrongEdition: boolean } | null>(null);
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

  /** A talk with the senior on screen: its scenes' ids, its lines, and whether the customer walks in after it. */
  const [talk, setTalk] = useState<{ ids: string[]; lines: Cutscenes['scenes'][number]['lines']; thenEnter: boolean } | null>(null);
  const shownIntro = useRef(false);
  const talkFor = (ids: string[], thenEnter: boolean) => {
    const scenes = ids.flatMap((id) => content.cutscenes.scenes.filter((sc) => sc.id === id));
    return scenes.length ? { ids: scenes.map((sc) => sc.id), lines: scenes.flatMap((sc) => sc.lines), thenEnter } : null;
  };
  const enterCustomer = (g: GeneratedCase) => {
    bus.emit('customer:enter', { id: g.template.customer.id, mood: customerMood(g, startSession(g)) });
    play('bell');
  };

  // The customer walks in when the shop is ready, and again for every new case; on the learning path the senior
  // first comes over for the welcome (once, or when asked to replay it) and the talk about this case (its first time).
  useEffect(() => {
    if (!ready) return;
    setArrived(false);
    const off = bus.on('customer:arrived', ({ id }) => id === gc.template.customer.id && setArrived(true));
    const ids: string[] = [];
    if (seen && (!seen.includes('intro') || (replayIntro && !shownIntro.current))) ids.push('intro');
    if (seen && !seen.includes(gc.template.id)) ids.push(gc.template.id);
    shownIntro.current ||= ids.includes('intro');
    const t = talkFor(ids, true);
    if (t) setTalk(t);
    else enterCustomer(gc);
    return off;
  }, [ready, gc]);
  const talkDone = () => {
    const t = talk!;
    t.ids.forEach(onSeen);
    setTalk(null);
    if (t.thenEnter) enterCustomer(latest.current.gc);
  };

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
        if (latest.current.s.stage === 'repair' && (needsLaptop(latest.current.gc) || wipedRef.current)) openLaptop();
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
    onFinish(gc.template.id, summary.stars, summary.coins);
    if (summary.stars >= 2) bus.emit('customer:cheer', {});
  }, [summary !== null]);

  // A long panel scrolls: bring the answer's explanation into view, and start each stage at the top.
  useEffect(() => {
    const p = panelRef.current;
    if (p) p.scrollTop = feedback ? p.scrollHeight : 0;
  }, [feedback, s.stage]);

  useEffect(() => {
    const stage = talk ? 'talk' : arrived ? s.stage : 'arriving';
    document.body.dataset.caseStage = stage;
    onStage(stage);
  }, [arrived, s.stage, talk !== null]);
  // Back to the menu: the customer walks out and the page no longer claims a case stage.
  useEffect(
    () => () => {
      bus.emit('customer:leave', {});
      delete document.body.dataset.caseStage;
    },
    [],
  );

  const openSim = () => {
    setLaptopOpen(false);
    setSimOpen(true);
    setOpened(true);
  };
  const openLaptop = () => {
    // A stick wiped in Setup shows up in Rufus as an empty drive, and Rufus starts over with it.
    if (pcRef.current?.machine.usbOs === 'empty' && usbRef.current.os !== 'empty') {
      usbRef.current = { ...usbRef.current, os: 'empty', label: WIPED_LABEL };
      rufusRef.current = undefined;
    }
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
    // The case is fixed at its goal: Setup's first page (cases 1–2), or Windows installed (case 3 on).
    const goal = latest.current.gc.template.goal;
    const r = latest.current.gc.template.customer.reactionsTh;
    if (e.type === 'reached-setup' && goal !== 'setup') {
      setNudge(null);
      setSaid(reactionLine(r, 'reached-setup'));
      return;
    }
    if (e.type === 'installed' && goal === 'desktop') {
      installedRef.current = { wrongEdition: e.wrongEdition };
      setNudge(null);
      setSaid(reactionLine(r, 'installed'));
      return;
    }
    if (e.type === 'installed' && goal !== 'install') return;
    if (e.type === 'oobe-note') {
      if (e.note === 'handed-over') setSaid(reactionLine(r, 'handed-over'));
      if (e.note === 'privacy-asked') setSaid(reactionLine(r, 'privacy-asked'));
      return;
    }
    if (e.type === 'legacy-no-boot') {
      setSaid(reactionLine(r, 'no-boot'));
      return;
    }
    if (e.type === 'cant-run') {
      setSaid(reactionLine(r, 'cant-run'));
      return;
    }
    const bypassedChecks = pcRef.current?.machine.usbBypassChecks;
    if (e.type === 'mistake') act({ type: 'mistake' });
    else if (e.type === 'reached-setup') act({ type: 'repaired', route: e.route, bypassedChecks: e.bypassedChecks });
    else if (e.type === 'desktop')
      act({ type: 'repaired', route: 'desktop', bypassedChecks, wrongEdition: installedRef.current?.wrongEdition, oobe: e.result });
    else act({ type: 'repaired', route: 'install', bypassedChecks, wrongEdition: e.wrongEdition });
    const coachNow = latest.current.gc.template.coach;
    if (e.type === 'mistake' && coachNow && latest.current.s.mistakes === 1) setNudge(coachNow.firstMistakeTh);
    if (e.type !== 'mistake') {
      setNudge(null);
      setSaid(reactionLine(r, e.type === 'desktop' && !e.result.thaiKeyboard ? 'no-thai-keyboard' : 'fixed'));
    } else if (e.reason === 'no-backup-check') setSaid(reactionLine(r, 'no-backup'));
    else if (e.reason === 'typed-for-customer' || e.reason === 'asked-password') setSaid(reactionLine(r, 'account-trap'));
    else if (e.reason === 'deleted-installer') {
      wipedRef.current = true;
      setStickWiped(true);
      setSaid(reactionLine(r, 'lost-installer'));
    }
    else if (e.reason === 'no-boot-device') setSaid(reactionLine(r, 'no-boot'));
    else if (e.reason === 'wrong-image') setSaid(reactionLine(r, 'wrong-image'));
    else if (e.reason === 'legacy-boot') setSaid(reactionLine(r, 'cant-run'));
    else if (e.reason === 'still-cant-run') setSaid(reactionLine(r, 'still-cant-run'));
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
      setAskedBackup(false);
      setStickWiped(false);
      wipedRef.current = false;
      installedRef.current = null;
      setFeedback(null);
      setS(startSession(g));
      setGc(g);
    });
    bus.emit('customer:leave', {});
  };

  const lastInPath = inPath && gc.template.id === PLAYABLE[PLAYABLE.length - 1];

  const hintButton = s.stage === 'repair' && !s.route && (
    <button class="btn ghost small" type="button" disabled={s.hintsUsed >= s.hints.length} onClick={() => act({ type: 'hint' })}>
      คำใบ้ ({s.hints.length - s.hintsUsed})
    </button>
  );
  const laptopHere = needsLaptop(gc) || stickWiped;
  const askBackup = () => {
    play('key');
    setAskedBackup(true);
    if (pcRef.current) pcRef.current = confirmBackup(pcRef.current);
    setSaid(reactionLine(gc.template.customer.reactionsTh, 'backup'));
  };
  const backupButton = s.stage === 'repair' && !s.route && asksBackup(gc) && !askedBackup && (
    <button class="btn ghost small" type="button" onClick={askBackup}>
      ถามเรื่องสำรองข้อมูล
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
              {backupButton}
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
        initial={pcRef.current ?? startPc(gc, usbRef.current)}
        onPc={(pc) => (pcRef.current = pc)}
        onEffect={onEffect}
        coach={!!coach}
        goal={gc.template.goal}
        customerName={name}
        backupAsked={askedBackup}
        onClose={closeScreens}
        footer={
          <div class="pc-footer">
            {/* Text scrolls when space is short (phones on their side); the buttons below always stay in view. */}
            {notes}
            <div class="pc-actions">
              {hintButton}
              {backupButton}
              {laptopHere && !s.route && (
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

  if (ready && talk) return <TalkBox key={talk.ids.join(' ')} lines={talk.lines} onDone={talkDone} />;
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
            {seen && content.cutscenes.scenes.some((sc) => sc.id === gc.template.id) && (
              <button class="btn ghost small" type="button" onClick={() => setTalk(talkFor([gc.template.id], false))}>
                ฟังพี่ช่างอีกครั้ง
              </button>
            )}
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
          {hasCheck(gc) && (
            <Win11CheckTable
              rows={content.win11Check.rows}
              machine={gc.machine}
              answers={s.checks}
              onAnswer={(id, answer) => {
                const next = act({ type: 'check', id, answer });
                play(next.checks.at(-1)!.correct ? 'right' : 'mistake');
              }}
            />
          )}
          <div class="actions">
            <button class="btn" type="button" disabled={!!blockedNext(s, gc)} onClick={() => act({ type: 'next' })}>
              รับงาน
            </button>
          </div>
        </>
      );
      break;
    case 'diagnose': {
      const q = gc.template.diagnosis;
      const shot = gc.template.diagnosisPhoto;
      const text = shot && gc.problems.find((p) => p.id === shot.problem)?.screenText;
      const photo = shot && text ? { text, captionTh: shot.captionTh } : null;
      body = (
        <>
          <p class="ask">ก่อนลงมือ ลองเดาก่อนว่าสาเหตุคืออะไร</p>
          {photo && (
            <figure class="error-photo" data-testid="error-photo">
              <div class="error-photo-screen">{photo.text}</div>
              <figcaption>📷 {photo.captionTh}</figcaption>
            </figure>
          )}
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
              ? gc.template.goal === 'desktop'
                ? 'ติดตั้งและตั้งค่า Windows 11 จนถึงเดสก์ท็อปแล้ว กลับไปคุยกับลูกค้า'
                : gc.template.goal === 'install'
                  ? 'ติดตั้ง Windows 11 เสร็จแล้ว กลับไปคุยกับลูกค้า'
                  : 'บูตจาก USB ได้แล้ว กลับไปคุยกับลูกค้า'
              : gc.template.repairTh
                ? gc.template.repairTh
                : gc.template.goal === 'install'
                  ? 'แตะคอมบนเคาน์เตอร์เพื่อเปิดเครื่องของลูกค้า แล้วติดตั้ง Windows 11 ให้เสร็จ'
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
            {laptopHere && !s.route && (
              <button class="btn ghost" type="button" onClick={openLaptop}>
                เปิดโน้ตบุ๊กร้าน
              </button>
            )}
            {backupButton}
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
          {lastInPath && <p class="coach-tip">ฝึกครบทุกเคสแล้ว กลับไปที่เมนูเพื่อทำขั้นต่อไป</p>}
          <div class="actions">
            <button class={lastInPath ? 'btn' : 'btn ghost'} type="button" onClick={onMenu}>
              กลับเมนู
            </button>
            {!lastInPath && (
              <button class="btn" type="button" onClick={nextCustomer}>
                รับลูกค้าคนถัดไป
              </button>
            )}
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
