/* Rana Originals backend: web app entry points and the Google services Logic.gs needs.
   Browsers call:
     GET  <web app URL>?action=products        (also ?action=settings)
     POST <web app URL>  body: JSON string, header Content-Type: text/plain;charset=utf-8
   Every answer is JSON: {ok:true, ...} or {ok:false, error:'code'}. */

var GET_ACTIONS = ['products', 'settings'];

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (!action) return json_({ ok: true, service: 'rana-originals' });
  if (GET_ACTIONS.indexOf(action) < 0) return json_({ ok: false, error: 'use_post' }); // keep tokens out of URLs
  return json_(handleRequest({ action: action }, makeCtx_()));
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e && e.postData && e.postData.contents || ''); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  return json_(handleRequest(req, makeCtx_()));
}

/* Time trigger (installed by setup): expire unpaid orders and release their stock. */
function sweepExpired() { sweepExpiredOrders(makeCtx_()); }

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function makeCtx_() {
  var db = makeSheetDb_();
  var props = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  var env = {
    now: function () { return Date.now(); },
    // two random v4 UUIDs = 244 random bits, as 64 hex characters
    token: function () { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase(); },
    hash: function (text) {
      var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
      return bytes.map(function (b) { return ((b + 256) % 256).toString(16).replace(/^(.)$/, '0$1'); }).join('');
    },
    withLock: function (fn) {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(25000)) fail_('busy');
      try { var out = fn(); SpreadsheetApp.flush(); return out; } finally { lock.releaseLock(); }
    },
    cache: { get: function (k) { return cache.get(k); }, put: function (k, v, sec) { cache.put(k, v, sec); } },
    props: {
      get: function (k) { return props.getProperty(k); },
      set: function (k, v) { props.setProperty(k, v); },
      del: function (k) { props.deleteProperty(k); },
      keys: function () { return props.getKeys(); }
    },
    savePhoto: function (base64, name) { return savePhotoToDrive_(base64, name, db); },
    log: function (err) { console.error(err && err.stack || err); }
  };
  return { db: db, env: env };
}

/* ---------- photos in Drive ---------- */
/* Public image link for a Drive file. Chosen form: https://lh3.googleusercontent.com/d/FILE_ID
   (works in <img> tags for files shared "anyone with the link"). CHECK after the first real deploy:
   if photos do not show, change this one line to 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200'
   and run rewritePhotoUrls() once. */
function driveImageUrl_(id) { return 'https://lh3.googleusercontent.com/d/' + id; }

function photoFolderId_(db) {
  var rows = db.all('Settings');
  for (var i = 0; i < rows.length; i++) if (rows[i].key === 'photoFolderId' && rows[i].value) return rows[i].value;
  throw new Error('No photo folder yet. Run setup() once.');
}

/* Uses the Drive advanced service (v3) so the script only needs the narrow drive.file permission:
   it can see and share only the files it created itself. */
function savePhotoToDrive_(base64, name, db) {
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/jpeg', name);
  var file = Drive.Files.create({ name: name, parents: [photoFolderId_(db)], mimeType: 'image/jpeg' }, blob, { fields: 'id' });
  Drive.Permissions.create({ role: 'reader', type: 'anyone' }, file.id);
  return driveImageUrl_(file.id);
}
