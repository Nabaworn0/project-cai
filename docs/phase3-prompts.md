# Prompt ให้ ChatGPT: โหมดอิสระ (งาน F ของระยะ 3)

แผน: [phase3-plan.md](phase3-plan.md) · ตอนนี้ในเกมเป็นร่างของ Claude (`decor.json`, `ranks.json` เป็น `draft: true`) และบทพูดกลางของลูกค้า

มี 4 ส่วน ทำส่วนไหนก่อนก็ได้
1. ข้อความ: ชื่อและคำบรรยายของแต่ง 12 ชิ้น · คำชมพี่ช่างตอนเลื่อนขั้น 3 ประโยค · บทพูดลูกค้า 5 คนที่ยังขาด (JSON ชุดเดียว)
2. ภาพของแต่ง 12 ภาพ
3. ป้ายยศ 4 ภาพ
4. ย่อหน้าเพิ่มในคู่มือครู (โหมดอิสระ)

ได้แล้วส่งให้ Claude: JSON วางในแชตได้เลย · ภาพบันทึกตามชื่อไฟล์ในตารางลงโฟลเดอร์ที่บอก แล้วบอก Claude ให้ย่อภาพ (Claude ย่อทีละไฟล์ด้วย `npm run pixelize`) · ย่อหน้าคู่มือครูนำไปใส่ในเอกสารเอง

## 1. ข้อความ (JSON ชุดเดียว)

คัดลอกทั้งกล่องไปวางใน ChatGPT

