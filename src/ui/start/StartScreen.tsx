// The start page before the name form (docs/start-page-plan.md): a boot screen the first time on this device
// ("Press any key to start", the same line learners meet when booting from the USB drive in the cases), then the
// game's name WINSTALL over the shop's workbench, the senior greeting the intern, and the button to start, all on
// one screen; what the game teaches is folded under it. The wording is ChatGPT's (src/content/data/start.json; its
// list of steps and how to play are kept there but not shown: the menu shows the steps, 1 Nov 2026).
//
// Animated with CSS and a few timers, all of it skipped by a tap, and none of it for those who ask for less motion.

import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Start } from '../../content/schema';
import { prefersLessMotion } from '../motion';
import './start.css';

const sprites = import.meta.glob<string>('../../assets/sprites/{teach-stand,teach-thumbs,teach-mouth-small,teach-mouth-wide,teach-eyes-shut,tech-usb-hold,tech-usb-up}.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const sprite = (name: string) => sprites[`../../assets/sprites/${name}.png`]!;

/** What the boot screen types, line by line. */
export const BOOT_LINES = ['WINSTALL BIOS v1.0', 'Checking memory... OK', 'USB drive detected... OK'];
export const BOOT_PROMPT = 'Press any key to start';
const TYPE_MS = 22;
/** The greeting starts once the logo is up, and is typed this fast. */
const GREET_AT_MS = 1500;
const GREET_MS = 35;
/** After this, everything is in place even without a tap. */
const SETTLE_MS = 4200;

interface Props {
  text: Start;
  /** Show the boot screen first (the first time on this device). */
  boot: boolean;
  onBooted: () => void;
  /** The class the results go to, opened from the class's link. */
  className: string | null;
  onLeaveClass: () => void;
  muted: boolean;
  onMuted: (muted: boolean) => void;
  onStart: () => void;
  /** Opened again from the menu ("เกี่ยวกับเกม"): the button goes back instead. */
  again?: boolean;
}

export function StartScreen(props: Props) {
  const [booting, setBooting] = useState(props.boot);
  if (booting)
    return (
      <Boot
        onDone={() => {
          setBooting(false);
          props.onBooted();
        }}
      />
    );
  return <Title {...props} />;
}

function Boot({ onDone }: { onDone: () => void }) {
  const all = [...BOOT_LINES, BOOT_PROMPT].join('\n');
  const [shown, setShown] = useState(() => (prefersLessMotion() ? all.length : 0));
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => {
    if (shown >= all.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), all[shown] === '\n' ? TYPE_MS * 8 : TYPE_MS);
    return () => clearTimeout(t);
  }, [shown]);
  // Any key, as on a real PC; a tap anywhere on a phone.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      finish();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);
  const typed = all.slice(0, shown);
  const ready = shown >= all.length;
  return (
    <main class="boot" data-testid="boot" onPointerDown={finish}>
      <pre aria-hidden="true">
        {typed}
        <span class={`boot-cursor${ready ? ' blink' : ''}`}>_</span>
      </pre>
      <button class="boot-go" type="button" onClick={finish}>
        {BOOT_PROMPT}
      </button>
    </main>
  );
}

