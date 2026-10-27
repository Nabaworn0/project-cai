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

## 2.1 พี่ช่าง (`senior`) · 3 ภาพ · เพิ่ม 28 ต.ค. 2026 · ✅ ครบแล้ว

ตัวละครใหม่สำหรับคัตซีน ([learning-page-plan.md](learning-page-plan.md) งาน C) ยืนข้างเด็กฝึกงาน (ตัวช่างข้อ 2) หลังเคาน์เตอร์
ส่งในแชตเดิมที่ตั้งสไตล์ไว้ **แนบ `tech-neutral.png` ไปด้วย** ให้ขนาดหัวและกรอบภาพเท่ากัน แต่หน้าตาและชุดต่างกันชัด

ภาพแรก (neutral):

```
Sprite: the senior technician who runs the shop and teaches the intern, a Thai man about 35 years old.
Use the attached sprite ONLY as the size and framing reference: same canvas size, same head size, same outline style,
same front view from head to waist, arms at the sides. He must look clearly different from the attached intern:
short dark hair combed to the side, thin dark moustache, white T-shirt with short sleeves,
brown work apron (wood #8a5a33, darker edges #5e3b20) with a chest pocket holding a yellow screwdriver,
no headset, no name badge.
Expression: NEUTRAL, calm confident small smile.
Transparent background, PNG, character centered with empty space around it.
```

ภาพที่ 2–3 (แนบภาพ neutral ของพี่ช่างกลับไปทุกครั้ง):

```
Edit the attached image. Keep the sprite pixel-for-pixel identical: same hair, moustache, head size, pose, framing,
canvas size, outline, apron and screwdriver. Change only the face: HAPPY — eyes closed in upside-down U arcs, wide open smile.
Transparent background, PNG.
```

```
Edit the attached image. Keep the sprite pixel-for-pixel identical: same hair, moustache, head size, pose, framing,
canvas size, outline, apron and screwdriver. Change only the face: THINKING — one eyebrow raised, eyes looking to the side, small sideways mouth.
Transparent background, PNG.
```

บันทึกเป็น `art-source/senior-neutral.png`, `senior-happy.png`, `senior-thinking.png` แล้วบอก Claude ให้รัน
`npm run pixelize -- "art-source/senior-*.png" --height 50` (Claude หาแถวหน้าแล้วใส่ `--same-rows` ให้เอง)

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

**โน้ตบุ๊กของร้าน** (เคส 2: เปิด Rufus ทำ USB ใหม่ · วางบนเคาน์เตอร์ทางขวาของจอเครื่องลูกค้า) ส่งต่อในแชตเดิมที่ตั้งสไตล์ไว้ แนบภาพจอ `monitor.png` ไปด้วยเพื่อให้ขนาดและสีเข้าชุดกัน:

```
Prop sprite: an open laptop standing on a table, seen from the front at a slight angle so both the screen
and a thin strip of the keyboard are visible. Dark navy body (#1b2a4a, #2c3e66), the screen a flat blue
(#1d6fd6) with a few simple light lines like the attached monitor, a small teal light on the base, no text,
no logo, no stickers. Same pixel size and outline as the attached monitor sprite. About 34 x 24 art pixels,
a little smaller than the monitor. Transparent background, PNG.
```

ได้ภาพแล้ววางไฟล์ไว้ที่ `art-source/laptop.png` (หรือโฟลเดอร์รูปเดิม) แล้วบอกผม ผมจะรัน `npm run pixelize` และใส่ในฉากให้

## 4.1 ทางเข้าร้าน: พื้นหลังหน้าเรียน · 2 ภาพ · เพิ่ม 28 ต.ค. 2026 · ✅ ครบแล้ว (`--keep-bg --out src/assets/scenes`)

ผู้ใช้อยากให้หน้าเรียน ([learning-page-plan.md](learning-page-plan.md)) เป็นหน้าร้านจากด้านนอก เหมือนเด็กฝึกงานยืนอยู่หน้าประตูก่อนเข้าทำงาน
กระดานเส้นทางเรียนจะวางทับตรงกลางค่อนลงล่าง จึงต้องให้**ป้ายร้านอยู่ส่วนบน**และกลางภาพไม่มีของสำคัญ
ป้ายเว้นว่าง เกมจะเขียนคำว่า "ร้านซ่อมคอม" ทับเอง (เหมือนป้ายในร้าน)
ทำ 2 ภาพ ฉากเดียวกัน: แนวนอนสำหรับคอม/มือถือแนวนอน และแนวตั้งสำหรับมือถือ ส่งในแชตเดิมที่ตั้งสไตล์ไว้

