// Fase 5: estrelas do Gaia DR3, pulsares (ATNF) e luas dos planetas (JPL Horizons).
import fs from 'node:fs';
import path from 'node:path';

const D2R = Math.PI / 180;
async function fetchText(url, cacheFile, opt = {}) {
  if (cacheFile && fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 0) return fs.readFileSync(cacheFile, 'utf8');
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(600000), ...opt });
      if (!r.ok) throw new Error(String(r.status));
      const t = await r.text();
      if (cacheFile) fs.writeFileSync(cacheFile, t);
      return t;
    } catch (e) { if (k >= 3) throw e; await new Promise(r => setTimeout(r, 5000 * (k + 1))); }
  }
}
const radec2xyz = (ra, dec, d) => [d * Math.cos(dec * D2R) * Math.cos(ra * D2R), d * Math.cos(dec * D2R) * Math.sin(ra * D2R), d * Math.sin(dec * D2R)];

// ---------------------------------------------------------------- Gaia DR3: estrelas a menos de 200 pc (650 anos-luz)
// Paralaxe > 5 mas com erro < 10%. As mais brilhantes que G = 7,5 já estão no HYG e ficam de fora.
// Formato compacto (8 bytes por estrela): Int16 x, y, z (pc × 32767/200), Uint8 G absoluta ((M+5)×10), Uint8 BP−RP ((c+0.5)×50)
export async function buildGaia(DATA, RAW) {
  const N = 8, out = [];
  for (let k = 0; k < N; k++) {
    const a = Math.floor(k * 1811709771 / N), b = Math.floor((k + 1) * 1811709771 / N);
    const q = `SELECT ra, dec, parallax, phot_g_mean_mag, bp_rp FROM gaiadr3.gaia_source WHERE parallax > 5 AND parallax_over_error > 10 AND phot_g_mean_mag > 7.5 AND random_index >= ${a} AND random_index < ${b}`;
    const url = 'https://gea.esac.esa.int/tap-server/tap/sync?' + new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: q });
    const csv = await fetchText(url, path.join(RAW, `gaia-${k}.csv`));
    const lines = csv.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      if (c.length < 5 || c[3] === '') continue;
      const d = 1000 / +c[2];
      const M = +c[3] - 5 * Math.log10(d / 10);
      const col = c[4] === '' ? 1.0 : +c[4];
      out.push(radec2xyz(+c[0], +c[1], d), M, col);
    }
    process.stdout.write(`\r  Gaia: bloco ${k + 1}/${N}, ${(out.length / 3).toLocaleString('pt-BR')} estrelas   `);
  }
  console.log();
  const n = out.length / 3, buf = Buffer.alloc(n * 8);
  const S = 32767 / 200;
  for (let i = 0; i < n; i++) {
    const [p, M, col] = [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]];
    for (let j = 0; j < 3; j++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(p[j] * S))), i * 8 + j * 2);
    buf.writeUInt8(Math.max(0, Math.min(255, Math.round((M + 5) * 10))), i * 8 + 6);
    buf.writeUInt8(Math.max(0, Math.min(255, Math.round((col + 0.5) * 50))), i * 8 + 7);
  }
  fs.writeFileSync(path.join(DATA, 'gaia.bin'), buf);
  console.log(`  Gaia: ${n.toLocaleString('pt-BR')} estrelas, ${(buf.length / 1048576).toFixed(1)} MB`);
}

