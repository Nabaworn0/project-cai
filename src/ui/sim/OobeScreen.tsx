// Windows 11's first-time setup (24H2) as the real pages draw it (docs/case5-plan.md section 3): a light
// "bloom" background, a large white card with a picture on the left and the question on the right, the
// page's buttons at the bottom right of the card, and the accessibility and volume icons under it.
// The model is src/core/oobe.ts; this only renders `oobeView` and sends actions. Pictures are drawn here
// in SVG (not Microsoft's files). Wording: ⚠️ in docs/real-screens.md where not checked against a real screen.

import { useEffect, useState } from 'preact/hooks';
import {
  LAYOUTS,
  NAME_RULES,
  oobeView,
  PRIVACY,
  PRIVACY_LABELS,
  REGIONS,
  type Layout,
  type NameRule,
  type Oobe,
  type OobeAction,
  type OobePage,
  type PrivacyId,
} from '../../core/oobe';

interface Props {
  oobe: Oobe;
  onAction: (a: OobeAction) => void;
  /** Tapping the account field: the case flow offers the technician's choices (hand over, type for them, ask). */
  onAccountField: () => void;
}

/** What each privacy switch says (⚠️ the last two are from a real screen, the first four are shortened). */
const PRIVACY_TEXT: Record<PrivacyId, string> = {
  location: 'Get location-based experiences like directions and weather. Let Windows and apps request your location.',
  'find-device': "Turn on Find my device and use your device's location data to help you find your device if you lose it.",
  diagnostic: 'Send info about the websites you browse and how you use apps and features, plus info about device health.',
  inking: 'Send optional inking and typing diagnostic data to Microsoft to improve the language recognition of apps.',
  tailored:
    'Let Microsoft use your diagnostic data, excluding information about websites you browse, to offer you personalized tips, ads, and recommendations to enhance your Microsoft experiences.',
  ads: 'Apps can use advertising ID to provide more personalized advertising in accordance with the privacy policy of the app provider.',
};

/** "Let's customize your experience": the ways of using the PC the real page lists. */
const USES: [string, string][] = [
  ['Development', 'Build delightful apps, websites, and tools for the world'],
  ['Entertainment', 'Watch videos, browse the web, connect on social media'],
  ['Gaming', 'Play and discover games, keep up with new releases'],
  ['School', 'Take notes, write essays, collaborate on projects'],
  ['Creativity', 'Bring ideas to life with photos, videos, and more'],
  ['Business', 'Track expenses, manage clients, run your business'],
];

/** A made-up address the customer types, shown filling in while they hold the PC. */
const TYPED = 'my.account@outlook.com';

