// The simulated monitor showing the customer's PC (src/core/pc.ts). Keys come from the real keyboard
// or the on-screen key bar (phones have no F keys); both send the same names. The bar always shows
// every key, so it never gives away which one is needed, except in a practice case (coach).
// Windows Setup is tapped instead (SetupScreen): while it is up the key bar is hidden. So is the new
// Windows' first-time setup (OobeScreen), whose game buttons (plug the cable, hand the PC to the customer,
// ask them) sit under the screen, and the desktop it ends on (case 5).

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { confirmBackup, oobeAction, powerOn, press, restart, setupAction, timeout, type Effect, type Key, type Pc } from '../../core/pc';
import type { SetupAction } from '../../core/setup';
import type { OobeAction } from '../../core/oobe';
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
import { OobeScreen } from './OobeScreen';
import { Desktop } from './Desktop';
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
  /** Where the repair is done (the case's goal): reaching Setup (cases 1–2), Windows installed (cases 3–4),
   *  or the desktop after first-time setup (case 5). */
  goal?: 'setup' | 'install' | 'desktop';
  /** Who the customer is, for the first-time setup buttons ("hand the PC to …"). */
  customerName?: string;
  /** The customer has said the files are backed up (the case flow's button, which can be tapped while Setup is open). */
  backupAsked?: boolean;
}

/** How often the "Installing Windows 11" bar and the first-time setup clock move. */
const INSTALL_TICK_MS = 100;
/** After "Installing Windows 11" reaches 100% the PC restarts by itself (case 5 goes on to first-time setup). */
export const RESTART_AFTER_INSTALL_MS = 2500;

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
  'cant-run': 'ตัวติดตั้งตรวจแล้วว่าเครื่องยังไม่ผ่านข้อกำหนด อ่านเหตุผลบนจอ แล้วรีสตาร์ตเครื่องเข้า BIOS',
  'still-cant-run': 'ขึ้นหน้าเดิมด้วยเหตุผลเดิม ยังไม่ได้แก้ค่าที่ถูกต้อง หรือยังไม่ได้บันทึก (นับว่าพลาด)',
  'reached-setup': 'บูตจาก USB สำเร็จ เข้าหน้าติดตั้ง Windows แล้ว',
  'no-backup-check': 'ลบข้อมูลในดิสก์ก่อนถามลูกค้าเรื่องสำรองข้อมูล (นับว่าพลาด)',
  'deleted-installer': 'ลบพาร์ทิชันของแฟลชไดรฟ์ติดตั้งทิ้ง ต้องไปทำ USB ใหม่ (นับว่าพลาด)',
  installed: 'ติดตั้ง Windows 11 เสร็จแล้ว',
  'legacy-no-boot': 'ปิด CSM แล้ว Windows เดิมที่ลงแบบ Legacy และ USB แบบ MBR บูตแบบ UEFI ไม่ได้ ต้องทำ USB ใหม่เป็น GPT',
  'typed-for-customer': 'ช่างพิมพ์บัญชีแทนลูกค้า บัญชีและรหัสผ่านเป็นของลูกค้า ต้องให้ลูกค้าพิมพ์เอง (นับว่าพลาด)',
  'asked-password': 'ช่างขอรหัสผ่านลูกค้า ช่างไม่ควรรู้รหัสผ่านของลูกค้า (นับว่าพลาด)',
  'handed-over': 'ยื่นเครื่องให้ลูกค้าแล้ว ลูกค้ากำลังลงชื่อบัญชีและตั้ง PIN เอง',
  'handed-back': 'ลูกค้าตั้ง PIN เสร็จ ยื่นเครื่องคืนช่างแล้ว',
  'privacy-asked': 'ถามลูกค้าแล้วว่าอยากเปิดหรือปิดการตั้งค่าไหน',
  desktop: 'ตั้งค่าเสร็จ เข้าเดสก์ท็อป Windows 11 แล้ว',
};
/** The install finished when the job goes on to the desktop: not the end yet. */
const INSTALLED_GO_ON_TH = 'ติดตั้งเสร็จแล้ว เครื่องจะรีสตาร์ตเอง แล้วเข้าหน้าตั้งค่าเริ่มต้นของ Windows';
/** What the win effect is for each goal. */
const WIN_EFFECT = { setup: 'reached-setup', install: 'installed', desktop: 'desktop' } as const;
/** Reaching Setup when the job is to install: only the start. */
const SETUP_STARTED_TH = 'บูตจาก USB สำเร็จ ทำ Setup ต่อจนติดตั้งเสร็จ';

