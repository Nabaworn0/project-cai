# พรอมต์สร้างภาพพิกเซล 16-bit (ChatGPT)

ใช้ตามลำดับ เริ่มจากข้อ 1 ในแชตใหม่ แล้วสร้างทุกภาพต่อในแชตเดียวกัน สไตล์จะได้ตรงกัน
พรอมต์เป็นภาษาอังกฤษเพราะคุมภาพได้แม่นกว่า ถ้าภาพไหนเพี้ยน ให้แนบภาพที่ดีที่สุดกลับไปแล้วบอกว่า "match this exactly"

ภาพที่ได้ไม่ต้องสมบูรณ์แบบเรื่องตารางพิกเซล สคริปต์ `npm run pixelize` จะจัดให้ลงตารางและชุดสีเอง
(ดู [style-guide.md](style-guide.md) ข้อ 7) ที่สำคัญคือ **ทรง สัดส่วน สีหน้า และตำแหน่งตัวต้องตรงกันทุกภาพ**

---

## 1. ตั้งสไตล์ (ส่งครั้งแรกครั้งเดียว)

```
We are making sprites for a 2D educational game called "Computer Repair Shop".
Lock this style for every image in this chat:
- 16-bit pixel art, like a Super Nintendo era RPG. Crisp square pixels, no anti-aliasing, no blur, no gradients.
- Very low resolution: a character is only about 32 pixels wide and 40 pixels tall. Draw it big on the canvas
  so every art pixel is a clearly visible square block of the same size.
- 1-pixel dark navy outline (#1b2a4a). Light comes from the top-left. Shade with one darker step of the same colour.
- Use only this palette: navy #1b2a4a #2c3e66 #4a5f8f, yellow #ffd23f #d9a12b, teal #2ec4b6 #1f8f86 #8ff0e4,
  coral #ff6b6b #c94b55, white #ffffff, cream #fff4e0, skin #f6c69c #d9976a, hair #2b2340 #4a3d66,
  wood #8a5a33 #5e3b20, sky #8fd3ff #5aa8e6, screen blue #1d6fd6 #0f4a9e, greys #d8dee8 #9aa5b8 #5f6b80,
  purple #b07cd6 #7a4fa3, green #7bd65a.
- Big friendly head, simple eyes and mouth made of 2-3 pixels.
- Never include any text, letters, numbers, logos, brand marks or watermarks.
Reply "ready" and wait for my image requests.
```

## 2. ตัวละครหลัก: ช่าง (ทีละภาพ 4 ภาพ)

ภาพแรก (neutral):

```
Sprite: a young Thai computer repair technician, the player character, about 18 years old.
Teal polo shirt with cream collar, small blank yellow name badge on the right chest, short dark hair,
navy headset with a small boom mic that has a coral tip.
Front view, visible from head to waist only (the lower body will be hidden behind a counter), arms at the sides.
Expression: NEUTRAL, calm small smile.
About 32 x 40 art pixels. Transparent background, PNG, character centered with empty space around it.
```

ภาพที่ 2–4 (ส่งทีละข้อความ เปลี่ยนแค่หน้า):

> **สำคัญ:** ทุกครั้งให้ **แนบภาพ neutral กลับไปด้วย** แล้วสั่งให้ "แก้ภาพนี้" ไม่ใช่วาดใหม่
> ถ้าไม่แนบ ChatGPT มักวาดตัวละครใหม่ทั้งตัว (ทรงผม ขนาดหัว ตำแหน่งป้ายชื่อเปลี่ยน) ซึ่งใช้สลับสีหน้าในเกมไม่ได้
> ถ้าใช้โหมดแก้ภาพได้ ให้ระบายเฉพาะบริเวณหน้าแล้วสั่งเปลี่ยนสีหน้า จะได้ผลตรงที่สุด

```
Edit the attached image. Keep the sprite pixel-for-pixel identical: same hair, headset, head size, pose, framing,
canvas size, outline, clothing and name badge position. Change only the face: HAPPY — eyes closed in upside-down U arcs, wide open smile, coral blush pixels on the cheeks.
Transparent background, PNG.
```

```
Edit the attached image. Keep the sprite pixel-for-pixel identical: same hair, headset, head size, pose, framing,
canvas size, outline, clothing and name badge position. Change only the face: THINKING — one eyebrow raised, eyes looking to the side, small sideways mouth.
Transparent background, PNG.
```

```
Edit the attached image. Keep the sprite pixel-for-pixel identical: same hair, headset, head size, pose, framing,
canvas size, outline, clothing and name badge position. Change only the face: SURPRISED — eyebrows high, round white eyes with dark pupils, small round open mouth.
Transparent background, PNG.
```

บันทึกเป็น `art-source/tech-neutral.png`, `tech-happy.png`, `tech-thinking.png`, `tech-surprised.png`

## 3. ลูกค้าคนแรก: ป้าสมศรี

```
New sprite in the same style: "Auntie Somsri", a cheerful Thai woman about 60 years old.
Short curly grey hair, round glasses, purple blouse with a small white flower pattern, holding a smartphone.
Full body, front view, standing. About 24 x 48 art pixels.
Expression: WORRIED — eyebrows tilted up, small frown.
Transparent background, PNG, centered.
```

แล้วขอสีหน้า `neutral`, `happy`, `angry` ด้วยข้อความแบบข้อ 2 (Same sprite, pixel-for-pixel identical…)
บันทึกเป็น `art-source/somsri-worried.png` ฯลฯ

## 4. ของประกอบฉาก (ทีละภาพ)

```
Prop sprite: a desktop computer monitor on a stand, front view, navy bezel, the screen a flat blue (#1d6fd6)
with a few simple light lines, no text. About 24 x 19 art pixels. Transparent background, PNG.
```

```
Prop sprite: a wooden wall shelf with three rows of small boxes of computer parts in teal, coral, yellow and purple.
About 36 x 44 art pixels. Transparent background, PNG.
```

```
Prop sprite: a square shop window with a wooden frame, blue sky and two small white clouds.
About 32 x 24 art pixels. Transparent background, PNG.
```

## 5. ไอคอนอะไหล่ (16×16 แต่ละชิ้น)

```
Icon sheet: 8 separate 16 x 16 art-pixel icons in a 4 x 2 grid with wide empty gaps between them, same style, no text:
RAM stick, SSD drive, USB flash drive, screwdriver, CPU chip, motherboard, security chip (TPM) with a small shield,
magnifying glass. Transparent background, PNG.
```

(ไอคอนรวมแผ่นเดียว ส่งมาได้เลย ผมจะตัดแยกเป็นชิ้นให้)

---

### เช็กก่อนส่งไฟล์
- พื้นหลังโปร่งใสไหม (ถ้าเป็นพื้นขาวทึบก็ใช้ได้ สคริปต์ลบให้ แต่โปร่งใสจะแม่นกว่า)
- ภาพสีหน้าของตัวละครเดียวกัน ตัวอยู่ตำแหน่งเดิม ขนาดเท่าเดิมทุกภาพไหม
- ไม่มีตัวหนังสือหรือโลโก้แอบอยู่ในภาพ