export function OobeScreen({ oobe: o, onAction, onAccountField }: Props) {
  const v = oobeView(o);
  if (v.page === 'finishing' || v.page === 'updates') return <OobeWait page={v.page} title={v.title} />;

  const btn = (label: string, a: OobeAction, primary = false, disabled = false) => (
    <button type="button" class={`oobe-btn${primary ? ' primary' : ''}`} disabled={disabled} onClick={() => onAction(a)}>
      {label}
    </button>
  );
  let body = null;
  let buttons = null;
  switch (v.page) {
    case 'region':
      body = (
        <OobeList items={REGIONS} selected={o.region} onPick={(region) => onAction({ type: 'pick-region', region })} label="Country or region" />
      );
      buttons = btn('Yes', { type: 'yes' }, true);
      break;
    case 'keyboard':
      body = <OobeList items={LAYOUTS} selected={o.layout} onPick={(layout) => onAction({ type: 'pick-layout', layout })} label="Keyboard layout" />;
      buttons = btn('Yes', { type: 'yes' }, true);
      break;
    case 'second-keyboard':
      if (o.choosingLayout) {
        body = <AddLayout first={o.layout} onAdd={(layout) => onAction({ type: 'pick-layout', layout })} />;
        buttons = btn('Skip', { type: 'skip' });
      } else {
        buttons = (
          <>
            {btn('Add layout', { type: 'add-layout' })}
            {btn('Skip', { type: 'skip' }, true)}
          </>
        );
      }
      break;
    case 'network':
      body = (
        <>
          <p class="oobe-text">
            You'll need an internet connection to continue setting up your device. Once connected, you'll get the latest features and security
            updates.
          </p>
          <div class={`oobe-net${o.cable ? ' on' : ''}`} data-testid="oobe-ethernet">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="12" rx="1.5" />
              <path d="M9 20h6M12 16v4" />
            </svg>
            <span>
              Ethernet
              <small>{o.cable ? 'Connected' : 'Network cable unplugged'}</small>
            </span>
          </div>
        </>
      );
      buttons = btn('Next', { type: 'next' }, true, !v.canNext);
      break;
    case 'name':
      body = <NameField value={o.deviceName} broken={v.nameError} onChange={(value) => onAction({ type: 'name', value })} />;
      buttons = (
        <>
          <button type="button" class="oobe-link" onClick={() => onAction({ type: 'skip' })}>
            Skip for now
          </button>
          {btn('Next', { type: 'next' }, true, !v.canNext)}
        </>
      );
      break;
    case 'setup-type':
      body = (
        <div class="oobe-choices" role="radiogroup" aria-label="Setup type">
          {(
            [
              ['personal', 'Set up for personal use', 'Use a personal Microsoft account to get set up and have full control over this device.'],
              [
                'work',
                'Set up for work or school',
                "Get access to your organization's resources like email, network, apps, and services. Your organization will have full control over this device.",
              ],
            ] as const
          ).map(([id, head, text]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={o.setupType === id}
              class={`oobe-choice${o.setupType === id ? ' sel' : ''}`}
              onClick={() => onAction({ type: 'pick-setup-type', setupType: id })}
            >
              <strong>{head}</strong>
              <span>{text}</span>
            </button>
          ))}
        </div>
      );
      buttons = btn('Next', { type: 'next' }, true, !v.canNext);
      break;
    case 'account':
      body = (
        <>
          <p class="oobe-ms">
            <MsLogo /> Microsoft
          </p>
          <h3 class="oobe-sub">Sign in</h3>
          <button type="button" class="oobe-input" data-testid="oobe-account-field" disabled={v.customerTyping} onClick={onAccountField}>
            {v.customerTyping ? (
              <span class="typed">{TYPED.slice(0, Math.ceil(TYPED.length * v.progress))}</span>
            ) : (
              <span class="ph">Email, phone, or Skype</span>
            )}
          </button>
          <p class="oobe-small">
            No account? <span class="oobe-a">Create one!</span>
          </p>
          <p class="oobe-small">
            <span class="oobe-a">Sign-in options</span>
          </p>
        </>
      );
      buttons = (
        <>
          <span class="oobe-link">Learn More</span>
          {btn('Next', { type: 'next' }, true, true)}
        </>
      );
      break;
    case 'pin': {
      const dots = '•'.repeat(Math.ceil(4 * v.progress));
      body = (
        <>
          <p class="oobe-text">A Windows Hello PIN is a fast, secure way to sign in to your device, apps, and services.</p>
          <span class="oobe-input pin" aria-label="New PIN">
            {dots}
          </span>
          <span class="oobe-input pin" aria-label="Confirm PIN">
            {v.progress > 0.5 ? dots : ''}
          </span>
          <label class="oobe-check">
            <input type="checkbox" disabled /> Include letters and symbols
          </label>
        </>
      );
      buttons = (
        <>
          <span class="oobe-link">Cancel</span>
          {btn('OK', { type: 'next' }, true, true)}
        </>
      );
      break;
    }
    case 'privacy':
      body = (
        <>
          <p class="oobe-text">
            Microsoft puts you in control of your privacy. Choose your settings, then select <b>Accept</b> to save them. You can change these settings
            at any time.
          </p>
          <div class="oobe-scroll" data-testid="oobe-privacy">
            {PRIVACY.map((id) => (
              <div class="oobe-priv" key={id}>
                <strong>{PRIVACY_LABELS[id]}</strong>
                <span>{PRIVACY_TEXT[id]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={o.privacy[id]}
                  aria-label={PRIVACY_LABELS[id]}
                  class={`oobe-toggle${o.privacy[id] ? ' on' : ''}`}
                  onClick={() => onAction({ type: 'toggle', id })}
                >
                  <i />
                  {o.privacy[id] ? 'Yes' : 'No'}
                </button>
              </div>
            ))}
          </div>
        </>
      );
      buttons = (
        <>
          <span class="oobe-link">Learn more</span>
          {btn('Accept', { type: 'accept' }, true)}
        </>
      );
      break;
    case 'customize':
      body = (
        <>
          <p class="oobe-text">
            Select all the ways you plan to use your device to get personalized tips, ads, and recommendations within Microsoft experiences.
          </p>
          <Uses />
        </>
      );
      buttons = (
        <>
          {btn('Skip', { type: 'skip' })}
          {btn('Accept', { type: 'accept' }, true)}
        </>
      );
      break;
    case 'phone':
      body = (
        <>
          <p class="oobe-text">Scan the QR code with your Android phone to link it to this PC. Get texts, calls, and photos right on your PC.</p>
          <QrCode />
        </>
      );
      buttons = btn('Skip', { type: 'skip' }, true);
      break;
    case 'onedrive':
      body = (
        <p class="oobe-text">
          Your files in Desktop, Documents, and Pictures will be backed up to OneDrive so they are protected and available on your other devices.
        </p>
      );
      buttons = (
        <>
          <button type="button" class="oobe-link" onClick={() => onAction({ type: 'skip' })}>
            Only save files to this PC
          </button>
          {btn('Next', { type: 'accept' }, true)}
        </>
      );
      break;
    case 'desktop':
      return null;
  }

  return (
    <div class="oobe-screen" data-page={v.page}>
      <div class={`oobe-card${v.customerTyping ? ' away' : ''}`} role="group" aria-label={v.title}>
        {v.canBack && (
          <button type="button" class="oobe-back" aria-label="Back" onClick={() => onAction({ type: 'back' })}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M14 8H2.5M7 3.5L2.5 8 7 12.5" />
            </svg>
          </button>
        )}
        <div class="oobe-art" aria-hidden="true">
          <Art page={v.page} />
        </div>
        <div class="oobe-main">
          <h2 class="oobe-title">{v.title}</h2>
          <div class="oobe-body">{body}</div>
          <div class="oobe-buttons">{buttons}</div>
        </div>
      </div>
      <Tray />
    </div>
  );
}

/** "Checking for updates" and the last "This might take a few minutes": text and a spinner on the background. */
function OobeWait({ page, title }: { page: OobePage; title: string }) {
  return (
    <div class={`oobe-screen wait${page === 'finishing' ? ' dark' : ''}`} data-page={page}>
      <div class="oobe-waiting">
        <h2 class="oobe-title">{title}</h2>
        {page === 'finishing' && <p class="oobe-text">Don't turn off your PC.</p>}
        <span class="oobe-spinner" role="progressbar" aria-label={title} />
      </div>
    </div>
  );
}

function OobeList<T extends string>({ items, selected, onPick, label }: { items: readonly T[]; selected: T; onPick: (v: T) => void; label: string }) {
  return (
    <div class="oobe-list" role="listbox" aria-label={label}>
      {items.map((it) => (
        <button key={it} type="button" role="option" aria-selected={it === selected} class={it === selected ? 'sel' : ''} onClick={() => onPick(it)}>
          {it}
        </button>
      ))}
    </div>
  );
}

/** After "Add layout": pick one, then "Add layout" adds it (the first layout is not offered twice). */
function AddLayout({ first, onAdd }: { first: Layout; onAdd: (l: Layout) => void }) {
  const offered = LAYOUTS.filter((l) => l !== first);
  const [pick, setPick] = useState<Layout>(offered[0]!);
  return (
    <>
      <OobeList items={offered} selected={pick} onPick={setPick} label="Keyboard layout" />
      <button type="button" class="oobe-btn primary add" onClick={() => onAdd(pick)}>
        Add layout
      </button>
    </>
  );
}

/** The name field keeps its own text so typing feels instant; every change goes to the model too. */
function NameField({ value, broken, onChange }: { value: string; broken: NameRule | null; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <>
      <p class="oobe-text">
        Make it yours with a unique name that's easy to recognize when connecting to it from other devices. Your device will restart after you name
        it.
      </p>
      <input
        class="oobe-input"
        data-testid="oobe-name"
        aria-label="Name your device"
        placeholder="Name your device"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck={false}
        value={text}
        onInput={(e) => {
          const t = (e.target as HTMLInputElement).value;
          setText(t);
          onChange(t);
        }}
      />
      <ul class="oobe-rules">
        {(Object.keys(NAME_RULES) as NameRule[]).map((r) => (
          <li key={r} class={broken === r ? 'broken' : ''}>
            {NAME_RULES[r]}
          </li>
        ))}
      </ul>
    </>
  );
}

function Uses() {
  const [on, setOn] = useState<string[]>([]);
  return (
    <div class="oobe-scroll uses">
      {USES.map(([head, text]) => (
        <label class="oobe-use" key={head}>
          <span>
            <strong>{head}</strong>
            <small>{text}</small>
          </span>
          <input
            type="checkbox"
            checked={on.includes(head)}
            onChange={() => setOn(on.includes(head) ? on.filter((x) => x !== head) : [...on, head])}
          />
        </label>
      ))}
    </div>
  );
}

/** Accessibility and volume, bottom right under the card. */
function Tray() {
  return (
    <div class="oobe-tray" aria-hidden="true">
      <svg viewBox="0 0 20 20">
        <circle cx="10" cy="3.5" r="1.6" />
        <path d="M4 7l6 1.5L16 7M10 8.5V12l-3 5M10 12l3 5" />
      </svg>
      <svg viewBox="0 0 20 20">
        <path d="M3 8h3l4-3.5v11L6 12H3zM13 7.5a3.5 3.5 0 010 5M15 5.5a6 6 0 010 9" />
      </svg>
    </div>
  );
}

function MsLogo() {
  return (
    <svg class="oobe-mslogo" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="0" y="0" width="10" height="10" fill="#f25022" />
      <rect x="11" y="0" width="10" height="10" fill="#7fba00" />
      <rect x="0" y="11" width="10" height="10" fill="#00a4ef" />
      <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}

/** A made-up QR-like square (not a real code). */
function QrCode() {
  const cells: [number, number][] = [];
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if ((x * 7 + y * 11 + x * y) % 3 === 0) cells.push([x, y]);
  return (
    <svg class="oobe-qr" viewBox="0 0 13 13" aria-hidden="true">
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
      ))}
      {[
        [0, 0],
        [9, 0],
        [0, 9],
      ].map(([x, y]) => (
        <rect key={`f${x}${y}`} x={x! + 0.5} y={y! + 0.5} width="3" height="3" fill="none" stroke="#000" stroke-width="1" />
      ))}
    </svg>
  );
}