function Title({ text, className, onLeaveClass, muted, onMuted, onStart, again = false }: Props) {
  const still = prefersLessMotion();
  const [settled, setSettled] = useState(still);
  const [typed, setTyped] = useState(still ? text.greeting.length : 0);
  const [left, setLeft] = useState(false);
  const [up, setUp] = useState(false);
  const [blink, setBlink] = useState(false);
  const greeted = typed >= text.greeting.length;

  useEffect(() => {
    if (settled) return;
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [settled]);
  useEffect(() => {
    if (settled) {
      setTyped(text.greeting.length);
      return;
    }
    if (greeted) return;
    const t = setTimeout(() => setTyped((n) => n + 1), typed === 0 ? GREET_AT_MS : GREET_MS);
    return () => clearTimeout(t);
  }, [typed, settled]);
  // The intern waves the USB drive; the senior blinks now and then.
  useEffect(() => {
    if (still) return;
    const wave = setInterval(() => setUp((u) => !u), 700);
    let off: ReturnType<typeof setTimeout>;
    const eyes = setInterval(() => {
      setBlink(true);
      off = setTimeout(() => setBlink(false), 140);
    }, 3100);
    return () => {
      clearInterval(wave);
      clearInterval(eyes);
      clearTimeout(off);
    };
  }, []);

  const pose = greeted ? 'teach-thumbs' : 'teach-stand';
  const wave = up ? 'tech-usb-up' : 'tech-usb-hold';
  const talking = !greeted && typed > 0;
  const mouth = talking ? (typed % 4 < 2 ? 'teach-mouth-wide' : 'teach-mouth-small') : null;
  const teacher = `${import.meta.env.BASE_URL}?view=teacher`;

  return (
    <main
      class={`start-page${settled ? ' settled' : ''}`}
      data-testid="start"
      data-settled={settled}
      // A tap before everything is in place puts it there.
      onPointerDown={() => setSettled(true)}
    >
      <div class="start-scene" aria-hidden="true" />
      <div class="start-scroll">
        <div class="start-col">
          <header class="start-top">
            <div class="start-install" aria-hidden="true">
              <span>Installing...</span>
              <span class="start-bar">
                <span />
              </span>
            </div>
            <h1 class="start-logo">
              <span class="win">WIN</span>STALL
              <span class="sparkle" aria-hidden="true" />
            </h1>
            <p class="start-tagline">{text.tagline}</p>
          </header>

          <section class="start-hero" aria-label="พี่ช่างทักทาย">
            <p class="start-bubble">
              <span aria-hidden="true">{text.greeting.slice(0, typed)}</span>
              <span class="sr-only">{text.greeting}</span>
            </p>
            <div class="start-people" aria-hidden="true">
              <div class="start-intern">
                <img src={sprite(wave)} alt="" data-frame={wave} />
              </div>
              <div class="start-senior">
                <img src={sprite(pose)} alt="" data-frame={pose} />
                {mouth && <img src={sprite(mouth)} alt="" />}
                {blink && <img src={sprite('teach-eyes-shut')} alt="" />}
              </div>
            </div>
          </section>

          <div class="start-card pixel-box">
            {(className || left) && (
              <div class="start-class" data-testid="start-class">
                {left ? (
                  <p role="status">{text.notMyClassDone}</p>
                ) : (
                  <>
                    <p>
                      {text.classBadge.split('{class}').map((part, i) => (
                        <Fragment key={i}>
                          {i > 0 && <b>{className}</b>}
                          {part}
                        </Fragment>
                      ))}
                    </p>
                    <button
                      class="start-link"
                      type="button"
                      onClick={() => {
                        onLeaveClass();
                        setLeft(true);
                      }}
                    >
                      {text.notMyClass}
                    </button>
                  </>
                )}
              </div>
            )}

            <div class="start-row">
              <p class="start-time">⏱ {text.time}</p>
              <button class="btn ghost small" type="button" aria-pressed={!muted} onClick={() => onMuted(!muted)}>
                {muted ? `🔇 ${text.soundOff}` : `🔊 ${text.soundOn}`}
              </button>
            </div>
            <button class="btn start-go" type="button" onClick={onStart}>
              {again ? 'กลับไปเมนู' : text.start}
            </button>

            {/* What the game teaches, folded: there for whoever wants it (and for the teacher showing it). */}
            <div class="start-row">
              <details class="start-goals-box">
                <summary>{text.goalsTitle}</summary>
                <ol class="start-goals">
                  {text.goals.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ol>
              </details>
              <a class="start-teacher" href={teacher}>
                {text.teacherLink}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
