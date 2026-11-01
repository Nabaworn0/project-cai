# Prompt ให้ ChatGPT: สมุดช่าง (การ์ดความรู้ 16 ใบ)

มี 2 ส่วน: (1) ข้อความบนการ์ด เป็น JSON ชุดเดียว (2) ไอคอน pixel art การ์ดละ 1 ภาพ
แผน: docs/book-plan.md · ตอนนี้ในเกมเป็นร่างของ Claude (`src/content/data/cards.json`)

## 1. ข้อความบนการ์ด

คัดลอกทั้งกล่องไปวางใน ChatGPT แล้วนำ JSON ที่ได้มาให้ Claude ใส่ในเกม

```
ช่วยเขียนเนื้อหา "การ์ดความรู้" 16 ใบ สำหรับ "สมุดช่าง" ในเกมสอนติดตั้ง Windows 11 ของนักเรียน ปวช. (วิชา 21910-2001)
ผู้เล่นเป็นเด็กฝึกงานในร้านซ่อมคอม การ์ดได้มาเมื่อเรียนจบแต่ละเรื่อง ใช้เปิดทบทวนเวลาลืม

กติกา
- ภาษาไทยง่าย สั้น ตรง สำหรับ ปวช. ศัพท์และชื่อเมนูเขียนภาษาอังกฤษตามจริง เช่น BIOS, UEFI, CSM, GPT, MBR, TPM 2.0, Secure Boot, Rufus, F10
- ข้อมูลต้องถูกต้องตามจริง (ข้อกำหนด Windows 11: RAM 4 GB, ดิสก์ 64 GB, UEFI + Secure Boot, TPM 2.0, CPU ที่รองรับ)
- name ไม่เกิน 28 ตัวอักษร · summary ไม่เกิน 110 · points ข้อละไม่เกิน 110 ใบละ 3–4 ข้อ
- ห้ามเปลี่ยน id ห้ามเพิ่มหรือลดการ์ด ตอบเป็น JSON อย่างเดียว

การ์ด (id: หัวข้อ · ได้จาก · เนื้อหาที่ต้องมี)
1. os-jobs: หน้าที่ของระบบปฏิบัติการ · คลิปบทเรียน 1 · ตัวกลางผู้ใช้-โปรแกรม-ฮาร์ดแวร์, จัดการ CPU, RAM, อุปกรณ์ผ่านไดรเวอร์, ไฟล์
2. os-types: ประเภทของระบบปฏิบัติการ · คลิปบทเรียน 2 · แบ่งตามอุปกรณ์: คอมพิวเตอร์, เซิร์ฟเวอร์, มือถือ, ระบบฝังตัว พร้อมตัวอย่าง
3. os-license: แบบมีลิขสิทธิ์กับแบบเปิด · คลิปบทเรียน 2 · Windows ต้องมีลิขสิทธิ์, Linux โอเพนซอร์สฟรี, คีย์เถื่อนผิดกฎหมายและเสี่ยงไวรัส
4. backup: สำรองข้อมูลก่อนลง · เคส 3 · ลบพาร์ทิชันแล้วไฟล์หาย ถามลูกค้าก่อน สำรองลงที่ไหนได้ ได้คำยืนยันก่อนลบ
5. win11-req: ข้อกำหนด Windows 11 · เคส 4 · สเปกขั้นต่ำ และถ้าขึ้น "This PC can't run Windows 11" ให้อ่านเหตุผลแล้วแก้ทีละข้อ
6. tpm: ชิป TPM 2.0 · เคส 4 · คืออะไร, อยู่ที่ไหน (PTT ของ Intel, fTPM ของ AMD), เปิดใน BIOS แล้วกด F10
7. secure-boot: Secure Boot · เคส 4 · คืออะไร, ใช้ได้เมื่อบูตแบบ UEFI, Windows 11 บังคับ
8. boot-order: ลำดับบูตและ F10 · เคส 1 · เข้า BIOS, Boot Device Priority ให้ USB ขึ้นก่อน, F10 บันทึก (Esc ไม่บันทึก)
9. boot-menu: Boot Menu · เคส 1 · กดแป้นตอนเปิดเครื่อง เลือก USB ครั้งเดียว ไม่แก้ค่าใน BIOS
10. rufus: ทำ USB ด้วย Rufus · เคส 2 · Device, Boot selection (ISO Windows 11), Partition scheme, START
11. gpt-mbr: GPT กับ MBR · เคส 2 · GPT คู่กับ UEFI, MBR คู่กับ BIOS เก่า, Windows 11 ต้องใช้ GPT ทั้ง USB และดิสก์
12. uefi-csm: UEFI, Legacy และ CSM · เคส 5 · CSM คือโหมด Legacy, Windows 11 ต้องปิด CSM, ปิดแล้วของเดิมที่เป็น MBR บูตไม่ได้
13. install-steps: ลำดับขั้นติดตั้ง · เกมเรียงขั้นตอน · ตรวจสเปก+สำรอง → ทำ USB → บูต → Setup → ตั้งค่าครั้งแรก → อัปเดต/ไดรเวอร์
14. partitions: พาร์ทิชันใน Setup · เคส 3 · ดูขนาดดิสก์ให้ตรง, แฟลชไดรฟ์ก็อยู่ในรายการ ห้ามลบ, Unallocated Space แล้ว Next
15. product-key: Product Key และรุ่น Windows · เคส 3 · ไม่มีคีย์กด "I don't have a product key", เลือกรุ่นให้ตรงเดิม, Activate ทีหลังใน Settings
16. first-setup: ตั้งค่าครั้งแรก · เคส 5 · Thailand + แป้นพิมพ์ไทย, บัญชีและ PIN ลูกค้าพิมพ์เอง, ช่างไม่ถามรหัสผ่าน, ความเป็นส่วนตัวให้ลูกค้าเลือก

โครง JSON:
{
  "cards": {
    "os-jobs": { "name": "", "summary": "", "points": ["", "", ""] },
    ... (ครบ 16 id ตามรายการข้างบน)
  }
}
```

