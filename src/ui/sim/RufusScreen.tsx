// Rufus on the shop laptop (src/core/rufus.ts), drawn like the real Windows program (Rufus 4.15 wording,
// docs/real-screens.md section 1) but without its logo. Unlike the customer's PC it is used with taps
// and the mouse, so there is no key bar. Dropdowns are the browser's own <select>, styled like Windows:
// on phones that opens the system picker, which is far easier to hit than a tiny Windows list.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { act, CUSTOMIZE_OPTIONS, ISO_FILES, rufusView, type Rufus, type RufusAction, type RufusEffect } from '../../core/rufus';
import type { DiskStyle } from '../../core/machine';
import { play } from '../sound';
import './sim.css';

interface Props {
  initial: Rufus;
  onClose: () => void;
  /** The finished write, for the case flow. */
  onEffect?: (e: RufusEffect) => void;
  /** Every change, so the owner can resume it later. */
  onRufus?: (r: Rufus) => void;
  /** Extra controls under the window (hints, the customer's words). */
  footer?: ComponentChildren;
}

const TICK_MS = 100;

export function RufusScreen({ initial, onClose, onEffect, onRufus, footer }: Props) {
  const [rufus, setRufus] = useState(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const latest = useRef({ rufus, onEffect, onRufus });
  latest.current = { rufus, onEffect, onRufus };

  const send = (a: RufusAction) => {
    const r = act(latest.current.rufus, a);
    latest.current.rufus = r.rufus;
    setRufus(r.rufus);
    latest.current.onRufus?.(r.rufus);
    for (const e of r.effects) {
      play('fixed');
      latest.current.onEffect?.(e);
    }
  };
  const tap = (a: RufusAction) => {
    play('key');
    send(a);
  };

  // Copying runs on a timer, like the real progress bar.
  useEffect(() => {
    if (rufus.phase !== 'copying') return;
    const t = setInterval(() => send({ type: 'tick', ms: TICK_MS }), TICK_MS);
    return () => clearInterval(t);
  }, [rufus.phase]);

  useEffect(() => {
    document.body.dataset.rufus = rufus.dialog?.kind ?? rufus.phase;
    return () => delete document.body.dataset.rufus;
  }, [rufus.dialog?.kind, rufus.phase]);

  // A fresh file picker starts with nothing highlighted.
  useEffect(() => {
    if (rufus.dialog?.kind !== 'pick-iso') setPicked(null);
  }, [rufus.dialog?.kind]);

  const v = rufusView(rufus);
  const d = v.dialog;
  const locked = v.busy || !!d;

  return (
    <div class="sim-backdrop" role="dialog" aria-modal="true" aria-label="โน้ตบุ๊กของร้าน">
      <div class="monitor pc-monitor laptop-monitor">
        <div class="monitor-bar">
          <span class="sim-tag">
            โน้ตบุ๊กของร้าน<span class="sim-tag-more"> · โหมดจำลอง</span>
          </span>
          <span class="monitor-actions">
            <button class="btn ghost small" type="button" onClick={onClose}>
              ปิด
            </button>
          </span>
        </div>

        {/* The desktop scrolls when the window is taller than the screen; dialogs float over it, always in view. */}
        <div class="desktop-wrap">
          <div class="desktop">
            <div class="rufus" role="group" aria-label="Rufus">
              <div class="rufus-titlebar">
                <span>Rufus 4.15.2235</span>
                <span class="rufus-x" aria-hidden="true">
                  ✕
                </span>
              </div>
              <div class="rufus-body" inert={locked || undefined}>
                <h3 class="rufus-section">Drive Properties</h3>
                <label class="rufus-field">
                  Device
                  <select disabled>
                    <option>{v.device}</option>
                  </select>
                </label>
                <div class="rufus-field">
                  <span id="rufus-boot">Boot selection</span>
                  <div class="rufus-row">
                    <select aria-labelledby="rufus-boot" disabled>
                      <option>{v.bootSelection}</option>
                    </select>
                    <button type="button" class="rufus-btn" onClick={() => tap({ type: 'open-picker' })}>
                      SELECT
                    </button>
                  </div>
                </div>
                <div class="rufus-pair">
                  <label class="rufus-field">
                    Partition scheme
                    <select
                      value={v.scheme}
                      onChange={(e) =>
                        tap({
                          type: 'set-scheme',
                          scheme: (e.target as HTMLSelectElement).value as DiskStyle,
                        })
                      }
                    >
                      <option value="mbr">MBR</option>
                      <option value="gpt">GPT</option>
                    </select>
                  </label>
                  <label class="rufus-field">
                    Target system
                    <select disabled>
                      <option>{v.target}</option>
                    </select>
                  </label>
                </div>
                <span class="rufus-link">⌄ Show advanced drive properties</span>

                <h3 class="rufus-section">Format Options</h3>
                <label class="rufus-field">
                  Volume label
                  <input value={v.volumeLabel} readOnly />
                </label>
                <div class="rufus-pair">
                  <label class="rufus-field">
                    File system
                    <select disabled>
                      <option>{v.fileSystem}</option>
                    </select>
                  </label>
                  <label class="rufus-field">
                    Cluster size
                    <select disabled>
                      <option>{v.cluster}</option>
                    </select>
                  </label>
                </div>
                <span class="rufus-link">⌄ Show advanced format options</span>

                <h3 class="rufus-section">Status</h3>
                <div
                  class="rufus-status"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(v.progress * 100)}
                  aria-label="Status"
                >
                  <span class="rufus-bar" style={{ width: `${v.progress * 100}%` }} />
                  <span class="rufus-status-text" data-testid="rufus-status">
                    {v.status}
                  </span>
                </div>
                <div class="rufus-actions">
                  <button type="button" class="rufus-btn" disabled={!v.canStart} onClick={() => tap({ type: 'start' })}>
                    START
                  </button>
                  <button type="button" class="rufus-btn" onClick={onClose}>
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          </div>
          {d && (
            <div class="win-modal">
              {d?.kind === 'pick-iso' && (
                <div class="win-dialog" role="dialog" aria-label="Open">
                  <div class="win-dialog-title">Open</div>
                  <div class="win-path">This PC › Downloads</div>
                  <ul class="win-files" role="listbox" aria-label="Downloads">
                    {ISO_FILES.map((f) => (
                      <li key={f.name} role="option" aria-selected={picked === f.name}>
                        <button
                          type="button"
                          class={picked === f.name ? 'sel' : ''}
                          onClick={() => setPicked(f.name)}
                          onDblClick={() => tap({ type: 'pick-iso', name: f.name })}
                        >
                          <span class="win-file-icon" aria-hidden="true">
                            💿
                          </span>
                          {f.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div class="win-dialog-actions">
                    <button type="button" class="rufus-btn" disabled={!picked} onClick={() => picked && tap({ type: 'pick-iso', name: picked })}>
                      Open
                    </button>
                    <button type="button" class="rufus-btn" onClick={() => tap({ type: 'close-dialog' })}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {d?.kind === 'customize' && (
                <div class="win-dialog" role="dialog" aria-label="Windows User Experience">
                  <div class="win-dialog-title">Windows User Experience</div>
                  <p class="win-dialog-text">Customize Windows installation?</p>
                  <ul class="win-checks">
                    {CUSTOMIZE_OPTIONS.map((o) => (
                      <li key={o.id}>
                        <label>
                          <input type="checkbox" checked={d.ticked.includes(o.id)} onChange={() => tap({ type: 'toggle', id: o.id })} />
                          {o.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div class="win-dialog-actions">
                    <button type="button" class="rufus-btn" onClick={() => tap({ type: 'ok' })}>
                      OK
                    </button>
                    <button type="button" class="rufus-btn" onClick={() => tap({ type: 'close-dialog' })}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {d?.kind === 'warning' && (
                <div class="win-dialog" role="alertdialog" aria-label="Rufus">
                  <div class="win-dialog-title">Rufus</div>
                  <p class="win-dialog-text warn">
                    <span class="win-warn-icon" aria-hidden="true">
                      ⚠
                    </span>
                    <span>{v.warning}</span>
                  </p>
                  <div class="win-dialog-actions">
                    <button type="button" class="rufus-btn" onClick={() => tap({ type: 'ok' })}>
                      OK
                    </button>
                    <button type="button" class="rufus-btn" onClick={() => tap({ type: 'close-dialog' })}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {footer && <div class="pc-status-row">{footer}</div>}
      </div>
    </div>
  );
}