```
ช่วยเขียนข้อความภาษาไทยสำหรับ "โหมดอิสระ" ในเกมสอนติดตั้ง Windows 11 ของนักเรียน ปวช. (วิชา 21910-2001)
ผู้เล่นเป็นเด็กฝึกงานในร้านซ่อมคอม มี "พี่ช่าง" เป็นคนสอน ในโหมดอิสระลูกค้ามาแบบสุ่ม และปัญหาของเคสหนึ่งอาจปนมากับลูกค้าอีกคน
ซ่อมสำเร็จได้เหรียญ เอาเหรียญไปซื้อของแต่งร้าน และเลื่อนยศช่างได้

กติกา
- ภาษาไทยง่าย เป็นกันเอง เหมาะกับวัยรุ่น ศัพท์คอมเขียนภาษาอังกฤษตามจริง เช่น USB, BIOS, Setup, Windows 11
- ห้ามเปลี่ยน id และ key ห้ามเพิ่มหรือลดรายการ ตอบเป็น JSON อย่างเดียว

ส่วน A: ของแต่งร้าน 12 ชิ้น (name ไม่เกิน 24 ตัวอักษร · desc ไม่เกิน 60 ตัวอักษร บอกว่าดีกับร้านหรือลูกค้ายังไง)
ร้านมี 4 จุดให้วาง จุดละ 3 ชิ้น ของในจุดเดียวกันต้องต่างกันชัด และชิ้นที่ต้องมียศควรดูพิเศษกว่า
- ป้ายร้าน (ประดับปลายป้าย): sign-neon ไฟนีออนรอบป้าย · sign-led ป้ายไฟวิ่ง (ยศช่างผู้ช่วย) · sign-gold ป้ายขอบทอง (ยศช่างประจำร้าน)
- บนเคาน์เตอร์ (ข้างจอคอมลูกค้า): counter-plant กระถางต้นไม้เล็ก · counter-cat แมวกวัก · counter-trophy ถ้วยรางวัล (ยศหัวหน้าช่าง)
- ผนังหลังร้าน: wall-poster โปสเตอร์ Windows 11 · wall-clock นาฬิกาแขวน · wall-award ใบประกาศช่างดีเด่น (ยศช่างประจำร้าน)
- พื้นหน้าเคาน์เตอร์ (ของที่ตั้งอยู่บนพื้น): floor-water ตู้กดน้ำ · floor-bench ม้านั่งรอคิว · floor-cabinet ตู้โชว์อะไหล่ (ยศช่างผู้ช่วย)
แก้ชื่อให้น่าสนใจขึ้นได้ แต่ต้องเป็นของชิ้นเดิม (ภาพวาดตามชิ้นนี้)

ส่วน B: คำชมของพี่ช่างตอนเด็กฝึกงานเลื่อนยศ ยศละ 1 ประโยค ไม่เกิน 90 ตัวอักษร พูดกับเด็กฝึกงานโดยตรง ภูมิใจในตัวเขา
- assistant ช่างผู้ช่วย: ซ่อมสำเร็จ 5 งาน
- regular ช่างประจำร้าน: ซ่อมสำเร็จ 15 งาน และได้ 3 ดาว 5 งาน
- head หัวหน้าช่าง: ซ่อมสำเร็จ 30 งาน ได้ 3 ดาว 15 งาน เจอปัญหาครบทุกแบบ และสะสมการ์ดในสมุดช่างครบ 16 ใบ

ส่วน C: บทพูดลูกค้าที่ยังขาด ประโยคละไม่เกิน 70 ตัวอักษร พูดตามนิสัยของแต่ละคน
ลูกค้าพูดกับเด็กฝึกงาน (เรียก "หนู" "น้อง" หรือ "พี่" ตามวัยของลูกค้า) ตอนเห็นสิ่งที่เกิดขึ้นบนจอเครื่องของตัวเอง
ความหมายของแต่ละ key
- wrongImage: USB ที่ทำมาเป็นตัวติดตั้งผิดตัว ขึ้นหน้าติดตั้งที่ไม่ใช่ Windows 11
- cantRun: Setup ขึ้น "This PC can't run Windows 11" (ลูกค้าตกใจ คิดว่าเครื่องตัวเองใช้ไม่ได้)
- stillCantRun: ขึ้น "This PC can't run Windows 11" ซ้ำอีก เพราะยังไม่ได้แก้ต้นเหตุ
- reachedSetup: ขึ้นหน้าติดตั้งแล้ว แต่งานยังไม่จบ ต้องติดตั้งต่อ
- backup: ช่างถามว่าสำรองข้อมูลแล้วหรือยัง ก่อนลบพาร์ทิชัน (ตอบว่าสำรองแล้ว ลบได้)
- noBackup: ช่างลบพาร์ทิชันไปก่อนถามเรื่องสำรองข้อมูล (ลูกค้าตกใจ)
- lostInstaller: ช่างเผลอลบพาร์ทิชันของแฟลชไดรฟ์ติดตั้งเอง Setup ขึ้นข้อผิดพลาด
- installed: ติดตั้ง Windows 11 เสร็จแล้ว (ลูกค้าดีใจ)

ลูกค้า (id · ชื่อ · ข้อมูล · นิสัย · ตัวอย่างประโยคที่มีอยู่แล้ว · key ที่ต้องเขียน)
1. somsri · ป้าสมศรี · อายุ 60 ขายขนมออนไลน์ · ใจดี ขี้กังวล ถ่ายรูปหน้าจอมาให้ดูทุกครั้ง · "อุ๊ย จอดำขึ้นภาษาอังกฤษเต็มเลย เครื่องป้าพังหรือเปล่าคะ" · wrongImage, cantRun, stillCantRun, reachedSetup, backup, noBackup, lostInstaller, installed
2. beam · น้องบีม · ม.5 ชอบเกม ทำ USB เองจากคลิปในยูทูบ · มั่นใจในตัวเอง พูดเร็ว ใช้ศัพท์ผิดๆ ถูกๆ · "เอ้า จอดำเลยพี่ ผมยังไม่ได้ลบ Windows เก่านะ" · stillCantRun, reachedSetup, backup, noBackup, lostInstaller, installed
3. chai · ลุงชัย · เจ้าของร้านถ่ายเอกสารหน้าโรงเรียน · ใจร้อน อยากได้เครื่องคืนเร็ว ใส่ใจเรื่องเงิน · "จอดำเลย! เครื่องลุงพังแล้วหรือเปล่าเนี่ย" · stillCantRun, installed
4. ton · พี่ต้น · พนักงานออฟฟิศ 28 ปี ซื้อคอมมือสองมาทำงานที่บ้าน · สุภาพ ชอบเปรียบเทียบสเปก คิดว่าเครื่องแรงพอแล้ว · "จอดำเลยครับพี่ ขึ้นว่าหาอุปกรณ์บูตไม่เจอ" · wrongImage, reachedSetup, backup, noBackup, lostInstaller, installed
5. wilai · ครูวิไล · ครูคอมพิวเตอร์ ดูแลห้องปฏิบัติการ · ละเอียด ถามเหตุผลทุกขั้น อยากเอาไปสอนต่อ · "จอดำ ขึ้นว่าหาอุปกรณ์บูตไม่เจอ แฟลชไดรฟ์ของครูใช้ไม่ได้แล้วเหรอคะ" · backup, noBackup

โครง JSON:
{
  "decor": {
    "sign-neon": { "name": "", "desc": "" },
    ... (ครบ 12 id ตามส่วน A)
  },
  "praise": { "assistant": "", "regular": "", "head": "" },
  "customers": {
    "somsri": { "wrongImage": "", "cantRun": "", "stillCantRun": "", "reachedSetup": "", "backup": "", "noBackup": "", "lostInstaller": "", "installed": "" },
    "beam": { ... เฉพาะ key ของบีมในส่วน C },
    "chai": { ... },
    "ton": { ... },
    "wilai": { ... }
  }
}
```

