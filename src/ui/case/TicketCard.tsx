// The work ticket: what the customer's PC is and what they want (case1-plan stage 2).
// Shows symptoms only, never the hidden cause.

import type { GeneratedCase } from '../../core/cases';

export function TicketCard({ gc, customerName }: { gc: GeneratedCase; customerName: string }) {
  const m = gc.machine;
  // Installing to the end (case 3 on): Setup asks for a key and, without one, the edition.
  const install = gc.template.goal !== 'setup';
  const c = gc.template.customer;
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
        {/* The stick is part of the job (case 2 remakes it); what is wrong with it is for the player to find. */}
        <dt>ของที่ได้มา</dt>
        <dd>แฟลชไดรฟ์ติดตั้ง 16 GB ที่ลูกค้านำมา</dd>
        {install && (
          <>
            <dt>{gc.template.goal === 'desktop' ? 'รุ่นที่จะลง' : 'Windows เดิม'}</dt>
            <dd>{m.windowsEdition}</dd>
            <dt>Product Key</dt>
            <dd>{m.productKey ? 'มี (สติกเกอร์ใต้เครื่อง)' : 'ลูกค้าไม่ได้นำมา'}</dd>
          </>
        )}
        {gc.template.deviceName && (
          <>
            <dt>ชื่อเครื่อง</dt>
            <dd>{gc.template.deviceName} (ตั้งตอนตั้งค่าเริ่มต้น)</dd>
          </>
        )}
        <dt>ไฟล์ลูกค้า</dt>
        {/* When the disk will be wiped, the customer's word is not the same as asking before deleting. */}
        <dd>
          {c.keepData
            ? 'ต้องเก็บไว้ ห้ามลบ'
            : c.filesNotNeeded
              ? 'ลูกค้าบอกตอนเข้าร้านว่าไม่ต้องเก็บ ลบได้เลย'
              : install && m.diskHasData
                ? 'ลูกค้าบอกว่าสำรองไว้แล้ว'
                : 'สำรองไว้แล้ว ลบได้'}
        </dd>
      </dl>
    </div>
  );
}
