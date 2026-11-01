// Decorating the shop in free play (docs/phase3-plan.md task D): the shop's places, three things to choose from in each,
// bought with coins (asked once more before the coins go), some needing a rank first. One bought can be put out or
// taken off for free. Opened over the page it was opened from, like the technician's book.

import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Decor } from '../../content/schema';
import { offer, type DecorItem } from '../../core/decor';
import type { Progress } from '../../core/path';
import type { Rank } from '../../core/rank';
import { RankBadge } from '../menu/RankBadge';
import '../book/book.css';
import './decor.css';

/** ChatGPT's pixel pictures, src/assets/decor/<id>.png; an item without one shows its icon. */
const pictures = import.meta.glob<string>('../../assets/decor/*.png', { eager: true, query: '?url', import: 'default' });
const pictureOf = (id: string) => pictures[`../../assets/decor/${id}.png`];

interface Props {
  decor: Decor;
  progress: Progress;
  ranks: readonly Rank[];
  /** The technician's rank now (an index into `ranks`). */
  rank: number;
  onBuy: (item: DecorItem) => void;
  onPlace: (item: DecorItem) => void;
  onTakeOff: (slot: string) => void;
  onClose: () => void;
}

export function DecorScreen({ decor, progress, ranks, rank, onBuy, onPlace, onTakeOff, onClose }: Props) {
  /** The item whose purchase waits for a yes. */
  const [asking, setAsking] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);

  return (
    <div class="menu-backdrop book-backdrop" role="dialog" aria-modal="true" aria-labelledby="decor-title" data-testid="decor">
      <div class="book decor pixel-box">
        <header class="book-head">
          <h2 id="decor-title">🛋️ แต่งร้าน</h2>
          <span class="book-count" data-testid="decor-coins">
            มีเหรียญ 🪙 {progress.coins}
          </span>
          <button ref={closeRef} class="book-close" type="button" aria-label="ปิดหน้าแต่งร้าน" onClick={onClose}>
            ✕
          </button>
        </header>
        <div class="book-scroll">
          <p class="decor-note">ซื้อแล้วเป็นของเราตลอด สลับชิ้นที่ซื้อแล้วได้ฟรี ปิดหน้านี้แล้วจะเห็นในร้าน</p>
          {decor.slots.map((slot) => (
            <section key={slot.id} class="book-set" aria-label={slot.nameTh} data-slot={slot.id}>
              <h3>{slot.nameTh}</h3>
              <ul class="book-grid decor-grid">
                {decor.items
                  .filter((i) => i.slot === slot.id)
                  .map((item) => (
                    <li key={item.id}>
                      <Tile
                        item={item}
                        offer={offer(item, progress, ranks, rank)}
                        asking={asking === item.id}
                        onAsk={() => setAsking(item.id)}
                        onCancel={() => setAsking(null)}
                        onBuy={() => {
                          setAsking(null);
                          onBuy(item);
                        }}
                        onPlace={() => onPlace(item)}
                        onTakeOff={() => onTakeOff(slot.id)}
                      />
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

interface TileProps {
  item: DecorItem;
  offer: ReturnType<typeof offer>;
  asking: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onBuy: () => void;
  onPlace: () => void;
  onTakeOff: () => void;
}

function Tile({ item, offer: o, asking, onAsk, onCancel, onBuy, onPlace, onTakeOff }: TileProps) {
  const src = pictureOf(item.id);
  return (
    <div class={`book-tile decor-tile ${o.kind}`} data-item={item.id} data-offer={o.kind}>
      <span class="book-pic" aria-hidden="true">
        {src ? <img src={src} alt="" /> : item.icon}
      </span>
      <span class="book-tile-name">{item.nameTh}</span>
      <span class="book-how">{item.descTh}</span>
      {o.kind === 'placed' && <span class="book-new decor-on">วางอยู่</span>}
      <div class="decor-act">
        {o.kind === 'placed' ? (
          <button class="btn ghost small" type="button" onClick={onTakeOff}>
            เก็บออก
          </button>
        ) : o.kind === 'owned' ? (
          <button class="btn small" type="button" onClick={onPlace}>
            วางในร้าน
          </button>
        ) : o.kind === 'locked' ? (
          <span class="decor-why">
            🔒 ต้องเป็น{' '}
            <span class="decor-rank">
              <RankBadge rank={o.rank} /> {o.rank.nameTh}
            </span>
          </span>
        ) : o.kind === 'short' ? (
          <span class="decor-why">
            🪙 {item.price} · ขาดอีก {o.more}
          </span>
        ) : asking ? (
          <span class="decor-ask" role="group" aria-label={`ซื้อ${item.nameTh}`}>
            <span class="decor-q">ใช้ 🪙 {item.price} ซื้อ?</span>
            <button class="btn small" type="button" onClick={onBuy}>
              ซื้อเลย
            </button>
            <button class="btn ghost small" type="button" onClick={onCancel}>
              ไม่ซื้อ
            </button>
          </span>
        ) : (
          <button class="btn small" type="button" onClick={onAsk}>
            ซื้อ 🪙 {item.price}
          </button>
        )}
      </div>
    </div>
  );
}
