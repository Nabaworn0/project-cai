// The teacher's page (?view=teacher, docs/results-plan.md task C): not part of the learner's game. Connects to the
// teacher's Google Sheet (the Apps Script web app of task D), makes each class's game link and its QR code, and
// brings a class's results together from the sheet or from results files learners sent; then the class figures:
// the tests before and after with a dependent t-test, E1/E2, every test item, satisfaction, the learners' own
// stars and what they wrote, a table per learner, a CSV for Excel and a page to print. Everything is worked out on
// this device; nothing is sent anywhere but to the teacher's own sheet.

import { Fragment } from 'preact';
import qrcode from 'qrcode-generator';
import { useMemo, useState } from 'preact/hooks';
import { loadContent } from '../content';
import { PLAYABLE, type Progress } from '../core/path';
import {
  classCsv,
  classFigures,
  duringPercent,
  latestPerLearner,
  learnerSummary,
  OBJECTIVE_TH,
  readResultsFile,
  type ResultsContent,
  type Stat,
} from '../core/results';
import { classUrl, deploymentFrom, endpoint, readRequest, sheetClasses, sheetFiles, validClassName } from '../core/sync';
import appsScript from '../../apps-script/Code.gs?raw';
import './teacher.css';

const content = loadContent();
const RC: ResultsContent = { test: content.test.items, lessons: content.lessons.lessons, reflect: content.reflect, caseIds: PLAYABLE };
const SETTINGS_KEY = 'shop.teacher.v1';
/** The sheet's Apps Script (docs/sheet-setup.md), for the teacher to paste or save. */
const codeHref = `data:text/plain;charset=utf-8,${encodeURIComponent(appsScript)}`;
/** The t-test is shown from this many learners with both tests. */
export const T_FROM = 5;

interface Settings {
  to: string;
  key: string;
}
function loadSettings(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Settings> | null;
    return { to: typeof v?.to === 'string' ? v.to : '', key: typeof v?.key === 'string' ? v.key : '' };
  } catch {
    return { to: '', key: '' };
  }
}
function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Not kept: typed again next time.
  }
}

interface Loaded {
  data: Progress;
  exportedAt: number;
  edited: boolean;
  from: string;
}

const n1 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pct = (x: number) => (Number.isFinite(x) ? `${x.toFixed(1)}%` : '-');
const meanSd = (s: Stat) => (s.n ? `${n1(s.mean)} (${n1(s.sd)})` : '-');
const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ'];
const gameUrl = () => `${location.origin}${location.pathname}`;