ภาพแรก (แนวนอน):

```
Background scene in the same style: the front entrance of a small Thai computer repair shop, seen straight on
from the sidewalk, daytime. A two-storey shophouse front: a wide blank sign board across the upper part
(plain navy #1b2a4a with a yellow #ffd23f border, NO text at all), under it a striped awning in teal #2ec4b6 and cream #fff4e0,
a glass double door in the middle (slightly open, warm light inside), shop windows on both sides: the left one shows
a desktop PC and two monitors with blue screens, the right one shows a shelf of computer parts and a laptop.
A potted plant next to the door, a small step, light grey sidewalk tiles along the bottom, a bit of blue sky at the very top.
Keep the centre of the picture calm and uncluttered (a menu will be placed over it); the sign board must stay in the top third.
16:9 landscape, about 320 x 180 art pixels, every art pixel a clearly visible square block.
No people, no text, no letters, no numbers, no logos.
```

ภาพที่ 2 (แนวตั้ง แนบภาพแรกไปด้วย):

```
Redraw the attached scene as a 9:16 portrait picture for phones, about 180 x 320 art pixels, same style, same colours,
same shop: the blank sign board and the awning across the top quarter, the glass door in the middle, one narrow shop window
on each side, sidewalk tiles along the bottom. Keep the middle calm (a menu will cover it). No people, no text.
```

บันทึกเป็น `art-source/entrance-wide.png` และ `art-source/entrance-tall.png` แล้วบอก Claude
(Claude เพิ่มตัวเลือกให้ `npm run pixelize` เก็บพื้นหลังไว้ เพราะปกติสคริปต์ลบพื้นหลังของตัวละครออก)

## 4.2 หน้าต่างห้องซ่อมหลังร้าน: พี่ช่างนั่งทำงาน · 2 ภาพ · เพิ่ม 28 ต.ค. 2026 · ✅ ครบแล้ว (`--height 76`)

ผู้ใช้เลือกให้พี่ช่างนั่งทำงานในร้าน แล้วเดินมาหาเด็กฝึกงานเมื่อมีลูกค้าหรือต้องช่วย ([learning-page-plan.md](learning-page-plan.md) งาน D)
โต๊ะวางบนพื้นไม่ได้ เพราะเคาน์เตอร์และกล่องข้อความใช้ส่วนล่างของจอทุกขนาด จึงทำเป็น**หน้าต่างกระจกบนผนังที่มองเข้าไปเห็นห้องซ่อมด้านหลัง** แทนหน้าต่างวิวเดิม (ขนาดเท่ากัน ประมาณ 72×61)
ภาพแรกมีพี่ช่างนั่งอยู่ ภาพที่สองเหมือนเดิมทุกพิกเซล แต่เก้าอี้ว่าง (ตอนพี่ช่างลุกมาหา) ส่งในแชตเดิม แนบ `window.png` (กรอบหน้าต่างเดิม) และ `senior-neutral.png` ไปด้วย

ภาพแรก (พี่ช่างนั่งทำงาน):

```
Prop in the same style: an interior window in the shop's back wall, looking into a small repair workshop.
Use the attached window sprite as the reference for the wooden frame style, size and outline (about 72 x 61 art pixels).
Through the glass (no sky, it is an indoor room with warm lamp light): a workbench with an open desktop PC tower,
a small desk lamp, a screwdriver and a few parts. The attached senior technician (same hair, glasses, moustache,
white T-shirt and brown apron) sits behind the bench, seen from the front, upper body only, small because he is
further away, busy working on the PC with a THINKING face.
Transparent background outside the frame, PNG. No text, no letters, no numbers.
```

ภาพที่ 2 (แนบภาพแรกกลับไป):

```
Edit the attached image. Keep everything pixel-for-pixel identical: the frame, the glass, the bench, the PC, the lamp,
the light and the canvas size. Remove only the man: show his empty work stool behind the bench instead.
Transparent background outside the frame, PNG.
```

บันทึกเป็น `art-source/workshop-busy.png` และ `art-source/workshop-empty.png` แล้วบอก Claude

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
