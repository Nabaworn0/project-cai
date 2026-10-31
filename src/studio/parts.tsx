// The pieces every lesson demo is made of (demos.tsx for clip 1, demos-types.tsx for clip 2): timing helpers, the
// program icons, a Windows 11 window, the pointer, notifications, the yellow tag, and ChatGPT's pictures of real
// things (art-prompts 6.2) with stand-ins for any not yet in src/assets/props.

import type { ComponentChildren, CSSProperties, JSX } from 'preact';

const sprites = import.meta.glob<string>('../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });
export const sprite = (name: string) => sprites[`../assets/sprites/${name}.png`]!;
const props = import.meta.glob<string>('../assets/props/*.png', { eager: true, query: '?url', import: 'default' });
/** ChatGPT's picture of a real thing once it is in, else undefined and the stand-in is drawn. */
export const prop = (name: string): string | undefined => props[`../assets/props/${name}.png`];


/** 0 before `a`, 1 after `b`, in between in a straight line. */
export const span = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
/** Shown from `a` on (a class that pops it in). */
export const on = (p: number, a: number) => (p >= a ? ' on' : '');
/** A point `k` of the way from `a` to `b`. */
export const glide = (k: number, a: [number, number], b: [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
/** A window opening: it grows in quickly from a bit smaller after `a`. */
export const opening = (p: number, a: number): CSSProperties => {
  const k = span(p, a, a + 0.04);
  return { opacity: k, transform: `scale(${0.92 + 0.08 * k})` };
};

export type Glyph = 'word' | 'web' | 'music' | 'folder' | 'taskmgr' | 'device' | 'printer' | 'doc' | 'lock' | 'cpu' | 'ram' | 'user';
const GLYPHS: Record<Glyph, JSX.Element> = {
  word: (
    <>
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#2b65c8" />
      <path d="M4 5h8M4 8h8M4 11h5" stroke="#fff" stroke-width="1.4" />
    </>
  ),
  web: (
    <>
      <circle cx="8" cy="8" r="6.6" fill="#2ec4b6" />
      <path d="M1.5 8h13M8 1.5c-3 3-3 10 0 13M8 1.5c3 3 3 10 0 13" stroke="#0f4a9e" fill="none" />
    </>
  ),
  music: (
    <>
      <rect x="1" y="1" width="14" height="14" rx="3" fill="#ff7a3d" />
      <path d="M6 11.5V4.5l5-1v7" stroke="#fff" stroke-width="1.4" fill="none" />
      <circle cx="5" cy="11.5" r="1.7" fill="#fff" />
      <circle cx="10" cy="10.5" r="1.7" fill="#fff" />
    </>
  ),
  folder: (
    <>
      <path d="M1 3h5l1.5 2H15v9H1z" fill="#e0a92e" />
      <path d="M1 6.5h14V14H1z" fill="#f7c948" />
    </>
  ),
  taskmgr: (
    <>
      <rect x="1" y="2" width="14" height="12" rx="1.5" fill="#1f8f86" />
      <path d="M2.5 10.5l3-3 2.5 2.5L13 4.5" stroke="#fff" stroke-width="1.4" fill="none" />
    </>
  ),
  device: (
    <>
      <rect x="1" y="2" width="14" height="9" rx="1" fill="#5f6b80" />
      <rect x="2.5" y="3.5" width="11" height="6" fill="#8fd3ff" />
      <path d="M5 14h6M8 11v3" stroke="#5f6b80" stroke-width="1.4" />
    </>
  ),
  printer: (
    <>
      <rect x="4" y="1.5" width="8" height="4.5" fill="#fff" stroke="#5f6b80" />
      <rect x="1.5" y="5.5" width="13" height="6" rx="1" fill="#9aa5b8" stroke="#5f6b80" />
      <rect x="4" y="9.5" width="8" height="5" fill="#fff" stroke="#5f6b80" />
    </>
  ),
  doc: (
    <>
      <path d="M4 1h7l3 3v11H4z" fill="#fff" stroke="#2b65c8" />
      <rect x="1" y="6.5" width="8" height="7" rx="1" fill="#2b65c8" />
      <path d="M2.6 8.8h4.8M2.6 11.2h4.8" stroke="#fff" />
    </>
  ),
  lock: (
    <>
      <path d="M5 7V5a3 3 0 016 0v2" stroke="#5f6b80" stroke-width="1.8" fill="none" />
      <rect x="3" y="7" width="10" height="8" rx="1" fill="#ffd23f" stroke="#8a5a33" />
    </>
  ),
  cpu: (
    <>
      <path d="M5 1v3M8 1v3M11 1v3M5 12v3M8 12v3M11 12v3M1 5h3M1 8h3M1 11h3M12 5h3M12 8h3M12 11h3" stroke="#9aa5b8" />
      <rect x="3.5" y="3.5" width="9" height="9" fill="#2c3e66" stroke="#9aa5b8" />
      <rect x="6" y="6" width="4" height="4" fill="#2ec4b6" />
    </>
  ),
  ram: (
    <>
      <rect x="1" y="4" width="14" height="7" fill="#1f8f86" />
      <path d="M3 6h2v3H3zM6 6h2v3H6zM9 6h2v3H9zM12 6h1.5v3H12z" fill="#1b2a4a" />
      <path d="M2 11v2M4 11v2M6 11v2M10 11v2M12 11v2M14 11v2" stroke="#ffd23f" />
    </>
  ),
  user: (
    <>
      <circle cx="8" cy="5" r="3.2" fill="#9aa5b8" />
      <path d="M2 15c0-4 3-6 6-6s6 2 6 6z" fill="#9aa5b8" />
    </>
  ),
};
/** ChatGPT's pixel icons (art-prompts 6.2) where there is one; the drawn glyph otherwise. */
const ART: Partial<Record<Glyph, string>> = { word: 'app-doc', doc: 'app-doc', web: 'app-web', music: 'app-music', folder: 'app-folder', lock: 'app-lock' };
export function Icon({ g, class: cls = '' }: { g: Glyph; class?: string }) {
  const art = ART[g] && prop(ART[g]);
  if (art) return <img src={art} alt="" class={`d-ico ${cls}`} />;
  return (
    <svg class={`d-ico ${cls}`} viewBox="0 0 16 16" aria-hidden="true">
      {GLYPHS[g]}
    </svg>
  );
}

/** A Windows 11 window: title bar with the program's icon, the minimise / maximise / close buttons. */
export function Win(props: { title: string; icon: Glyph; children: ComponentChildren; class?: string; style?: CSSProperties }) {
  return (
    <div class={`d-win ${props.class ?? ''}`} style={props.style}>
      <div class="d-win-bar">
        <Icon g={props.icon} />
        <span class="d-win-title">{props.title}</span>
        <span class="d-ctl">
          <i>─</i>
          <i>☐</i>
          <i>✕</i>
        </span>
      </div>
      <div class="d-win-body">{props.children}</div>
    </div>
  );
}

/** The mouse pointer, pressed down when `down`. */
export function Cursor({ at, down = false }: { at: [number, number]; down?: boolean }) {
  return (
    <span class={`d-cursor${down ? ' down' : ''}`} style={{ left: `${at[0]}px`, top: `${at[1]}px` }}>
      <svg viewBox="0 0 12 18" aria-hidden="true">
        <path d="M1 1v14l3.4-3.3 2.4 5.2 2.3-1-2.4-5.1H11z" fill="#fff" stroke="#000" stroke-width="1" />
      </svg>
    </span>
  );
}

/** A Windows notification in the corner above the clock. */
export function Toast({ icon, title, text }: { icon: Glyph; title: string; text: string }) {
  return (
    <div class="d-toast">
      <Icon g={icon} />
      <span>
        <b>{title}</b>
        {text}
      </span>
    </div>
  );
}

/** A yellow tag that says what we are looking at, the same in every demo. */
export function Tag({ children, style }: { children: ComponentChildren; style: CSSProperties }) {
  return (
    <span class="d-tag" style={style}>
      {children}
    </span>
  );
}

/** The PC tower: ChatGPT's picture (off and on) or a stand-in. */
export function Tower({ power }: { power: boolean }) {
  const art = prop(power ? 'tower-on' : 'tower-off');
  return art ? (
    <img src={art} alt="" class="d-tower-art" />
  ) : (
    <div class={`d-tower${power ? ' on' : ''}`}>
      <i class="d-tower-btn" />
      <i class="d-tower-led" />
      <span class="d-vents" />
    </div>
  );
}

/** A finger about to press (or pressing) something. */
export function Hand({ at, press }: { at: [number, number]; press: boolean }) {
  const art = prop('hand');
  const style = { left: `${at[0]}px`, top: `${at[1] + (press ? 6 : 0)}px` };
  return art ? (
    <img src={art} alt="" class="d-hand" style={style} />
  ) : (
    <svg class="d-hand" style={style} viewBox="0 0 24 32" aria-hidden="true">
      <path
        d="M8 3a2 2 0 014 0v11h1V10a2 2 0 014 0v5a2 2 0 014 0v7c0 5-3 8-8 8h-2c-4 0-6-2-8-5l-3-6a2 2 0 013-2l3 3z"
        fill="#f6c69c"
        stroke="#1b2a4a"
        stroke-width="1.5"
      />
    </svg>
  );
}
