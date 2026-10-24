// The simulated monitor showing the customer's PC (src/core/pc.ts). Keys come from the real keyboard
// or the on-screen key bar (phones have no F keys); both send the same names. The bar always shows
// every key, so it never gives away which one is needed.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { powerOn, press, restart, timeout, type Effect, type Key, type Pc } from '../../core/pc';
import type { Machine } from '../../core/machine';
import type { Brand } from '../../content/schema';
import { BiosScreen, BootMenuScreen, NoBootScreen, OldWindowsScreen, PostScreen, PressAnyKeyScreen, SetupLanguageScreen } from './screens';
import './sim.css';

/** How long a screen waits before moving on by itself. POST is longer than on a real PC so learners can read it. */
export const SCREEN_TIMEOUT_MS = { post: 8000, 'press-any-key': 5000 } as const;

interface Props {
  brand: Brand;
  machine: Machine;
  onClose: () => void;
  /** Mistakes and reaching Setup, for the case flow. */
  onEffect?: (e: Effect) => void;
}

const KEY_BAR: { key: Key; label: string; name: string }[] = [
  { key: 'Esc', label: 'Esc', name: 'Esc' },
  { key: 'F2', label: 'F2', name: 'F2' },
  { key: 'F8', label: 'F8', name: 'F8' },
  { key: 'F10', label: 'F10', name: 'F10' },
  { key: 'Left', label: '←', name: 'ลูกศรซ้าย' },
  { key: 'Up', label: '↑', name: 'ลูกศรขึ้น' },
  { key: 'Down', label: '↓', name: 'ลูกศรลง' },
  { key: 'Right', label: '→', name: 'ลูกศรขวา' },
  { key: 'Minus', label: '−', name: 'ลบ' },
  { key: 'Plus', label: '+', name: 'บวก' },
  { key: 'Enter', label: 'Enter', name: 'Enter' },
];

/** KeyboardEvent.key -> our key names. */
const FROM_KEYBOARD: Record<string, Key> = {
  Escape: 'Esc',
  F2: 'F2',
  F8: 'F8',
  F10: 'F10',
  Delete: 'Delete',
  Enter: 'Enter',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  '+': 'Plus',
  '=': 'Plus',
  '-': 'Minus',
};

const EFFECT_TH: Record<string, string> = {
  'booted-old-windows': 'เครื่องบูตเข้า Windows ตัวเดิม (นับว่าพลาด)',
  'no-boot-device': 'เครื่องหาอุปกรณ์บูตไม่เจอ (นับว่าพลาด)',
  'reached-setup': 'บูตจาก USB สำเร็จ เข้าหน้าติดตั้ง Windows แล้ว',
};

export function PcScreen({ brand, machine, onClose, onEffect }: Props) {
  const [pc, setPc] = useState<Pc>(() => powerOn(machine));
  const [status, setStatus] = useState('');
  const screenRef = useRef<HTMLDivElement>(null);
  // Latest values for the window key listener and timers, without re-subscribing on every render.
  const latest = useRef({ pc, brand, onEffect });
  latest.current = { pc, brand, onEffect };

  const apply = (r: { pc: Pc; effects: Effect[] }) => {
    latest.current.pc = r.pc;
    setPc(r.pc);
    for (const e of r.effects) {
      setStatus(EFFECT_TH[e.type === 'mistake' ? e.reason : e.type] ?? '');
      latest.current.onEffect?.(e);
    }
  };
  const send = (key: Key) => apply(press(latest.current.brand, latest.current.pc, key));

  useLayoutEffect(() => {
    // Focus the screen, not a button: Enter must reach the PC rather than click something.
    screenRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const key = FROM_KEYBOARD[e.key];
      // "Press any key" really takes any key.
      const anyKey = latest.current.pc.screen.kind === 'press-any-key' && e.key.length > 0 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!key && !anyKey) return;
      e.preventDefault();
      send(key ?? 'Enter');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Screens that move on by themselves: POST boots, "Press any key" gives up.
  useEffect(() => {
    const kind = pc.screen.kind;
    if (kind !== 'post' && kind !== 'press-any-key') return;
    const t = setTimeout(() => apply(timeout(latest.current.pc)), SCREEN_TIMEOUT_MS[kind]);
    return () => clearTimeout(t);
  }, [pc.screen]);

  useEffect(() => {
    document.body.dataset.pcScreen = pc.screen.kind;
    return () => delete document.body.dataset.pcScreen;
  }, [pc.screen.kind]);

  const s = pc.screen;
  return (
    <div class="sim-backdrop" role="dialog" aria-modal="true" aria-label="หน้าจอจำลอง">
      <div class="monitor pc-monitor">
        <div class="monitor-bar">
          <span class="sim-tag">
            โหมดจำลอง<span class="sim-tag-more"> · ไม่ได้ติดตั้งจริง</span>
          </span>
          <span class="monitor-actions">
            <button
              class="btn ghost small"
              type="button"
              onClick={() => {
                setStatus('');
                apply({ pc: restart(latest.current.pc), effects: [] });
              }}
            >
              รีสตาร์ตเครื่อง
            </button>
            <button class="btn ghost small" type="button" onClick={onClose}>
              ปิด
            </button>
          </span>
        </div>
        <div class="pc" ref={screenRef} tabIndex={-1} data-screen={s.kind} aria-label="จอคอมของลูกค้า">
          {s.kind === 'post' && <PostScreen brand={brand} pc={pc} />}
          {s.kind === 'bios' && <BiosScreen brand={brand} pc={pc} />}
          {s.kind === 'boot-menu' && <BootMenuScreen pc={pc} />}
          {s.kind === 'press-any-key' && <PressAnyKeyScreen />}
          {s.kind === 'no-boot' && <NoBootScreen />}
          {s.kind === 'old-windows' && <OldWindowsScreen />}
          {s.kind === 'setup' && <SetupLanguageScreen />}
        </div>
        <p class="pc-status" role="status" aria-live="polite">
          {status}
        </p>
        <div class="keybar" role="toolbar" aria-label="ปุ่มคีย์บอร์ด">
          {KEY_BAR.map((k) => (
            <button
              key={k.key}
              type="button"
              class={`key${k.label.length > 2 ? ' wide' : ''}${k.label.length === 1 ? ' glyph' : ''}`}
              data-key={k.key}
              aria-label={k.name}
              // Keep focus on the screen so a real Enter after a tap still goes to the PC.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => send(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
