// HTML overlay above the Phaser canvas: HUD, the case panels, and the simulated screen.
// Text that people read or type lives here (sharp at any DPI, Thai input works), not in the canvas.
// Two places (docs/learning-page-plan.md): the learning page, a page of its own (with the pre/post test on its
// board, docs/quiz-plan.md), and the shop, whose scene (Phaser) is only loaded the first time the learner goes
// there and is paused while they are away.
// Each page has its own address (#/learn, #/pre, #/post, #/order, #/shop: docs/pages-plan.md), so Back, reloading
// and links work as on any website; which page an address may open is src/core/routes.ts. Between pages the shop's
// shutter rolls down and up (Shutter.tsx), held down the first time the shop's scene loads. The technician's book
// (docs/book-plan.md) opens over whichever page it is opened from: the menu, the shop's HUD, or the case summary;
// free play's decorating (src/core/decor.ts) opens the same way, from its menu or the shop's HUD.
// Free play (โหมดอิสระ, src/core/free.ts) swaps in a save of its own and its own menu; the results sent to the teacher
// are the class's save only, so nothing played there reaches the sheet.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Game } from 'phaser';
import { bus } from '../core/bus';
import { loadContent } from '../content';
import type { ShopLayout } from '../game/scenes/ShopScene';
import { CaseFlow, PLAYABLE } from './case/CaseFlow';
import { SUMMARY_REVEAL_MS } from './case/SummaryCard';
import { MenuScreen } from './menu/MenuScreen';
import { FreeMenu } from './menu/FreeMenu';
import { BookScreen } from './book/BookScreen';
import { DecorScreen } from './decor/DecorScreen';
import { buy, place, takeOff } from '../core/decor';
import { unlockedCards, unreadCards } from '../core/book';
import { StartScreen } from './start/StartScreen';
import { LessonScreen } from './lesson/LessonScreen';
import { ReflectScreen } from './reflect/ReflectScreen';
import { useSync } from './sync';
import { ResultsScreen } from './results/ResultsScreen';
import { OrderScreen } from './order/OrderScreen';
import { QuizScreen } from './quiz/QuizScreen';
import { loadFree, loadMode, loadProgress, saveFree, saveMode, saveProgress, type Progress } from './progress';
import { classFinished, freeRoute, freeStart, type Mode } from '../core/free';
import { mixedCase, mixedVisits, pickVisit, visitKey, visitProblems } from '../core/visits';
import { rankIndex, rankStats, toNext, type Rank } from '../core/rank';
import type { GeneratedCase } from '../core/cases';
import { EMPTY, markCardRead, markSeen, pathView, recordCase, recordJob, recordLesson, recordOrder, recordQuiz, recordReflect, type PathOptions, type StepId } from '../core/path';
import { allowedRoute, parseRoute, routeHash, type Route } from '../core/routes';
import { prefersLessMotion } from './motion';
import { RankBadge } from './menu/RankBadge';
import { Shutter, SHUTTER_MS, type ShutterPhase } from './Shutter';
import { isMuted, onMuted, play, setMuted, unlockOnGesture } from './sound';
import './case/case.css';

const content = loadContent();
const params = new URLSearchParams(location.search);

/** Steps whose screens exist (docs/learning-path-plan.md); the rest show as "เร็วๆ นี้". */
const BUILT: ReadonlySet<StepId> = new Set<StepId>(['pre', 'lesson-os', 'lesson-types', 'order', 'cases', 'post', 'reflect', 'results']);
const pathOptions: PathOptions = { built: BUILT, caseIds: PLAYABLE, unlockAll: params.get('unlock') === 'all' };
/** Free play: every case open at once. */
const freeOptions: PathOptions = { ...pathOptions, unlockAll: true };
/** Free play's customers: each with a problem mixed in from another case (src/core/visits.ts). */
const freeCases = content.cases.filter((c) => PLAYABLE.includes(c.id));
const VISITS = mixedVisits(freeCases, content.problems);
/** Free play's ranks (docs/phase3-plan.md task C), and every problem it can bring (the top rank needs them met). */
const RANKS = content.ranks.ranks;
const PROBLEMS_ALL = visitProblems(freeCases, VISITS);

/** The shop scene, started once on the first visit. */
let game: Promise<Game> | null = null;
const startShop = () => (game ??= import('../game').then(({ startGame }) => startGame(document.getElementById('game')!)));
/** Long enough for a customer to walk out before the scene is paused. */
const PAUSE_AFTER_MS = 3000;

