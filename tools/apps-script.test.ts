// npm run test:unit — the teacher's Google Sheet (apps-script/Code.gs), run against a stand-in for the Apps Script
// services: a learner's game sends with src/core/sync.ts, the teacher's page reads back with its own parsers.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { EMPTY, PLAYABLE, type Progress } from '../src/core/path';
import { MAX_WRITE } from '../src/core/reflect';
import { readResultsFile, resultsFile } from '../src/core/results';
import { payload, readRequest, received, sheetClasses, sheetFiles } from '../src/core/sync';

const CODE = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const json = (f: string) => JSON.parse(readFileSync(new URL(`../src/content/data/${f}`, import.meta.url), 'utf8'));
const items: { id: string; answer: number }[] = json('test.json').items;
const reflect: { self: { id: string }[]; write: { id: string }[]; satisfaction: { id: string }[] } = json('reflect.json');

const KEY = 'ครู-1234';
const CLASS = 'ปวช.1/2';
const TO = 'AKfycbx_abcdefghijklmnopqrstuvwxyz0123456789-XY';

// ---- The stand-in: a spreadsheet of cells, and the few services Code.gs uses --------------------------------

class Sheet {
  /** Cells as read back (a leading ' is the sheet's "keep as text" mark, not part of the value). */
  rows: unknown[][] = [];
  /** Exactly what was written, ' and all. */
  written: unknown[][] = [];
  frozen = 0;
  constructor(private name: string) {}
  getName = () => this.name;
  getLastRow = () => this.rows.length;
  getRange(r: number, c: number, nr = 1, nc = 1) {
    assert.ok(r >= 1 && c >= 1 && nr >= 1 && nc >= 1, `a range from row ${r}, column ${c}, ${nr}×${nc}`);
    const sheet = this;
    return {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => sheet.rows[r - 1 + i]?.[c - 1 + j] ?? '')),
      getValue: () => sheet.rows[r - 1]?.[c - 1] ?? '',
      setValues(v: unknown[][]) {
        assert.equal(v.length, nr, 'rows written match the range');
        v.forEach((row, i) => {
          assert.equal(row.length, nc, 'columns written match the range');
          const at = r - 1 + i;
          while (sheet.rows.length <= at) sheet.rows.push([]);
          while (sheet.written.length <= at) sheet.written.push([]);
          row.forEach((x, j) => {
            sheet.written[at]![c - 1 + j] = x;
            sheet.rows[at]![c - 1 + j] = typeof x === 'string' && x.startsWith("'") ? x.slice(1) : x;
          });
        });
        return this;
      },
      setFontWeight() {
        return this;
      },
    };
  }
  setFrozenRows(n: number) {
    this.frozen = n;
  }
}

function stand(o: { key?: string | null; lockFree?: boolean } = {}) {
  const sheets: Sheet[] = [new Sheet('แผ่น1')];
  const lock = { taken: 0, released: 0 };
  const ctx = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n: string) => sheets.find((s) => s.getName() === n) ?? null,
        getSheets: () => sheets,
        insertSheet: (n: string) => {
          assert.ok(!sheets.some((s) => s.getName() === n), `no second tab named ${n}`);
          const s = new Sheet(n);
          sheets.push(s);
          return s;
        },
      }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => (k === 'TEACHER_KEY' ? (o.key === undefined ? KEY : o.key) : null) }) },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => (o.lockFree === false ? false : (lock.taken++, true)),
        releaseLock: () => lock.released++,
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({
        text,
        mime: '',
        setMimeType(m: string) {
          this.mime = m;
          return this;
        },
      }),
    },
  });
  vm.runInContext(CODE, ctx, { filename: 'Code.gs' });
  const post = (body: unknown) => {
    const out = ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }) as { text: string; mime: string };
    assert.equal(out.mime, 'application/json');
    return JSON.parse(out.text) as Record<string, unknown>;
  };
  const tab = (n: string) => sheets.find((s) => s.getName() === n)!;
  return { sheets, lock, post, tab, ctx };
}

function learner(no: string, name = `นักเรียน ${no}`, room = CLASS): Progress {
  const sit = (right: number) => ({ score: right, total: items.length, answers: Object.fromEntries(items.map((it, i) => [it.id, i < right ? it.answer : 0])), at: 1, seconds: 200 });
  return { ...EMPTY, learner: { name, room, no }, pre: sit(3), post: sit(8), cases: { 'c01-boot-order': { stars: 3, plays: 2, first: 2 }, 'c02-usb': { stars: 1, plays: 1, first: 1 } } };
}
const send = (p: Progress, at: number, cls = CLASS) => payload(p, { name: cls, to: TO }, at);

