/* Thin sheet-access layer: turns sheet rows into plain objects and back.
   Interface used by Logic.gs:  all(table) -> [rows],  put(table, row) (insert or update by key),  remove(table, key).
   Column types: text (kept as text, never turned into numbers, dates or formulas), num, bool, json. */

var SCHEMA = {
  Products: { key: 'id', cols: [
    ['id', 'text'], ['brand', 'text'], ['title', 'text'], ['category', 'text'], ['photos', 'json'], ['sizes', 'json'],
    ['price', 'num'], ['mrp', 'num'], ['premium', 'bool'], ['note', 'text'], ['active', 'bool'], ['createdAt', 'num']] },
  Orders: { key: 'id', cols: [
    ['id', 'text'], ['customerToken', 'text'], ['items', 'json'], ['amount', 'num'], ['name', 'text'], ['phone', 'text'],
    ['address', 'text'], ['pincode', 'text'], ['status', 'text'], ['utr', 'text'], ['stockHeld', 'bool'], ['stockIssue', 'bool'],
    ['createdAt', 'num'], ['reservedUntil', 'num'], ['history', 'json']] },
  Customers: { key: 'token', cols: [['token', 'text'], ['name', 'text'], ['phone', 'text'], ['address', 'text'], ['createdAt', 'num']] },
  Settings: { key: 'key', cols: [['key', 'text'], ['value', 'text']] }
};

function fromCell_(v, type) {
  if (type === 'num') return v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
  if (type === 'bool') return v === true || String(v).toUpperCase() === 'TRUE';
  if (type === 'json') { try { return v === '' || v == null ? (null) : JSON.parse(String(v)); } catch (e) { return null; } }
  var s = v == null ? '' : String(v);
  return s.charAt(0) === "'" ? s.slice(1) : s; // defensive: a leading apostrophe is only an escape
}
function toCell_(v, type) {
  if (type === 'num') return v == null || v === '' ? '' : Number(v);
  if (type === 'bool') return !!v;
  if (type === 'json') return JSON.stringify(v == null ? null : v);
  var s = v == null ? '' : String(v);
  // A leading apostrophe makes Sheets keep the value as plain text: no formulas, no number/date guessing.
  return s === '' ? '' : "'" + s;
}

function makeSheetDb_(spreadsheet) {
  var ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var memo = {};

  function load(name) {
    if (memo[name]) return memo[name];
    var spec = SCHEMA[name];
    var sh = ss.getSheetByName(name);
    if (!sh) throw new Error('Sheet "' + name + '" is missing. Run setup() once.');
    var values = sh.getDataRange().getValues();
    var head = (values[0] || []).map(function (h) { return String(h).trim(); });
    var colIndex = {};
    spec.cols.forEach(function (c) { colIndex[c[0]] = head.indexOf(c[0]); });
    var rows = [], rowOf = {};
    for (var r = 1; r < values.length; r++) {
      var obj = {};
      spec.cols.forEach(function (c) { var i = colIndex[c[0]]; obj[c[0]] = fromCell_(i >= 0 ? values[r][i] : '', c[1]); });
      if (obj[spec.key] === '' || obj[spec.key] == null) continue; // blank row
      rows.push(obj); rowOf[obj[spec.key]] = r + 1;
    }
    memo[name] = { sh: sh, head: head, colIndex: colIndex, rows: rows, rowOf: rowOf, width: Math.max(head.length, 1) };
    return memo[name];
  }

  return {
    refresh: function () { memo = {}; },
    all: function (name) { return JSON.parse(JSON.stringify(load(name).rows)); },
    put: function (name, obj) {
      var t = load(name), spec = SCHEMA[name], key = obj[spec.key];
      var line = [];
      for (var i = 0; i < t.width; i++) line.push('');
      var at = t.rowOf[key];
      if (at) { // keep cells in columns we do not know about (owner's own notes)
        var cur = t.sh.getRange(at, 1, 1, t.width).getValues()[0];
        line = cur.slice();
      }
      spec.cols.forEach(function (c) { var i = t.colIndex[c[0]]; if (i >= 0) line[i] = toCell_(obj[c[0]], c[1]); });
      if (at) t.sh.getRange(at, 1, 1, t.width).setValues([line]);
      else { t.sh.appendRow(line); at = t.sh.getLastRow(); t.rowOf[key] = at; }
      var copy = JSON.parse(JSON.stringify(obj));
      var idx = -1;
      for (var j = 0; j < t.rows.length; j++) if (t.rows[j][spec.key] === key) idx = j;
      if (idx >= 0) t.rows[idx] = copy; else t.rows.push(copy);
    },
    remove: function (name, key) {
      var t = load(name), at = t.rowOf[key];
      if (at) t.sh.deleteRow(at);
      delete memo[name]; // row numbers shifted; read again next time
    }
  };
}
