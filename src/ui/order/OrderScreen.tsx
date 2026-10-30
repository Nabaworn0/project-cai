// The step-ordering game on the learning page (docs/order-plan.md task B): two rounds of putting the steps of a
// Windows 11 install in order with colour hints, the senior's hint after two misses and his answer with reasons,
// then the boss belt (BossBelt.tsx) and the stars. The rules are src/core/order.ts; this only draws them.
// A play is short, so it is not saved half way: leaving starts it over.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Order } from '../../content/schema';
import {
  check,
  deal,
  full,
  hintFor,
  lift,
  MAX_TRIES,
  orderStars,
  over,
  place,
  solved,
  unchanged,
  type Mark,
  type OrderResult,
  type Round,
} from '../../core/order';
import { STEP_INFO } from '../../core/path';
import { LearnPage } from '../menu/MenuScreen';
import { BossBelt } from './BossBelt';
import { Senior } from './Senior';
import './order.css';

interface Props {
  order: Order;
  /** ?seed= fixes the deal and the belt (tests, teachers); otherwise new each play. */
  seed: string | null;
  onFinish: (r: OrderResult) => void;
  onBack: () => void;
}

type Phase = { at: 'intro' } | { at: 'round'; k: number } | { at: 'answer'; k: number } | { at: 'boss' } | { at: 'result'; result: OrderResult };

const MARK = { right: { sign: '✓', th: 'ถูกตำแหน่ง' }, near: { sign: '↔', th: 'ห่างไป 1 ช่อง' }, off: { sign: '✗', th: 'ยังห่าง' } } as const;

export function OrderScreen({ order, seed, onFinish, onBack }: Props) {
  const play = useMemo(() => seed ?? Math.random().toString(36).slice(2), [seed]);
  const answers = order.rounds.map((r) => r.steps.map((s) => s.id));
  const [rounds, setRounds] = useState<Round[]>(() => answers.map((a, k) => deal(a, `${play}:${k}`)));
  const [phase, setPhase] = useState<Phase>({ at: 'intro' });
  const last = order.rounds.length - 1;

  // Each tap builds on the latest round, so quick taps in a row all count.
  const change = (k: number, f: (r: Round) => Round) => setRounds((all) => all.map((x, i) => (i === k ? f(x) : x)));
  // A round that is over (solved, or out of checks) goes to the senior's answer.
  const current = phase.at === 'round' ? rounds[phase.k] : undefined;
  useEffect(() => {
    if (phase.at === 'round' && current && over(current)) setPhase({ at: 'answer', k: phase.k });
  }, [current]);

  const title = STEP_INFO.order.th;
  const who =
    phase.at === 'round' || phase.at === 'answer' ? (
      <p class="menu-who" data-testid="order-round">
        รอบ {phase.k + 1}/{order.rounds.length} · {order.rounds[phase.k]!.titleTh}
      </p>
    ) : phase.at === 'boss' ? (
      <p class="menu-who">ด่านบอส · สายพานงานซ่อม</p>
    ) : null;

  return (
    <LearnPage
      title={title}
      testid="order"
      who={who}
      aside={
        <button class="chip menu-chip" type="button" onClick={onBack}>
          ☰ เมนู
        </button>
      }
      scrollKey={phase.at === 'round' || phase.at === 'answer' ? `${phase.at}${phase.k}` : phase.at}
      tall
      scene="room"
    >
      {phase.at === 'intro' && (
        <div class="order-intro">
          <Senior face="happy">
            {`ก่อนเข้าร้าน มาลองเรียงขั้นตอนลง Windows 11 กันก่อน ${order.rounds.length} รอบ: ${order.rounds.map((r) => r.titleTh).join(' แล้วก็ ')} แล้วปิดท้ายด้วยสายพานงานซ่อม`}
          </Senior>
          <p>แตะการ์ดเพื่อวางลงช่องว่างถัดไป แตะการ์ดในช่องเพื่อเอาออก วางครบแล้วกด "ตรวจลำดับ" แต่ละช่องจะบอกว่า</p>
          <ul class="order-legend">
            {(['right', 'near', 'off'] as const).map((m) => (
              <li key={m}>
                <span class={`order-mark ${m}`} aria-hidden="true">
                  {MARK[m].sign}
                </span>{' '}
                {MARK[m].th}
              </li>
            ))}
          </ul>
          <p class="order-note">ตรวจได้รอบละ {MAX_TRIES} ครั้ง ผิดสองครั้งแล้วพี่ช่างจะใบ้ให้</p>
          <div class="actions">
            <button class="btn" type="button" onClick={() => setPhase({ at: 'round', k: 0 })}>
              เริ่มรอบ 1
            </button>
          </div>
        </div>
      )}

      {phase.at === 'round' && (
        <RoundView
          key={phase.k}
          round={rounds[phase.k]!}
          answer={answers[phase.k]!}
          steps={order.rounds[phase.k]!.steps}
          onChange={(f) => change(phase.k, f)}
        />
      )}

      {phase.at === 'answer' && (
        <Answer
          round={rounds[phase.k]!}
          steps={order.rounds[phase.k]!.steps}
          next={phase.k < last ? `ไปรอบ ${phase.k + 2}` : 'ไปด่านบอส'}
          onNext={() => setPhase(phase.k < last ? { at: 'round', k: phase.k + 1 } : { at: 'boss' })}
        />
      )}

      {phase.at === 'boss' && (
        <BossBelt
          order={order}
          seed={`${play}:boss`}
          onDone={(lost) => {
            const result: OrderResult = { tries: rounds.map((r) => r.tries.length), solved: rounds.map(solved), lost };
            onFinish(result);
            setPhase({ at: 'result', result });
          }}
        />
      )}

      {phase.at === 'result' && (
        <Result
          result={phase.result}
          titles={order.rounds.map((r) => r.titleTh)}
          onAgain={() => {
            setRounds(answers.map((a, k) => deal(a, `${play}:again${Date.now()}:${k}`)));
            setPhase({ at: 'round', k: 0 });
          }}
          onBack={onBack}
        />
      )}
    </LearnPage>
  );
}

