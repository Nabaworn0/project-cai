// Sends the learner's results to the teacher's sheet (the rules are src/core/sync.ts). The class comes from the
// class link (?class= and ?to=) and is kept on this device; without one nothing is sent anywhere. Results are sent a
// moment after they change; a failed send is tried again after a while, when the device is back online, and at the
// next visit. Storage can be refused (private windows): it then just sends again next time.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Progress } from '../core/path';
import { classFromQuery, due, endpoint, parseClass, parseSync, payload, received, signature, type ClassLink, type SyncState } from '../core/sync';

const CLASS_KEY = 'shop.class.v1';
const SYNC_KEY = 'shop.sync.v1';
/** After a change, wait this long for more before sending (finishing a step can save twice). */
export const SEND_AFTER_MS = 1500;
/** After a failed send, try again this much later. */
export const RETRY_MS = 30_000;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not kept: sent again next visit.
  }
};

/** The class for this visit: from the address if it names one (and kept), else the one kept before. */
function loadClass(): ClassLink | null {
  const fromLink = classFromQuery(location.search);
  if (fromLink) write(CLASS_KEY, JSON.stringify(fromLink));
  return fromLink ?? parseClass(read(CLASS_KEY));
}

/** Forgets the class: nothing is sent from now on, and the address no longer names it (a reload would keep it). */
function forgetClass(): void {
  try {
    localStorage.removeItem(CLASS_KEY);
  } catch {
    // Nothing kept to forget.
  }
  const u = new URL(location.href);
  u.searchParams.delete('class');
  u.searchParams.delete('to');
  history.replaceState(history.state, '', u);
}

export interface Sync {
  /** The class results go to, or null (nothing is sent). */
  cls: ClassLink | null;
  state: SyncState;
  sending: boolean;
  /** Something new is waiting to be sent. */
  pending: boolean;
  sendNow: () => void;
  /** "Not my class": a learner who opened another class's link stops sending to it. */
  leave: () => void;
}

export function useSync(progress: Progress): Sync {
  const [cls, setCls] = useState(loadClass);
  // The online listener and timers read the class now, not the one they were made with.
  const clsRef = useRef(cls);
  clsRef.current = cls;
  const [state, setState] = useState<SyncState>(() => parseSync(read(SYNC_KEY)));
  const [sending, setSending] = useState(false);
  // Counts sends, so a failure after a failure still schedules the next try.
  const [tries, setTries] = useState(0);
  const latest = useRef(progress);
  latest.current = progress;
  const busy = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const keep = (s: SyncState) => {
    setState(s);
    write(SYNC_KEY, JSON.stringify(s));
  };
  const send = async () => {
    const p = latest.current;
    const cls = clsRef.current;
    if (!cls || busy.current || !due(p, cls, stateRef.current)) return;
    busy.current = true;
    setSending(true);
    const sig = signature(p);
    let ok = false;
    try {
      const res = await fetch(endpoint(cls), {
        method: 'POST',
        // A "simple" request: no preflight, which Apps Script web apps do not answer.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload(p, cls, Date.now())),
      });
      ok = res.ok && received(await res.json());
    } catch {
      ok = false;
    }
    keep(ok ? { sent: sig, at: Date.now(), failed: false } : { ...stateRef.current, failed: true });
    busy.current = false;
    setSending(false);
    setTries((n) => n + 1);
  };

  const pending = due(progress, cls, state);
  // A moment after the results change; again a while after a failure.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => void send(), state.failed ? RETRY_MS : SEND_AFTER_MS);
    return () => clearTimeout(t);
  }, [pending, signature(progress), state.failed, tries]);
  // Back online: straight away.
  useEffect(() => {
    const online = () => void send();
    addEventListener('online', online);
    return () => removeEventListener('online', online);
  }, []);

  const leave = () => {
    forgetClass();
    clsRef.current = null;
    setCls(null);
  };
  return { cls, state, sending, pending, sendNow: () => void send(), leave };
}
