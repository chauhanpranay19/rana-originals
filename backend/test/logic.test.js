/* Business-logic tests against an in-memory fake of the sheet layer.
   Run:  node backend/test/logic.test.js */
'use strict';
const assert = require('assert');
const { makeServer } = require('./harness');

const PASS = 'test-only-' + Math.random().toString(36).slice(2); // made up per run, never stored
const cust = (phone) => ({ name: 'Test Buyer', phone: phone || '9876543210', address: '12 Test Street, Test Nagar 110001', pincode: '110001' });
const qty = (s, id, size) => s.ctx.db.tables.Products.find(p => p.id === id).sizes.find(x => x.label === size).qty;
const login = s => s.call({ action: 'adminLogin', passcode: PASS }).session;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.message)); }
}

console.log('Rana Originals backend logic');

test('create order reserves stock and returns a 128+ bit token', () => {
  const s = makeServer({ passcode: PASS });
  const r = s.call({ action: 'createOrder', items: [{ productId: 'p1', size: '44', qty: 1 }], customer: cust() });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.order.status, 'awaiting_payment');
  assert.strictEqual(qty(s, 'p1', '44'), 0);
  assert.ok(/^[a-f0-9]{64}$/.test(r.token), 'token is 64 hex chars (256 bits)');
  assert.ok(!s.ctx.db.tables.Customers.some(c => c.token === r.token), 'raw token not stored');
  assert.strictEqual(r.order.reservedUntil - r.order.createdAt, 15 * 60 * 1000);
});

test('second buyer for the last piece is refused', () => {
  const s = makeServer({ passcode: PASS });
  const a = s.call({ action: 'createOrder', items: [{ productId: 'p2', size: '43', qty: 1 }], customer: cust() });
  const b = s.call({ action: 'createOrder', items: [{ productId: 'p2', size: '43', qty: 1 }], customer: cust('9123456780') });
  assert.strictEqual(a.ok, true);
  assert.deepStrictEqual([b.ok, b.error], [false, 'out_of_stock']);
  assert.strictEqual(qty(s, 'p2', '43'), 0);
});

test('one request asking twice for the last piece is refused, nothing reserved', () => {
  const s = makeServer({ passcode: PASS });
  const r = s.call({ action: 'createOrder', items: [{ productId: 'p2', size: '43', qty: 1 }, { productId: 'p2', size: '43', qty: 1 }], customer: cust() });
  assert.strictEqual(r.error, 'out_of_stock');
  assert.strictEqual(qty(s, 'p2', '43'), 1);
});

test('"Ask price" items cannot be ordered', () => {
  const s = makeServer({ passcode: PASS });
  const r = s.call({ action: 'createOrder', items: [{ productId: 'p5', size: 'UK 9', qty: 1 }], customer: cust() });
  assert.strictEqual(r.error, 'no_price');
  assert.strictEqual(qty(s, 'p5', 'UK 9'), 1);
});

test('expiry after 15 minutes releases stock (swept by the next call)', () => {
  const s = makeServer({ passcode: PASS });
  const r = s.call({ action: 'createOrder', items: [{ productId: 'p2', size: '43', qty: 1 }], customer: cust() });
  s.ctx.env.advance(15 * 60 * 1000 + 1);
  const list = s.call({ action: 'products' });
  assert.strictEqual(list.products.find(p => p.id === 'p2').sizes[0].qty, 1);
  const o = s.call({ action: 'order', id: r.order.id, token: r.token });
  assert.strictEqual(o.order.status, 'expired');
  assert.strictEqual(o.order.stockHeld, false);
});

test('time trigger sweep also expires orders', () => {
  const s = makeServer({ passcode: PASS });
  s.call({ action: 'createOrder', items: [{ productId: 'p2', size: '43', qty: 1 }], customer: cust() });
  s.ctx.env.advance(16 * 60 * 1000);
  s.L.sweepExpiredOrders(s.ctx);
  assert.strictEqual(qty(s, 'p2', '43'), 1);
  assert.strictEqual(s.ctx.db.tables.Orders[0].status, 'expired');
});

