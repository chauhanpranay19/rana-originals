/* Loads backend/Logic.gs into Node and gives it an in-memory fake of the sheet layer and Google services. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function loadLogic() {
  const sandbox = { console };
  vm.createContext(sandbox);
  const file = path.join(__dirname, '..', 'Logic.gs');
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: 'Logic.gs' });
  return sandbox;
}

const KEYS = { Products: 'id', Orders: 'id', Customers: 'token', Settings: 'key' };

function fakeDb() {
  const tables = { Products: [], Orders: [], Customers: [], Settings: [] };
  const clone = x => JSON.parse(JSON.stringify(x));
  return {
    tables,
    refresh() {},
    all(name) { return clone(tables[name]); },
    put(name, row) {
      const k = KEYS[name], list = tables[name], i = list.findIndex(r => r[k] === row[k]);
      if (i >= 0) list[i] = clone(row); else list.push(clone(row));
    },
    remove(name, key) { const k = KEYS[name]; tables[name] = tables[name].filter(r => r[k] !== key); },
  };
}

function fakeEnv(opts) {
  opts = opts || {};
  let clock = opts.now || Date.UTC(2026, 10, 24, 6, 0, 0);
  let locked = false;
  const cache = new Map(), props = new Map(), photos = new Map();
  if (opts.passcode) props.set('ADMIN_PASSCODE', opts.passcode);
  const env = {
    photos,
    now: () => clock,
    advance(ms) { clock += ms; },
    token: () => crypto.randomBytes(32).toString('hex'),
    hash: t => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex'),
    withLock(fn) {
      if (locked) throw new Error('nested lock');
      locked = true;
      try { return fn(); } finally { locked = false; }
    },
    cache: {
      get(k) { const e = cache.get(k); return e && e.until > clock ? e.v : null; },
      put(k, v, sec) { cache.set(k, { v, until: clock + sec * 1000 }); },
    },
    props: {
      get: k => (props.has(k) ? props.get(k) : null),
      set: (k, v) => props.set(k, String(v)),
      del: k => props.delete(k),
      keys: () => Array.from(props.keys()),
    },
    savePhoto(base64, name) {
      const id = 'f' + (photos.size + 1);
      photos.set(id, base64);
      return (opts.photoBase || 'https://example.test/photo/') + id;
    },
    log: e => { if (opts.verbose !== false) console.error(e); },
  };
  return env;
}

function makeServer(opts) {
  const L = loadLogic();
  const ctx = { db: fakeDb(), env: fakeEnv(opts) };
  L.seedIfEmpty_(ctx);
  return { L, ctx, call: req => JSON.parse(JSON.stringify(L.handleRequest(req, ctx))) };
}

module.exports = { loadLogic, fakeDb, fakeEnv, makeServer };
