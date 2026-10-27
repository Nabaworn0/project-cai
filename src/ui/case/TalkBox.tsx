// A talk between the senior technician and the intern (docs/learning-page-plan.md task D): the senior walks over
// from his bench, the lines go one tap at a time, and he walks back when it ends or is skipped.
// The scene shows who is talking (face and a small hop) through 'talk:line'.

import { useEffect, useRef, useState } from 'preact/hooks';
import { bus } from '../../core/bus';
import type { Cutscenes } from '../../content/schema';
import { play } from '../sound';

type Line = Cutscenes['scenes'][number]['lines'][number];

const NAME_TH = { senior: 'พี่ช่าง', intern: 'เด็กฝึกงาน (คุณ)' } as const;

interface Props {
  lines: readonly Line[];
  /** Called once, after the last line or "ข้าม", when the senior has gone back. */
  onDone: () => void;
}

export function TalkBox({ lines, onDone }: Props) {
  const [here, setHere] = useState(false);
  const [i, setI] = useState(0);
  const ending = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const off = bus.on('senior:arrived', () => setHere(true));
    bus.emit('senior:come', {});
    return () => {
      off();
      // Left half way (back to the menu): he goes back to his bench too.
      if (!ending.current) bus.emit('senior:go', {});
    };
  }, []);

  const line = lines[i]!;
  useEffect(() => {
    if (!here) return;
    bus.emit('talk:line', { who: line.who, face: line.face });
    nextRef.current?.focus();
  }, [here, i]);

  const end = () => {
    if (ending.current) return;
    ending.current = true;
    bus.emit('talk:line', { who: 'intern', face: 'neutral' });
    const off = bus.on('senior:left', () => {
      off();
      onDone();
    });
    bus.emit('senior:go', {});
  };
  const next = () => {
    play('key');
    if (i + 1 < lines.length) setI(i + 1);
    else end();
  };

  if (!here) return null;
  const last = i + 1 === lines.length;
  return (
    <section class="narration case-panel talk" data-stage="talk" aria-live="polite" data-testid="talk">
      <div class="case-scroll">
        <span class={`speaker ${line.who}`}>{NAME_TH[line.who]}</span>
        <p class="says">“{line.th}”</p>
        <div class="actions">
          <span class="talk-count" aria-label={`ประโยคที่ ${i + 1} จาก ${lines.length}`}>
            {i + 1}/{lines.length}
          </span>
          {!last && (
            <button class="btn ghost small" type="button" onClick={end}>
              ข้าม
            </button>
          )}
          <button ref={nextRef} class="btn" type="button" onClick={next}>
            {last ? 'เริ่มงาน' : 'ต่อไป'}
          </button>
        </div>
      </div>
    </section>
  );
}
