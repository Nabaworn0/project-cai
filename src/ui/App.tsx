// HTML overlay above the Phaser canvas: HUD, the case panels, and the simulated screen.
// Text that people read or type lives here (sharp at any DPI, Thai input works), not in the canvas.
// Two places (docs/learning-page-plan.md): the learning page, a page of its own (with the pre/post test on its
// board, docs/quiz-plan.md), and the shop, whose scene (Phaser) is only loaded the first time the learner goes
// there and is paused while they are away.
// Each page has its own address (#/learn, #/pre, #/post, #/order, #/shop: docs/pages-plan.md), so Back, reloading
// and links work as on any website; which page an address may open is src/core/routes.ts. Between pages the shop's
// shutter rolls down and up (Shutter.tsx), held down the first time the shop's scene loads.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Game } from 'phaser';
import { bus } from '../core/bus';
import { loadContent } from '../content';
import type { ShopLayout } from '../game/scenes/ShopScene';
import { CaseFlow, PLAYABLE } from './case/CaseFlow';
import { SUMMARY_REVEAL_MS } from './case/SummaryCard';
import { MenuScreen } from './menu/MenuScreen';
import { StartScreen } from './start/StartScreen';
import { LessonScreen } from './lesson/LessonScreen';
import { ReflectScreen } from './reflect/ReflectScreen';
import { useSync } from './sync';
import { ResultsScreen } from './results/ResultsScreen';
import { OrderScreen } from './order/OrderScreen';
import { QuizScreen } from './quiz/QuizScreen';
import { loadProgress, saveProgress, type Progress } from './progress';
import { EMPTY, markSeen, pathView, recordCase, recordLesson, recordOrder, recordQuiz, recordReflect, type PathOptions, type StepId } from '../core/path';
import { allowedRoute, parseRoute, routeHash, type Route } from '../core/routes';
import { prefersLessMotion } from './motion';
import { Shutter, SHUTTER_MS, type ShutterPhase } from './Shutter';
import { isMuted, onMuted, play, setMuted, unlockOnGesture } from './sound';
import './case/case.css';

const content = loadContent();
const params = new URLSearchParams(location.search);

/** Steps whose screens exist (docs/learning-path-plan.md); the rest show as "เร็วๆ นี้". */
const BUILT: ReadonlySet<StepId> = new Set<StepId>(['pre', 'lesson-os', 'lesson-types', 'order', 'cases', 'post', 'reflect', 'results']);
const pathOptions: PathOptions = { built: BUILT, caseIds: PLAYABLE, unlockAll: params.get('unlock') === 'all' };

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
const nextCase = (p: Progress) => pathView(p, pathOptions).cases.find((c) => c.status === 'open')?.id;
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
  const [sign, setSign] = useState<ShopLayout['sign'] | null>(null);
  const [progress, setProgress] = useState(loadProgress);
  const sync = useSync(progress);
  // The page the address asks for, if it may open now; else the learning page.
  const [route, setRoute] = useState<Route>(() => allowedRoute(parseRoute(location.hash), !!progress.learner, pathView(progress, pathOptions)));
  const view: View = caseLink ? 'shop' : VIEW[route];
  const test = route === 'post' ? 'post' : 'pre';
  /** The case picked in the menu, and a count that gives each visit to the shop a fresh case flow. */
  const [first, setFirst] = useState<string | undefined>(() => (route === 'shop' ? nextCase(progress) : undefined));
  const [visit, setVisit] = useState(0);
  const stage = useRef('');
  // The address listener reads these, not the values of the render it was set up in.
  const progressRef = useRef(progress);
  progressRef.current = progress;
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
    const r = allowedRoute(wanted, !!p.learner, pathView(p, pathOptions));
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
      setFirst(asked.caseId ?? nextCase(p));
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
    const offs = [bus.on('scene:ready', () => setReady(true)), bus.on('layout:shop', (l) => setSign(l.sign)), onMuted(setMutedState)];
    // Effects run after paint, so the scene may already have announced itself.
    if (bus.last('scene:ready')) setReady(true);
    const l = bus.last('layout:shop');
    if (l) setSign(l.sign);
    return () => offs.forEach((off) => off());
  }, []);

  const update = (f: (p: Progress) => Progress) =>
    setProgress((p) => {
      const next = f(p);
      saveProgress(next);
      return next;
    });
  const finish = (caseId: string, stars: number, coins: number) => update((p) => recordCase({ ...p, coins: p.coins + coins }, caseId, stars));
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
  const menuTapped = () => (CALM_STAGES.includes(stage.current) ? toMenu() : setAskLeave(true));

  return (
    <>
      {/* Thai text cannot be drawn legibly at art-pixel size, so the sign's name is HTML laid over the board. */}
      {view === 'shop' && sign && (
        <div
          class="sign-label"
          aria-hidden="true"
          style={{ left: `${sign.x}px`, top: `${sign.y}px`, width: `${sign.w}px`, height: `${sign.h}px`, fontSize: `${Math.round(sign.h * 0.6)}px` }}
        >
          ร้านซ่อมคอม
        </div>
      )}

      {view === 'shop' && (
        <header class="hud">
          <button class="chip menu-chip" type="button" onClick={menuTapped}>
            ☰ เมนู
          </button>
          <h1 class="chip brand">
            ร้านซ่อมคอม <small>รอบ 1</small>
          </h1>
          <div class="hud-right">
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
              โหมดจำลอง
            </div>
          </div>
        </header>
      )}

      {view === 'menu' && (about || (!progress.learner && !started)) ? (
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
        />
      ) : view === 'test' ? (
        <QuizScreen
          key={test}
          items={content.test.items}
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
          content={{ test: content.test.items, lessons: content.lessons.lessons, reflect: content.reflect, caseIds: PLAYABLE }}
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
          inPath={!caseLink}
          onFinish={finish}
          onMenu={toMenu}
          onStage={(st) => (stage.current = st)}
          seen={caseLink ? null : progress.seen}
          onSeen={(id) => update((p) => markSeen(p, id))}
          replayIntro={replayIntro}
        />
      )}

      <Shutter phase={shutter.phase} to={shutter.to} fade={fade} />

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