async function askSheet(to: string, body: string): Promise<unknown> {
  const res = await fetch(endpoint({ name: 'x', to }), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
  return res.json();
}

export function TeacherScreen() {
  const [settings, setSettings] = useState(loadSettings);
  const [linkText, setLinkText] = useState(settings.to);
  const [keyText, setKeyText] = useState(settings.key);
  const [setupMsg, setSetupMsg] = useState('');
  const [className, setClassName] = useState('');
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState('');
  const [classes, setClasses] = useState<string[] | null>(null);
  const [picked, setPicked] = useState('');
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [from, setFrom] = useState('');

  const connected = !!settings.to;
  const cls = className.trim();
  const link = connected && validClassName(cls) ? classUrl(gameUrl(), { name: cls, to: settings.to }) : '';
  const qr = useMemo(() => {
    if (!link) return '';
    const q = qrcode(0, 'M');
    q.addData(link, 'Byte');
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [link]);

  const save = () => {
    const to = deploymentFrom(linkText);
    if (!to) {
      setSetupMsg('ลิงก์ Web app ไม่ถูกต้อง โปรดใช้ลิงก์จาก Deploy ที่ลงท้ายด้วย /exec');
      return;
    }
    const s = { to, key: keyText.trim() };
    setSettings(s);
    saveSettings(s);
    setSetupMsg('บันทึกแล้ว (เก็บไว้ในเครื่องนี้)');
    setClasses(null);
  };
  const forget = () => {
    const s = { to: '', key: '' };
    setSettings(s);
    saveSettings(s);
    setLinkText('');
    setKeyText('');
    setClasses(null);
    setSetupMsg('ลบการตั้งค่าออกจากเครื่องนี้แล้ว');
  };
  const listClasses = async () => {
    setBusy('classes');
    try {
      const r = sheetClasses(await askSheet(settings.to, readRequest(settings.key)));
      if (r.ok) {
        setClasses(r.value);
        setPicked(r.value[0] ?? '');
        setSetupMsg(r.value.length ? '' : 'ยังไม่มีผลส่งเข้ามาใน Sheet');
      } else setSetupMsg(r.why);
    } catch {
      setSetupMsg('ติดต่อ Sheet ไม่ได้ โปรดตรวจสอบอินเทอร์เน็ตและลิงก์ Web app');
    }
    setBusy('');
  };
  const take = (texts: { name: string; text: string }[], source: string) => {
    const ok: Loaded[] = [];
    const bad: string[] = [];
    for (const t of texts) {
      const r = readResultsFile(t.text);
      if (r.ok) ok.push({ data: r.data, exportedAt: r.exportedAt, edited: r.edited, from: t.name });
      else bad.push(`${t.name}: ${r.why}`);
    }
    setLoaded(latestPerLearner(ok));
    setSkipped(bad);
    setFrom(source);
  };
  const loadClass = async () => {
    setBusy('read');
    try {
      const r = sheetFiles(await askSheet(settings.to, readRequest(settings.key, picked)));
      if (r.ok) take(r.value.map((f, i) => ({ name: `แถวที่ ${f.row ?? i + 2}`, text: f.text })), `Sheet ห้อง ${picked}`);
      else setSetupMsg(r.why);
    } catch {
      setSetupMsg('ติดต่อ Sheet ไม่ได้ โปรดตรวจสอบอินเทอร์เน็ตและลิงก์ Web app');
    }
    setBusy('');
  };
  const loadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    take(await Promise.all([...files].map(async (f) => ({ name: f.name, text: await f.text() }))), `ไฟล์ ${files.length} ไฟล์`);
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(appsScript);
      setCodeCopied('คัดลอกโค้ดแล้ว ให้นำไปวางใน Apps Script ของ Sheet');
    } catch {
      setCodeCopied('หากคัดลอกไม่ได้ ให้ดาวน์โหลดไฟล์โค้ดแทน');
    }
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main class="teacher" data-testid="teacher">
      <header class="teacher-head">
        <p>เกมร้านซ่อมคอม · รายวิชา 21910-2001</p>
        <h1>หน้าครู: รวมผลการเรียน</h1>
      </header>

      <section class="teacher-box no-print">
        <h2>1. เชื่อมกับ Google Sheet ของครู</h2>
        <p class="teacher-note">ตั้งค่า Sheet และ Apps Script ตามคู่มือครู จากนั้นกรอกลิงก์ Web app ที่ได้จาก Deploy พร้อมรหัสครู</p>
        <div class="teacher-row">
          <button class="btn ghost" type="button" onClick={() => void copyCode()}>
            คัดลอกโค้ด Apps Script
          </button>
          <a class="btn ghost" href={codeHref} download="Code.gs">
            ดาวน์โหลดโค้ด (Code.gs)
          </a>
        </div>
        {codeCopied && (
          <p class="teacher-msg" role="status">
            {codeCopied}
          </p>
        )}
        <label>
          ลิงก์ Web app
          <input value={linkText} onInput={(e) => setLinkText(e.currentTarget.value)} placeholder="https://script.google.com/macros/s/…/exec" />
        </label>
        <label>
          รหัสครู (ใช้สำหรับดึงผล นักเรียนไม่ต้องทราบ)
          <input type="password" value={keyText} onInput={(e) => setKeyText(e.currentTarget.value)} autocomplete="off" />
        </label>
        <div class="teacher-row">
          <button class="btn" type="button" onClick={save}>
            บันทึก
          </button>
          {connected && (
            <button class="btn ghost" type="button" onClick={forget}>
              ลบการตั้งค่า
            </button>
          )}
        </div>
        {setupMsg && (
          <p class="teacher-msg" role="status">
            {setupMsg}
          </p>
        )}
      </section>

      {connected && (
        <section class="teacher-box no-print">
          <h2>2. ลิงก์เกมสำหรับห้อง</h2>
          <label>
            ชื่อห้อง (เช่น ปวช.1/2 · ใช้เป็นชื่อแท็บใน Sheet)
            <input value={className} onInput={(e) => setClassName(e.currentTarget.value)} maxLength={30} />
          </label>
          {cls && !link && <p class="teacher-msg">ชื่อห้องต้องไม่เกิน 30 ตัว และใช้ได้เฉพาะตัวอักษร ตัวเลข . / _ -</p>}
          {link && (
            <div class="teacher-link">
              <div class="teacher-qr" aria-label="QR code ลิงก์เกมของห้อง" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
              <div>
                <p class="teacher-url" data-testid="class-link">
                  {decodeURIComponent(link)}
                </p>
                <button class="btn" type="button" onClick={() => void copyLink()}>
                  คัดลอกลิงก์
                </button>
                {copied && <p class="teacher-msg">คัดลอกแล้ว</p>}
                <p class="teacher-note">ให้นักเรียนสแกน QR หรือเปิดลิงก์นี้ เมื่อทำแต่ละขั้นเสร็จ ระบบจะส่งผลเข้าแท็บ "{cls}" ใน Sheet อัตโนมัติ</p>
              </div>
            </div>
          )}
        </section>
      )}

      <section class="teacher-box no-print">
        <h2>{connected ? '3. ดึงผลของห้อง' : '2. เปิดไฟล์ผลของนักเรียน'}</h2>
        {connected && (
          <div class="teacher-row">
            <button class="btn ghost" type="button" disabled={busy !== ''} onClick={() => void listClasses()}>
              {busy === 'classes' ? 'กำลังดู…' : 'ดูห้องใน Sheet'}
            </button>
            {classes && classes.length > 0 && (
              <>
                <select value={picked} onChange={(e) => setPicked(e.currentTarget.value)} aria-label="ห้อง">
                  {classes.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <button class="btn" type="button" disabled={busy !== ''} onClick={() => void loadClass()}>
                  {busy === 'read' ? 'กำลังดึง…' : 'ดึงผล'}
                </button>
              </>
            )}
          </div>
        )}
        <label
          class="teacher-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void loadFiles(e.dataTransfer?.files ?? null);
          }}
        >
          {connected ? 'หรือ' : ''} ลากไฟล์ผล (.json) ของนักเรียนมาวางที่นี่ หรือกดเลือกหลายไฟล์
          <input type="file" accept=".json,application/json" multiple onChange={(e) => void loadFiles(e.currentTarget.files)} />
        </label>
      </section>

      {from && <Report loaded={loaded} skipped={skipped} from={from} />}
    </main>
  );
}