// ---------------------------------------------------------------- Pulsares (ATNF, via VizieR)
const FAMOUS_PSR = {
  'J0534+2200': ['Pulsar do Caranguejo', 'O coração da Nebulosa do Caranguejo: a estrela de nêutrons deixada pela supernova de 1054. Gira 30 vezes por segundo.'],
  'J0835-4510': ['Pulsar de Vela', 'Restos de uma supernova de uns 11 mil anos atrás. Às vezes "tropeça" e acelera de repente (glitch).'],
  'J1921+2153': ['PSR B1919+21 (o primeiro pulsar)', 'Descoberto em 1967 por Jocelyn Bell Burnell. O sinal era tão regular que foi apelidado de LGM-1, "little green men".'],
  'J1915+1606': ['Pulsar de Hulse-Taylor', 'Pulsar binário cuja órbita encolhe como prevê a relatividade: a primeira prova indireta das ondas gravitacionais (Nobel de 1993).'],
  'J0737-3039A': ['Pulsar duplo', 'O único sistema conhecido com dois pulsares orbitando um ao outro: um laboratório de relatividade.'],
  'J1748-2446ad': ['O pulsar mais rápido', 'Gira 716 vezes por segundo. A superfície se move a cerca de 24% da velocidade da luz.'],
  'J0437-4715': ['O pulsar de milissegundo mais próximo', 'A 512 anos-luz, gira 174 vezes por segundo, com precisão de relógio atômico.'],
  'J1939+2134': ['O primeiro pulsar de milissegundo', 'Descoberto em 1982; gira 642 vezes por segundo.'],
  'J0108-1431': ['Um dos pulsares mais velhos e próximos', 'Cerca de 170 milhões de anos, a uns 600 anos-luz.'],
  'J1311-3430': ['Pulsar "viúva-negra"', 'Está evaporando a estrela companheira com o vento de partículas.'],
};
export async function buildPulsars(DATA, RAW) {
  const tsv = await fetchText('https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=B/psr/psr&-out.max=unlimited&-out=PSRJ,Name,RA2000,DE2000,P0,Dist,Assoc,Type,Binary,Age', path.join(RAW, 'psr.tsv'));
  const lines = tsv.split('\n').filter(l => l && !l.startsWith('#'));
  const head = lines[0].split('\t').map(s => s.trim());
  const ix = k => head.indexOf(k);
  const out = [];
  for (const l of lines.slice(3)) {
    const c = l.split('\t').map(s => s.trim());
    const ra = +c[ix('RA2000')], dec = +c[ix('DE2000')], dk = +c[ix('Dist')];
    if (!isFinite(ra) || !(dk > 0)) continue;
    const j = c[ix('PSRJ')], f = FAMOUS_PSR[j];
    out.push({ j, b: c[ix('Name')] !== j ? c[ix('Name')] : '', ra, dec, d: dk * 1000, p: +c[ix('P0')] || null, assoc: c[ix('Assoc')], type: c[ix('Type')], bin: c[ix('Binary')], age: +c[ix('Age')] || null, ...(f ? { name: f[0], desc: f[1] } : {}) });
  }
  fs.writeFileSync(path.join(DATA, 'pulsars.json'), JSON.stringify(out));
  console.log(`  pulsares: ${out.length} (famosos: ${out.filter(p => p.name).length}/${Object.keys(FAMOUS_PSR).length})`);
}

