// Windows 11 Setup on the customer's PC (src/core/setup.ts), drawn like the new 24H2 installer
// (docs/real-screens.md section 3) without logos. Setup is used with the mouse, so it is tapped like Rufus:
// while it is on screen the PC hides its key bar and the screen grows to fit the page (sim.css).
// Pages read the state through setupView; every tap goes back as a SetupAction.

import type { ComponentChildren } from 'preact';
import { EDITIONS, MEDIA_ERROR, setupView, type Setup, type SetupAction } from '../../core/setup';

interface Props {
  setup: Setup;
  onAction: (a: SetupAction) => void;
  /** "Restart" after Setup lost its own files (the install USB was wiped). */
  onRestart: () => void;
}

export function SetupScreen({ setup, onAction, onRestart }: Props) {
  const v = setupView(setup);
  const back = v.canBack && (
    <button type="button" class="setup-btn" onClick={() => onAction({ type: 'back' })}>
      Back
    </button>
  );
  const next = (
    <button type="button" class="setup-btn primary" disabled={!v.canNext} onClick={() => onAction({ type: 'next' })}>
      Next
    </button>
  );

  let body;
  switch (v.page) {
    case 'language':
      body = (
        <>
          <Field label="Language to install" value="English (United States)" />
          <Field label="Time and currency format" value="English (United States)" />
          <Foot>{next}</Foot>
        </>
      );
      break;
    case 'keyboard':
      body = (
        <>
          <Field label="Keyboard or input method" value="US" />
          <Foot>
            {back}
            {next}
          </Foot>
        </>
      );
      break;
    case 'option':
      body = (
        <>
          <fieldset class="setup-options" aria-label="Select setup option">
            <label>
              <input type="radio" name="setup-option" checked readOnly />
              Install Windows 11
            </label>
            <label class="off">
              <input type="radio" name="setup-option" disabled />
              Repair my PC
            </label>
          </fieldset>
          <label class="setup-check">
            <input type="checkbox" checked={setup.agreed} onChange={(e) => onAction({ type: 'agree', on: (e.target as HTMLInputElement).checked })} />
            I agree everything will be deleted including files, apps, and settings.
          </label>
          <p class="setup-link off">Previous version of Setup</p>
          <Foot>
            {back}
            {next}
          </Foot>
        </>
      );
      break;
    case 'product-key':
      body = (
        <>
          <p class="setup-text">Enter the product key to activate Windows.</p>
          <label class="setup-field">
            Product key
            {/* Tapping the box types the key from the sticker (no 25 characters on a phone keyboard). */}
            <input
              class="setup-input"
              readOnly
              value={v.key}
              placeholder={setup.hasKey ? 'แตะเพื่อใส่คีย์จากสติกเกอร์' : ''}
              onClick={() => onAction({ type: 'enter-key' })}
              data-testid="product-key"
            />
          </label>
          <button type="button" class="setup-link" onClick={() => onAction({ type: 'no-key' })}>
            I don't have a product key
          </button>
          <Foot>
            {back}
            {next}
          </Foot>
        </>
      );
      break;
    case 'image':
      body = (
        <>
          <p class="setup-text">Select the image you want to install.</p>
          <fieldset class="setup-options" aria-label="Select image">
            {EDITIONS.map((ed) => (
              <label key={ed}>
                <input
                  type="radio"
                  name="setup-edition"
                  checked={setup.edition === ed}
                  onChange={() => onAction({ type: 'pick-edition', edition: ed })}
                />
                {ed}
              </label>
            ))}
          </fieldset>
          <Foot>
            {back}
            {next}
          </Foot>
        </>
      );
      break;
    case 'license':
      body = (
        <>
          <div class="setup-license" tabIndex={0}>
            <p>
              <b>MICROSOFT SOFTWARE LICENSE TERMS</b>
            </p>
            <p>WINDOWS OPERATING SYSTEM</p>
            <p class="setup-sim-note">(ในเครื่องจริงมีข้อความสัญญาอนุญาตฉบับเต็มตรงนี้ อ่านก่อนกด Accept)</p>
          </div>
          <Foot>
            {back}
            <button type="button" class="setup-btn" onClick={() => onAction({ type: 'decline' })}>
              Decline
            </button>
            <button type="button" class="setup-btn primary" onClick={() => onAction({ type: 'accept' })}>
              Accept
            </button>
          </Foot>
        </>
      );
      break;
    case 'location':
      body = (
        <>
          <div class="setup-table" role="listbox" aria-label="Disks and partitions">
            <div class="setup-tr head" aria-hidden="true">
              <span>Name</span>
              <span>Total size</span>
              <span class="free">Free space</span>
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
                <span class="name">
                  <span class="setup-disk-icon" aria-hidden="true" />
                  {r.name}
                </span>
                <span>{r.total}</span>
                <span class="free">{r.free}</span>
                <span>{r.type}</span>
              </button>
            ))}
          </div>
          <div class="setup-tools">
            <button type="button" class="setup-tool" onClick={() => onAction({ type: 'refresh' })}>
              ⟳ Refresh
            </button>
            <button type="button" class="setup-tool" disabled>
              ⇪ Load Driver
            </button>
            <button type="button" class="setup-tool" disabled={!v.canWipe} onClick={() => onAction({ type: 'delete' })}>
              ✕ Delete
            </button>
            <button type="button" class="setup-tool" disabled={!v.canWipe} onClick={() => onAction({ type: 'format' })}>
              ▭ Format
            </button>
          </div>
          {v.error && (
            <p class="setup-error" role="alert" data-testid="setup-error">
              {v.error}
            </p>
          )}
          <Foot>
            {back}
            {next}
          </Foot>
        </>
      );
      break;
    case 'ready':
      body = (
        <>
          <p class="setup-text">Install Windows 11 with these choices:</p>
          <ul class="setup-summary">
            <li>{setup.edition ?? setup.ticketEdition}</li>
            <li>Keep nothing</li>
          </ul>
          <Foot>
            {back}
            <button type="button" class="setup-btn primary" onClick={() => onAction({ type: 'install' })}>
              Install
            </button>
          </Foot>
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
      break;
    case 'media-error':
      body = (
        <>
          <p class="setup-text">{MEDIA_ERROR}</p>
          <Foot>
            <button type="button" class="setup-btn primary" onClick={onRestart}>
              OK
            </button>
          </Foot>
        </>
      );
      break;
  }

  return (
    <div class="setup setup-live" data-page={v.page}>
      <div class="setup-win" role="group" aria-label="Windows 11 Setup">
        <div class="setup-head">Windows 11 Setup</div>
        <h2>{v.title}</h2>
        {body}
      </div>
      {v.confirm && (
        <div class="setup-modal">
          <div class="setup-dialog" role="alertdialog" aria-label="Windows 11 Setup">
            <p>{v.confirm.text}</p>
            <div class="setup-foot">
              <button type="button" class="setup-btn primary" onClick={() => onAction({ type: 'ok' })}>
                OK
              </button>
              <button type="button" class="setup-btn" onClick={() => onAction({ type: 'cancel' })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A Setup dropdown with one choice: the language pages are only clicked through in the game. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <label class="setup-field">
      {label}
      <select class="setup-input">
        <option>{value}</option>
      </select>
    </label>
  );
}

function Foot({ children }: { children: ComponentChildren }) {
  return <div class="setup-foot">{children}</div>;
}
