// 16-bit style sound effects, synthesized with Web Audio: no audio files (nothing to license, works
// offline, adds almost nothing to the download). Muting is remembered on this device.
// Browsers only allow sound after the player has tapped or pressed a key, so anything before that
// (the first customer walking in on page load) is silent.

export type Sfx = 'bell' | 'key' | 'mistake' | 'right' | 'fixed' | 'star' | 'coin';

/** One note: frequency (Hz, or [from, to] for a slide), start and length (s), and its waveform. */
interface Note {
  f: number | [number, number];
  at: number;
  len: number;
  wave?: OscillatorType;
  vol?: number;
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, B5 = 987.77;

const SOUNDS: Record<Sfx, Note[]> = {
  // Shop door bell: ding-dong.
  bell: [
    { f: E6, at: 0, len: 0.35, wave: 'triangle', vol: 0.5 },
    { f: C6, at: 0.18, len: 0.5, wave: 'triangle', vol: 0.5 },
  ],
  // A key on the customer's keyboard: a short tick.
  key: [{ f: 1800, at: 0, len: 0.03, wave: 'square', vol: 0.08 }],
  // Booted the old Windows / a wrong answer: a falling buzz.
  mistake: [
    { f: [220, 140], at: 0, len: 0.18, wave: 'square', vol: 0.18 },
    { f: [180, 110], at: 0.2, len: 0.25, wave: 'square', vol: 0.18 },
  ],
  // A right answer: two rising notes.
  right: [
    { f: E5, at: 0, len: 0.08, wave: 'square', vol: 0.15 },
    { f: C6, at: 0.08, len: 0.14, wave: 'square', vol: 0.15 },
  ],
  // The USB booted: a quick fanfare.
  fixed: [
    { f: C5, at: 0, len: 0.09, wave: 'square', vol: 0.18 },
    { f: E5, at: 0.09, len: 0.09, wave: 'square', vol: 0.18 },
    { f: G5, at: 0.18, len: 0.09, wave: 'square', vol: 0.18 },
    { f: C6, at: 0.27, len: 0.35, wave: 'square', vol: 0.18 },
  ],
  // One star on the summary (pitched up per star, see play()).
  star: [{ f: [G5, C6], at: 0, len: 0.12, wave: 'square', vol: 0.15 }],
  // Coins: the classic two-note pickup.
  coin: [
    { f: B5, at: 0, len: 0.07, wave: 'square', vol: 0.15 },
    { f: E6, at: 0.07, len: 0.3, wave: 'square', vol: 0.15 },
  ],
};

const MUTE_KEY = 'shop.muted';
let ctx: AudioContext | null = null;
let muted = readMuted();
const listeners = new Set<(muted: boolean) => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    // Private windows may refuse storage: the setting then lasts for this visit only.
  }
  listeners.forEach((fn) => fn(m));
}

export function onMuted(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Starts audio on the first tap or key press (browsers block it before that). */
export function unlockOnGesture(): void {
  const unlock = () => {
    if (!ctx && typeof AudioContext !== 'undefined') ctx = new AudioContext();
    void ctx?.resume();
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

/**
 * Plays a sound. `pitch` raises it by that many semitones (each summary star a step higher).
 * Every request is also listed in body[data-sfx] (last 20), so tests can check when sounds play.
 */
export function play(name: Sfx, pitch = 0): void {
  const log = (document.body.dataset.sfx ?? '').split(' ').filter(Boolean);
  document.body.dataset.sfx = [...log, name].slice(-20).join(' ');
  if (muted || !ctx || ctx.state !== 'running') return;
  const ratio = 2 ** (pitch / 12);
  const t0 = ctx.currentTime + 0.01;
  for (const n of SOUNDS[name]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = n.wave ?? 'square';
    const [from, to] = Array.isArray(n.f) ? n.f : [n.f, n.f];
    osc.frequency.setValueAtTime(from * ratio, t0 + n.at);
    if (to !== from) osc.frequency.linearRampToValueAtTime(to * ratio, t0 + n.at + n.len);
    // Short attack and decay so notes do not click.
    const vol = (n.vol ?? 0.15) * 0.6;
    gain.gain.setValueAtTime(0, t0 + n.at);
    gain.gain.linearRampToValueAtTime(vol, t0 + n.at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.len + 0.02);
  }
}

/** Animations are skipped for players who asked their device for less motion. */
export const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
