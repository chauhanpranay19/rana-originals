/* Rana Originals customer shop. Vanilla JS, hash routing, all data via Store (../assets/store.js).
   Routes: #/  #/p/:id  #/details  #/pay/:orderId  #/orders  #/order/:orderId
   Re-renders on Store.onChange, keeping typed values (held in `state`), focus and gallery position. */
(function () {
  'use strict';

  const view = document.getElementById('view');
  const money = n => Store.money(n);

  /* ---------- state that must survive re-renders ---------- */
  const state = {
    cat: 'All',
    size: '',               // size filter on the shop screen (only after a category is picked)
    sel: {},                // productId -> selected size on the product page
    sizeErr: '',            // productId that needs a size picked
    pending: readPending(), // { productId, size } waiting for first-time details
    form: {},               // details form values
    formErr: {},
    utr: '', utrErr: '', showUtr: false,
    lastRoute: '',
  };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function readPending() { try { return JSON.parse(sessionStorage.getItem('ro_pending')) || null; } catch (e) { return null; } }
  function setPending(p) { state.pending = p; try { p ? sessionStorage.setItem('ro_pending', JSON.stringify(p)) : sessionStorage.removeItem('ro_pending'); } catch (e) {} }
  function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function off(p) { return p.mrp && p.price != null && p.mrp > p.price ? Math.round((p.mrp - p.price) / p.mrp * 100) : 0; }
  function photosOf(p) { return p && p.photos && p.photos.length ? p.photos : [Store.placeholder('Rana Originals', '#5C5C58')]; }
  function inStock(p) { return p.sizes.filter(s => s.qty > 0); }
  function sizeQty(p, label) { const s = p && p.sizes.find(x => x.label === label); return s ? s.qty : 0; }
  function fullName(p) { return p.brand + ' ' + p.title; }
  function fmtPhone(p) { p = String(p || ''); return p.length === 10 ? p.slice(0, 5) + ' ' + p.slice(5) : p; }
  function fmtDate(at) { return new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  function session() { const s = Store.getSession(); return s && s.phone ? s : null; }
  function hasDetails(s) { return !!(s && s.phone && s.name && s.address && s.pincode); }
  function products() { return Store.getProducts().filter(p => p.active); }

  const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  function sizeKey(l) {
    const u = String(l).toUpperCase().trim();
    const i = SIZE_ORDER.indexOf(u);
    if (i >= 0) return [0, i];
    const n = parseFloat(u.replace(/[^\d.]/g, ''));
    return isNaN(n) ? [2, 0, u] : [1, n];
  }
  function sortSizes(list) {
    return list.slice().sort((a, b) => {
      const x = sizeKey(a), y = sizeKey(b);
      return x[0] - y[0] || x[1] - y[1] || String(x[2] || '').localeCompare(String(y[2] || ''));
    });
  }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- icons (inline SVG) ---------- */
  const P = {
    home: '<path d="M4 10l8-6 8 6v10h-5v-6H9v6H4z"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    chat: '<path d="M4 20l1.4-4.2A8 8 0 1 1 8.6 19z"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M9 18l6-6-6-6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    wa: '<path d="M4 20l1.4-4.2A8 8 0 1 1 8.6 19z"/><path d="M9.2 8.6c.2 2.9 2.4 5.3 5.4 5.8l.9-1.2-1.6-.9-.7.7c-.9-.4-1.7-1.2-2.1-2.1l.7-.7-.9-1.6z" stroke-width="1.3"/>',
  };
  function ic(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[name] + '</svg>';
  }
  function waHref(text) { return esc(Store.waLink(text)); }
  function helpBtn(text) {
    return '<a class="btn btn-wa-line" href="' + waHref(text) + '" target="_blank" rel="noopener">' + ic('wa') + 'Help on WhatsApp</a>';
  }

  /* ---------- routing ---------- */
  function route() {
    const h = (location.hash || '#/').replace(/^#/, '');
    const parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'shop', id: parts[1] ? decodeURIComponent(parts[1]) : null, key: h };
  }
  function go(hash, replace) { replace ? location.replace(hash) : (location.hash = hash); }

  function onRouteChange(r) {
    state.utr = ''; state.utrErr = ''; state.showUtr = false;
    state.formErr = {}; state.sizeErr = '';
    if (r.name !== 'details') state.form = {};
  }

  /* ---------- frame: header + bottom bar ---------- */
  const GENERAL_HELP = 'Hi, I have a question about Rana Originals.';
  function header(r, back) {
    const link = (name, href, label) => '<a href="' + href + '"' + (r.name === name || (name === 'orders' && r.name === 'order') ? ' class="on" aria-current="page"' : '') + '>' + label + '</a>';
    return '<header class="hdr"><div class="hdr-in">' +
      (back ? '<button class="icon-btn back" data-act="back" aria-label="Go back">' + ic('back') + '</button>' : '') +
      '<a class="logo-link" href="#/" aria-label="Rana Originals, shop"><span class="ro-logo">RANA <span>originals</span></span></a>' +
      '<nav class="top-nav" aria-label="Main">' + link('shop', '#/', 'Shop') + link('orders', '#/orders', 'My orders') +
      '<a href="' + waHref(GENERAL_HELP) + '" target="_blank" rel="noopener">Help</a></nav>' +
      '</div></header>';
  }
  function bottomBar(r) {
    const item = (name, href, icon, label, ext) => {
      const on = r.name === name || (name === 'orders' && r.name === 'order');
      return '<a href="' + href + '"' + (on ? ' class="on" aria-current="page"' : '') + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + ic(icon) + '<span>' + label + '</span></a>';
    };
    return '<nav class="tabbar" aria-label="Main">' + item('shop', '#/', 'home', 'Shop') + item('orders', '#/orders', 'bag', 'My orders') +
      item('help', waHref(GENERAL_HELP), 'chat', 'Help', true) + '</nav>';
  }
  function page(r, body, opts) {
    opts = opts || {};
    document.body.classList.toggle('has-tabbar', !!opts.tabbar);
    document.body.classList.toggle('has-buybar', !!opts.buybar);
    return header(r, opts.back) + '<main class="main ' + (opts.cls || '') + '">' + body + '</main>' + (opts.tabbar ? bottomBar(r) : '');
  }
  function empty(line, btnHref, btnLabel) {
    return '<div class="empty"><p>' + esc(line) + '</p>' + (btnHref ? '<a class="btn btn-dark btn-auto" href="' + btnHref + '">' + esc(btnLabel) + '</a>' : '') + '</div>';
  }

  /* ---------- 1. Shop ---------- */
  function card(p) {
    const qty = Store.totalQty(p);
    const sizes = sortSizes(inStock(p).map(s => s.label));
    const d = off(p);
    return '<a class="card' + (qty === 0 ? ' is-sold' : '') + '" href="#/p/' + encodeURIComponent(p.id) + '">' +
      '<div class="card-img"><img src="' + esc(photosOf(p)[0]) + '" alt="' + esc(fullName(p)) + '" loading="lazy"></div>' +
      '<div class="card-body">' +
      '<div class="brand">' + esc(p.brand) + '</div>' +
      '<div class="name">' + esc(p.title) + '</div>' +
      '<div class="price-line">' + (Store.askPrice(p) ? '<span class="price">Ask price</span>'
        : '<span class="price">' + money(p.price) + '</span>' + (d ? ' <s class="mrp">' + money(p.mrp) + '</s>' : '')) + '</div>' +
      (qty === 0 ? '<div class="meta sold">Sold out</div>'
        : '<div class="meta">Size ' + sizes.map(esc).join(' · ') + '</div>' + (qty === 1 ? '<div class="last">Only 1 left</div>' : '')) +
      '</div></a>';
  }

  function viewShop(r) {
    const all = products();
    const cats = [];
    all.forEach(p => { if (p.category && !cats.includes(p.category)) cats.push(p.category); });
    if (state.cat !== 'All' && !cats.includes(state.cat)) { state.cat = 'All'; state.size = ''; }

    const coverOf = list => { const p = list.find(x => Store.totalQty(x) > 0) || list[0]; return p ? photosOf(p)[0] : ''; };
    const catCircles = cats.map(c => ({ name: c, img: coverOf(all.filter(p => p.category === c)) }));
    const used = catCircles.map(c => c.img);
    const circles = [{ name: 'All', img: coverOf(all.filter(p => !used.includes(photosOf(p)[0]))) || coverOf(all) }].concat(catCircles);

    let list = all.filter(p => state.cat === 'All' || p.category === state.cat);
    let sizeRow = '';
    if (state.cat !== 'All') {
      const sizes = sortSizes([...new Set([].concat(...list.map(p => inStock(p).map(s => s.label))))]);
      if (state.size && !sizes.includes(state.size)) state.size = '';
      if (sizes.length) {
        sizeRow = '<div class="size-filter" role="group" aria-label="Filter by size"><span class="lbl">Size</span>' +
          sizes.map(s => '<button class="chip' + (state.size === s ? ' on' : '') + '" aria-pressed="' + (state.size === s) + '" data-act="fsize" data-v="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>';
      }
      if (state.size) list = list.filter(p => sizeQty(p, state.size) > 0);
    }
    list.sort((a, b) => (Store.totalQty(a) === 0) - (Store.totalQty(b) === 0));

    const body = (all.length ? '<div class="cats" role="group" aria-label="Categories">' + circles.map(c =>
      '<button class="cat' + (state.cat === c.name ? ' on' : '') + '" aria-pressed="' + (state.cat === c.name) + '" data-act="cat" data-v="' + esc(c.name) + '">' +
      '<span class="cat-img">' + (c.img ? '<img src="' + esc(c.img) + '" alt="">' : '') + '</span><span class="cat-name">' + esc(c.name) + '</span></button>').join('') + '</div>' : '') +
      sizeRow +
      (list.length ? '<div class="grid">' + list.map(card).join('') + '</div>'
        : all.length ? empty('Nothing in this size right now.') : empty('New stock is coming soon.'));
    return page(r, body, { tabbar: true, cls: 'shop' });
  }

  /* ---------- 2. Product ---------- */
  function gallery(p) {
    const ph = photosOf(p);
    const many = ph.length > 1;
    return '<div class="gallery">' +
      '<div class="g-track" data-gallery>' + ph.map((src, i) => '<img src="' + esc(src) + '" alt="' + esc(fullName(p) + ', photo ' + (i + 1) + ' of ' + ph.length) + '"' + (i ? ' loading="lazy"' : '') + '>').join('') + '</div>' +
      (many ? '<span class="g-count" aria-hidden="true"><span data-gi>1</span> / ' + ph.length + '</span>' +
        '<button class="g-nav prev" data-act="gprev" aria-label="Previous photo">' + ic('back') + '</button>' +
        '<button class="g-nav next" data-act="gnext" aria-label="Next photo">' + ic('next') + '</button>' : '') +
      '</div>';
  }

  function viewProduct(r) {
    const p = Store.getProduct(r.id);
    if (!p || !p.active) return page(r, empty('This item is no longer available.', '#/', 'Back to shop'), { back: true, tabbar: true });

    const total = Store.totalQty(p);
    const avail = inStock(p);
    let sel = state.sel[p.id];
    if (sel && sizeQty(p, sel) <= 0) sel = state.sel[p.id] = '';
    if (!sel && avail.length === 1) sel = state.sel[p.id] = avail[0].label;
    const ask = Store.askPrice(p);
    const d = off(p);
    const sizes = sortSizes(p.sizes.map(s => s.label)).map(l => p.sizes.find(s => s.label === l));

    const sizeBtns = '<div class="sizes" role="radiogroup" aria-label="Select size">' + sizes.map(s => {
      const dis = s.qty <= 0, on = sel === s.label;
      return '<button class="size' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-act="size" data-id="' + esc(p.id) + '" data-v="' + esc(s.label) + '"' +
        (dis ? ' disabled aria-label="' + esc(s.label) + ', sold out"' : '') + '>' + esc(s.label) + '</button>';
    }).join('') + '</div>';

    const sizeTxt = sel ? ', size ' + sel : '';
    let actions;
    if (ask) {
      actions = total === 0 ? '<button class="btn btn-dark" disabled>Sold out</button>'
        : '<a class="btn btn-wa" href="' + waHref('Hi, what is the price of ' + fullName(p) + sizeTxt + '?') + '" target="_blank" rel="noopener">' + ic('wa') + 'Ask price on WhatsApp</a>';
    } else {
      actions = '<a class="btn btn-icon" href="' + waHref('Hi, I have a question about ' + fullName(p) + sizeTxt + '.') + '" target="_blank" rel="noopener" aria-label="Ask on WhatsApp">' + ic('wa') + '</a>' +
        (total === 0 ? '<button class="btn btn-dark" disabled>Sold out</button>'
          : '<button class="btn btn-dark" data-act="buy" data-id="' + esc(p.id) + '">Buy now</button>');
    }

    const body = '<div class="pd">' + gallery(p) +
      '<div class="pd-info">' +
      '<div class="brand">' + esc(p.brand) + '</div>' +
      '<h1 class="pd-name">' + esc(p.title) + '</h1>' +
      (p.note ? '<div class="pd-note">' + esc(p.note) + '</div>' : '') +
      '<div class="pd-price">' + (ask ? '<span class="price">Ask price</span>'
        : '<span class="price">' + money(p.price) + '</span>' + (d ? '<s class="mrp">' + money(p.mrp) + '</s><span class="off">' + d + '% off</span>' : '')) + '</div>' +
      '<div class="lbl">Select size</div>' + sizeBtns +
      (state.sizeErr === p.id ? '<p class="err" role="alert">Please pick a size.</p>' : '') +
      '<div class="buybar">' + actions + '</div>' +
      '</div></div>';
    return page(r, body, { back: true, buybar: true, cls: 'product' });
  }

  function buy(id) {
    const p = Store.getProduct(id); if (!p) return;
    const size = state.sel[id];
    if (!size || sizeQty(p, size) <= 0) { state.sizeErr = id; render(); return; }
    state.sizeErr = '';
    const ses = session();
    if (!hasDetails(ses)) { setPending({ productId: id, size }); go('#/details'); return; }
    placeOrder({ productId: id, size }, ses);
  }

  function placeOrder(item, ses) {
    const res = Store.createOrder({ items: [{ productId: item.productId, size: item.size, qty: 1 }], customer: { name: ses.name, phone: ses.phone, address: ses.address, pincode: ses.pincode } });
    setPending(null);
    if (res.error) {
      toast(res.error === 'out_of_stock' ? 'Sorry, size ' + item.size + ' just sold out.' : 'Please ask the price on WhatsApp.');
      go('#/p/' + encodeURIComponent(item.productId), true);
      return;
    }
    go('#/pay/' + encodeURIComponent(res.order.id), true);
  }

  // saved address, with the PIN code added back if it was stored separately
  function sesAddress(ses) {
    const a = ses.address || '';
    return a && ses.pincode && !a.includes(ses.pincode) ? a + ', ' + ses.pincode : a;
  }

  /* ---------- 3. Details (first order, or "Change details") ---------- */
  function viewDetails(r) {
    const ses = Store.getSession() || {};
    const f = state.form, e = state.formErr;
    const v = k => f[k] !== undefined ? f[k] : k === 'address' ? sesAddress(ses) : (ses[k] || '');
    const err = k => e[k] ? '<span class="err" id="e-' + k + '">' + esc(e[k]) + '</span>' : '';
    const desc = k => e[k] ? ' aria-invalid="true" aria-describedby="e-' + k + '"' : '';
    const body = '<form class="narrow form" data-form="details" novalidate>' +
      '<h1 class="title">Your details</h1>' +
      '<label class="field"><span>Name</span><input id="f-name" data-model="name" value="' + esc(v('name')) + '" autocomplete="name"' + desc('name') + '>' + err('name') + '</label>' +
      '<label class="field"><span>Mobile number</span><input id="f-phone" data-model="phone" value="' + esc(v('phone')) + '" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10"' + desc('phone') + '>' + err('phone') + '</label>' +
      '<label class="field"><span>Address with PIN code</span><textarea id="f-address" data-model="address" rows="3" autocomplete="street-address"' + desc('address') + '>' + esc(v('address')) + '</textarea>' + err('address') + '</label>' +
      '<button class="btn btn-dark" type="submit">' + (state.pending ? 'Continue' : 'Save') + '</button>' +
      '</form>';
    return page(r, body, { back: true, cls: 'details' });
  }

  function saveDetails() {
    const ses = Store.getSession() || {};
    const f = state.form;
    const val = k => String(f[k] !== undefined ? f[k] : k === 'address' ? sesAddress(ses) : (ses[k] || '')).trim();
    const name = val('name');
    let phone = val('phone').replace(/\D/g, '');
    if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
    const address = val('address').replace(/\s+\n/g, '\n');
    const pin = (address.match(/(?:^|\D)([1-9]\d{5})(?!\d)/) || [])[1];
    const e = {};
    if (name.length < 2) e.name = 'Please enter your name';
    if (!/^[6-9]\d{9}$/.test(phone)) e.phone = 'Please enter a 10-digit mobile number';
    if (address.length < 10 || !pin) e.address = 'Please add your full address with 6-digit PIN code';
    state.formErr = e;
    if (Object.keys(e).length) {
      render();
      const first = document.getElementById('f-' + Object.keys(e)[0]); if (first) first.focus();
      return;
    }
    const saved = Store.setSession({ name, phone, address, pincode: pin });
    state.form = {};
    if (state.pending) placeOrder(state.pending, saved);
    else { toast('Details saved'); go('#/orders', true); }
  }

  /* ---------- 4. Pay ---------- */
  function utrField(label) {
    return '<label class="field"><span>' + esc(label) + '</span><input id="f-utr" class="utr" data-model="utr" value="' + esc(state.utr) + '" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="12 digits"' + (state.utrErr ? ' aria-invalid="true" aria-describedby="e-utr"' : '') + '>' +
      (state.utrErr ? '<span class="err" id="e-utr" role="alert">' + esc(state.utrErr) + '</span>' : '') + '</label>';
  }
  function orderLine(o) {
    const i = o.items[0] || {};
    const p = Store.getProduct(i.productId);
    return '<div class="oline">' + (p ? '<img src="' + esc(photosOf(p)[0]) + '" alt="">' : '<span class="oline-ph"></span>') +
      '<div class="oline-txt"><div class="name">' + esc(i.title || '') + '</div><div class="meta">Size ' + esc(i.size || '') + ' · ' + esc(o.id) + '</div></div></div>';
  }

  function viewPay(r) {
    const o = Store.getOrder(r.id);
    if (!o) return page(r, empty('Order not found.', '#/orders', 'My orders'), { back: true, tabbar: true });
    if (o.status !== 'awaiting_payment') { setTimeout(() => go('#/order/' + encodeURIComponent(o.id), true), 0); return ''; }
    const link = Store.upiLink(o);
    const body = '<div class="narrow pay">' + orderLine(o) +
      '<div class="amount">' + money(o.amount) + '</div>' +
      '<div class="hold" data-until="' + o.reservedUntil + '">' + ic('clock') + '<span>Held for you · <b class="cd">' + mmss(o.reservedUntil - Date.now()) + '</b></span></div>' +
      '<a class="btn btn-dark" href="' + esc(link) + '">Pay with UPI app</a>' +
      '<div class="qr-box"><div id="qr" data-link="' + esc(link) + '"></div><span class="qr-cap">Or scan with any UPI app</span></div>' +
      '<form class="form" data-form="utr" data-id="' + esc(o.id) + '" novalidate>' + utrField('UPI reference, after paying') +
      '<button class="btn btn-line" type="submit">I have paid</button></form>' +
      '<a class="quiet-link" href="' + waHref('Hi, I need help paying for order ' + o.id + '.') + '" target="_blank" rel="noopener">' + ic('wa') + 'Help on WhatsApp</a>' +
      '</div>';
    return page(r, body, { back: true, cls: 'pay-page' });
  }

  function drawQr() {
    const el = document.getElementById('qr');
    if (!el || el.dataset.done) return;
    if (window.QRCode) {
      try {
        el.innerHTML = '';
        new window.QRCode(el, { text: el.dataset.link, width: 168, height: 168, colorDark: '#111111', colorLight: '#FFFFFF', correctLevel: window.QRCode.CorrectLevel.M });
        el.dataset.done = '1';
        el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'UPI QR code for this payment');
        return;
      } catch (e) { /* fall through */ }
    }
    if (window.__qr === 'failed') el.closest('.qr-box').hidden = true; // button above still works
  }

  function submitUtr(id) {
    const res = Store.submitUtr(id, state.utr);
    if (res.error) {
      state.utrErr = res.error === 'invalid' ? 'Please enter all 12 digits'
        : res.error === 'duplicate' ? 'This reference is already used. Please check it.'
          : 'Something went wrong. Please try again.';
      render();
      const f = document.getElementById('f-utr'); if (f) f.focus();
      return;
    }
    state.utr = ''; state.utrErr = ''; state.showUtr = false;
    if (route().name === 'pay') go('#/order/' + encodeURIComponent(id), true); else render();
  }

  /* ---------- 5. My orders ---------- */
  const TONE = { awaiting_payment: 'warn', verifying: 'warn', confirmed: 'ok', shipped: 'ok', delivered: 'ok', payment_not_found: 'bad', amount_mismatch: 'bad', refund_due: 'warn', refunded: 'muted', expired: 'muted', cancelled: 'muted' };
  function statusText(o) { return o.status === 'verifying' && o.stockIssue ? 'Refund due' : Store.statusLabel(o.status); }
  function pill(o) { const t = o.status === 'verifying' && o.stockIssue ? 'warn' : (TONE[o.status] || 'muted'); return '<span class="pill tone-' + t + '">' + esc(statusText(o)) + '</span>'; }

  function viewOrders(r) {
    const ses = session();
    const orders = ses ? Store.getOrdersByPhone(ses.phone) : [];
    const body = '<div class="narrow">' +
      '<div class="title-row"><h1 class="title">My orders</h1>' + (ses ? '<a class="small-link" href="#/details">Change details</a>' : '') + '</div>' +
      (orders.length ? '<div class="olist">' + orders.map(o => {
        const i = o.items[0] || {};
        const p = Store.getProduct(i.productId);
        return '<a class="ocard" href="#/order/' + encodeURIComponent(o.id) + '">' +
          (p ? '<img src="' + esc(photosOf(p)[0]) + '" alt="">' : '<span class="oline-ph"></span>') +
          '<div class="ocard-txt"><div class="name">' + esc(i.title || '') + '</div>' +
          '<div class="meta"><b class="price">' + money(o.amount) + '</b> · Size ' + esc(i.size || '') + '</div>' + pill(o) + '</div>' + ic('next', 'chev') + '</a>';
      }).join('') + '</div>'
        : empty('No orders on this phone yet.', '#/', 'Go to shop')) +
      '</div>';
    return page(r, body, { tabbar: true, cls: 'orders' });
  }

  /* ---------- 6. Order status ---------- */
  function lastNote(o, status) {
    for (let i = o.history.length - 1; i >= 0; i--) if (o.history[i].status === status) return o.history[i].note || '';
    return '';
  }

  function statusInfo(o) {
    const amt = money(o.amount);
    const id = encodeURIComponent(o.id);
    const left = o.reservedUntil - Date.now();
    switch (o.status) {
      case 'awaiting_payment':
        return { line: 'Waiting for payment', text: '<span class="hold-inline" data-until="' + o.reservedUntil + '">Item held for <b class="cd">' + mmss(left) + '</b></span>',
          extra: '<a class="btn btn-dark" href="#/pay/' + id + '">Pay now</a>' };
      case 'verifying':
        return o.stockIssue
          ? { line: 'Item sold out', text: 'You paid after the hold ended. Atul will refund ' + amt + ' in full.' }
          : { line: 'Checking payment', text: 'Atul will confirm it soon. Your item is kept for you.' };
      case 'confirmed': return { line: 'Payment received', text: 'Atul will pack and ship it soon.' };
      case 'shipped': {
        const note = lastNote(o, 'shipped');
        return { line: 'Shipped', text: 'Your parcel is on its way.' + (note ? ' ' + esc(note) : '') };
      }
      case 'delivered': return { line: 'Delivered', text: 'Thank you for shopping with us.' };
      case 'payment_not_found':
        return { line: 'Payment not found', text: 'Please check the 12-digit reference and enter it again.', utr: 'Send again' };
      case 'amount_mismatch':
        return { line: 'Wrong amount paid', text: 'The order is ' + amt + '. Please message Atul to sort it out.' };
      case 'expired':
        return { line: 'Hold expired', text: 'The item was released for others.',
          utr: state.showUtr ? 'Send reference' : '', reveal: !state.showUtr };
      case 'cancelled': return { line: 'Cancelled', text: 'This order will not be shipped.' };
      case 'refund_due': return { line: 'Refund due', text: 'Atul will send ' + amt + ' back to your UPI account.' };
      case 'refunded': return { line: 'Refunded', text: amt + ' has been sent back to your UPI account.' };
      default: return { line: Store.statusLabel(o.status), text: '' };
    }
  }

  function viewOrder(r) {
    const o = Store.getOrder(r.id);
    if (!o) return page(r, empty('Order not found.', '#/orders', 'My orders'), { back: true, tabbar: true });
    const s = statusInfo(o);
    const tone = o.status === 'verifying' && o.stockIssue ? 'warn' : (TONE[o.status] || 'muted');
    const body = '<div class="narrow status">' +
      orderLine(o) +
      '<div class="st tone-' + tone + '"><span class="st-dot"></span><div><h1 class="st-line">' + esc(s.line) + '</h1>' + (s.text ? '<p class="st-text">' + s.text + '</p>' : '') + '</div></div>' +
      '<div class="st-amount"><span>Amount</span><b>' + money(o.amount) + '</b></div>' +
      (s.extra || '') +
      (s.reveal ? '<button class="btn btn-line" data-act="show-utr">Already paid? Enter reference</button>' : '') +
      (s.utr ? '<form class="form" data-form="utr" data-id="' + esc(o.id) + '" novalidate>' + utrField('UPI reference') + '<button class="btn btn-dark" type="submit">' + esc(s.utr) + '</button></form>' : '') +
      helpBtn('Hi, I need help with my order ' + o.id + '.') +
      '</div>';
    return page(r, body, { back: true, tabbar: true, cls: 'order' });
  }

  /* ---------- render with focus + scroll preservation ---------- */
  function render() {
    const r = route();
    const routeChanged = r.key !== state.lastRoute;
    if (routeChanged) { onRouteChange(r); state.lastRoute = r.key; }

    const a = document.activeElement;
    const focusId = a && a.id && view.contains(a) ? a.id : null;
    let selS = null, selE = null;
    try { if (focusId) { selS = a.selectionStart; selE = a.selectionEnd; } } catch (e) {}
    const gal = view.querySelector('[data-gallery]'); const galX = gal ? gal.scrollLeft : 0;
    const cats = view.querySelector('.cats'); const catX = cats ? cats.scrollLeft : 0;
    const y = window.scrollY;

    let html;
    switch (r.name) {
      case 'p': html = viewProduct(r); break;
      case 'details': html = viewDetails(r); break;
      case 'pay': html = viewPay(r); break;
      case 'orders': html = viewOrders(r); break;
      case 'order': html = viewOrder(r); break;
      default: html = viewShop(r);
    }
    if (html === '') return; // redirecting
    view.innerHTML = html;

    if (routeChanged) window.scrollTo(0, 0);
    else {
      const g2 = view.querySelector('[data-gallery]'); if (g2) { g2.scrollLeft = galX; syncCount(g2); }
      const c2 = view.querySelector('.cats'); if (c2) c2.scrollLeft = catX;
      window.scrollTo(0, y);
      if (focusId) {
        const el = document.getElementById(focusId);
        if (el) { el.focus({ preventScroll: true }); try { if (selS != null) el.setSelectionRange(selS, selE); } catch (e) {} }
      }
    }
    drawQr();
  }

  function syncCount(g) {
    const i = Math.round(g.scrollLeft / Math.max(1, g.clientWidth));
    const el = g.parentNode.querySelector('[data-gi]'); if (el) el.textContent = String(i + 1);
  }
  function stepGallery(dir) {
    const g = view.querySelector('[data-gallery]'); if (!g) return;
    const n = g.children.length, w = g.clientWidth;
    const i = (Math.round(g.scrollLeft / w) + dir + n) % n;
    g.scrollTo({ left: i * w, behavior: 'smooth' });
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const act = b.dataset.act, id = b.dataset.id;
    switch (act) {
      case 'back': if (navDepth > 0) history.back(); else go('#/'); break;
      case 'cat':
        if (state.cat !== b.dataset.v) { state.cat = b.dataset.v; state.size = ''; }
        render(); break;
      case 'fsize': state.size = state.size === b.dataset.v ? '' : b.dataset.v; render(); break;
      case 'size': state.sel[id] = b.dataset.v; state.sizeErr = ''; render(); break;
      case 'buy': buy(id); break;
      case 'gprev': stepGallery(-1); break;
      case 'gnext': stepGallery(1); break;
      case 'show-utr': state.showUtr = true; render(); { const f = document.getElementById('f-utr'); if (f) f.focus(); } break;
    }
  });

  document.addEventListener('input', e => {
    const el = e.target; const m = el.dataset && el.dataset.model; if (!m) return;
    let v = el.value;
    if (m === 'utr' || m === 'phone') {
      const clean = v.replace(/\D/g, '');
      if (clean !== v) { const pos = Math.max(0, el.selectionStart - (v.length - clean.length)); el.value = clean; try { el.setSelectionRange(pos, pos); } catch (er) {} }
      v = clean;
    }
    if (m === 'utr') state.utr = v; else state.form[m] = v;
  });

  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    if (f.dataset.form === 'details') saveDetails();
    if (f.dataset.form === 'utr') submitUtr(f.dataset.id);
  });

  // photo counter follows swipes
  document.addEventListener('scroll', e => { if (e.target && e.target.matches && e.target.matches('[data-gallery]')) syncCount(e.target); }, true);

  // live countdowns; when a hold runs out, re-render (Store expires the order on read)
  setInterval(() => {
    view.querySelectorAll('[data-until]').forEach(el => {
      const left = Number(el.dataset.until) - Date.now();
      const cd = el.querySelector('.cd'); if (cd) cd.textContent = mmss(left);
      el.classList.toggle('low', left < 3 * 60000);
      if (left <= 0 && !el.dataset.fired) { el.dataset.fired = '1'; render(); }
    });
  }, 1000);

  // how many in-app steps we can go back (so "back" never leaves the shop)
  let navDepth = 0;
  const stack = [route().key];
  window.addEventListener('hashchange', () => {
    const k = route().key;
    if (stack.length > 1 && stack[stack.length - 2] === k) stack.pop(); else stack.push(k);
    navDepth = stack.length - 1;
    render();
  });
  Store.onChange(render);
  const qr = document.getElementById('qrlib');
  if (qr) { qr.addEventListener('load', drawQr); qr.addEventListener('error', drawQr); }
  render();
})();
