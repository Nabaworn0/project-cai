// The simulated monitor showing the customer's PC (src/core/pc.ts). Keys come from the real keyboard
// or the on-screen key bar (phones have no F keys); both send the same names. The bar always shows
// every key, so it never gives away which one is needed, except in a practice case (coach).
// Windows Setup is tapped instead (SetupScreen): while it is up the key bar is hidden.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { confirmBackup, powerOn, press, restart, setupAction, timeout, type Effect, type Key, type Pc } from '../../core/pc';
import type { SetupAction } from '../../core/setup';
import type { Machine } from '../../core/machine';
import type { Brand } from '../../content/schema';
import { play, reducedMotion } from '../sound';
import {
  BiosScreen,
  BootMenuScreen,
  CantRunScreen,
  GrubScreen,
  NoBootScreen,
  OldWindowsScreen,
  PostScreen,
  PressAnyKeyScreen,
  SetupLanguageScreen,
  SetupWin10Screen,
} from './screens';
import { SetupScreen } from './SetupScreen';
import './sim.css';

/** How long the "fixed" banner stays over the Setup screen, and how long a mistake shakes the screen. */
const WIN_BANNER_MS = 2600;
const SHAKE_MS = 400;

/** How long a screen waits before moving on by itself. POST is longer than on a real PC so learners can read it. */
export const SCREEN_TIMEOUT_MS = { post: 8000, 'press-any-key': 5000 } as const;

interface Props {
  brand: Brand;
  machine: Machine;
  onClose: () => void;
  /** Mistakes and reaching Setup, for the case flow. */
  onEffect?: (e: Effect) => void;
  /** Resume a PC left earlier (closing the monitor does not reset the customer's machine). */
  initial?: Pc;
  /** Every change of the PC, so the owner can resume it later. */
  onPc?: (pc: Pc) => void;
  /** Extra controls in the status row (hints, "back to the customer"). */
  footer?: ComponentChildren;
  /** Practice case: the POST screen gets a Thai subtitle and its setup/boot-menu keys light up. */
  coach?: boolean;
  /** Where the repair is done (the case's goal): reaching Setup (cases 1–2), or Windows installed (case 3 on). */
  goal?: 'setup' | 'install';
  /** The customer has said the files are backed up (the case flow's button, which can be tapped while Setup is open). */
  backupAsked?: boolean;
}

/** How often the "Installing Windows 11" bar moves. */
const INSTALL_TICK_MS = 100;

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
  'wrong-image': 'บูตจาก USB ได้ แต่ในนั้นไม่ใช่ Windows 11 (นับว่าพลาด)',
  'legacy-boot': 'บูตแบบ Legacy (CSM) ซึ่ง Windows 11 ไม่รองรับ (นับว่าพลาด)',
  'reached-setup': 'บูตจาก USB สำเร็จ เข้าหน้าติดตั้ง Windows แล้ว',
  'no-backup-check': 'ลบข้อมูลในดิสก์ก่อนถามลูกค้าเรื่องสำรองข้อมูล (นับว่าพลาด)',
  'deleted-installer': 'ลบพาร์ทิชันของแฟลชไดรฟ์ติดตั้งทิ้ง ต้องไปทำ USB ใหม่ (นับว่าพลาด)',
  installed: 'ติดตั้ง Windows 11 เสร็จแล้ว',
};
/** Reaching Setup when the job is to install: only the start. */
const SETUP_STARTED_TH = 'บูตจาก USB สำเร็จ ทำ Setup ต่อจนติดตั้งเสร็จ';

