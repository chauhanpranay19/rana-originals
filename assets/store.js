/* Rana Originals data layer. Exposes one global: Store.
   Two modes, one API:
   - Demo mode (RO_CONFIG.apiUrl empty, or ?demo=1): everything lives in localStorage, so the shop and the
     admin in the same browser share one "database". Behaviour is exactly the original demo.
   - Remote mode (RO_CONFIG.apiUrl set): data comes from the Google Apps Script web app (backend/).
     Reads stay synchronous from an in-memory copy (also kept in localStorage so the next visit paints
     instantly); the copy refreshes after each write and every 17 s while the tab is visible.
   Every write returns a Promise in both modes. A rejected Promise carries err.code:
   'network' (no connection), 'unauthorized' (admin passcode needed), 'busy', or a server error code.
   Load order: assets/config.js, then this file. Add data-role="admin" on the admin page's script tag. */
(function () {
  const script = document.currentScript;
  const cfg = window.RO_CONFIG || {};
  const forceDemo = (script && script.dataset.demo === '1') || /[?&]demo=1(&|$)/.test(location.search);
  const API = forceDemo ? '' : String(cfg.apiUrl || '').trim();
  const ROLE = script && script.dataset.role === 'admin' ? 'admin' : 'shop';

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

  const common = {
    STATUS, HOLD_MS,
    remote: !!API,
    statusLabel: s => STATUS[s] || s,
    money: n => (n == null ? '' : '₹' + Number(n).toLocaleString('en-IN')),
    placeholder: img,
    totalQty: p => p.sizes.reduce((n, s) => n + s.qty, 0),
    /* true when the item has no price: shop shows "Ask price" and a WhatsApp button instead of Buy */
    askPrice: p => !p || p.price == null,
  };

  window.Store = Object.assign(common, API ? remoteStore() : demoStore());

  /* =====================================================================
     Demo mode: the original localStorage store. Writes now return Promises
     that resolve immediately with what they used to return.
     ===================================================================== */
  function demoStore() {
    const KEY = 'ro_demo_v2'; // bumped: v1 demo data is dropped

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
    const done = v => Promise.resolve(v);

    return {
      status: () => ({ remote: false, loaded: true, ordersLoaded: true, error: '' }),
      refresh: () => done(),

      /* products */
      getProducts() { return load().products.slice().sort((a, b) => b.createdAt - a.createdAt); },
      getProduct(id) { return load().products.find(p => p.id === id) || null; },
      /* create or update. Pass an object without id to create. Resolves to the saved product. */
      saveProduct(p) {
        const d = load();
        if (p.id) { const i = d.products.findIndex(x => x.id === p.id); if (i >= 0) d.products[i] = Object.assign({}, d.products[i], p); }
        else { p = Object.assign({ id: 'p' + Date.now() + Math.floor(Math.random() * 1000), photos: [], sizes: [], price: null, mrp: null, premium: false, note: '', active: true, createdAt: Date.now() }, p); d.products.push(p); }
        save(d); return done(p);
      },
      deleteProduct(id) { const d = load(); d.products = d.products.filter(p => p.id !== id); save(d); return done(); },
      /* delta = -1 for a direct/offline sale, +1 to add a piece. Resolves false if it would go below 0. */
      adjustStock(id, size, delta) { const d = load(); const ok = adj(d, id, size, delta); if (ok) save(d); return done(ok); },

      /* orders */
      getOrders() { return sweep(load()).orders.slice().sort((a, b) => b.createdAt - a.createdAt); },
      getOrder(id) { return sweep(load()).orders.find(o => o.id === id) || null; },
      getOrdersByPhone(phone) { return this.getOrders().filter(o => o.customer.phone === phone); },
      /* items: [{productId, size, qty}]. Reserves stock for 15 min. Resolves {order} or {error}. */
      createOrder({ items, customer }) {
        const d = sweep(load()); const lines = [];
        for (const it of items) {
          const p = d.products.find(x => x.id === it.productId);
          const s = p && p.sizes.find(x => x.label === it.size);
          if (!p || !s || s.qty < it.qty) return done({ error: 'out_of_stock', productId: it.productId, size: it.size });
          if (p.price == null) return done({ error: 'no_price', productId: it.productId });
          lines.push({ productId: p.id, brand: p.brand, title: p.title, size: it.size, qty: it.qty, price: p.price });
        }
        lines.forEach(l => adj(d, l.productId, l.size, -l.qty));
        const now = Date.now();
        const order = { id: 'RO-' + d.nextOrder++, items: lines, amount: lines.reduce((n, l) => n + l.price * l.qty, 0), customer, status: 'awaiting_payment', utr: '', stockHeld: true, stockIssue: false, createdAt: now, reservedUntil: now + HOLD_MS, history: [{ status: 'awaiting_payment', at: now, note: '' }] };
        d.orders.push(order); save(d); return done({ order });
      },
      /* Customer says "I have paid" and gives the 12-digit UPI reference (UTR).
         Works on awaiting_payment, expired and payment_not_found orders.
         If the hold had expired we try to re-hold stock; if the item is gone, order.stockIssue = true
         (admin should refund instead of confirming). Resolves {order} or {error:'invalid'|'duplicate'}. */
      submitUtr(id, utr) {
        utr = String(utr || '').replace(/\s/g, '');
        if (!/^\d{12}$/.test(utr)) return done({ error: 'invalid' });
        const d = load(); const o = d.orders.find(x => x.id === id); if (!o) return done({ error: 'not_found' });
        if (d.orders.some(x => x.id !== id && x.utr === utr)) return done({ error: 'duplicate' });
        if (!o.stockHeld) {
          const can = o.items.every(i => { const p = d.products.find(x => x.id === i.productId); const s = p && p.sizes.find(x => x.label === i.size); return s && s.qty >= i.qty; });
          if (can) { o.items.forEach(i => adj(d, i.productId, i.size, -i.qty)); o.stockHeld = true; o.stockIssue = false; } else o.stockIssue = true;
        }
        o.utr = utr; setStatus(d, o, 'verifying', o.stockIssue ? 'Paid after hold expired, item no longer in stock' : 'Customer entered UTR');
        save(d); return done({ order: o });
      },
      /* Admin/customer status change. id may be one id or a list (bulk). Stock is released automatically for
         expired / payment_not_found / cancelled / refund_due. Resolves the order (or a list for a list). */
      setOrderStatus(id, status, note) {
        if (Array.isArray(id)) return done(id.map(x => { const d = load(); const o = d.orders.find(y => y.id === x); if (!o) return null; setStatus(d, o, status, note); save(d); return o; }).filter(Boolean));
        const d = load(); const o = d.orders.find(x => x.id === id); if (!o) return done(null); setStatus(d, o, status, note); save(d); return done(o);
      },
      upiLink(o) { const s = load().settings; return 'upi://pay?pa=' + encodeURIComponent(s.upiId) + '&pn=' + encodeURIComponent(s.payeeName) + '&am=' + o.amount + '&cu=INR&tn=' + encodeURIComponent(o.id); },
      waLink(text) { return 'https://wa.me/' + load().settings.whatsapp + '?text=' + encodeURIComponent(text); },

      /* customer session (this device only, so it stays synchronous) + premium members */
      getSession() { return load().session; },
      setSession(s) { const d = load(); d.session = s ? Object.assign({}, d.session || {}, s) : null; save(d); return d.session; },
      isPremium() { const d = load(); return !!(d.session && d.members.includes(d.session.phone)); },
      getMembers() { return load().members.slice(); },
      addMember(phone) { const d = load(); if (!d.members.includes(phone)) d.members.push(phone); d.requests = d.requests.filter(r => r.phone !== phone); save(d); return done(); },
      removeMember(phone) { const d = load(); d.members = d.members.filter(m => m !== phone); save(d); return done(); },
      getRequests() { return load().requests.slice(); },
      requestAccess(phone, name) { const d = load(); if (!d.members.includes(phone) && !d.requests.some(r => r.phone === phone)) { d.requests.push({ phone, name: name || '', at: Date.now() }); save(d); } return done(); },
      rejectRequest(phone) { const d = load(); d.requests = d.requests.filter(r => r.phone !== phone); save(d); return done(); },

      getSettings() { return load().settings; },
      saveSettings(s) { const d = load(); d.settings = Object.assign({}, d.settings, s); save(d); return done(); },

      /* admin passcode: not used in demo mode */
      isAdmin: () => true,
      adminLogin: () => done(true),
      adminLogout: () => done(),

      /* cb runs whenever data changes, in this page or in another tab/iframe */
      onChange(cb) { window.addEventListener('ro:change', cb); window.addEventListener('storage', e => { if (e.key === KEY) cb(); }); },
      reset() { localStorage.removeItem(KEY); save(seed()); return done(); },
    };
  }

  /* =====================================================================
     Remote mode: Google Apps Script web app.
     ===================================================================== */
  function remoteStore() {
    const LS = 'ro_remote_v1_' + ROLE;   // cached products/settings/orders for instant paint
    const SES = 'ro_customer_v1';        // this device's customer details + secret token
    const ADM = 'ro_admin_v1';           // admin session token (30 days)
    const POLL_MS = 17000;
    const SITE_ROOT = new URL('../', (script && script.src) || location.href).href;
    const DEFAULT_SETTINGS = { shopName: 'Rana Originals', upiId: '', payeeName: '', whatsapp: '' };

    const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    const emit = () => window.dispatchEvent(new Event('ro:change'));
    const fail = code => { const e = new Error(code); e.code = code; return e; };

    let data = Object.assign({ products: [], settings: DEFAULT_SETTINGS, orders: [] }, lsGet(LS) || {});
    let lastJson = JSON.stringify(data);
    const st = { loaded: false, ordersLoaded: false, error: '' };
    let skew = 0, gen = 0, inflight = null, again = false, expiryTimer = null;

    const adminToken = () => (ROLE === 'admin' ? lsGet(ADM) : null);
    const session = () => lsGet(SES);

    /* photos: absolute URL (Drive) or site-relative path ("photos/web/x.jpg") */
    function photoUrl(src) {
      if (typeof src !== 'string' || !src) return '';
      if (/^(https?:|data:|blob:)/i.test(src)) return src;
      try { return new URL(src.replace(/^(\.\.\/)+/, ''), SITE_ROOT).href; } catch (e) { return src; }
    }
    function photoForServer(src) {
      return typeof src === 'string' && src.indexOf(SITE_ROOT) === 0 ? src.slice(SITE_ROOT.length) : src;
    }
    const normP = p => Object.assign({}, p, { photos: (p.photos || []).map(photoUrl).filter(Boolean), sizes: p.sizes || [] });
    // reservedUntil comes in server time; shift it to this phone's clock so countdowns are right
    const normO = o => Object.assign({}, o, { reservedUntil: o.reservedUntil - skew });

    function noteSkew(serverNow, sentAt) {
      const s = Math.round(serverNow - (sentAt + Date.now()) / 2);
      if (Math.abs(s - skew) > 3000) skew = s;
    }

    function request(action, payload, method) {
      const ctrl = window.AbortController ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, method === 'GET' ? 25000 : 90000);
      const sentAt = Date.now();
      const opts = method === 'GET'
        ? { cache: 'no-store', signal: ctrl && ctrl.signal }
        : { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action }, payload || {})), redirect: 'follow', signal: ctrl && ctrl.signal };
      const url = method === 'GET' ? API + (API.indexOf('?') >= 0 ? '&' : '?') + 'action=' + encodeURIComponent(action) : API;
      return fetch(url, opts)
        .then(r => r.json())
        .catch(() => { throw fail('network'); })
        .then(j => {
          clearTimeout(timer);
          if (j && typeof j.now === 'number') noteSkew(j.now, sentAt);
          if (!j || j.ok !== true) {
            const code = (j && j.error) || 'server';
            if (code === 'unauthorized' && ROLE === 'admin') dropAdmin();
            throw fail(code);
          }
          return j;
        }, e => { clearTimeout(timer); throw e; });
    }

    function commit(next, statusChanged) {
      const json = JSON.stringify(next);
      if (json !== lastJson) { data = next; lastJson = json; lsSet(LS, next); emit(); }
      else if (statusChanged) emit();
    }
    function patch(fn) { const next = JSON.parse(lastJson); fn(next); commit(next); }
    function setStatusFlags(f) {
      const before = JSON.stringify(st); Object.assign(st, f); return before !== JSON.stringify(st);
    }
    function dropAdmin() {
      lsSet(ADM, null);
      const next = JSON.parse(lastJson); next.orders = [];
      setStatusFlags({ ordersLoaded: false });
      commit(next, true);
    }

    function refresh() {
      if (inflight) { again = true; return inflight; }
      const myGen = gen;
      const adm = adminToken(), tok = (session() || {}).token;
      const jobs = [
        adm ? request('listProducts', { session: adm }) : request('products', null, 'GET'),
        request('settings', null, 'GET'),
        adm ? request('listOrders', { session: adm }) : (ROLE === 'shop' && tok ? request('myOrders', { token: tok }) : Promise.resolve({ orders: [] })),
      ];
      inflight = Promise.all(jobs).then(([p, s, o]) => {
        if (myGen !== gen) { again = true; return; } // a write finished meanwhile; this answer may be older
        const changed = setStatusFlags({ loaded: true, ordersLoaded: ROLE === 'shop' || !!adm, error: '' });
        commit({ products: p.products.map(normP), settings: Object.assign({}, DEFAULT_SETTINGS, s.settings), orders: o.orders.map(normO) }, changed);
      }, e => {
        if (setStatusFlags({ error: e.code || 'network' })) emit();
      }).then(() => { inflight = null; if (again) { again = false; refresh(); } });
      return inflight;
    }

    // after a write: apply what the server sent back now, then fetch everything again
    function wrote(apply) { gen++; if (apply) patch(apply); refresh(); }

    /* unpaid orders whose hold ran out look expired straight away (the server agrees on the next refresh) */
    function view(o) {
      if (o.status !== 'awaiting_payment' || o.reservedUntil >= Date.now()) return o;
      clearTimeout(expiryTimer); expiryTimer = setTimeout(refresh, 1500);
      return Object.assign({}, o, { status: 'expired', stockHeld: false });
    }
    const clone = x => JSON.parse(JSON.stringify(x));
    const upsert = (list, item) => { const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item); };

    // start: paint from cache, then load; poll while visible
    setTimeout(refresh, 0);
    setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });

    return {
      status: () => Object.assign({ remote: true }, st),
      refresh,

      /* products */
      getProducts() { return clone(data.products).sort((a, b) => b.createdAt - a.createdAt); },
      getProduct(id) { const p = data.products.find(x => x.id === id); return p ? clone(p) : null; },
      saveProduct(p) {
        const body = Object.assign({}, p);
        if (body.photos) body.photos = body.photos.map(photoForServer);
        return request('saveProduct', { session: adminToken(), product: body }).then(j => {
          const saved = normP(j.product);
          wrote(d => upsert(d.products, saved));
          return clone(saved);
        });
      },
      deleteProduct(id) {
        return request('deleteProduct', { session: adminToken(), id }).then(() => { wrote(d => { d.products = d.products.filter(x => x.id !== id); }); });
      },
      adjustStock(id, size, delta) {
        return request('adjustStock', { session: adminToken(), id, size, delta }).then(
          j => { const saved = normP(j.product); wrote(d => upsert(d.products, saved)); return true; },
          e => { if (e.code === 'out_of_stock') { wrote(); return false; } throw e; });
      },

      /* orders (shop: this device's orders only; admin: all) */
      getOrders() { return clone(data.orders).map(view).sort((a, b) => b.createdAt - a.createdAt); },
      getOrder(id) { const o = data.orders.find(x => x.id === id); return o ? view(clone(o)) : null; },
      getOrdersByPhone() { return this.getOrders(); },
      createOrder({ items, customer }) {
        const tok = (session() || {}).token;
        return request('createOrder', { items, customer, token: tok || undefined }).then(j => {
          if (j.token) lsSet(SES, Object.assign({}, session() || {}, { token: j.token }));
          const o = normO(j.order);
          setStatusFlags({ ordersLoaded: true });
          wrote(d => upsert(d.orders, o));
          return { order: clone(o) };
        }, e => {
          if (e.code === 'out_of_stock' || e.code === 'no_price') { wrote(); return { error: e.code }; }
          throw e;
        });
      },
      submitUtr(id, utr) {
        utr = String(utr || '').replace(/\s/g, '');
        if (!/^\d{12}$/.test(utr)) return Promise.resolve({ error: 'invalid' });
        const who = ROLE === 'admin' ? { session: adminToken() } : { token: (session() || {}).token };
        return request('submitUtr', Object.assign({ id, utr }, who)).then(j => {
          const o = normO(j.order);
          wrote(d => upsert(d.orders, o));
          return { order: clone(o) };
        }, e => {
          if (['invalid', 'duplicate', 'not_found', 'bad_status', 'no_token'].indexOf(e.code) >= 0) return { error: e.code === 'no_token' ? 'not_found' : e.code };
          throw e;
        });
      },
      setOrderStatus(id, status, note) {
        const ids = Array.isArray(id) ? id : [id];
        if (!ids.length) return Promise.resolve([]);
        return request('setOrderStatus', { session: adminToken(), ids, status, note: note || '' }).then(j => {
          const list = j.orders.map(normO);
          wrote(d => list.forEach(o => upsert(d.orders, o)));
          return Array.isArray(id) ? clone(list) : clone(list[0] || null);
        });
      },
      upiLink(o) { const s = data.settings; return 'upi://pay?pa=' + encodeURIComponent(s.upiId) + '&pn=' + encodeURIComponent(s.payeeName) + '&am=' + o.amount + '&cu=INR&tn=' + encodeURIComponent(o.id); },
      waLink(text) { return 'https://wa.me/' + data.settings.whatsapp + '?text=' + encodeURIComponent(text); },

      /* customer details live on this device only; the token proves which orders are theirs */
      getSession() { const s = session(); return s && s.phone ? s : null; },
      setSession(s) {
        const cur = session() || {};
        const next = s ? Object.assign({}, cur, s) : (cur.token ? { token: cur.token } : null);
        lsSet(SES, next); emit();
        return next && next.phone ? next : null;
      },
      // premium members are a demo-only idea for now
      isPremium: () => false,
      getMembers: () => [],
      addMember: () => Promise.resolve(),
      removeMember: () => Promise.resolve(),
      getRequests: () => [],
      requestAccess: () => Promise.resolve(),
      rejectRequest: () => Promise.resolve(),

      getSettings() { return clone(data.settings); },
      saveSettings(s) {
        return request('saveSettings', { session: adminToken(), settings: s }).then(j => { wrote(d => { d.settings = Object.assign({}, DEFAULT_SETTINGS, j.settings); }); });
      },

      /* admin passcode */
      isAdmin: () => !!adminToken(),
      adminLogin(passcode) {
        return request('adminLogin', { passcode: String(passcode || '') }).then(j => {
          lsSet(ADM, j.session);
          setStatusFlags({ ordersLoaded: false });
          emit(); return refresh().then(() => true);
        });
      },
      adminLogout() {
        const t = adminToken();
        const p = t ? request('adminLogout', { session: t }).catch(() => {}) : Promise.resolve();
        dropAdmin();
        return p.then(() => {});
      },

      onChange(cb) {
        window.addEventListener('ro:change', cb);
        window.addEventListener('storage', e => {
          if (e.key === LS) { const d = lsGet(LS); if (d) { data = d; lastJson = JSON.stringify(d); } cb(); }
          else if (e.key === SES || e.key === ADM) cb();
        });
      },
      /* remote mode: forget this device's cached copy (server data is untouched) */
      reset() { lsSet(LS, null); data = { products: [], settings: DEFAULT_SETTINGS, orders: [] }; lastJson = JSON.stringify(data); emit(); return refresh(); },
    };
  }
})();
