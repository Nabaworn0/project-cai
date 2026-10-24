// End of a case: stars, why any were lost, coins, the customer's satisfaction, and the technician's log.

import { SCORING, type Summary } from '../../core/session';

export function SummaryCard({ summary }: { summary: Summary }) {
  const { stars, lostTh, coins, satisfaction, log } = summary;
  return (
    <div class="summary" role="group" aria-label="สรุปผล">
      <div class="stars" aria-label={`${stars} ดาว จาก ${SCORING.maxStars}`}>
        {'★'.repeat(stars)}
        <span class="stars-off">{'★'.repeat(SCORING.maxStars - stars)}</span>
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
        <dd class="coins">+{coins}</dd>
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