// ---------------------------------------------------------------- Luas (JPL Horizons): elementos osculadores na época atual
const PLANETS = { 4: 'Mars', 5: 'Jupiter', 6: 'Saturn', 7: 'Uranus', 8: 'Neptune', 9: 'Pluto' };
const MAXID = { 4: 2, 5: 72, 6: 66, 7: 28, 8: 16, 9: 5 };
// nomes em português e mapas (HiPS do CDS) dos que têm
export const MOON_PT = {
  401: 'Fobos', 402: 'Deimos', 505: 'Amalteia', 506: 'Himalia', 514: 'Tebe', 515: 'Adrasteia', 516: 'Métis',
  601: 'Mimas', 602: 'Encélado', 603: 'Tétis', 604: 'Dione', 605: 'Reia', 606: 'Titã', 607: 'Hiperião', 608: 'Jápeto', 609: 'Febe',
  610: 'Jano', 611: 'Epimeteu', 616: 'Prometeu', 617: 'Pandora', 618: 'Pã',
  701: 'Ariel', 702: 'Umbriel', 703: 'Titânia', 704: 'Oberon', 705: 'Miranda', 715: 'Puck',
  801: 'Tritão', 802: 'Nereida', 808: 'Proteu', 901: 'Caronte', 902: 'Nix', 903: 'Hidra', 904: 'Cérbero', 905: 'Estige',
};
// Mapas da superfície (HiPS do CDS) em projeção cilíndrica, longitude 0 no centro e leste à direita
export const MOON_MAPS = {
  io: 'CDS/P/Io/Galileo-SSI-1km', europa: 'CDS/P/Europa/Voyager-GalileoSSI-500m', ganymede: 'CDS/P/Ganymede/VoyagerGalileo-SSI-1km', callisto: 'CDS/P/Callisto/Voyager-Galileo-simp-1km',
  mimas: 'CDS/P/Mimas/Cassini-PIA17214', enceladus: 'CDS/P/Enceladus/Cassini-110m', tethys: 'CDS/P/Tethys/Cassini-PIA18439', dione: 'CDS/P/Dione/Cassini-PIA12577',
  rhea: 'CDS/P/Rhea/Cassini-PIA12803', titan: 'CDS/P/Titan/ISS-P19658-4km', iapetus: 'CDS/P/Iapetus/Cassini-PIA18436',
  miranda: 'CDS/P/Miranda/Voyager', ariel: 'CDS/P/Ariel/Voyager', umbriel: 'CDS/P/Umbriel/Voyager', titania: 'CDS/P/Titania/Voyager', oberon: 'CDS/P/Oberon/Voyager',
  triton: 'CDS/P/Triton/Voyager2-600m', charon: 'CDS/P/Charon/NewHorizon-PIA19866', pluto: 'CDS/P/Pluto/NewHorizons-Jul2017-300m',
};
export async function buildMoonMaps(TEX) {
  const dir = path.join(TEX, 'moons');
  fs.mkdirSync(dir, { recursive: true });
  for (const [k, hips] of Object.entries(MOON_MAPS)) {
    const f = path.join(dir, `${k}.jpg`);
    if (fs.existsSync(f) && fs.statSync(f).size > 0) continue;
    const url = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?' + new URLSearchParams({ hips, width: 2048, height: 1024, projection: 'CAR', fov: 360, ra: 0, dec: 0, format: 'jpg' });
    const r = await fetch(url, { signal: AbortSignal.timeout(180000) });
    if (r.ok) fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    console.log(`  mapa ${k}: ${r.ok ? 'ok' : r.status}`);
  }
}

const RADIUS_FIX ={ 901: 606 }; // Caronte (New Horizons)
export async function buildMoons(DATA, RAW) {
  const out = [];
  const date = new Date().toISOString().slice(0, 10), next = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  for (const [p, planet] of Object.entries(PLANETS)) {
    for (let n = 1; n <= MAXID[p]; n++) {
      const id = +p * 100 + n;
      if (id >= 501 && id <= 504) continue; // galileanas: Astronomy Engine
      const prm = new URLSearchParams({ format: 'json', COMMAND: `'${id}'`, EPHEM_TYPE: 'ELEMENTS', CENTER: `'500@${p}99'`, START_TIME: `'${date}'`, STOP_TIME: `'${next}'`, STEP_SIZE: "'1 d'", REF_PLANE: 'FRAME', REF_SYSTEM: 'ICRF', CSV_FORMAT: 'YES', OBJ_DATA: 'YES' });
      let res;
      try { res = JSON.parse(await fetchText('https://ssd.jpl.nasa.gov/api/horizons.api?' + prm, path.join(RAW, `moon-${id}.json`))).result || ''; } catch { continue; }
      const soe = res.indexOf('$$SOE');
      if (soe < 0) continue;
      const row = res.slice(soe + 5).trim().split('\n')[0].split(',').map(s => s.trim());
      // JDTDB, data, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
      const [jd, , e, , i, om, w, , nDeg, ma, , a] = row;
      const name = res.match(/Target body name:\s*(.+?)\s*\(\d+\)/)?.[1]?.trim() || String(id);
      const rad = res.match(/(?:Mean radius|Radius|RAD)\s*\(km\)\s*=\s*([\d.]+)/i)?.[1] || res.match(/Radius \(km\)\s*=\s*([\d.]+)/)?.[1];
      out.push({ id, planet, name: MOON_PT[id] || name, en: name, r: rad ? +rad : RADIUS_FIX[id] || null, jd: +jd, e: +e, i: +i * D2R, om: +om * D2R, w: +w * D2R, n: +nDeg * D2R * 86400, ma: +ma * D2R, a: +a });
      process.stdout.write(`\r  luas: ${out.length} (${planet} ${id})        `);
    }
  }
  console.log();
  fs.writeFileSync(path.join(DATA, 'moons.json'), JSON.stringify(out));
  console.log(`  luas: ${out.length}, ${out.filter(m => m.r).length} com raio`);
}
