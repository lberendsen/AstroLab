// Baixa e compacta os catálogos reais usados pelo AstroLab.
// Uso: node tools/build-data.mjs        (pula o que já existe; --force refaz tudo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURATED } from './curated.mjs';
import { buildSatellites } from './satellites.mjs';
import { buildSpacecraft } from './spacecraft-build.mjs';
import { comovingDistance } from '../src/astro.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const RAW = path.join(ROOT, 'tools', 'raw');
const TEX = path.join(ROOT, 'textures');
for (const d of [DATA, RAW, TEX]) fs.mkdirSync(d, { recursive: true });
const FORCE = process.argv.includes('--force');

const H0 = 70; // km/s/Mpc
const DEG = Math.PI / 180;

async function download(url, file, { text = true } = {}) {
  if (!FORCE && fs.existsSync(file) && fs.statSync(file).size > 0) return text ? fs.readFileSync(file, 'utf8') : null;
  console.log('baixando', url.slice(0, 110));
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} em ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(file, buf);
  return text ? buf.toString('utf8') : null;
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const radec2xyz = (ra, dec, d) => [d * Math.cos(dec * DEG) * Math.cos(ra * DEG), d * Math.cos(dec * DEG) * Math.sin(ra * DEG), d * Math.sin(dec * DEG)];
const num = v => (v === '' || v == null ? NaN : +v);

// ---------------------------------------------------------------- Estrelas (HYG v4.1)
async function stars() {
  const csv = await download('https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv', path.join(RAW, 'hyg.csv'));
  const rows = parseCSV(csv).filter(r => r.id !== '0' && +r.dist > 0 && +r.dist < 100000);
  const n = rows.length;
  const pos = new Float64Array(n * 3);
  const phot = new Float32Array(n * 2); // absmag, B-V
  const names = [];
  rows.forEach((r, i) => {
    pos[i * 3] = +r.x; pos[i * 3 + 1] = +r.y; pos[i * 3 + 2] = +r.z;
    phot[i * 2] = +r.absmag;
    phot[i * 2 + 1] = isNaN(num(r.ci)) ? 0.65 : +r.ci;
    const bayer = r.bayer ? `${r.bayer} ${r.con}` : '';
    const flam = r.flam ? `${r.flam} ${r.con}` : '';
    const ids = [r.proper, bayer, flam, r.hip && `HIP ${r.hip}`, r.hd && `HD ${r.hd}`, r.gl].filter(Boolean);
    if (r.proper || bayer || flam || +r.mag < 6.5) names.push([i, ids.join('|'), r.spect || '', +(+r.lum).toPrecision(4), +(+r.mag).toFixed(2)]);
  });
  fs.writeFileSync(path.join(DATA, 'stars-pos.bin'), Buffer.from(pos.buffer));
  fs.writeFileSync(path.join(DATA, 'stars-phot.bin'), Buffer.from(phot.buffer));
  fs.writeFileSync(path.join(DATA, 'stars-names.json'), JSON.stringify(names));
  console.log(`estrelas: ${n}, com nome/visíveis: ${names.length}`);
}

// ---------------------------------------------------------------- Galáxias (2MRS, Huchra+ 2012)
async function galaxies() {
  const tsv = await download('https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/ApJS/199/26/table3&-out.max=unlimited&-out=RAJ2000,DEJ2000,Ktmag,Rext,b/a,type,cz,CAT,SimbadName', path.join(RAW, '2mrs.tsv'));
  const lines = tsv.split('\n').filter(l => l && !l.startsWith('#'));
  const head = lines[0].split('\t').map(s => s.trim());
  const rows = lines.slice(3).map(l => Object.fromEntries(l.split('\t').map((v, i) => [head[i], v.trim()])));
  const out = [];
  for (const r of rows) {
    const cz = num(r.cz);
    if (!(cz > 400)) continue; // abaixo disso o movimento próprio domina; o Grupo Local vem da lista curada
    const dpc = cz / H0 * 1e6;
    const radArcsec = Math.pow(10, num(r.Rext) || 1.5);
    const radius = Math.max(dpc * radArcsec / 206265, 1500);
    // tipo morfológico T de de Vaucouleurs no início do código: <= 0 elíptica/lenticular, > 0 espiral/irregular
    const t = parseInt(r.type, 10);
    const morph = isNaN(t) ? 1 : t <= 0 ? 0 : 1;
    const cat = (r.CAT || '').replace(/_+/g, ' ').replace(/^MESSIER 0*/, 'M ').replace(/^(NGC|IC|UGC|ESO) 0*/, '$1 ').trim();
    out.push([r.RAJ2000, r.DEJ2000, dpc, radius, num(r.Ktmag), morph, cat || (r.SimbadName || '').trim()]);
  }
  const n = out.length;
  const pos = new Float64Array(n * 3), attr = new Float32Array(n * 3);
  const names = [];
  out.forEach(([ra, dec, d, rad, k, m, name], i) => {
    pos.set(radec2xyz(+ra, +dec, d), i * 3);
    attr[i * 3] = rad; attr[i * 3 + 1] = k; attr[i * 3 + 2] = m;
    if (name) names.push([i, name]);
  });
  fs.writeFileSync(path.join(DATA, 'gal-pos.bin'), Buffer.from(pos.buffer));
  fs.writeFileSync(path.join(DATA, 'gal-attr.bin'), Buffer.from(attr.buffer));
  fs.writeFileSync(path.join(DATA, 'gal-names.json'), JSON.stringify(names));
  console.log(`galáxias 2MRS: ${n}`);
}