type View = 'menu' | 'test' | 'lesson' | 'order' | 'shop' | 'reflect' | 'results';
const VIEW: Record<Route, View> = {
  learn: 'menu',
  pre: 'test',
  post: 'test',
  'lesson-os': 'lesson',
  'lesson-types': 'lesson',
  order: 'order',
  shop: 'shop',
  reflect: 'reflect',
  results: 'results',
};
/** ?case= (teachers, tests) goes straight to that customer, outside the pages. */
const caseLink = params.has('case');
/** The same page with another address (the query, such as ?seed=, stays). */
const urlOf = (r: Route) => `${location.pathname}${location.search}${routeHash(r)}`;
const nextCase = (p: Progress, m: Mode) => pathView(p, m === 'free' ? freeOptions : pathOptions).cases.find((c) => c.status === 'open')?.id;
/** The page an address may open now, in this mode. */
const allowed = (r: Route, m: Mode, p: Progress) => (m === 'free' ? freeRoute(r) : allowedRoute(r, !!p.learner, pathView(p, pathOptions)));
/** Leaving before the job starts or after it ends loses nothing; in the middle, ask first. */
const CALM_STAGES = ['', 'arriving', 'talk', 'intro', 'summary'];
/** The boot screen is shown once per device. */
const BOOT_KEY = 'shop.boot.v1';
const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (key: string) => {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Not kept: the boot screen shows again next visit.
  }
};
const fade = prefersLessMotion();
const shutterMs = fade ? SHUTTER_MS.fade : SHUTTER_MS.roll;