## 2. ภาพของแต่งร้าน 12 ภาพ

ภาพแรกสั่งด้วยกล่อง 2.1 พอได้ภาพที่ชอบแล้ว ภาพที่ 2–12 ให้**แนบภาพแรกไปด้วยทุกครั้ง** เพื่อให้สไตล์ตรงกัน
ในเกมภาพจะเล็กมาก (12–20 พิกเซล) จึงต้องเป็นรูปทรงใหญ่ เรียบ อ่านออกแม้ย่อ ไม่มีรายละเอียดยิบย่อย

### 2.1 สไตล์ (ใช้ทุกภาพ เปลี่ยนแค่ [SUBJECT])

```
A single 16-bit pixel-art game prop, 32 x 32 art pixels, drawn big and centred on a square canvas with a transparent
background, seen from the front like a side-view shop game. Chunky 1-pixel dark navy outline (#1b2a4a), flat colours
from this palette only: navy #1b2a4a, teal #2ec4b6, yellow #ffd23f, coral #ff6b6b, cream #fff4e0, white, light grey,
warm brown #8a5a33. Very simple bold shapes that still read when shrunk to 16 pixels. No anti-aliasing, no gradients,
no shadow on the ground, no text, no letters, no numbers, no logos, no brand marks.
Subject: [SUBJECT]
```

### 2.2 รายการภาพ (บันทึกตามชื่อไฟล์ลงโฟลเดอร์ `art-source/decor/`)

| ไฟล์ | จุดในร้าน | [SUBJECT] |
|---|---|---|
| `sign-neon.png` | ป้ายร้าน | a small glowing teal neon light bulb with a few yellow light rays |
| `sign-led.png` | ป้ายร้าน | a small rectangular LED panel with a row of glowing yellow dots, like a scrolling light sign |
| `sign-gold.png` | ป้ายร้าน | a small golden star badge with a shiny highlight, to pin on a shop sign |
| `counter-plant.png` | บนเคาน์เตอร์ | a small potted succulent plant in a coral pot |
| `counter-cat.png` | บนเคาน์เตอร์ | a white lucky cat figurine sitting and waving one raised paw |
| `counter-trophy.png` | บนเคาน์เตอร์ | a shiny golden trophy cup with two handles on a navy base |
| `wall-poster.png` | ผนัง | a framed poster with a simple four-pane window shape in teal and blue, hung on a wall |
| `wall-clock.png` | ผนัง | a round wall clock with a cream face, navy hands and a wooden rim |
| `wall-award.png` | ผนัง | a framed certificate with a gold seal and a red ribbon, hung on a wall |
| `floor-water.png` | พื้น | a small water dispenser standing on the floor, a blue water bottle on top of a white body |
| `floor-bench.png` | พื้น | a short wooden waiting bench with a teal cushion, standing on the floor |
| `floor-cabinet.png` | พื้น | a small glass display cabinet on the floor with USB sticks and a few computer parts on its shelves |

### 2.3 เช็กก่อนส่ง
- พื้นหลังโปร่งใสจริง (ไม่ใช่สีขาวหรือลายตาราง)
- ของอยู่ตรงกลาง เต็มกรอบ ไม่มีขอบว่างเยอะ
- ไม่มีตัวหนังสือในภาพ

## 3. ป้ายยศ 4 ภาพ

แทนไอคอนยศ (🧰 🔧 🛠️ 🏆) ที่ HUD เมนูเล่นอิสระ และป้ายเลื่อนขั้นในหน้าสรุป · แนบภาพแรกไปด้วยทุกครั้งเหมือนข้อ 2

