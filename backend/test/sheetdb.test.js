/* Checks SheetDb.gs (the real sheet layer) against a tiny fake of a Google Sheet.
   It cannot prove how real Sheets treats values; it checks our row/column bookkeeping.
   Run:  node backend/test/sheetdb.test.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function fakeSheet(rows) {
  const data = rows.map(r => r.slice());
  const strip = v => (typeof v === 'string' && v[0] === "'" ? v.slice(1) : v); // what Sheets shows for 'text
  return {
    data,
    getDataRange: () => ({ getValues: () => data.map(r => r.map(strip)) }),
    getRange: (r, c, h, w) => ({
      getValues: () => [Array.from({ length: w }, (_, i) => strip((data[r - 1] || [])[c - 1 + i] ?? ''))],
      setValues: v => { data[r - 1] = data[r - 1] || []; v[0].forEach((x, i) => { data[r - 1][c - 1 + i] = x; }); },
    }),
    appendRow: line => data.push(line.slice()),
    getLastRow: () => data.length,
    deleteRow: r => data.splice(r - 1, 1),
  };
}

const ctx = { console, JSON };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'SheetDb.gs'), 'utf8'), ctx);
const head = ctx.SCHEMA.Products.cols.map(c => c[0]);
const sheets = {
  Products: fakeSheet([head.concat(['ownerNotes'])]),
  Settings: fakeSheet([['key', 'value']]),
};
const db = ctx.makeSheetDb_({ getSheetByName: n => sheets[n] || null });

db.put('Products', { id: 'p1', brand: '=HYPERLINK("x")', title: '0123', category: 'Shirts', photos: ['photos/web/a.jpg'], sizes: [{ label: '43', qty: 2 }], price: 1499, mrp: null, premium: false, note: '', active: true, createdAt: 5 });
db.put('Products', { id: 'p2', brand: 'B', title: 'T2', category: 'X', photos: [], sizes: [], price: null, mrp: null, premium: true, note: 'n', active: false, createdAt: 6 });
assert.strictEqual(sheets.Products.data[1][1], "'=HYPERLINK(\"x\")", 'text written with apostrophe, so never a formula');
sheets.Products.data[1][head.length] = 'owner note';
db.put('Products', { id: 'p1', brand: 'Ralph', title: '0123', category: 'Shirts', photos: ['photos/web/a.jpg'], sizes: [{ label: '43', qty: 1 }], price: 1499, mrp: null, premium: false, note: '', active: true, createdAt: 5 });
assert.strictEqual(sheets.Products.data.length, 3, 'update did not add a row');
assert.strictEqual(sheets.Products.data[1][head.length], 'owner note', 'unknown columns kept');

db.refresh();
const rows = db.all('Products');
assert.strictEqual(rows.length, 2);
assert.deepStrictEqual(rows[0].sizes, [{ label: '43', qty: 1 }]);
assert.strictEqual(rows[0].title, '0123', 'leading zero kept as text');
assert.strictEqual(rows[1].price, null);
assert.strictEqual(rows[1].active, false);
db.remove('Products', 'p1');
assert.deepStrictEqual(db.all('Products').map(p => p.id), ['p2']);
db.put('Settings', { key: 'nextOrder', value: '1001' });
db.put('Settings', { key: 'nextOrder', value: '1002' });
assert.deepStrictEqual(db.all('Settings'), [{ key: 'nextOrder', value: '1002' }]);
console.log('SheetDb layer: all checks passed');
