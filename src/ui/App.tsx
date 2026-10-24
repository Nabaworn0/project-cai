// HTML overlay above the Phaser canvas: HUD, the case panels, and the simulated screen.
// Text that people read or type lives here (sharp at any DPI, Thai input works), not in the canvas.

import { useEffect, useState } from 'preact/hooks';
import { bus } from '../core/bus';
import { loadContent } from '../content';
import type { ShopLayout } from '../game/scenes/ShopScene';
import { CaseFlow } from './case/CaseFlow';
import './case/case.css';

const content = loadContent();

export function App() {
  const [ready, setReady] = useState(false);
  const [sign, setSign] = useState<ShopLayout['sign'] | null>(null);
  /** Coins earned this visit (not saved yet: progress saving comes later). */
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    const offs = [bus.on('scene:ready', () => setReady(true)), bus.on('layout:shop', (l) => setSign(l.sign))];
    // Effects run after paint, so the scene may already have announced itself.
    if (bus.last('scene:ready')) setReady(true);
    const l = bus.last('layout:shop');
    if (l) setSign(l.sign);
    return () => offs.forEach((off) => off());
  }, []);

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
          <div class="chip coins-chip" aria-label={`เหรียญ ${coins}`} data-testid="coins">
            🪙 {coins}
          </div>
          <div class="chip sim-badge" role="status" title="ทุกหน้าจอในเกมเป็นการจำลอง ไม่ได้ติดตั้งระบบจริง">
            โหมดจำลอง
          </div>
        </div>
      </header>

      <CaseFlow content={content} ready={ready} onCoins={(c) => setCoins((n) => n + c)} />
    </>
  );
}