export function PcScreen({ brand, machine, onClose, onEffect, initial, onPc, footer, coach, goal = 'setup', backupAsked, customerName = 'ลูกค้า' }: Props) {
  const [pc, setPc] = useState<Pc>(() => initial ?? powerOn(machine));
  const [status, setStatus] = useState('');
  const [win, setWin] = useState(false);
  const [shaking, setShaking] = useState(false);
  /** The technician tapped the customer's account field: what now? */
  const [accountAsk, setAccountAsk] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  // Latest values for the window key listener and timers, without re-subscribing on every render.
  const latest = useRef({ pc, brand, onEffect, onPc, goal, customerName });
  latest.current = { pc, brand, onEffect, onPc, goal, customerName };

  const apply = (r: { pc: Pc; effects: Effect[] }) => {
    latest.current.pc = r.pc;
    setPc(r.pc);
    latest.current.onPc?.(r.pc);
    for (const e of r.effects) {
      // The goal decides which effect is the win: reaching Setup, or the finished install.
      const win = e.type === WIN_EFFECT[latest.current.goal];
      const th =
        e.type === 'reached-setup' && !win
          ? SETUP_STARTED_TH
          : e.type === 'installed' && !win
            ? INSTALLED_GO_ON_TH
            : EFFECT_TH[e.type === 'mistake' ? e.reason : e.type === 'oobe-note' ? e.note : e.type];
      // First-time setup notes name the customer ("hand the PC to Teacher Wilai").
      setStatus(e.type === 'oobe-note' && th ? th.replaceAll('ลูกค้า', latest.current.customerName) : (th ?? ''));
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
      } else if (e.type === 'reached-setup') play('right');
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
  const tapOobe = (a: OobeAction) => {
    if (a.type !== 'tick') play('key');
    apply(oobeAction(latest.current.pc, a));
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
      // Setup and first-time setup are mouse programs: Enter and Tab work their buttons the browser's own way.
      const kind = latest.current.pc.screen.kind;
      if ((latest.current.goal !== 'setup' && kind === 'setup') || kind === 'oobe') return;
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
  const setupPage = goal !== 'setup' && pc.screen.kind === 'setup' ? pc.screen.setup.page : null;
  useEffect(() => {
    if (setupPage) document.body.dataset.setupPage = setupPage;
    else delete document.body.dataset.setupPage;
    if (setupPage !== 'installing') return;
    const t = setInterval(() => apply(setupAction(latest.current.pc, { type: 'tick', ms: INSTALL_TICK_MS })), INSTALL_TICK_MS);
    return () => clearInterval(t);
  }, [setupPage]);
  useEffect(() => () => delete document.body.dataset.setupPage, []);
  // Case 5: the finished install restarts the PC by itself, on to the new Windows.
  useEffect(() => {
    if (setupPage !== 'done' || goal !== 'desktop') return;
    const t = setTimeout(() => apply(timeout(latest.current.pc)), RESTART_AFTER_INSTALL_MS);
    return () => clearTimeout(t);
  }, [setupPage, goal]);

  // First-time setup's clock: "Checking for updates", the last wait, and the customer typing.
  const oobe = pc.screen.kind === 'oobe' ? pc.screen.oobe : null;
  const oobePage = oobe?.page ?? null;
  const oobeClock = !!oobe && (oobe.holder === 'customer' || oobe.page === 'updates' || oobe.page === 'finishing');
  useEffect(() => {
    if (oobePage) document.body.dataset.oobePage = oobePage;
    else delete document.body.dataset.oobePage;
    if (oobePage !== 'account') setAccountAsk(false);
  }, [oobePage]);
  useEffect(() => () => delete document.body.dataset.oobePage, []);
  useEffect(() => {
    if (!oobeClock) return;
    const t = setInterval(() => tapOobe({ type: 'tick', ms: INSTALL_TICK_MS }), INSTALL_TICK_MS);
    return () => clearInterval(t);
  }, [oobeClock]);
  // Any Setup window (tapped pages, its first page in cases 1–2, "can't run") is a mouse program: no key bar,
  // and the screen grows taller so the real-size window fits.
  const setupWindow = pc.screen.kind === 'setup' || pc.screen.kind === 'cant-run' || pc.screen.kind === 'oobe';

  useEffect(() => {
    if (backupAsked) apply({ pc: confirmBackup(latest.current.pc), effects: [] });
  }, [backupAsked]);

  const s = pc.screen;
  const cue = coach && s.kind === 'post';
  const cueKeys: readonly string[] = cue ? [brand.keys.setup[0]!, brand.keys.bootMenu[0]!] : [];
  return (
    <div class="sim-backdrop" role="dialog" aria-modal="true" aria-label="หน้าจอจำลอง">
      <div class={`monitor pc-monitor${setupWindow ? ' setup-mode' : ''}`}>
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
          {s.kind === 'setup' && (goal !== 'setup' ? <SetupScreen setup={s.setup} onAction={tapSetup} onRestart={restartPc} /> : <SetupLanguageScreen />)}
          {s.kind === 'oobe' &&
            (s.oobe.page === 'desktop' ? <Desktop /> : <OobeScreen oobe={s.oobe} onAction={tapOobe} onAccountField={() => setAccountAsk(true)} />)}
          {accountAsk && (
            <div class="oobe-pop" role="dialog" aria-label="ช่องลงชื่อบัญชีของลูกค้า">
              <div class="oobe-pop-card">
                <p>ช่องนี้ต้องใส่บัญชี Microsoft ของ{customerName} จะทำอย่างไร</p>
                <button type="button" class="btn ghost small" onClick={() => (setAccountAsk(false), tapOobe({ type: 'hand-over' }))}>
                  ยื่นเครื่องให้{customerName}พิมพ์เอง
                </button>
                <button type="button" class="btn ghost small" onClick={() => (setAccountAsk(false), tapOobe({ type: 'type-for-customer' }))}>
                  พิมพ์ให้เลย ถามอีเมลจาก{customerName}
                </button>
                <button type="button" class="btn ghost small" onClick={() => (setAccountAsk(false), tapOobe({ type: 'ask-password' }))}>
                  ขอรหัสผ่านจาก{customerName}
                </button>
                <button type="button" class="btn ghost small" onClick={() => setAccountAsk(false)}>
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
          {s.kind === 'setup-win10' && <SetupWin10Screen />}
          {s.kind === 'grub' && <GrubScreen />}
          {s.kind === 'cant-run' && <CantRunScreen reasons={s.reasons} />}
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
          {oobe && <OobeActions oobe={oobe} customerName={customerName} onAction={tapOobe} />}
          {footer}
        </div>
        <div class="keybar" role="toolbar" aria-label="ปุ่มคีย์บอร์ด" hidden={setupWindow}>
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

/** Things the technician does in the shop rather than on the screen: plug in the cable, hand the PC over, ask. */
function OobeActions({ oobe, customerName, onAction }: { oobe: NonNullable<Pc['fresh']>; customerName: string; onAction: (a: OobeAction) => void }) {
  if (oobe.holder === 'customer') return null;
  const b = (label: string, a: OobeAction) => (
    <button type="button" class="btn small" onClick={() => onAction(a)}>
      {label}
    </button>
  );
  return (
    <div class="oobe-actions" role="group" aria-label="สิ่งที่ช่างทำ">
      {oobe.page === 'network' && !oobe.cable && b('เสียบสายแลน', { type: 'plug-cable' })}
      {oobe.page === 'account' && b(`ยื่นเครื่องให้${customerName}ลงชื่อเอง`, { type: 'hand-over' })}
      {oobe.page === 'privacy' && !oobe.privacyAsked && b(`ถาม${customerName}เรื่องความเป็นส่วนตัว`, { type: 'ask-privacy' })}
    </div>
  );
}
