# ข้อความบนหน้าจอจริง (ใช้สร้างหน้าจอจำลอง)

สืบค้นเมื่อ 24 ต.ค. 2026 แทนการถ่ายภาพจากห้องแล็บ · ใช้คู่กับ [phase1-cases.md](phase1-cases.md) ข้อ 6
หน้าจอจำลองต้อง **ใช้ข้อความภาษาอังกฤษตามของจริงทุกตัวอักษร** (นักเรียนต้องจำหน้าจอจริงได้) ส่วนคำอธิบายภาษาไทยอยู่ในกล่องคำใบ้ข้างๆ

ระดับความมั่นใจ: ✅ ยืนยันจากแหล่งข้อมูล · ⚠️ จากความรู้ทั่วไป ยังไม่เจอแหล่งยืนยันคำต่อคำ (ถ้าครูเปิดเครื่องจริงแล้วต่าง ให้แก้ตามเครื่องจริง)

ข้อมูลจากครู (24 ต.ค. 2026): **เครื่องในแล็บลง Windows 11 ได้ทุกเครื่อง**

---

## 1. Rufus (ทำ USB ติดตั้ง) ✅

ที่มา: ไฟล์ข้อความของโปรแกรมเอง [`res/loc/rufus.loc`](https://github.com/pbatard/rufus/blob/master/res/loc/rufus.loc) · รุ่นล่าสุด 4.15 (30 มิ.ย. 2026)
Rufus เปลี่ยนเป็นภาษาไทยเองถ้า Windows เป็นภาษาไทย (คำแปลไทยรุ่น 4.14) **ทำหน้าจอจำลองให้สลับได้ทั้ง 2 ภาษา**

| ส่วน | อังกฤษ | ไทย |
|---|---|---|
| หัวข้อ | Drive Properties | คุณสมบัติของไดรฟ์ |
| ช่อง | Device | อุปกรณ์ |
| ช่อง | Boot selection | ตัวเลือกการบูต |
| ค่าใน Boot selection | Disk or ISO image (Please select) | อิมเมจไฟล์ (กรุณาเลือก) |
| ปุ่ม | SELECT | เลือก |
| ช่อง | Partition scheme | รูปแบบของพาร์ติชัน |
| ค่า | MBR · GPT | MBR · GPT |
| ช่อง | Target system | รูปแบบเครื่องเป้าหมาย |
| ค่า (ขึ้นกับ Partition scheme) | BIOS (or UEFI-CSM) · UEFI (non CSM) | BIOS (หรือ UEFI-CSM) · UEFI (non CSM) |
| ลิงก์ | Show advanced drive properties | แสดง คุณสมบัติไดรฟ์ขั้นสูง |
| หัวข้อ | Format Options | ตัวเลือกการฟอร์แมต |
| ช่อง | Volume label · File system · Cluster size | ชื่อของไดรฟ์ · ระบบไฟล์ · ขนาดของคลัสเตอร์ |
| หัวข้อ / สถานะ | Status · READY | สถานะ · READY |
| ปุ่ม | START · CLOSE | เริ่ม · ปิด |
| คำเตือน | WARNING: ALL DATA ON DEVICE '…' WILL BE DESTROYED. | โปรดระวัง: ข้อมูลทั้งหมดบนอุปกรณ์ '…' จะถูกลบทิ้งทั้งหมด |

- เลือก GPT แล้ว Target system เหลือแค่ **UEFI (non CSM)** · เลือก MBR ได้ **BIOS (or UEFI-CSM)**
- **หนังสือ น.47 ใช้ Rufus รุ่นเก่า** ซึ่งรวมสองช่องนี้เป็นตัวเลือกเดียว (เช่น "MBR Partition scheme for BIOS or UEFI") บทเรียนต้องบอกว่ารุ่นปัจจุบันแยกเป็น 2 ช่อง

**กล่อง Windows User Experience** (ขึ้นหลังกด START กับไฟล์ Windows 11)

| อังกฤษ | ไทย |
|---|---|
| Customize Windows installation? | ต้องการปรับแต่งขั้นตอนการติดตั้ง Windows หรือไม่? |
| Remove requirement for 4GB+ RAM, Secure Boot and TPM 2.0 | ยกเลิกการตรวจสอบ: แรมขนาด 4 GB ขึ้นไป, Secure Boot และ TPM 2.0 |
| Remove requirement for an online Microsoft account | ยกเลิกการบังคับใช้บัญชี Microsoft |
| Create a local account with username: | สร้างบัญชีผู้ใช้ด้วยชื่อผู้ใช้: |
| Set regional options to the same values as this user's | ตั้งค่าภูมิภาคให้ตรงกับค่าที่ใช้บนคอมพิวเตอร์เครื่องนี้ |
| Disable data collection (Skip privacy questions) | ยกเลิกการเก็บข้อมูลผู้ใช้ (ข้ามคำถามเกี่ยวกับความเป็นส่วนตัว) |
| Disable BitLocker automatic device encryption | ยกเลิกการใช้ BitLocker เข้ารหัสอุปกรณ์อัตโนมัติ |

> ข้อเสนอสำหรับเกม: ข้อแรก (ข้ามการตรวจ TPM/Secure Boot) **ไม่ควรเป็นคำตอบที่ถูก** ในเคส 4 เพราะเครื่องรองรับอยู่แล้ว แค่ปิดไว้ใน BIOS
> ใช้เป็นกับดักได้: เลือกแล้วติดตั้งผ่าน แต่เสียคะแนน พร้อมคำอธิบายว่าเปิดใน BIOS ปลอดภัยกว่า

## 2. BIOS คลาสสิก (AMIBIOS 8 ตามหนังสือ น.48–51)

ลำดับตามหนังสือ ✅: กด **F2** → ลูกศรไปแท็บ **Boot** → **Boot Device Priority** → **Hard Disk Drives** → **1st Drive** → เลือก USB → Enter → กลับมาเห็น USB เป็นอันดับแรก → **F10** → เลือก **OK** → Enter

| ส่วน | ข้อความ | ความมั่นใจ |
|---|---|---|
| หัวจอ | BIOS SETUP UTILITY | ✅ ([parkytowers](https://www.parkytowers.me.uk/thin/rangee/lt360/firmware.shtml), AMIBIOS 08.00.15) |
| แท็บ | Main · Advanced · PCIPnP · Boot · Security · Chipset · Exit | ⚠️ (style guide เดิมเขียน Main/Advanced/Power/Boot/Security/Exit ลำดับขึ้นกับยี่ห้อเมนบอร์ด) |
| เมนูย่อยในแท็บ Boot | Boot Settings Configuration · Boot Device Priority · Hard Disk Drives · Removable Drives · CD/DVD Drives | ✅ ชื่อ Boot Device Priority / Hard Disk Drives / 1st Drive ตามหนังสือ · ที่เหลือ ⚠️ |
| ใน Boot Device Priority | 1st Boot Device · 2nd Boot Device · 3rd Boot Device | ✅ หนังสือ |
| คำอธิบายปุ่ม (ขวาล่าง) | ←→ Select Screen · ↑↓ Select Item · Enter Go to Sub Screen · F1 General Help · F10 Save and Exit · ESC Exit | ⚠️ |
| กล่องตอนกด F10 | Save configuration changes and exit setup? [Ok] [Cancel] | ⚠️ (หนังสือยืนยันแค่ว่ามีปุ่ม OK) |
| สี | พื้นเทา ตัวหนังสือน้ำเงิน แถบเมนูน้ำเงิน | ⚠️ ตามภาพในหนังสือ |

- เมนู CSM / Secure Boot / TPM ไม่มีใน AMIBIOS 8 (ปี 2008 ก่อนมี Windows 11) ในเกมใส่ไว้เพราะเคส 4–5 ต้องใช้ ชื่อเมนูใช้แบบ BIOS รุ่นใหม่ (Aptio) ได้แก่ **CSM Support** (Boot) · **Secure Boot** (Security) · **Security Device Support** หรือ TPM (Advanced > Trusted Computing) ⚠️
  ชื่อเหล่านี้ต่างกันตามยี่ห้อ บทเรียนควรบอกว่า "ชื่ออาจไม่ตรง ให้หาคำว่า CSM / Secure Boot / TPM / PTT / fTPM" ([ที่มา](https://forums.tomsguide.com/threads/aptio-setup-utility.123540/))

**Boot Menu (เลือกบูตครั้งเดียว)** ⚠️ ปุ่มต่างกันตามยี่ห้อ (F8, F11, F12, Esc) · กล่องเล็กกลางจอ หัวข้อ **Please select boot device:** รายชื่ออุปกรณ์ เช่น `UEFI: <ชื่อแฟลชไดรฟ์>` และ `Windows Boot Manager`
บรรทัดล่าง: `↑ and ↓ to move selection` · `ENTER to select boot device` · `ESC to boot using defaults`
- คำว่า **UEFI:** หน้าชื่อ USB สำคัญสำหรับเคส 2 (USB ที่ทำแบบ MBR/BIOS จะไม่มีรายการ UEFI ให้เลือกบนเครื่องที่ปิด CSM) ✅ ([ที่มา](https://forums.anandtech.com/threads/uefi-options-and-non-booting-usb-stick.2562957))

## 3. ตัวติดตั้ง Windows 11 (Setup แบบใหม่ ตั้งแต่ 24H2)

ตั้งแต่รุ่น 24H2 (ปี 2024) หน้าตา Setup เปลี่ยนจากที่หนังสือใช้ (หนังสือ น.52–56 เป็น Windows 10: Install now → Custom) **เกมใช้แบบใหม่** เพราะเป็นของที่นักเรียนเจอจริง และบทเรียนไม่พูดถึงหน้าจอ Windows 10 ในหนังสือ (ตัดสินใจ 24 ต.ค. 2026)

| ลำดับ | หัวจอ | ข้อความ / ปุ่ม | ความมั่นใจ |
|---|---|---|---|
| 0 | (จอดำ) | Press any key to boot from CD or DVD.... (ขึ้นไม่กี่วินาที ถ้าไม่กดจะบูตเข้า Windows เดิม) | ✅ มีหน้าจอนี้ ([pureinfotech](https://pureinfotech.com/clean-install-windows-11-24h2/)) · ⚠️ ข้อความคำต่อคำ |
| 1 | Select language settings | Language to install · Time and currency format · Next | ✅ ([Thurrott](https://www.thurrott.com/books/windows-11-field-guide/archived-22h2/311213/step-by-step-windows-11-setup-first-boot-experience-24h2)) |
| 2 | Select keyboard settings | Keyboard or input method · Next | ✅ |
| 3 | Select setup option | Install Windows 11 · Repair my PC · ช่องติ๊ก "I agree everything will be deleted including files, apps, and settings" · ลิงก์ Previous version of Setup | ✅ ชื่อตัวเลือก · ⚠️ ข้อความช่องติ๊กเต็มประโยค |
| 4 | Product key | ช่องกรอกคีย์ · ลิงก์ **I don't have a product key** · Next | ✅ |
| 5 | Select image | รายชื่อรุ่น (Windows 11 Home, Pro, …) · Next | ⚠️ ชื่อหัวจอ |
| 6 | Applicable notices and license terms | Accept · Decline | ⚠️ ชื่อหัวจอ · ✅ ปุ่ม Accept |
| 7 | **Select location to install Windows 11** | รายการ Disk 0 / Disk 1 · Partition 1, 2… · **Unallocated Space** · ปุ่ม **Refresh · Load Driver · Delete · Format** · Next | ✅ ([Microsoft Q&A 2025](https://learn.microsoft.com/en-us/answers/questions/3883268/select-location-to-install-windows-11), [2026](https://learn.microsoft.com/en-us/answers/questions/5847352/windows-11-clean-install-no-disk-0-unallocated-spa)) |
| 8 | Ready to install | Install | ✅ |
| 9 | Installing Windows 11 | แถบความคืบหน้า แล้วรีสตาร์ต | ✅ |

**จุดสำคัญของหน้าเลือกพาร์ทิชัน (ใช้ในเคส 3 และ 5)** ✅
- ตอนติดตั้งจาก USB **แฟลชไดรฟ์มักเป็น Disk 0** (เช่น `Disk 0 Partition 1: ESD-USB`) และดิสก์ในเครื่องเป็น **Disk 1** ([ที่มา](https://learn.microsoft.com/en-us/answers/questions/5847352/windows-11-clean-install-no-disk-0-unallocated-spa))
  → **กับดักใหม่ที่ดีมาก:** ถ้านักเรียนลบพาร์ทิชันของ USB = ลบตัวติดตั้งทิ้ง ต้องดูขนาดดิสก์ก่อนลบ
- วิธีถูก: ลบพาร์ทิชันของดิสก์ในเครื่องทีละอันด้วย **Delete** (ไม่ใช่ Format) จนเหลือ **Unallocated Space** อันเดียว → เลือก → Next (Setup สร้างพาร์ทิชันระบบให้เอง)
- ถ้าไม่เห็นดิสก์ในเครื่องเลย ต้องใช้ **Load Driver** (ไดรเวอร์ Intel RST) เชื่อมกับบทไดรเวอร์ในรอบ 2 ได้

**หน้า "เครื่องนี้ลง Windows 11 ไม่ได้"** (ใช้ในเคส 4) ⚠️ ไม่เจอแหล่งที่ยกข้อความหน้าจอของ Setup แบบใหม่คำต่อคำ
- หัวจอ: **This PC can't run Windows 11**
- ข้อความ: This PC doesn't meet the minimum system requirements to install this version of Windows. (Setup แบบเก่า) · Setup แบบใหม่บอกเหตุผลเป็นข้อ เช่น "The PC must support TPM 2.0." / "The PC must support Secure Boot."
- ขึ้นหลังหน้าเลือกภาษาและก่อนหน้าเลือกพาร์ทิชัน ปุ่มเดียวคือ Back
- **วิธีตรวจกับเครื่องจริง (ถ้าครูสะดวก 5 นาที):** ปิด TPM ใน BIOS ของเครื่องแล็บ 1 เครื่อง → บูต USB Windows 11 → ถ่ายรูปหน้านี้ → เปิด TPM คืน

## 4. ที่ยังต่างจากเครื่องในแล็บได้

- **ยี่ห้อ BIOS ของเครื่องแล็บ** ยังไม่รู้ ตอนนี้เกมใช้ AMIBIOS ตามหนังสือ ถ้าครูบอกยี่ห้อเมนบอร์ดหรือรุ่นเครื่องได้ ผมหาคู่มือมาเทียบได้
- **ภาษาของ ISO** ที่แล็บใช้ (ไทยหรืออังกฤษ) ถ้าใช้ ISO ภาษาไทย หน้าจอ Setup จะเป็นภาษาไทย ตอนนี้ทำภาษาอังกฤษตามหนังสือ