// ---- Learners' results ------------------------------------------------------------------------------------

test("a learner's results go to their class's tab, and the teacher's page reads back the very same file", () => {
  const s = stand();
  const p = learner('07', 'สมชาย ใจดี');
  assert.equal(received(s.post(send(p, 5000))), true);
  const t = s.tab(CLASS);
  assert.deepEqual(t.rows[0], ['ห้อง', 'เลขที่', 'ชื่อ-สกุล', 'ก่อนเรียน', 'หลังเรียน', 'เคสที่เล่น', 'ดาวเคสรวม', 'ส่งล่าสุด', 'ข้อมูลเต็ม (หน้าครูใช้ อย่าแก้)']);
  assert.equal(t.frozen, 1);
  assert.deepEqual(t.rows[1]!.slice(0, 7), [CLASS, '07', 'สมชาย ใจดี', `3/${items.length}`, `8/${items.length}`, 2, 4], 'the number keeps its 0, the room is not a date');
  assert.equal((t.rows[1]![7] as Date).getTime(), 5000);

  const classes = sheetClasses(s.post(JSON.parse(readRequest(KEY))));
  assert.deepEqual(classes, { ok: true, value: [CLASS] }, 'the teacher\'s untouched first tab is not a class');
  const files = sheetFiles(s.post(JSON.parse(readRequest(KEY, CLASS))));
  assert.ok(files.ok);
  assert.equal(files.value.length, 1);
  assert.equal(files.value[0]!.row, 2);
  const back = readResultsFile(files.value[0]!.text);
  assert.ok(back.ok);
  assert.deepEqual([back.data.learner, back.data.pre, back.data.cases, back.exportedAt, back.edited], [p.learner, p.pre, p.cases, 5000, false]);
});

test('a learner who sends again replaces their own row: one row per room and number', () => {
  const s = stand();
  s.post(send(learner('07'), 1000));
  s.post(send(learner('8'), 1100));
  s.post(send({ ...learner('7', 'นักเรียน 7 แก้ชื่อ'), post: null }, 2000));
  s.post(send(learner(' 9 ', 'คนห้องอื่น', 'ปวช.1/3'), 2100));
  s.post(send(learner('08', 'นักเรียน 8'), 2200));
  const rows = s.tab(CLASS).rows.slice(1);
  assert.deepEqual(
    rows.map((r) => r.slice(0, 5)),
    [
      [CLASS, '7', 'นักเรียน 7 แก้ชื่อ', `3/${items.length}`, '-'],
      [CLASS, '08', 'นักเรียน 8', `3/${items.length}`, `8/${items.length}`],
      ['ปวช.1/3', '9', 'คนห้องอื่น', `3/${items.length}`, `8/${items.length}`],
    ],
    '"7" and "07" are the same learner; the same number in another room typed in the link\'s class is another one',
  );
});

test('a send that arrives late (an older file) never replaces a newer one', () => {
  const s = stand();
  s.post(send(learner('3', 'ใหม่'), 9000));
  assert.equal(received(s.post(send(learner('3', 'เก่า'), 8000))), true, 'still answered ok, so the game stops retrying');
  assert.equal(s.tab(CLASS).rows[1]![2], 'ใหม่');
  s.post(send(learner('3', 'ใหม่กว่า'), 9001));
  assert.equal(s.tab(CLASS).rows[1]![2], 'ใหม่กว่า');
  assert.equal(s.tab(CLASS).rows.length, 2);
});

test('text that looks like a formula, a number or a date is written as text', () => {
  const s = stand();
  s.post(send(learner('5', '=HYPERLINK("http://x","y")', '1/2'), 1, '1/2'));
  const w = s.tab('1/2').written[1]!;
  for (const i of [0, 1, 2, 3, 4, 8]) assert.equal(typeof w[i] === 'string' && w[i].startsWith("'"), true, `column ${i + 1}: ${String(w[i])}`);
});