export function App() {
  const [ready, setReady] = useState(false);
  const [shopLayout, setShopLayout] = useState<ShopLayout | null>(null);
  const sign = shopLayout?.sign;
  const signDecor = shopLayout?.signDecor ?? 0;
  const [mode, setMode] = useState<Mode>(loadMode);
  const free = mode === 'free';
  const [classProgress, setClassProgress] = useState(loadProgress);
  /** Free play's save, null until the first visit to it. */
  const [freeProgress, setFreeProgress] = useState(loadFree);
  const progress = free ? (freeProgress ?? EMPTY) : classProgress;
  // Only the class's save is ever sent.
  const sync = useSync(classProgress);
  // The page the address asks for, if it may open now; else the learning page.
  const [route, setRoute] = useState<Route>(() => allowed(parseRoute(location.hash), mode, progress));
  const view: View = caseLink ? 'shop' : VIEW[route];
  const test = route === 'post' ? 'post' : 'pre';
  /** The case picked in the menu, and a count that gives each visit to the shop a fresh case flow. */
  const [first, setFirst] = useState<string | undefined>(() => (route === 'shop' ? nextCase(progress, mode) : undefined));
  const [visit, setVisit] = useState(0);
  const stage = useRef('');
  // The address listener reads these, not the values of the render it was set up in.
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const routeRef = useRef(route);
  /** What the tap that changed the address asked for: a case, the welcome again, or leaving a case without asking. */
  const pending = useRef<{ caseId?: string; replayIntro?: boolean; leaving?: boolean }>({});
  const [shutter, setShutter] = useState<{ phase: ShutterPhase; to: Route }>({ phase: 'idle', to: route });
  /** Counts page changes, so the timers of one cut short by the next do nothing. */
  const changes = useRef(0);

  // The shutter rolls down, the page changes behind it; it rolls up once the new page can be shown.
  const changePage = (r: Route) => {
    const n = ++changes.current;
    setShutter({ phase: 'down', to: r });
    setTimeout(() => {
      if (changes.current !== n) return;
      setRoute(r);
      setShutter({ phase: 'closed', to: r });
    }, shutterMs.down);
  };
  // The shop's scene, the first time, takes a while to load: the shutter stays down until it is ready.
  useEffect(() => {
    if (shutter.phase !== 'closed' || (view === 'shop' && !ready)) return;
    const n = changes.current;
    setShutter((sh) => ({ ...sh, phase: 'up' }));
    setTimeout(() => changes.current === n && setShutter((sh) => ({ ...sh, phase: 'idle' })), shutterMs.up);
  }, [shutter.phase, view, ready]);
  useEffect(() => {
    document.body.dataset.shutter = shutter.phase;
  }, [shutter.phase]);
  const [askLeave, setAskLeave] = useState(false);
  const [replayIntro, setReplayIntro] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  /** The start page (docs/start-page-plan.md): before the name form, and again from the menu ("เกี่ยวกับเกม"). */
  const [started, setStarted] = useState(false);
  const [about, setAbout] = useState(false);
  const [bootSeen, setBootSeen] = useState(() => readFlag(BOOT_KEY));
  /** The technician's book, when open: on a card (a link from the case summary), or on the list. */
  const [book, setBook] = useState<{ card?: string } | null>(null);
  const cardsGot = unlockedCards(content.cards.cards, progress);
  const cardsNew = unreadCards(content.cards.cards, progress).length;
  // Free play's rank, worked out from its save; -1 in the class mode, which has none.
  const stats = rankStats(progress, PROBLEMS_ALL, cardsGot.size, content.cards.cards.length);
  const rank = free ? rankIndex(RANKS, stats) : -1;
  /** The rank just stepped up to, for the case summary; gone once the summary is left. */
  const [promoted, setPromoted] = useState<Rank | null>(null);
  const lastRank = useRef(rank);
  useEffect(() => {
    // Coming into free play is not a step up (from -1); a higher rank afterwards is.
    if (rank > lastRank.current && lastRank.current >= 0) setPromoted(RANKS[rank]!);
    lastRank.current = rank;
  }, [rank]);
  /** Decorating the shop (free play only), when open. */
  const [decorOpen, setDecorOpen] = useState(false);
  const openDecor = () => {
    play('key');
    setDecorOpen(true);
  };
  const openBook = (card?: string) => {
    play('key');
    setBook({ card });
  };

  // The shop's scene runs only while the shop is on screen.
  useEffect(() => {
    document.body.dataset.view = view;
    if (view === 'shop') {
      void startShop().then((g) => {
        g.loop.wake();
        document.body.dataset.shopRunning = 'true';
      });
      return;
    }
    if (!game) return;
    const t = setTimeout(
      () =>
        void game?.then((g) => {
          g.loop.sleep();
          document.body.dataset.shopRunning = 'false';
        }),
      PAUSE_AFTER_MS,
    );
    return () => clearTimeout(t);
  }, [view]);

  // A page reached by its address: a tap here, Back/Forward, or a typed or shared link.
  const arrive = (wanted: Route) => {
    const p = progressRef.current;
    const r = allowed(wanted, modeRef.current, p);
    const { leaving, ...asked } = pending.current;
    pending.current = {};
    // Back in the middle of a case: stay (on a new entry, so Back can ask again), and ask as "☰ เมนู" does.
    if (routeRef.current === 'shop' && r !== 'shop' && !leaving && !CALM_STAGES.includes(stage.current)) {
      history.pushState(null, '', urlOf('shop'));
      setAskLeave(true);
      return;
    }
    if (location.hash !== routeHash(r)) history.replaceState(null, '', urlOf(r));
    setAskLeave(false);
    if (r === routeRef.current) return;
    if (r === 'shop') {
      setReplayIntro(!!asked.replayIntro);
      setFirst(asked.caseId ?? nextCase(p, modeRef.current));
      setVisit((n) => n + 1);
    }
    routeRef.current = r;
    changePage(r);
  };
  const go = (r: Route) => (location.hash === routeHash(r) ? arrive(r) : (location.hash = routeHash(r)));

  useEffect(() => {
    if (caseLink) return;
    // The address says which page is showing (the learning page if it asked for one that cannot open yet).
    history.replaceState(null, '', urlOf(route));
    const onHash = () => arrive(parseRoute(location.hash));
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    unlockOnGesture();
    const offs = [bus.on('scene:ready', () => setReady(true)), bus.on('layout:shop', setShopLayout), onMuted(setMutedState)];
    // Effects run after paint, so the scene may already have announced itself.
    if (bus.last('scene:ready')) setReady(true);
    const l = bus.last('layout:shop');
    if (l) setShopLayout(l);
    return () => offs.forEach((off) => off());
  }, []);

  const update = (f: (p: Progress) => Progress) =>
    free
      ? setFreeProgress((p) => {
          const next = f(p ?? EMPTY);
          saveFree(next);
          return next;
        })
      : setClassProgress((p) => {
          const next = f(p);
          saveProgress(next);
          return next;
        });
  useEffect(() => {
    document.body.dataset.mode = mode;
  }, [mode]);
  // Free play's decorations, drawn by the shop's scene (the class mode's shop has none).
  const placed = free ? progress.decor.placed : {};
  const placedKey = JSON.stringify(placed);
  useEffect(() => {
    const items = content.decor.items.filter((i) => placed[i.slot] === i.id).map(({ slot, id, icon }) => ({ slot, id, icon }));
    bus.emit('decor:placed', { items });
  }, [placedKey]);
  /** Into free play, from the start page or the class's menu (both on #/learn, where its menu then shows). */
  const enterFree = () => {
    if (!freeProgress) {
      const start = freeStart(classProgress);
      saveFree(start);
      setFreeProgress(start);
    }
    saveMode('free');
    setMode('free');
    setAbout(false);
  };
  /** Back to the class mode: the start page, or the learning path when a name is given on this device. */
  const leaveFree = () => {
    saveMode('class');
    setMode('class');
    setDecorOpen(false);
    setStarted(false);
  };
  const finish = (caseId: string, stars: number, coins: number, gc: GeneratedCase) =>
    update((p) => {
      const next = recordCase({ ...p, coins: p.coins + coins }, caseId, stars);
      return gc.mixed ? recordJob(next, visitKey(gc.mixed), gc.problems.map((x) => x.id), stars) : next;
    });
  /** Free play's next job: a pair not met yet first, not the same customer twice in a row. */
  const nextVisit = (lastHost: string | null) =>
    mixedCase(freeCases, content, pickVisit(VISITS, progressRef.current.jobs.pairs, lastHost, Math.random), `${Date.now()}`);
  const enter = (step: StepId, caseId?: string, opts: { replayIntro?: boolean } = {}) => {
    if (step === 'cases') {
      pending.current = { caseId, replayIntro: opts.replayIntro };
      go('shop');
    } else if (step === 'pre' || step === 'post' || step === 'order' || step === 'lesson-os' || step === 'lesson-types' || step === 'reflect' || step === 'results') go(step);
  };
  const toMenu = () => {
    pending.current = { leaving: true };
    go('learn');
  };
  /** Tells the shop's scene when the HUD's chips change size, so its sign stays clear of them. */
  // A stable callback: the header is observed once each time it is put on the page, not at every render. Its brand
  // chip and its right-hand group stay mounted while it is, and change size with what is in them.
  const hudObserver = useRef<ResizeObserver | null>(null);
  const hudRef = useCallback((el: HTMLElement | null) => {
    hudObserver.current?.disconnect();
    hudObserver.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    hudObserver.current = new ResizeObserver(() => bus.emit('hud:resize', {}));
    for (const part of el.querySelectorAll('.brand, .hud-right')) hudObserver.current.observe(part);
  }, []);
  const menuTapped = () => (CALM_STAGES.includes(stage.current) ? toMenu() : setAskLeave(true));

  return (
    <>
      {/* Thai text cannot be drawn legibly at art-pixel size, so the sign's name is HTML laid over the board. */}
      {view === 'shop' && sign && (
        <div
          class="sign-label"
          aria-hidden="true"
          style={{
            left: `${sign.x}px`,
            top: `${sign.y}px`,
            width: `${sign.w}px`,
            height: `${sign.h}px`,
            fontSize: `${Math.round(sign.h * 0.6)}px`,
            // Centred in the room right of a sign decoration (free play), clear of it.
            paddingLeft: `${signDecor && signDecor + Math.round(sign.h * 0.15)}px`,
          }}
        >
          ร้านซ่อมคอม
        </div>
      )}

      {view === 'shop' && (
        <header class="hud" ref={hudRef}>
          <button class="chip menu-chip" type="button" onClick={menuTapped}>
            ☰ เมนู
          </button>
          <h1 class={`chip brand${free ? ' free' : ''}`}>
            {/* Free play: the rank in the shop's place (the sign above says the shop), so it shows on the smallest phones. */}
            {free ? (
              <span data-testid="hud-rank" title={`ยศช่าง: ${RANKS[rank]!.nameTh}`}>
                <RankBadge rank={RANKS[rank]!} /> <span class="rank-name">{RANKS[rank]!.nameTh}</span>
              </span>
            ) : (
              'ร้านซ่อมคอม'
            )}{' '}
            <small data-testid="hud-mode">{free ? 'เล่นอิสระ' : 'รอบ 1'}</small>
          </h1>
          <div class="hud-right">
            {free && (
              <button class="chip decor-chip" type="button" aria-label="แต่งร้าน" title="แต่งร้าน: ซื้อของมาวางในร้าน" data-testid="hud-decor" onClick={openDecor}>
                🛋️
              </button>
            )}
            <button class="chip book-chip" type="button" aria-label="สมุดช่าง" title="สมุดช่าง: การ์ดความรู้ที่สะสมไว้" data-testid="hud-book" onClick={() => openBook()}>
              📖
              {cardsNew > 0 && <span class="book-dot" data-testid="book-dot" aria-hidden="true" />}
            </button>
            <CoinChip coins={progress.coins} />
            <button
              class="chip sound-chip"
              type="button"
              // A toggle: one name, its state in aria-pressed (a name like "ปิดเสียง" would also match "ปิด", the PC's close button).
              aria-pressed={!muted}
              aria-label="เสียงในเกม"
              title={muted ? 'เสียงปิดอยู่ แตะเพื่อเปิด' : 'เสียงเปิดอยู่ แตะเพื่อปิด'}
              onClick={() => setMuted(!muted)}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <div class="chip sim-badge" role="status" title="ทุกหน้าจอในเกมเป็นการจำลอง ไม่ได้ติดตั้งระบบจริง">
              <span class="sim-long">โหมด</span>จำลอง
            </div>
          </div>
        </header>
      )}

      {view === 'menu' && !free && (about || (!progress.learner && !started)) ? (
        <StartScreen
          text={content.start}
          boot={!about && !bootSeen}
          onBooted={() => {
            setBootSeen(true);
            writeFlag(BOOT_KEY);
          }}
          className={sync.cls?.name ?? null}
          onLeaveClass={sync.leave}
          muted={muted}
          onMuted={setMuted}
          again={about}
          onStart={() => {
            setStarted(true);
            setAbout(false);
          }}
          onFree={enterFree}
        />
      ) : view === 'menu' && free ? (
        <FreeMenu
          progress={progress}
          pairs={VISITS.length}
          rank={{ now: RANKS[Math.max(0, rank)]!, next: toNext(RANKS, stats) }}
          onEnter={(step, caseId) => enter(step, caseId)}
          onLeave={leaveFree}
          coins={<CoinChip coins={progress.coins} />}
          book={{ got: cardsGot.size, total: content.cards.cards.length, fresh: cardsNew, onOpen: () => openBook() }}
          decor={{ placed: Object.keys(progress.decor.placed).length, slots: content.decor.slots.length, onOpen: openDecor }}
        />
      ) : view === 'menu' ? (
        <MenuScreen
          content={content}
          progress={progress}
          options={pathOptions}
          onLearner={(learner) => update((p) => ({ ...p, learner }))}
          onReset={() => {
            update(() => EMPTY);
            setStarted(false);
          }}
          onEnter={enter}
          onAbout={() => setAbout(true)}
          aboutLabel={content.start.aboutLink}
          roomMismatch={content.start.roomMismatch}
          coins={<CoinChip coins={progress.coins} />}
          className={sync.cls?.name}
          book={{ got: cardsGot.size, total: content.cards.cards.length, fresh: cardsNew, onOpen: () => openBook() }}
          onFree={classFinished(classProgress) ? enterFree : undefined}
        />
      ) : view === 'test' ? (
        <QuizScreen
          key={test}
          items={test === 'post' ? content.test.postItems : content.test.items}
          preItems={content.test.items}
          kind={test}
          draft={progress.testDraft}
          pre={progress.pre}
          seed={params.get('seed')}
          onDraft={(d) => update((p) => ({ ...p, testDraft: d }))}
          onFinish={(r) => update((p) => recordQuiz(p, test, r))}
          onBack={toMenu}
        />
      ) : view === 'lesson' ? (
        <LessonScreen
          key={route}
          lesson={content.lessons.lessons.find((l) => l.id === route)!}
          subtitles={content.lessons.subtitles}
          saved={progress.lessons[route]}
          onSave={(r) => update((p) => recordLesson(p, route as StepId, r))}
          onBack={toMenu}
        />
      ) : view === 'results' ? (
        <ResultsScreen
          progress={progress}
          content={{ test: content.test.items, postTest: content.test.postItems, lessons: content.lessons.lessons, reflect: content.reflect, caseIds: PLAYABLE }}
          canEnter={(id) => !!pathView(progress, pathOptions).steps.find((s) => s.id === id)?.canEnter}
          onEnter={(id) => enter(id)}
          onBack={toMenu}
          sync={sync}
        />
      ) : view === 'reflect' ? (
        <ReflectScreen
          form={content.reflect}
          draft={progress.reflectDraft}
          onDraft={(a) => update((p) => ({ ...p, reflectDraft: p.reflect ? p.reflectDraft : a }))}
          onSend={(r) => update((p) => recordReflect(p, r))}
          onBack={toMenu}
        />
      ) : view === 'order' ? (
        <OrderScreen order={content.order} seed={params.get('seed')} onFinish={(r) => update((p) => recordOrder(p, r))} onBack={toMenu} />
      ) : !ready ? (
        <div class="shop-loading" role="status">
          กำลังไปที่ร้าน…
        </div>
      ) : (
        <CaseFlow
          key={visit}
          content={content}
          ready={ready}
          first={first}
          inPath={!caseLink && !free}
          onFinish={finish}
          onMenu={toMenu}
          onStage={(st) => {
            stage.current = st;
            if (st !== 'summary') setPromoted(null);
          }}
          seen={caseLink ? null : progress.seen}
          onSeen={(id) => update((p) => markSeen(p, id))}
          replayIntro={replayIntro}
          cardsGot={cardsGot}
          onBook={openBook}
          visit={free && !caseLink ? nextVisit : undefined}
          served={free ? progress.cases : undefined}
          promoted={promoted}
        />
      )}

      {book && (
        <BookScreen
          book={content.cards}
          got={cardsGot}
          read={progress.cardsRead}
          card={book.card}
          onRead={(id) => update((p) => markCardRead(p, id))}
          onClose={() => setBook(null)}
        />
      )}

      {decorOpen && free && (
        <DecorScreen
          decor={content.decor}
          progress={progress}
          ranks={RANKS}
          rank={rank}
          onBuy={(item) => {
            play('coin');
            update((p) => buy(p, item, RANKS, rank));
          }}
          onPlace={(item) => update((p) => place(p, item))}
          onTakeOff={(slot) => update((p) => takeOff(p, slot))}
          onClose={() => setDecorOpen(false)}
        />
      )}

      <Shutter phase={shutter.phase} to={shutter.to} fade={fade} label={free && shutter.to === 'learn' ? 'เมนูเล่นอิสระ' : undefined} />

      {askLeave && (
        <div class="menu-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="leave-q">
          <div class="menu pixel-box leave-ask">
            <p id="leave-q">กลับไปที่เมนูตอนนี้ เคสนี้จะเริ่มใหม่ตั้งแต่ต้นเมื่อกลับมาเล่น</p>
            <div class="actions">
              <button class="btn ghost" type="button" onClick={() => setAskLeave(false)}>
                ทำเคสต่อ
              </button>
              <button class="btn" type="button" onClick={toMenu}>
                กลับเมนู
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The coin purse. New coins arrive after the summary has shown its stars and counted them, then tick up
 * here with a "+N" floating off the chip. The label always says the real total.
 */
function CoinChip({ coins }: { coins: number }) {
  const [shown, setShown] = useState(coins);
  const [gain, setGain] = useState<number | null>(null);
  const shownRef = useRef(coins);

  useEffect(() => {
    const from = shownRef.current;
    if (coins === from) return;
    const set = (v: number) => {
      shownRef.current = v;
      setShown(v);
    };
    if (coins < from) {
      set(coins);
      return;
    }
    let raf = 0;
    const start = setTimeout(() => {
      setGain(coins - from);
      play('coin');
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / 500);
        set(Math.round(from + (coins - from) * k));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, SUMMARY_REVEAL_MS);
    const clear = setTimeout(() => setGain(null), SUMMARY_REVEAL_MS + 1200);
    return () => {
      clearTimeout(start);
      clearTimeout(clear);
      cancelAnimationFrame(raf);
      set(coins);
    };
  }, [coins]);

  return (
    <div class={`chip coins-chip${gain ? ' bump' : ''}`} aria-label={`เหรียญ ${coins}`} data-testid="coins">
      🪙 {shown}
      {gain && (
        <span class="coin-gain" aria-hidden="true">
          +{gain}
        </span>
      )}
    </div>
  );
}
