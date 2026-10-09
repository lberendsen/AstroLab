// Satélites e detritos em órbita da Terra (CelesTrak, elementos orbitais GP) com o país dono (SATCAT).
// Gera data/satellites.json. Chamado por build-data.mjs e, uma vez por dia, pelo serve.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { NOTABLE_SATS } from './spacecraft.mjs';

const GP = g => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`;
const THEMATIC = ['last-30-days', 'visual', 'weather', 'goes', 'resource', 'sarsat', 'dmc', 'tdrss', 'argos', 'planet', 'spire', 'geo', 'intelsat', 'ses', 'eutelsat',
  'iridium-NEXT', 'starlink', 'oneweb', 'orbcomm', 'globalstar', 'amateur', 'x-comm', 'other-comm', 'satnogs', 'gnss', 'gps-ops',
  'glo-ops', 'galileo', 'beidou', 'sbas', 'nnss', 'musson', 'science', 'geodetic', 'engineering', 'education', 'military', 'radar', 'cubesat', 'kuiper', 'qianfan'];
const DEBRIS = ['cosmos-1408-debris', 'fengyun-1c-debris', 'iridium-33-debris', 'cosmos-2251-debris'];

// categorias (índices usados no shader): 0 estações, 1 constelações, 2 navegação, 3 geoestacionários, 4 outros ativos, 5 detritos
export const CATS = ['Estações e naves tripuladas', 'Megaconstelações (Starlink, OneWeb, Qianfan…)', 'Navegação (GPS, Galileo, BeiDou, GLONASS)', 'Geoestacionários', 'Outros satélites ativos', 'Detritos de colisões e testes antissatélite'];
// países: 0 EUA, 1 China, 2 Rússia/URSS, 3 Europa, 4 Japão, 5 Índia, 6 Brasil, 7 outros
export const COUNTRIES = ['EUA', 'China', 'Rússia', 'Europa', 'Japão', 'Índia', 'Brasil', 'Outros'];
const OWNER = { US: 0, PRC: 1, CIS: 2, ESA: 3, EUME: 3, EUTE: 3, FR: 3, GER: 3, IT: 3, UK: 3, SPN: 3, NETH: 3, LUXE: 3, SES: 3, SWED: 3, FIN: 3, NOR: 3, BEL: 3, AUS: 7, DEN: 3, POL: 3, GREC: 3, JPN: 4, IND: 5, BRAZ: 6, CHBZ: 6 };

const CONST_RE = /^(STARLINK|ONEWEB|KUIPER|QIANFAN|GUOWANG|HULIANWANG|IRIDIUM|GLOBALSTAR|ORBCOMM|FLOCK|LEMUR|SPACEBEE|E-SPACE|TIANQI|O3B|AST SPACEMOBILE|BLUEBIRD)/;
const NAV_RE = /^(GPS|NAVSTAR|GLONASS|COSMOS 2[45]\d\d|GSAT0|GALILEO|BEIDOU|IRNSS|NVS|QZS)/;

// A CelesTrak recusa (403) quem baixa o mesmo grupo de novo em menos de 2 horas: guarda cada resposta em cache
// e, se for recusado, usa a última cópia.
let RAW = '.';
async function getJSON(url) {
  const file = path.join(RAW, 'gp-' + url.match(/GROUP=([^&]+)/)[1] + '.json');
  const cached = fs.existsSync(file) ? fs.statSync(file) : null;
  if (cached && Date.now() - cached.mtimeMs < 3 * 3600e3) return JSON.parse(fs.readFileSync(file, 'utf8'));
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    const t = await r.text();
    if (!t.startsWith('[')) throw new Error(`resposta inesperada de ${url}: ${t.slice(0, 80)}`);
    fs.writeFileSync(file, t);
    return JSON.parse(t);
  } catch (e) {
    if (cached) { console.warn(`  ${e.message}; usando cópia de ${new Date(cached.mtimeMs).toLocaleString('pt-BR')}`); return JSON.parse(fs.readFileSync(file, 'utf8')); }
    throw e;
  }
}

export async function buildSatellites(dataDir, rawDir) {
  RAW = rawDir;
  fs.mkdirSync(rawDir, { recursive: true });
  // dono de cada objeto (SATCAT completo, ~6 MB), guardado em cache por 30 dias
  const satcatFile = path.join(rawDir, 'satcat.csv');
  if (!fs.existsSync(satcatFile) || Date.now() - fs.statSync(satcatFile).mtimeMs > 30 * 864e5) {
    const r = await fetch('https://celestrak.org/pub/satcat.csv');
    if (r.ok) fs.writeFileSync(satcatFile, Buffer.from(await r.arrayBuffer()));
  }
  const owner = new Map(), launch = new Map();
  let onOrbit = 0;
  if (fs.existsSync(satcatFile)) {
    const lines = fs.readFileSync(satcatFile, 'utf8').split('\n');
    const head = lines[0].split(',');
    const iN = head.indexOf('NORAD_CAT_ID'), iO = head.indexOf('OWNER'), iL = head.indexOf('LAUNCH_DATE'), iD = head.indexOf('DECAY_DATE'), iC = head.indexOf('ORBIT_CENTER');
    for (const l of lines.slice(1)) {
      const c = l.split(',');
      if (c.length < head.length) continue;
      owner.set(+c[iN], c[iO]); launch.set(+c[iN], c[iL]);
      if (!c[iD] && c[iC] === 'EA') onOrbit++;
    }
  }
  const stations = await getJSON(GP('stations'));
  const stationIds = new Set(stations.map(s => s.NORAD_CAT_ID));
  let active;
  try { active = await getJSON(GP('active')); }
  catch (e) {
    // sem o grupo "active" (bloqueado ou fora do ar): une os grupos temáticos, cada um baixado uma única vez
    console.warn(`  ${e.message}; montando a partir dos grupos temáticos`);
    active = [];
    for (const g of THEMATIC) { try { active.push(...await getJSON(GP(g))); } catch (err) { console.warn('   ', g, err.message); } }
  }
  const debris = [];
  for (const g of DEBRIS) { try { debris.push(...await getJSON(GP(g))); } catch (e) { console.warn('  detritos:', e.message); } }

  const seen = new Set(), out = [];
  const add = (s, isDebris) => {
    if (seen.has(s.NORAD_CAT_ID)) return;
    seen.add(s.NORAD_CAT_ID);
    const name = s.OBJECT_NAME.trim();
    let cat;
    if (isDebris) cat = 5;
    else if (stationIds.has(s.NORAD_CAT_ID)) cat = 0;
    else if (CONST_RE.test(name)) cat = 1;
    else if (NAV_RE.test(name)) cat = 2;
    else if (s.MEAN_MOTION > 0.95 && s.MEAN_MOTION < 1.05 && s.ECCENTRICITY < 0.05) cat = 3;
    else cat = 4;
    const ow = owner.get(s.NORAD_CAT_ID);
    const country = OWNER[ow] ?? 7;
    out.push([s.NORAD_CAT_ID, name, Date.parse(s.EPOCH + 'Z'), s.MEAN_MOTION, s.ECCENTRICITY, s.INCLINATION, s.RA_OF_ASC_NODE, s.ARG_OF_PERICENTER, s.MEAN_ANOMALY,
      s.MEAN_MOTION_DOT || 0, cat, country, ow || '', (launch.get(s.NORAD_CAT_ID) || '').slice(0, 4), NOTABLE_SATS[name] ? 1 : 0]);
  };
  for (const s of stations) add(s, false);
  for (const s of active) add(s, false);
  for (const s of debris) add(s, true);
  const doc = { updated: new Date().toISOString(), source: 'CelesTrak (GP + SATCAT)', onOrbitTracked: onOrbit, cats: CATS, countries: COUNTRIES,
    fields: ['norad', 'name', 'epochMs', 'meanMotionRevDay', 'ecc', 'incDeg', 'raanDeg', 'argpDeg', 'meanAnomDeg', 'ndot', 'cat', 'country', 'owner', 'launchYear', 'notable'], sats: out };
  fs.writeFileSync(path.join(dataDir, 'satellites.json'), JSON.stringify(doc));
  const byCat = CATS.map((c, i) => `${c}: ${out.filter(s => s[10] === i).length}`).join('; ');
  console.log(`satélites: ${out.length} (${byCat}); rastreados em órbita no SATCAT: ${onOrbit}`);
}