test("the fullest file a learner can make fits the sheet's cell", () => {
  const long = 'ก'.repeat(MAX_WRITE);
  const p: Progress = {
    ...learner('99', 'ก'.repeat(60), 'ร'.repeat(20)),
    done: ['lesson-os', 'lesson-types', 'order', 'reflect'],
    cases: Object.fromEntries(PLAYABLE.map((id) => [id, { stars: 3, plays: 99, first: 3 }])),
    order: { stars: 3, plays: 99, first: { tries: [9, 9, 9, 9, 9, 9], solved: [true, true, true, true, true, true], lost: 9 } },
    lessons: Object.fromEntries(['lesson-os', 'lesson-types'].map((id) => [id, { at: 1e13, first: [1, 2, 3, 0] }])),
    reflect: {
      self: Object.fromEntries(reflect.self.map((x) => [x.id, 5])),
      write: Object.fromEntries(reflect.write.map((x) => [x.id, long])),
      sat: Object.fromEntries(reflect.satisfaction.map((x) => [x.id, 5])),
      suggest: long,
      at: 1e13,
    },
  };
  const body = JSON.stringify(send(p, 1e13));
  assert.ok(body.length < 45000, `${body.length} characters`);
  const s = stand();
  assert.equal(received(s.post(body)), true);
  assert.ok((s.tab(CLASS).written[1]![8] as string).length < 50000);
});

// ---- What is turned away ----------------------------------------------------------------------------------

test('anything that is not a results file for a class is turned away, and nothing is written', () => {
  const s = stand();
  const good = send(learner('4'), 1);
  const file = good.file as unknown as Record<string, unknown>;
  const data = file.data as Record<string, unknown>;
  const cases: [unknown, string][] = [
    ['not json', 'shape'],
    ['null', 'shape'],
    ['x'.repeat(45001), 'size'],
    [{ ...good, class: 'a<b' }, 'shape'],
    [{ ...good, class: 'ก'.repeat(31) }, 'shape'],
    [{ ...good, class: undefined }, 'shape'],
    [{ ...good, file: { ...file, app: 'other' } }, 'shape'],
    [{ ...good, file: { ...file, version: 2 } }, 'shape'],
    [{ ...good, file: { ...file, exportedAt: 'soon' } }, 'shape'],
    [{ ...good, file: { ...file, check: undefined } }, 'shape'],
    [{ ...good, file: { ...file, data: { ...data, learner: null } } }, 'shape'],
    [{ ...good, file: { ...file, data: { ...data, learner: { name: ' ', room: CLASS, no: '4' } } } }, 'shape'],
    [{ ...good, file: { ...file, data: { ...data, learner: { name: 'ก', room: CLASS, no: 'สี่' } } } }, 'shape'],
    [{ ...good, file: { ...file, data: { ...data, learner: { name: 'ก', room: '', no: '4' } } } }, 'shape'],
    [{ action: 'delete', key: KEY }, 'action'],
  ];
  for (const [body, error] of cases) assert.deepEqual(s.post(body), { ok: false, error }, JSON.stringify(body).slice(0, 80));
  assert.equal(s.sheets.length, 1, 'no tab made');
  assert.equal(s.lock.taken, 0);
});

test('only the teacher\'s key reads the sheet; without a key set, nobody reads it', () => {
  const s = stand();
  s.post(send(learner('1'), 1));
  for (const key of ['ครู-12345', '', undefined, 1234]) {
    assert.deepEqual(s.post({ action: 'classes', key }), { ok: false, error: 'key' }, String(key));
    assert.deepEqual(s.post({ action: 'read', key, class: CLASS }), { ok: false, error: 'key' });
  }
  assert.equal(sheetFiles(s.post({ action: 'read', key: KEY, class: 'ไม่มีห้องนี้' })).ok, false);
  assert.deepEqual(s.post({ action: 'read', key: KEY, class: 'ไม่มีห้องนี้' }), { ok: false, error: 'class' });
  assert.deepEqual(s.post({ action: 'read', key: KEY, class: 'แผ่น1' }), { ok: false, error: 'class' }, "the teacher's own tab is not read");

  for (const key of [null, '']) {
    const none = stand({ key });
    none.post(send(learner('1'), 1));
    assert.deepEqual(none.post({ action: 'classes', key: '' }), { ok: false, error: 'key' }, `TEACHER_KEY ${String(key)}`);
    assert.deepEqual(none.post({ action: 'classes', key: null }), { ok: false, error: 'key' });
  }
});