function Report({ loaded, skipped, from }: { loaded: Loaded[]; skipped: string[]; from: string }) {
  const ps = loaded.map((l) => l.data);
  const f = classFigures(ps, RC);
  const csv = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([classCsv(ps, RC)], { type: 'text/csv;charset=utf-8' }));
    a.download = `ผลการเรียน-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const edited = loaded.filter((l) => l.edited);
  const t = f.t;
  const sig = t && t.p < 0.05;

  return (
    <div class="teacher-report" data-testid="teacher-report">
      <section class="teacher-box">
        <h2>ผลของห้อง ({from})</h2>
        <p class="teacher-count" data-testid="teacher-count">
          ผู้เรียน {f.learners} คน · ทำแบบทดสอบครบก่อนและหลัง {f.pre.n} คน
        </p>
        {skipped.length > 0 && (
          <details class="teacher-skipped">
            <summary>ข้าม {skipped.length} รายการที่อ่านไม่ได้</summary>
            <ul>
              {skipped.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        )}
        {edited.length > 0 && (
          <p class="teacher-warn" role="alert">
            ไฟล์ของ {edited.map((l) => `เลขที่ ${l.data.learner!.no}`).join(', ')} ถูกแก้ไขหลังดาวน์โหลด โปรดตรวจสอบ
          </p>
        )}
        <div class="teacher-row no-print">
          <button class="btn" type="button" onClick={csv} disabled={!ps.length}>
            ดาวน์โหลด CSV (Excel)
          </button>
          <button class="btn ghost" type="button" onClick={() => print()}>
            พิมพ์หน้านี้
          </button>
        </div>
      </section>

      {ps.length > 0 && (
        <>
          <section class="teacher-box">
            <h2>ก่อนเรียนและหลังเรียน</h2>
            <div class="teacher-tiles">
              <div>
                <small>ก่อนเรียน x̄ (S.D.)</small>
                <b data-testid="pre-mean">{meanSd(f.pre)}</b>
                <span>เต็ม {RC.test.length}</span>
              </div>
              <div>
                <small>หลังเรียน x̄ (S.D.)</small>
                <b data-testid="post-mean">{meanSd(f.post)}</b>
                <span>เต็ม {RC.test.length}</span>
              </div>
              <div>
                <small>เพิ่มขึ้นเฉลี่ย</small>
                <b>{f.gain.n ? n1(f.gain.mean) : '-'}</b>
                <span>คะแนน</span>
              </div>
              <div>
                <small>E1/E2</small>
                <b data-testid="e1e2">
                  {Number.isFinite(f.e1) ? f.e1.toFixed(2) : '-'}/{Number.isFinite(f.e2) ? f.e2.toFixed(2) : '-'}
                </b>
                <span>เกณฑ์ 80/80</span>
              </div>
            </div>
            <p class="teacher-ttest" data-testid="ttest">
              {f.pre.n < T_FROM
                ? `t-test แบบไม่อิสระ: ต้องมีผู้เรียนที่ทำทั้งก่อนและหลังเรียนอย่างน้อย ${T_FROM} คน (ตอนนี้ ${f.pre.n} คน)`
                : t
                  ? `t-test แบบไม่อิสระ: t = ${t.t.toFixed(3)}, df = ${t.df}, p (ทางเดียว) ${t.p < 0.001 ? '< .001' : `= ${t.p.toFixed(3)}`} → ${sig ? 'คะแนนหลังเรียนสูงกว่าก่อนเรียนอย่างมีนัยสำคัญทางสถิติที่ระดับ .05' : 'คะแนนหลังเรียนสูงกว่าก่อนเรียนอย่างไม่มีนัยสำคัญที่ระดับ .05'}`
                  : 't-test แบบไม่อิสระ: คิดไม่ได้ (ทุกคนเพิ่มขึ้นเท่ากันพอดี)'}
            </p>
            <p class="teacher-note">
              E1 = ร้อยละเฉลี่ยของผลระหว่างเรียน (คำถามท้ายคลิปที่ตอบถูกครั้งแรก + ดาวรอบแรกของเกมเรียงขั้นตอนและเคส) · E2 = ร้อยละเฉลี่ยคะแนนหลังเรียน · คิดจากผู้ที่ทำแบบทดสอบหลังเรียนแล้ว
            </p>
            <table class="teacher-table">
              <thead>
                <tr>
                  <th>วัตถุประสงค์</th>
                  <th>ก่อนเรียน (ถูก %)</th>
                  <th>หลังเรียน (ถูก %)</th>
                </tr>
              </thead>
              <tbody>
                {f.objectives.map((o) => (
                  <tr key={o.objective}>
                    <th>
                      {o.objective}. {OBJECTIVE_TH[o.objective]}
                    </th>
                    <td>{pct(o.pre)}</td>
                    <td>{pct(o.post)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section class="teacher-box">
            <h2>รายคน</h2>
            <div class="teacher-scroll">
              <table class="teacher-table" data-testid="learners">
                <thead>
                  <tr>
                    <th>ชั้น</th>
                    <th>เลขที่</th>
                    <th>ชื่อ-สกุล</th>
                    <th>ก่อน</th>
                    <th>หลัง</th>
                    <th>±</th>
                    <th>ระหว่างเรียน</th>
                    <th>ทำครบ</th>
                    <th>ส่งล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {loaded.map((l) => {
                    const s = learnerSummary(l.data, RC);
                    const d = duringPercent(s);
                    return (
                      <tr key={`${l.data.learner!.room}-${l.data.learner!.no}`} class={l.edited ? 'edited' : ''}>
                        <td>{l.data.learner!.room}</td>
                        <td>{l.data.learner!.no}</td>
                        <td>{l.data.learner!.name}</td>
                        <td>{s.pre?.got ?? '-'}</td>
                        <td>{s.post?.got ?? '-'}</td>
                        <td>{s.pre && s.post ? s.post.got - s.pre.got : '-'}</td>
                        <td>{d === null ? '-' : pct(d)}</td>
                        <td>
                          {s.steps.got}/{s.steps.max}
                        </td>
                        <td>{l.exportedAt ? new Date(l.exportedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section class="teacher-box">
            <h2>วิเคราะห์ข้อสอบรายข้อ</h2>
            <p class="teacher-note">ข้อที่ตอบถูกหลังเรียนไม่ถึง 50% จะแสดงสีแดง ควรสอนซ้ำ</p>
            <div class="teacher-scroll">
              <table class="teacher-table" data-testid="items">
                <thead>
                  <tr>
                    <th>ข้อ</th>
                    <th>คำถาม</th>
                    <th>ก่อน</th>
                    <th>หลัง</th>
                    <th>ตัวเลือกผิดที่เลือกบ่อย (หลังเรียน)</th>
                  </tr>
                </thead>
                <tbody>
                  {f.items.map((it, i) => {
                    const item = RC.test[i]!;
                    return (
                      <tr key={it.id} class={it.post < 50 ? 'low' : ''}>
                        <td>
                          {i + 1}
                          <small> (วัตถุประสงค์ {it.objective})</small>
                        </td>
                        <td>{item.stemTh}</td>
                        <td>{pct(it.pre)}</td>
                        <td>{pct(it.post)}</td>
                        <td>{it.commonWrong ? `${LETTERS[it.commonWrong.choice]}. ${item.choicesTh[it.commonWrong.choice]} (${it.commonWrong.count} คน)` : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section class="teacher-box">
            <h2>ความพึงพอใจ</h2>
            <p class="teacher-note">เกณฑ์แปลผล: 4.51–5.00 มากที่สุด · 3.51–4.50 มาก · 2.51–3.50 ปานกลาง · 1.51–2.50 น้อย · 1.00–1.50 น้อยที่สุด</p>
            <div class="teacher-scroll">
              <table class="teacher-table" data-testid="satisfaction">
                <thead>
                  <tr>
                    <th>รายการ</th>
                    <th>x̄</th>
                    <th>S.D.</th>
                    <th>ระดับ</th>
                  </tr>
                </thead>
                <tbody>
                  {RC.reflect.groups.map((g, gi) => (
                    <Fragment key={g.id}>
                      <tr class="group">
                        <th>{g.th}</th>
                        <td>{n1(f.groups[gi]!.stat.mean)}</td>
                        <td>{n1(f.groups[gi]!.stat.sd)}</td>
                        <td>{f.groups[gi]!.reading}</td>
                      </tr>
                      {RC.reflect.satisfaction.map((s, si) =>
                        s.group === g.id ? (
                          <tr key={s.id}>
                            <td>{s.th}</td>
                            <td>{n1(f.satisfaction[si]!.stat.mean)}</td>
                            <td>{n1(f.satisfaction[si]!.stat.sd)}</td>
                            <td>{f.satisfaction[si]!.reading}</td>
                          </tr>
                        ) : null,
                      )}
                    </Fragment>
                  ))}
                  <tr class="overall">
                    <th>รวมทุกด้าน (ผู้ตอบ {ps.filter((p) => p.reflect).length} คน)</th>
                    <td data-testid="overall-mean">{n1(f.overall.stat.mean)}</td>
                    <td>{n1(f.overall.stat.sd)}</td>
                    <td>{f.overall.reading}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="teacher-box">
            <h2>ผู้เรียนประเมินตนเอง (1–5 ดาว)</h2>
            <table class="teacher-table">
              <tbody>
                {f.self.map((s) => (
                  <tr key={s.objective}>
                    <th>
                      {s.objective}. {OBJECTIVE_TH[s.objective]}
                    </th>
                    <td>x̄ {n1(s.stat.mean)}</td>
                    <td>S.D. {n1(s.stat.sd)}</td>
                    <td>{s.stat.n} คน</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section class="teacher-box">
            <h2>คำตอบที่ผู้เรียนเขียน</h2>
            {[...RC.reflect.write.map((w) => ({ id: w.id, th: w.th })), { id: '', th: RC.reflect.suggestTh }].map((q) => {
              const answers = loaded
                .map((l) => ({ no: l.data.learner!.no, text: (q.id ? l.data.reflect?.write[q.id] : l.data.reflect?.suggest) ?? '' }))
                .filter((a) => a.text.trim());
              return (
                <details key={q.th} class="teacher-writes" open>
                  <summary>
                    {q.th} ({answers.length})
                  </summary>
                  <ul>
                    {answers.map((a) => (
                      <li key={a.no}>
                        <b>เลขที่ {a.no}:</b> {a.text}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
