/* One-time setup. Run setup() from the Apps Script editor (select it in the toolbar, press Run).
   Safe to run again: it only adds what is missing. */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. sheets and header rows
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var last = sh.getLastColumn();
    var head = last ? sh.getRange(1, 1, 1, last).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
    var missing = SCHEMA[name].cols.map(function (c) { return c[0]; }).filter(function (c) { return head.indexOf(c) < 0; });
    if (missing.length) sh.getRange(1, last + 1, 1, missing.length).setValues([missing]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');
  });

  // 2. the six starting products and default settings (only if empty)
  var ctx = makeCtx_();
  seedIfEmpty_(ctx);

  // 3. Drive folder for product photos
  var rows = ctx.db.all('Settings'), folderId = '';
  rows.forEach(function (r) { if (r.key === 'photoFolderId') folderId = r.value; });
  var ok = false;
  if (folderId) { try { ok = !Drive.Files.get(folderId, { fields: 'id,trashed' }).trashed; } catch (e) { ok = false; } }
  if (!ok) {
    var folder = Drive.Files.create({ name: 'Rana Originals photos', mimeType: 'application/vnd.google-apps.folder' }, null, { fields: 'id' });
    ctx.db.put('Settings', { key: 'photoFolderId', value: folder.id });
  }

  // 4. backstop timer: expire unpaid orders every 5 minutes even when nobody opens the shop
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sweepExpired'; });
  if (!has) ScriptApp.newTrigger('sweepExpired').timeBased().everyMinutes(5).create();

  SpreadsheetApp.flush();
  var pass = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSCODE');
  console.log('Setup done.' + (pass ? '' : ' Now add the ADMIN_PASSCODE script property (see README).'));
}

/* Run once if you change driveImageUrl_() in Code.gs: rewrites every stored Drive photo link to the new form. */
function rewritePhotoUrls() {
  var ctx = makeCtx_();
  ctx.env.withLock(function () {
    ctx.db.refresh();
    ctx.db.all('Products').forEach(function (p) {
      var changed = false;
      var photos = (p.photos || []).map(function (u) {
        var m = /googleusercontent\.com\/d\/([\w-]+)/.exec(u) || /drive\.google\.com\/.*[?&]id=([\w-]+)/.exec(u);
        if (!m) return u;
        var n = driveImageUrl_(m[1]); if (n !== u) changed = true; return n;
      });
      if (changed) { p.photos = photos; ctx.db.put('Products', p); }
    });
  });
}
