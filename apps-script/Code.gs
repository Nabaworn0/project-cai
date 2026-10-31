// The teacher's Google Sheet for the game ร้านซ่อมคอม (docs/results-plan.md part 3, task D).
//
// Pasted into the sheet's Apps Script editor and deployed as a web app (docs/sheet-setup.md says how, step by step).
// Learners' games send their results here; the teacher's page (?view=teacher) reads them back with the teacher's key.
// One tab per class, one row per learner (room and number): a learner who sends again replaces their own row.
//
// What the game and the teacher's page send, always a POST whose body is JSON text:
//   {class, file}                  a learner's results          → {"ok": true}
//   {action: "classes", key}       the classes in this sheet    → {"ok": true, "classes": [...]}
//   {action: "read", key, class}   one class's results files    → {"ok": true, "files": [...], "rows": [...]}
//                                  (rows: each file's row in the tab, for the teacher to find a broken one)
// and when something is wrong: {"ok": false, "error": "key" | "class" | "size" | "shape" | "busy" | "action"}.
//
// The teacher's key is kept in Project Settings → Script Properties as TEACHER_KEY, never in this code.

var KEY_PROPERTY = 'TEACHER_KEY';
/** A sheet cell holds at most 50,000 characters; a results file is far smaller. */
var MAX_BODY = 45000;
/** The same class names the game's link can carry (src/core/sync.ts). */
var CLASS_NAME = /^[\p{L}\p{M}\p{N} ./_-]{1,30}$/u;
var HEADER = ['ห้อง', 'เลขที่', 'ชื่อ-สกุล', 'ก่อนเรียน', 'หลังเรียน', 'เคสที่เล่น', 'ดาวเคสรวม', 'ส่งล่าสุด', 'ข้อมูลเต็ม (หน้าครูใช้ อย่าแก้)'];
var COL = { room: 1, no: 2, json: 9 };

function doPost(e) {
  var text = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '';
  if (text.length > MAX_BODY) return reply_({ ok: false, error: 'size' });
  var req;
  try {
    req = JSON.parse(text);
  } catch (err) {
    return reply_({ ok: false, error: 'shape' });
  }
  if (!req || typeof req !== 'object') return reply_({ ok: false, error: 'shape' });
  if (req.action === undefined) return reply_(receive_(req));
  if (req.action === 'classes' || req.action === 'read') {
    if (!keyMatches_(req.key)) return reply_({ ok: false, error: 'key' });
    return reply_(req.action === 'classes' ? listClasses_() : readClass_(req['class']));
  }
  return reply_({ ok: false, error: 'action' });
}

/** Opening the web app's link in a browser shows that it is working (and nothing of the results). */
function doGet() {
  return reply_({ ok: true, app: 'shop-sheet', note: 'เว็บแอปรับผลของเกมร้านซ่อมคอมทำงานอยู่' });
}

function reply_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function keyMatches_(key) {
  var want = PropertiesService.getScriptProperties().getProperty(KEY_PROPERTY);
  // No key set yet: nobody can read, rather than everybody.
  return typeof key === 'string' && !!want && key === want;
}

// ---- A learner's results ----------------------------------------------------------------------------------

