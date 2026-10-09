// Servidor estático mínimo para o AstroLab: node serve.mjs [porta]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.argv[2] || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Repassa imagens e dados de fontes que não liberam o navegador (CORS). Só para domínios conhecidos,
// com cache de alguns minutos para não sobrecarregar as agências.
const PROXY_HOSTS = new Set(['soho.nascom.nasa.gov', 'sdo.gsfc.nasa.gov', 'himawari8.nict.go.jp', 'img.nsmc.org.cn', 'mast.stsci.edu', 'epic.gsfc.nasa.gov',
  'cdn.star.nesdis.noaa.gov', 'services.swpc.noaa.gov', 'mars.nasa.gov', 'gibs.earthdata.nasa.gov', 'view.eumetsat.int', 'eyes.nasa.gov']);
const proxyCache = new Map();
async function proxy(req, res) {
  let target;
  try { target = new URL(new URL(req.url, 'http://x').searchParams.get('u')); } catch { res.writeHead(400).end(); return; }
  if (!PROXY_HOSTS.has(target.hostname)) { res.writeHead(403).end('domínio não permitido'); return; }
  const key = target.href, hit = proxyCache.get(key);
  const headers = h => ({ 'Content-Type': h.ct, 'Cache-Control': 'max-age=300', ...(h.lm ? { 'Last-Modified': h.lm } : {}) });
  if (hit && Date.now() - hit.t < 5 * 60e3) { res.writeHead(200, headers(hit)); res.end(req.method === 'HEAD' ? undefined : hit.buf); return; }
  try {
    const r = await fetch(target, { headers: { 'User-Agent': 'AstroLab (uso pessoal)' }, signal: AbortSignal.timeout(45000) });
    const buf = Buffer.from(await r.arrayBuffer());
    let ct = r.headers.get('content-type') || 'application/octet-stream';
    if (/octet-stream/.test(ct) && /\.jpe?g$/i.test(target.pathname + target.search)) ct = 'image/jpeg';
    const entry = { t: Date.now(), buf, ct, lm: r.headers.get('last-modified') };
    if (r.ok && buf.length < 40e6) {
      proxyCache.set(key, entry);
      if (proxyCache.size > 200) proxyCache.delete(proxyCache.keys().next().value);
    }
    res.writeHead(r.status, headers(entry));
    res.end(req.method === 'HEAD' ? undefined : buf);
  } catch (e) { res.writeHead(502).end(String(e.message)); }
}

http.createServer((req, res) => {
  if (req.url.startsWith('/proxy?')) { proxy(req, res); return; }
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}tools${path.sep}raw`)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`AstroLab em http://localhost:${PORT}`);
  refresh();
});

// Atualiza em segundo plano os dados que envelhecem: satélites (1 dia) e trajetórias de naves (7 dias).
// O navegador sempre lê os arquivos prontos; quem fala com a CelesTrak e o Horizons é só este servidor.
async function refresh() {
  const DATA = path.join(ROOT, 'data'), RAW = path.join(ROOT, 'tools', 'raw');
  const age = f => (fs.existsSync(f) ? Date.now() - fs.statSync(f).mtimeMs : Infinity);
  try {
    if (age(path.join(DATA, 'satellites.json')) > 864e5) {
      console.log('atualizando satélites (CelesTrak)…');
      const { buildSatellites } = await import('./tools/satellites.mjs');
      await buildSatellites(DATA, RAW);
    }
    if (age(path.join(DATA, 'spacecraft.json')) > 7 * 864e5) {
      console.log('atualizando trajetórias de naves (JPL Horizons)…');
      const { buildSpacecraft } = await import('./tools/spacecraft-build.mjs');
      await buildSpacecraft(DATA);
    }
  } catch (e) { console.warn('atualização falhou, mantendo os dados atuais:', e.message); }
}