test("a tab of the teacher's own with the class's name is left alone: the class gets its own tab", () => {
  const s = stand();
  const own = new Sheet(CLASS);
  own.rows = [['คะแนนเก็บ', 'ของครู']];
  s.sheets.push(own);
  s.post(send(learner('1'), 1));
  s.post(send(learner('2'), 2));
  assert.deepEqual(own.rows, [['คะแนนเก็บ', 'ของครู']]);
  assert.equal(s.tab(`${CLASS} (เกม)`).rows.length, 3);
  assert.deepEqual(s.post({ action: 'classes', key: KEY }), { ok: true, classes: [CLASS] });
  const files = sheetFiles(s.post({ action: 'read', key: KEY, class: CLASS }));
  assert.ok(files.ok && files.value.length === 2);

  s.sheets.splice(s.sheets.indexOf(own), 1);
  s.post(send(learner('3'), 3));
  assert.equal(s.tab(`${CLASS} (เกม)`).rows.length, 4, "with the teacher's tab gone, the class stays in the tab it has");
  assert.equal(s.sheets.length, 2);
});

test("both names taken by the teacher's own tabs: nothing is written over them", () => {
  const s = stand();
  const own = [new Sheet(CLASS), new Sheet(`${CLASS} (เกม)`)];
  for (const t of own) (t.rows = [['ของครู']]), s.sheets.push(t);
  assert.deepEqual(s.post(send(learner('1'), 1)), { ok: false, error: 'class' });
  assert.deepEqual(own.map((t) => t.rows), [[['ของครู']], [['ของครู']]]);
  assert.equal(s.sheets.length, 3);
});

test('a class in two tabs of ours (one copied by hand) is listed once', () => {
  const s = stand();
  s.post(send(learner('1'), 1));
  const copy = new Sheet(`${CLASS} (เกม)`);
  copy.rows = s.tab(CLASS).rows.map((r) => [...r]);
  s.sheets.push(copy);
  assert.deepEqual(s.post({ action: 'classes', key: KEY }), { ok: true, classes: [CLASS] });
});

test("a row the teacher broke by hand still comes back, by its row in the tab, for the teacher's page to report", () => {
  const s = stand();
  s.post(send(learner('1'), 1));
  s.post(send(learner('2'), 2));
  s.tab(CLASS).rows[1]![8] = '{"app":"shop-results", แก้';
  s.tab(CLASS).rows.push(['', '', '', '', '', '', '', '', '']);
  s.post(send(learner('3'), 3));
  const files = sheetFiles(s.post({ action: 'read', key: KEY, class: CLASS }));
  assert.ok(files.ok);
  assert.deepEqual(
    files.value.map((f) => [f.row, readResultsFile(f.text).ok]),
    [
      [2, false],
      [3, true],
      [5, true],
    ],
    'the empty row is skipped; the rows after it keep their own numbers',
  );
  assert.equal(received(s.post(send(learner('1'), 4))), true, 'and the learner sending again mends it');
  assert.equal(readResultsFile(s.tab(CLASS).rows[1]![8] as string).ok, true);
});

test('two sends at once: one waits its turn; when the sheet stays busy the game is told so and tries again', () => {
  const s = stand();
  s.post(send(learner('1'), 1));
  s.post(send(learner('1'), 2));
  assert.deepEqual([s.lock.taken, s.lock.released], [2, 2], 'the lock is let go after each write');
  const busy = stand({ lockFree: false });
  assert.deepEqual(busy.post(send(learner('1'), 1)), { ok: false, error: 'busy' });
  assert.equal(busy.sheets.length, 1);
});

test('the class list: each class once, in the order of the tabs', () => {
  const s = stand();
  for (const [cls, no] of [['ม.4-1', '1'], [CLASS, '1'], ['ม.4-1', '2']] as const) s.post(send(learner(no, 'ก', cls), 1, cls));
  assert.deepEqual(s.post({ action: 'classes', key: KEY }), { ok: true, classes: ['ม.4-1', CLASS] });
  assert.deepEqual(sheetClasses(s.post({ action: 'classes', key: KEY })), { ok: true, value: ['ม.4-1', CLASS] });
});

test("opening the web app's link in a browser says it works and shows no results", () => {
  const s = stand();
  s.post(send(learner('1'), 1));
  const out = JSON.parse((s.ctx.doGet() as { text: string }).text);
  assert.equal(out.ok, true);
  assert.ok(!JSON.stringify(out).includes('นักเรียน'));
  assert.deepEqual(s.post(''), { ok: false, error: 'shape' });
  assert.deepEqual(JSON.parse((s.ctx.doPost(undefined) as { text: string }).text), { ok: false, error: 'shape' });
});

test('the file the game sends is the one the results page downloads', () => {
  const p = learner('2');
  assert.deepEqual(send(p, 7).file, resultsFile(p, 7));
});
