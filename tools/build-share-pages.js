#!/usr/bin/env node
/* Builds one tiny page per item at p/<id>/index.html.
   WhatsApp shows a picture preview only for a web page that names its picture (Open Graph tags),
   and our shop is a single page, so each item needs its own small page that then forwards to the shop.
   Run from the project folder:  node tools/build-share-pages.js
   Run it again whenever items are added or their photos change. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const cfg = fs.readFileSync(path.join(root, 'assets/config.js'), 'utf8');
const apiUrl = (cfg.match(/apiUrl:\s*'([^']+)'/) || [])[1];
const siteUrl = (cfg.match(/siteUrl:\s*'([^']+)'/) || [])[1];
if (!apiUrl || !siteUrl) { console.error('assets/config.js needs apiUrl and siteUrl'); process.exit(1); }
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = n => '₹' + Number(n).toLocaleString('en-IN');
const abs = src => /^https?:\/\//.test(src) ? src : siteUrl + String(src).replace(/^(\.\.\/)+/, '').replace(/^\//, '');

(async () => {
  const res = await fetch(apiUrl + '?action=products', { redirect: 'follow' });
  const data = await res.json();
  if (!data.ok) { console.error('Backend said:', data.error); process.exit(1); }
  const outDir = path.join(root, 'p');
  fs.rmSync(outDir, { recursive: true, force: true });
  let n = 0;
  for (const p of data.products) {
    if (!/^[A-Za-z0-9_-]+$/.test(p.id)) continue;
    const sizes = (p.sizes || []).filter(s => s.qty > 0).map(s => s.label).join(', ');
    const title = [p.brand, p.title].filter(Boolean).join(' ');
    const desc = [sizes ? 'Size ' + sizes : 'Sold out', p.price == null ? 'Ask price' : money(p.price), p.note].filter(Boolean).join(' · ');
    const photo = (p.photos || []).find(x => x && x.indexOf('data:') !== 0);
    const url = siteUrl + 'p/' + p.id + '/';
    const html = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Rana Originals</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rana Originals">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${photo ? `<meta property="og:image" content="${esc(abs(photo))}">\n<meta name="twitter:card" content="summary_large_image">` : ''}
<script>location.replace('../../#/p/${p.id}');</script>
</head>
<body><a href="../../#/p/${p.id}">${esc(title)}</a></body>
</html>
`;
    fs.mkdirSync(path.join(outDir, p.id), { recursive: true });
    fs.writeFileSync(path.join(outDir, p.id, 'index.html'), html);
    n++;
  }
  console.log('Built ' + n + ' share pages in p/');
})().catch(e => { console.error(e); process.exit(1); });
