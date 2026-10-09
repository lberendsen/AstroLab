// Busca por nome: índice local (planetas, estrelas, exoplanetas, céu profundo, galáxias) e,
// para o resto do universo catalogado, o resolvedor Sesame + SIMBAD (CDS), com a distância medida.
import { DB } from './data.js';
import { BODIES } from './layers/solar.js';
import { bodyTarget, starTarget, exoTarget, curatedTarget, galTarget, simbadTarget, craftTarget, satTarget } from './targets.js';
import { CRAFT } from './layers/craft.js';
import { SAT } from './layers/sats.js';
import { SB } from './layers/smallbodies.js';
import { SHOWERS } from '../tools/smallbodies.mjs';
import { sbTarget, astTarget, cometTarget, showerTarget } from './targets.js';
import { normName, radec2xyz, comovingDistance, R_SUN } from './astro.js';

// Nomes populares em português para estrelas (o HYG usa os nomes oficiais da IAU)
const ALIASES = {
  'Alfa Centauri': 'Rigil Kentaurus', 'Alpha Centauri': 'Rigil Kentaurus', 'Próxima Centauri': 'Proxima Centauri', 'Estrela Polar': 'Polaris',
  'Sírius': 'Sirius', 'Canopo': 'Canopus', 'Aldebarã': 'Aldebaran', 'Arcturo': 'Arcturus', 'Capela': 'Capella', 'Prócion': 'Procyon',
  'Espiga': 'Spica', 'Pólux': 'Pollux', 'Régulo': 'Regulus', 'Estrela de Barnard': "Barnard's Star", 'Antares': 'Antares',
  'Alnitak (Três Marias)': 'Alnitak', 'Mintaka (Três Marias)': 'Mintaka', 'Alnilam (Três Marias)': 'Alnilam', 'Achernar': 'Achernar',
  'Estrela de Luyten': "Luyten's Star", 'Estrela de Teegarden': "Teegarden's Star",
};

let index = [];
export function buildIndex() {
  const add = (label, sub, make, rank, extraKeys = []) => {
    for (const k of [label, ...extraKeys]) if (k) index.push({ key: normName(k), label, sub, make, rank });
  };
  for (const b of BODIES) add(b.name, b.kind === 'sun' ? 'Estrela' : b.kind === 'moon' ? 'Lua' : b.dwarf ? 'Planeta anão' : 'Planeta', () => bodyTarget(b.key), 100, [b.key]);
  for (const o of DB.curated) add(o.name, `${o.id} · céu profundo`, () => curatedTarget(o), 90, [o.id, o.mainId]);
  const S = DB.stars;
  const byName = new Map();
  for (const [i, inf] of S.info) {
    if (i === S.sunIndex) continue;
    const proper = inf.names[0];
    const host = S.hostByStar.get(i);
    const sub = host ? `Estrela · ${host.planets.length} exoplaneta(s)` : `Estrela${inf.spect ? ' ' + inf.spect : ''}`;
    for (const n of inf.names) byName.set(n, i);
    add(proper, sub, () => starTarget(i), host ? 70 : /^(HIP|HD) /.test(proper) ? 20 : 60, inf.names.slice(1));
  }
  for (const [alias, real] of Object.entries(ALIASES)) {
    const i = byName.get(real);
    if (i != null) add(alias, `Estrela · ${real}`, () => starTarget(i), 85);
  }
  for (const h of DB.hosts) for (const pl of h.planets) add(pl.n, `Exoplaneta · ${pl.how || ''} ${pl.y || ''}`.trim(), () => exoTarget(h, pl.n), 65);
  for (const [i, name] of DB.gals.names) add(name, 'Galáxia (2MRS)', () => galTarget(i), name.startsWith('2MASX') ? 5 : 40);
  const BODY_PT = { Moon: 'Lua', Mars: 'Marte', Venus: 'Vênus' };
  for (const c of CRAFT) {
    const sub = c.kind === 'surface' ? `Na superfície · ${BODY_PT[c.body]} · ${c.country}` : c.kind === 'sat' ? 'Satélite da Terra' : `Nave · ${c.country} · ${c.launch}`;
    add(c.name, sub, () => craftTarget(c), 95, [c.id, c.sat?.name]);
  }
  // asteroides e cometas: os famosos (com ficha completa), todos os cometas e os asteroides com nome ou designação
  for (const f of SB.famous) add(f.name, `${f.isComet ? 'Cometa' : 'Asteroide'} · ${f.full.trim()}`, () => sbTarget(f), 92, [f.full, f.sstr]);
  for (const c of SB.comets) add(c.full.replace(/\s*\(.*\)$/, ''), 'Cometa', () => cometTarget(c), c.name ? 55 : 25, [c.name, c.pdes]);
  for (const sh of SHOWERS) add(sh.name, `Chuva de meteoros · pico em ${sh.peak[1]}/${sh.peak[0]}`, () => showerTarget(sh), 90);
  for (const [k, pdes, name] of SB.meta?.names || []) add(name || pdes, `Asteroide${name ? ' · ' + pdes : ''}`, () => astTarget(k), name ? 35 : 8, name ? [pdes] : []);
  for (const s of SAT.list) if (!s.craft) add(s.name, `Satélite · ${SAT.meta.countries[s.country]} · NORAD ${s.norad}`, () => satTarget(s), s.cat === 0 ? 50 : 15, [String(s.norad)]);
}