export function PcScreen({ brand, machine, onClose, onEffect, initial, onPc, footer, coach, goal = 'setup', backupAsked }: Props) {
  const [pc, setPc] = useState<Pc>(() => initial ?? powerOn(machine));
  const [status, setStatus] = useState('');
  const [win, setWin] = useState(false);
  const [shaking, setShaking] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  // Latest values for the window key listener and timers, without re-subscribing on every render.
  const latest = useRef({ pc, brand, onEffect, onPc, goal });
  latest.current = { pc, brand, onEffect, onPc, goal };

  const apply = (r: { pc: Pc; effects: Effect[] }) => {
    latest.current.pc = r.pc;
    setPc(r.pc);
    latest.current.onPc?.(r.pc);
    for (const e of r.effects) {
      // The goal decides which effect is the win: reaching Setup, or the finished install.
      const win = e.type === (latest.current.goal === 'install' ? 'installed' : 'reached-setup');
      setStatus(e.type === 'reached-setup' && !win ? SETUP_STARTED_TH : (EFFECT_TH[e.type === 'mistake' ? e.reason : e.type] ?? ''));
      if (e.type === 'mistake') {
        play('mistake');
        if (!reducedMotion()) {
          // Off then on again, so a second mistake right after the first still shakes.
          setShaking(false);
          requestAnimationFrame(() => setShaking(true));
        }
      } else if (win) {
        play('fixed');
        setWin(true);
      } else play('right');
      latest.current.onEffect?.(e);
    }
  };
  const send = (key: Key) => {
    play('key');
    apply(press(latest.current.brand, latest.current.pc, key));
  };
  const tapSetup = (a: SetupAction) => {
    play('key');
    apply(setupAction(latest.current.pc, a));
  };
  const restartPc = () => {
    setStatus('');
    apply({ pc: restart(latest.current.pc), effects: [] });
  };

  useEffect(() => {
    if (!win) return;
    const t = setTimeout(() => setWin(false), WIN_BANNER_MS);
    return () => clearTimeout(t);
  }, [win]);
  useEffect(() => {
    if (!shaking) return;
    const t = setTimeout(() => setShaking(false), SHAKE_MS);
    return () => clearTimeout(t);
  }, [shaking]);

  useLayoutEffect(() => {
    // Focus the screen, not a button: Enter must reach the PC rather than click something.
    screenRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Setup is a mouse program: Enter and Tab work its buttons the browser's own way.
      if (latest.current.goal === 'install' && latest.current.pc.screen.kind === 'setup') return;
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

  // "Installing Windows 11" fills on a timer, like Rufus copying.
  const setupPage = goal === 'install' && pc.screen.kind === 'setup' ? pc.screen.setup.page : null;
  useEffect(() => {
    if (setupPage) document.body.dataset.setupPage = setupPage;
    else delete document.body.dataset.setupPage;
    if (setupPage !== 'installing') return;
    const t = setInterval(() => apply(setupAction(latest.current.pc, { type: 'tick', ms: INSTALL_TICK_MS })), INSTALL_TICK_MS);
    return () => clearInterval(t);
  }, [setupPage]);
  useEffect(() => () => delete document.body.dataset.setupPage, []);

  useEffect(() => {
    if (backupAsked) apply({ pc: confirmBackup(latest.current.pc), effects: [] });
  }, [backupAsked]);

  const s = pc.screen;
  const cue = coach && s.kind === 'post';
  const cueKeys: readonly string[] = cue ? [brand.keys.setup[0]!, brand.keys.bootMenu[0]!] : [];
  return (
    <div class="sim-backdrop" role="dialog" aria-modal="true" aria-label="หน้าจอจำลอง">
      <div class={`monitor pc-monitor${setupPage ? ' setup-mode' : ''}`}>
        <div class="monitor-bar">
          <span class="sim-tag">
            โหมดจำลอง<span class="sim-tag-more"> · ไม่ได้ติดตั้งจริง</span>
          </span>
          <span class="monitor-actions">
            <button
              class="btn ghost small"
              type="button"
              onClick={restartPc}
            >
              รีสตาร์ตเครื่อง
            </button>
            <button class="btn ghost small" type="button" onClick={onClose}>
              ปิด
            </button>
          </span>
        </div>
        <div class={`pc${shaking ? ' shake' : ''}`} ref={screenRef} tabIndex={-1} data-screen={s.kind} aria-label="จอคอมของลูกค้า">
          {s.kind === 'post' && <PostScreen brand={brand} pc={pc} />}
          {s.kind === 'bios' && <BiosScreen brand={brand} pc={pc} />}
          {s.kind === 'boot-menu' && <BootMenuScreen pc={pc} />}
          {s.kind === 'press-any-key' && <PressAnyKeyScreen />}
          {s.kind === 'no-boot' && <NoBootScreen />}
          {s.kind === 'old-windows' && <OldWindowsScreen />}
          {s.kind === 'setup' && (goal === 'install' ? <SetupScreen setup={s.setup} onAction={tapSetup} onRestart={restartPc} /> : <SetupLanguageScreen />)}
          {s.kind === 'setup-win10' && <SetupWin10Screen />}
          {s.kind === 'grub' && <GrubScreen />}
          {s.kind === 'cant-run' && <CantRunScreen />}
          {win && (
            <p class="pc-win" data-testid="pc-win">
              ซ่อมสำเร็จ!
            </p>
          )}
          {cue && (
            <p class="pc-subtitle" data-testid="pc-subtitle">
              คำแปล: กด {brand.keys.setup[0]} เพื่อเข้า BIOS (หน้าตั้งค่า) · <span class="nowrap">กด {brand.keys.bootMenu[0]} เพื่อเปิด Boot Menu</span>
            </p>
          )}
        </div>
        <div class="pc-status-row">
          <p class="pc-status" role="status" aria-live="polite">
            {status}
          </p>
          {footer}
        </div>
        <div class="keybar" role="toolbar" aria-label="ปุ่มคีย์บอร์ด" hidden={!!setupPage}>
          {KEY_BAR.map((k) => (
            <button
              key={k.key}
              type="button"
              class={`key${k.label.length > 2 ? ' wide' : ''}${k.label.length === 1 ? ' glyph' : ''}${cueKeys.includes(k.key) ? ' cue' : ''}`}
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