test('UTR: valid one moves to verifying; duplicate on another order refused; bad format refused', () => {
  const s = makeServer({ passcode: PASS });
  const a = s.call({ action: 'createOrder', items: [{ productId: 'p3', size: 'M', qty: 1 }], customer: cust() });
  const b = s.call({ action: 'createOrder', items: [{ productId: 'p3', size: 'S', qty: 1 }], customer: cust(), token: a.token });
  assert.strictEqual(b.token, undefined, 'known device keeps its token');
  const u1 = s.call({ action: 'submitUtr', id: a.order.id, utr: '1234 5678 9012', token: a.token });
  assert.strictEqual(u1.order.status, 'verifying');
  const u2 = s.call({ action: 'submitUtr', id: b.order.id, utr: '123456789012', token: a.token });
  assert.strictEqual(u2.error, 'duplicate');
  assert.strictEqual(s.call({ action: 'submitUtr', id: b.order.id, utr: '12345', token: a.token }).error, 'invalid');
  const again = s.call({ action: 'submitUtr', id: a.order.id, utr: '123456789012', token: a.token });
  assert.strictEqual(again.ok, true, 'repeating a request that worked is harmless');
});

test('paying after expiry: re-holds if still in stock, stockIssue if gone', () => {
  const s = makeServer({ passcode: PASS });
  const a = s.call({ action: 'createOrder', items: [{ productId: 'p2', size: '43', qty: 1 }], customer: cust() });
  s.ctx.env.advance(16 * 60 * 1000);
  const b = s.call({ action: 'createOrder', items: [{ productId: 'p2', size: '43', qty: 1 }], customer: cust('9123456780') });
  assert.strictEqual(b.ok, true, 'released piece can be bought by someone else');
  const late = s.call({ action: 'submitUtr', id: a.order.id, utr: '555566667777', token: a.token });
  assert.strictEqual(late.order.status, 'verifying');
  assert.strictEqual(late.order.stockIssue, true);
  assert.strictEqual(late.order.stockHeld, false);
  assert.strictEqual(qty(s, 'p2', '43'), 0);

  const c = s.call({ action: 'createOrder', items: [{ productId: 'p1', size: '43', qty: 1 }], customer: cust() });
  s.ctx.env.advance(16 * 60 * 1000);
  const ok = s.call({ action: 'submitUtr', id: c.order.id, utr: '111122223333', token: c.token });
  assert.strictEqual(ok.order.stockIssue, false);
  assert.strictEqual(ok.order.stockHeld, true);
  assert.strictEqual(qty(s, 'p1', '43'), 1);
});

test('amounts come from server prices, not the browser', () => {
  const s = makeServer({ passcode: PASS });
  const r = s.call({ action: 'createOrder', items: [{ productId: 'p1', size: '43', qty: 2, price: 1 }], customer: cust(), amount: 1 });
  assert.strictEqual(r.order.amount, 1499 * 2);
  assert.strictEqual(r.order.items[0].price, 1499);
});

test('order and myOrders need the right token; nobody sees other customers', () => {
  const s = makeServer({ passcode: PASS });
  const a = s.call({ action: 'createOrder', items: [{ productId: 'p1', size: '43', qty: 1 }], customer: cust() });
  const b = s.call({ action: 'createOrder', items: [{ productId: 'p3', size: 'S', qty: 1 }], customer: cust() }); // same phone, other device
  assert.strictEqual(s.call({ action: 'order', id: a.order.id }).error, 'no_token');
  assert.strictEqual(s.call({ action: 'myOrders' }).error, 'no_token');
  assert.strictEqual(s.call({ action: 'myOrders', phone: '9876543210' }).error, 'no_token');
  assert.strictEqual(s.call({ action: 'order', id: a.order.id, token: b.token }).error, 'not_found');
  assert.strictEqual(s.call({ action: 'submitUtr', id: a.order.id, utr: '999988887777', token: b.token }).error, 'not_found');
  const mine = s.call({ action: 'myOrders', token: a.token });
  assert.deepStrictEqual(mine.orders.map(o => o.id), [a.order.id]);
  assert.ok(!('customerToken' in mine.orders[0]));
  assert.strictEqual(s.call({ action: 'order', id: a.order.id, token: a.token }).order.id, a.order.id);
});

