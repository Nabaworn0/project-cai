// What the screen in the middle of the lesson video shows while the senior talks (docs/lessons-plan.md, part 3):
// real programs at work on a Windows 11 desktop (Word, Task Manager, Device Manager, File Explorer, the lock screen)
// and the real things they drive, not boxes with words. Each demo is drawn from how far through it the video is,
// p from 0 to 1 (lines in a row with the same demo share one run of p), so any frame can be drawn on its own.
// The programs are HTML and CSS made to look like the real ones, with no real logos; the things you can touch
// (the PC, the printer, the hand) are ChatGPT's pictures once they are in src/assets/props (art-prompts 6.2),
// CSS stand-ins until then.

import type { ComponentChildren, CSSProperties } from 'preact';
import type { LESSON_DEMOS } from '../content/schema';
import { Desktop } from '../ui/sim/Desktop';
import '../ui/sim/sim.css';
import './demos.css';
import { TypesDemo } from './demos-types';
import { Cursor, glide, Hand, Icon, on, opening, prop, span, sprite, Tag, Toast, Tower, Win, type Glyph } from './parts';

export type DemoId = (typeof LESSON_DEMOS)[number];


export const REPORT = 'รายงานเรื่อง ระบบปฏิบัติการ\nระบบปฏิบัติการเป็นซอฟต์แวร์ระบบ ทำหน้าที่ควบคุมการทำงานของคอมพิวเตอร์';
/** The report typed so far. */
const typed = (p: number) => REPORT.slice(0, Math.round(REPORT.length * p));
const FILE = 'รายงาน OS.docx';

type WordView = { view: 'doc'; text: string; caret?: boolean } | { view: 'save'; name: string; pressed: boolean } | { view: 'print'; pressed: boolean };

/** Word, made to look like it (blue title bar, ribbon, the page) without its logo. File > Save As and File > Print
    are its "backstage" pages, as in the real one. */
