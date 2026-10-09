// Tudo que pode ser selecionado e visitado vira um "alvo": posição atual, raio, distância boa para observar,
// e uma ficha de informações.
import { DB, starPos, galPos, starRadiusSun } from './data.js';
import { BODY } from './layers/solar.js';
import { satPos } from './layers/sats.js';
import { F } from './engine.js';
import { QSO, qsoPos, sdssName } from './layers/deep.js';
import * as systems from './layers/systems.js';
import { AU, R_SUN, R_EARTH, KM, LY, DEG, v3, xyz2radec, fmtNum } from './astro.js';

const TYPE_PT = {
  neb: 'Nebulosa', pn: 'Nebulosa planetária', snr: 'Remanescente de supernova', open: 'Aglomerado aberto', glob: 'Aglomerado globular',
  gal: 'Galáxia', cluster: 'Aglomerado de galáxias', qso: 'Quasar', bh: 'Buraco negro supermassivo',
};
const DEFAULT_SIZE_PC = { neb: 30, pn: 0.6, snr: 8, open: 6, glob: 40, gal: 20000, cluster: 1.5e6, qso: 30000, bh: 0.001 };

export function bodyTarget(key) {
  const b = BODY[key];
  return {
    id: 'b:' + key, name: b.name, kind: b.kind === 'sun' ? 'star' : b.kind, body: b,
    pos: () => b.pos, radius: b.radius,
    viewDist: b.radius * (b.kind === 'sun' ? 6 : b.ring ? 7 : 4),
    kindLabel: b.kind === 'sun' ? 'Estrela' : b.kind === 'moon' ? 'Lua' : b.dwarf ? 'Planeta anão' : 'Planeta',
  };
}

export function starTarget(i) {
  if (i === DB.stars.sunIndex) return bodyTarget('Sun');
  const inf = DB.stars.info.get(i);
  const host = DB.stars.hostByStar.get(i);
  const r = starRadiusSun(i) * R_SUN;
  const p = starPos(i);
  let view = r * 14;
  if (host) {
    const amax = Math.max(0, ...host.planets.map(pl => pl.a || 0));
    view = Math.max(view, amax * AU * 2.6);
  }
  return {
    id: 's:' + i, star: i, name: inf?.names[0] || `Estrela HYG ${i}`, aka: inf?.names.slice(1) || [], kind: 'star',
    pos: () => p, radius: r, viewDist: view, host, kindLabel: host ? `Estrela com ${host.planets.length} exoplaneta${host.planets.length > 1 ? 's' : ''}` : 'Estrela',
  };
}

export function exoTarget(host, plName) {
  const pl = host.planets.find(p => p.n === plName);
  const starT = starTarget(host.star);
  const rE = pl.r || (pl.m ? Math.min(Math.pow(pl.m, 0.55), 13) : 1.5);
  const sys = () => systems.planets.find(P => P.name === plName);
  return {
    id: 'p:' + plName, name: plName, kind: 'exo', host, pl, kindLabel: 'Exoplaneta',
    // se o sistema ainda não está carregado (nave longe), mira a estrela
    pos: () => sys()?.pos || starT.pos(),
    radius: rE * R_EARTH,
    viewDist: rE * R_EARTH * 5,
    approach: starT, // para voos longos: chega primeiro ao sistema
  };
}

export function curatedTarget(o) {
  const size = o.maj ? o.d * Math.tan(o.maj / 60 * DEG) : DEFAULT_SIZE_PC[o.type] || 10;
  return {
    id: 'c:' + o.id, name: o.name, aka: [o.mainId, o.id].filter((x, k, a) => x && a.indexOf(x) === k && x !== o.name), kind: 'deep', curated: o,
    pos: () => o.xyz, radius: size / 2, viewDist: Math.max(size * 1.15, 1e-4), kindLabel: TYPE_PT[o.type] || o.otype,
  };
}