test('public products and settings hide private data', () => {
  const s = makeServer({ passcode: PASS });
  const sess = login(s);
  s.call({ action: 'saveProduct', session: sess, product: { id: 'p6', active: false } });
  const pub = s.call({ action: 'products' });
  assert.ok(!pub.products.some(p => p.id === 'p6'), 'hidden item not public');
  const st = s.call({ action: 'settings' }).settings;
  assert.deepStrictEqual(Object.keys(st).sort(), ['payeeName', 'shopName', 'upiId', 'whatsapp']);
  assert.strictEqual(s.call({ action: 'listProducts', session: sess }).products.length, 6);
});

test('admin actions refused without a valid session', () => {
  const s = makeServer({ passcode: PASS });
  const acts = ['listOrders', 'listProducts', 'setOrderStatus', 'saveProduct', 'adjustStock', 'deleteProduct', 'saveSettings'];
  acts.forEach(a => {
    assert.strictEqual(s.call({ action: a }).error, 'unauthorized', a + ' without session');
    assert.strictEqual(s.call({ action: a, session: 'ab'.repeat(32) }).error, 'unauthorized', a + ' with made-up session');
  });
  assert.strictEqual(qty(s, 'p1', '43'), 2);
});

test('admin login: wrong passcode, throttling, session expiry and passcode change', () => {
  const s = makeServer({ passcode: PASS });
  assert.strictEqual(s.call({ action: 'adminLogin', passcode: 'nope' }).error, 'wrong_passcode');
  const sess = login(s);
  assert.ok(/^[a-f0-9]{64}$/.test(sess));
  assert.strictEqual(s.call({ action: 'listOrders', session: sess }).ok, true);
  for (let i = 0; i < 10; i++) s.call({ action: 'adminLogin', passcode: 'nope' + i });
  assert.strictEqual(s.call({ action: 'adminLogin', passcode: PASS }).error, 'too_many_attempts');
  s.ctx.env.advance(16 * 60 * 1000);
  assert.ok(login(s), 'allowed again after the window');
  s.ctx.env.advance(31 * 24 * 3600 * 1000);
  assert.strictEqual(s.call({ action: 'listOrders', session: sess }).error, 'unauthorized', 'expired after 30 days');
  const s2 = login(s);
  s.ctx.env.props.set('ADMIN_PASSCODE', PASS + 'x');
  assert.strictEqual(s.call({ action: 'listOrders', session: s2 }).error, 'unauthorized', 'changing passcode logs out');
});

