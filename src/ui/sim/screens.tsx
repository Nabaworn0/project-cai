// What the customer's PC shows, one component per screen of src/core/pc.ts. Wording is English like the
// real screens (docs/real-screens.md); no vendor logos or copyright lines. Everything is laid out in `em`
// inside .pc, whose font size follows the screen width, so a phone and a monitor show the same picture.

import { biosView, bootMenuEntries, type Pc } from '../../core/pc';
import type { Brand } from '../../content/schema';
import { SetupFrame, SetupScreenBg } from './SetupFrame';

export function PostScreen({ brand, pc }: { brand: Brand; pc: Pc }) {
  const m = pc.machine;
  return (
    <div class="pc-text post">
      <p>BIOS Version 08.00.15</p>
      <p>CPU : {m.cpu}</p>
      <p>Memory Test : {m.ramGB * 1024}MB OK</p>
      <p>&nbsp;</p>
      <p>Detecting SATA Drives ... SSD {m.storageGB}GB</p>
      <p>Detecting USB Devices ... 1 USB Device found</p>
      <p class="post-keys">
        Press {brand.keys.setup[0]} to enter SETUP, {brand.keys.bootMenu[0]} for Boot Menu
      </p>
    </div>
  );
}

export function BiosScreen({ brand, pc }: { brand: Brand; pc: Pc }) {
  const v = biosView(brand, pc)!;
  return (
    <div class="bios">
      <div class="bios-title">{v.title}</div>
      <div class="bios-tabs" role="tablist">
        {v.tabs.map((t, i) => (
          <span key={t} role="tab" aria-selected={i === v.tab} class={i === v.tab ? 'on' : ''}>
            {t}
          </span>
        ))}
      </div>
      <div class="bios-body">
        <div class="bios-main">
          <div class="bios-heading">{v.heading}</div>
          <ul class="bios-rows" role="listbox" aria-label={v.heading}>
            {v.rows.map((r) => (
              <li key={r.label} role="option" aria-selected={r.selected} class={`${r.kind}${r.selected ? ' sel' : ''}`}>
                <span class="bios-label">
                  {r.kind === 'submenu' && '► '}
                  {r.label}
                </span>
                {r.value && <span class="bios-value">{r.kind === 'info' ? r.value : `[${r.value}]`}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div class="bios-side">
          <p class="bios-help">{v.help}</p>
          <ul class="bios-legend">
            {v.legend.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
      <div class="bios-foot">v02.61</div>
      {v.popup?.kind === 'choose' && (
        <div class="bios-popup" role="dialog" aria-label="Options">
          <div class="bios-popup-title">Options</div>
          <ul>
            {v.popup.options.map((o, i) => (
              <li key={o} class={i === v.popup!.cursor ? 'sel' : ''} aria-selected={i === v.popup!.cursor}>
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}
      {v.popup?.kind === 'confirm' && (
        <div class="bios-popup confirm" role="alertdialog" aria-label={v.popup.text}>
          <p>{v.popup.text}</p>
          <div class="bios-choices">
            <span class={v.popup.cursor === 0 ? 'sel' : ''}>[Ok]</span>
            <span class={v.popup.cursor === 1 ? 'sel' : ''}>[Cancel]</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function BootMenuScreen({ pc }: { pc: Pc }) {
  const cursor = pc.screen.kind === 'boot-menu' ? pc.screen.cursor : 0;
  return (
    <div class="pc-text bootmenu-wrap">
      <div class="bootmenu">
        <div class="bootmenu-title">Please select boot device:</div>
        <ul role="listbox" aria-label="Please select boot device">
          {bootMenuEntries(pc).map((e, i) => (
            <li key={e.label} role="option" aria-selected={i === cursor} class={i === cursor ? 'sel' : ''}>
              {e.label}
            </li>
          ))}
        </ul>
        <div class="bootmenu-help">
          <p>↑ and ↓ to move selection</p>
          <p>ENTER to select boot device</p>
          <p>ESC to boot using defaults</p>
        </div>
      </div>
    </div>
  );
}

export function PressAnyKeyScreen() {
  return (
    <div class="pc-text">
      <p>
        Press any key to boot from CD or DVD<span class="dots" />
      </p>
    </div>
  );
}

export function NoBootScreen() {
  return (
    <div class="pc-text">
      <p>Reboot and Select proper Boot device</p>
      <p>or Insert Boot Media in selected Boot device and press a key</p>
    </div>
  );
}

/** The customer's old Windows lock screen: the sign that the PC did not boot from the USB. */
export function OldWindowsScreen() {
  return (
    <div class="oldwin">
      <div class="oldwin-time">10:24</div>
      <div class="oldwin-date">Friday, October 24</div>
    </div>
  );
}

/** First screen of the Windows 11 (24H2) setup: the USB booted. Cases 1–2 end here (shown, not tapped). */
export function SetupLanguageScreen() {
  return (
    <SetupScreenBg page="language">
      <SetupFrame
        title="Select language settings"
        buttons={
          <>
            <span class="w11-btn" aria-disabled="true">
              Back
            </span>
            <span class="w11-btn primary">Next</span>
          </>
        }
      >
        <div class="setup-field row">
          <span>Language to install</span>
          <span class="setup-input">English (United States)</span>
        </div>
        <div class="setup-field row">
          <span>Time and currency format</span>
          <span class="setup-input">English (United States)</span>
        </div>
      </SetupFrame>
    </SetupScreenBg>
  );
}

/** Case 2 trap: the stick holds Windows 10. Its older installer opens with the classic "Windows Setup" box. */
export function SetupWin10Screen() {
  return (
    <div class="setup10">
      <div class="setup10-win" role="group" aria-label="Windows Setup">
        <div class="setup10-title">Windows Setup</div>
        <div class="setup10-body">
          <div class="setup10-brand">Windows 10</div>
          <label>
            Language to install: <span class="setup-select">English (United States)</span>
          </label>
          <label>
            Time and currency format: <span class="setup-select">English (United States)</span>
          </label>
          <label>
            Keyboard or input method: <span class="setup-select">US</span>
          </label>
          <p class="setup10-hint">Enter your language and other preferences and click "Next" to continue.</p>
          <div class="setup-foot">
            <span class="setup10-next">Next</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Case 2 trap: the stick holds Ubuntu. Its USB starts the GNU GRUB menu (Ubuntu 24.04 desktop image). */
export function GrubScreen() {
  const entries = ['Try or Install Ubuntu', 'Ubuntu (safe graphics)', 'OEM install (for manufacturers)', 'Test memory'];
  return (
    <div class="pc-text grub">
      <p class="grub-title">GNU GRUB  version 2.12</p>
      <ul class="grub-menu" role="listbox" aria-label="GNU GRUB">
        {entries.map((e, i) => (
          <li key={e} role="option" aria-selected={i === 0} class={i === 0 ? 'sel' : ''}>
            {i === 0 ? '*' : ' '}
            {e}
          </li>
        ))}
      </ul>
      <p class="grub-help">
        Use the ↑ and ↓ keys to select which entry is highlighted. Press enter to boot the selected OS, `e' to edit the commands before
        booting or `c' for a command-line.
      </p>
    </div>
  );
}

/**
 * Windows 11 Setup refuses the PC and lists why (case 4; case 2's CSM trap). The reasons come from the machine
 * (src/core/requirements.ts); wording from docs/real-screens.md section 3. Drawn in the same Setup window ⚠️ (the
 * real page's layout is not confirmed). Back is drawn but, like the real one, fixes nothing: the way out is
 * restarting into the BIOS.
 */
export function CantRunScreen({ reasons }: { reasons: readonly string[] }) {
  return (
    <SetupScreenBg page="cant-run">
      <SetupFrame
        title="This PC can't run Windows 11"
        buttons={
          <span class="w11-btn" aria-disabled="true">
            Back
          </span>
        }
      >
        <p class="setup-text">This PC doesn't currently meet Windows 11 system requirements.</p>
        <ul class="cantrun-why" data-testid="cant-run-reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p class="setup-text">
          For more information, visit: <span class="w11-link inline">https://aka.ms/WindowsSysReq</span>
        </p>
      </SetupFrame>
    </SetupScreenBg>
  );
}
