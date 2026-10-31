// The reflection after learning (docs/reflect-plan.md task B): one page in two parts. First the learner's own
// stars for the four objectives and three short written answers; then the satisfaction form, five levels per item
// in groups, and suggestions. Every tap and letter is kept as a draft (App keeps it in the progress), so leaving
// half way loses nothing. Checked before sending, sent once, then thanks. The rules are src/core/reflect.ts.

import { useState } from 'preact/hooks';
import type { Reflect } from '../../content/schema';
import { STEP_INFO } from '../../core/path';
import { LEVELS, MAX_WRITE, MIN_WRITE, missing, NO_ANSWERS, sent, type ReflectAnswers, type ReflectResult } from '../../core/reflect';
import { LearnPage } from '../menu/MenuScreen';
import './reflect.css';

const sprites = import.meta.glob<string>('../../assets/sprites/senior-{neutral,happy}.png', { eager: true, query: '?url', import: 'default' });
const senior = (face: 'neutral' | 'happy') => sprites[`../../assets/sprites/senior-${face}.png`]!;

interface Props {
  form: Reflect;
  draft: ReflectAnswers | null;
  onDraft: (a: ReflectAnswers) => void;
  onSend: (r: ReflectResult) => void;
  onBack: () => void;
}

type Phase = 'form' | 'check' | 'thanks';

export function ReflectScreen({ form, draft, onDraft, onSend, onBack }: Props) {
  const [a, setA] = useState<ReflectAnswers>(draft ?? NO_ANSWERS);
  const [phase, setPhase] = useState<Phase>('form');
  // Marked after a first try at sending, so the learner sees which ones are left.
  const [tried, setTried] = useState(false);
  const left = missing(form, a);
  const isLeft = (id: string) => tried && left.includes(id);

  const save = (next: ReflectAnswers) => {
    setA(next);
    onDraft(next);
  };
  const check = () => {
    setTried(true);
    if (left.length) document.getElementById(`r-${left[0]}`)?.scrollIntoView({ block: 'center' });
    else setPhase('check');
  };
  const send = () => {
    onSend(sent(form, a, Date.now()));
    setPhase('thanks');
  };

  return (
    <LearnPage
      title={STEP_INFO.reflect.th}
      testid="reflect"
      aside={
        <button class="chip menu-chip" type="button" onClick={onBack}>
          ☰ เมนู
        </button>
      }
      scrollKey={phase}
      tall
    >
      {phase === 'thanks' ? (
        <div class="reflect-thanks" role="status">
          <Senior face="happy" say={form.thanksTh} />
          <div class="actions">
            <button class="btn" type="button" onClick={onBack}>
              กลับเส้นทางเรียน
            </button>
          </div>
        </div>
      ) : (
        <div class="reflect" data-left={left.length}>
          <Senior face="neutral" say={form.introTh} />

          <h2 class="reflect-part">ส่วนที่ 1 สะท้อนผลการเรียนรู้</h2>
          <p class="reflect-how">
            ตอนนี้ฉันทำสิ่งนี้ได้ดีแค่ไหน 1 ดาว = {form.starsTh[0]} ถึง 5 ดาว = {form.starsTh[4]}
          </p>
          {form.self.map((s) => (
            <div key={s.id} id={`r-${s.id}`} class={`reflect-item${isLeft(s.id) ? ' left' : ''}`}>
              <p id={`l-${s.id}`}>{s.th}</p>
              <div class="reflect-stars" role="radiogroup" aria-labelledby={`l-${s.id}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={a.self[s.id] === n}
                    aria-label={`${n} ดาว`}
                    class={(a.self[s.id] ?? 0) >= n ? 'lit' : ''}
                    onClick={() => save({ ...a, self: { ...a.self, [s.id]: n } })}
                  >
                    ★
                  </button>
                ))}
              </div>
              {a.self[s.id] && <small class="reflect-means">{form.starsTh[a.self[s.id]! - 1]}</small>}
            </div>
          ))}
          {form.write.map((w) => (
            <label key={w.id} id={`r-${w.id}`} class={`reflect-item${isLeft(w.id) ? ' left' : ''}`}>
              <span>{w.th}</span>
              <textarea
                rows={2}
                maxLength={MAX_WRITE}
                placeholder={w.hintTh}
                value={a.write[w.id] ?? ''}
                onInput={(e) => save({ ...a, write: { ...a.write, [w.id]: e.currentTarget.value } })}
              />
              {isLeft(w.id) && <small>เขียนอย่างน้อย {MIN_WRITE} ตัวอักษร</small>}
            </label>
          ))}

          <h2 class="reflect-part">ส่วนที่ 2 แบบประเมินความพึงพอใจ</h2>
          <p class="reflect-how">เลือกระดับความพึงพอใจ 5 = มากที่สุด ถึง 1 = น้อยที่สุด</p>
          {form.groups.map((g) => (
            <fieldset key={g.id} class="reflect-group">
              <legend>{g.th}</legend>
              {form.satisfaction
                .filter((s) => s.group === g.id)
                .map((s) => (
                  <div key={s.id} id={`r-${s.id}`} class={`reflect-item${isLeft(s.id) ? ' left' : ''}`}>
                    <p id={`l-${s.id}`}>{s.th}</p>
                    <div class="reflect-levels" role="radiogroup" aria-labelledby={`l-${s.id}`}>
                      {LEVELS.map((l) => (
                        <button
                          key={l.value}
                          type="button"
                          role="radio"
                          aria-checked={a.sat[s.id] === l.value}
                          aria-label={`${l.value} ${l.th}`}
                          onClick={() => save({ ...a, sat: { ...a.sat, [s.id]: l.value } })}
                        >
                          <b>{l.value}</b>
                          <small>{l.th}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </fieldset>
          ))}
          <label class="reflect-item">
            <span>{form.suggestTh}</span>
            <textarea rows={2} maxLength={MAX_WRITE} value={a.suggest} onInput={(e) => save({ ...a, suggest: e.currentTarget.value })} />
          </label>

          {phase === 'check' ? (
            <div class="quiz-check reflect-check" role="alertdialog" aria-labelledby="reflect-check-q">
              <p id="reflect-check-q">ตอบครบแล้ว ส่งเลยไหม ส่งแล้วจะกลับมาแก้ไม่ได้</p>
              <div class="actions">
                <button class="btn ghost" type="button" onClick={() => setPhase('form')}>
                  กลับไปทบทวน
                </button>
                <button class="btn" type="button" onClick={send}>
                  ส่งคำตอบ
                </button>
              </div>
            </div>
          ) : (
            <div class="reflect-send">
              {tried && left.length > 0 && (
                <p class="reflect-left" role="status">
                  ยังไม่ได้ตอบ {left.length} ข้อ (ข้อที่มีกรอบแดง)
                </p>
              )}
              <div class="actions">
                <button class="btn" type="button" onClick={check}>
                  ตรวจและส่ง
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </LearnPage>
  );
}

/** The senior's face beside what he says. */
function Senior({ face, say }: { face: 'neutral' | 'happy'; say: string }) {
  return (
    <div class="reflect-senior">
      <img src={senior(face)} alt="" />
      <p>
        <b>พี่ช่าง:</b> {say}
      </p>
    </div>
  );
}
