// HTML overlay above the Phaser canvas: HUD, the case panels, and the simulated screen.
// Text that people read or type lives here (sharp at any DPI, Thai input works), not in the canvas.
// Two places (docs/learning-page-plan.md): the learning page, a page of its own, and the shop, whose scene
// (Phaser) is only loaded the first time the learner goes there and is paused while they are away.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Game } from 'phaser';
import { bus } from '../core/bus';
import { loadContent } from '../content';
import type { ShopLayout } from '../game/scenes/ShopScene';
import { CaseFlow, PLAYABLE } from './case/CaseFlow';
import { SUMMARY_REVEAL_MS } from './case/SummaryCard';
import { MenuScreen } from './menu/MenuScreen';
import { loadProgress, saveProgress, type Progress } from './progress';
import { EMPTY, markSeen, pathView, recordCase, type PathOptions, type StepId } from '../core/path';
import { isMuted, onMuted, play, setMuted, unlockOnGesture } from './sound';
import './case/case.css';

const content = loadContent();
const params = new URLSearchParams(location.search);

/** Steps whose screens exist (docs/learning-path-plan.md); the rest show as "เร็วๆ นี้". */
const BUILT: ReadonlySet<StepId> = new Set<StepId>(['cases']);
const pathOptions: PathOptions = { built: BUILT, caseIds: PLAYABLE, unlockAll: params.get('unlock') === 'all' };

/** The shop scene, started once on the first visit. */
let game: Promise<Game> | null = null;
const startShop = () => (game ??= import('../game').then(({ startGame }) => startGame(document.getElementById('game')!)));
/** Long enough for a customer to walk out before the scene is paused. */
const PAUSE_AFTER_MS = 3000;

export function App() {
  const [ready, setReady] = useState(false);
  const [sign, setSign] = useState<ShopLayout['sign'] | null>(null);
  const [progress, setProgress] = useState(loadProgress);
  // The game opens on the menu; ?case= (teachers, tests) goes straight to that customer.
  const [view, setView] = useState<'menu' | 'shop'>(() => (params.has('case') ? 'shop' : 'menu'));
  /** The case picked in the menu, and a count that gives each visit to the shop a fresh case flow. */
  const [first, setFirst] = useState<string | undefined>(undefined);
  const [visit, setVisit] = useState(0);
  const stage = useRef('');
  const [askLeave, setAskLeave] = useState(false);
  const [replayIntro, setReplayIntro] = useState(false);
  const [muted, setMutedState] = useState(isMuted);

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
    if (step !== 'cases') return;
    setReplayIntro(!!opts.replayIntro);
    setFirst(caseId ?? pathView(progress, pathOptions).cases.find((c) => c.status === 'open')?.id);
    setVisit((n) => n + 1);
    setView('shop');
  };
  const toMenu = () => {
    setAskLeave(false);
    setView('menu');
  };
  // Leaving before the job starts or after it ends loses nothing; in the middle, ask first.
  const menuTapped = () => (['', 'arriving', 'talk', 'intro', 'summary'].includes(stage.current) ? toMenu() : setAskLeave(true));

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

      {view === 'menu' ? (
        <MenuScreen
          content={content}
          progress={progress}
          options={pathOptions}
          onLearner={(learner) => update((p) => ({ ...p, learner }))}
          onReset={() => update(() => EMPTY)}
          onEnter={enter}
          coins={<CoinChip coins={progress.coins} />}
        />
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
          inPath={!params.has('case')}
          onFinish={finish}
          onMenu={toMenu}
          onStage={(st) => (stage.current = st)}
          seen={params.has('case') ? null : progress.seen}
          onSeen={(id) => update((p) => markSeen(p, id))}
          replayIntro={replayIntro}
        />
      )}

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
