// End of a case: stars, why any were lost, coins, the customer's satisfaction, and the technician's log.
// The stars fill in one at a time with a sound each, then the coins count up. That is timing, not movement,
// so it stays with reduced motion; only the stars' pop (case.css) is dropped there.

import { useEffect, useState } from 'preact/hooks';
import { SCORING, type Summary } from '../../core/session';
import { play } from '../sound';

const STAR_START_MS = 250;
const STAR_STEP_MS = 350;
const COUNT_MS = 500;
/** When the summary has finished counting: the HUD purse takes the coins from then on. */
export const SUMMARY_REVEAL_MS = STAR_START_MS + SCORING.maxStars * STAR_STEP_MS + COUNT_MS;

export function SummaryCard({ summary }: { summary: Summary }) {
  const { stars, lostTh, coins, satisfaction, log } = summary;
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
      {lostTh.length > 0 ? (
        <ul class="lost">
          {lostTh.map((l) => (
            <li key={l}>เสียดาว: {l}</li>
          ))}
        </ul>
      ) : (
        <p class="lost">ซ่อมได้ไม่พลาดเลย</p>
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
