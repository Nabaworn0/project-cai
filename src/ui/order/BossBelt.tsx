// The boss of the ordering game (docs/order-plan.md task C): the conveyor belt in 2.5D. The belt in the belt room
// picture runs from the hatch in the back wall towards the learner (beltScene.ts); step cards ride it, small far
// away and growing as they come, upright so the Thai stays readable. Tap the step that comes next before it falls off the front; traps and steps that are not
// due yet cost a heart. The rules are src/core/order.ts; this runs the clock and draws.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Order } from '../../content/schema';
import { beltDone, beltOut, bossSequence, GAP, HEARTS, setSlow, startBelt, tap, tick, type Belt, type BeltEvent } from '../../core/order';
import { prefersLessMotion } from '../motion';
import { cardPlace, ROOM, roomView, stripes } from './beltScene';
import { Senior } from './Senior';

interface Props {
  order: Order;
  seed: string;
  onDone: (lost: number) => void;
}

type Phase = 'ready' | 'run' | 'out' | 'done';

export function BossBelt({ order, seed, onDone }: Props) {
  const seq = bossSequence(order.rounds, order.boss);
  const traps = order.traps.map((t) => t.id);
  const cards = [...order.rounds.flatMap((r) => r.steps), ...order.traps];
  const textOf = (id: string) => cards.find((c) => c.id === id)!.th;

  const [phase, setPhase] = useState<Phase>('ready');
  const [slow, setSlowMode] = useState(prefersLessMotion);
  const [runs, setRuns] = useState(0);
  const belt = useRef<Belt>(startBelt(seq, traps, seed, slow));
  const [, redraw] = useState(0);
  const [say, setSay] = useState<{ text: string; good: boolean } | null>(null);
  // The stage's size, for placing things on the picture (it changes with the screen).
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stage.current!;
    // It reports the size once on observing too.
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handle = (events: BeltEvent[]) => {
    for (const e of events) {
      if (e.kind === 'right') setSay(null);
      else if (e.kind === 'trap') setSay({ text: order.traps.find((t) => t.id === e.id)!.whyTh, good: false });
      else if (e.kind === 'early') setSay({ text: `"${textOf(e.id)}" ยังไม่ถึงคิว ตอนนี้ต้อง "${textOf(e.needed)}" ก่อน`, good: false });
      else if (e.kind === 'missed') setSay({ text: `"${textOf(e.id)}" หลุดไปแล้ว! ขั้นนี้ต้องทำตอนนี้ เดี๋ยวมันวนกลับมา`, good: false });
      else if (e.kind === 'out') setPhase('out');
      else if (e.kind === 'done') setPhase('done');
    }
  };

  // The clock runs only while playing; each frame moves the belt by the time since the last one.
  useEffect(() => {
    if (phase !== 'run') return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const before = belt.current;
      const r = tick(before, now - last);
      last = now;
      belt.current = r.belt;
      handle(r.events);
      redraw((n) => n + 1);
      if (!beltDone(r.belt) && !beltOut(r.belt)) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, runs]);

  const start = () => {
    belt.current = startBelt(seq, traps, `${seed}:${runs}`, slow);
    setSay(null);
    setRuns((n) => n + 1);
    setPhase('run');
  };
  const toggleSlow = () => {
    setSlowMode(!slow);
    belt.current = setSlow(belt.current, !slow);
    redraw((n) => n + 1);
  };
  const tapCard = (key: number) => {
    const r = tap(belt.current, key);
    belt.current = r.belt;
    handle(r.events);
    redraw((n) => n + 1);
  };

  const b = belt.current;
  const doneId = b.at > 0 ? b.seq[b.at - 1] : null;
  const view = roomView(size.w, size.h);
  return (
    <div class="boss" data-testid="boss" data-phase={phase} data-hearts={b.hearts} data-at={b.at}>
      <div class="boss-hud">
        <span class="boss-hearts" aria-label={`หัวใจ ${b.hearts} จาก ${HEARTS}`}>
          {'❤'.repeat(b.hearts)}
          <span class="lost">{'❤'.repeat(HEARTS - b.hearts)}</span>
        </span>
        <span class="boss-progress">
          ขั้น {Math.min(b.at + 1, seq.length)}/{seq.length}
        </span>
        {b.combo > 1 && <span class="boss-combo">คอมโบ ×{b.combo}</span>}
        <button class="chip boss-slow" type="button" aria-pressed={slow} onClick={toggleSlow}>
          🐢 โหมดช้า
        </button>
      </div>
      <p class="boss-last" data-testid="boss-last">
        {doneId ? `ล่าสุด: ${textOf(doneId)}` : 'เริ่มงาน: ขั้นแรกของการลง Windows 11 คืออะไร'}
      </p>

      <div class="boss-stage" aria-label="สายพานงานซ่อม" ref={stage}>
        <div class="boss-room" aria-hidden="true" style={{ left: `${view.x}px`, top: `${view.y}px`, width: `${view.w}px`, height: `${view.h}px` }} />
        <svg
          class="boss-stripes"
          aria-hidden="true"
          width={size.w}
          height={size.h}
          shape-rendering="crispEdges"
          stroke-width={Math.max(1, Math.round(view.w / ROOM.w))} // one art pixel
        >
          {/* The surface moves with the cards: the distance travelled, as cards came on GAP apart. */}
          {stripes(view, size.h, b.spawned * GAP + b.sinceSpawn).map((l, i) => (
            <line key={i} x1={l.l} x2={l.r} y1={l.y} y2={l.y} />
          ))}
        </svg>
        {phase === 'run' &&
          b.cards.map((c) => {
            const p = cardPlace(view, size.w, size.h, c.x, c.key);
            return (
              <button
                key={c.key}
                class="boss-card"
                type="button"
                data-step={c.id}
                data-along={c.x.toFixed(4)}
                style={{
                  top: `${p.top}px`,
                  left: `${p.left}px`,
                  transform: `translate(-50%, -50%) scale(${p.scale})`,
                  zIndex: Math.round(c.x * 100),
                }}
                onClick={() => tapCard(c.key)}
              >
                {textOf(c.id)}
              </button>
            );
          })}
        {phase === 'ready' && (
          <div class="boss-cover">
            <Senior face="happy">
              ด่านสุดท้าย! การ์ดขั้นตอนจะไหลมาบนสายพาน แตะขั้นที่ต้องทำต่อไปก่อนมันหลุดขอบ ระวังการ์ดกับดักที่ไม่ควรทำ มีหัวใจ {HEARTS} ดวง
            </Senior>
            <button class="btn" type="button" onClick={start}>
              เริ่มสายพาน
            </button>
          </div>
        )}
        {phase === 'out' && (
          <div class="boss-cover" role="alert">
            <Senior face="thinking">หัวใจหมดแล้ว ไม่เป็นไร ลองใหม่ได้เลย จะเปิดโหมดช้าก่อนก็ได้นะ</Senior>
            <button class="btn" type="button" onClick={start}>
              ลองสายพานอีกครั้ง
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div class="boss-cover" role="status">
            <Senior face="happy">ครบ {seq.length} ขั้น ลง Windows 11 เสร็จเรียบร้อย!</Senior>
            <button class="btn" type="button" onClick={() => onDone(b.lost)}>
              ดูผล
            </button>
          </div>
        )}
      </div>

      {phase === 'run' && say && (
        <p class={`boss-say${say.good ? ' good' : ''}`} role="status" data-testid="boss-say">
          <b>พี่ช่าง:</b> {say.text}
        </p>
      )}
    </div>
  );
}