## 2. ไอคอนการ์ด (การ์ดละ 1 ภาพ)

ภาพแรกสั่งด้วยกล่อง 2.1 พอได้ภาพที่ชอบแล้ว ภาพที่ 2–16 ให้**แนบภาพแรกไปด้วยทุกครั้ง** เพื่อให้สไตล์ตรงกัน

### 2.1 สไตล์ (ใช้ทุกภาพ เปลี่ยนแค่ [SUBJECT])

```
A single 16-bit pixel-art icon, 32 x 32 art pixels, drawn big and centred on a square canvas with a transparent
background. Chunky 1-pixel dark navy outline (#1b2a4a), flat colours from this palette only: navy #1b2a4a,
teal #2ec4b6, yellow #ffd23f, coral #ff6b6b, cream #fff4e0, white, light grey. No anti-aliasing, no gradients,
no shadow on the ground, no text, no letters, no numbers, no logos, no brand marks.
Subject: [SUBJECT]
```

ถ้าภาพไม่ใช่พื้นโปร่งใส ไม่เป็นไร Claude ลบพื้นให้ได้ ขอแค่พื้นเป็นสีเดียวเรียบๆ

### 2.2 รายการภาพ (บันทึกตามชื่อไฟล์ในตาราง ลงโฟลเดอร์ `art-source/cards/`)

| ไฟล์ | [SUBJECT] |
|---|---|
| `os-jobs.png` | a small computer chip in the middle with four arrows going out to a mouse, a memory stick, a folder and a monitor |
| `os-types.png` | a desktop monitor, a smartphone and a small server tower standing side by side |
| `os-license.png` | a golden key crossing a small open padlock |
| `backup.png` | a folder with an arrow pointing into an external hard drive |
| `win11-req.png` | a clipboard checklist with three tick marks |
| `tpm.png` | a square security chip on a green circuit board with a small padlock on it |
| `secure-boot.png` | a shield with a tick mark in front of a power button |
| `boot-order.png` | a vertical list of three slots, the top slot glowing teal holding a USB flash drive, a hard drive below it |
| `boot-menu.png` | a USB flash drive with a yellow lightning bolt |
| `rufus.png` | a USB flash drive being filled by a disc image (a shiny disc) with a down arrow |
| `gpt-mbr.png` | two hard drives side by side, one teal (new) and one grey (old), with a swap arrow between them |
| `uefi-csm.png` | a motherboard settings gear with a toggle switch turned off |
| `install-steps.png` | a staircase of four blocks with a small flag on the top step |
| `partitions.png` | a hard drive split into three coloured slices, one slice being cut away |
| `product-key.png` | a small price-tag shaped licence card with a key on it |
| `first-setup.png` | a user silhouette with a small padlock and a speech bubble with a tick |

**ได้ครบ 16 ภาพแล้ว** บอก Claude (Claude ย่อเป็น pixel art ขนาดเกม ตัดพื้น และใส่ลงสมุดช่าง)
