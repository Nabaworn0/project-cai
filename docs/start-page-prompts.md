# Prompt ให้ ChatGPT: หน้าเริ่มต้น WINSTALL ([start-page-plan.md](start-page-plan.md) งาน A)

มี 2 ส่วน ทำในแชตแยกกันได้ · ได้ผลแล้วส่งกลับมาให้ Claude ตรวจก่อนใส่ในเกม

---

## ส่วนที่ 1 ข้อความทั้งหน้า (แชตใหม่ วางทั้งกรอบ)

```text
ช่วยเขียนข้อความภาษาไทยสำหรับ "หน้าเริ่มต้น" ของเกมการศึกษา WINSTALL (อ่านว่า วิน-สตอล มาจาก Windows + Install + Win ที่แปลว่าชนะ)

ข้อมูลเกม:
- รายวิชา 21910-2001 ระบบปฏิบัติการเบื้องต้น ผู้เล่นคือนักเรียน ปวช. อายุ 15–17 ปี เล่นบนมือถือหรือคอม
- เรื่อง: ผู้เล่นเป็น "เด็กฝึกงาน" วันแรกที่ร้านซ่อมคอมของ "พี่ช่าง" (ผู้ชายวัยทำงาน ใจดี มีหนวด ใส่ผ้ากันเปื้อน) พี่ช่างสอนแล้วให้ลงมือทำกับลูกค้าจริงในร้าน
- วัตถุประสงค์ 4 ข้อ (ภาษาทางการ):
  1) อธิบายความหมายและหน้าที่ของระบบปฏิบัติการได้
  2) จำแนกประเภทของระบบปฏิบัติการได้
  3) เรียงลำดับขั้นตอนการติดตั้ง Windows 11 ได้ถูกต้อง
  4) ติดตั้ง Windows 11 ตามสถานการณ์ลูกค้าได้ (ทำแฟลชไดรฟ์ด้วย Rufus ตั้งค่า BIOS ให้บูตจาก USB ติดตั้ง และตั้งค่าเริ่มต้น)
- 7 ขั้นที่ผู้เล่นทำตามลำดับ: แบบทดสอบก่อนเรียน → บทเรียน: ระบบปฏิบัติการคืออะไร (คลิป 3 นาที + คำถาม 2 ข้อ) → บทเรียน: ประเภทของระบบปฏิบัติการ (คลิป 3 นาที + คำถาม 2 ข้อ) → เรียงขั้นตอนการติดตั้ง (เกม) → ฝึกงานที่ร้าน (ลูกค้า 5 เคส) → แบบทดสอบหลังเรียน → สะท้อนผลและประเมินความพึงพอใจ · จบแล้วดูสรุปผลการเรียนได้
- ใช้เวลาทั้งหมดราว 60–70 นาที แบ่งเล่นหลายครั้งได้ เกมจำความคืบหน้าไว้ในเครื่อง
- บทเรียนมีเสียงพากย์
- ถ้าเปิดจากลิงก์ของห้อง (ครูสร้างให้) ผลจะส่งให้ครูของห้องนั้นอัตโนมัติ

น้ำเสียง: สนุก เป็นกันเองแบบ Gen Z แต่สุภาพ ใช้ในโรงเรียนได้ ไม่หยาบ ไม่ใช้คำแสลงที่ล้าสมัยหรือแรงเกินไป · ประโยคสั้น อ่านบนมือถือง่าย · ห้ามเพิ่มกิจกรรมหรือฟีเจอร์ที่ไม่มีในข้อมูลข้างบน · ใช้ "Windows 11" "Rufus" "BIOS" "USB" เป็นภาษาอังกฤษ

ต้องการข้อความต่อไปนี้ (ทำตามจำนวนตัวอักษรที่กำหนด นับรวมช่องว่าง):
1. tagline: ชื่อรองใต้โลโก้ 1 บรรทัด ไม่เกิน 40 ตัว (ตัวอย่างแนวทาง: ร้านซ่อมคอมพี่ช่าง · ภารกิจเด็กฝึกงาน ลง Windows 11)
2. greeting: คำทักของพี่ช่างในกรอบคำพูด 1–2 ประโยค ไม่เกิน 90 ตัว
3. goalsTitle: หัวข้อของรายการวัตถุประสงค์ ไม่เกิน 25 ตัว (เช่น "เล่นจบแล้วจะทำได้")
4. goals: วัตถุประสงค์ 4 ข้อเป็นภาษานักเรียน ข้อละไม่เกิน 45 ตัว ความหมายต้องตรงกับข้อทางการทุกข้อ
5. stepsTitle: หัวข้อของรายการขั้น ไม่เกิน 25 ตัว
6. steps: ชื่อสั้นของ 7 ขั้น ขั้นละไม่เกิน 22 ตัว ตามลำดับเดิม
7. time: บอกเวลาและแบ่งเล่นได้ 1 ประโยค ไม่เกิน 50 ตัว
8. howTo: วิธีเล่น 3 ข้อ ข้อละไม่เกิน 40 ตัว (แตะ/คลิกเพื่อเลือก · เปิดเสียงหรือใส่หูฟังเพราะบทเรียนมีเสียงพากย์ · เกมจำความคืบหน้าในเครื่องนี้)
9. classBadge: ป้ายเมื่อเปิดจากลิงก์ห้อง ใช้ {class} แทนชื่อห้อง ไม่เกิน 40 ตัว (ความหมาย: ผลจะส่งให้ครูห้อง {class})
10. notMyClass: ชื่อปุ่มสำหรับคนที่สแกน QR ผิดห้อง ไม่เกิน 18 ตัว
11. notMyClassDone: ข้อความหลังกดปุ่มข้อ 10 ไม่เกิน 70 ตัว (ความหมาย: เลิกส่งผลไปห้องนั้นแล้ว ให้สแกน QR ของห้องตัวเองใหม่)
12. roomMismatch: คำเตือนในฟอร์มกรอกชื่อ เมื่อ "ชั้น" ที่กรอกไม่ตรงกับห้องในลิงก์ ใช้ {typed} และ {class} ไม่เกิน 80 ตัว (กรอกต่อได้ แค่ให้ตรวจ)
13. start: ข้อความบนปุ่มเริ่ม ไม่เกิน 12 ตัว
14. aboutLink: ข้อความลิงก์เล็กในเมนูสำหรับเปิดหน้านี้ดูอีกครั้ง ไม่เกิน 15 ตัว
15. teacherLink: ข้อความลิงก์เล็กท้ายหน้าไปหน้าครู ไม่เกิน 15 ตัว
16. soundOn / soundOff: ข้อความบนปุ่มเสียงตอนเปิดอยู่และตอนปิดอยู่ ข้อละไม่เกิน 12 ตัว

ตอบเป็น JSON อย่างเดียว ในกล่องโค้ด ใช้ชื่อคีย์ตามข้างบนทุกตัว (goals และ steps และ howTo เป็นอาร์เรย์ของข้อความ) แล้วตามด้วยตารางสั้นๆ ว่าแต่ละข้อความยาวกี่ตัวอักษร
```

