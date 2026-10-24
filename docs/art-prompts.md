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

## 3. ลูกค้า 5 คนของรอบ 1 (รวม 19 ภาพ)

รายละเอียดลูกค้าอยู่ใน [phase1-cases.md](phase1-cases.md) ข้อ 3 · ทุกคนเต็มตัว ยืนหน้าตรง ขนาดใกล้ป้าสมศรี (ประมาณ 34 × 77 พิกเซลอาร์ต)
ทุกคนต้องมี 4 สีหน้า: `neutral` ปกติ · `worried` กังวล · `happy` พอใจ · `angry` ไม่พอใจ

**วิธีทำต่อคน:** ภาพแรกใช้พรอมต์ของคนนั้น แล้วอีก 3 สีหน้า **แนบภาพแรกกลับไป** พร้อมพรอมต์ "แก้สีหน้า" ด้านล่าง
บันทึกชื่อไฟล์ว่า `art-source/<ชื่อ>-<สีหน้า>.png` เช่น `beam-neutral.png`, `beam-worried.png`

> **สำคัญ (เจอเมื่อ 24 ต.ค. 2026):** ถ้าไม่แนบภาพตัวอย่าง ChatGPT จะวาดละเอียดเกินไปประมาณ 2 เท่า (สูง 120–165 พิกเซลอาร์ต)
> และหัวเล็กแบบคนจริง พอย่อให้เท่าป้าสมศรีแล้ว หน้าจะเละ แว่นกลายเป็นแว่นกันแดด และสีหน้าดูไม่ออก
> **ภาพแรกของทุกคนต้องแนบ `art-source/somsri-neutral.png` ไปเป็นตัวอย่างขนาด** แล้วใส่ข้อความนี้ไว้หน้าพรอมต์ของคนนั้น:
>
> ```
> Use the attached sprite ONLY as the reference for scale and proportions. Draw a NEW character with:
> the same art-pixel size (each pixel block as big as in the reference), the same total height (about 77 art pixels),
> the same big chibi head (about 30 art pixels wide, the head is about 40% of the height), same outline and shading.
> Transparent background, PNG, no glow or shadow around the character.
> ```
>
> ห้ามใช้สีเหลืองอ่อนหรือครีมเป็นสีเสื้อ เพราะจะกลืนกับผนังร้าน (`#ffe3b3`) ใช้เหลืองสด `#ffd23f` แทน

### พรอมต์แก้สีหน้า (ใช้กับทุกคน แนบภาพแรกไปด้วยทุกครั้ง)

```
Edit the attached image. Keep the sprite pixel-for-pixel identical: same hair, clothes, body, pose, size,
position, canvas size and outline. Change only the face to: <EXPRESSION>.
Transparent background, PNG.
```

แทน `<EXPRESSION>` ด้วย:
- `NEUTRAL — calm, relaxed eyebrows, small closed mouth`
- `WORRIED — eyebrows tilted up in the middle, small frown`
- `HAPPY — eyes in happy arcs, wide smile`
- `ANGRY — eyebrows angled down toward the nose, frowning mouth`

### ป้าสมศรี (`somsri`) · ✅ ครบแล้ว ยกเว้น happy ที่ต้องสร้างใหม่

ภาพ happy ชุดแรกไม่มีแว่น ให้แนบ `somsri-neutral.png` แล้วใช้พรอมต์แก้สีหน้า HAPPY โดยเติมท้ายว่า `Keep her round glasses.`

### น้องบีม (`beam`) · 4 ภาพ

```
New sprite in the same style: "Beam", a Thai high-school boy about 16 years old who loves games.
Messy short black hair, oversized black hoodie with a small teal pixel-controller print (no text), jeans, sneakers,
holding a USB flash drive up proudly in one hand. Full body, front view, standing, confident pose.
Expression: NEUTRAL — calm, slight confident smile.
About 34 x 77 art pixels. Transparent background, PNG, centered.
```

### ลุงชัย (`chai`) · 4 ภาพ

```
New sprite in the same style: "Uncle Chai", a Thai man about 55 years old who runs a photocopy shop.
Short grey hair with a receding hairline, thin moustache, short-sleeved blue button-up shirt with a pen in the
pocket, dark trousers, sandals, a wristwatch, one hand on his hip. Full body, front view, standing.
Expression: NEUTRAL — calm but slightly impatient.
About 34 x 77 art pixels. Transparent background, PNG, centered.
```

### พี่ต้น (`ton`) · 4 ภาพ

```
New sprite in the same style: "Ton", a Thai office worker about 28 years old.
Neat short black hair, thin rectangular glasses, bright yellow (#ffd23f) long-sleeved shirt with rolled-up sleeves,
grey trousers, holding a small laptop bag. Full body, front view, standing, polite posture.
Expression: NEUTRAL — calm, polite.
About 34 x 77 art pixels. Transparent background, PNG, centered.
```

### ครูวิไล (`wilai`) · 4 ภาพ

```
New sprite in the same style: "Teacher Wilai", a Thai computer teacher about 40 years old.
Shoulder-length black hair tied back, small pearl earrings, light teal blouse, navy knee-length skirt,
a lanyard with a blank ID card (no text), holding a clipboard. Full body, front view, standing.
Expression: NEUTRAL — calm, attentive.
About 34 x 77 art pixels. Transparent background, PNG, centered.
```

### สรุปไฟล์ที่ต้องได้

| ลูกค้า | ไฟล์ |
|---|---|
| ป้าสมศรี | ✅ ครบ |
| น้องบีม | ✅ ครบ |
| ลุงชัย | ✅ ครบ |
| พี่ต้น | ✅ ครบ (angry ดูไม่ค่อยโกรธ ถ้าแก้ให้สั่ง `thick eyebrows angled down, clearly visible above the glasses`) |
| ครูวิไล | ✅ ครบ |

> บทเรียน: ถ้าสั่งแก้ภาพที่เคยผ่านแล้ว (เช่นให้คิ้วชัดขึ้น) ChatGPT มักวาดหัวและผมใหม่ด้วย ให้แนบภาพ neutral แล้วระบุว่า
> `Change ONLY the eyebrows and mouth; do not redraw the hair or the head outline.` ไม่อย่างนั้นจะต่อกับตัวเดิมไม่ได้

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
