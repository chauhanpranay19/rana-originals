/* Local stand-in for the Apps Script web app, for trying remote mode without Google.
   Same business logic (Logic.gs) over an in-memory fake sheet; data is lost when it stops.
   Run:   node backend/test/stub-server.js            (port 4180)
   Then set apiUrl in assets/config.js to 'http://localhost:4180/exec' (put it back to '' afterwards).
   The admin passcode is RO_STUB_PASSCODE if set, otherwise a random one printed at start. */
'use strict';
const http = require('http');
const crypto = require('crypto');
const { makeServer } = require('./harness');

const PORT = Number(process.env.PORT || 4180);
const passcode = process.env.RO_STUB_PASSCODE || crypto.randomBytes(4).toString('hex');
const server = makeServer({ passcode, now: Date.now(), photoBase: 'http://localhost:' + PORT + '/photo/' });
// the stub follows the real clock
server.ctx.env.now = () => Date.now();

const cors = { 'Access-Control-Allow-Origin': '*' };
function send(res, code, body, type) {
  res.writeHead(code, Object.assign({ 'Content-Type': type || 'application/json' }, cors));
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') { // Apps Script cannot answer this; the front end must never need it
    console.log('WARNING: preflight request received, the real backend would fail here');
    return send(res, 405, '{"ok":false,"error":"no_preflight"}');
  }
  if (url.pathname.startsWith('/photo/')) {
    const b64 = server.ctx.env.photos.get(url.pathname.slice(7));
    if (!b64) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, Buffer.from(b64, 'base64'), 'image/jpeg');
  }
  if (url.pathname !== '/exec') return send(res, 404, '{"ok":false,"error":"not_found"}');
  if (req.method === 'GET') {
    const action = url.searchParams.get('action');
    if (!action) return send(res, 200, JSON.stringify({ ok: true, service: 'rana-originals-stub' }));
    if (!['products', 'settings'].includes(action)) return send(res, 200, '{"ok":false,"error":"use_post"}');
    return send(res, 200, JSON.stringify(server.call({ action })));
  }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 30e6) req.destroy(); });
  req.on('end', () => {
    if (!/^text\/plain/.test(req.headers['content-type'] || '')) console.log('WARNING: Content-Type is not text/plain:', req.headers['content-type']);
    let parsed;
    try { parsed = JSON.parse(body); } catch (e) { return send(res, 200, '{"ok":false,"error":"bad_request"}'); }
    const out = server.call(parsed);
    console.log(new Date().toISOString().slice(11, 19), parsed.action, out.ok ? 'ok' : out.error);
    send(res, 200, JSON.stringify(out));
  });
}).listen(PORT, () => {
  console.log('Rana Originals stub API on http://localhost:' + PORT + '/exec');
  console.log('Admin passcode for this run: ' + passcode);
});
