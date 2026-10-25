// The Windows 11 desktop the first-time setup ends on (case 5; case 6 starts here): the blue "bloom"
// wallpaper, the Recycle Bin, and the taskbar with its icons in the middle and the clock on the right.
// Drawn here in SVG and CSS, not taken from Microsoft's files. Nothing on it can be used yet (case 6).

import type { ComponentChildren } from 'preact';

interface Props {
  /** The clock in the corner, as the case sets it. */
  time?: string;
  date?: string;
}

export function Desktop({ time = '10:30 AM', date = '10/25/2026' }: Props) {
  return (
    <div class="w11-desktop" data-testid="desktop">
      <Bloom />
      <div class="desk-icons">
        <span class="desk-icon">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M9 9h14l-1.5 18h-11z" fill="#dfe8f3" stroke="#7d93ad" />
            <path d="M7 9h18" stroke="#7d93ad" stroke-width="2" />
            <path d="M13 13v10M16 13v10M19 13v10" stroke="#9fb2c8" />
          </svg>
          Recycle Bin
        </span>
      </div>
      <div class="taskbar" role="toolbar" aria-label="Taskbar">
        <span class="tb-mid">
          <TbIcon title="Start">
            <rect x="4" y="4" width="11" height="11" rx="1" fill="#1a73e8" />
            <rect x="17" y="4" width="11" height="11" rx="1" fill="#2f86ef" />
            <rect x="4" y="17" width="11" height="11" rx="1" fill="#2f86ef" />
            <rect x="17" y="17" width="11" height="11" rx="1" fill="#4b98f2" />
          </TbIcon>
          <span class="tb-search">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            Search
          </span>
          <TbIcon title="Task View">
            <rect x="5" y="7" width="15" height="13" rx="2" fill="#fff" stroke="#3b3b3b" stroke-width="1.6" />
            <rect x="12" y="12" width="15" height="13" rx="2" fill="#fff" stroke="#3b3b3b" stroke-width="1.6" />
          </TbIcon>
          <TbIcon title="File Explorer">
            <path d="M3 9h10l2 3h14v14H3z" fill="#f7c948" />
            <path d="M3 13h26v13H3z" fill="#fcd96a" />
          </TbIcon>
          <TbIcon title="Microsoft Edge">
            <circle cx="16" cy="16" r="12" fill="#1f8ad8" />
            <path d="M8 18c0-7 6-10 11-9s8 5 7 9h-12c0 4 6 6 11 3-3 5-9 6-13 4s-4-4-4-7z" fill="#3ccf8e" />
          </TbIcon>
          <TbIcon title="Microsoft Store">
            <path d="M6 11h20l-1 16H7z" fill="#2a6fd6" />
            <path d="M11 11a5 5 0 0110 0" fill="none" stroke="#2a6fd6" stroke-width="2" />
            <rect x="12" y="15" width="3.5" height="3.5" fill="#f25022" />
            <rect x="16.5" y="15" width="3.5" height="3.5" fill="#7fba00" />
            <rect x="12" y="19.5" width="3.5" height="3.5" fill="#00a4ef" />
            <rect x="16.5" y="19.5" width="3.5" height="3.5" fill="#ffb900" />
          </TbIcon>
        </span>
        <span class="tb-tray">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2" y="3" width="12" height="8" rx="1" />
            <path d="M6 14h4M8 11v3" />
          </svg>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 6h2.5L8 3v10L4.5 10H2zM10.5 5.5a3.5 3.5 0 010 5" />
          </svg>
          <span class="tb-clock">
            <span>{time}</span>
            <span>{date}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

function TbIcon({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <span class="tb-icon" title={title}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

/** The default wallpaper's blue flower: wide, overlapping petals opening from a dark centre. */
function Bloom() {
  const petals = [-112, -78, -44, -14, 14, 44, 78, 112];
  return (
    <svg class="desk-bloom" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="bloom-bg" cx="0.5" cy="0.55" r="0.8">
          <stop offset="0" stop-color="#e3edf9" />
          <stop offset="1" stop-color="#a8c2e6" />
        </radialGradient>
        <linearGradient id="bloom-petal" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#0a2f8f" />
          <stop offset="0.45" stop-color="#1f5fd6" />
          <stop offset="1" stop-color="#7fb4f7" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bloom-bg)" />
      <g transform="translate(200 190)">
        {petals.map((a) => (
          <path
            key={a}
            d="M0 0C-48 -34 -46 -112 0 -128C46 -112 48 -34 0 0z"
            fill="url(#bloom-petal)"
            opacity={Math.abs(a) > 60 ? 0.72 : 0.88}
            transform={`rotate(${a}) scale(${1 - Math.abs(a) / 400})`}
          />
        ))}
        <ellipse cx="0" cy="-6" rx="18" ry="10" fill="#08256f" opacity="0.6" />
      </g>
    </svg>
  );
}