function RoundView({
  round,
  answer,
  steps,
  onChange,
}: {
  round: Round;
  answer: string[];
  steps: Order['rounds'][number]['steps'];
  onChange: (f: (r: Round) => Round) => void;
}) {
  const text = (id: string) => steps.find((s) => s.id === id)!.th;
  const lastTry = round.tries.at(-1);
  // A slot shows its mark only while it still holds the card that was checked there.
  const markOf = (k: number): Mark | null => (lastTry && lastTry.guess[k] === round.slots[k] ? lastTry.marks[k]! : null);
  const hint = hintFor(round, answer);
  const left = round.deck.filter((id) => !round.slots.includes(id));
  return (
    <div class="order-round">
      {round.tries.length > 0 && (
        <div class="order-tries" aria-label={`ตรวจแล้ว ${round.tries.length} จาก ${MAX_TRIES} ครั้ง`}>
          {round.tries.map((t, i) => (
            <div key={i} class="order-try" data-testid="order-try">
              {t.marks.map((m, k) => (
                <span key={k} class={`order-sq ${m}`} title={MARK[m].th} />
              ))}
            </div>
          ))}
        </div>
      )}
      <p class="order-count">
        ตรวจแล้ว {round.tries.length}/{MAX_TRIES} ครั้ง
      </p>

      {hint && <Senior face="thinking">{steps.find((s) => s.id === hint)!.hintTh}</Senior>}

      <ol class="order-slots">
        {round.slots.map((id, k) => {
          const m = markOf(k);
          return (
            <li key={k}>
              <button
                class={`order-slot${id ? ' filled' : ''}${m ? ` ${m}` : ''}`}
                type="button"
                disabled={!id}
                aria-label={id ? `ช่อง ${k + 1}: ${text(id)}${m ? ` (${MARK[m].th})` : ''} แตะเพื่อเอาออก` : `ช่อง ${k + 1} ว่าง`}
                data-mark={m ?? ''}
                onClick={() => onChange((r) => lift(r, k))}
              >
                <span class="order-no">{k + 1}</span>
                <span class="order-text">{id ? text(id) : 'แตะการ์ดด้านล่างเพื่อวาง'}</span>
                {m && (
                  <span class={`order-mark ${m}`} aria-hidden="true">
                    {MARK[m].sign}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {left.length > 0 && (
        <div class="order-deck" role="group" aria-label="การ์ดขั้นตอน">
          {left.map((id) => (
            <button key={id} class="order-card" type="button" onClick={() => onChange((r) => place(r, id))}>
              {text(id)}
            </button>
          ))}
        </div>
      )}

      {full(round) && unchanged(round) && <p class="order-note">ย้ายการ์ดที่ยังไม่ถูกก่อน แล้วค่อยตรวจอีกครั้ง</p>}
      <div class="actions">
        <button class="btn" type="button" disabled={!full(round) || unchanged(round)} onClick={() => onChange((r) => check(r, answer))}>
          ตรวจลำดับ
        </button>
      </div>
    </div>
  );
}

function Answer({ round, steps, next, onNext }: { round: Round; steps: Order['rounds'][number]['steps']; next: string; onNext: () => void }) {
  return (
    <div class="order-answer" data-testid="order-answer">
      <Senior face={solved(round) ? 'happy' : 'thinking'}>
        {solved(round)
          ? `เรียงถูกหมดในครั้งที่ ${round.tries.length} เก่งมาก ทวนเหตุผลกันหน่อย`
          : `ครบ ${MAX_TRIES} ครั้งแล้ว ไม่เป็นไร พี่เฉลยให้ จำเหตุผลไว้นะ`}
      </Senior>
      <ol class="order-why">
        {steps.map((s) => (
          <li key={s.id}>
            <b>{s.th}</b>
            <span>{s.whyTh}</span>
          </li>
        ))}
      </ol>
      <div class="actions">
        <button class="btn" type="button" onClick={onNext}>
          {next}
        </button>
      </div>
    </div>
  );
}

function Result({ result, titles, onAgain, onBack }: { result: OrderResult; titles: string[]; onAgain: () => void; onBack: () => void }) {
  const stars = orderStars(result);
  return (
    <div class="order-result" data-testid="order-result">
      <p class="order-stars" aria-label={`ได้ ${stars} ดาว จาก 3`}>
        {'★'.repeat(stars)}
        <span class="off">{'★'.repeat(3 - stars)}</span>
      </p>
      <ul class="order-summary">
        {titles.map((t, k) => (
          <li key={t}>
            รอบ {k + 1} {t}: {result.solved[k] ? `เรียงถูกในครั้งที่ ${result.tries[k]}` : `ครบ ${MAX_TRIES} ครั้ง พี่ช่างเฉลย`}
          </li>
        ))}
        <li>สายพานงานซ่อม: เสียหัวใจ {result.lost} ดวง</li>
      </ul>
      <p class="order-note">ดาวดวงที่ 2: ทุกรอบเรียงถูกภายใน 3 ครั้ง · ดวงที่ 3: สายพานเสียหัวใจไม่เกิน 1 ดวง</p>
      <div class="actions">
        <button class="btn ghost" type="button" onClick={onAgain}>
          เล่นอีกครั้ง
        </button>
        <button class="btn" type="button" onClick={onBack}>
          กลับเส้นทางเรียน
        </button>
      </div>
    </div>
  );
}