### 3.1 สไตล์

```
A single 16-bit pixel-art rank badge for a computer repair shop game, 32 x 32 art pixels, centred on a square canvas
with a transparent background. A round badge with a chunky 1-pixel dark navy outline (#1b2a4a) and a tool symbol in
the middle. Flat colours from this palette only: navy #1b2a4a, teal #2ec4b6, yellow #ffd23f, coral #ff6b6b,
cream #fff4e0, white, light grey, bronze #b87333, silver #c0c7d1, gold #ffd23f. The four badges are one set: same
shape and size, the rim and ribbons getting richer from the first to the last. No anti-aliasing, no gradients,
no text, no letters, no numbers.
Subject: [SUBJECT]
```

### 3.2 รายการภาพ (บันทึกลงโฟลเดอร์ `art-source/ranks/`)

| ไฟล์ | ยศ | [SUBJECT] |
|---|---|---|
| `intern.png` | เด็กฝึกงาน | a plain cream badge with a thin teal rim and a small red toolbox in the middle |
| `assistant.png` | ช่างผู้ช่วย | a bronze-rimmed badge with a single wrench in the middle |
| `regular.png` | ช่างประจำร้าน | a silver-rimmed badge with a crossed wrench and screwdriver in the middle, one small ribbon below |
| `head.png` | หัวหน้าช่าง | a gold-rimmed badge with a crossed wrench and screwdriver under a small crown, two ribbons below and a star on top |

## 4. ย่อหน้าเพิ่มในคู่มือครู

ใส่ต่อท้ายหัวข้อ "2.5 คำแนะนำการใช้ในคาบเรียน" ในคู่มือครู · คัดลอกกล่องไปวางใน ChatGPT แล้วนำย่อหน้าที่ได้ไปใส่ในเอกสารเอง

```
ช่วยเขียนย่อหน้าภาษาไทยแบบทางการ 1 ย่อหน้า (4–6 บรรทัด) สำหรับคู่มือครูของเกมการศึกษา WINSTALL ต่อท้ายหัวข้อ "คำแนะนำการใช้ในคาบเรียน"
เนื้อหาที่ต้องมี
- เกมมี 2 โหมด: โหมดเรียนในห้อง (ปุ่ม "เริ่มฝึกงาน!" ในหน้าแรก) ส่งผลการเรียนให้ครู และโหมดอิสระ (ปุ่ม "เล่นอิสระ (ไม่บันทึกผล)") สำหรับฝึกเพิ่มเติมที่บ้าน ไม่ส่งผลให้ครู
- ในคาบเรียนให้นักเรียนกด "เริ่มฝึกงาน!" เท่านั้น ถ้าเผลอเข้าโหมดอิสระ ให้กด "ออกจากโหมดอิสระ" ที่ท้ายเมนู
- เข้าโหมดอิสระได้จากปุ่มในหน้าแรกเสมอ และจากเมนูการเรียนเมื่อทำแบบทดสอบหลังเรียนกับแบบสะท้อนคิดครบแล้ว ในโหมดนี้มีลูกค้าสุ่มที่ปัญหาปนกันหลายแบบ ยศช่าง และการแต่งร้านด้วยเหรียญ เพื่อให้นักเรียนกลับมาฝึกซ้ำ
- ครูแนะนำให้นักเรียนเล่นโหมดอิสระเป็นการบ้านหรือทบทวนก่อนสอบได้
```

## หลังได้ของครบ (Claude ทำ)
- ใส่ข้อความส่วน 1 ใน `decor.json` (`nameTh`, `descTh`), `ranks.json` (`praiseTh`), และ `reactionsTh` ของเคสแต่ละคน แล้วเปลี่ยน `draft` เป็น `false`
- ย่อภาพทีละไฟล์ด้วย `npm run pixelize` ไปที่ `src/assets/decor/` ตามความสูง ป้าย 12 · เคาน์เตอร์ 16 · ผนัง 16 · พื้น 20 พิกเซล (ฉากร้านใช้ภาพแทนอีโมจิเอง)
- ป้ายยศ: ย่อไปที่ `src/assets/ranks/` แล้วเพิ่มโค้ดให้ HUD เมนู และหน้าสรุปใช้ภาพแทนอีโมจิ
- ตรวจด้วย validator ภาพหน้าจอ 4 ขนาด และ `npm run check`
