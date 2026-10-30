// Content viewer for the people making the game (?view=content): every case, problem, BIOS brand,
// quiz, ordering game and card as the game reads them, a lab to roll machines from each case, and the validator's
// report. Not part of the game students play; nothing here changes the content files.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { ACTIONS } from '../core/actions';
import { contentFiles } from '../content';
import { parseAll, validateContent, type Report } from '../content/validate';
import { CaseLab } from './CaseLab';
import { SimLab } from './SimLab';
import { LoTags } from './LoTags';
import { SourceBadge } from './SourceBadge';
import { REQUIREMENTS } from '../core/requirements';
import './viewer.css';

const TABS = [
  ['overview', 'ภาพรวม'],
  ['cases', 'เคส'],
  ['problems', 'ปัญหา'],
  ['bios', 'BIOS'],
  ['sims', 'หน้าจอจำลอง'],
  ['quizzes', 'ข้อสอบ'],
  ['order', 'เรียงขั้นตอน'],
  ['cards', 'การ์ด'],
] as const;
type Tab = (typeof TABS)[number][0];

const actionLabel = (id: string) => ACTIONS.find((a) => a.id === id)?.labelTh ?? id;
const tabFromHash = (): Tab => TABS.find(([t]) => `#${t}` === location.hash)?.[0] ?? 'overview';

