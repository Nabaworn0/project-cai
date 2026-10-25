// Windows 11 Setup on the customer's PC (src/core/setup.ts), drawn like the real 24H2 installer inside
// SetupFrame (docs/real-setup-plan.md). Setup is used with the mouse, so it is tapped like Rufus: while it is
// on screen the PC hides its key bar and the screen grows to fit the page (sim.css).
// Pages read the state through setupView; every tap goes back as a SetupAction.

import type { ComponentChildren } from 'preact';
import { EDITIONS, MEDIA_ERROR, setupView, type Setup, type SetupAction } from '../../core/setup';
import { SetupFrame, SetupScreenBg } from './SetupFrame';

interface Props {
  setup: Setup;
  onAction: (a: SetupAction) => void;
  /** "Restart" after Setup lost its own files (the install USB was wiped). */
  onRestart: () => void;
}

export function SetupScreen({ setup, onAction, onRestart }: Props) {
  const v = setupView(setup);
  const back = (
    <button type="button" class="w11-btn" disabled={!v.canBack} onClick={() => onAction({ type: 'back' })}>
      Back
    </button>
  );
  const next = (
    <button type="button" class="w11-btn primary" disabled={!v.canNext} onClick={() => onAction({ type: 'next' })}>
      Next
    </button>
  );
  const backNext = (
    <>
      {back}
      {next}
    </>
  );

  let body: ComponentChildren = null;
  let buttons: ComponentChildren = backNext;
  let links: ComponentChildren = null;
  switch (v.page) {
    case 'language':
      body = (
        <>
          <Field label="Language to install" value="English (United States)" />
          <Field label="Time and currency format" value="English (United States)" />
        </>
      );
      break;
    case 'keyboard':
      body = <Field label="Keyboard or input method" value="US" />;
      break;
    case 'option':
      body = (
        <>
          <p class="setup-text">
            Install the latest version of Windows 11, or repair your PC. If you're installing Windows 11, please note your files, apps, and settings
            will be deleted.
          </p>
          <div class="setup-field row top">
            <span>I would like to</span>
            <fieldset class="setup-options" aria-label="Select setup option">
              <label>
                <input type="radio" name="setup-option" checked readOnly />
                Install Windows 11
              </label>
              <label>
                <input type="radio" name="setup-option" disabled />
                Repair my PC
              </label>
            </fieldset>
          </div>
          <label class="setup-check">
            <input type="checkbox" checked={setup.agreed} onChange={(e) => onAction({ type: 'agree', on: (e.target as HTMLInputElement).checked })} />
            I agree everything will be deleted including files, apps, and settings
          </label>
        </>
      );
      links = <span class="w11-link">Previous Version of Setup</span>;
      break;
    case 'product-key':
      body = (
        <>
          <p class="setup-text">The product key should be with the box the DVD came in or on your email receipt.</p>
          <p class="setup-text">It looks similar to this: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX</p>
          <label class="setup-field keyfield">
            Enter Product key
            {/* Tapping the box types the key from the sticker (no 25 characters on a phone keyboard). */}
            <input
              class="setup-input underline"
              readOnly
              value={v.key}
              placeholder="Dashes will be added automatically"
              onClick={() => onAction({ type: 'enter-key' })}
              data-testid="product-key"
            />
          </label>
        </>
      );
      links = (
        <>
          <button type="button" class="w11-link" onClick={() => onAction({ type: 'no-key' })}>
            I don't have a product key
          </button>
          <span class="w11-link">Privacy statement</span>
        </>
      );
      break;
    case 'image':
      body = (
        <>
          <p class="setup-text">Please select the image you want to install.</p>
          <div class="setup-list" role="listbox" aria-label="Operating System">
            <div class="setup-list-head" aria-hidden="true">
              Operating System:
            </div>
            {EDITIONS.map((ed) => (
              <button
                key={ed}
                type="button"
                role="option"
                aria-selected={setup.edition === ed}
                class={setup.edition === ed ? 'sel' : ''}
                onClick={() => onAction({ type: 'pick-edition', edition: ed })}
              >
                {ed}
              </button>
            ))}
          </div>
          <p class="setup-text picked">{setup.edition ?? ''}</p>
        </>
      );
      break;
    case 'license':
      body = (
        <div class="setup-license" tabIndex={0}>
          <p>
            <b>MICROSOFT SOFTWARE LICENSE TERMS</b>
          </p>
          <p>WINDOWS OPERATING SYSTEM</p>
          <p class="setup-sim-note">(ในเครื่องจริงมีข้อความสัญญาอนุญาตฉบับเต็มตรงนี้ อ่านก่อนกด Accept)</p>
        </div>
      );
      buttons = (
        <>
          {back}
          <button type="button" class="w11-btn" onClick={() => onAction({ type: 'decline' })}>
            Decline
          </button>
          <button type="button" class="w11-btn primary" onClick={() => onAction({ type: 'accept' })}>
            Accept
          </button>
        </>
      );
      break;
    case 'location':
      body = (
        <>
          {/* Seven tools in two rows, as in the real window. Load Driver, Bring Disk Online, Create and Extend
              do nothing in the game, so they stay greyed out (the real Create Partition lights up on free space). */}
          <div class="setup-tools">
            <Tool icon="refresh" label="Refresh" onClick={() => onAction({ type: 'refresh' })} />
            <Tool icon="driver" label="Load Driver" />
            <Tool icon="online" label="Bring Disk Online" />
            <span class="setup-tool-gap" aria-hidden="true" />
            <Tool icon="delete" label="Delete Partition" onClick={v.canWipe ? () => onAction({ type: 'delete' }) : undefined} />
            <Tool icon="format" label="Format Partition" onClick={v.canWipe ? () => onAction({ type: 'format' }) : undefined} />
            <Tool icon="create" label="Create Partition" />
            <Tool icon="extend" label="Extend Partition" />
          </div>
          <div class="setup-table" role="listbox" aria-label="Disks and partitions">
            <div class="setup-tr head" aria-hidden="true">
              <span>Name</span>
              <span>Total Size</span>
              <span class="free">Free Space</span>
              <span>Type</span>
            </div>
            {v.rows.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={r.selected}
                class={`setup-tr${r.selected ? ' sel' : ''}`}
                data-part={r.id}
                onClick={() => onAction({ type: 'select', id: r.id })}
              >
                <span class="name">{r.name}</span>
                <span>{r.total}</span>
                <span class="free">{r.free}</span>
                <span>{r.type}</span>
              </button>
            ))}
          </div>
          {v.error && (
            <p class="setup-error" role="alert" data-testid="setup-error">
              {v.error}
            </p>
          )}
        </>
      );
      buttons = next;
      break;
    case 'ready':
      body = (
        <>
          <p class="setup-text">You won't be able to use your PC during installation. Save and close your files before you begin.</p>
          <p class="setup-text">To recap, you've chosen to:</p>
          <ul class="setup-summary">
            <li>Install {setup.edition ?? setup.ticketEdition}</li>
            <li>Keep nothing</li>
          </ul>
          <p class="setup-text note">
            Note: Certain apps and features may have additional requirements above the Windows 11 minimum system requirements. Some features from
            previous versions of Windows aren't available in Windows 11.
          </p>
          <span class="w11-link boxed">Check device specifications</span>
        </>
      );
      buttons = (
        <>
          {back}
          <button type="button" class="w11-btn primary" onClick={() => onAction({ type: 'install' })}>
            Install
          </button>
        </>
      );
      break;
    case 'installing':
    case 'done':
      body = (
        <>
          <div class="setup-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v.progress * 100)}>
            <span style={{ width: `${v.progress * 100}%` }} />
          </div>
          <p class="setup-text" data-testid="setup-progress">
            {Math.floor(v.progress * 100)}% complete
          </p>
          <p class="setup-text dim">Your PC will restart several times.</p>
        </>
      );
      buttons = null;
      break;
    case 'media-error':
      body = <p class="setup-text">{MEDIA_ERROR}</p>;
      buttons = (
        <button type="button" class="w11-btn primary" onClick={onRestart}>
          OK
        </button>
      );
      break;
  }

  return (
    <SetupScreenBg page={v.page}>
      <SetupFrame title={v.title} links={links} buttons={buttons} variant={v.page}>
        {body}
      </SetupFrame>
      {v.confirm && (
        <div class="setup-modal">
          <div class="setup-dialog" role="alertdialog" aria-label="Windows 11 Setup">
            <p>{v.confirm.text}</p>
            <div class="w11-buttons">
              <button type="button" class="w11-btn primary" onClick={() => onAction({ type: 'ok' })}>
                OK
              </button>
              <button type="button" class="w11-btn" onClick={() => onAction({ type: 'cancel' })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </SetupScreenBg>
  );
}

type ToolIcon = 'refresh' | 'driver' | 'online' | 'delete' | 'format' | 'create' | 'extend';

/** A partition tool: an icon and a label, greyed out without an action (drawn here, not Microsoft's icons). */
function Tool({ icon, label, onClick }: { icon: ToolIcon; label: string; onClick?: () => void }) {
  return (
    <button type="button" class="setup-tool" disabled={!onClick} onClick={onClick}>
      <svg class={`setup-tool-icon ${icon}`} viewBox="0 0 16 16" aria-hidden="true">
        {TOOL_ICONS[icon]}
      </svg>
      {label}
    </button>
  );
}

const DRIVE = <path d="M2 9h12v4H2zM3.5 9l1.5-3h6l1.5 3" />;
const TOOL_ICONS: Record<ToolIcon, ComponentChildren> = {
  refresh: <path d="M12.5 6A5 5 0 0 0 3.2 6.5M3.5 10a5 5 0 0 0 9.3-.5M12.8 3v3h-3M3.2 13v-3h3" />,
  driver: <circle cx="8" cy="8" r="5.5" />,
  online: (
    <>
      {DRIVE}
      <path d="M11 2v4M9.2 4.2L11 6l1.8-1.8" />
    </>
  ),
  delete: <path d="M3 3l10 10M13 3L3 13" />,
  format: DRIVE,
  create: <path d="M8 2v12M2 8h12" />,
  extend: DRIVE,
};

/** A Setup dropdown with one choice, label on the left as in the real window: the language pages are only clicked through. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <label class="setup-field row">
      <span>{label}</span>
      <select class="setup-input">
        <option>{value}</option>
      </select>
    </label>
  );
}
