// Content viewer tab "หน้าจอจำลอง": open the simulated screens on their own, without playing a case.
// Rufus starts with Beam's stick (case 2); the stick it writes can then be booted on a PC, so every
// case 2 route (right, MBR again, wrong image, CSM) can be tried and shown to a teacher. Lung Chai's PC
// (case 3) opens Windows 11 Setup with his MBR disk, to try the partition page and its traps. Ton's PC (case 4)
// has TPM (and optionally Secure Boot) turned off in the BIOS: Setup says "This PC can't run Windows 11".
// Teacher Wilai's lab PC (case 5) came in legacy with an MBR disk; it boots the stick from Rufus, and after the
// install goes on to Windows' first-time setup and the desktop (or straight to first-time setup, to try it).

import { useState } from 'preact/hooks';
import { healthyMachine, type Machine } from '../core/machine';
import { confirmBackup, insertUsb, powerOn, type Pc } from '../core/pc';
import { openOobe } from '../core/oobe';
import { openRufus, type Usb } from '../core/rufus';
import type { Brand } from '../content/schema';
import { PcScreen } from '../ui/sim/PcScreen';
import { RufusScreen } from '../ui/sim/RufusScreen';

/** Beam's stick as he brought it: Windows 11, but made MBR from an old video. */
const BEAM_USB: Usb = { scheme: 'mbr', os: 'win11', label: 'CCCOMA_X64FRE_TH-TH_DV9', bypassChecks: false };

const OS_TH: Record<Usb['os'], string> = { win11: 'Windows 11', win10: 'Windows 10', ubuntu: 'Ubuntu', empty: 'ว่าง (ถูกลบใน Setup)' };

