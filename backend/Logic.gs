/* Rana Originals backend: business rules.
   Plain functions over a thin data layer, so they run in Apps Script and in Node tests alike.

   ctx = {
     db:  { all(table), put(table, row), remove(table, key) }       (SheetDb.gs, or the fake in test/)
     env: { now(), token(), hash(text), withLock(fn), cache, props, savePhoto(base64, name), log(err) }
   }
   Every action returns a plain object. handleRequest() adds ok:true, or turns a thrown fail_() into
   {ok:false, error:'code'}. The rules mirror assets/store.js (statuses, 15-minute hold, release rules). */

var HOLD_MS = 15 * 60 * 1000;
var ADMIN_SESSION_MS = 30 * 24 * 3600 * 1000;
var LOGIN_MAX_FAILS = 8;          // wrong passcodes allowed per window, for everyone together
var LOGIN_WINDOW_SEC = 15 * 60;
var RELEASE_STATUSES = ['expired', 'payment_not_found', 'cancelled', 'refund_due'];
var ORDER_STATUSES = ['awaiting_payment', 'verifying', 'confirmed', 'shipped', 'delivered', 'payment_not_found',
  'amount_mismatch', 'refund_due', 'refunded', 'expired', 'cancelled'];
var PUBLIC_SETTINGS = ['shopName', 'upiId', 'payeeName', 'whatsapp'];
var DEFAULT_SETTINGS = { shopName: 'Rana Originals', upiId: 'ranaoriginals@upi', payeeName: 'Atul Rana', whatsapp: '919999999999' };

/* ---------- entry point ---------- */
function handleRequest(req, ctx) {
  var now = ctx.env.now();
  try {
    if (!req || typeof req !== 'object') fail_('bad_request');
    var action = String(req.action || '');
    var t = actionTable_();
    var has = function (o) { return Object.prototype.hasOwnProperty.call(o, action); };
    if (!has(t.pub) && !has(t.admin)) fail_('unknown_action');
    if (has(t.admin)) requireAdmin_(req.session, ctx);
    var out = (has(t.pub) ? t.pub[action] : t.admin[action])(req, ctx) || {};
    out.ok = true; out.now = ctx.env.now();
    return out;
  } catch (e) {
    if (e && e.roCode) return { ok: false, error: e.roCode, now: now };
    if (ctx.env.log) ctx.env.log(e);
    return { ok: false, error: 'server', now: now };
  }
}

function actionTable_() {
  return {
    pub: { products: aProducts_, settings: aSettings_, createOrder: aCreateOrder_, submitUtr: aSubmitUtr_, order: aOrder_, myOrders: aMyOrders_, adminLogin: aAdminLogin_ },
    admin: { listOrders: aListOrders_, listProducts: aListProducts_, setOrderStatus: aSetOrderStatus_, saveProduct: aSaveProduct_, adjustStock: aAdjustStock_, deleteProduct: aDeleteProduct_, saveSettings: aSaveSettings_, adminLogout: aAdminLogout_ }
  };
}

function fail_(code) { var e = new Error(code); e.roCode = code; throw e; }

/* ---------- input checks ---------- */
function str_(v, min, max, code) {
  if (typeof v === 'number') v = String(v);
  if (typeof v !== 'string') fail_(code || 'invalid');
  v = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (v.length < min || v.length > max) fail_(code || 'invalid');
  return v;
}
function optStr_(v, max, code) { return v == null || v === '' ? '' : str_(v, 0, max, code); }
function int_(v, min, max, code) {
  var n = typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : v;
  if (typeof n !== 'number' || !isFinite(n) || Math.floor(n) !== n || n < min || n > max) fail_(code || 'invalid');
  return n;
}
function priceOrNull_(v) { return v == null || v === '' ? null : int_(v, 1, 10000000, 'invalid_price'); }
function bool_(v) { if (typeof v !== 'boolean') fail_('invalid'); return v; }
function isToken_(v) { return typeof v === 'string' && /^[a-f0-9]{32,128}$/.test(v); }

