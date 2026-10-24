// One case in the content viewer: its template, plus a "roll a machine" lab that shows what the
// generator builds from a seed, which hidden problems it picked, and how the solver repairs it.

import { useMemo, useState } from 'preact/hooks';
import { ACTIONS, getAction } from '../core/actions';
import { brandShows, generateCase, solve, type CaseLibrary } from '../core/cases';
import type { Machine } from '../core/machine';
import { GENERIC_REACTIONS } from '../core/reactions';
import { BLOCKER_TH, findBlockers, hardwareLimits } from '../core/requirements';
import { SourceBadge } from './SourceBadge';
import type { Case, CaseQuestion, Customer, Objectives, Reactions } from '../content/schema';
import { LoTags } from './LoTags';

const yesNo = (v: boolean) => (v ? 'ใช่' : 'ไม่');
const onOff = (v: boolean) => (v ? 'เปิด' : 'ปิด');

/** Machine fields as a technician would read them on the job ticket. */
const FIELDS: { key: keyof Machine; label: string; show: (m: Machine) => string }[] = [
  { key: 'cpu', label: 'CPU', show: (m) => m.cpu },
  { key: 'ramGB', label: 'RAM', show: (m) => `${m.ramGB} GB` },
  { key: 'storageGB', label: 'ดิสก์', show: (m) => `${m.storageGB} GB` },
  { key: 'diskStyle', label: 'ตารางพาร์ทิชัน', show: (m) => m.diskStyle.toUpperCase() },
  { key: 'diskHasData', label: 'มี Windows เดิมในดิสก์', show: (m) => yesNo(m.diskHasData) },
  { key: 'bootMode', label: 'โหมดบูต', show: (m) => (m.bootMode === 'uefi' ? 'UEFI' : 'Legacy (CSM)') },
  { key: 'secureBoot', label: 'Secure Boot', show: (m) => onOff(m.secureBoot) },
  { key: 'tpmEnabled', label: 'TPM', show: (m) => `${m.tpm} (${onOff(m.tpmEnabled)})` },
  { key: 'sataMode', label: 'SATA Mode', show: (m) => m.sataMode.toUpperCase() },
  { key: 'usbFirst', label: 'บูต USB ก่อน', show: (m) => yesNo(m.usbFirst) },
  { key: 'usbScheme', label: 'USB ทำแบบ (Rufus)', show: (m) => m.usbScheme.toUpperCase() },
  { key: 'productKey', label: 'มี Product Key', show: (m) => yesNo(m.productKey) + (m.activateLater ? ' (Activate ภายหลัง)' : '') },
  { key: 'missingDrivers', label: 'ไดรเวอร์ที่ขาด', show: (m) => (m.missingDrivers.length ? m.missingDrivers.join(', ') : '-') },
];

interface Props {
  template: Case;
  customer?: Customer;
  lib: CaseLibrary;
  objectives: Objectives;
}

const randomSeed = () => Math.random().toString(36).slice(2, 8);