export function SimLab({ brand }: { brand: Brand }) {
  const [usb, setUsb] = useState<Usb>(BEAM_USB);
  const [csm, setCsm] = useState(false);
  const [open, setOpen] = useState<'rufus' | 'pc' | 'chai' | 'ton' | 'wilai' | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [sbOff, setSbOff] = useState(false);
  const [oobeNow, setOobeNow] = useState(false);

  // A UEFI PC like Beam's; "CSM on" stands for the BIOS trap (legacy boot allowed).
  const machine: Machine = { ...healthyMachine(brand.id), bootMode: csm ? 'legacy' : 'uefi', secureBoot: !csm };
  // It came in with UEFI either way: the player turned CSM on, so a legacy boot counts as a mistake (unlike case 5).
  const labStart = { ...powerOn(machine), arrivedIn: 'uefi' as const };
  // Lung Chai's PC: UEFI, the USB first already, a 500 GB MBR disk with his old Windows (case 3).
  const chai: Machine = { ...healthyMachine(brand.id), storageGB: 500, diskStyle: 'mbr', diskHasData: true, productKey: !noKey };
  const chaiStart = backedUp ? confirmBackup(powerOn(chai)) : powerOn(chai);
  const ton: Machine = { ...healthyMachine(brand.id), ramGB: 16, storageGB: 512, cpu: 'Intel Core i5-10400', tpmEnabled: false, secureBoot: !sbOff };
  // Teacher Wilai's lab PC: legacy (CSM on), Secure Boot off, a 256 GB MBR disk with Windows 10, Windows 11 Pro on the ticket.
  const wilai: Machine = {
    ...healthyMachine(brand.id),
    bootMode: 'legacy',
    secureBoot: false,
    diskStyle: 'mbr',
    diskHasData: true,
    cpu: 'Intel Core i5-8500',
    windowsEdition: 'Windows 11 Pro',
  };
  const wilaiStart: Pc = oobeNow
    ? (() => {
        // Windows 11 Pro just installed on a UEFI PC: the screen opens on first-time setup.
        const fresh = openOobe('Windows 11 Pro');
        const pc = powerOn({ ...wilai, bootMode: 'uefi', secureBoot: true, diskStyle: 'gpt', diskHasData: false, usbFirst: false });
        return { ...pc, fresh, screen: { kind: 'oobe', oobe: fresh } };
      })()
    : insertUsb(powerOn(wilai), usb);

  return (
    <section>
      <h2>หน้าจอจำลอง</h2>
      <p>ลองหน้าจอแต่ละแบบได้โดยไม่ต้องเล่นเคส · ทำ USB ใน Rufus แล้วเอาไปบูตเครื่องเพื่อดูผลของแต่ละทาง (เคส 2)</p>
      <div class="v-simlab">
        <div class="v-card">
          <h3>1. โน้ตบุ๊กของร้าน: Rufus</h3>
          <p data-testid="lab-usb">
            USB ตอนนี้: <b>{usb.scheme.toUpperCase()}</b> · {OS_TH[usb.os]}
            {usb.bypassChecks && ' · ยกเลิกการตรวจ TPM/Secure Boot'}
          </p>
          <div class="v-simlab-actions">
            <button type="button" class="btn small" onClick={() => setOpen('rufus')}>
              เปิด Rufus
            </button>
            <button type="button" class="btn ghost small" onClick={() => setUsb(BEAM_USB)}>
              คืน USB ของน้องบีม
            </button>
          </div>
        </div>
        <div class="v-card">
          <h3>2. เครื่องลูกค้า (BIOS คลาสสิก, UEFI)</h3>
          <label class="v-simlab-check">
            <input type="checkbox" checked={csm} onChange={() => setCsm(!csm)} /> เปิด CSM Support ไว้แล้ว (กับดักเคส 2)
          </label>
          <div class="v-simlab-actions">
            <button type="button" class="btn small" onClick={() => setOpen('pc')}>
              บูตด้วย USB นี้
            </button>
          </div>
        </div>
        <div class="v-card">
          <h3>3. เครื่องลุงชัย: Windows 11 Setup (เคส 3)</h3>
          <p>UEFI · ดิสก์ 500 GB แบบ MBR มี Windows เดิม · USB ติดตั้งถูกต้องและบูตก่อนแล้ว</p>
          <label class="v-simlab-check">
            <input type="checkbox" checked={noKey} onChange={() => setNoKey(!noKey)} /> ลูกค้าไม่มี Product Key
          </label>
          <label class="v-simlab-check">
            <input type="checkbox" checked={backedUp} onChange={() => setBackedUp(!backedUp)} /> ถามลูกค้าแล้วว่าสำรองข้อมูลไว้
          </label>
          <div class="v-simlab-actions">
            <button type="button" class="btn small" onClick={() => setOpen('chai')}>
              เปิดเครื่องลุงชัย
            </button>
          </div>
        </div>
        <div class="v-card">
          <h3>4. เครื่องพี่ต้น: ลง Windows 11 ไม่ผ่าน (เคส 4)</h3>
          <p>i5-10400 · RAM 16 GB · SSD 512 GB · TPM ปิดอยู่ใน BIOS · USB ถูกต้องและบูตก่อนแล้ว</p>
          <label class="v-simlab-check">
            <input type="checkbox" checked={sbOff} onChange={() => setSbOff(!sbOff)} /> Secure Boot ปิดด้วย
          </label>
          <div class="v-simlab-actions">
            <button type="button" class="btn small" onClick={() => setOpen('ton')}>
              เปิดเครื่องพี่ต้น
            </button>
          </div>
        </div>
        <div class="v-card">
          <h3>5. เครื่องครูวิไล: ลงจนถึงเดสก์ท็อป (เคส 5)</h3>
          <p>Legacy (CSM) · Secure Boot ปิด · ดิสก์ MBR มี Windows 10 · บูตด้วย USB จากข้อ 1 · ติดตั้งเสร็จแล้วต่อด้วยหน้าตั้งค่าเริ่มต้น</p>
          <label class="v-simlab-check">
            <input type="checkbox" checked={oobeNow} onChange={() => setOobeNow(!oobeNow)} /> ข้ามไปหน้าตั้งค่าเริ่มต้นเลย (ติดตั้งเสร็จแล้ว)
          </label>
          <div class="v-simlab-actions">
            <button type="button" class="btn small" onClick={() => setOpen('wilai')}>
              เปิดเครื่องครูวิไล
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div class="v-sim-overlay">
          {open === 'rufus' && <RufusScreen initial={openRufus(usb)} onEffect={(e) => setUsb(e.usb)} onClose={() => setOpen(null)} />}
          {open === 'pc' && <PcScreen brand={brand} machine={machine} initial={insertUsb(labStart, usb)} onClose={() => setOpen(null)} />}
          {open === 'chai' && <PcScreen brand={brand} machine={chai} initial={chaiStart} goal="install" onClose={() => setOpen(null)} />}
          {open === 'ton' && <PcScreen brand={brand} machine={ton} onClose={() => setOpen(null)} />}
          {open === 'wilai' && (
            <PcScreen brand={brand} machine={wilai} initial={wilaiStart} goal="desktop" customerName="ครูวิไล" onClose={() => setOpen(null)} />
          )}
        </div>
      )}
    </section>
  );
}