/* ---------- data helpers ---------- */
function getSetting_(ctx, key) {
  var rows = ctx.db.all('Settings');
  for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i].value;
  return undefined;
}
function setSetting_(ctx, key, value) { ctx.db.put('Settings', { key: key, value: value == null ? '' : String(value) }); }
function byId_(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function sizeOf_(p, label) { if (!p || !p.sizes) return null; for (var i = 0; i < p.sizes.length; i++) if (p.sizes[i].label === label) return p.sizes[i]; return null; }

/* Same as store.js adj(): change one size's qty, refuse to go below 0. */
function adj_(products, productId, size, delta, touched) {
  var p = byId_(products, productId); var s = sizeOf_(p, size);
  if (!s) return false;
  if (s.qty + delta < 0) return false;
  s.qty += delta; touched[p.id] = p; return true;
}
/* Same as store.js setStatus(): release stock on the release statuses, append history. */
function setStatus_(products, o, status, note, now, touched) {
  if (RELEASE_STATUSES.indexOf(status) >= 0 && o.stockHeld) {
    o.items.forEach(function (i) { adj_(products, i.productId, i.size, i.qty, touched); });
    o.stockHeld = false;
  }
  o.status = status;
  o.history.push({ status: status, at: now, note: note || '' });
}
function canHold_(products, o) {
  return o.items.every(function (i) { var s = sizeOf_(byId_(products, i.productId), i.size); return s && s.qty >= i.qty; });
}

/* Runs fn(state) under the script lock with fresh data, then writes back what changed.
   state = { products, orders, now, touchedProducts:{}, touchedOrders:{} } */
function locked_(ctx, fn) {
  return ctx.env.withLock(function () {
    if (ctx.db.refresh) ctx.db.refresh(); // never trust data read before the lock was taken
    return fn();
  });
}
function txn_(ctx, fn) {
  return locked_(ctx, function () {
    var st = { products: ctx.db.all('Products'), orders: ctx.db.all('Orders'), now: ctx.env.now(), touchedProducts: {}, touchedOrders: {} };
    sweepState_(st);
    var out = fn(st);
    Object.keys(st.touchedProducts).forEach(function (k) { ctx.db.put('Products', st.touchedProducts[k]); });
    Object.keys(st.touchedOrders).forEach(function (k) { ctx.db.put('Orders', st.touchedOrders[k]); });
    return out;
  });
}

/* Expire unpaid orders whose hold ran out, and give their stock back. */
function sweepState_(st) {
  var n = 0;
  st.orders.forEach(function (o) {
    if (o.status === 'awaiting_payment' && o.reservedUntil < st.now) {
      setStatus_(st.products, o, 'expired', 'No payment within 15 minutes, stock released', st.now, st.touchedProducts);
      st.touchedOrders[o.id] = o; n++;
    }
  });
  return n;
}
/* Cheap check without the lock first; only lock when something is actually due. */
function sweepIfNeeded_(ctx) {
  var now = ctx.env.now();
  var due = ctx.db.all('Orders').some(function (o) { return o.status === 'awaiting_payment' && o.reservedUntil < now; });
  if (due) txn_(ctx, function () { return null; });
  return due;
}
function sweepExpiredOrders(ctx) { return txn_(ctx, function () { return null; }); }

/* ---------- shapes sent to browsers ---------- */
function publicProduct_(p) {
  return { id: p.id, brand: p.brand, title: p.title, category: p.category, photos: p.photos || [], sizes: p.sizes || [],
    price: p.price, mrp: p.mrp, premium: !!p.premium, note: p.note, active: p.active !== false, createdAt: p.createdAt };
}
function orderOut_(o) {
  return { id: o.id, items: o.items, amount: o.amount,
    customer: { name: o.name, phone: o.phone, address: o.address, pincode: o.pincode },
    status: o.status, utr: o.utr || '', stockHeld: !!o.stockHeld, stockIssue: !!o.stockIssue,
    createdAt: o.createdAt, reservedUntil: o.reservedUntil, history: o.history || [] };
}
function sortNewest_(a, b) { return b.createdAt - a.createdAt; }

/* ---------- public actions ---------- */
function aProducts_(req, ctx) {
  sweepIfNeeded_(ctx);
  return { products: ctx.db.all('Products').filter(function (p) { return p.active !== false; }).sort(sortNewest_).map(publicProduct_) };
}

function aSettings_(req, ctx) {
  var out = {};
  PUBLIC_SETTINGS.forEach(function (k) { var v = getSetting_(ctx, k); out[k] = v == null || v === '' ? DEFAULT_SETTINGS[k] : String(v); });
  return { settings: out };
}

function checkCustomer_(c) {
  if (!c || typeof c !== 'object') fail_('invalid_customer');
  var phone = str_(c.phone, 10, 10, 'invalid_customer');
  if (!/^[6-9]\d{9}$/.test(phone)) fail_('invalid_customer');
  var pincode = str_(c.pincode, 6, 6, 'invalid_customer');
  if (!/^[1-9]\d{5}$/.test(pincode)) fail_('invalid_customer');
  return { name: str_(c.name, 2, 80, 'invalid_customer'), phone: phone, address: str_(c.address, 10, 400, 'invalid_customer'), pincode: pincode };
}

/* items: [{productId, size, qty}], customer: {name, phone, address, pincode}, token (optional).
   Prices and amount come only from the Products sheet. Returns {order, token?}. */
function aCreateOrder_(req, ctx) {
  if (!Array.isArray(req.items) || req.items.length < 1 || req.items.length > 10) fail_('invalid');
  var items = req.items.map(function (it) {
    if (!it || typeof it !== 'object') fail_('invalid');
    return { productId: str_(it.productId, 1, 40), size: str_(it.size, 1, 30), qty: int_(it.qty == null ? 1 : it.qty, 1, 5) };
  });
  var customer = checkCustomer_(req.customer);
  var env = ctx.env;

  // find or create the customer (by a hash of the device token; the raw token is never stored)
  var token = isToken_(req.token) ? req.token : null;
  var tokenHash = token ? env.hash(token) : null;
  var known = tokenHash && ctx.db.all('Customers').some(function (c) { return c.token === tokenHash; });
  var newToken = null;
  if (!known) { newToken = env.token(); tokenHash = env.hash(newToken); }

  var order = txn_(ctx, function (st) {
    var lines = [], err = null;
    // check against a working copy so a request asking twice for the last piece is refused
    var work = JSON.parse(JSON.stringify(st.products)), scratch = {};
    items.forEach(function (it) {
      if (err) return;
      var p = byId_(work, it.productId);
      if (!p || p.active === false) { err = 'out_of_stock'; return; }
      var s = sizeOf_(p, it.size);
      if (!s || s.qty < it.qty) { err = 'out_of_stock'; return; }
      if (p.price == null) { err = 'no_price'; return; }
      adj_(work, p.id, it.size, -it.qty, scratch);
      lines.push({ productId: p.id, brand: p.brand, title: p.title, size: it.size, qty: it.qty, price: p.price });
    });
    if (err) fail_(err);
    lines.forEach(function (l) { adj_(st.products, l.productId, l.size, -l.qty, st.touchedProducts); });
    var next = Number(getSetting_(ctx, 'nextOrder')) || 1001;
    setSetting_(ctx, 'nextOrder', next + 1);
    var o = { id: 'RO-' + next, customerToken: tokenHash, items: lines,
      amount: lines.reduce(function (n, l) { return n + l.price * l.qty; }, 0),
      name: customer.name, phone: customer.phone, address: customer.address, pincode: customer.pincode,
      status: 'awaiting_payment', utr: '', stockHeld: true, stockIssue: false,
      createdAt: st.now, reservedUntil: st.now + HOLD_MS, history: [{ status: 'awaiting_payment', at: st.now, note: '' }] };
    st.orders.push(o); st.touchedOrders[o.id] = o;
    return o;
  });

  var crow = { token: tokenHash, name: customer.name, phone: customer.phone, address: customer.address, createdAt: env.now() };
  if (known) { var old = ctx.db.all('Customers').filter(function (c) { return c.token === tokenHash; })[0]; if (old) crow.createdAt = old.createdAt; }
  ctx.db.put('Customers', crow);

  var out = { order: orderOut_(order) };
  if (newToken) out.token = newToken;
  return out;
}

/* Who may see/act on an order: the device that placed it, or the admin. */
function ownsOrder_(req, ctx, o) {
  if (!o) return false;
  if (isToken_(req.token) && o.customerToken && ctx.env.hash(req.token) === o.customerToken) return true;
  return req.session != null && adminOk_(req.session, ctx);
}

/* Customer says "I have paid" with the 12-digit UPI reference. Same rules as store.js submitUtr. */
function aSubmitUtr_(req, ctx) {
  var utr = String(req.utr == null ? '' : req.utr).replace(/\s/g, '');
  if (!/^\d{12}$/.test(utr)) fail_('invalid');
  var id = str_(req.id, 1, 20, 'not_found');
  if (!isToken_(req.token) && req.session == null) fail_('no_token');
  var isAdmin = req.session != null && adminOk_(req.session, ctx);
  return txn_(ctx, function (st) {
    var o = byId_(st.orders, id);
    if (!o || !ownsOrder_(req, ctx, o)) fail_('not_found');
    if (o.status === 'verifying' && o.utr === utr) return { order: orderOut_(o) }; // repeat of a request that already worked
    var allowed = ['awaiting_payment', 'expired', 'payment_not_found'];
    if (isAdmin) allowed.push('amount_mismatch');
    if (allowed.indexOf(o.status) < 0) fail_('bad_status');
    if (st.orders.some(function (x) { return x.id !== id && String(x.utr) === utr; })) fail_('duplicate');
    if (!o.stockHeld) {
      if (canHold_(st.products, o)) { o.items.forEach(function (i) { adj_(st.products, i.productId, i.size, -i.qty, st.touchedProducts); }); o.stockHeld = true; o.stockIssue = false; }
      else o.stockIssue = true;
    }
    o.utr = utr;
    setStatus_(st.products, o, 'verifying', o.stockIssue ? 'Paid after hold expired, item no longer in stock' : 'Customer entered UTR', st.now, st.touchedProducts);
    st.touchedOrders[o.id] = o;
    return { order: orderOut_(o) };
  });
}

function aOrder_(req, ctx) {
  if (!isToken_(req.token)) fail_('no_token');
  var id = str_(req.id, 1, 20, 'not_found');
  sweepIfNeeded_(ctx);
  var o = byId_(ctx.db.all('Orders'), id);
  if (!o || !o.customerToken || ctx.env.hash(req.token) !== o.customerToken) fail_('not_found');
  return { order: orderOut_(o) };
}

function aMyOrders_(req, ctx) {
  if (!isToken_(req.token)) fail_('no_token');
  sweepIfNeeded_(ctx);
  var h = ctx.env.hash(req.token);
  return { orders: ctx.db.all('Orders').filter(function (o) { return o.customerToken === h; }).sort(sortNewest_).map(orderOut_) };
}

/* ---------- admin login ---------- */
function passcodeVersion_(pass, ctx) { return ctx.env.hash('v:' + pass).slice(0, 12); }

function aAdminLogin_(req, ctx) {
  var pass = typeof req.passcode === 'string' ? req.passcode : '';
  if (!pass || pass.length > 100) fail_('wrong_passcode');
  var real = ctx.env.props.get('ADMIN_PASSCODE');
  if (!real) fail_('not_configured');
  var fails = Number(ctx.env.cache.get('login_fails') || 0);
  if (fails >= LOGIN_MAX_FAILS) fail_('too_many_attempts');
  if (ctx.env.hash(pass) !== ctx.env.hash(String(real))) {
    ctx.env.cache.put('login_fails', String(fails + 1), LOGIN_WINDOW_SEC);
    fail_('wrong_passcode');
  }
  var now = ctx.env.now();
  // forget expired sessions
  ctx.env.props.keys().forEach(function (k) {
    if (k.indexOf('adm_') === 0) { var exp = Number(String(ctx.env.props.get(k)).split('|')[0]); if (!(exp > now)) ctx.env.props.del(k); }
  });
  var token = ctx.env.token();
  var exp = now + ADMIN_SESSION_MS;
  ctx.env.props.set('adm_' + ctx.env.hash(token).slice(0, 40), exp + '|' + passcodeVersion_(String(real), ctx));
  return { session: token, expiresAt: exp };
}

/* A session is valid if it exists, has not expired, and the passcode has not changed since. */
function adminOk_(session, ctx) {
  if (!isToken_(session)) return false;
  var v = ctx.env.props.get('adm_' + ctx.env.hash(session).slice(0, 40));
  if (!v) return false;
  var parts = String(v).split('|');
  var real = ctx.env.props.get('ADMIN_PASSCODE');
  return Number(parts[0]) > ctx.env.now() && !!real && parts[1] === passcodeVersion_(String(real), ctx);
}
function requireAdmin_(session, ctx) { if (!adminOk_(session, ctx)) fail_('unauthorized'); }

function aAdminLogout_(req, ctx) { ctx.env.props.del('adm_' + ctx.env.hash(req.session).slice(0, 40)); return {}; }

/* ---------- admin actions ---------- */
function aListOrders_(req, ctx) {
  sweepIfNeeded_(ctx);
  return { orders: ctx.db.all('Orders').sort(sortNewest_).map(orderOut_) };
}
function aListProducts_(req, ctx) {
  sweepIfNeeded_(ctx);
  return { products: ctx.db.all('Products').sort(sortNewest_).map(publicProduct_) };
}

/* ids: one id or a list (bulk buttons). Same release rules as store.js. */
function aSetOrderStatus_(req, ctx) {
  var ids = Array.isArray(req.ids) ? req.ids : req.id != null ? [req.id] : null;
  if (!ids || !ids.length || ids.length > 100) fail_('invalid');
  ids = ids.map(function (x) { return str_(x, 1, 20); });
  var status = String(req.status || '');
  if (ORDER_STATUSES.indexOf(status) < 0) fail_('invalid_status');
  var note = optStr_(req.note, 200);
  return txn_(ctx, function (st) {
    var done = [];
    ids.forEach(function (id) {
      var o = byId_(st.orders, id); if (!o) return;
      setStatus_(st.products, o, status, note, st.now, st.touchedProducts);
      st.touchedOrders[o.id] = o; done.push(orderOut_(o));
    });
    if (!done.length) fail_('not_found');
    return { orders: done };
  });
}

/* Checks one photo value. Returns {keep: url} or {upload: base64}. */
function checkPhoto_(v) {
  if (typeof v !== 'string') fail_('invalid_photo');
  var m = /^data:image\/jpe?g;base64,([A-Za-z0-9+\/=]+)$/.exec(v);
  if (m) { if (m[1].length > 4 * 1024 * 1024) fail_('photo_too_big'); return { upload: m[1] }; }
  if (/^https:\/\/[^\s"'<>]{8,600}$/.test(v)) return { keep: v };
  var rel = v.replace(/^(\.\.\/)+/, '').replace(/^\.?\//, '');
  if (/^photos\/[A-Za-z0-9_\-\/.]{1,200}$/.test(rel) && rel.indexOf('..') < 0) return { keep: rel };
  fail_('invalid_photo');
}
function checkSizes_(list) {
  if (!Array.isArray(list) || list.length > 30) fail_('invalid_sizes');
  var seen = {};
  return list.map(function (s) {
    if (!s || typeof s !== 'object') fail_('invalid_sizes');
    var label = str_(s.label, 1, 30, 'invalid_sizes');
    if (seen[label]) fail_('invalid_sizes'); seen[label] = 1;
    return { label: label, qty: int_(s.qty, 0, 999, 'invalid_sizes') };
  });
}

/* Create (no id) or update (id) a product. New photos arrive as base64 JPEG and are stored in Drive. */
function aSaveProduct_(req, ctx) {
  var p = req.product;
  if (!p || typeof p !== 'object') fail_('invalid');
  var isNew = p.id == null || p.id === '';
  var id = isNew ? null : str_(p.id, 1, 40);
  var fields = {};
  if ('brand' in p) fields.brand = optStr_(p.brand, 60);
  if ('title' in p) fields.title = str_(p.title, 1, 120, 'invalid_title');
  if ('category' in p) fields.category = optStr_(p.category, 40);
  if ('note' in p) fields.note = optStr_(p.note, 200);
  if ('price' in p) fields.price = priceOrNull_(p.price);
  if ('mrp' in p) fields.mrp = priceOrNull_(p.mrp);
  if ('premium' in p) fields.premium = bool_(p.premium);
  if ('active' in p) fields.active = bool_(p.active);
  if ('sizes' in p) fields.sizes = checkSizes_(p.sizes);
  var photoPlan = null;
  if ('photos' in p) {
    if (!Array.isArray(p.photos) || p.photos.length > 20) fail_('too_many_photos');
    photoPlan = p.photos.map(checkPhoto_);
  }
  if (isNew && !fields.title) fail_('invalid_title');

  // Upload before taking the lock: Drive is slow and nobody else needs to wait for it.
  if (photoPlan) {
    var stamp = ctx.env.now();
    fields.photos = photoPlan.map(function (ph, i) { return ph.keep || ctx.env.savePhoto(ph.upload, 'item-' + stamp + '-' + (i + 1) + '.jpg'); });
  }

  return txn_(ctx, function (st) {
    var row;
    if (isNew) {
      row = { id: 'p' + st.now + Math.floor(Math.random() * 1000), brand: '', title: '', category: 'Other', photos: [], sizes: [],
        price: null, mrp: null, premium: false, note: '', active: true, createdAt: st.now };
      Object.keys(fields).forEach(function (k) { row[k] = fields[k]; });
      st.products.push(row);
    } else {
      row = byId_(st.products, id);
      if (!row) fail_('not_found');
      Object.keys(fields).forEach(function (k) { row[k] = fields[k]; });
    }
    st.touchedProducts[row.id] = row;
    return { product: publicProduct_(row) };
  });
}

function aAdjustStock_(req, ctx) {
  var id = str_(req.id, 1, 40), size = str_(req.size, 1, 30), delta = int_(req.delta, -99, 99);
  if (!delta) fail_('invalid');
  return txn_(ctx, function (st) {
    if (!byId_(st.products, id)) fail_('not_found');
    if (!adj_(st.products, id, size, delta, st.touchedProducts)) fail_('out_of_stock');
    return { product: publicProduct_(byId_(st.products, id)) };
  });
}

function aDeleteProduct_(req, ctx) {
  var id = str_(req.id, 1, 40);
  return locked_(ctx, function () {
    if (!byId_(ctx.db.all('Products'), id)) fail_('not_found');
    ctx.db.remove('Products', id);
    return {};
  });
}

function aSaveSettings_(req, ctx) {
  var s = req.settings;
  if (!s || typeof s !== 'object') fail_('invalid');
  var out = {};
  if ('shopName' in s) out.shopName = str_(s.shopName, 1, 60, 'invalid_settings');
  if ('payeeName' in s) out.payeeName = str_(s.payeeName, 1, 60, 'invalid_settings');
  if ('upiId' in s) { out.upiId = str_(s.upiId, 3, 80, 'invalid_settings'); if (!/^[\w.\-]+@[\w.\-]+$/.test(out.upiId)) fail_('invalid_settings'); }
  if ('whatsapp' in s) { out.whatsapp = str_(s.whatsapp, 10, 13, 'invalid_settings'); if (!/^\d{10,13}$/.test(out.whatsapp)) fail_('invalid_settings'); }
  return locked_(ctx, function () {
    Object.keys(out).forEach(function (k) { setSetting_(ctx, k, out[k]); });
    return aSettings_(req, ctx);
  });
}

/* ---------- seed data (same six items as store.js, photos as site-relative paths) ---------- */
function seedProducts_(now) {
  var ph = function (lot, nums) { return nums.map(function (n) { return 'photos/web/lot' + lot + '-' + n + '.jpg'; }); };
  return [
    { id: 'p1', brand: 'Ralph Lauren', title: 'Original Polo Full Sleeve Shirt', category: 'Shirts', photos: ph(1, [4, 2, 3, 5]), sizes: [{ label: '43', qty: 2 }, { label: '44', qty: 1 }], price: 1499, mrp: 8999, premium: false, note: '', active: true, createdAt: now - 1e6 },
    { id: 'p2', brand: 'Harley-Davidson', title: 'Original Shirt', category: 'Shirts', photos: ph(2, [1, 2, 3, 4, 5, 6]), sizes: [{ label: '43', qty: 1 }], price: 1299, mrp: 6499, premium: false, note: '', active: true, createdAt: now - 2e6 },
    { id: 'p3', brand: 'Adidas Originals', title: 'Women Track Pants', category: 'Bottoms', photos: ph(3, [1, 2, 3, 4, 5]), sizes: [{ label: 'S', qty: 2 }, { label: 'M', qty: 2 }], price: 899, mrp: 3599, premium: false, note: '', active: true, createdAt: now - 3e6 },
    { id: 'p4', brand: 'Puma', title: 'Original Kids Hoodie', category: 'Kids', photos: ph(4, [1, 2, 3, 4]), sizes: [{ label: '7-8Y', qty: 2 }], price: 699, mrp: null, premium: false, note: 'Age 7 to 8 years', active: true, createdAt: now - 4e6 },
    { id: 'p5', brand: 'Adidas Originals', title: 'Gazelle Boost 85 Suede Leather Sneakers', category: 'Shoes', photos: ph(5, [1, 2, 3, 4]), sizes: [{ label: 'UK 9', qty: 1 }], price: null, mrp: null, premium: true, note: 'With box', active: true, createdAt: now - 5e6 },
    { id: 'p6', brand: 'Adidas Originals', title: 'Bape Stan Smith', category: 'Shoes', photos: ph(6, [1, 2, 3, 4, 5, 6, 7]), sizes: [{ label: 'UK 11', qty: 1 }], price: null, mrp: null, premium: true, note: 'With box', active: true, createdAt: now - 6e6 }
  ];
}

/* Fill empty tables. Safe to run twice: only adds what is missing. */
function seedIfEmpty_(ctx) {
  if (!ctx.db.all('Products').length) seedProducts_(ctx.env.now()).forEach(function (p) { ctx.db.put('Products', p); });
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { if (getSetting_(ctx, k) == null) setSetting_(ctx, k, DEFAULT_SETTINGS[k]); });
  if (getSetting_(ctx, 'nextOrder') == null) setSetting_(ctx, 'nextOrder', 1001);
}
