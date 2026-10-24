// The work ticket: what the customer's PC is and what they want (case1-plan stage 2).
// Shows symptoms only, never the hidden cause.

import type { GeneratedCase } from '../../core/cases';

export function TicketCard({ gc, customerName }: { gc: GeneratedCase; customerName: string }) {
  const m = gc.machine;
  return (
    <div class="ticket" role="group" aria-label="ใบรับงาน">
      <div class="ticket-head">
        ใบรับงาน · <b>{customerName}</b>
      </div>
      <dl>
        <dt>อาการ</dt>
        <dd>{gc.problems.map((p) => p.symptomTh).join(' · ')}</dd>
        <dt>เครื่อง</dt>
        <dd>
          {m.cpu} · RAM {m.ramGB} GB · SSD {m.storageGB} GB
        </dd>
        <dt>BIOS</dt>
        <dd>{gc.brand.name}</dd>
        <dt>ต้องการ</dt>
        <dd>ลง Windows 11</dd>
        <dt>ไฟล์ลูกค้า</dt>
        <dd>{gc.template.customer.keepData ? 'ต้องเก็บไว้ ห้ามลบ' : 'สำรองไว้แล้ว ลบได้'}</dd>
      </dl>
    </div>
  );
}
