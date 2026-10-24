// Content viewer tab "หน้าจอจำลอง": open the simulated screens on their own, without playing a case.
// Rufus starts with Beam's stick (case 2); the stick it writes can then be booted on a PC, so every
// case 2 route (right, MBR again, wrong image, CSM) can be tried and shown to a teacher.

import { useState } from 'preact/hooks';
import { healthyMachine, type Machine } from '../core/machine';
import { insertUsb, powerOn } from '../core/pc';
import { openRufus, type Usb } from '../core/rufus';
import type { Brand } from '../content/schema';
import { PcScreen } from '../ui/sim/PcScreen';
import { RufusScreen } from '../ui/sim/RufusScreen';

/** Beam's stick as he brought it: Windows 11, but made MBR from an old video. */
const BEAM_USB: Usb = { scheme: 'mbr', os: 'win11', label: 'CCCOMA_X64FRE_TH-TH_DV9', bypassChecks: false };

const OS_TH: Record<Usb['os'], string> = { win11: 'Windows 11', win10: 'Windows 10', ubuntu: 'Ubuntu' };

export function SimLab({ brand }: { brand: Brand }) {
  const [usb, setUsb] = useState<Usb>(BEAM_USB);
  const [csm, setCsm] = useState(false);
  const [open, setOpen] = useState<'rufus' | 'pc' | null>(null);

  // A UEFI PC like Beam's; "CSM on" stands for the BIOS trap (legacy boot allowed).
  const machine: Machine = { ...healthyMachine(brand.id), bootMode: csm ? 'legacy' : 'uefi', secureBoot: !csm };

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
      </div>

      {open && (
        <div class="v-sim-overlay">
          {open === 'rufus' ? (
            <RufusScreen initial={openRufus(usb)} onEffect={(e) => setUsb(e.usb)} onClose={() => setOpen(null)} />
          ) : (
            <PcScreen brand={brand} machine={machine} initial={insertUsb(powerOn(machine), usb)} onClose={() => setOpen(null)} />
          )}
        </div>
      )}
    </section>
  );
}
