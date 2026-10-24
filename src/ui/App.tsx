// HTML overlay above the Phaser canvas: HUD, narration box, and the simulated screen.
// Text that people read or type lives here (sharp at any DPI, Thai input works), not in the canvas.

import { useEffect, useState } from 'preact/hooks';
import { bus } from '../core/bus';
import type { Expression } from '../game/art/technician';
import type { ShopLayout } from '../game/scenes/ShopScene';
import { generateCase } from '../core/cases';
import { loadContent } from '../content';
import { PcScreen } from './sim/PcScreen';

const EXPRESSION_TH: Record<Expression, string> = {
  neutral: 'ปกติ',
  happy: 'ดีใจ',
  thinking: 'กำลังคิด',
  surprised: 'ตกใจ',
};

const WELCOME = 'ยินดีต้อนรับสู่ร้านซ่อมคอม คุณคือช่างประจำร้าน แตะคอมบนเคาน์เตอร์เพื่อเปิดเครื่องของลูกค้า (ทดลองหน้าจอ BIOS ของเคส 1)';

// Until the case flow exists (case1-plan task E), the PC on the counter is case 1's machine.
const content = loadContent();
const case1 = generateCase(content.cases[0]!, content, String(Date.now()));

export function App() {
  const [ready, setReady] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [line, setLine] = useState(WELCOME);
  const [sign, setSign] = useState<ShopLayout['sign'] | null>(null);

  useEffect(() => {
    const offs = [
      bus.on('scene:ready', () => setReady(true)),
      bus.on('ui:open-sim', () => setSimOpen(true)),
      bus.on('character:tap', ({ expression }) => setLine(`สีหน้า: ${EXPRESSION_TH[expression]} (ภาพจริงจะมาจากชีตตัวละคร)`)),
      bus.on('layout:shop', (l) => setSign(l.sign)),
    ];
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
        <div class="chip sim-badge" role="status" title="ทุกหน้าจอในเกมเป็นการจำลอง ไม่ได้ติดตั้งระบบจริง">
          โหมดจำลอง
        </div>
      </header>

      {ready && !simOpen && (
        <section class="narration" aria-live="polite">
          <p>{line}</p>
          <button class="btn" type="button" onClick={() => setSimOpen(true)}>
            เปิดหน้าจอจำลอง
          </button>
        </section>
      )}

      {simOpen && (
        <PcScreen
          brand={case1.brand}
          machine={case1.machine}
          onClose={() => {
            setSimOpen(false);
            bus.emit('ui:close-sim', {});
          }}
        />
      )}
    </>
  );
}
