// End of a case: stars, the senior's assessment (each criterion passed or missed, what went wrong and what to
// remember, docs/feedback-plan.md), the bonus coins, coins, the customer's satisfaction, and the technician's log.
// The stars fill in one at a time with a sound each, then the coins count up. That is timing, not movement,
// so it stays with reduced motion; only the stars' pop (case.css) is dropped there.

import { useEffect, useState } from 'preact/hooks';
import type { Feedback } from '../../content/schema';
import { cardForProblem, cardForSlip, type Card } from '../../core/book';
import { SCORING, type Criterion, type Summary } from '../../core/session';
import { play } from '../sound';

const STAR_START_MS = 250;
const STAR_STEP_MS = 350;
const COUNT_MS = 500;
/** When the summary has finished counting: the HUD purse takes the coins from then on. */
export const SUMMARY_REVEAL_MS = STAR_START_MS + SCORING.maxStars * STAR_STEP_MS + COUNT_MS;

interface Props {
  summary: Summary;
  text: Feedback;
  /** The technician's book: a crossed row links to the card that explains it (docs/book-plan.md). */
  cards?: readonly Card[];
  /** The case's own problem, whose card explains a wrong guess or a wrong explanation. */
  problem?: string;
  onCard?: (id: string) => void;
}

export function SummaryCard({ summary, text, cards = [], problem, onCard }: Props) {
  const { stars, coins, satisfaction, mistakes, log, check, criteria, bonuses } = summary;
  const [lit, setLit] = useState(0);
  const [counted, setCounted] = useState(0);

  useEffect(() => {
    const timers = Array.from({ length: stars }, (_, i) =>
      setTimeout(() => {
        setLit(i + 1);
        play('star', i * 3);
      }, STAR_START_MS + i * STAR_STEP_MS),
    );
    let raf = 0;
    const countFrom = STAR_START_MS + SCORING.maxStars * STAR_STEP_MS;
    timers.push(
      setTimeout(() => {
        const t0 = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / COUNT_MS);
          setCounted(Math.round(coins * k));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, countFrom),
    );
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div class="summary" role="group" aria-label="สรุปผล">
      <div class="stars" aria-label={`${stars} ดาว จาก ${SCORING.maxStars}`}>
        {Array.from({ length: SCORING.maxStars }, (_, i) => (
          <span key={i} class={i < lit ? 'star-on' : 'stars-off'} aria-hidden="true">
            ★
          </span>
        ))}
      </div>
      <ul class="assess" aria-label="ใบประเมินงาน" data-testid="assess">
        {criteria.map((c) => (
          <CriterionRow key={c.id} c={c} mistakes={mistakes} text={text} cards={cards} problem={problem} onCard={onCard} />
        ))}
      </ul>
      {(check || bonuses.length > 0) && (
        <ul class="bonus" aria-label="เหรียญเสริม" data-testid="bonus">
          {check && (
            <li data-testid="check-score">
              เทียบข้อกำหนด Windows 11 ถูก {check.correct}/{check.total} ข้อ (+{check.correct * SCORING.checkCoin} เหรียญ)
            </li>
          )}
          {bonuses.map((b) => (
            <li key={b.id} data-bonus={b.id}>
              {text.bonus[b.id]} (+{b.coins} เหรียญ)
            </li>
          ))}
        </ul>
      )}
      <dl class="summary-stats">
        <dt>เหรียญ</dt>
        <dd class="coins" aria-label={`+${coins}`}>
          +{counted}
        </dd>
        <dt>ความพอใจลูกค้า</dt>
        <dd>
          <span class="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={satisfaction}>
            <span style={{ width: `${satisfaction}%` }} />
          </span>{' '}
          {satisfaction}%
        </dd>
      </dl>
      <div class="techlog">
        <div class="techlog-head">บันทึกช่าง</div>
        {log.map((l) => (
          <p key={l.textTh}>
            {l.textTh}
            {l.bookPage && <span class="page"> (หนังสือ น.{l.bookPage})</span>}
          </p>
        ))}
      </div>
    </div>
  );
}

/** One criterion: passed or missed (a missed one cost a star), and for the repair each kind of mistake with
 *  what to remember; for a wrong answer, its explanation. */
function CriterionRow({ c, mistakes, text, cards, problem, onCard }: { c: Criterion; mistakes: number; text: Feedback } & Omit<Props, 'summary' | 'text'>) {
  const link = (card: Card | null) =>
    card &&
    onCard && (
      <button class="assess-card" type="button" data-card-link={card.id} onClick={() => onCard(card.id)}>
        📖 อ่านการ์ด: {card.nameTh}
      </button>
    );
  const t = text.criteria[c.id];
  // The first repair mistake is free: say so rather than "no mistakes".
  const said = c.ok ? (c.id === 'repair' && mistakes ? text.freeSlip : t.ok) : c.id === 'repair' ? `${t.miss} (${mistakes} ครั้ง)` : t.miss;
  return (
    <li class={c.ok ? 'ok' : 'miss'} data-criterion={c.id} data-ok={c.ok}>
      <div class="assess-head">
        <span class="assess-mark" aria-hidden="true">
          {c.ok ? '✓' : '✗'}
        </span>
        <b>{t.title}</b>
        <span class="assess-said">{said}</span>
        {!c.ok && <span class="assess-cost">−1 ดาว</span>}
      </div>
      {c.slips.map((r) => (
        <p key={r} class="assess-slip" data-slip={r}>
          {text.slips[r].th}
          <span class="assess-tip">จำไว้: {text.slips[r].tip}</span>
          {link(cardForSlip(cards ?? [], r))}
        </p>
      ))}
      {c.whyTh && (
        <p class="assess-slip">
          <span class="assess-tip">จำไว้: {c.whyTh}</span>
          {problem && link(cardForProblem(cards ?? [], problem))}
        </p>
      )}
    </li>
  );
}