/** The picture on the left of each page, drawn in the soft blue style of the real ones. */
function Art({ page }: { page: OobePage }) {
  switch (page) {
    case 'region':
      return (
        <svg viewBox="0 0 120 120">
          <defs>
            <linearGradient id="oobe-globe" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#1c7ce0" />
              <stop offset="1" stop-color="#5b3ed6" />
            </linearGradient>
          </defs>
          <circle cx="56" cy="64" r="34" fill="url(#oobe-globe)" />
          <path d="M34 48c8-4 14 2 20-2s6 10 0 14-14 0-16 8-6 4-8-2M66 72c6-2 10 4 8 10s-8 8-10 2" fill="#8fb5f2" opacity="0.7" />
          <path d="M70 42l30-8-20 26-4-10z" fill="#fff" />
          <path d="M76 50l4 10 20-26z" fill="#d9dbe6" />
        </svg>
      );
    case 'keyboard':
    case 'second-keyboard':
      return (
        <svg viewBox="0 0 120 120">
          <rect x="14" y="40" width="92" height="44" rx="6" fill="#fff" stroke="#c9d6ea" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3, 4, 5, 6].map((c) => (
              <rect
                key={`${r}${c}`}
                x={21 + c * 12}
                y={47 + r * 11}
                width="9"
                height="8"
                rx="1.5"
                fill={r === 1 && c === 3 ? '#1c7ce0' : '#e3e8f1'}
              />
            )),
          )}
        </svg>
      );
    case 'network':
      return (
        <svg viewBox="0 0 120 120">
          <rect x="28" y="34" width="64" height="44" rx="4" fill="#fff" stroke="#c9d6ea" />
          <path d="M44 60a22 22 0 0132 0M50 66a13 13 0 0120 0" fill="none" stroke="#1c7ce0" stroke-width="4" stroke-linecap="round" />
          <circle cx="60" cy="71" r="3" fill="#1c7ce0" />
          <rect x="52" y="78" width="16" height="6" fill="#aab8cc" />
          <rect x="40" y="84" width="40" height="4" rx="2" fill="#aab8cc" />
        </svg>
      );
    case 'name':
      return (
        <svg viewBox="0 0 120 120">
          <rect x="22" y="40" width="64" height="44" rx="3" fill="#eef1f6" stroke="#a9b4c4" stroke-width="3" />
          <rect x="16" y="86" width="76" height="3" rx="1.5" fill="#a9b4c4" />
          <rect x="36" y="56" width="36" height="12" rx="1" fill="#fff" />
          <rect x="40" y="60" width="16" height="3" rx="1.5" fill="#1c7ce0" />
          <circle cx="84" cy="44" r="13" fill="#20b29a" />
          <path d="M78 44l4 4 8-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      );
    case 'setup-type':
      return (
        <svg viewBox="0 0 120 120">
          <path d="M16 52l24-8 8 22-24 8z" fill="#2f9be6" />
          <circle cx="60" cy="62" r="20" fill="#fff" />
          <path d="M50 58h20M50 66h14" stroke="#222" stroke-width="3" stroke-linecap="round" />
          <rect x="80" y="48" width="22" height="22" rx="5" fill="#5b3ed6" />
          <path d="M88 54l8 5-8 5z" fill="#fff" />
        </svg>
      );
    case 'account':
      return (
        <svg viewBox="0 0 120 120">
          {[
            [22, 30, '#1c7ce0'],
            [62, 22, '#2f6fd1'],
            [44, 54, '#0f6cbd'],
            [80, 54, '#7b4fd6'],
            [24, 76, '#107c10'],
            [62, 80, '#2a8de0'],
          ].map(([x, y, c]) => (
            <g key={`${x}${y}`}>
              <rect x={x as number} y={y as number} width="22" height="22" rx="3" fill="#fff" stroke="#dde3ec" />
              <circle cx={(x as number) + 11} cy={(y as number) + 11} r="6" fill={c as string} />
            </g>
          ))}
        </svg>
      );
    case 'pin':
      return (
        <svg viewBox="0 0 120 120">
          <rect x="44" y="30" width="44" height="64" rx="5" fill="#fff" stroke="#dde3ec" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={50 + c * 12} y={36 + r * 12} width="9" height="9" rx="1.5" fill="#e3e8f1" />),
          )}
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={52 + i * 9} cy="82" r="3" fill={i === 3 ? '#5b3ed6' : '#1c7ce0'} />
          ))}
          <path d="M22 34l18-6 18 6v14c0 12-8 20-18 24-10-4-18-12-18-24z" fill="#2f5fe0" />
          <circle cx="36" cy="46" r="5" fill="none" stroke="#fff" stroke-width="3" />
          <path d="M40 50l8 8M45 55l3-3" stroke="#fff" stroke-width="3" stroke-linecap="round" />
        </svg>
      );
    case 'privacy':
      return (
        <svg viewBox="0 0 120 120">
          <rect x="62" y="56" width="40" height="30" rx="4" fill="#3dbfa6" />
          <rect x="34" y="28" width="56" height="44" rx="4" fill="#fff" stroke="#dde3ec" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={40 + i * 17} y="34" width="13" height="13" rx="2" fill="#e8ecf3" />
          ))}
          <path d="M16 54l16-6 16 6v12c0 10-7 17-16 21-9-4-16-11-16-21z" fill="#2f5fe0" />
          <path d="M25 66l5 5 9-10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      );
    case 'customize':
      return (
        <svg viewBox="0 0 120 120">
          <rect x="70" y="34" width="30" height="34" rx="3" fill="#2f8be0" transform="rotate(10 85 51)" />
          <path d="M22 40v24" stroke="#c0437a" stroke-width="5" />
          <circle cx="20" cy="66" r="7" fill="#8e4cd6" />
          <path d="M34 60c4-14 48-14 52 0l4 18c1 6-6 8-10 4l-6-6H46l-6 6c-4 4-11 2-10-4z" fill="#f2f2f2" stroke="#d0d0d0" />
          <circle cx="46" cy="64" r="4" fill="#555" />
          <circle cx="74" cy="62" r="2.5" fill="#e04b4b" />
          <circle cx="70" cy="66" r="2.5" fill="#2f8be0" />
        </svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 120 120">
          <rect x="18" y="40" width="54" height="38" rx="3" fill="#fff" stroke="#c9d6ea" stroke-width="3" />
          <rect x="72" y="34" width="28" height="50" rx="5" fill="#2b2f3a" />
          <rect x="75" y="40" width="22" height="38" rx="2" fill="#4c8de8" />
        </svg>
      );
    case 'onedrive':
      return (
        <svg viewBox="0 0 120 120">
          <path d="M30 78a14 14 0 012-28 20 20 0 0138-6 16 16 0 0120 18 10 10 0 01-2 16z" fill="#1c7ce0" />
          <path d="M44 78a12 12 0 0112-18 18 18 0 0132 4 10 10 0 01-2 14z" fill="#3aa0f0" />
        </svg>
      );
    default:
      return null;
  }
}