---

## ส่วนที่ 2 ภาพ (แชตเดิมที่ทำตัวละครไว้ · ถ้าหาแชตเดิมไม่เจอ ให้แชตใหม่แล้ววางกรอบ "ตั้งสไตล์" จาก [art-prompts.md](art-prompts.md) ข้อ 1 ก่อน)

ภาพทั้งหมด**ห้ามมีตัวหนังสือ** โลโก้ WINSTALL Claude ทำเป็นตัวอักษรในเกมเอง (AI มักเขียนตัวอักษรเพี้ยน และเปลี่ยนชื่อได้โดยไม่ต้องเจนใหม่)
ตัวละครไม่อยู่ในแบนเนอร์ เพราะ Claude วางพี่ช่างกับเด็กฝึกงานเป็นภาพแยกทับลงไป จะได้ขยับได้

### 2.1 แบนเนอร์แนวนอน → `art-source/start-wide.png`

```
Background scene in the same 16-bit pixel art style: the inside of a small, friendly Thai computer repair shop,
early morning, about to open. Seen straight on. A long wooden workbench across the lower third with an open desktop PC
case (green circuit board, glowing teal fan), a monitor showing a plain bright blue screen with a white loading circle,
a USB flash drive and a small screwdriver set on the bench. Behind: a pegboard wall with cables and tools,
a shelf of boxed computer parts, a small window with soft yellow morning light, a hanging lamp.
Leave a wide empty band across the top quarter (a game logo will be placed there) and keep empty floor space
on the far left and far right of the bench (two characters will stand there).
16:9 landscape, about 320 x 180 art pixels, every art pixel a clearly visible square block.
No people, no text, no letters, no numbers, no logos, no brand marks.
```

### 2.2 แบนเนอร์แนวตั้ง → `art-source/start-tall.png` (แนบภาพ 2.1 ไปด้วย)

```
Redraw the attached scene as a 9:16 portrait picture for phones, about 180 x 320 art pixels, same style, same colours,
same shop: the empty band for the logo across the top fifth, the workbench with the open PC and blue monitor in the
lower middle, the pegboard and shelf behind. Keep empty floor space at the bottom left and bottom right for two characters.
No people, no text, no letters, no numbers, no logos.
```

### 2.3 เด็กฝึกงานถือแฟลชไดรฟ์ 2 ภาพ (แนบ `art-source/tech-neutral.png` ทุกครั้ง)

ใช้สลับกันเป็นแอนิเมชัน (ถือ ↔ ชูขึ้น) หัวและตัวต้องตรงกันทุกพิกเซล มีแค่แขนที่ขยับ

```
Edit the attached sprite. Keep the head and body pixel-for-pixel identical (hair, headset, face, polo shirt, name badge,
head size and position), keep the canvas size and the outline style. Change only the arms and hands: [POSE].
The arms stay inside the canvas. Transparent background, PNG.
```

| ไฟล์ | [POSE] |
|---|---|
| `art-source/tech-usb-hold.png` | one hand holds a small USB flash drive (grey body, teal cap) in front of the chest, the other arm at the side |
| `art-source/tech-usb-up.png` | the same hand raises the USB flash drive up beside the head, arm bent, proud pose, the other arm at the side |

ถ้าตัวละครหรือหัวขยับไปจากภาพต้นแบบ ให้สั่งใหม่เฉพาะภาพนั้น แล้วแนบภาพต้นแบบซ้ำ

**ได้ครบ 4 ภาพแล้ว** บันทึกไว้ใน `art-source/` ตามชื่อข้างบน แล้วบอก Claude (Claude รัน `npm run pixelize` และจัดหัวให้ตรงกันเอง)
