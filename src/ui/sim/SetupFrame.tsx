// The Windows 11 Setup window as the real 24H2 installer draws it (docs/real-setup-plan.md section 1): a black
// screen, a classic window with a light-blue frame, the "Windows 11 Setup" title bar with its icon and the
// minimise / maximise / close buttons, a thin light-blue page title, and the footer with the Microsoft logo,
// Support and Legal on the left and the page's buttons on the right. Every Setup page renders inside it.
// The logo and icon are drawn here in SVG, not taken from Microsoft's files.

import type { ComponentChildren } from 'preact';

interface Props {
  /** The big light-blue heading, e.g. "Select language settings". */
  title: string;
  children: ComponentChildren;
  /** Links above the footer on the left, e.g. "I don't have a product key". */
  links?: ComponentChildren;
  /** The page's buttons, right of the footer (Back, Next, Install…). */
  buttons?: ComponentChildren;
  /** Extra class on the window, for pages with their own layout (the partition page). */
  variant?: string;
}

export function SetupFrame({ title, children, links, buttons, variant }: Props) {
  return (
    <div class={`w11${variant ? ` w11-${variant}` : ''}`} role="group" aria-label="Windows 11 Setup">
      <div class="w11-titlebar">
        <SetupIcon />
        <span class="w11-caption">Windows 11 Setup</span>
        <span class="w11-controls" aria-hidden="true">
          <span class="w11-ctl">
            <svg viewBox="0 0 10 10">
              <path d="M2 7.5h6" />
            </svg>
          </span>
          <span class="w11-ctl">
            <svg viewBox="0 0 10 10">
              <rect x="2" y="2.5" width="6" height="5" />
            </svg>
          </span>
          <span class="w11-ctl close">
            <svg viewBox="0 0 10 10">
              <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" />
            </svg>
          </span>
        </span>
      </div>
      <div class="w11-body">
        <h2 class="w11-title">{title}</h2>
        <div class="w11-content">{children}</div>
        {links && <div class="w11-links">{links}</div>}
        <div class="w11-foot">
          <span class="w11-brand">
            <MicrosoftLogo />
            <span class="w11-ms">Microsoft</span>
            <span class="w11-footlink">Support</span>
            <span class="w11-footlink">Legal</span>
          </span>
          <span class="w11-buttons">{buttons}</span>
        </div>
      </div>
    </div>
  );
}

/** The black screen behind the Setup window. */
export function SetupScreenBg({ children, page }: { children: ComponentChildren; page?: string }) {
  return (
    <div class="w11-screen" data-page={page}>
      {children}
    </div>
  );
}

/** Four squares (red, green, blue, yellow), as in the footer of the real window. */
function MicrosoftLogo() {
  return (
    <svg class="w11-logo" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="0" y="0" width="10" height="10" fill="#f25022" />
      <rect x="11" y="0" width="10" height="10" fill="#7fba00" />
      <rect x="0" y="11" width="10" height="10" fill="#00a4ef" />
      <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}

/** The small setup icon at the left of the title bar: a PC with a green install arrow. */
function SetupIcon() {
  return (
    <svg class="w11-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="3" width="10" height="8" rx="1" fill="#4a7fb8" />
      <rect x="2" y="4" width="8" height="6" fill="#bfe0ff" />
      <rect x="4" y="12" width="4" height="1.5" fill="#6b7f95" />
      <path d="M12 2v7M9.5 6.5L12 9l2.5-2.5" stroke="#2e9e3a" stroke-width="1.8" fill="none" />
    </svg>
  );
}
