// npm run teacher-pin: sets the teacher's page's PIN (docs/guide-pin-plan.md task G). Asks for it twice, not shown
// as it is typed, and writes only its slow hash to src/teacher/pin.json; then commit and push that file.
//   npm run teacher-pin -- --clear   takes the PIN away (the page opens for anyone, with a note to set one)

import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { makeRecord, pinProblem } from '../src/teacher/pin';

const FILE = 'src/teacher/pin.json';

if (process.argv.includes('--clear')) {
  writeFileSync(FILE, '{}\n');
  console.log(`${FILE}: no PIN now. Commit and push it.`);
  process.exit(0);
}

/** Asks a question; what is typed is not shown. */
function ask(question: string): Promise<string> {
  let muted = false;
  const out = new Writable({
    write(chunk, _enc, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output: out, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

const pin = await ask('รหัสเข้าหน้าครู (ไม่แสดงขณะพิมพ์): ');
const problem = pinProblem(pin);
if (problem) {
  console.log(problem);
  process.exit(1);
}
if ((await ask('พิมพ์อีกครั้ง: ')) !== pin) {
  console.log('สองครั้งไม่ตรงกัน ยังไม่ได้ตั้งรหัส');
  process.exit(1);
}
writeFileSync(FILE, JSON.stringify(await makeRecord(pin), null, 2) + '\n');
console.log(`ตั้งรหัสแล้ว: ${FILE} (เก็บเฉพาะค่าแฮช) · commit แล้ว push ขึ้น main เพื่อให้เว็บใช้รหัสนี้`);