export function ContentViewer() {
  const files = useMemo(contentFiles, []);
  const { parsed, parseErrors } = useMemo(() => {
    const errors: string[] = [];
    return { parsed: parseAll(files, errors), parseErrors: errors };
  }, [files]);
  const [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState<Tab>(tabFromHash);

  // The validator rolls hundreds of machines; let the page paint first.
  useEffect(() => {
    const t = setTimeout(() => setReport(validateContent(files, { seedsPerCase: 200 })), 30);
    return () => clearTimeout(t);
  }, [files]);

  // The tab lives in the #hash, so shared links open the right tab and Back/Forward move between tabs.
  useEffect(() => {
    const onHash = () => {
      setTab(tabFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const choose = (t: Tab) => {
    if (location.hash === `#${t}`) return;
    location.hash = t;
  };

  const objectives = parsed.objectives ?? { draft: true, items: [] };
  const lib = { problems: parsed.problems, brands: parsed.brands };
  const cases = [...parsed.cases].sort((a, b) => a.order - b.order);

  return (
    <div class="viewer">
      <header class="v-top">
        <div class="v-title">
          <h1>เนื้อหาเกม ร้านซ่อมคอม</h1>
          <a href={location.pathname}>← กลับไปที่เกม</a>
        </div>
        <nav class="v-tabs" aria-label="หมวดเนื้อหา">
          {TABS.map(([t, label]) => (
            <button key={t} type="button" class={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => choose(t)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main class="v-main">
        {tab === 'overview' && (
          <section>
            <p class="v-lead">
              หน้านี้สำหรับคนทำเกมและครู: แสดงเนื้อหาจากไฟล์ใน <code>src/content/data/</code> ตามที่เกมอ่านจริง แก้ไฟล์ JSON แล้วรีเฟรชเพื่อดูผล
            </p>
            <div class={`v-status ${report ? (report.errors.length || parseErrors.length ? 'bad' : 'ok') : ''}`} data-testid="validator-status">
              {!report && 'กำลังตรวจเนื้อหา…'}
              {report &&
                (report.errors.length + parseErrors.length === 0
                  ? `ตัวตรวจผ่าน: สุ่มเครื่อง ${report.stats.machinesChecked} แบบ ซ่อมได้ทุกเครื่อง`
                  : `ตัวตรวจไม่ผ่าน: ${report.errors.length + parseErrors.length} ข้อผิดพลาด`)}
            </div>
            {report && (
              <>
                <ul class="v-stats">
                  <li><b>{report.stats.cases}</b> เคส</li>
                  <li><b>{report.stats.problems}</b> ปัญหา</li>
                  <li><b>{report.stats.brands}</b> ยี่ห้อ BIOS</li>
                  <li><b>{report.stats.testItems}</b> ข้อสอบ</li>
                  <li><b>{report.stats.cards}</b> การ์ด</li>
                  <li><b>{ACTIONS.length}</b> วิธีซ่อม</li>
                </ul>
                {[...parseErrors, ...report.errors].length > 0 && (
                  <>
                    <h2>ข้อผิดพลาด (ต้องแก้)</h2>
                    <ul class="v-list bad">{[...parseErrors, ...report.errors].map((e) => <li key={e}>{e}</li>)}</ul>
                  </>
                )}
                <h2>คำเตือน ({report.warnings.length})</h2>
                <ul class="v-list warn">{report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </>
            )}
            <h2>ลูกค้า ({parsed.customers.length})</h2>
            <ul class="v-list">
              {parsed.customers.map((c) => {
                const used = cases.filter((k) => k.customer.id === c.id).map((k) => k.order);
                return (
                  <li key={c.id}>
                    <b>{c.nameTh}</b> — {c.roleTh} · <span class="v-dim">{c.personalityTh}</span>
                    {used.length > 0 && <span class="v-badge">เคส {used.join(', ')}</span>}
                  </li>
                );
              })}
            </ul>
            <h2>ข้อกำหนด Windows 11 ที่เกมใช้ตรวจ</h2>
            <table class="v-req">
              <tbody>
                <tr><th>RAM ขั้นต่ำ</th><td>{REQUIREMENTS.ramGB} GB</td></tr>
                <tr><th>ดิสก์ขั้นต่ำ</th><td>{REQUIREMENTS.storageGB} GB</td></tr>
                <tr><th>โหมดบูต</th><td>UEFI อย่างเดียว</td></tr>
                <tr><th>Secure Boot / TPM 2.0</th><td>บังคับ</td></tr>
                <tr><th>CPU</th><td>ต้องอยู่ในรายชื่อที่รองรับ</td></tr>
              </tbody>
            </table>
            <p class="v-dim">เกมสอนลง Windows 11 อย่างเดียว (ตัดสินใจ 24 ต.ค. 2026) · Windows 10 มีแค่ในเรื่องเล่า เช่น เครื่องเก่าของลูกค้า</p>
            <h2>วัตถุประสงค์การเรียนรู้ {objectives.draft && <span class="v-badge warn">ร่าง</span>}</h2>
            <ul class="v-list">
              {objectives.items.map((o) => (
                <li key={o.id}><b>{o.id}</b> {o.th}</li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'cases' && (
          <section class="v-stack">
            {cases.map((c) => (
              <CaseLab key={c.id} template={c} customer={parsed.customers.find((x) => x.id === c.customer.id)} lib={lib} objectives={objectives} />
            ))}
          </section>
        )}

        {tab === 'problems' && (
          <section class="v-stack">
            <p class="v-lead">ปัญหาที่ซ่อนในเครื่องลูกค้าได้ แต่ละเคสเลือกจากรายการนี้ (ไฟล์ <code>problems.json</code>)</p>
            {parsed.problems.map((p) => (
              <article key={p.id} class="v-card">
                <header class="v-card-head">
                  <h3>{p.id}</h3>
                  <LoTags ids={p.lo} objectives={objectives} />
                  <SourceBadge source={p.source} page={p.bookPage} />
                </header>
                <dl class="v-meta">
                  <dt>ลูกค้าเล่า</dt>
                  <dd>{p.symptomTh}</dd>
                  {p.screenText && (
                    <>
                      <dt>ข้อความบนจอ</dt>
                      <dd><div class="v-screen">{p.screenText}</div></dd>
                    </>
                  )}
                  <dt>สาเหตุ</dt>
                  <dd>{p.explainTh}</dd>
                  <dt>คำใบ้</dt>
                  <dd><ol>{p.hintsTh.map((h) => <li key={h}>{h}</li>)}</ol></dd>
                  <dt>ทางแก้</dt>
                  <dd>{p.fixes.map((f) => <span key={f} class="v-chip on">{actionLabel(f)}</span>)}</dd>
                  <dt>เปลี่ยนเครื่องเป็น</dt>
                  <dd><code>{JSON.stringify(p.patch)}</code></dd>
                  {Object.keys(p.requires).length > 0 && (
                    <>
                      <dt>ใช้ได้เมื่อ</dt>
                      <dd><code>{JSON.stringify(p.requires)}</code></dd>
                    </>
                  )}
                </dl>
              </article>
            ))}
          </section>
        )}

        {tab === 'bios' && (
          <section class="v-stack">
            {parsed.brands.map((b) => (
              <article key={b.id} class="v-card">
                <header class="v-card-head">
                  <h3>{b.name}</h3>
                  {b.verified ? <span class="v-badge ok">เทียบเครื่องจริงแล้ว</span> : <span class="v-badge warn">ยังไม่เทียบเครื่องจริง</span>}
                  <span class="v-badge">{b.phase === 'mvp' ? 'รอบ MVP' : 'รอบถัดไป'}</span>
                </header>
                <dl class="v-meta">
                  <dt>เข้า BIOS</dt>
                  <dd>{b.keys.setup.join(' / ')}{b.keys.startupMenu && ` (กด ${b.keys.startupMenu} ก่อน)`}</dd>
                  <dt>Boot Menu</dt>
                  <dd>{b.keys.bootMenu.join(' / ')}</dd>
                  <dt>ข้อแปลก</dt>
                  <dd>
                    {[
                      b.quirks.hasAdvancedMode && 'เมนูซ่อนใน Advanced Mode',
                      b.quirks.secureBootNeedsSupervisorPassword && 'ต้องตั้ง Supervisor Password ก่อนเปลี่ยน Secure Boot',
                      b.quirks.bootMenuMustBeEnabled && 'ต้องเปิด F12 Boot Menu ก่อนใช้',
                    ]
                      .filter(Boolean)
                      .join(' · ') || '-'}
                  </dd>
                </dl>
                {b.pages.map((pg) => (
                  <div key={pg.id} class="v-bios-page">
                    <div class="v-bios-tab">{pg.label}</div>
                    <ul>
                      {pg.items.map((it) => (
                        <li key={it.label}>
                          <code>{it.label}</code> <span class="v-dim">→ {it.setting}</span>
                          {it.advancedOnly && <span class="v-badge">Advanced</span>}
                          {it.helpTh && <div class="v-dim">{it.helpTh}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {b.notesTh.length > 0 && <ul class="v-list">{b.notesTh.map((n) => <li key={n}>{n}</li>)}</ul>}
              </article>
            ))}
          </section>
        )}

        {tab === 'sims' && parsed.brands.find((b) => b.menu) && <SimLab brand={parsed.brands.find((b) => b.menu)!} />}

        {tab === 'quizzes' && parsed.test && (
          <section class="v-stack">
            <article class="v-card">
              <header class="v-card-head">
                <h3>แบบทดสอบก่อน/หลังเรียน ({parsed.test.items.length} ข้อ ชุดเดียวกัน สลับข้อและตัวเลือก)</h3>
                {parsed.test.draft && <span class="v-badge warn">ร่าง</span>}
              </header>
              {parsed.test.source && <p class="v-dim">{parsed.test.source}</p>}
              {parsed.test.items.map((it, n) => (
                <div key={it.id} class="v-q">
                  <div class="v-dim">
                    ข้อ {n + 1} · วัตถุประสงค์ข้อ {it.objective}
                  </div>
                  <p>{it.stemTh}</p>
                  <ol class="v-choices">
                    {it.choicesTh.map((c, k) => (
                      <li key={c} class={k === it.answer ? 'right' : ''}>
                        {c}
                      </li>
                    ))}
                  </ol>
                  <p class="v-dim">{it.explainTh}</p>
                </div>
              ))}
            </article>
          </section>
        )}

        {tab === 'order' && parsed.order && (
          <section class="v-stack">
            {parsed.order.source && (
              <p class="v-lead">
                {parsed.order.draft && <span class="v-badge warn">ร่าง</span>} {parsed.order.source}
              </p>
            )}
            {parsed.order.rounds.map((r, k) => (
              <article key={r.id} class="v-card" data-testid={`order-${r.id}`}>
                <header class="v-card-head">
                  <h3>
                    รอบ {k + 1} {r.titleTh} ({r.steps.length} ขั้น)
                  </h3>
                </header>
                <ol class="v-choices">
                  {r.steps.map((s) => (
                    <li key={s.id}>
                      <b>{s.th}</b>
                      {s.id === parsed.order!.boss.expand && <span class="v-badge">บอส: แตกเป็นรอบ "{parsed.order!.boss.into}"</span>}
                      <div class="v-dim">คำใบ้: {s.hintTh}</div>
                      <div class="v-dim">เหตุผล: {s.whyTh}</div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
            <article class="v-card" data-testid="order-traps">
              <header class="v-card-head">
                <h3>การ์ดกับดักในบอสสายพาน ({parsed.order.traps.length} ใบ)</h3>
              </header>
              <ul>
                {parsed.order.traps.map((t) => (
                  <li key={t.id}>
                    <b>{t.th}</b>
                    <div class="v-dim">{t.whyTh}</div>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {tab === 'cards' && parsed.cards && (
          <section class="v-stack">
            {parsed.cards.draft && <p class="v-lead"><span class="v-badge warn">ร่าง</span> แผนคือ 30 ใบ 6 ชุด</p>}
            {parsed.cards.sets.map((set) => (
              <article key={set.id} class="v-card">
                <header class="v-card-head"><h3>{set.nameTh}</h3></header>
                <div class="v-cards">
                  {parsed.cards!.cards.filter((c) => c.set === set.id).map((c) => (
                    <div key={c.id} class={`v-gamecard ${c.rarity}`}>
                      <b>{c.nameTh}</b>
                      <span class="v-dim">{{ common: 'ธรรมดา', rare: 'หายาก', epic: 'หายากมาก' }[c.rarity]}</span>
                      <p>{c.textTh}</p>
                      <span class="v-dim">ได้หลังแก้: {c.linkedProblems.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
