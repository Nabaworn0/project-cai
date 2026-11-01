// The play guide (docs/guide-pin-plan.md task H): the game's topics, one open at a time, over the page it was opened
// from, like the technician's book. The learning path's topic also lists its steps, from the game itself.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Guide } from '../../content/schema';
import { STEP_INFO } from '../../core/path';
import '../book/book.css';
import './guide.css';

interface Props {
  guide: Guide;
  /** The topic open first. */
  topic: string;
  onClose: () => void;
}

export function GuideScreen({ guide, topic, onClose }: Props) {
  const [open, setOpen] = useState<string | null>(guide.sections.some((s) => s.id === topic) ? topic : guide.sections[0]!.id);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);
  // The topic just opened comes into view, its title first (a topic low in the list opens below the fold).
  useEffect(() => openRef.current?.scrollIntoView({ block: 'start' }), [open]);

  return (
    <div class="menu-backdrop book-backdrop" role="dialog" aria-modal="true" aria-labelledby="guide-title" data-testid="guide">
      <div class="book guide pixel-box">
        <header class="book-head">
          <h2 id="guide-title">❓ วิธีเล่น</h2>
          <span class="book-count">แตะหัวข้อเพื่ออ่าน</span>
          <button ref={closeRef} class="book-close" type="button" aria-label="ปิดวิธีเล่น" onClick={onClose}>
            ✕
          </button>
        </header>
        <div class="book-scroll">
          {guide.sections.map((s) => {
            const isOpen = open === s.id;
            return (
              <section key={s.id} ref={isOpen ? openRef : undefined} class={`guide-topic${isOpen ? ' open' : ''}`} data-topic={s.id}>
                <h3>
                  <button type="button" aria-expanded={isOpen} aria-controls={`guide-${s.id}`} onClick={() => setOpen(isOpen ? null : s.id)}>
                    <span aria-hidden="true">{s.icon}</span> {s.titleTh}
                  </button>
                </h3>
                <div id={`guide-${s.id}`} class="guide-body" hidden={!isOpen}>
                  <ul class="book-points">
                    {s.linesTh.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                  {s.id === 'path' && (
                    <ol class="guide-steps" aria-label="ขั้นในเส้นทางเรียน">
                      {Object.entries(STEP_INFO).map(([id, info]) => (
                        <li key={id}>{info.th}</li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
