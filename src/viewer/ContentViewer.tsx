// Content viewer for the people making the game (?view=content): every case, problem, BIOS brand,
// quiz and card as the game reads them, a lab to roll machines from each case, and the validator's
// report. Not part of the game students play; nothing here changes the content files.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { ACTIONS } from '../core/actions';
import { contentFiles } from '../content';
import { parseAll, validateContent, type Report } from '../content/validate';
import { CaseLab } from './CaseLab';
import { LoTags } from './LoTags';
import { SourceBadge } from './SourceBadge';
import { REQUIREMENTS } from '../core/requirements';
import './viewer.css';

const TABS = [
  ['overview', 'ภาพรวม'],
  ['cases', 'เคส'],
  ['problems', 'ปัญหา'],
  ['bios', 'BIOS'],
  ['quizzes', 'ข้อสอบ'],
  ['cards', 'การ์ด'],
] as const;
type Tab = (typeof TABS)[number][0];

const actionLabel = (id: string) => ACTIONS.find((a) => a.id === id)?.labelTh ?? id;

export function ContentViewer() {
  const files = useMemo(contentFiles, []);
  const { parsed, parseErrors } = useMemo(() => {
    const errors: string[] = [];
    return { parsed: parseAll(files, errors), parseErrors: errors };
  }, [files]);
  const [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState<Tab>(() => (TABS.find(([t]) => `#${t}` === location.hash)?.[0] ?? 'overview'));

  // The validator rolls hundreds of machines; let the page paint first.
  useEffect(() => {
    const t = setTimeout(() => setReport(validateContent(files, { seedsPerCase: 200 })), 30);
    return () => clearTimeout(t);
  }, [files]);

  const choose = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `${location.search}#${t}`);
    window.scrollTo(0, 0);
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
                  <li><b>{report.stats.quizzes}</b> ชุดข้อสอบ</li>
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
            <h2>ข้อกำหนดที่เกมใช้ตรวจ</h2>
            <table class="v-req">
              <thead><tr><th></th><th>Windows 10</th><th>Windows 11</th></tr></thead>
              <tbody>
                <tr><th>RAM ขั้นต่ำ</th><td>{REQUIREMENTS.win10.ramGB} GB</td><td>{REQUIREMENTS.win11.ramGB} GB</td></tr>
                <tr><th>ดิสก์ขั้นต่ำ</th><td>{REQUIREMENTS.win10.storageGB} GB</td><td>{REQUIREMENTS.win11.storageGB} GB</td></tr>
                <tr><th>โหมดบูต</th><td>Legacy หรือ UEFI</td><td>UEFI อย่างเดียว</td></tr>
                <tr><th>Secure Boot / TPM 2.0</th><td>ไม่บังคับ</td><td>บังคับ</td></tr>
                <tr><th>CPU</th><td>ทั่วไป</td><td>ต้องอยู่ในรายชื่อที่รองรับ</td></tr>
              </tbody>
            </table>
            <p class="v-dim">Windows 10 หมดการอัปเดตความปลอดภัยฟรีแล้ว (14 ต.ค. 2025) · รายละเอียด docs/book-alignment.md</p>
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
              <CaseLab key={c.id} template={c} lib={lib} objectives={objectives} />
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
                  <span class="v-badge">{p.targets.map((t) => (t === 'win11' ? 'Win 11' : 'Win 10')).join(' / ')}</span>
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

        {tab === 'quizzes' && (
          <section class="v-stack">
            {(['pre', 'mid', 'post'] as const).map((kind) => {
              const a = parsed.quizzes.find((q) => q.kind === kind && q.form === 'A');
              const b = parsed.quizzes.find((q) => q.kind === kind && q.form === 'B');
              if (!a && !b) return null;
              const pairs = [...new Set([...(a?.items ?? []), ...(b?.items ?? [])].map((i) => i.pair))];
              const title = { pre: 'ก่อนเรียน', mid: 'กลางคอร์ส', post: 'หลังเรียน' }[kind];
              return (
                <article key={kind} class="v-card">
                  <header class="v-card-head">
                    <h3>แบบทดสอบ{title}</h3>
                    {(a?.draft || b?.draft) && <span class="v-badge warn">ร่าง</span>}
                  </header>
                  {pairs.map((pair) => (
                    <div key={pair} class="v-pair">
                      {[a, b].map((q, i) => {
                        const it = q?.items.find((x) => x.pair === pair);
                        return (
                          <div key={i} class="v-q">
                            <div class="v-dim">ฟอร์ม {i ? 'B' : 'A'} · <LoTags ids={it ? [it.lo] : []} objectives={objectives} /></div>
                            {it ? (
                              <>
                                <p>{it.stemTh}</p>
                                <ol class="v-choices">
                                  {it.choicesTh.map((c, k) => (
                                    <li key={c} class={k === it.answer ? 'right' : ''}>{c}</li>
                                  ))}
                                </ol>
                                <p class="v-dim">{it.explainTh}</p>
                              </>
                            ) : (
                              <p class="v-bad">ไม่มีข้อคู่ขนาน</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </article>
              );
            })}
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