// ---------------------------------------------------------------- Exoplanetas (NASA Exoplanet Archive)
async function exoplanets() {
  const q = 'select pl_name,hostname,ra,dec,sy_dist,pl_orbsmax,pl_orbper,pl_orbeccen,pl_rade,pl_bmasse,pl_eqt,disc_year,discoverymethod,st_teff,st_rad,st_spectype,sy_vmag from pscomppars';
  const csv = await download('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=csv&query=' + encodeURIComponent(q), path.join(RAW, 'exo.csv'));
  const rows = parseCSV(csv);
  const hosts = new Map();
  for (const r of rows) {
    if (!(num(r.sy_dist) > 0)) continue;
    let h = hosts.get(r.hostname);
    if (!h) {
      h = { name: r.hostname, ra: +r.ra, dec: +r.dec, d: +r.sy_dist, teff: num(r.st_teff) || 5000, rad: num(r.st_rad) || 1, spec: r.st_spectype, v: num(r.sy_vmag), planets: [] };
      hosts.set(r.hostname, h);
    }
    let a = num(r.pl_orbsmax);
    const per = num(r.pl_orbper);
    if (!(a > 0) && per > 0) a = Math.cbrt(Math.pow(per / 365.25, 2)); // Kepler com 1 massa solar
    h.planets.push({ n: r.pl_name, a: a > 0 ? +a.toPrecision(4) : null, p: per > 0 ? +per.toPrecision(5) : null, e: num(r.pl_orbeccen) || 0,
      r: num(r.pl_rade) || null, m: num(r.pl_bmasse) || null, t: num(r.pl_eqt) || null, y: +r.disc_year, how: r.discoverymethod });
  }
  const list = [...hosts.values()].map(h => ({ ...h, xyz: radec2xyz(h.ra, h.dec, h.d).map(v => +v.toFixed(6)) }));
  fs.writeFileSync(path.join(DATA, 'exoplanets.json'), JSON.stringify(list));
  console.log(`exoplanetas: ${rows.length} em ${list.length} sistemas`);
}

// ---------------------------------------------------------------- Objetos curados (coordenadas do SIMBAD)
async function curated() {
  const out = [];
  for (const [id, name, type, distSpec] of CURATED) {
    const zInfo = typeof distSpec === 'object' ? distSpec : null;
    const dist = zInfo ? comovingDistance(zInfo.z) : distSpec;
    const adql = `SELECT TOP 1 b.main_id, b.ra, b.dec, b.galdim_majaxis, b.galdim_minaxis, b.galdim_angle, b.otype FROM basic b JOIN ident i ON b.oid=i.oidref WHERE i.id='${id.replace(/'/g, "''")}'`;
    let row = null;
    try {
      const j = await (await fetch('https://simbad.cds.unistra.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=' + encodeURIComponent(adql))).json();
      row = j.data?.[0];
    } catch (e) { /* abaixo */ }
    if (!row) {
      // SIMBAD normaliza identificadores; o Sesame aceita grafias livres
      const x = await (await fetch('https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/S?' + encodeURIComponent(id))).text();
      const ra = x.match(/<jradeg>([^<]+)/)?.[1], de = x.match(/<jdedeg>([^<]+)/)?.[1];
      if (ra) row = [x.match(/<oname>([^<]+)/)?.[1] || id, +ra, +de, null, null, null, ''];
    }
    if (!row && zInfo?.ra != null) row = [id, zInfo.ra, zInfo.dec, null, null, null, type === 'qso' ? 'QSO' : 'G'];
    if (!row) { console.warn('  não resolvido:', id); continue; }
    const [mainId, ra, dec, maj, min, ang, otype] = row;
    out.push({ id, mainId: mainId?.trim(), name, type, ra, dec, d: dist, z: zInfo?.z, maj: maj || null, min: min || null, pa: ang ?? null, otype, xyz: radec2xyz(ra, dec, dist) });
  }
  fs.writeFileSync(path.join(DATA, 'curated.json'), JSON.stringify(out, null, 1));
  console.log(`objetos curados: ${out.length}/${CURATED.length}`);
}

