/* Rana Originals admin. Vanilla JS, all data through the global Store (../assets/store.js).
   Three screens: Orders, Add (one item / many at once), Stock. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return Store.money(n); };

  /* ---------- icons ---------- */
  var ICON = {
    orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    wa: '<path d="M3 21l1.6-5A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4-1L3 21z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .7a4 4 0 01-1.7-1.7l.7-1-1-2L9 9.5z"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8z"/><circle cx="12" cy="13" r="3.5"/>',
    alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'
  };
  function ic(n, sz) { sz = sz || 24; return '<svg class="ic" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>'; }

  /* ---------- message parser ---------- */
  var BRANDS = [
    ['Ralph Lauren', ['polo ralph lauren', 'ralph lauren']], ['US Polo', ['u.s. polo assn.', 'u.s. polo assn', 'us polo assn', 'u.s. polo', 'us polo', 'uspa']], ['Polo', ['polo']],
    ['Harley-Davidson', ['harley-davidson', 'harley davidson', 'harley']], ['Adidas', ['adidas']], ['Puma', ['puma']], ['Nike', ['nike']], ['Jordan', ['air jordan', 'jordan']],
    ['Reebok', ['reebok']], ["Levi's", ["levi's", 'levis', 'levi']], ['Tommy Hilfiger', ['tommy hilfiger', 'tommy']], ['Calvin Klein', ['calvin klein']],
    ['Jack & Jones', ['jack & jones', 'jack and jones', 'jack n jones']], ['Lacoste', ['lacoste']], ['Gant', ['gant']], ['Hugo Boss', ['hugo boss']], ['Armani', ['emporio armani', 'armani exchange', 'armani']],
    ['Under Armour', ['under armour']], ['New Balance', ['new balance']], ['Asics', ['asics']], ['Skechers', ['skechers']], ['Fila', ['fila']], ['Converse', ['converse']], ['Vans', ['vans']],
    ['Gap', ['gap']], ['H&M', ['h&m']], ['Zara', ['zara']], ['Superdry', ['superdry']], ['Diesel', ['diesel']], ['Guess', ['guess']], ['Nautica', ['nautica']], ['Columbia', ['columbia']],
    ['The North Face', ['the north face', 'north face']], ['Bape', ['a bathing ape', 'bape']], ['Crocs', ['crocs']], ['Woodland', ['woodland']], ['Allen Solly', ['allen solly']],
    ['Van Heusen', ['van heusen']], ['Louis Philippe', ['louis philippe']], ['Wrangler', ['wrangler']], ['Pepe Jeans', ['pepe jeans']], ['Uniqlo', ['uniqlo']], ['Champion', ['champion']],
    ['Kappa', ['kappa']], ['Hollister', ['hollister']], ['Abercrombie & Fitch', ['abercrombie & fitch', 'abercrombie']], ['Timberland', ['timberland']], ['Clarks', ['clarks']], ['Hush Puppies', ['hush puppies']]
  ];
  var CATS = ['Shirts', 'T-Shirts', 'Hoodies', 'Jackets', 'Bottoms', 'Shoes', 'Kids', 'Other'];
  var CAT_RULES = [
    ['Kids', /\b(kids?|boys?|girls?|baby|infant|toddler|junior)\b|\bage\s*\d/i],
    ['Shoes', /\b(sneakers?|shoes?|trainers?|slides?|sandals?|slippers?|loafers?|boots?|flip ?flops?|footwear|crocs)\b/i],
    ['Hoodies', /\b(hoodies?|hoody|sweatshirts?)\b/i],
    ['Jackets', /\b(jackets?|blazers?|coats?|windcheaters?)\b/i],
    ['T-Shirts', /\b(t-?shirts?|tees?)\b/i],
    ['Shirts', /\b(shirts?|polos?)\b/i],
    ['Bottoms', /\b(pants|trousers?|jeans|shorts|joggers?|trackpants|bottoms?|chinos?|cargos?|leggings)\b/i]
  ];
  var reEsc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  BRANDS.forEach(function (b) { b[2] = b[1].map(function (a) { return new RegExp('(^|[^a-z0-9])(' + reEsc(a) + ')(?=$|[^a-z0-9])', 'i'); }); });

  function findBrand(text) {
    var best = null;
    BRANDS.forEach(function (b) {
      b[2].forEach(function (re, i) {
        var m = re.exec(text); if (!m) return;
        var pos = m.index + m[1].length, len = b[1][i].length;
        if (!best || pos < best.pos || (pos === best.pos && len > best.len)) best = { name: b[0], pos: pos, len: len, re: re };
      });
    });
    return best;
  }
  var SIZE_WORD = { small: 'S', medium: 'M', large: 'L', s: 'S', m: 'M', l: 'L', xs: 'XS', xxs: 'XXS', xl: 'XL', xxl: 'XXL', xxxl: 'XXXL', '2xl': 'XXL', '3xl': 'XXXL', free: 'Free size' };
  function sizeToken(t) {
    t = t.toLowerCase().replace(/\.$/, '');
    if (SIZE_WORD[t]) return SIZE_WORD[t];
    if (/^\d{2,3}(\.5)?$/.test(t)) return t;
    return null;
  }
  function lineSizes(line) {
    var l = line.replace(/[–—]/g, '-'), m;
    m = l.match(/\bage\s*:?\s*(\d{1,2})\s*(?:-|to|\/)\s*(\d{1,2})/i); if (m) return ['Age ' + m[1] + '-' + m[2]];
    m = l.match(/\b(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:y|yr|yrs|years?)\b/i); if (m) return ['Age ' + m[1] + '-' + m[2]];
    m = l.match(/\bage\s*:?\s*(\d{1,2})\b/i); if (m) return ['Age ' + m[1]];
    m = l.match(/\buk\s*:?\s*(\d{1,2}(?:\.5)?(?:\s*(?:-|\/|,|&|and|or)\s*(?:uk\s*)?\d{1,2}(?:\.5)?)*)/i);
    if (m) return m[1].split(/\s*(?:-|\/|,|&|and|or)\s*/i).map(function (x) { return 'UK ' + x.replace(/uk\s*/i, '').trim(); }).filter(function (x) { return x !== 'UK '; });
    m = l.match(/\bsizes?\b\s*[:\-]?\s*(.*)$/i);
    if (m) {
      var rest = m[1].toLowerCase().replace(/extra\s*large/g, 'xl').replace(/free\s*size/g, 'free');
      var out = [], toks = rest.split(/\s*(?:-|\/|,|&|\+|\band\b|\bor\b|\bto\b|\s)\s*/);
      for (var i = 0; i < toks.length; i++) {
        if (!toks[i]) continue;
        var s = sizeToken(toks[i]);
        if (s) out.push(s); else if (out.length) break;
      }
      return out;
    }
    if (/\bfree\s*size\b/i.test(l)) return ['Free size'];
    return [];
  }
  function findPrice(lines) {
    var all = lines.join('\n'), re = /(?:price|₹|\brs\.?|\binr)\s*[:.\-=]?\s*(?:₹|rs\.?)?\s*(\d[\d,]*)/gi, m;
    while ((m = re.exec(all))) {
      if (/mrp\s*[:.\-=]?\s*$/i.test(all.slice(Math.max(0, m.index - 8), m.index))) continue;
      var n = +m[1].replace(/,/g, ''); if (n > 0) return n;
    }
    var pool = lines.length > 1 ? lines.slice(1) : lines;
    for (var i = 0; i < pool.length; i++) {
      var l = pool[i];
      if (lineSizes(l).length) continue;
      l = l.replace(/mrp\s*[:.\-=]?\s*(?:₹|rs\.?)?\s*[\d,]+/gi, ' ');
      var mm = l.match(/(?:^|[^\d.,])(\d{3,5})(?![\d.,]|\s*(?:mm|cm|ml|gm|%|years?|yrs))/i);
      if (mm) return +mm[1];
    }
    return null;
  }
  /* msg: what Atul types. fix: his corrections from tapping a chip. */
  function parse(msg, fix) {
    fix = fix || {};
    var lines = String(msg || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var text = lines.join('\n');
    var name = 'name' in fix ? fix.name : (lines[0] || '');
    var sizes = [];
    lines.forEach(function (l) { lineSizes(l).forEach(function (s) { if (sizes.indexOf(s) < 0) sizes.push(s); }); });
    if (fix.sizes) sizes = fix.sizes.slice();
    var b = findBrand(name) || findBrand(text);
    var brand = 'brand' in fix ? fix.brand : (b ? b.name : '');
    var title = name;
    if (brand) { var bb = findBrand(name); if (bb && bb.name === brand) title = name.replace(bb.re, '$1').replace(/\s{2,}/g, ' ').trim(); }
    if (!title) title = name;
    var cat = 'Other';
    for (var i = 0; i < CAT_RULES.length; i++) if (CAT_RULES[i][1].test(text)) { cat = CAT_RULES[i][0]; break; }
    if (cat === 'Other' && sizes.some(function (s) { return /^UK /.test(s); })) cat = 'Shoes';
    if (fix.category) cat = fix.category;
    return {
      name: name, brand: brand, title: title, category: cat, sizes: sizes,
      price: 'price' in fix ? fix.price : findPrice(lines),
      note: /\bwith\s+(original\s+)?box\b/i.test(text) ? 'With box' : ''
    };
  }

  /* ---------- helpers ---------- */
  function tenDigits(p) { return String(p || '').replace(/\D/g, '').slice(-10); }
  function fmtPhone(p) { var t = tenDigits(p); return t.length === 10 ? t.slice(0, 5) + ' ' + t.slice(5) : p; }
  function groupUtr(u) { return String(u || '').replace(/(\d{4})(?=\d)/g, '$1 '); }
  function waTo(phone, text) { return 'https://wa.me/91' + tenDigits(phone) + '?text=' + encodeURIComponent(text); }
  function itemLink(id) { try { var base = (window.RO_CONFIG && window.RO_CONFIG.siteUrl) || new URL('../', location.href).href; return base + 'p/' + encodeURIComponent(id) + '/'; } catch (e) { return ''; } }
  function pname(p) { return ((p.brand ? p.brand + ' ' : '') + (p.title || '')).trim(); }
  /* short name for narrow rows: drop the brand, then filler words, when the full name is long */
  function shortName(p) {
    var full = pname(p); if (full.length <= 30) return full;
    var t = (p.title || full).trim();
    var lean = t.replace(/^(100%\s+)?(genuine\s+|branded\s+)?originals?\s+/i, '').trim();
    return lean || t;
  }
  function photoOf(productId) { var p = Store.getProduct(productId); return p && p.photos && p.photos[0] ? p.photos[0] : ''; }
  function thumb(src, cls) { return src ? '<img class="th ' + (cls || '') + '" src="' + esc(src) + '" alt="">' : '<div class="th ' + (cls || '') + '">' + ic('image', 24) + '</div>'; }
  function empty(icon, line) { return '<div class="empty">' + ic(icon, 40) + '<div>' + esc(line) + '</div></div>'; }
  function top(gear) { return '<header class="top"><span class="ro-logo">RANA <span>originals</span></span>' + (gear ? '<button class="iconbtn" data-act="settings" aria-label="Settings">' + ic('gear', 24) + '</button>' : '') + '</header>'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------- sheet + toast ---------- */
  var closeT, toastT, toastUndo = null;
  function sheet(html, mount) {
    var root = $('#sheet'); clearTimeout(closeT);
    root.innerHTML = '<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
    root.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('open'); }); });
    if (mount) mount(root.querySelector('.sheet'));
  }
  function closeSheet() {
    var root = $('#sheet'); root.classList.remove('open');
    clearTimeout(closeT); closeT = setTimeout(function () { root.hidden = true; root.innerHTML = ''; flush(); }, 230);
  }
  function sheetOpen() { return !$('#sheet').hidden; }
  /* Waiting for the server: a button that cannot be tapped twice, and a short message if it fails. */
  function errMsg(e) {
    var c = e && e.code;
    return c === 'network' ? 'No connection. Please try again.'
      : c === 'unauthorized' ? 'Please enter the passcode again.'
        : c === 'busy' ? 'Busy right now. Please try again.'
          : c === 'out_of_stock' ? 'Just sold out.'
            : c === 'too_many_photos' ? 'Too many photos. Use 20 or fewer.'
              : c === 'photo_too_big' ? 'A photo is too big.'
                : 'Something went wrong. Please try again.';
  }
  function busyBtn(btn, label) {
    if (!btn) return function () {};
    var old = btn.innerHTML; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    btn.textContent = label || 'Saving…';
    return function () { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = old; };
  }
  function sheetErr(e) {
    var err = $('#sErr');
    if (err && sheetOpen()) { err.textContent = errMsg(e); err.hidden = false; } else toast(errMsg(e));
  }
  /* r: what the action returned. A Promise keeps the sheet open (button busy) until it is done. */
  function finish(btn, r) {
    if (!r || typeof r.then !== 'function') { closeSheet(); return; }
    var undo = busyBtn(btn);
    var err = $('#sErr'); if (err) err.hidden = true;
    r.then(function () { closeSheet(); }, function (e) { undo(); sheetErr(e); });
  }
  function confirmSheet(o, cb) {
    sheet('<h3>' + esc(o.title) + '</h3>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
      '<div class="err" id="sErr" hidden></div>' +
      '<div class="btns"><button class="btn ghost sm" data-act="close">Cancel</button><button class="btn sm ' + (o.danger ? 'danger' : '') + '" id="sOk">' + esc(o.ok) + '</button></div>',
      function (el) { var ok = el.querySelector('#sOk'); ok.onclick = function () { if (!ok.disabled) finish(ok, cb()); }; });
  }
  /* o: title, text, value, numeric, ok, required, validate(v), extra:{label, cb} */
  function inputSheet(o, cb) {
    sheet('<h3>' + esc(o.title) + '</h3>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
      '<input class="inp" id="sIn" value="' + esc(o.value || '') + '" autocomplete="off" aria-label="' + esc(o.title) + '"' + (o.numeric ? ' inputmode="numeric"' : '') + '>' +
      '<div class="err" id="sErr" hidden></div>' +
      '<div class="stack"><button class="btn sm" id="sOk">' + esc(o.ok || 'Save') + '</button>' +
      (o.extra ? '<button class="btn ghost sm" id="sExtra">' + esc(o.extra.label) + '</button>' : '') +
      '<button class="btn ghost sm" data-act="close">Cancel</button></div>',
      function (el) {
        var inp = el.querySelector('#sIn'), err = el.querySelector('#sErr');
        if (o.numeric) inp.addEventListener('input', function () { var c = inp.value.replace(/\D/g, ''); if (c !== inp.value) inp.value = c; });
        var okBtn = el.querySelector('#sOk');
        function go() {
          if (okBtn.disabled) return;
          var v = inp.value.trim();
          var m = o.validate ? o.validate(v) : (o.required && !v ? 'Please fill this in' : '');
          if (m) { err.textContent = m; err.hidden = false; return; }
          finish(okBtn, cb(v));
        }
        okBtn.onclick = go;
        if (o.extra) { var ex = el.querySelector('#sExtra'); ex.onclick = function () { if (!ex.disabled) finish(ex, o.extra.cb()); }; }
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
        setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 240);
      });
  }
  function toast(msg, undo) {
    var t = $('#toast'); toastUndo = undo || null;
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button data-act="undo">Undo</button>' : '');
    t.classList.toggle('up', !!$('.actbar'));
    t.classList.add('show'); clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('show'); toastUndo = null; }, undo ? 5000 : 2600);
  }

  /* ---------- state ---------- */
  var S = { tab: 'orders', filter: 'new', ticked: {}, addMode: 'one', busy: {}, pass: '', loginErr: '' };
  function busyAttr(key) { return S.busy[key] ? ' disabled aria-busy="true"' : ''; }
  var uid = 0;
  function blankOne() { return { photos: [], msg: '', fix: {}, qty: {} }; }
  function blankMany() { return { photos: [], starts: {}, msgs: {}, fixes: {}, step: 'photos' }; }
  var one = blankOne(), many = blankMany(), busy = 0;

  /* ---------- Orders ---------- */
  var PROBLEMS = ['payment_not_found', 'amount_mismatch', 'refund_due'];
  var FILTERS = {
    new: function (o) { return o.status === 'verifying'; },
    send: function (o) { return o.status === 'confirmed'; },
    done: function (o) { return o.status === 'shipped' || o.status === 'delivered' || o.status === 'refunded'; },
    problems: function (o) { return PROBLEMS.indexOf(o.status) >= 0; }
  };
  function canTick(o) { return (S.filter === 'new' && !o.stockIssue) || S.filter === 'send'; }
  function itemLine(o) {
    var i = o.items[0] || {}, more = o.items.length > 1 ? ' +' + (o.items.length - 1) : '';
    return '<div class="nm2">' + esc(shortName(i)) + '</div><div class="nm">' + (i.size ? esc(i.size) + more + ' · ' : '') + money(o.amount) + '</div>';
  }
  function orderRow(o) {
    var tickable = canTick(o), on = !!S.ticked[o.id];
    return '<div class="card row-btn" role="button" tabindex="0" data-act="order" data-id="' + esc(o.id) + '">' +
      (tickable ? '<button class="tick ' + (on ? 'on' : '') + '" data-act="tick" data-id="' + esc(o.id) + '" role="checkbox" aria-checked="' + on + '" aria-label="Tick ' + esc(o.customer.name) + '"><i>' + (on ? ic('check', 18) : '') + '</i></button>' : '') +
      thumb(photoOf((o.items[0] || {}).productId)) +
      '<div class="body">' + itemLine(o) +
      '<div class="sub">' + esc((o.customer.name || '').split(' ')[0]) + '</div>' +
      (o.utr ? '<div class="utrline">UPI <b class="utr">' + groupUtr(o.utr) + '</b></div>' : '') +
      (o.stockIssue && o.status === 'verifying' ? '<div class="redline">Paid after it sold out. Refund.</div>' : (S.filter === 'problems' || S.filter === 'done' ? '<div class="sub">' + esc(Store.statusLabel(o.status)) + '</div>' : '')) +
      '</div></div>';
  }
  function vOrders() {
    var os = Store.getOrders();
    var cnt = {}; Object.keys(FILTERS).forEach(function (k) { cnt[k] = os.filter(FILTERS[k]).length; });
    if (S.filter === 'problems' && !cnt.problems) S.filter = 'new';
    var list = os.filter(FILTERS[S.filter]);
    var ids = {}; list.forEach(function (o) { if (canTick(o)) ids[o.id] = 1; });
    Object.keys(S.ticked).forEach(function (k) { if (!ids[k]) delete S.ticked[k]; });
    var h = top(true) + '<h1>Orders</h1><div class="tiles">' +
      [['new', 'New'], ['send', 'To send'], ['done', 'Done']].map(function (t) {
        return '<button class="tile ' + (S.filter === t[0] ? 'on' : '') + '" data-act="filter" data-v="' + t[0] + '" aria-pressed="' + (S.filter === t[0]) + '"><b>' + cnt[t[0]] + '</b>' + t[1] + '</button>';
      }).join('') + '</div>';
    if (cnt.problems) h += '<button class="problink ' + (S.filter === 'problems' ? 'on' : '') + '" data-act="filter" data-v="problems">' + ic('alert', 18) + 'Problems (' + cnt.problems + ')</button>';
    var wait = Store.status();
    if (!list.length && !wait.ordersLoaded) h += empty('orders', wait.error === 'network' ? 'No connection. Trying again…' : 'Loading orders…');
    else if (!list.length) h += empty('orders', { new: 'No new orders.', send: 'Nothing to send.', done: 'No finished orders yet.', problems: 'No problems.' }[S.filter]);
    else h += '<div class="stack">' + list.map(orderRow).join('') + '</div>';
    if ((S.filter === 'new' || S.filter === 'send') && Object.keys(ids).length) {
      var n = Object.keys(S.ticked).length;
      var label = S.filter === 'new' ? (n ? 'Money received for ' + n : 'Tick the paid ones') : (n ? 'Mark ' + n + ' sent' : 'Tick the sent ones');
      if (S.busy.bulk) label = 'Saving…';
      h += '<div class="actbar"><button class="btn" data-act="bulk" ' + (n && !S.busy.bulk ? '' : 'disabled') + (S.busy.bulk ? ' aria-busy="true"' : '') + '>' + label + '</button></div>';
    }
    return h;
  }
  function bulk() {
    var ids = Object.keys(S.ticked); if (!ids.length || S.busy.bulk) return;
    var from = S.filter === 'new' ? 'verifying' : 'confirmed', to = S.filter === 'new' ? 'confirmed' : 'shipped';
    var done = ids.filter(function (id) { var o = Store.getOrder(id); return o && o.status === from && !(to === 'confirmed' && o.stockIssue); });
    S.busy.bulk = true; render();
    Store.setOrderStatus(done, to, to === 'confirmed' ? 'Money received' : 'Sent').then(function () {
      S.busy.bulk = false; S.ticked = {}; render();
      toast(to === 'confirmed' ? plural(done.length, 'order', 'orders') + ' paid' : plural(done.length, 'order', 'orders') + ' sent', function () {
        var back = done.filter(function (id) { var o = Store.getOrder(id); return o && o.status === to; });
        Store.setOrderStatus(back, from, 'Undo').catch(function (e) { toast(errMsg(e)); });
      });
    }, function (e) { S.busy.bulk = false; render(); toast(errMsg(e)); });
  }
  /* Every message about an order ends with the item's link, so WhatsApp shows its picture. */
  function waMsg(o) { var i = (o.items || [])[0], l = i && i.productId ? itemLink(i.productId) : ''; return waMsgText(o) + (l ? '\n' + l : ''); }
  function waMsgText(o) {
    var n = (o.customer.name || '').split(' ')[0] || 'there', i = o.items[0] || {}, what = pname(i) + (i.size ? ' (' + i.size + ')' : '');
    switch (o.status) {
      case 'verifying': return o.stockIssue ? 'Hi ' + n + ', sorry, ' + what + ' sold out before your payment came. We will refund ' + money(o.amount) + ' to your UPI.' : 'Hi ' + n + ', we got your order for ' + what + '. Checking your payment of ' + money(o.amount) + ' now.';
      case 'confirmed': return 'Hi ' + n + ', payment of ' + money(o.amount) + ' received for ' + what + '. Thank you! We will send it soon.';
      case 'shipped': return 'Hi ' + n + ', your ' + what + ' has been sent. It should reach you in a few days.';
      case 'delivered': return 'Hi ' + n + ', hope you like your ' + what + '! Thank you for shopping with Rana Originals.';
      case 'payment_not_found': return 'Hi ' + n + ', we could not find your payment of ' + money(o.amount) + ' for ' + what + '. Please check and send the 12 digit UPI reference again.';
      case 'amount_mismatch': return 'Hi ' + n + ', the amount we got for ' + what + ' does not match ' + money(o.amount) + '. Please message us.';
      case 'refund_due': return 'Hi ' + n + ', sorry, we cannot send ' + what + '. We will refund ' + money(o.amount) + ' to your UPI shortly.';
      case 'refunded': return 'Hi ' + n + ', your refund of ' + money(o.amount) + ' is done. Sorry for the trouble.';
      default: return 'Hi ' + n + ', about your order for ' + what + '.';
    }
  }
  function canRestock(o) {
    if (o.stockHeld) return true;
    return o.items.every(function (i) { var p = Store.getProduct(i.productId), s = p && p.sizes.filter(function (x) { return x.label === i.size; })[0]; return s && s.qty >= i.qty; });
  }
  function openOrder(id) {
    var o = Store.getOrder(id); if (!o) return;
    var c = o.customer, acts = [];
    var A = function (act, label, cls) { acts.push('<button class="btn sm ' + (cls || 'ghost') + '" data-oact="' + act + '">' + esc(label) + '</button>'); };
    if (o.status === 'verifying' && o.stockIssue) A('refund', 'Refund due', 'danger');
    else if (o.status === 'verifying') { A('recv', 'Money received', ' '); A('nf', 'Not received'); A('wrong', 'Wrong amount'); }
    else if (o.status === 'confirmed') A('ship', 'Mark sent', ' ');
    else if (o.status === 'shipped') A('deliv', 'Mark delivered');
    else if (o.status === 'payment_not_found' || o.status === 'amount_mismatch') { A('late', 'Money received'); A('refund', 'Refund due'); }
    else if (o.status === 'refund_due') A('refunded', 'Mark refunded', ' ');
    var h = '<div class="shead">' + thumb(photoOf((o.items[0] || {}).productId)) + '<div class="body"><h3>' + esc(c.name) + '</h3><div class="sub">' + esc(Store.statusLabel(o.status)) + ' · ' + money(o.amount) + '</div></div></div>' +
      (o.stockIssue && o.status === 'verifying' ? '<div class="redline" style="margin-top:10px">Paid after it sold out. Refund.</div>' : '') +
      '<div class="info">' + o.items.map(function (i) { return '<div>' + esc(pname(i)) + ' · ' + esc(i.size) + (i.qty > 1 ? ' × ' + i.qty : '') + '</div>'; }).join('') +
      (o.utr ? '<div>UPI ref <b class="utr">' + groupUtr(o.utr) + '</b></div>' : '') +
      '<div>' + esc(c.address || '') + (c.pincode ? ', ' + esc(c.pincode) : '') + '</div>' +
      '<div><a href="tel:+91' + esc(tenDigits(c.phone)) + '">' + esc(fmtPhone(c.phone)) + '</a></div></div>' +
      '<div class="err" id="sErr" hidden></div>' +
      '<div class="stack"><a class="btn wa sm" target="_blank" rel="noopener" href="' + esc(waTo(c.phone, waMsg(o))) + '">' + ic('wa', 22) + 'WhatsApp customer</a>' + acts.join('') + '</div>';
    sheet(h, function (el) {
      el.querySelectorAll('[data-oact]').forEach(function (b) { b.onclick = function () { if (!b.disabled) orderAct(b.dataset.oact, o.id, b); }; });
    });
  }
  // change status with the sheet still open; close it (and say so) once it worked
  function setSt(id, st, note, msg) { return Store.setOrderStatus(id, st, note).then(function () { toast(msg); }); }
  function orderAct(act, id, btn) {
    var o = Store.getOrder(id); if (!o) return;
    if (act === 'recv') finish(btn, setSt(id, 'confirmed', 'Money received', 'Marked paid'));
    else if (act === 'ship') finish(btn, setSt(id, 'shipped', 'Sent', 'Marked sent'));
    else if (act === 'deliv') finish(btn, setSt(id, 'delivered', '', 'Marked delivered'));
    else if (act === 'nf') confirmSheet({ title: 'Money not received?', text: 'The piece goes back to stock.', ok: 'Not received', danger: true }, function () { return setSt(id, 'payment_not_found', 'Money not found', 'Marked not received'); });
    else if (act === 'wrong') inputSheet({ title: 'Wrong amount', text: 'Expected ' + money(o.amount) + '. How much came in?', numeric: true, required: true, ok: 'Save' }, function (v) { return setSt(id, 'amount_mismatch', 'Received ' + money(+v) + ', expected ' + money(o.amount), 'Marked wrong amount'); });
    else if (act === 'refund') confirmSheet({ title: 'Refund ' + money(o.amount) + '?', text: 'Marks the order as refund due.', ok: 'Refund due', danger: true }, function () { return setSt(id, 'refund_due', o.stockIssue ? 'Paid after it sold out' : 'Refund to customer', 'Marked refund due'); });
    else if (act === 'refunded') inputSheet({ title: 'Mark refunded', text: 'Refund reference from your UPI app', numeric: true, required: true, ok: 'Mark refunded' }, function (v) { return setSt(id, 'refunded', v, 'Marked refunded'); });
    else if (act === 'late') {
      if (!canRestock(o)) { confirmSheet({ title: 'Item has sold out', text: 'Refund this customer instead.', ok: 'Refund due', danger: true }, function () { return setSt(id, 'refund_due', 'Paid after it sold out', 'Marked refund due'); }); return; }
      var hold = o.stockHeld ? Promise.resolve(true) : Store.submitUtr(o.id, o.utr).then(function (r) { return !!(r.order && !r.order.stockIssue); });
      finish(btn, hold.then(function (ok) {
        if (!ok) { toast('Could not hold the item. Refund instead.'); return; }
        return setSt(id, 'confirmed', 'Money received after all', 'Marked paid');
      }));
    }
  }

  /* ---------- Settings ---------- */
  function openSettings() {
    var st = Store.getSettings();
    sheet('<h3>Settings</h3>' +
      '<div class="field"><label class="lbl" for="stUpi">UPI ID</label><input class="inp" id="stUpi" value="' + esc(st.upiId) + '" autocapitalize="none" autocorrect="off" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="stName">Payee name</label><input class="inp" id="stName" value="' + esc(st.payeeName) + '" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="stWa">WhatsApp number</label><input class="inp" id="stWa" inputmode="tel" value="' + esc(tenDigits(st.whatsapp)) + '" autocomplete="off"></div>' +
      '<div class="err" id="stErr" hidden></div>' +
      '<div class="stack"><button class="btn sm" id="stSave">Save</button><button class="btn ghost sm" data-act="close">Cancel</button>' +
      (Store.remote ? '<button class="link danger-link" id="stOut">Log out</button></div>' : '<button class="link danger-link" id="stReset">Reset demo data</button></div>'),
      function (el) {
        var saveBtn = el.querySelector('#stSave');
        saveBtn.onclick = function () {
          if (saveBtn.disabled) return;
          var wa = tenDigits(el.querySelector('#stWa').value), upi = el.querySelector('#stUpi').value.trim(), err = el.querySelector('#stErr');
          var m = !/^[\w.\-]+@[\w.\-]+$/.test(upi) ? 'Check the UPI ID, it looks like name@bank' : wa.length !== 10 ? 'Enter a 10 digit WhatsApp number' : '';
          if (m) { err.textContent = m; err.hidden = false; return; }
          err.hidden = true;
          var undo = busyBtn(saveBtn);
          Store.saveSettings({ upiId: upi, payeeName: el.querySelector('#stName').value.trim(), whatsapp: '91' + wa }).then(function () {
            closeSheet(); toast('Saved');
          }, function (e) { undo(); err.textContent = errMsg(e); err.hidden = false; });
        };
        if (Store.remote) {
          el.querySelector('#stOut').onclick = function () { closeSheet(); Store.adminLogout(); render(); };
          return;
        }
        el.querySelector('#stReset').onclick = function () {
          confirmSheet({ title: 'Reset demo data?', text: 'All items and orders go back to the demo. Items you added are lost.', ok: 'Reset', danger: true }, function () {
            one = blankOne(); many = blankMany(); S.ticked = {}; Store.reset(); toast('Demo data reset');
          });
        };
      });
  }

  /* ---------- Stock ---------- */
  function vStock() {
    var ps = Store.getProducts(), h = top(false) + '<h1>Stock</h1>', wait = Store.status();
    if (!ps.length && !wait.loaded) return h + empty('box', wait.error === 'network' ? 'No connection. Trying again…' : 'Loading…');
    if (!ps.length) return h + empty('box', 'No items yet. Tap Add to post one.');
    h += '<div class="stack">';
    ps.forEach(function (p) {
      var sizes = p.sizes.length ? p.sizes : [null];
      sizes.forEach(function (s) {
        var q = s ? s.qty : 0, hidden = p.active === false;
        h += '<div class="card row-btn" role="button" tabindex="0" data-act="product" data-id="' + esc(p.id) + '">' + thumb(p.photos && p.photos[0]) +
          '<div class="body"><div class="nm2 l3">' + esc(shortName(p)) + '</div>' +
          '<div class="sub">' + (s ? '<b class="sz">' + esc(s.label) + '</b> · ' : '') + (q ? q + ' left' : '<span class="redtxt">Sold out</span>') + (hidden ? ' · Hidden' : '') + '</div></div>' +
          (s ? '<button class="fb" data-act="' + (q ? 'sold' : 'add1') + '" data-id="' + esc(p.id) + '" data-s="' + esc(s.label) + '"' + busyAttr('stk:' + p.id + '|' + s.label) + '>' + (q ? 'Sold 1' : 'Add 1') + '</button>' : '') + '</div>';
      });
    });
    return h + '</div>';
  }
  function openProduct(id) {
    var p = Store.getProduct(id); if (!p) return;
    var hidden = p.active === false;
    sheet('<div class="shead">' + thumb(p.photos && p.photos[0]) + '<div class="body"><h3>' + esc(pname(p)) + '</h3><div class="sub">' + (p.price == null ? 'No price · buyers ask' : money(p.price)) + (hidden ? ' · Hidden' : '') + '</div></div></div>' +
      '<div class="stack"><button class="btn sm" id="pPrice">Change price</button>' +
      '<button class="btn ghost sm" id="pHide">' + (hidden ? 'Show in shop' : 'Hide from shop') + '</button>' +
      '<button class="btn ghost sm danger-link" id="pDel">Delete</button></div><div class="err" id="sErr" hidden></div>',
      function (el) {
        el.querySelector('#pPrice').onclick = function () {
          inputSheet({ title: 'Price', value: p.price == null ? '' : String(p.price), numeric: true, ok: 'Save price', validate: function (v) { return +v > 0 ? '' : 'Enter the price'; },
            extra: { label: 'No price · buyers ask', cb: function () { return Store.saveProduct({ id: p.id, price: null }).then(function () { toast('Price removed'); }); } } },
          function (v) { return Store.saveProduct({ id: p.id, price: +v }).then(function () { toast('Price saved'); }); });
        };
        var hideBtn = el.querySelector('#pHide');
        hideBtn.onclick = function () { if (!hideBtn.disabled) finish(hideBtn, Store.saveProduct({ id: p.id, active: hidden }).then(function () { toast(hidden ? 'Back in the shop' : 'Hidden from shop'); })); };
        el.querySelector('#pDel').onclick = function () {
          confirmSheet({ title: 'Delete this item?', text: pname(p) + ' will be removed for good.', ok: 'Delete', danger: true }, function () { return Store.deleteProduct(p.id).then(function () { toast('Deleted'); }); });
        };
      });
  }

  /* ---------- photos ---------- */
  function resize(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onerror = function () { URL.revokeObjectURL(url); rej(); };
      im.onload = function () {
        var k = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      im.src = url;
    });
  }
  function addFiles(files, target) {
    files = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type) || !f.type; }).slice(0, 40);
    if (!files.length) return;
    busy++; render();
    var chain = Promise.resolve(), bad = 0;
    files.forEach(function (f) {
      chain = chain.then(function () { return resize(f).then(function (src) { target.photos.push({ id: 'f' + (++uid), src: src }); }, function () { bad++; }); });
    });
    chain.then(function () { busy--; if (bad) toast(plural(bad, 'photo', 'photos') + ' could not be read'); render(); });
  }

  /* ---------- Add: shared bits ---------- */
  function chipsHtml(it, key, compact) {
    var c = function (f, label, cls) { return '<button class="chip ' + (cls || '') + '" data-act="fix" data-f="' + f + '" data-k="' + esc(key) + '"><span>' + esc(label) + '</span>' + ic('pencil', 16) + '</button>'; };
    var h = '<div class="chips">';
    h += it.name ? c('name', it.name) : c('name', 'Name', 'warn');
    h += it.price == null ? c('price', 'No price · buyers ask', 'dark') : c('price', money(it.price));
    h += c('sizes', it.sizes.length ? it.sizes.join(', ') : 'Free size', it.sizes.length ? '' : 'dash');
    if (!compact) { h += it.brand ? c('brand', it.brand) : c('brand', 'Brand', 'dash'); h += c('category', it.category); }
    return h + '</div>';
  }
  function sizesOf(it) { return it.sizes.length ? it.sizes : ['Free size']; }
  function draftFor(key) {
    if (key === 'one') return { msg: one.msg, fix: one.fix };
    return { msg: many.msgs[key] || '', fix: many.fixes[key] || (many.fixes[key] = {}) };
  }
  function fixSheet(f, key) {
    var d = draftFor(key), it = parse(d.msg, d.fix), fix = d.fix;
    var done = function () { if (key === 'one') updateOne(); else updateRow(key); };
    if (f === 'name') inputSheet({ title: 'Name', value: it.name, required: true }, function (v) { fix.name = v; done(); });
    else if (f === 'brand') inputSheet({ title: 'Brand', value: it.brand, ok: 'Save' }, function (v) { fix.brand = v; done(); });
    else if (f === 'sizes') inputSheet({ title: 'Sizes', text: 'Separate with commas, like 43, 44', value: it.sizes.join(', ') }, function (v) {
      var list = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      if (list.length) fix.sizes = list; else delete fix.sizes; done();
    });
    else if (f === 'price') inputSheet({ title: 'Price', value: it.price == null ? '' : String(it.price), numeric: true, ok: 'Save price', validate: function (v) { return +v > 0 ? '' : 'Enter the price'; },
      extra: { label: 'No price · buyers ask', cb: function () { fix.price = null; done(); } } }, function (v) { fix.price = +v; done(); });
    else if (f === 'category') sheet('<h3>Type</h3><div class="opts">' + CATS.map(function (c) { return '<button class="fb ' + (c === it.category ? 'on' : '') + '" data-cat="' + c + '">' + c + '</button>'; }).join('') + '</div>',
      function (el) { el.querySelectorAll('[data-cat]').forEach(function (b) { b.onclick = function () { fix.category = b.dataset.cat; closeSheet(); done(); }; }); });
  }
  function product(it, photos, qtyOf) {
    return {
      brand: it.brand, title: it.title || it.name, category: it.category, photos: photos,
      sizes: sizesOf(it).map(function (s) { return { label: s, qty: qtyOf(s) }; }),
      price: it.price, mrp: null, premium: false, note: it.note, active: true
    };
  }
  function seg() {
    return '<div class="seg" role="tablist"><button role="tab" class="' + (S.addMode === 'one' ? 'on' : '') + '" data-act="mode" data-v="one" aria-selected="' + (S.addMode === 'one') + '">One item</button>' +
      '<button role="tab" class="' + (S.addMode === 'many' ? 'on' : '') + '" data-act="mode" data-v="many" aria-selected="' + (S.addMode === 'many') + '">Many at once</button></div>';
  }
  var busyHtml = function () { return busy ? '<div class="busy"><div class="spin"></div>Getting photos ready</div>' : ''; };

  /* ---------- Add one ---------- */
  function oneOut() {
    if (!one.msg.trim() && !Object.keys(one.fix).length) return '';
    var it = parse(one.msg, one.fix);
    return chipsHtml(it, 'one', false) + '<div class="stack">' + sizesOf(it).map(function (s) {
      var q = one.qty[s] || 1;
      return '<div class="card szrow"><span class="nm">' + esc(s) + '</span><div class="stp"><button data-act="qty" data-s="' + esc(s) + '" data-d="-1" aria-label="One less" ' + (q <= 1 ? 'disabled' : '') + '>' + ic('minus', 20) + '</button><output>' + q + '</output><button data-act="qty" data-s="' + esc(s) + '" data-d="1" aria-label="One more">' + ic('plus', 20) + '</button></div></div>';
    }).join('') + '</div>';
  }
  function updateOne() { var el = $('#oneOut'); if (el) el.innerHTML = oneOut(); }
  function vAddOne() {
    var h = '';
    if (!one.photos.length && !busy) h += '<button class="pick" data-act="pick">' + ic('camera', 36) + 'Add photos</button>';
    else h += '<div class="photos">' + one.photos.map(function (p, i) {
      return '<div class="ph"><img src="' + p.src + '" alt="Photo ' + (i + 1) + '"><button class="rm" data-act="rmphoto" data-i="' + i + '" aria-label="Remove photo ' + (i + 1) + '"><i>' + ic('x', 14) + '</i></button></div>';
    }).join('') + '<button class="addph" data-act="pick" aria-label="Add more photos">' + ic('plus', 32) + '</button></div>';
    h += busyHtml();
    h += '<label class="lbl" for="msg">Your message</label><textarea id="msg" class="msg" data-k="one" rows="4" autocapitalize="sentences">' + esc(one.msg) + '</textarea>';
    h += '<div id="oneOut">' + oneOut() + '</div>';
    h += '<div class="actbar"><button class="btn" data-act="post1"' + busyAttr('post') + '>' + (S.busy.post ? 'Posting…' : 'Post') + '</button></div>';
    return h;
  }
  function postOne() {
    if (S.busy.post) return;
    var it = parse(one.msg, one.fix);
    if (busy) return toast('Photos are still getting ready');
    if (!one.photos.length) return toast('Add a photo first');
    if (!it.name) return toast('Type the item name on the first line');
    S.busy.post = true; render();
    Store.saveProduct(product(it, one.photos.map(function (x) { return x.src; }), function (s) { return one.qty[s] || 1; })).then(function (p) {
      S.busy.post = false;
      if (!Store.getProduct(p.id)) { render(); return toast('Phone storage is full. Delete old items first.'); }
      posted1(p);
    }, function (e) { S.busy.post = false; render(); toast(errMsg(e)); });
  }
  function posted1(p) {
    var msg = one.msg.trim();
    one = blankOne(); render(); window.scrollTo(0, 0);
    var share = msg + '\n' + itemLink(p.id);
    sheet('<div class="center"><div class="okic">' + ic('check', 34) + '</div><h3>Posted</h3><p>' + esc(pname(p)) + ' is in your shop.</p></div>' +
      '<div class="stack"><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(share) + '">' + ic('wa', 22) + 'Share on WhatsApp</a>' +
      '<button class="btn ghost" data-act="close">Add another</button></div>');
  }

  /* ---------- Add many ---------- */
  function groups() {
    var g = [];
    many.photos.forEach(function (p, i) {
      if (i === 0 || many.starts[p.id]) g.push({ key: p.id, photos: [], start: i });
      g[g.length - 1].photos.push(p);
    });
    return g;
  }
  function itemRow(g, n) {
    var it = parse(many.msgs[g.key] || '', many.fixes[g.key]);
    return '<div class="card irow ' + (it.name ? '' : 'need') + '" id="row-' + g.key + '"><div class="cover">' + thumb(g.photos[0].src) + '<span class="cnt">' + g.photos.length + '</span></div>' +
      '<div class="body"><label class="vh" for="m-' + g.key + '">Item ' + n + ' message</label><textarea id="m-' + g.key + '" class="msg" data-k="' + g.key + '" rows="3">' + esc(many.msgs[g.key] || '') + '</textarea>' +
      '<div class="rowout">' + rowOut(it, g.key) + '</div></div></div>';
  }
  function rowOut(it, key) { return (it.name ? '' : '<div class="needline">Add a name</div>') + chipsHtml(it, key, true); }
  function updateRow(key) {
    var row = document.getElementById('row-' + key); if (!row) return render();
    var it = parse(many.msgs[key] || '', many.fixes[key]);
    row.classList.toggle('need', !it.name);
    row.querySelector('.rowout').innerHTML = rowOut(it, key);
  }
  function vAddMany() {
    var g = groups(), h = '';
    if (!many.photos.length) {
      h += busyHtml();
      if (!busy) h += '<button class="pick" data-act="pick">' + ic('camera', 36) + 'Choose all the photos</button><p class="hint">Pick photos of all items together, in order.</p>';
      return h;
    }
    if (many.step === 'photos') {
      h += '<p class="hint">' + plural(many.photos.length, 'photo', 'photos') + ', ' + plural(g.length, 'item', 'items') + '. Tap the first photo of each new item.</p>' + busyHtml();
      g.forEach(function (gr, gi) {
        h += '<div class="group"><div class="ghead">Item ' + (gi + 1) + '<span>' + plural(gr.photos.length, 'photo', 'photos') + '</span></div><div class="grid">' +
          gr.photos.map(function (p, j) {
            var idx = gr.start + j;
            return '<button class="gp ' + (j === 0 ? 'first' : '') + '" data-act="split" data-i="' + idx + '" aria-label="Photo ' + (idx + 1) + (j === 0 && gi ? ', starts item ' + (gi + 1) : '') + '"><img src="' + p.src + '" alt=""><span class="n">' + (idx + 1) + '</span></button>';
          }).join('') + (gi === g.length - 1 ? '<button class="gp addgp" data-act="pick" aria-label="Add more photos">' + ic('plus', 28) + '</button>' : '') + '</div></div>';
      });
      h += '<div style="text-align:center;margin-top:8px"><button class="link" data-act="clearmany">Start again</button></div>';
      h += '<div class="actbar"><button class="btn" data-act="next" ' + (busy ? 'disabled' : '') + '>Next: ' + plural(g.length, 'item', 'items') + '</button></div>';
      return h;
    }
    h += '<button class="link" data-act="backphotos" style="display:flex;align-items:center;gap:4px;text-decoration:none;margin:-8px 0 6px -4px">' + ic('back', 20) + 'Photos</button>';
    h += '<p class="hint">Type each message like on WhatsApp.</p><div class="stack">' + g.map(function (gr, i) { return itemRow(gr, i + 1); }).join('') + '</div>';
    h += '<div class="actbar"><button class="btn" data-act="postmany"' + busyAttr('post') + '>' + (S.busy.post ? 'Posting…' : 'Post ' + plural(g.length, 'item', 'items')) + '</button></div>';
    return h;
  }
  function toggleSplit(i) {
    if (i === 0) return;
    var p = many.photos[i];
    if (many.starts[p.id]) { delete many.starts[p.id]; delete many.msgs[p.id]; delete many.fixes[p.id]; }
    else many.starts[p.id] = true;
    render();
  }
  function postMany() {
    var g = groups(), items = g.map(function (gr) { return parse(many.msgs[gr.key] || '', many.fixes[gr.key]); });
    var miss = items.map(function (it, i) { return it.name ? -1 : i; }).filter(function (i) { return i >= 0; });
    if (miss.length) {
      toast(miss.length === 1 ? 'Item ' + (miss[0] + 1) + ' needs a name' : miss.length + ' items need a name');
      var row = document.getElementById('row-' + g[miss[0]].key); if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (S.busy.post) return;
    S.busy.post = true; render();
    var posted = 0, why = '', chain = Promise.resolve();
    g.forEach(function (gr, i) {
      chain = chain.then(function () {
        if (why) return;
        return Store.saveProduct(product(items[i], gr.photos.map(function (x) { return x.src; }), function () { return 1; })).then(function (p) {
          if (!Store.getProduct(p.id)) why = 'Phone storage is full. Delete old items first.'; else posted++;
        }, function (e) { why = errMsg(e); });
      });
    });
    chain.then(function () {
      S.busy.post = false;
      if (posted < g.length) {
        var gone = g.slice(0, posted); gone.forEach(function (gr) { gr.photos.forEach(function (ph) { many.photos.splice(many.photos.indexOf(ph), 1); }); });
        render(); toast((posted ? posted + ' posted. ' : '') + why); return;
      }
      postedMany(posted);
    });
  }
  function postedMany(posted) {
    many = blankMany(); render(); window.scrollTo(0, 0);
    sheet('<div class="center"><div class="okic">' + ic('check', 34) + '</div><h3>' + plural(posted, 'item', 'items') + ' posted</h3><p>They are in your shop now.</p></div>' +
      '<div class="stack"><button class="btn" data-act="gostock">See stock</button><button class="btn ghost" data-act="close">Add more</button></div>');
  }

  function vAdd() { return top(false) + '<h1>New item</h1>' + seg() + (S.addMode === 'one' ? vAddOne() : vAddMany()); }

  /* ---------- render ---------- */
  /* ---------- passcode (real shop only) ---------- */
  function locked() { return Store.remote && !Store.isAdmin(); }
  function vLogin() {
    return top(false) + '<h1>Enter passcode</h1>' +
      '<form id="loginForm" novalidate><div class="field"><label class="lbl" for="pass">Passcode</label>' +
      '<input class="inp" id="pass" type="password" autocomplete="current-password"' + (S.loginErr ? ' aria-invalid="true" aria-describedby="passErr"' : '') + '></div>' +
      (S.loginErr ? '<div class="err" id="passErr" role="alert">' + esc(S.loginErr) + '</div>' : '') +
      '<div class="stack" style="margin-top:16px"><button class="btn" type="submit"' + busyAttr('login') + '>' + (S.busy.login ? 'Checking…' : 'Open') + '</button></div></form>';
  }
  function login() {
    if (S.busy.login) return;
    if (!S.pass) { S.loginErr = 'Enter the passcode'; render(); return; }
    S.busy.login = true; S.loginErr = ''; render();
    Store.adminLogin(S.pass).then(function () {
      S.busy.login = false; S.pass = ''; S.tab = 'orders'; render();
    }, function (e) {
      var c = e && e.code;
      S.busy.login = false;
      S.loginErr = c === 'wrong_passcode' ? 'Wrong passcode' : c === 'too_many_attempts' ? 'Too many wrong tries. Wait 15 minutes.'
        : c === 'not_configured' ? 'No passcode set on the server yet.' : errMsg(e);
      render(); var i = $('#pass'); if (i) i.focus();
    });
  }

  var VIEWS = { orders: vOrders, add: vAdd, stock: vStock };
  var pending = false;
  function render() {
    var y = window.scrollY, f = document.activeElement, fid = f && f.id, ss = f && f.selectionStart, se = f && f.selectionEnd;
    $('.tabbar').hidden = locked();
    if (locked()) {
      $('#view').innerHTML = vLogin();
      var pi = $('#pass'); pi.value = S.pass;
      if (fid === 'pass') { pi.focus(); try { pi.setSelectionRange(ss, se); } catch (e) {} }
      $('.app').classList.remove('has-act'); pending = false; badge(); return;
    }
    $('#view').innerHTML = VIEWS[S.tab]();
    $('.app').classList.toggle('has-act', !!$('.actbar'));
    $('#toast').classList.toggle('up', !!$('.actbar'));
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === S.tab); b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false'); });
    window.scrollTo(0, y);
    if (fid && f.tagName === 'TEXTAREA') { var n = document.getElementById(fid); if (n) { n.focus(); try { n.setSelectionRange(ss, se); } catch (e) {} } }
    pending = false; badge();
  }
  function badge() { var n = Store.getOrders().filter(FILTERS.new).length, b = $('#badge'); b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }
  function typing() { var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && $('#view').contains(a)); }
  var pressing = false; // never swap the DOM under a finger, or the tap is lost
  function flush() { if (pending && !pressing && !typing() && !sheetOpen()) render(); }

  Store.onChange(function () {
    badge();
    if (locked() || $('#loginForm')) { if (!typing()) render(); else pending = true; return; }
    if (S.tab === 'add') return; // the add screen shows only the local draft
    if (pressing || typing() || sheetOpen()) { pending = true; return; }
    render();
  });
  document.addEventListener('focusout', function () { setTimeout(flush, 400); });
  document.addEventListener('pointerdown', function () { pressing = true; }, true);
  ['pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(function () { pressing = false; flush(); }, 50); }, true); });

  /* ---------- events ---------- */
  document.querySelectorAll('.tab').forEach(function (b) {
    var i = b.querySelector('[data-i]'); i.insertAdjacentHTML('afterbegin', ic(i.dataset.i, 26));
    b.addEventListener('click', function () { S.tab = b.dataset.tab; $('#toast').classList.remove('show'); toastUndo = null; render(); window.scrollTo(0, 0); });
  });
  $('#file').addEventListener('change', function (e) {
    addFiles(e.target.files, S.addMode === 'one' ? one : many);
    setTimeout(function () { e.target.value = ''; }, 0);
  });
  document.addEventListener('submit', function (e) { if (e.target.id === 'loginForm') { e.preventDefault(); login(); } });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'pass') { S.pass = e.target.value; return; }
    var t = e.target, k = t.dataset && t.dataset.k; if (!k) return;
    if (k === 'one') { one.msg = t.value; updateOne(); }
    else { many.msgs[k] = t.value; updateRow(k); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.row-btn')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape' && sheetOpen()) closeSheet();
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.dataset.act;
    switch (a) {
      case 'close': closeSheet(); break;
      case 'undo': if (toastUndo) { var u = toastUndo; toastUndo = null; $('#toast').classList.remove('show'); u(); } break;
      case 'settings': openSettings(); break;
      case 'filter': S.filter = el.dataset.v; S.ticked = {}; render(); break;
      case 'tick': e.stopPropagation(); if (S.ticked[el.dataset.id]) delete S.ticked[el.dataset.id]; else S.ticked[el.dataset.id] = 1; render(); break;
      case 'order': openOrder(el.dataset.id); break;
      case 'bulk': bulk(); break;
      case 'product': openProduct(el.dataset.id); break;
      case 'sold': case 'add1':
        e.stopPropagation();
        var pid = el.dataset.id, sz = el.dataset.s, d = a === 'sold' ? -1 : 1, key = 'stk:' + pid + '|' + sz;
        if (S.busy[key]) break;
        S.busy[key] = true; el.disabled = true;
        Store.adjustStock(pid, sz, d).then(function (ok) {
          delete S.busy[key]; pending = true; flush();
          if (ok) toast((d < 0 ? 'Sold 1 · ' : 'Added 1 · ') + sz, function () { Store.adjustStock(pid, sz, -d).catch(function (e) { toast(errMsg(e)); }); });
        }, function (e) { delete S.busy[key]; pending = true; flush(); toast(errMsg(e)); });
        break;
      case 'mode': S.addMode = el.dataset.v; render(); break;
      case 'pick': $('#file').click(); break;
      case 'rmphoto': one.photos.splice(+el.dataset.i, 1); render(); break;
      case 'qty': var s = el.dataset.s; one.qty[s] = Math.max(1, Math.min(99, (one.qty[s] || 1) + (+el.dataset.d))); updateOne(); break;
      case 'fix': fixSheet(el.dataset.f, el.dataset.k); break;
      case 'post1': postOne(); break;
      case 'split': toggleSplit(+el.dataset.i); break;
      case 'next': many.step = 'items'; render(); window.scrollTo(0, 0); break;
      case 'backphotos': many.step = 'photos'; render(); window.scrollTo(0, 0); break;
      case 'clearmany': confirmSheet({ title: 'Start again?', text: 'The photos you picked are cleared.', ok: 'Start again', danger: true }, function () { many = blankMany(); render(); }); break;
      case 'postmany': postMany(); break;
      case 'gostock': closeSheet(); S.tab = 'stock'; render(); window.scrollTo(0, 0); break;
    }
  });

  render();
})();