export function searchLocal(q, max = 12) {
  const k = normName(q);
  if (!k) return [];
  const res = [];
  for (const e of index) {
    let s;
    if (e.key === k) s = 1000;
    else if (e.key.startsWith(k)) s = 500 - (e.key.length - k.length);
    else if (k.length >= 3 && e.key.includes(k)) s = 200 - (e.key.length - k.length);
    else continue;
    res.push({ ...e, score: s + e.rank });
  }
  res.sort((a, b) => b.score - a.score);
  const seen = new Set(), out = [];
  for (const r of res) { if (seen.has(r.label)) continue; seen.add(r.label); out.push(r); if (out.length >= max) break; }
  return out;
}

// ---------------------------------------------------------------- SIMBAD
const OTYPE_PT = {
  '*': 'Estrela', '**': 'Estrela dupla', 'G': 'Galáxia', 'GiG': 'Galáxia em grupo', 'GiC': 'Galáxia em aglomerado', 'GiP': 'Galáxia em par',
  'AGN': 'Galáxia com núcleo ativo', 'Sy1': 'Galáxia Seyfert 1', 'Sy2': 'Galáxia Seyfert 2', 'SyG': 'Galáxia Seyfert', 'QSO': 'Quasar', 'BLL': 'Blazar',
  'SBG': 'Galáxia starburst', 'EmG': 'Galáxia de emissão', 'LIN': 'Galáxia LINER', 'rG': 'Radiogaláxia', 'IG': 'Galáxias em interação',
  'ClG': 'Aglomerado de galáxias', 'GrG': 'Grupo de galáxias', 'SCG': 'Superaglomerado', 'PN': 'Nebulosa planetária', 'HII': 'Região HII',
  'SNR': 'Remanescente de supernova', 'GlC': 'Aglomerado globular', 'OpC': 'Aglomerado aberto', 'Cl*': 'Aglomerado estelar',
  'MoC': 'Nuvem molecular', 'RNe': 'Nebulosa de reflexão', 'DNe': 'Nebulosa escura', 'BH': 'Buraco negro', 'Psr': 'Pulsar', 'WD*': 'Anã branca',
  'BD*': 'Anã marrom', 'Pl': 'Exoplaneta', 'X': 'Fonte de raios X', 'Rad': 'Fonte de rádio', 'GNe': 'Nebulosa', 'ISM': 'Meio interestelar',
  'SN*': 'Supernova', 'XB*': 'Binária de raios X', 'LSB': 'Galáxia de baixo brilho', 'bCG': 'Galáxia anã azul compacta',
};

const tap = async q => {
  const r = await fetch('https://simbad.cds.unistra.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=' + encodeURIComponent(q));
  return (await r.json()).data || [];
};

export async function searchSimbad(q) {
  const x = await (await fetch('https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?' + encodeURIComponent(q))).text();
  const g = tag => x.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
  const ra = +g('jradeg'), dec = +g('jdedeg');
  if (!isFinite(ra) || g('jradeg') == null) return null;
  const oid = g('oid');
  const s = { oid: oid || q, name: q, mainId: g('oname') || q, ra, dec, otype: g('otype') || '' };
  const zm = x.match(/<z><v>([^<]+)<\/v>/);
  s.z = zm ? +zm[1] : null;
  if (oid) {
    try {
      const [b] = await tap(`SELECT main_id, plx_value, plx_err, rvz_redshift, galdim_majaxis, otype FROM basic WHERE oid=${+oid}`);
      if (b) { s.mainId = b[0]?.trim(); s.plx = b[1]; s.plxErr = b[2]; if (b[3] != null) s.z = b[3]; s.maj = b[4]; s.otype = b[5] || s.otype; }
      const ds = await tap(`SELECT dist, unit, method FROM mesDistance WHERE oidref=${+oid}`);
      const pcs = ds.map(([d, u, m]) => {
        u = (u || '').trim();
        const f = u === 'pc' ? 1 : u === 'kpc' ? 1e3 : u === 'Mpc' ? 1e6 : null;
        return f && d > 0 ? { pc: d * f, method: (m || '').trim() } : null;
      }).filter(Boolean);
      const good = pcs.filter(p => p.method !== 'redshift');
      const use = (good.length ? good : pcs).map(p => p.pc).sort((a, b) => a - b);
      if (use.length) { s.d = use[Math.floor(use.length / 2)]; s.dSource = `mediana de ${use.length} medida(s) publicadas (SIMBAD)`; }
    } catch { /* fica com o que veio do Sesame */ }
  }
  if (!s.d && s.plx > 0.1 && (!s.plxErr || s.plxErr / s.plx < 0.25)) { s.d = 1000 / s.plx; s.dSource = 'paralaxe (Gaia/Hipparcos)'; }
  if (!s.d && s.z > 0.002) { s.d = comovingDistance(s.z); s.dSource = `redshift z = ${s.z} (distância comóvel, ΛCDM)`; }
  s.isStar = /\*|^Pl$|BD|WD|Psr/.test(s.otype) && !/Cl\*|C\?\*/.test(s.otype);
  s.otypeLabel = OTYPE_PT[s.otype] || s.otype;
  s.xyz = radec2xyz(ra, dec, s.d || 1e10);
  return simbadTarget(s);
}
