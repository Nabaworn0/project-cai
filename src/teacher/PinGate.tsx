// Asks for the teacher's PIN before the teacher's page opens (docs/guide-pin-plan.md task G); the page's own code is
// loaded only then. Open until this tab closes or the teacher locks it again. No PIN set yet: the page opens with a
// note to set one.

import type { ComponentType } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { failed, pinIsSet, pinMatches, waitLeft, type PinRecord, type Tries } from './pin';
import savedPin from './pin.json';
import './teacher.css';

const OPEN_KEY = 'shop.teacher.open';
const TRIES_KEY = 'shop.teacher.tries';

/** Playwright's build has a PIN of its own (playwright.config.ts); the real build reads pin.json. */
async function theRecord(): Promise<PinRecord> {
  const test = import.meta.env.VITE_TEACHER_PIN_TEST as string | undefined;
  if (!test) return savedPin as PinRecord;
  // A fixed salt, so the tab stays open across reloads as with pin.json.
  const { hashPin } = await import('./pin');
  return { salt: 'playwright', iterations: 1000, hash: await hashPin(test, 'playwright', 1000) };
}

const session = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) sessionStorage.removeItem(k);
      else sessionStorage.setItem(k, v);
    } catch {
      // Not kept: asked again on reload.
    }
  },
};
const readTries = (): Tries => {
  try {
    const t = JSON.parse(session.get(TRIES_KEY) ?? 'null') as Tries | null;
    return { fails: Number(t?.fails) || 0, until: Number(t?.until) || 0 };
  } catch {
    return { fails: 0, until: 0 };
  }
};

export interface TeacherPageProps {
  /** Locks the page again at once. */
  onLock?: () => void;
  /** No PIN has been set for this site yet. */
  noPin?: boolean;
}

export function PinGate({ load }: { load: () => Promise<ComponentType<TeacherPageProps>> }) {
  const [record, setRecord] = useState<PinRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [Page, setPage] = useState<ComponentType<TeacherPageProps> | null>(null);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [tries, setTries] = useState(readTries);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void theRecord().then((r) => {
      setRecord(r);
      // Opened in this tab already with this PIN (a new PIN asks again).
      if (!pinIsSet(r) || session.get(OPEN_KEY) === r.hash) setOpen(true);
    });
  }, []);
  useEffect(() => {
    if (open && !Page) void load().then((P) => setPage(() => P));
  }, [open]);
  const wait = waitLeft(tries, now);
  useEffect(() => {
    if (!wait) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [wait > 0]);
  useEffect(() => {
    if (record && !open && !wait) inputRef.current?.focus();
  }, [record, open, wait]);

  if (!record) return null;
  if (open) {
    if (!Page) return <p class="teacher-gate-wait">กำลังเปิดหน้าครู…</p>;
    const set = pinIsSet(record);
    return (
      <Page
        noPin={!set}
        onLock={
          set
            ? () => {
                session.set(OPEN_KEY, null);
                setPin('');
                setMsg('');
                setOpen(false);
              }
            : undefined
        }
      />
    );
  }

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy || wait || !pin) return;
    setBusy(true);
    const ok = await pinMatches(pin, record);
    setBusy(false);
    if (ok) {
      session.set(OPEN_KEY, record.hash ?? '');
      session.set(TRIES_KEY, null);
      setTries({ fails: 0, until: 0 });
      setOpen(true);
      return;
    }
    const t = failed(tries, Date.now());
    session.set(TRIES_KEY, JSON.stringify(t));
    setTries(t);
    setNow(Date.now());
    setPin('');
    setMsg(t.fails ? `รหัสไม่ถูกต้อง (ผิด ${t.fails} ครั้ง)` : 'รหัสไม่ถูกต้องหลายครั้ง');
  };

  return (
    <main class="teacher teacher-gate" data-testid="teacher-gate">
      <header class="teacher-head">
        <p>เกม WINSTALL · รายวิชา 21910-2001</p>
        <h1>🔒 หน้าครู</h1>
      </header>
      <form class="teacher-box" onSubmit={(e) => void submit(e)}>
        <label>
          รหัสเข้าหน้าครู
          <input
            ref={inputRef}
            type="password"
            autocomplete="current-password"
            value={pin}
            disabled={wait > 0}
            onInput={(e) => {
              setPin(e.currentTarget.value);
              setMsg('');
            }}
          />
        </label>
        <div class="teacher-row">
          <button class="btn" type="submit" disabled={busy || wait > 0 || !pin}>
            {busy ? 'กำลังตรวจ…' : 'เข้าหน้าครู'}
          </button>
          <a class="btn ghost" href={import.meta.env.BASE_URL}>
            กลับไปหน้าเกม
          </a>
        </div>
        {(msg || wait > 0) && (
          <p class="teacher-msg" role="alert" data-testid="gate-msg">
            {msg}
            {wait > 0 && ` · ลองใหม่ได้ในอีก ${wait} วินาที`}
          </p>
        )}
        <p class="teacher-note">หน้านี้สำหรับครูผู้สอน นักเรียนกลับไปเล่นเกมได้ที่ปุ่ม "กลับไปหน้าเกม" · ครูที่ยังไม่มีรหัส ติดต่อผู้ดูแลเกม</p>
      </form>
    </main>
  );
}
