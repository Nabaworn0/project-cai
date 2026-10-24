// HTML overlay above the Phaser canvas: HUD, the case panels, and the simulated screen.
// Text that people read or type lives here (sharp at any DPI, Thai input works), not in the canvas.

import { useEffect, useRef, useState } from 'preact/hooks';
import { bus } from '../core/bus';
import { loadContent } from '../content';
import type { ShopLayout } from '../game/scenes/ShopScene';
import { CaseFlow } from './case/CaseFlow';
import { SUMMARY_REVEAL_MS } from './case/SummaryCard';
import { loadProgress, saveProgress } from './progress';
import { isMuted, onMuted, play, setMuted, unlockOnGesture } from './sound';
import './case/case.css';

const content = loadContent();

export function App() {
  const [ready, setReady] = useState(false);
  const [sign, setSign] = useState<ShopLayout['sign'] | null>(null);
  const [coins, setCoins] = useState(() => loadProgress().coins);
  const [muted, setMutedState] = useState(isMuted);

  useEffect(() => {
    unlockOnGesture();
    const offs = [bus.on('scene:ready', () => setReady(true)), bus.on('layout:shop', (l) => setSign(l.sign)), onMuted(setMutedState)];
    // Effects run after paint, so the scene may already have announced itself.
    if (bus.last('scene:ready')) setReady(true);
    const l = bus.last('layout:shop');
    if (l) setSign(l.sign);
    return () => offs.forEach((off) => off());
  }, []);

  const earn = (c: number) =>
    setCoins((n) => {
      saveProgress({ coins: n + c });
      return n + c;
    });

  return (
    <>
      {/* Thai text cannot be drawn legibly at art-pixel size, so the sign's name is HTML laid over the board. */}
      {sign && (
        <div class="sign-label" aria-hidden="true" style={{ left: `${sign.x}px`, top: `${sign.y}px`, width: `${sign.w}px`, height: `${sign.h}px`, fontSize: `${Math.round(sign.h * 0.6)}px` }}>
          ร้านซ่อมคอม
        </div>
      )}

      <header class="hud">
        <h1 class="chip brand">
          ร้านซ่อมคอม <small>รอบ 1</small>
        </h1>
        <div class="hud-right">
          <CoinChip coins={coins} />
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

      <CaseFlow content={content} ready={ready} onCoins={earn} />
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