test('admin: bulk status, release rules, stock, product save with photo, settings', () => {
  const s = makeServer({ passcode: PASS });
  const sess = login(s);
  const a = s.call({ action: 'createOrder', items: [{ productId: 'p3', size: 'M', qty: 1 }], customer: cust() });
  const b = s.call({ action: 'createOrder', items: [{ productId: 'p3', size: 'S', qty: 1 }], customer: cust() });
  s.call({ action: 'submitUtr', id: a.order.id, utr: '100000000001', token: a.token });
  s.call({ action: 'submitUtr', id: b.order.id, utr: '100000000002', token: b.token });
  const bulk = s.call({ action: 'setOrderStatus', session: sess, ids: [a.order.id, b.order.id], status: 'confirmed', note: 'Money received' });
  assert.deepStrictEqual(bulk.orders.map(o => o.status), ['confirmed', 'confirmed']);
  s.call({ action: 'setOrderStatus', session: sess, ids: [b.order.id], status: 'refund_due' });
  assert.strictEqual(qty(s, 'p3', 'S'), 2, 'refund_due releases stock');
  assert.strictEqual(s.call({ action: 'setOrderStatus', session: sess, ids: [a.order.id], status: 'bogus' }).error, 'invalid_status');
  assert.strictEqual(s.call({ action: 'adjustStock', session: sess, id: 'p4', size: '7-8Y', delta: -3 }).error, 'out_of_stock');
  assert.strictEqual(s.call({ action: 'adjustStock', session: sess, id: 'p4', size: '7-8Y', delta: -1 }).product.sizes[0].qty, 1);
  const saved = s.call({ action: 'saveProduct', session: sess, product: { brand: 'Nike', title: 'Air Tee', category: 'T-Shirts', price: 999, sizes: [{ label: 'M', qty: 1 }], photos: ['data:image/jpeg;base64,/9j/AAAA', '../photos/web/lot1-1.jpg'] } });
  assert.strictEqual(saved.ok, true, JSON.stringify(saved));
  assert.deepStrictEqual(saved.product.photos, ['https://example.test/photo/f1', 'photos/web/lot1-1.jpg']);
  assert.ok(s.call({ action: 'products' }).products.some(p => p.id === saved.product.id));
  assert.strictEqual(s.call({ action: 'saveProduct', session: sess, product: { title: 'X', photos: ['javascript:alert(1)'] } }).error, 'invalid_photo');
  assert.strictEqual(s.call({ action: 'saveProduct', session: sess, product: { title: 'X', price: -5 } }).error, 'invalid_price');
  assert.strictEqual(s.call({ action: 'deleteProduct', session: sess, id: saved.product.id }).ok, true);
  assert.strictEqual(s.call({ action: 'saveSettings', session: sess, settings: { upiId: 'shop@okaxis' } }).settings.upiId, 'shop@okaxis');
  assert.strictEqual(s.call({ action: 'saveSettings', session: sess, settings: { upiId: 'bad' } }).error, 'invalid_settings');
});

test('admin can re-hold for a late payment via submitUtr (amount_mismatch path)', () => {
  const s = makeServer({ passcode: PASS });
  const sess = login(s);
  const a = s.call({ action: 'createOrder', items: [{ productId: 'p1', size: '43', qty: 1 }], customer: cust() });
  s.call({ action: 'submitUtr', id: a.order.id, utr: '200000000001', token: a.token });
  s.call({ action: 'setOrderStatus', session: sess, ids: [a.order.id], status: 'payment_not_found' });
  assert.strictEqual(qty(s, 'p1', '43'), 2);
  const r = s.call({ action: 'submitUtr', id: a.order.id, utr: '200000000001', session: sess });
  assert.strictEqual(r.order.stockHeld, true);
  assert.strictEqual(qty(s, 'p1', '43'), 1);
});

test('input validation and length limits', () => {
  const s = makeServer({ passcode: PASS });
  const bad = [
    { items: [], customer: cust() },
    { items: [{ productId: 'p1', size: '43', qty: 99 }], customer: cust() },
    { items: [{ productId: 'p1', size: '43', qty: 1 }], customer: Object.assign(cust(), { phone: '12345' }) },
    { items: [{ productId: 'p1', size: '43', qty: 1 }], customer: Object.assign(cust(), { name: 'x'.repeat(500) }) },
    { items: [{ productId: 'p1', size: '43', qty: 1 }], customer: Object.assign(cust(), { pincode: '012345' }) },
    { items: 'nope', customer: cust() },
  ];
  bad.forEach((b, i) => assert.strictEqual(s.call(Object.assign({ action: 'createOrder' }, b)).ok, false, 'case ' + i));
  assert.strictEqual(s.call({ action: 'nope' }).error, 'unknown_action');
  assert.strictEqual(s.call({ action: 'constructor' }).error, 'unknown_action');
  assert.strictEqual(qty(s, 'p1', '43'), 2);
});

test('setup seeding is safe to run twice', () => {
  const s = makeServer({ passcode: PASS });
  s.L.seedIfEmpty_(s.ctx);
  assert.strictEqual(s.ctx.db.tables.Products.length, 6);
  assert.strictEqual(s.ctx.db.tables.Settings.filter(r => r.key === 'nextOrder').length, 1);
  assert.ok(s.ctx.db.tables.Products[0].photos[0].startsWith('photos/web/'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
