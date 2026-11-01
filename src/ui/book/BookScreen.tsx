// The technician's book (docs/book-plan.md): the knowledge cards by set, those got so far open to read, the rest
// "???" with how to get them, and a "ใหม่!" mark on cards not opened yet. Opened over the page it was opened from
// (the menu, the shop, or a link on the case summary) so closing it puts the learner back where they were.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Cards } from '../../content/schema';
import { howToGet, type Card } from '../../core/book';
import './book.css';

/** ChatGPT's pixel pictures, src/assets/cards/<id>.png; a card without one shows its icon. */
const pictures = import.meta.glob<string>('../../assets/cards/*.png', { eager: true, query: '?url', import: 'default' });
const pictureOf = (id: string) => pictures[`../../assets/cards/${id}.png`];

interface Props {
  book: Cards;
  /** Cards the learner has. */
  got: ReadonlySet<string>;
  read: readonly string[];
  /** Open on this card (a link from the case summary), else on the list. */
  card?: string;
  onRead: (id: string) => void;
  onClose: () => void;
}

export function BookScreen({ book, got, read, card, onRead, onClose }: Props) {
  const [open, setOpen] = useState<string | null>(card ?? null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const shown = open ? book.cards.find((c) => c.id === open) : undefined;

  // As it appears, not after the next paint: Escape straight away closes it.
  useLayoutEffect(() => {
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);
  // A card opened is no longer new.
  useEffect(() => {
    if (shown && got.has(shown.id)) onRead(shown.id);
  }, [shown?.id]);

  return (
    <div class="menu-backdrop book-backdrop" role="dialog" aria-modal="true" aria-labelledby="book-title" data-testid="book">
      <div class="book pixel-box">
        <header class="book-head">
          <h2 id="book-title">📖 สมุดช่าง</h2>
          <span class="book-count" data-testid="book-count">
            สะสมแล้ว {got.size}/{book.cards.length}
          </span>
          <button ref={closeRef} class="book-close" type="button" aria-label="ปิดสมุดช่าง" onClick={onClose}>
            ✕
          </button>
        </header>
        <div class="book-scroll">
          {shown ? (
            <CardPage card={shown} setName={book.sets.find((s) => s.id === shown.set)?.nameTh ?? ''} onBack={() => setOpen(null)} />
          ) : (
            book.sets.map((set) => (
              <section key={set.id} class="book-set" aria-label={set.nameTh}>
                <h3>{set.nameTh}</h3>
                <ul class="book-grid">
                  {book.cards
                    .filter((c) => c.set === set.id)
                    .map((c) => (
                      <li key={c.id}>
                        {got.has(c.id) ? (
                          <button class="book-tile" type="button" data-card={c.id} onClick={() => setOpen(c.id)}>
                            <Picture card={c} />
                            <span class="book-tile-name">{c.nameTh}</span>
                            {!read.includes(c.id) && <span class="book-new">ใหม่!</span>}
                          </button>
                        ) : (
                          <div class="book-tile locked" data-card={c.id} data-locked="true">
                            <span class="book-pic" aria-hidden="true">
                              ?
                            </span>
                            <span class="book-tile-name">???</span>
                            <span class="book-how">{howToGet(c)}</span>
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Picture({ card, big = false }: { card: Card; big?: boolean }) {
  const src = pictureOf(card.id);
  return (
    <span class={`book-pic${big ? ' big' : ''}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : card.icon}
    </span>
  );
}

function CardPage({ card, setName, onBack }: { card: Card; setName: string; onBack: () => void }) {
  return (
    <article class="book-card" data-testid="book-card" data-card={card.id}>
      <button class="btn ghost small" type="button" onClick={onBack}>
        ← การ์ดทั้งหมด
      </button>
      <div class="book-card-top">
        <Picture card={card} big />
        <div>
          <p class="book-card-set">{setName}</p>
          <h3>{card.nameTh}</h3>
        </div>
      </div>
      <p class="book-card-sum">{card.summaryTh}</p>
      <ul class="book-points">
        {card.pointsTh.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {card.bookPage && <p class="book-page">หนังสือ น.{card.bookPage}</p>}
    </article>
  );
}