export function CaseLab({ template, customer, lib, objectives }: Props) {
  const [seed, setSeed] = useState('demo');
  const [detailSeed, setDetailSeed] = useState('');

  const g = useMemo(() => generateCase(template, lib, seed, detailSeed || seed), [template, lib, seed, detailSeed]);
  const path = useMemo(() => solve(g.machine, g.brand, { keepData: template.customer.keepData }), [g, template]);
  const blockers = findBlockers(g.machine);
  const limits = hardwareLimits(g.machine);

  return (
    <article class="v-card" data-testid={`case-${template.id}`}>
      <header class="v-card-head">
        <span class="v-order">เคส {template.order}</span>
        <h3>{template.titleTh}</h3>
        <span class="v-stars" title="ความยาก">{'★'.repeat(template.difficulty)}{'☆'.repeat(5 - template.difficulty)}</span>
      </header>

      <p class="v-quote">
        <b>{customer?.nameTh ?? template.customer.id}:</b> “{template.customer.lineTh}”
        {customer && <span class="v-dim v-who">{customer.roleTh} · {customer.personalityTh}</span>}
      </p>
      <dl class="v-meta">
        <dt>ไฟล์</dt>
        <dd><code>cases/{template.id}.json</code></dd>
        <dt>วัตถุประสงค์</dt>
        <dd><LoTags ids={template.lo} objectives={objectives} /></dd>
        <dt>เก็บไฟล์ลูกค้า</dt>
        <dd>{template.customer.keepData ? 'ต้องเก็บ (ห้ามใช้วิธีที่ลบข้อมูล)' : 'ไม่ต้อง (สำรองแล้ว)'}</dd>
        <dt>ยี่ห้อที่สุ่มได้</dt>
        <dd>{template.brands.join(', ')}</dd>
        <dt>ปัญหาตายตัว</dt>
        <dd>{template.problems.fixed.join(', ') || '-'}</dd>
        <dt>ปัญหาสุ่มเพิ่ม</dt>
        <dd>
          {template.problems.pool.length
            ? `${template.problems.extra[0]}–${template.problems.extra[1]} อย่าง จาก ${template.problems.pool.join(', ')}`
            : '-'}
        </dd>
        <dt>มินิเกม · เวลา</dt>
        <dd>{template.minigames.join(', ') || '-'} · {Math.round(template.timeLimitSec / 60)} นาที</dd>
      </dl>

      <section class="v-qs">
        <h4>คำถามในเคส</h4>
        <Question title="เดาสาเหตุก่อนลงมือ" q={template.diagnosis} />
        {template.customerQuestions.map((q, i) => (
          <Question key={i} title={`ลูกค้าถาม: “${q.askTh}”`} q={q} />
        ))}
        <ReactionList r={template.customer.reactionsTh} />
        {template.designNotesTh.length > 0 && (
          <>
            <h5>บันทึกสำหรับคนทำเกม</h5>
            <ul class="v-list">{template.designNotesTh.map((n) => <li key={n}>{n}</li>)}</ul>
          </>
        )}
      </section>

      <section class="v-lab">
        <h4>ลองสุ่มเครื่องของเคสนี้</h4>
        <div class="v-seeds">
          <label>
            seed เคส
            <input value={seed} onInput={(e) => setSeed(e.currentTarget.value)} />
          </label>
          <label>
            seed รายละเอียด <small>(ว่าง = ใช้ seed เคส)</small>
            <input value={detailSeed} onInput={(e) => setDetailSeed(e.currentTarget.value)} placeholder={seed} />
          </label>
          <button class="btn small" type="button" onClick={() => setSeed(randomSeed())}>
            สุ่มใหม่
          </button>
        </div>
        <p class="v-hint">seed เคสเลือกยี่ห้อและปัญหาซ่อน · seed รายละเอียดเลือกสเปก (เคสรายวัน: ทุกคนได้ seed เคสเดียวกัน แต่ seed รายละเอียดต่างกัน)</p>

        <div class="v-ticket">
          <div class="v-ticket-head">
            ตั๋วเครื่อง · <b>{g.brand.name}</b> · ลง <b>Windows 11</b>
            {!g.brand.verified && <span class="v-badge warn">BIOS ยังไม่เทียบเครื่องจริง</span>}
          </div>
          <table class="v-machine">
            <tbody>
              {FIELDS.map((f) => {
                const changed = JSON.stringify(g.machine[f.key]) !== JSON.stringify(g.base[f.key]);
                return (
                  <tr key={f.key} class={changed ? 'changed' : ''}>
                    <th>{f.label}</th>
                    <td>
                      {f.show(g.machine)}
                      {changed && <span class="v-was"> (ปกติ: {f.show(g.base)}) ← ปัญหาซ่อน</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h5>ปัญหาที่ซ่อนอยู่ ({g.problems.length})</h5>
        <ol class="v-problems">
          {g.problems.map((p) => (
            <li key={p.id}>
              <b>{p.id}</b> <SourceBadge source={p.source} page={p.bookPage} /> — {p.symptomTh}
              {p.screenText && <div class="v-screen">{p.screenText}</div>}
              <div class="v-fixes">
                ทางแก้ที่กำหนด:{' '}
                {p.fixes.map((f) => {
                  const a = ACTIONS.find((x) => x.id === f);
                  const why = !a ? 'ไม่รู้จัก' : template.customer.keepData && a.destructive ? 'ลบข้อมูล' : !brandShows(g.brand, a) ? `BIOS ${g.brand.name} ไม่มีเมนูนี้` : null;
                  return (
                    <span key={f} class={`v-chip ${why ? 'off' : 'on'}`} title={a?.labelTh}>
                      {a?.labelTh ?? f}
                      {why && ` ✗ ${why}`}
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        <h5>สิ่งที่ตัวติดตั้งบ่นตอนนี้</h5>
        {blockers.length ? (
          <ul class="v-list">{blockers.map((b) => <li key={b}>{BLOCKER_TH[b]} <code class="v-dim">{b}</code></li>)}</ul>
        ) : (
          <p>ไม่มี (ติดตั้งได้เลย)</p>
        )}
        {limits.length > 0 && <p class="v-bad">ข้อจำกัดฮาร์ดแวร์: {limits.join(', ')}</p>}

        <h5>วิธีซ่อมที่สั้นที่สุด (ระบบหาให้)</h5>
        {path ? (
          <ol class="v-steps" data-testid="solution">
            {path.map((id, i) => (
              <li key={i}>
                {getAction(id).labelTh} <SourceBadge source={getAction(id).source} page={getAction(id).bookPage} />
                {getAction(id).destructive && <span class="v-badge bad">ลบข้อมูล</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p class="v-bad">ซ่อมไม่ได้! (ตัวตรวจจะแจ้ง error)</p>
        )}
      </section>
    </article>
  );
}

/** A case question with its right answer marked, as the viewer shows it to designers and teachers. */
function Question({ title, q }: { title: string; q: CaseQuestion }) {
  return (
    <div class="v-q">
      <h5>{title}</h5>
      <ol class="v-choices">
        {q.choicesTh.map((c, k) => (
          <li key={c} class={k === q.answer ? 'right' : ''}>{c}</li>
        ))}
      </ol>
      <p class="v-dim">{q.explainTh}</p>
    </div>
  );
}

/** The customer's lines during the repair; generic ones (src/core/reactions.ts) are marked so writers see what is missing. */
function ReactionList({ r }: { r: Reactions }) {
  const own = (has: boolean) => (has ? null : <span class="v-badge warn">ใช้ประโยคกลาง</span>);
  return (
    <div data-testid="reactions">
      <h5>ลูกค้าพูดระหว่างซ่อม</h5>
      <dl class="v-meta">
        <dt>บูตเข้า Windows เดิม (พลาด)</dt>
        <dd>
          {(r.oldWindowsTh ?? GENERIC_REACTIONS.oldWindowsTh).map((l) => `“${l}”`).join(' · ')} {own(!!r.oldWindowsTh)}
        </dd>
        <dt>ไม่มีอุปกรณ์บูต</dt>
        <dd>“{r.noBootTh ?? GENERIC_REACTIONS.noBootTh}” {own(!!r.noBootTh)}</dd>
        <dt>ซ่อมสำเร็จ</dt>
        <dd>“{r.fixedTh ?? GENERIC_REACTIONS.fixedTh}” {own(!!r.fixedTh)}</dd>
        <dt>ลาตอนจบ (1·2·3 ดาว)</dt>
        <dd>
          {(r.goodbyeTh ?? GENERIC_REACTIONS.goodbyeTh).map((l) => `“${l}”`).join(' · ')} {own(!!r.goodbyeTh)}
        </dd>
      </dl>
    </div>
  );
}