function Word(props: { show: WordView; title?: string; class?: string; style?: CSSProperties; time: number }) {
  const s = props.show;
  return (
    <Win title={`${props.title ?? FILE} - Word`} icon="word" class={`d-word ${props.class ?? ''}`} style={props.style}>
      {s.view === 'doc' ? (
        <>
          <div class="d-ribbon">
            <div class="d-tabs">
              <span class="d-file-tab">ไฟล์</span>
              <span class="on">หน้าแรก</span>
              <span>แทรก</span>
              <span>เค้าโครง</span>
              <span>รีวิว</span>
            </div>
            <div class="d-tools">
              <span class="d-field">TH Sarabun New</span>
              <span class="d-field">16</span>
              <b>B</b>
              <i>I</i>
              <u>U</u>
              <span class="d-align">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
          <div class="d-desk">
            <div class="d-page">
              <p class="d-typed">
                {s.text}
                {s.caret && <span class={`d-caret${Math.floor(props.time / 500) % 2 ? ' off' : ''}`} />}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div class="d-back" data-view={s.view}>
          <div class="d-back-menu">
            <span>← กลับ</span>
            <span>ข้อมูล</span>
            <span>บันทึก</span>
            <span class={s.view === 'save' ? 'on' : ''}>บันทึกเป็น</span>
            <span class={s.view === 'print' ? 'on' : ''}>พิมพ์</span>
          </div>
          {s.view === 'save' ? (
            <div class="d-back-main">
              <h4>บันทึกเป็น (Save As)</h4>
              <div class="d-place">
                <Icon g="folder" />
                เอกสาร (Documents)
              </div>
              <div class="d-name">
                <span class="d-input">
                  {s.name}
                  <span class="d-caret" />
                </span>
                <span class="d-type">เอกสาร Word (*.docx)</span>
              </div>
              <span class={`d-btn${s.pressed ? ' pressed' : ''}`}>บันทึก</span>
            </div>
          ) : (
            <div class="d-back-main d-print-page">
              <div>
                <h4>พิมพ์ (Print)</h4>
                <span class={`d-bigbtn${s.pressed ? ' pressed' : ''}`}>
                  <Icon g="printer" />
                  พิมพ์
                </span>
                <p class="d-label">เครื่องพิมพ์</p>
                <div class="d-select">
                  <Icon g="printer" />
                  <span>
                    เครื่องพิมพ์ในร้าน
                    <small>พร้อม</small>
                  </span>
                </div>
                <p class="d-label">สำเนา 1 · ทุกหน้า</p>
              </div>
              <div class="d-preview">
                <p class="d-typed">{REPORT}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </Win>
  );
}

/** The printer: ChatGPT's picture or a stand-in, its light on when busy, the paper `paper` of the way out. */
function Printer({ paper, busy, class: cls = '' }: { paper: number; busy: boolean; class?: string }) {
  const art = prop('printer');
  return (
    <div class={`d-printer${busy ? ' busy' : ''} ${cls}`}>
      {art ? (
        <img src={art} alt="" class="d-printer-art" />
      ) : (
        <>
          <div class="d-printer-top" />
          <div class="d-printer-body">
            <i />
          </div>
        </>
      )}
      <div class="d-paper" style={{ height: `${Math.round(paper * 96)}px` }}>
        <p>{REPORT}</p>
      </div>
    </div>
  );
}

/** Desktop icons the demos add next to the Recycle Bin. */
function DeskIcon({ g, name, at, picked = false, locked = false }: { g: Glyph; name: string; at: [number, number]; picked?: boolean; locked?: boolean }) {
  return (
    <span class={`d-deskicon${picked ? ' picked' : ''}`} style={{ left: `${at[0]}px`, top: `${at[1]}px` }}>
      <Icon g={g} />
      {locked && <Icon g="lock" class="d-badge-lock" />}
      {name}
    </span>
  );
}

/** A small web browser with a page, and a music player: the other programs that run beside Word. */
function Browser({ style }: { style: CSSProperties }) {
  return (
    <Win title="ร้านซ่อมคอม - เว็บเบราว์เซอร์" icon="web" class="d-browser" style={style}>
      <div class="d-url">https://ร้านซ่อมคอม.example</div>
      <div class="d-site">
        <i class="d-site-head" />
        <i />
        <i />
        <i class="d-site-pic" />
      </div>
    </Win>
  );
}
function Music({ style, time }: { style: CSSProperties; time: number }) {
  return (
    <Win title="เครื่องเล่นเพลง" icon="music" class="d-music" style={style}>
      <div class="d-song">
        <i class="d-cover" />
        <span>
          <b>เพลงระหว่างทำงาน</b>
          <span class="d-progress">
            <i style={{ width: `${((time / 120) % 100).toFixed(1)}%` }} />
          </span>
        </span>
      </div>
    </Win>
  );
}

/** Task Manager's frame: the side bar of its pages, one of them open. */
function TaskMgr({ page, children }: { page: 'processes' | 'memory'; children: ComponentChildren }) {
  return (
    <Win title="ตัวจัดการงาน (Task Manager)" icon="taskmgr" class="d-tm">
      <div class="d-tm-side">
        <i class={page === 'processes' ? 'on' : ''}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 4h10M3 8h10M3 12h10" />
          </svg>
        </i>
        <i class={page === 'memory' ? 'on' : ''}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 12l3-4 3 2 5-6" />
          </svg>
        </i>
      </div>
      <div class="d-tm-main">{children}</div>
    </Win>
  );
}

const APPS = [
  { name: 'Word', g: 'word' as Glyph, c: 'c-word' },
  { name: 'เว็บเบราว์เซอร์', g: 'web' as Glyph, c: 'c-web' },
  { name: 'เครื่องเล่นเพลง', g: 'music' as Glyph, c: 'c-music' },
];

/** The CPU graph: the last 40 moments, a little busier while a program has its turn. Drawn from `time` alone. */
function cpuLine(time: number) {
  const pts: string[] = [];
  for (let i = 0; i < 40; i++) {
    const t = time / 120 - 39 + i;
    const v = 38 + 18 * Math.sin(t * 0.7) + 10 * Math.sin(t * 2.3 + 1);
    pts.push(`${(i / 39) * 100},${100 - v}`);
  }
  return pts.join(' ');
}

const FUNCTIONS: { th: string; en: string; g: Glyph; example: string }[] = [
  { th: 'ประมวลผล', en: 'Process', g: 'cpu', example: 'แบ่ง CPU ให้โปรแกรม' },
  { th: 'หน่วยความจำ', en: 'Memory', g: 'ram', example: 'จองและคืน RAM' },
  { th: 'อุปกรณ์', en: 'Device', g: 'printer', example: 'ไดรเวอร์เครื่องพิมพ์' },
  { th: 'ไฟล์', en: 'File', g: 'folder', example: 'บันทึก / เปิดไฟล์' },
  { th: 'ผู้ใช้', en: 'User & Security', g: 'lock', example: 'PIN / สิทธิ์เข้าถึง' },
];

export function Demo({ id, p, part, time }: { id: DemoId; p: number; part: number; time: number }) {
  switch (id) {
    case 'welcome':
      return (
        <div class="d-fill d-welcome">
          <Desktop />
          <div class={`d-badge${on(p, 0.15)}`}>ร้านซ่อมคอม</div>
          {p >= 0.55 && <Tag style={{ left: '50%', top: '62%', transform: 'translateX(-50%)' }}>วันนี้: ระบบปฏิบัติการ (Operating System)</Tag>}
        </div>
      );

    case 'os-core': {
      // Programs open one after another on Windows; then what holds them all is pointed out.
      const step = p < 0.15 ? 'empty' : p < 0.35 ? 'word' : p < 0.55 ? 'web' : p < 0.75 ? 'music' : 'os';
      return (
        <div class="d-fill" data-step={step}>
          <Desktop />
          {p >= 0.15 && <Word show={{ view: 'doc', text: REPORT }} class="d-cascade0" style={opening(p, 0.15)} time={time} />}
          {p >= 0.35 && <Browser style={opening(p, 0.35)} />}
          {p >= 0.55 && <Music style={opening(p, 0.55)} time={time} />}
          {step === 'os' && (
            <>
              <i class="d-ring" style={{ left: '4px', top: '4px', right: '4px', bottom: '4px' }} />
              <Tag style={{ left: '50%', bottom: '58px', transform: 'translateX(-50%)' }}>Windows 11 = ระบบปฏิบัติการ ควบคุมทั้งเครื่อง</Tag>
            </>
          )}
        </div>
      );
    }

    case 'layers': {
      // The user clicks, the program asks Windows, Windows drives the parts, and the answer comes back up.
      const rows = [
        { th: 'ผู้ใช้ (User)', cls: 'user' },
        { th: 'โปรแกรม (Application)', cls: 'apps' },
        { th: 'ระบบปฏิบัติการ (OS)', cls: 'os-row' },
        { th: 'ฮาร์ดแวร์ (Hardware)', cls: 'hw-row' },
      ];
      const trip = (p * 3) % 1;
      const down = trip < 0.5;
      const y = down ? trip * 2 : 2 - trip * 2;
      return (
        <div class="d-fill d-dark d-layers">
          {rows.map((r, i) => (
            <div key={r.cls} class={`d-layer d-${r.cls}${on(p, 0.05 + i * 0.12)}`}>
              <span class="d-layer-name">{r.th}</span>
              <span class="d-layer-art">
                {r.cls === 'user' && <img src={sprite('tech-neutral')} alt="" class="d-layer-intern" />}
                {r.cls === 'apps' &&
                  APPS.map((a) => (
                    <span key={a.name} class="d-chipname">
                      <Icon g={a.g} />
                      {a.name}
                    </span>
                  ))}
                {r.cls === 'os-row' && (
                  <span class="d-chipname">
                    <span class="d-winlogo">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    Windows 11
                  </span>
                )}
                {r.cls === 'hw-row' && (
                  <>
                    {['icon-cpu', 'icon-ram', 'icon-ssd', 'monitor'].map((n) => (
                      <img key={n} src={sprite(n)} alt="" />
                    ))}
                    {['dev-keyboard', 'dev-mouse', 'printer'].map((n) => {
                      const art = prop(n);
                      return art ? <img key={n} src={art} alt="" class={`d-${n}`} /> : n === 'printer' ? <Icon key={n} g="printer" class="d-hw-printer" /> : null;
                    })}
                  </>
                )}
              </span>
            </div>
          ))}
          {p > 0.5 && (
            <span class="d-packet d-layer-packet" style={{ top: `${6 + y * 74}%` }}>
              {down ? 'คำสั่ง ↓' : 'ผลลัพธ์ ↑'}
            </span>
          )}
        </div>
      );
    }

    case 'boot': {
      const stage = p < 0.12 ? 'off' : p < 0.4 ? 'post' : p < 0.68 ? 'loading' : 'desktop';
      return (
        <div class="d-fill d-boot" data-stage={stage}>
          {stage === 'off' && (
            <div class="d-power">
              <img src={sprite('monitor')} alt="" class="d-power-monitor" />
              <Tower power={p > 0.07} />
              <Hand at={p > 0.06 ? [458, 122] : [476, 146]} press={p > 0.06} />
              <p>กดปุ่มเปิดเครื่อง (Power)</p>
            </div>
          )}
          {stage === 'post' && (
            <pre class="d-post">
              {['BIOS v2.1  ตรวจสอบฮาร์ดแวร์…', 'CPU ........ OK', 'Memory 8 GB  OK', 'SSD 512 GB . OK', 'กำลังเริ่มระบบปฏิบัติการ…']
                .slice(0, 1 + Math.floor(span(p, 0.12, 0.38) * 4))
                .join('\n')}
            </pre>
          )}
          {stage === 'loading' && (
            <div class="d-loading">
              <div class="d-winlogo big">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div class="d-spin">
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} class={i === Math.floor(time / 150) % 5 ? 'on' : ''} />
                ))}
              </div>
              <p>ระบบปฏิบัติการกำลังเริ่มทำงาน</p>
            </div>
          )}
          {stage === 'desktop' && <Desktop />}
        </div>
      );
    }

    case 'app':
      return (
        <div class="d-fill">
          <Desktop />
          {p >= 0.08 && <Word show={{ view: 'doc', text: typed(span(p, 0.18, 0.95)), caret: true }} class="d-full" style={opening(p, 0.08)} time={time} />}
        </div>
      );

    case 'os-vs-app': {
      // Word does one job; Windows runs the whole machine; and it is Windows that lets Word use the parts.
      const step = p < 0.35 ? 'app' : p < 0.65 ? 'os' : 'bridge';
      const flow = Math.floor(time / 90) % 12;
      return (
        <div class="d-fill" data-step={step}>
          <Desktop />
          <Word show={{ view: 'doc', text: REPORT }} class={`d-cascade0${step === 'app' ? '' : ' dim'}`} time={time} />
          {step === 'app' && <Tag style={{ left: '330px', top: '40px' }}>โปรแกรมประยุกต์: ทำรายงาน</Tag>}
          {step !== 'app' && <i class="d-ring" style={{ left: '4px', top: '4px', right: '4px', bottom: '4px' }} />}
          {step === 'os' && <Tag style={{ left: '50%', bottom: '58px', transform: 'translateX(-50%)' }}>ระบบปฏิบัติการ: จัดการทั้งเครื่อง</Tag>}
          {step === 'bridge' && (
            <div class="d-bridge">
              <span class="d-bridge-from">
                <Icon g="word" />
                Word
              </span>
              <span class="d-bridge-line" style={{ backgroundPositionX: `${flow * 4}px` }} />
              <span class="d-bridge-os">
                <span class="d-winlogo">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                Windows
              </span>
              <span class="d-bridge-line" style={{ backgroundPositionX: `${flow * 4}px` }} />
              <span class="d-bridge-hw">
                {['icon-cpu', 'icon-ram', 'icon-ssd'].map((n) => (
                  <img key={n} src={sprite(n)} alt="" />
                ))}
                <Icon g="printer" />
              </span>
            </div>
          )}
        </div>
      );
    }

    case 'cpu': {
      // Three programs take turns on the CPU, a slice each, round and round; Task Manager shows whose turn it is.
      const slice = Math.floor(p * 18);
      const turn = slice % 3;
      const busy = p > 0.08;
      return (
        <div class="d-fill">
          <Desktop />
          <TaskMgr page="processes">
            <h4>กระบวนการ (Processes)</h4>
            <div class="d-tm-cols">
              <table class="d-proc">
                <thead>
                  <tr>
                    <th>ชื่อ</th>
                    <th>CPU</th>
                  </tr>
                </thead>
                <tbody>
                  {APPS.map((a, i) => (
                    <tr key={a.name} class={busy && i === turn ? 'hot' : ''}>
                      <td>
                        <Icon g={a.g} />
                        {a.name}
                      </td>
                      <td>{busy ? (i === turn ? 31 + ((slice * 7) % 15) : 1 + ((slice + i) % 3)) : 0}%</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <span class="d-winlogo small">
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                      Windows (ระบบ)
                    </td>
                    <td>2%</td>
                  </tr>
                </tbody>
              </table>
              <div class="d-graph">
                <span>CPU</span>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline points={cpuLine(time)} />
                </svg>
              </div>
            </div>
            <p class="d-label">ลำดับที่ OS ให้แต่ละโปรแกรมใช้ CPU</p>
            <div class="d-slices">
              {Array.from({ length: Math.min(18, slice + 1) }, (_, i) => (
                <i key={i} class={APPS[i % 3]!.c} />
              ))}
            </div>
          </TaskMgr>
        </div>
      );
    }

    case 'memory': {
      // Programs open and Windows gives each a part of the RAM; the browser closes and its part comes back.
      const opened = Math.floor(span(p, 0.08, 0.6) * 3.99);
      const closed = p > 0.75;
      const owner = [0, 0, 1, 1, 1, 2, 2, -1, -1, -1].map((a) => (a >= 0 && a < opened && !(closed && a === 1) ? a : -1));
      const gb = [1.6, 2.4, 1.6];
      const used = 1.6 + gb.reduce((s, g, i) => s + (i < opened && !(closed && i === 1) ? g : 0), 0);
      return (
        <div class="d-fill">
          <Desktop />
          <TaskMgr page="memory">
            <h4>
              หน่วยความจำ (Memory) <small>ใช้ไป {used.toFixed(1)} จาก 8 GB</small>
            </h4>
            <div class="d-cells">
              <i class="c-sys" />
              {owner.map((a, i) => (
                <i key={i} class={a >= 0 ? APPS[a]!.c : 'free'} />
              ))}
            </div>
            <table class="d-proc">
              <tbody>
                <tr>
                  <td>
                    <span class="d-sw c-sys" />
                    Windows (ระบบ)
                  </td>
                  <td>1.6 GB</td>
                </tr>
                {APPS.map((a, i) =>
                  i < opened ? (
                    <tr key={a.name} class={closed && i === 1 ? 'gone' : ''}>
                      <td>
                        <span class={`d-sw ${a.c}`} />
                        {a.name}
                        {closed && i === 1 && ' (ปิดแล้ว)'}
                      </td>
                      <td>{closed && i === 1 ? '0 GB' : `${gb[i]} GB`}</td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </TaskMgr>
          <Tag style={{ left: '50%', bottom: '58px', transform: 'translateX(-50%)' }}>
            {closed ? 'ปิดโปรแกรม OS คืนหน่วยความจำ' : 'เปิดโปรแกรม OS จองหน่วยความจำให้'}
          </Tag>
        </div>
      );
    }

    case 'driver': {
      // A printer is plugged in; Windows finds it and installs its driver; then a page goes through the driver to it.
      const step = p < 0.15 ? 'plug' : p < 0.5 ? 'install' : p < 0.58 ? 'ready' : 'send';
      const k = span(p, 0.6, 0.92);
      return (
        <div class="d-fill" data-step={step}>
          <Desktop />
          <Win title="ตัวจัดการอุปกรณ์ (Device Manager)" icon="device" class="d-devmgr">
            <ul class="d-tree">
              <li>▾ เครื่องในร้าน (DESKTOP-SHOP)</li>
              <li class="d-sub">› จอแสดงผล</li>
              <li class="d-sub">› แป้นพิมพ์</li>
              <li class="d-sub">› เมาส์</li>
              <li class="d-sub">▾ เครื่องพิมพ์ (Printers)</li>
              <li class={`d-sub2${step === 'plug' || step === 'install' ? ' warn' : ''}`}>
                {step === 'plug' || step === 'install' ? (
                  <>
                    <b>⚠</b> อุปกรณ์ที่ไม่รู้จัก
                  </>
                ) : (
                  <>
                    <Icon g="printer" /> เครื่องพิมพ์ในร้าน
                  </>
                )}
              </li>
            </ul>
            {step === 'install' && (
              <div class="d-dialog">
                <b>กำลังติดตั้งไดรเวอร์ (Driver)…</b>
                <span class="d-bar">
                  <i style={{ width: `${Math.round(span(p, 0.18, 0.47) * 100)}%` }} />
                </span>
              </div>
            )}
          </Win>
          <div class="d-cable">
            <span class={`d-driver${step === 'send' && k > 0.35 && k < 0.65 ? ' busy' : ''}`}>ไดรเวอร์</span>
            {step === 'send' && (
              <span class={`d-packet d-job${k > 0.5 ? ' raw' : ''}`} style={{ left: `${Math.round(k * 100)}%` }}>
                {k > 0.5 ? 'ภาษาเครื่องพิมพ์' : 'รายงาน'}
              </span>
            )}
          </div>
          <Printer paper={0} busy={step === 'send' && k >= 1} class="d-devprinter" />
          {step === 'plug' && p > 0.06 && <Toast icon="device" title="พบอุปกรณ์ใหม่" text="กำลังตั้งค่าเครื่องพิมพ์" />}
          {step === 'ready' && <Toast icon="printer" title="เครื่องพิมพ์ในร้าน" text="พร้อมใช้งานแล้ว ✓" />}
        </div>
      );
    }

    case 'files': {
      // Save: File > Save As > Save. Then find the file in File Explorer and open it again.
      const step = p < 0.1 ? 'doc' : p < 0.42 ? 'save' : p < 0.5 ? 'saved' : p < 0.8 ? 'explorer' : 'open';
      const name = 'รายงาน OS'.slice(0, Math.round(span(p, 0.13, 0.28) * 9));
      const picked = p > 0.68;
      const cursor: [number, number] =
        step === 'doc'
          ? glide(span(p, 0, 0.08), [300, 200], [56, 52])
          : step === 'save'
            ? glide(span(p, 0.29, 0.36), [300, 140], [175, 196])
            : glide(span(p, 0.52, 0.66), [480, 250], [200, 116]);
      return (
        <div class="d-fill" data-step={step}>
          <Desktop />
          {(step === 'doc' || step === 'save' || step === 'saved') && (
            <Word
              show={step === 'save' ? { view: 'save', name, pressed: p > 0.36 } : { view: 'doc', text: REPORT }}
              title={step === 'saved' ? FILE : 'เอกสาร1'}
              class="d-full"
              time={time}
            />
          )}
          {step === 'saved' && <Toast icon="doc" title="บันทึกแล้ว" text={`${FILE} ในเอกสาร`} />}
          {step === 'explorer' && (
            <Win title="เอกสาร - File Explorer" icon="folder" class="d-explorer" style={opening(p, 0.5)}>
              <div class="d-ex-side">
                <span>หน้าแรก</span>
                <span>เดสก์ท็อป</span>
                <span class="on">
                  <Icon g="folder" />
                  เอกสาร
                </span>
                <span>รูปภาพ</span>
              </div>
              <div class="d-ex-main">
                <div class="d-ex-path">› พีซีเครื่องนี้ › เอกสาร (Documents)</div>
                {[
                  { n: 'งานกลุ่ม.docx', d: '28/10/2026' },
                  { n: FILE, d: 'วันนี้ 10:31', mine: true },
                  { n: 'ใบเสนอราคา.docx', d: '20/10/2026' },
                ].map((f) => (
                  <div key={f.n} class={`d-ex-row${f.mine && picked ? ' picked' : ''}${f.mine ? ' new' : ''}`}>
                    <Icon g="doc" />
                    <span>{f.n}</span>
                    <small>{f.d}</small>
                  </div>
                ))}
              </div>
            </Win>
          )}
          {step === 'open' && <Word show={{ view: 'doc', text: REPORT, caret: true }} title={FILE} class="d-full" style={opening(p, 0.8)} time={time} />}
          {step !== 'open' && step !== 'saved' && (
            <Cursor at={cursor} down={(step === 'doc' && p > 0.08) || (step === 'save' && p > 0.36) || (step === 'explorer' && picked)} />
          )}
          {step === 'explorer' && picked && <Tag style={{ left: '50%', bottom: '58px', transform: 'translateX(-50%)' }}>ดับเบิลคลิก เปิดไฟล์อีกครั้ง</Tag>}
        </div>
      );
    }

    case 'login': {
      // The lock screen: a PIN, then in; and a folder this user may not open.
      const step = p < 0.12 ? 'lock' : p < 0.55 ? 'pin' : p < 0.72 ? 'welcome' : 'desktop';
      const dots = Math.floor(span(p, 0.18, 0.5) * 6);
      const denied = p > 0.84;
      return (
        <div class="d-fill" data-step={step}>
          <Desktop />
          {step !== 'desktop' && (
            <div class="d-lockscreen">
              {step === 'lock' ? (
                <>
                  <b class="d-clock">10:30</b>
                  <span>วันเสาร์ที่ 31 ตุลาคม</span>
                </>
              ) : (
                <>
                  <span class="d-avatar">
                    <img src={sprite('tech-neutral')} alt="" />
                  </span>
                  <b class="d-uname">เด็กฝึกงาน</b>
                  {step === 'pin' ? (
                    <span class="d-pin">{'●'.repeat(dots) || 'PIN'}</span>
                  ) : (
                    <span class="d-welcome-msg">
                      ยินดีต้อนรับ
                      <span class="d-spin">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <i key={i} class={i === Math.floor(time / 150) % 5 ? 'on' : ''} />
                        ))}
                      </span>
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          {step === 'desktop' && (
            <>
              <DeskIcon g="folder" name="งานของพี่ช่าง" at={[96, 10]} locked picked={p > 0.8} />
              <Cursor at={glide(span(p, 0.74, 0.8), [400, 250], [120, 30])} down={p > 0.8 && p < 0.84} />
              {denied && (
                <Win title="งานของพี่ช่าง" icon="lock" class="d-denied">
                  <p>
                    <Icon g="lock" />
                    คุณไม่มีสิทธิ์เข้าถึงโฟลเดอร์นี้
                  </p>
                  <span class="d-btn">ตกลง</span>
                </Win>
              )}
            </>
          )}
          {(step === 'pin' || denied) && (
            <Tag style={{ left: '50%', bottom: step === 'pin' ? '14px' : '58px', transform: 'translateX(-50%)' }}>
              {denied ? 'OS ดูแลว่าใครเข้าถึงข้อมูลอะไรได้' : 'OS ตรวจว่าใครเข้าใช้เครื่อง'}
            </Tag>
          )}
        </div>
      );
    }

    case 'print': {
      // The finished report; File > Print > Print; the job goes Word → Windows → driver → printer; out comes the paper.
      const step = p < 0.3 ? 'doc' : p < 0.45 ? 'print' : p < 0.72 ? 'send' : 'paper';
      const k = span(p, 0.47, 0.7);
      return (
        <div class="d-fill" data-step={step}>
          <Desktop />
          {step === 'doc' && (
            <>
              <Word show={{ view: 'doc', text: REPORT }} class="d-full" time={time} />
              <Cursor at={glide(span(p, 0.12, 0.26), [330, 220], [56, 52])} down={p > 0.26} />
            </>
          )}
          {step === 'print' && (
            <>
              <Word show={{ view: 'print', pressed: p > 0.41 }} class="d-full" time={time} />
              <Cursor at={glide(span(p, 0.3, 0.4), [300, 220], [180, 110])} down={p > 0.41} />
            </>
          )}
          {step === 'send' && (
            <div class="d-chain">
              <Toast icon="printer" title="กำลังพิมพ์" text={`${FILE} → เครื่องพิมพ์ในร้าน`} />
              <div class="d-path">
                {[
                  { name: 'Word', node: <Icon g="word" /> },
                  {
                    name: 'Windows',
                    node: (
                      <span class="d-winlogo">
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    ),
                  },
                  { name: 'ไดรเวอร์', node: <Icon g="device" /> },
                  { name: 'เครื่องพิมพ์', node: <Icon g="printer" /> },
                ].map((s, i) => (
                  <div key={s.name} class={`d-stop${k * 3 >= i - 0.05 ? ' on' : ''}${Math.round(k * 3) === i ? ' here' : ''}`}>
                    <b>{s.node}</b>
                    <span>{s.name}</span>
                  </div>
                ))}
                <div class="d-track">
                  <span class="d-packet" style={{ left: `${Math.round(k * 100)}%` }}>
                    สั่งพิมพ์
                  </span>
                </div>
              </div>
            </div>
          )}
          {step === 'paper' && (
            <div class="d-printroom">
              <Printer paper={span(p, 0.74, 0.97)} busy class="d-big" />
            </div>
          )}
        </div>
      );
    }

    case 'no-boot': {
      // The BIOS looks for something to start from, finds no operating system, and gives up.
      const search = ['ค้นหาอุปกรณ์บูต…', 'USB ........ ไม่พบ', 'SSD ........ ไม่มีระบบปฏิบัติการ'];
      return (
        <pre class="d-fill d-nob" data-stage={p < 0.45 ? 'search' : 'error'}>
          {p < 0.45
            ? search.slice(0, 1 + Math.floor(span(p, 0, 0.4) * 2.99)).join('\n')
            : 'Reboot and Select proper Boot device\nor Insert Boot Media in selected Boot device and press a key'}
          {Math.floor(time / 500) % 2 ? '_' : ' '}
        </pre>
      );
    }

    case 'functions': {
      const now = Math.min(4, Math.floor(span(p, 0.05, 0.9) * 5));
      return (
        <div class="d-fill d-dark d-functions">
          {FUNCTIONS.map((f, i) => {
            const art = prop(`fn-${i + 1}`);
            return (
              <div key={f.th} class={`d-fn${on(p, 0.05 + i * 0.17)}${i === now ? ' now' : ''}`}>
                <b class="d-fn-num">{i + 1}</b>
                {art ? <img src={art} alt="" /> : <Icon g={f.g} class="d-fn-ico" />}
                <span class="d-fn-th">{f.th}</span>
                <small>{f.en}</small>
                <span class="d-fn-ex">{f.example}</span>
              </div>
            );
          })}
        </div>
      );
    }
    default:
      return <TypesDemo id={id} p={p} part={part} time={time} />;
  }
}