// ---------------------------------------------------------------- Texturas
async function textures() {
  // Solar System Scope (CC BY 4.0), baseadas em dados da NASA
  const base = 'https://www.solarsystemscope.com/textures/download/';
  const files = ['2k_sun.jpg', '2k_mercury.jpg', '2k_venus_atmosphere.jpg', '2k_earth_daymap.jpg', '2k_earth_clouds.jpg', '2k_moon.jpg', '2k_mars.jpg',
    '2k_jupiter.jpg', '2k_saturn.jpg', '2k_saturn_ring_alpha.png', '2k_uranus.jpg', '2k_neptune.jpg'];
  for (const f of files) await download(base + f, path.join(TEX, f), { text: false });
  // Céu inteiro real (mosaico óptico de Mellinger) em projeção cilíndrica, coordenadas equatoriais
  const sky = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=CDS/P/Mellinger/color&width=4096&height=2048&projection=CAR&fov=360&ra=0&dec=0&coordsys=icrs&format=jpg';
  await download(sky, path.join(TEX, 'sky-mellinger.jpg'), { text: false });
}

// ---------------------------------------------------------------- Quasares (SDSS DR16Q, Lyke et al. 2020)
// Binário Float32 por quasar: x, y, z (Mpc comóveis), redshift, magnitude absoluta i
async function quasars() {
  const url = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=VII/289/dr16q&-out.max=unlimited&-out=RAJ2000,DEJ2000,z,imag,iMAG';
  const tsv = await download(url, path.join(RAW, 'dr16q.tsv'));
  const lines = tsv.split('\n').filter(l => l && !l.startsWith('#'));
  const head = lines[0].split('\t').map(s => s.trim());
  const ix = k => head.indexOf(k);
  const iRa = ix('RAJ2000'), iDe = ix('DEJ2000'), iZ = ix('z'), iM = ix('iMAG'), im = ix('imag');
  // tabela de distância comóvel por redshift (interpolação linear em passos de 0,001)
  const ZMAX = 8, STEP = 0.001, table = new Float64Array(ZMAX / STEP + 2);
  for (let k = 0; k < table.length; k++) table[k] = comovingDistance(k * STEP);
  const dc = z => { const x = z / STEP, k = Math.floor(x); return table[k] + (table[k + 1] - table[k]) * (x - k); };
  const out = [];
  for (const l of lines.slice(3)) {
    const c = l.split('\t');
    const z = +c[iZ];
    if (!(z > 0.05 && z < ZMAX)) continue;
    const d = dc(z) / 1e6;
    let M = +c[iM];
    if (!isFinite(M) || M === 0 || c[iM].trim() === '') {
      const m = +c[im];
      M = isFinite(m) && m > 0 ? m - 5 * Math.log10(d * (1 + z) * 1e5) : -24; // módulo de distância com a distância de luminosidade
    }
    const [x, y, w] = radec2xyz(+c[iRa], +c[iDe], d);
    out.push(x, y, w, z, M);
  }
  fs.writeFileSync(path.join(DATA, 'quasars.bin'), Buffer.from(new Float32Array(out).buffer));
  console.log(`quasares: ${out.length / 5}`);
}

// Radiação cósmica de fundo (Planck R3): a borda do universo observável
async function cmb() {
  const url = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=CDS/P/PLANCK/R3/CMB&width=2048&height=1024&projection=CAR&fov=360&ra=0&dec=0&coordsys=icrs&format=jpg&stretch=linear&cmap=RdYlBu_r';
  await download(url, path.join(TEX, 'cmb-planck.jpg'), { text: false });
  console.log('mapa da radiação cósmica de fundo: ok');
}

// ---------------------------------------------------------------- Objetos feitos pelo homem
async function satellites() { await buildSatellites(DATA, RAW); }
async function spacecraft() { await buildSpacecraft(DATA); }

const steps = { stars, galaxies, exoplanets, curated, textures, quasars, cmb, satellites, spacecraft };
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
for (const [k, f] of Object.entries(steps)) if (!only.length || only.includes(k)) await f();
console.log('pronto.');
