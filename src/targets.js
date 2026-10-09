// Tudo que pode ser selecionado e visitado vira um "alvo": posição atual, raio, distância boa para observar,
// e uma ficha de informações.
import { DB, starPos, galPos, starRadiusSun } from './data.js';
import { BODY } from './layers/solar.js';
import { satPos } from './layers/sats.js';
import { F } from './engine.js';
import { QSO, qsoPos, sdssName } from './layers/deep.js';
import { SB, bodyPos, astElements, diameterKm } from './layers/smallbodies.js';
import { craftCenterAt } from './layers/craft.js';
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

// ---------------------------------------------------------------- asteroides, cometas e chuvas de meteoros
export const SB_CLASS_PT = {
  MBA: 'Asteroide do cinturão principal', IMB: 'Asteroide do cinturão principal (interno)', OMB: 'Asteroide do cinturão principal (externo)',
  APO: 'Asteroide próximo da Terra (tipo Apolo)', ATE: 'Asteroide próximo da Terra (tipo Aten)', AMO: 'Asteroide próximo da Terra (tipo Amor)', IEO: 'Asteroide dentro da órbita da Terra (tipo Atira)',
  MCA: 'Asteroide que cruza a órbita de Marte', TJN: 'Troiano de Júpiter', CEN: 'Centauro', TNO: 'Objeto além de Netuno', AST: 'Asteroide',
  JFc: 'Cometa da família de Júpiter', HTC: 'Cometa tipo Halley', ETc: 'Cometa tipo Encke', CTc: 'Cometa tipo Quíron', JFC: 'Cometa da família de Júpiter',
  COM: 'Cometa', PAR: 'Cometa de órbita parabólica', HYP: 'Objeto em órbita aberta (hiperbólica)', HYA: 'Asteroide em órbita aberta', PAA: 'Asteroide em órbita parabólica',
};
export function sbTarget(o) {
  const dKm = o.isComet ? (o.diameter || 5) : diameterKm(o);
  const r = dKm / 2 * KM;
  const label = o.e > 1 && /^\dI/.test(o.name || o.full || '') ? 'Visitante interestelar' : SB_CLASS_PT[o.cls] || (o.isComet ? 'Cometa' : 'Asteroide');
  return {
    id: 'sb:' + (o.full || o.name), name: o.display || o.name || o.full, aka: o.full && o.full.trim() !== o.name ? [o.full.trim()] : [], kind: 'sb', sb: o,
    pos: () => bodyPos(o), radius: r, viewDist: Math.max(r * 5, 2 * KM), kindLabel: o.pha ? `${label} · potencialmente perigoso` : label,
  };
}
export function astTarget(idx) {
  const o = astElements(idx);
  const nm = astName(idx);
  o.name = nm?.[2] || nm?.[1] || `asteroide nº ${idx + 1} do catálogo`;
  o.full = nm ? (nm[2] ? `${nm[1]} ${nm[2]}` : nm[1]) : o.name;
  o.pdes = nm?.[1];
  o.fromCloud = true;
  return sbTarget(o);
}
let nameByIdx = null;
export function astName(idx) {
  if (!nameByIdx) { nameByIdx = new Map(); for (const e of SB.meta?.names || []) nameByIdx.set(e[0], e); }
  return nameByIdx.get(idx);
}
export function cometTarget(c) {
  c.isComet = true;
  c.display = c.full.replace(/\s*\(.*\)$/, '');
  return sbTarget(c);
}
// Chuva de meteoros: o "lugar" é a Terra no dia do pico, atravessando a poeira do corpo de origem
export function nextPeak(s, from = new Date()) {
  let d = new Date(Date.UTC(from.getUTCFullYear(), s.peak[0] - 1, s.peak[1], 0));
  if (d < from - 864e5) d = new Date(Date.UTC(from.getUTCFullYear() + 1, s.peak[0] - 1, s.peak[1], 0));
  return d;
}
export function showerTarget(s) {
  return {
    id: 'shower:' + s.name, name: s.name, kind: 'shower', shower: s, kindLabel: 'Chuva de meteoros',
    pos: () => BODY.Earth.pos, radius: BODY.Earth.radius, viewDist: 0.25 * AU,
  };
}

// Naves, robôs e satélites
const CRAFT_KIND = { probe: 'Nave espacial', surface: 'Na superfície', sat: 'Satélite' };
const BODY_PT = { Moon: 'Lua', Mars: 'Marte', Venus: 'Vênus', Earth: 'Terra', Jupiter: 'Júpiter', Sun: 'Sol', Saturn: 'Saturno', Uranus: 'Urano', Neptune: 'Netuno', Pluto: 'Plutão' };
export function craftTarget(c) {
  const size = (c.size || 5) * 1e-3 * KM;
  const t = {
    id: 'm:' + c.id, name: c.name, kind: 'craft', craft: c,
    pos: () => c.pos(F.date.getTime()) || (c.center === 'Sun' ? [0, 0, 0] : BODY[c.center].pos),
    radius: size / 2, viewDist: Math.max(size * 3.5, 0.012 * KM),
    // calculado na hora: o corpo central muda ao longo da viagem
    get kindLabel() {
      if (c.kind === 'natural') return 'Cometa (trajetória real do JPL)';
      if (c.kind === 'surface') return `Na superfície · ${BODY_PT[c.body]}`;
      if (c.kind === 'sat') return 'Satélite da Terra';
      if (c.approxOrbit) return `Em órbita · ${BODY_PT[c.center]}`;
      if (c.end) return 'Missão histórica';
      const cc = craftCenterAt(c);
      // trecho fino em volta de um planeta durante uma viagem = passagem, não órbita
      const passing = cc !== 'Sun' && cc !== c.center;
      return cc === 'Sun' ? CRAFT_KIND[c.kind] : passing ? `Passando por ${BODY_PT[cc] || cc}` : `Em órbita · ${BODY_PT[cc] || cc}`;
    },
  };
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