export function galTarget(i) {
  const p = galPos(i), r = DB.gals.radius[i];
  const name = DB.gals.names.get(i) || `2MRS ${i}`;
  return {
    id: 'g:' + i, gal: i, name, kind: 'gal', pos: () => p, radius: r, viewDist: r * 2.6,
    kindLabel: DB.gals.morph[i] ? 'Galáxia espiral/irregular' : 'Galáxia elíptica/lenticular',
  };
}

// Resultado de busca no SIMBAD
export function simbadTarget(s) {
  const size = s.maj && s.d ? s.d * Math.tan(s.maj / 60 * DEG) : guessSize(s.otype);
  return {
    id: 'x:' + s.oid, name: s.name, aka: s.mainId !== s.name ? [s.mainId] : [], kind: s.d ? 'deep' : 'sky', simbad: s,
    pos: () => s.xyz, radius: size / 2, viewDist: Math.max(size * 1.2, s.isStar ? R_SUN * 20 : 1e-3), kindLabel: s.otypeLabel || s.otype,
  };
}
function guessSize(ot = '') {
  if (/^(G|AGN|Sy|SBG|BLL|QSO|rG|H2G|LIN|EmG|GiG|GiP|GiC|BiC|IG|PaG|LSB|bCG|SyG)/.test(ot)) return 20000;
  if (/ClG|GrG|CGG|SCG/.test(ot)) return 1.5e6;
  if (/GlC/.test(ot)) return 40;
  if (/OpC|Cl\*/.test(ot)) return 6;
  if (/PN/.test(ot)) return 0.5;
  if (/HII|ISM|Cld|MoC|RNe|DNe|SNR|SFR/.test(ot)) return 20;
  return R_SUN * 4 / 1; // estrela ou desconhecido
}

// Quasar do SDSS DR16Q
export function qsoTarget(i) {
  const p = qsoPos(i), { ra, dec } = xyz2radec(p);
  return {
    id: 'q:' + i, qso: i, name: sdssName(ra, dec), kind: 'qso', z: QSO.z[i], ra, dec,
    pos: () => p, radius: 15000, viewDist: 2e5, kindLabel: 'Quasar (SDSS DR16Q)',
  };
}

// Naves, robôs e satélites
const CRAFT_KIND = { probe: 'Nave espacial', surface: 'Na superfície', sat: 'Satélite' };
const BODY_PT = { Moon: 'Lua', Mars: 'Marte', Venus: 'Vênus', Earth: 'Terra', Jupiter: 'Júpiter', Sun: 'Sol' };
export function craftTarget(c) {
  const size = (c.size || 5) * 1e-3 * KM;
  const t = {
    id: 'm:' + c.id, name: c.name, kind: 'craft', craft: c,
    pos: () => c.pos(F.date.getTime()) || (c.center === 'Sun' ? [0, 0, 0] : BODY[c.center].pos),
    radius: size / 2, viewDist: Math.max(size * 3.5, 0.012 * KM),
    kindLabel: c.kind === 'surface' ? `Na superfície · ${BODY_PT[c.body]}` : c.kind === 'sat' ? 'Satélite da Terra' : c.center !== 'Sun' && c.approxOrbit ? `Em órbita · ${BODY_PT[c.center]}` : c.eph && c.center !== 'Sun' ? `Em órbita · ${BODY_PT[c.center] || c.center}` : CRAFT_KIND[c.kind],
  };
  if (c.kind === 'sat') t.kindLabel = 'Satélite da Terra';
  if (c.ground) {
    t.ground = c.ground;
    // chega em voo rasante: 20° acima do horizonte
    t.arriveDir = () => { const n = c.ground.up(), side = v3.norm(v3.cross(n, [0, 0, 1])); return v3.norm(v3.add(v3.scale(n, 0.36), v3.scale(side, 0.93))); };
  }
  return t;
}

export function satTarget(s) {
  if (s.craft) return craftTarget(s.craft);
  return {
    id: 'o:' + s.norad, name: s.name, kind: 'sat', sat: s, kindLabel: 'Satélite da Terra',
    pos: () => satPos(s), radius: 2e-3 * KM, viewDist: 0.02 * KM,
  };
}

// Relação de um alvo com o Sistema Solar: distância ao Sol (pc)
export const distFromSun = t => v3.len(t.pos());