function isText_(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

/** The results file the game sends (src/core/results.ts resultsFile): checked enough to be stored and read back. */
function validFile_(f) {
  if (!f || typeof f !== 'object' || f.app !== 'shop-results' || f.version !== 1) return false;
  if (typeof f.exportedAt !== 'number' || !isFinite(f.exportedAt) || typeof f.check !== 'string') return false;
  var d = f.data;
  if (!d || typeof d !== 'object' || !d.learner || typeof d.learner !== 'object') return false;
  var l = d.learner;
  return isText_(l.name, 80) && isText_(l.room, 30) && isText_(l.no, 4) && /^\d{1,3}$/.test(l.no.trim());
}

function receive_(req) {
  var name = typeof req['class'] === 'string' ? req['class'].trim() : '';
  if (!CLASS_NAME.test(name) || !validFile_(req.file)) return { ok: false, error: 'shape' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'busy' };
  try {
    var sheet = classSheet_(name, true);
    if (!sheet) return { ok: false, error: 'class' };
    var l = req.file.data.learner;
    var row = rowFor_(sheet, l.room.trim(), Number(l.no.trim()));
    if (row > 0) {
      // Sends can arrive out of order (one retried after a later one): an older file never replaces a newer one.
      var had = parseFile_(sheet.getRange(row, COL.json).getValue());
      if (had && had.exportedAt > req.file.exportedAt) return { ok: true };
    } else {
      row = sheet.getLastRow() + 1;
    }
    sheet.getRange(row, 1, 1, HEADER.length).setValues([summaryRow_(req.file)]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** The row a learner wrote before, or 0. */
function rowFor_(sheet, room, no) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var keys = sheet.getRange(2, COL.room, last - 1, 2).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === room && Number(keys[i][1]) === no) return i + 2;
  }
  return 0;
}

/** What the teacher can read in the sheet itself, then the whole file for the teacher's page. */
function summaryRow_(f) {
  var d = f.data;
  var score = function (q) {
    return q && typeof q.score === 'number' && typeof q.total === 'number' ? q.score + '/' + q.total : '-';
  };
  var played = 0;
  var stars = 0;
  var cases = d.cases && typeof d.cases === 'object' ? d.cases : {};
  for (var id in cases) {
    var c = cases[id];
    if (c && typeof c.plays === 'number' && c.plays > 0) {
      played++;
      stars += typeof c.stars === 'number' ? c.stars : 0;
    }
  }
  return [
    plain_(d.learner.room.trim()),
    plain_(d.learner.no.trim()),
    plain_(d.learner.name.trim()),
    plain_(score(d.pre)),
    plain_(score(d.post)),
    played,
    stars,
    new Date(f.exportedAt),
    plain_(JSON.stringify(f)),
  ];
}

/** Text kept as text: the leading ' stops a name like =A1 or 1/2 being read as a formula, a number or a date. */
function plain_(s) {
  return "'" + s;
}

function parseFile_(cell) {
  try {
    var f = JSON.parse(String(cell));
    return f && typeof f === 'object' ? f : null;
  } catch (err) {
    return null;
  }
}

// ---- Tabs ---------------------------------------------------------------------------------------------------

/** A class's tab: one this script made (its header is ours), made now when asked to. A tab of the teacher's own
 *  with the class's name is left alone: the class gets "name (เกม)" instead, and keeps it from then on. */
function classSheet_(name, make) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var plain = book.getSheetByName(name);
  if (plain && isClassSheet_(plain)) return plain;
  var game = book.getSheetByName(name + ' (เกม)');
  if (game && isClassSheet_(game)) return game;
  if (!make) return null;
  var sheet = !plain ? book.insertSheet(name) : game || book.insertSheet(name + ' (เกม)');
  // Both names taken by tabs of the teacher's own: nothing is written over them.
  if (sheet.getLastRow() > 0) return null;
  sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function isClassSheet_(sheet) {
  return sheet.getLastRow() >= 1 && sheet.getRange(1, 1, 1, HEADER.length).getValues()[0].join('|') === HEADER.join('|');
}

/** The class a tab holds: its own name, or the name before " (เกม)". */
function className_(sheet) {
  return sheet.getName().replace(/ \(เกม\)$/, '');
}

function listClasses_() {
  var names = [];
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (isClassSheet_(sheets[i]) && names.indexOf(className_(sheets[i])) < 0) names.push(className_(sheets[i]));
  }
  return { ok: true, classes: names };
}

function readClass_(name) {
  var sheet = typeof name === 'string' ? classSheet_(name.trim(), false) : null;
  if (!sheet) return { ok: false, error: 'class' };
  var last = sheet.getLastRow();
  var cells = last < 2 ? [] : sheet.getRange(2, COL.json, last - 1, 1).getValues();
  var files = [];
  var rows = [];
  for (var i = 0; i < cells.length; i++) {
    // As text: a row the teacher broke by hand is reported by the teacher's page (by its row), not dropped here.
    var cell = String(cells[i][0]);
    if (cell.trim()) {
      files.push(cell);
      rows.push(i + 2);
    }
  }
  return { ok: true, files: files, rows: rows };
}
