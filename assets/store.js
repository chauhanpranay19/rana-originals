/* Rana Originals demo data layer.
   Everything lives in localStorage so the shop and the admin (same browser) share one "database".
   Later this file is the only thing that changes: same API, backed by Google Sheets + Apps Script.
   Exposes one global: Store */
(function () {
  const KEY = 'ro_demo_v2'; // bumped: v1 demo data is dropped
  const HOLD_MS = 15 * 60 * 1000; // stock is held this long while the customer pays
  const RELEASE = ['expired', 'payment_not_found', 'cancelled', 'refund_due'];

  const STATUS = {
    awaiting_payment: 'Waiting for payment',
    verifying: 'Checking payment',
    confirmed: 'Payment received',
    shipped: 'Shipped',
    delivered: 'Delivered',
    payment_not_found: 'Payment not found',
    amount_mismatch: 'Wrong amount paid',
    refund_due: 'Refund due',
    refunded: 'Refunded',
    expired: 'Hold expired',
    cancelled: 'Cancelled',
  };

  function img(label, bg) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="' + bg + '"/>' +
      '<circle cx="300" cy="250" r="120" fill="rgba(255,255,255,.12)"/>' +
      '<text x="300" y="265" font-family="Helvetica,Arial,sans-serif" font-size="44" font-weight="700" fill="#fff" text-anchor="middle">' + label + '</text>' +
      '<text x="300" y="470" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="rgba(255,255,255,.7)" text-anchor="middle">demo photo</text></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function seed() {
    const now = Date.now();
    const ph = (lot, nums) => nums.map(n => '../photos/web/lot' + lot + '-' + n + '.jpg');
    /* Atul's real stock. price null = "Ask price" item (shown to everyone, price on WhatsApp). */
    const products = [
      { id: 'p1', brand: 'Ralph Lauren', title: 'Original Polo Full Sleeve Shirt', category: 'Shirts', photos: ph(1, [4, 2, 3, 5]), sizes: [{ label: '43', qty: 2 }, { label: '44', qty: 1 }], price: 1499, mrp: 8999, premium: false, note: '', active: true, createdAt: now - 1e6 }, // placeholder price
      { id: 'p2', brand: 'Harley-Davidson', title: 'Original Shirt', category: 'Shirts', photos: ph(2, [1, 2, 3, 4, 5, 6]), sizes: [{ label: '43', qty: 1 }], price: 1299, mrp: 6499, premium: false, note: '', active: true, createdAt: now - 2e6 }, // placeholder price
      { id: 'p3', brand: 'Adidas Originals', title: 'Women Track Pants', category: 'Bottoms', photos: ph(3, [1, 2, 3, 4, 5]), sizes: [{ label: 'S', qty: 2 }, { label: 'M', qty: 2 }], price: 899, mrp: 3599, premium: false, note: '', active: true, createdAt: now - 3e6 }, // placeholder price
      { id: 'p4', brand: 'Puma', title: 'Original Kids Hoodie', category: 'Kids', photos: ph(4, [1, 2, 3, 4]), sizes: [{ label: '7-8Y', qty: 2 }], price: 699, mrp: null, premium: false, note: 'Age 7 to 8 years', active: true, createdAt: now - 4e6 },
      { id: 'p5', brand: 'Adidas Originals', title: 'Gazelle Boost 85 Suede Leather Sneakers', category: 'Shoes', photos: ph(5, [1, 2, 3, 4]), sizes: [{ label: 'UK 9', qty: 1 }], price: null, mrp: null, premium: true, note: 'With box', active: true, createdAt: now - 5e6 },
      { id: 'p6', brand: 'Adidas Originals', title: 'Bape Stan Smith', category: 'Shoes', photos: ph(6, [1, 2, 3, 4, 5, 6, 7]), sizes: [{ label: 'UK 11', qty: 1 }], price: null, mrp: null, premium: true, note: 'With box', active: true, createdAt: now - 6e6 },
    ];
    const orders = [
      { id: 'RO-1041', items: [{ productId: 'p3', brand: 'Adidas Originals', title: 'Women Track Pants', size: 'M', qty: 1, price: 899 }], amount: 899, customer: { name: 'Neha Sharma', phone: '9811100011', address: '14 Lake View Apartments, Sector 21', pincode: '122016' }, status: 'verifying', utr: '431298765012', stockHeld: true, stockIssue: false, createdAt: now - 20 * 60000, reservedUntil: now - 5 * 60000, history: [{ status: 'awaiting_payment', at: now - 20 * 60000, note: '' }, { status: 'verifying', at: now - 17 * 60000, note: 'Customer entered UTR' }] },
      { id: 'RO-1040', items: [{ productId: 'p4', brand: 'Puma', title: 'Original Kids Hoodie', size: '7-8Y', qty: 1, price: 699 }], amount: 699, customer: { name: 'Rohit Verma', phone: '9899900022', address: '7 Green Park Extension', pincode: '110016' }, status: 'confirmed', utr: '431200011122', stockHeld: true, stockIssue: false, createdAt: now - 3 * 3600000, reservedUntil: now - 2.7 * 3600000, history: [{ status: 'awaiting_payment', at: now - 3 * 3600000, note: '' }, { status: 'verifying', at: now - 2.9 * 3600000, note: 'Customer entered UTR' }, { status: 'confirmed', at: now - 2.5 * 3600000, note: '' }] },
    ];
    return {
      products, orders, nextOrder: 1042,
      members: ['9811100011'],
      requests: [{ phone: '9876500033', name: 'Karan Mehta', at: now - 3600000 }],
      session: null,
      settings: { shopName: 'Rana Originals', upiId: 'ranaoriginals@upi', payeeName: 'Atul Rana', whatsapp: '919999999999' },
    };
  }

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    const d = seed(); persist(d); return d;
  }
  function persist(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { console.warn('Store: could not save', e); }
  }
  function save(d) { persist(d); window.dispatchEvent(new Event('ro:change')); }
  function adj(d, productId, size, delta) {
    const p = d.products.find(x => x.id === productId); if (!p) return false;
    const s = p.sizes.find(x => x.label === size); if (!s) return false;
    if (s.qty + delta < 0) return false;
    s.qty += delta; return true;
  }
  function setStatus(d, o, status, note) {
    if (RELEASE.includes(status) && o.stockHeld) { o.items.forEach(i => adj(d, i.productId, i.size, i.qty)); o.stockHeld = false; }
    o.status = status; o.history.push({ status, at: Date.now(), note: note || '' });
  }
  function sweep(d) {
    let changed = false; const now = Date.now();
    d.orders.forEach(o => { if (o.status === 'awaiting_payment' && o.reservedUntil < now) { setStatus(d, o, 'expired', 'No payment within 15 minutes, stock released'); changed = true; } });
    if (changed) persist(d);
    return d;
  }

  window.Store = {
    STATUS, HOLD_MS,
    statusLabel: s => STATUS[s] || s,
    money: n => (n == null ? '' : '₹' + Number(n).toLocaleString('en-IN')),
    placeholder: img,

    /* products */
    getProducts() { return load().products.slice().sort((a, b) => b.createdAt - a.createdAt); },
    getProduct(id) { return load().products.find(p => p.id === id) || null; },
    totalQty: p => p.sizes.reduce((n, s) => n + s.qty, 0),
    /* true when the item has no price: shop shows "Ask price" and a WhatsApp button instead of Buy */
    askPrice: p => !p || p.price == null,
    /* create or update. Pass an object without id to create. Returns the saved product. */
    saveProduct(p) {
      const d = load();
      if (p.id) { const i = d.products.findIndex(x => x.id === p.id); if (i >= 0) d.products[i] = Object.assign({}, d.products[i], p); }
      else { p = Object.assign({ id: 'p' + Date.now() + Math.floor(Math.random() * 1000), photos: [], sizes: [], price: null, mrp: null, premium: false, note: '', active: true, createdAt: Date.now() }, p); d.products.push(p); }
      save(d); return p;
    },
    deleteProduct(id) { const d = load(); d.products = d.products.filter(p => p.id !== id); save(d); },
    /* delta = -1 for a direct/offline sale, +1 to add a piece. Returns false if it would go below 0. */
    adjustStock(id, size, delta) { const d = load(); const ok = adj(d, id, size, delta); if (ok) save(d); return ok; },

    /* orders */
    getOrders() { return sweep(load()).orders.slice().sort((a, b) => b.createdAt - a.createdAt); },
    getOrder(id) { return sweep(load()).orders.find(o => o.id === id) || null; },
    getOrdersByPhone(phone) { return this.getOrders().filter(o => o.customer.phone === phone); },
    /* items: [{productId, size, qty}]. Reserves stock for 15 min. Returns {order} or {error}. */
    createOrder({ items, customer }) {
      const d = sweep(load()); const lines = [];
      for (const it of items) {
        const p = d.products.find(x => x.id === it.productId);
        const s = p && p.sizes.find(x => x.label === it.size);
        if (!p || !s || s.qty < it.qty) return { error: 'out_of_stock', productId: it.productId, size: it.size };
        if (p.price == null) return { error: 'no_price', productId: it.productId };
        lines.push({ productId: p.id, brand: p.brand, title: p.title, size: it.size, qty: it.qty, price: p.price });
      }
      lines.forEach(l => adj(d, l.productId, l.size, -l.qty));
      const now = Date.now();
      const order = { id: 'RO-' + d.nextOrder++, items: lines, amount: lines.reduce((n, l) => n + l.price * l.qty, 0), customer, status: 'awaiting_payment', utr: '', stockHeld: true, stockIssue: false, createdAt: now, reservedUntil: now + HOLD_MS, history: [{ status: 'awaiting_payment', at: now, note: '' }] };
      d.orders.push(order); save(d); return { order };
    },
    /* Customer says "I have paid" and gives the 12-digit UPI reference (UTR).
       Works on awaiting_payment, expired and payment_not_found orders.
       If the hold had expired we try to re-hold stock; if the item is gone, order.stockIssue = true
       (admin should refund instead of confirming). Returns {order} or {error:'invalid'|'duplicate'}. */
    submitUtr(id, utr) {
      utr = String(utr || '').replace(/\s/g, '');
      if (!/^\d{12}$/.test(utr)) return { error: 'invalid' };
      const d = load(); const o = d.orders.find(x => x.id === id); if (!o) return { error: 'not_found' };
      if (d.orders.some(x => x.id !== id && x.utr === utr)) return { error: 'duplicate' };
      if (!o.stockHeld) {
        const can = o.items.every(i => { const p = d.products.find(x => x.id === i.productId); const s = p && p.sizes.find(x => x.label === i.size); return s && s.qty >= i.qty; });
        if (can) { o.items.forEach(i => adj(d, i.productId, i.size, -i.qty)); o.stockHeld = true; o.stockIssue = false; } else o.stockIssue = true;
      }
      o.utr = utr; setStatus(d, o, 'verifying', o.stockIssue ? 'Paid after hold expired, item no longer in stock' : 'Customer entered UTR');
      save(d); return { order: o };
    },
    /* Admin/customer status change. Stock is released automatically for
       expired / payment_not_found / cancelled / refund_due. */
    setOrderStatus(id, status, note) { const d = load(); const o = d.orders.find(x => x.id === id); if (!o) return null; setStatus(d, o, status, note); save(d); return o; },
    upiLink(o) { const s = load().settings; return 'upi://pay?pa=' + encodeURIComponent(s.upiId) + '&pn=' + encodeURIComponent(s.payeeName) + '&am=' + o.amount + '&cu=INR&tn=' + encodeURIComponent(o.id); },
    waLink(text) { return 'https://wa.me/' + load().settings.whatsapp + '?text=' + encodeURIComponent(text); },

    /* customer session + premium members */
    getSession() { return load().session; },
    setSession(s) { const d = load(); d.session = s ? Object.assign({}, d.session || {}, s) : null; save(d); return d.session; },
    isPremium() { const d = load(); return !!(d.session && d.members.includes(d.session.phone)); },
    getMembers() { return load().members.slice(); },
    addMember(phone) { const d = load(); if (!d.members.includes(phone)) d.members.push(phone); d.requests = d.requests.filter(r => r.phone !== phone); save(d); },
    removeMember(phone) { const d = load(); d.members = d.members.filter(m => m !== phone); save(d); },
    getRequests() { return load().requests.slice(); },
    requestAccess(phone, name) { const d = load(); if (!d.members.includes(phone) && !d.requests.some(r => r.phone === phone)) { d.requests.push({ phone, name: name || '', at: Date.now() }); save(d); } },
    rejectRequest(phone) { const d = load(); d.requests = d.requests.filter(r => r.phone !== phone); save(d); },

    getSettings() { return load().settings; },
    saveSettings(s) { const d = load(); d.settings = Object.assign({}, d.settings, s); save(d); },

    /* cb runs whenever data changes, in this page or in another tab/iframe */
    onChange(cb) { window.addEventListener('ro:change', cb); window.addEventListener('storage', e => { if (e.key === KEY) cb(); }); },
    reset() { localStorage.removeItem(KEY); save(seed()); },
  };
})();
