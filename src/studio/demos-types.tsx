// Clip 2's demonstrations (the kinds of operating system, docs/lessons-plan.md part 3): the real devices from
// ChatGPT's pictures with each kind's screen on them, drawn to look like the real systems but with no real logos.
// Like clip 1's (demos.tsx), each is drawn from p, how far through its run of lines the video is, and part, which
// of those lines is being said.

import type { ComponentChildren, CSSProperties } from 'preact';
import { Desktop } from '../ui/sim/Desktop';
import { Icon, on, prop, span, sprite, Tag, Tower, Win } from './parts';
import './demos-types.css';

/** A screen drawn at the full 620 x 350 and shrunk to `w` pixels wide, so the real-size desktops fit on any device. */
function Mini({ w, children, h = 350 }: { w: number; children: ComponentChildren; h?: number }) {
  const k = w / 620;
  return (
    <div class="t-mini" style={{ width: `${w}px`, height: `${h * k}px` }}>
      <div class="t-mini-in" style={{ height: `${h}px`, transform: `scale(${k})` }}>
        {children}
      </div>
    </div>
  );
}

/** Windows 11: the desktop the cases use. */
const WinScreen = () => (
  <div class="t-screen">
    <Desktop />
  </div>
);

/** Looks like macOS (menu bar on top, the dock below), without Apple's logo. */
function MacScreen() {
  return (
    <div class="t-screen t-mac">
      <div class="t-mac-bar">
        <b>●</b>
        <span>Finder</span>
        <span>ไฟล์</span>
        <span>แก้ไข</span>
        <span>มุมมอง</span>
        <span class="t-right">10:30</span>
      </div>
      <div class="t-mac-dock">
        {['#4b98f2', '#2ec4b6', '#ff7a3d', '#ffd23f', '#b07cd6', '#ff6b6b', '#9aa5b8'].map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

/** Looks like a Linux desktop (Ubuntu's colours, the dock on the left, the bar on top), no logo. */
function LinuxScreen() {
  return (
    <div class="t-screen t-linux">
      <div class="t-linux-bar">
        <span>กิจกรรม</span>
        <span>31 ต.ค. 10:30</span>
        <span>⏻</span>
      </div>
      <div class="t-linux-dock">
        {['#e95420', '#4b98f2', '#7bd65a', '#ffd23f', '#d8dee8'].map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
        <i class="t-grid" />
      </div>
    </div>
  );
}

/** A phone's home screen, Android-like (the three buttons at the bottom) or iOS-like (the dock and the home bar). */
function PhoneScreen({ kind }: { kind: 'android' | 'ios' }) {
  const colours = ['#4b98f2', '#2ec4b6', '#ff7a3d', '#ffd23f', '#b07cd6', '#ff6b6b', '#7bd65a', '#9aa5b8', '#1f8f86', '#c94b55', '#5aa8e6', '#d9a12b'];
  return (
    <div class={`t-phone-ui t-${kind}`}>
      <div class="t-status">
        <span>10:30</span>
        <span>▮▮▮ ▰</span>
      </div>
      {kind === 'android' && <div class="t-search" />}
      <div class="t-apps">
        {colours.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </div>
      {kind === 'ios' && (
        <div class="t-dock">
          {colours.slice(0, 4).map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </div>
      )}
      {kind === 'android' ? (
        <div class="t-nav">
          <span>◁</span>
          <span>○</span>
          <span>□</span>
        </div>
      ) : (
        <div class="t-home" />
      )}
    </div>
  );
}

/** ChatGPT's phone and tablet with a screen laid over their dark glass. */
function Phone({ kind, w = 90 }: { kind: 'android' | 'ios'; w?: number }) {
  return (
    <div class="t-phone" style={{ width: `${w}px` }}>
      <img src={prop('phone')} alt="" />
      <div class="t-glass">
        <PhoneScreen kind={kind} />
      </div>
    </div>
  );
}
function Tablet({ kind, w = 200 }: { kind: 'android' | 'ios'; w?: number }) {
  return (
    <div class="t-tablet" style={{ width: `${w}px` }}>
      <img src={prop('tablet')} alt="" />
      <div class="t-glass">
        <PhoneScreen kind={kind} />
      </div>
    </div>
  );
}

/** A laptop: a dark lid round the screen and the keyboard base under it. */
function Laptop({ w, children, lit = true }: { w: number; children: ComponentChildren; lit?: boolean }) {
  return (
    <div class={`t-laptop${lit ? '' : ' off'}`} style={{ width: `${w + 16}px` }}>
      <div class="t-lid">
        <Mini w={w}>{children}</Mini>
      </div>
      <div class="t-base" />
    </div>
  );
}
/** A desktop: the monitor on its stand and ChatGPT's tower beside it. */
function DesktopPc({ w, children }: { w: number; children: ComponentChildren }) {
  return (
    <div class="t-desktop-pc">
      <div class="t-monitor">
        <div class="t-lid">
          <Mini w={w}>{children}</Mini>
        </div>
        <div class="t-stand" />
      </div>
      <div class="t-tower">
        <Tower power />
      </div>
    </div>
  );
}

/** ChatGPT's server rack, its lights blinking. */
function Rack({ h = 200, time }: { h?: number; time: number }) {
  return <img src={prop('server-rack')} alt="" class="t-rack" style={{ height: `${h}px`, filter: `brightness(${Math.floor(time / 400) % 2 ? 1.18 : 1})` }} />;
}

/** A label above or below a device. */
const Label = ({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) => <span class={`t-label ${cls}`}>{children}</span>;

const KINDS = [
  { th: 'ส่วนบุคคล (PC)', ex: 'Windows 11 · macOS · Linux', c: 't-pc' },
  { th: 'อุปกรณ์เคลื่อนที่ (Mobile)', ex: 'Android · iOS', c: 't-mob' },
  { th: 'เครื่องแม่ข่าย (Server)', ex: 'Windows Server · Linux', c: 't-srv' },
];

/** The black screen of a Linux server, commands typed one after another (`k` of the way through). */
function Terminal({ k, time }: { k: number; time: number }) {
  const lines = [
    { t: 'admin@server:~$ systemctl status apache2', cmd: true },
    { t: '● apache2.service - เว็บเซิร์ฟเวอร์ (Web Server)' },
    { t: '   Active: active (running)', ok: true },
    { t: 'admin@server:~$ ls /srv/files', cmd: true },
    { t: 'งานบัญชี/  เอกสารออฟฟิศ/  รูปสินค้า/' },
    { t: 'admin@server:~$ ', cmd: true },
  ];
  const n = Math.max(1, Math.ceil(k * lines.length));
  return (
    <pre class="t-term">
      {lines.slice(0, n).map((l, i) => (
        <div key={i} class={l.ok ? 'ok' : l.cmd ? 'cmd' : ''}>
          {l.t}
          {i === n - 1 && Math.floor(time / 500) % 2 ? '▌' : ''}
        </div>
      ))}
    </pre>
  );
}

/** Looks like Windows Server's Server Manager: the roles this machine serves to the others. */
function ServerManager({ k }: { k: number }) {
  const tiles = [
    { th: 'บริการไฟล์ (File Services)', n: 'แชร์ 3 โฟลเดอร์' },
    { th: 'เว็บไซต์ (IIS)', n: 'ร้านซ่อมคอม' },
    { th: 'ผู้ใช้ที่เชื่อมต่อ', n: `${Math.round(4 + k * 8)} เครื่อง` },
  ];
  return (
    <div class="t-screen t-winserver">
      <Win title="ตัวจัดการเซิร์ฟเวอร์ (Server Manager)" icon="device" class="t-sm">
        <div class="t-sm-body">
          <div class="t-sm-side">
            <span class="on">แดชบอร์ด</span>
            <span>เซิร์ฟเวอร์นี้</span>
            <span>บริการไฟล์</span>
            <span>IIS</span>
          </div>
          <div class="t-sm-main">
            <b>ยินดีต้อนรับสู่ Windows Server</b>
            <div class="t-sm-tiles">
              {tiles.map((t) => (
                <div key={t.th}>
                  <span>{t.th}</span>
                  <small>● ทำงาน · {t.n}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Win>
    </div>
  );
}

/** A code editor: the open source code, one line being changed (`k` of the way typed). */
function CodeEditor({ k, locked }: { k: number; locked: boolean }) {
  const edit = 'printf("สวัสดี ร้านซ่อมคอม");';
  return (
    <div class={`t-code${locked ? ' locked' : ''}`}>
      <div class="t-code-bar">
        <Icon g="doc" />
        {locked ? 'ซอร์สโค้ด: ไม่เปิดเผย' : 'kernel/hello.c — โอเพนซอร์ส'}
      </div>
      {locked ? (
        <div class="t-code-locked">
          <img src={prop('app-lock')} alt="" />
          <span>เจ้าของเก็บซอร์สโค้ดไว้</span>
        </div>
      ) : (
        <ol>
          <li>
            <i>#include</i> &lt;stdio.h&gt;
          </li>
          <li>
            <i>int</i> main(void) {'{'}
          </li>
          <li class="t-edit">
            {'  '}
            {edit.slice(0, Math.round(edit.length * k))}
            <span class="t-caret" />
          </li>
          <li>{'  '}return 0;</li>
          <li>{'}'}</li>
        </ol>
      )}
    </div>
  );
}

export function TypesDemo({ id, p, part, time }: { id: string; p: number; part: number; time: number }) {
  switch (id) {
    case 'types-intro':
      // A laptop, a phone and a server rack, one after another: which operating system does each use?
      return (
        <div class="d-fill t-room t-row">
          <div class={`t-slot${on(p, 0.08)}`}>
            <Laptop w={170}>
              <WinScreen />
            </Laptop>
          </div>
          <div class={`t-slot${on(p, 0.3)}`}>
            <Phone kind="android" w={80} />
          </div>
          <div class={`t-slot${on(p, 0.52)}`}>
            <Rack h={190} time={time} />
          </div>
          {p >= 0.72 && <Tag style={{ left: '50%', top: '14px', transform: 'translateX(-50%)' }}>แต่ละเครื่องใช้ OS ประเภทไหน?</Tag>}
        </div>
      );

    case 'three-types': {
      // The three kinds by use, each with its devices; their examples come in at the end.
      const lit = Math.min(2, Math.floor(span(p, 0.08, 0.7) * 3));
      return (
        <div class="d-fill t-room t-three" data-step={p < 0.75 ? 'kinds' : 'examples'}>
          {KINDS.map((k, i) => (
            <div key={k.c} class={`t-kind ${k.c}${on(p, 0.08 + i * 0.2)}${i === lit && p < 0.75 ? ' now' : ''}`}>
              <b>{k.th}</b>
              <div class="t-kind-art">
                {i === 0 && (
                  <>
                    <Laptop w={104}>
                      <WinScreen />
                    </Laptop>
                    <div class="t-tower-sm">
                      <Tower power />
                    </div>
                  </>
                )}
                {i === 1 && (
                  <>
                    <Phone kind="android" w={54} />
                    <Tablet kind="ios" w={112} />
                  </>
                )}
                {i === 2 && <Rack h={170} time={time} />}
              </div>
              <span class={`t-ex${on(p, 0.75)}`}>{k.ex}</span>
            </div>
          ))}
        </div>
      );
    }

    case 'pc': {
      // Personal computers: a desktop and a laptop, both doing everyday work.
      return (
        <div class="d-fill t-room t-row" data-step={p < 0.45 ? 'desktop' : 'laptop'}>
          <div class={`t-slot${on(p, 0.05)}`}>
            <DesktopPc w={210}>
              <WinScreen />
            </DesktopPc>
            <Label>คอมพิวเตอร์ตั้งโต๊ะ</Label>
          </div>
          <div class={`t-slot${on(p, 0.45)}`}>
            <Laptop w={190}>
              <WinScreen />
            </Laptop>
            <Label>โน้ตบุ๊ก</Label>
          </div>
          {p >= 0.7 && <Tag style={{ left: '50%', top: '14px', transform: 'translateX(-50%)' }}>ใช้ทำงานทั่วไป · 1 คนใช้ 1 เครื่อง</Tag>}
        </div>
      );
    }

    case 'pc-os': {
      // Windows 11, then macOS, then Linux, each big on a laptop in turn; then the three together.
      const screens = [
        { name: 'Windows 11', s: <WinScreen /> },
        { name: 'macOS', s: <MacScreen /> },
        { name: 'Linux', s: <LinuxScreen /> },
      ];
      const one = part < 3 ? screens[part]! : null;
      return (
        <div class="d-fill t-room" data-step={one ? one.name : 'all'}>
          {one ? (
            <div class="t-one">
              <Laptop w={360}>{one.s}</Laptop>
              <Label class="big">{one.name}</Label>
            </div>
          ) : (
            <div class="t-row t-fill">
              {screens.map((s) => (
                <div key={s.name} class="t-slot on">
                  <Laptop w={150}>{s.s}</Laptop>
                  <Label>{s.name}</Label>
                </div>
              ))}
              <Tag style={{ left: '50%', top: '14px', transform: 'translateX(-50%)' }}>ทั้งหมดคือ OS ส่วนบุคคล (PC)</Tag>
            </div>
          )}
        </div>
      );
    }

    case 'mobile': {
      // A phone and a tablet; Android on one, iOS on the other; both go in the "mobile" box.
      const step = part === 0 ? 'devices' : part === 1 ? 'systems' : 'sorted';
      const named = part >= 1;
      return (
        <div class="d-fill t-room" data-step={step}>
          <div class={`t-row t-fill${step === 'sorted' ? ' t-boxed' : ''}`}>
            <div class="t-slot on">
              <Phone kind="android" w={110} />
              <Label>{named ? 'Android' : 'สมาร์ตโฟน'}</Label>
            </div>
            <div class={`t-slot${on(p, part === 0 ? 0.06 : 0)}`}>
              <Phone kind="ios" w={110} />
              <Label>{named ? 'iOS' : 'สมาร์ตโฟน'}</Label>
            </div>
            <div class={`t-slot${on(p, part === 0 ? 0.12 : 0)}`}>
              <Tablet kind={named ? 'ios' : 'android'} w={200} />
              <Label>{named ? 'iOS (แท็บเล็ต)' : 'แท็บเล็ต'}</Label>
            </div>
          </div>
          {step === 'sorted' && <Tag style={{ left: '50%', top: '10px', transform: 'translateX(-50%)' }}>อุปกรณ์เคลื่อนที่ (Mobile OS)</Tag>}
        </div>
      );
    }

    case 'server': {
      // One server serves the office: files and the website go out along the network to every PC.
      const k = (p * 3) % 1;
      const goods = ['ไฟล์', 'เว็บไซต์'];
      return (
        <div class="d-fill t-room t-net" data-step={p < 0.2 ? 'server' : 'serving'}>
          <div class="t-net-server">
            <Rack h={210} time={time} />
            <Label>เครื่องแม่ข่าย</Label>
          </div>
          <div class="t-net-office">
            {[0, 1, 2].map((i) => (
              <div key={i} class={`t-net-pc${on(p, 0.1 + i * 0.05)}`}>
                <img src={sprite('monitor')} alt="" />
                <span>เครื่อง {i + 1}</span>
              </div>
            ))}
          </div>
          <div class="t-net-lines">
            {[0, 1, 2].map((i) => (
              <i key={i} style={lineTo(i)} />
            ))}
          </div>
          {p >= 0.2 &&
            [0, 1, 2].map((i) => {
              const at = packet(i, (k + i * 0.33) % 1);
              const what = goods[(Math.floor(p * 3) + i) % 2]!;
              return (
                <span key={i} class="t-packet" style={at}>
                  <Icon g={what === 'ไฟล์' ? 'folder' : 'web'} />
                  {what}
                </span>
              );
            })}
        </div>
      );
    }

    case 'server-os': {
      // On the server's screen: Windows Server's manager, then a Linux server's terminal.
      const linux = part >= 1;
      return (
        <div class="d-fill t-room" data-step={linux ? 'linux' : 'windows'}>
          <div class="t-row t-fill">
            <Rack h={220} time={time} />
            <div class="t-console">
              <Mini w={380}>{linux ? <Terminal k={span(p, 0.5, 0.95)} time={time} /> : <ServerManager k={span(p, 0, 0.5)} />}</Mini>
              <Label class="big">{linux ? 'Linux สำหรับเซิร์ฟเวอร์' : 'Windows Server'}</Label>
            </div>
          </div>
        </div>
      );
    }

    case 'linux-both':
      // The same Linux on a laptop someone works on, and on a server that serves others: what decides is the use.
      return (
        <div class="d-fill t-room t-both">
          <div class={`t-slot${on(p, 0.08)}`}>
            <Laptop w={170}>
              <LinuxScreen />
            </Laptop>
            <Label>ส่วนบุคคล (PC)</Label>
          </div>
          <div class="t-mid">
            <span class="t-linux-name">Linux</span>
            <i class={`t-arrow left${on(p, 0.08)}`} />
            <i class={`t-arrow right${on(p, 0.35)}`} />
          </div>
          <div class={`t-slot${on(p, 0.35)}`}>
            <div class="t-rack-term">
              <Rack h={130} time={time} />
              <Mini w={118}>
                <Terminal k={1} time={time} />
              </Mini>
            </div>
            <Label>เครื่องแม่ข่าย (Server)</Label>
          </div>
          {p >= 0.62 && <Tag style={{ left: '50%', top: '12px', transform: 'translateX(-50%)' }}>ดู: ระบบที่ติดตั้ง + การใช้งาน</Tag>}
        </div>
      );

    case 'license': {
      // Open source: the code is there to read and change. Then Linux open beside Windows and macOS closed.
      const both = part >= 1;
      return (
        <div class="d-fill t-room" data-step={both ? 'compare' : 'open'}>
          {!both ? (
            <div class="t-one">
              <CodeEditor k={span(p, 0.15, 0.45)} locked={false} />
              <Tag style={{ left: '50%', bottom: '14px', transform: 'translateX(-50%)' }}>โอเพนซอร์ส: ศึกษา / ดัดแปลงได้ ตามสัญญาอนุญาต</Tag>
            </div>
          ) : (
            <div class="t-row t-fill t-licence">
              <div class="t-slot on">
                <b class="t-h open">โอเพนซอร์ส (Open Source)</b>
                <CodeEditor k={1} locked={false} />
                <Label>Linux</Label>
              </div>
              <div class={`t-slot${on(p, 0.62)}`}>
                <b class="t-h shut">กรรมสิทธิ์ (Proprietary)</b>
                <CodeEditor k={0} locked />
                <Label>Windows · macOS</Label>
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'two-ways': {
      // Two different ways of sorting, side by side: by use (three kinds) and by licence (two kinds).
      const dropped = Math.floor(span(p, 0.15, 0.8) * 5.99);
      const byUse = [
        ['Windows 11', 'macOS', 'Linux'],
        ['Android', 'iOS'],
        ['Windows Server', 'Linux'],
      ];
      return (
        <div class="d-fill t-room t-ways">
          <div class="t-way">
            <b>แบ่งตามการใช้งาน (3 ประเภท)</b>
            <div class="t-bins">
              {KINDS.map((k, i) => (
                <div key={k.c} class={`t-bin ${k.c}`}>
                  <span>{k.th}</span>
                  {dropped > i && byUse[i]!.map((n) => <small key={n}>{n}</small>)}
                </div>
              ))}
            </div>
          </div>
          <span class="t-neq">≠</span>
          <div class="t-way">
            <b>แบ่งตามสิทธิ์ซอฟต์แวร์</b>
            <div class="t-bins">
              <div class="t-bin open">
                <span>โอเพนซอร์ส</span>
                {dropped > 3 && <small>Linux</small>}
              </div>
              <div class="t-bin shut">
                <span>กรรมสิทธิ์</span>
                {dropped > 4 &&
                  ['Windows', 'macOS'].map((n) => (
                    <small key={n}>{n}</small>
                  ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'look-alike': {
      // Two towers that look the same; look at their screens: one is someone's PC, the other serves the office.
      const shown = p >= 0.18;
      const sorted = p >= 0.55;
      return (
        <div class="d-fill t-room t-alike" data-step={!shown ? 'same' : sorted ? 'sorted' : 'look'}>
          {[0, 1].map((i) => (
            <div key={i} class="t-alike-pc">
              <div class="t-alike-set">
                <div class="t-tower-md">
                  <Tower power />
                </div>
                <div class="t-monitor">
                  <div class="t-lid">
                    <Mini w={170}>{!shown ? <div class="t-screen t-black" /> : i === 0 ? <WinScreen /> : <Terminal k={1} time={time} />}</Mini>
                  </div>
                  <div class="t-stand" />
                </div>
              </div>
              <Label>{!shown ? `เครื่อง ${i === 0 ? 'ก' : 'ข'}` : i === 0 ? 'Windows 11 · ใช้ทำงาน' : 'Linux · ให้บริการไฟล์'}</Label>
              {sorted && <b class={`t-verdict ${i === 0 ? 't-pc' : 't-srv'}`}>{KINDS[i === 0 ? 0 : 2]!.th}</b>}
            </div>
          ))}
          {p >= 0.75 && <Tag style={{ left: '50%', top: '10px', transform: 'translateX(-50%)' }}>รูปร่างเหมือนกัน ≠ ประเภทเดียวกัน</Tag>}
        </div>
      );
    }
  }
  return null;
}

// The office network: the server on the left, three PCs on the right; the lines and the parcels between them.
const SERVER: [number, number] = [180, 150];
const PCS: [number, number][] = [
  [450, 56],
  [450, 133],
  [450, 210],
];
function lineTo(i: number): CSSProperties {
  const [x0, y0] = SERVER;
  const [x1, y1] = PCS[i]!;
  const len = Math.hypot(x1 - x0, y1 - y0);
  return { left: `${x0}px`, top: `${y0}px`, width: `${len}px`, transform: `rotate(${Math.atan2(y1 - y0, x1 - x0)}rad)` };
}
function packet(i: number, k: number): CSSProperties {
  const [x0, y0] = SERVER;
  const [x1, y1] = PCS[i]!;
  return { left: `${x0 + (x1 - x0) * k}px`, top: `${y0 + (y1 - y0) * k}px` };
}
