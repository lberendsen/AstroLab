// Fase 6: texturas em alta resolução (carregadas no app só quando a nave chega perto) e modelos de relevo.
//   textures/8k/*.jpg            Solar System Scope (CC BY 4.0)
//   textures/2k_earth_nightmap.jpg  luzes das cidades (NASA Black Marble, via Solar System Scope)
//   data/dem-<corpo>.bin         altitude em Int16 (metros), equirretangular, longitude 0 no centro, norte em cima
//   data/dem.json                dimensões e escala de cada relevo
import fs from 'node:fs';
import path from 'node:path';

async function get(url, file, { binary = true } = {}) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(300000) });
      if (!r.ok) throw new Error(String(r.status));
      const b = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(file, b);
      return b;
    } catch (e) { if (k >= 2) throw new Error(`${e.message} em ${url}`); await new Promise(r => setTimeout(r, 4000)); }
  }
  void binary;
}

export async function buildTextures8k(TEX) {
  const dir = path.join(TEX, '8k');
  fs.mkdirSync(dir, { recursive: true });
  const ss = 'https://www.solarsystemscope.com/textures/download/';
  for (const f of ['8k_earth_daymap.jpg', '8k_earth_nightmap.jpg', '8k_earth_clouds.jpg', '8k_moon.jpg', '8k_mars.jpg', '8k_mercury.jpg', '8k_jupiter.jpg', '8k_saturn.jpg']) {
    await get(ss + f, path.join(dir, f));
    console.log(`  ${f}: ${(fs.statSync(path.join(dir, f)).size / 1048576).toFixed(1)} MB`);
  }
  await get(ss + '2k_earth_nightmap.jpg', path.join(TEX, '2k_earth_nightmap.jpg'));
}

// ---------------------------------------------------------------- leitores de FITS e TIFF (só o necessário)
function readFits(buf) {
  let off = 0, hdr = {};
  for (;;) {
    const block = buf.toString('latin1', off, off + 2880); off += 2880;
    let end = false;
    for (let i = 0; i < 36; i++) {
      const card = block.slice(i * 80, i * 80 + 80), key = card.slice(0, 8).trim();
      if (key === 'END') { end = true; break; }
      if (card[8] === '=') hdr[key] = card.slice(10).split('/')[0].trim().replace(/'/g, '').trim();
    }
    if (end) break;
  }
  const w = +hdr.NAXIS1, h = +hdr.NAXIS2, bp = +hdr.BITPIX, bz = +(hdr.BZERO || 0), bs = +(hdr.BSCALE || 1), blank = hdr.BLANK != null ? +hdr.BLANK : null;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let v;
    if (bp === 16) v = buf.readInt16BE(off + i * 2); else if (bp === -32) v = buf.readFloatBE(off + i * 4); else if (bp === 32) v = buf.readInt32BE(off + i * 4); else throw new Error('BITPIX ' + bp);
    out[i] = blank != null && v === blank ? NaN : v * bs + bz;
  }
  // FITS: primeira linha é a de baixo (sul); inverte para norte em cima
  const flip = new Float32Array(w * h);
  for (let y = 0; y < h; y++) flip.set(out.subarray((h - 1 - y) * w, (h - y) * w), y * w);
  return { w, h, data: flip, hdr };
}
function readTiffFloat(buf) {
  const le = buf.toString('latin1', 0, 2) === 'II';
  const r16 = o => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o)), r32 = o => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const ifd = r32(4), n = r16(ifd), tags = {};
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12, tag = r16(e), type = r16(e + 2), cnt = r32(e + 4);
    const val = type === 3 && cnt === 1 ? r16(e + 8) : r32(e + 8);
    tags[tag] = { type, cnt, val };
  }
  const w = tags[256].val, h = tags[257].val, comp = tags[259]?.val || 1;
  if (comp !== 1) throw new Error('TIFF comprimido');
  const offs = tags[273].cnt === 1 ? [tags[273].val] : Array.from({ length: tags[273].cnt }, (_, i) => r32(tags[273].val + i * 4));
  const out = new Float32Array(w * h);
  let k = 0;
  for (const o of offs) for (let p = o; k < w * h && p < buf.length; p += 4) { out[k++] = le ? buf.readFloatLE(p) : buf.readFloatBE(p); if (k % w === 0 && offs.length > 1) break; }
  return { w, h, data: out };
}

// Grava altitude em metros como Int16, já na convenção das texturas (longitude 0 no centro, leste à direita, norte em cima)
function writeDem(DATA, key, w, h, meters, note) {
  const out = Buffer.alloc(w * h * 2);
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < w * h; i++) {
    let v = meters[i];
    if (!isFinite(v)) v = 0;
    mn = Math.min(mn, v); mx = Math.max(mx, v);
    out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v))), i * 2);
  }
  fs.writeFileSync(path.join(DATA, `dem-${key}.bin`), out);
  console.log(`  relevo ${key}: ${w}×${h}, de ${Math.round(mn)} a ${Math.round(mx)} m (${note})`);
  return { w, h, min: Math.round(mn), max: Math.round(mx), note };
}

export async function buildDems(DATA, RAW) {
  const meta = {};
  const h2f = hips => 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?' + new URLSearchParams({ hips, width: 2048, height: 1024, projection: 'CAR', fov: 360, ra: 0, dec: 0, format: 'fits' });
  // Marte: MOLA (metros acima do areoide)
  const mars = readFits(await get(h2f('CDS/P/Mars/MGS-MOLA-DEM'), path.join(RAW, 'dem-mars.fits')));
  meta.Mars = writeDem(DATA, 'mars', mars.w, mars.h, mars.data, 'MGS MOLA, NASA');
  // Mercúrio: MESSENGER
  const merc = readFits(await get(h2f('CDS/P/Mercury/DEM-665m'), path.join(RAW, 'dem-mercury.fits')));
  meta.Mercury = writeDem(DATA, 'mercury', merc.w, merc.h, merc.data, 'MESSENGER, NASA');
  // Lua: LOLA (CGI Moon Kit da NASA, km em relação a 1737,4 km), 1440×720, longitude 0 no centro
  const moon = readTiffFloat(await get('https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif', path.join(RAW, 'ldem_4.tif')));
  const mm = new Float32Array(moon.w * moon.h);
  for (let i = 0; i < mm.length; i++) mm[i] = moon.data[i] * 1000;
  meta.Moon = writeDem(DATA, 'moon', moon.w, moon.h, mm, 'LRO LOLA, NASA');
  fs.writeFileSync(path.join(DATA, 'dem.json'), JSON.stringify(meta));
}
