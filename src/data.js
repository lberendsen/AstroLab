// Carrega os catálogos gerados por tools/build-data.mjs e monta as estruturas usadas pelas camadas e pela busca.
import { bvToTemp, tempToRGB, v3, xyz2radec } from './astro.js';

export const DB = {};

const bin = async (url, T) => new T(await (await fetch(url)).arrayBuffer());
const json = async url => (await fetch(url)).json();

export async function loadAll(step) {
  step('estrelas');
  const [spos, sphot, snames, svel] = await Promise.all([bin('data/stars-pos.bin', Float64Array), bin('data/stars-phot.bin', Float32Array), json('data/stars-names.json'), bin('data/stars-vel.bin', Float32Array)]);
  step('exoplanetas');
  const hosts = await json('data/exoplanets.json');
  step('galáxias');
  const [gpos, gattr, gnames] = await Promise.all([bin('data/gal-pos.bin', Float64Array), bin('data/gal-attr.bin', Float32Array), json('data/gal-names.json')]);
  step('objetos de céu profundo');
  const curated = await json('data/curated.json');

  // ---- estrelas
  const nH = spos.length / 3;
  const info = new Map();
  for (const [i, ids, spect, lum, mag] of snames) info.set(i, { names: ids.split('|'), spect, lum, mag });

  // grade em ascensão reta/declinação (0,5°) para casar estrelas hospedeiras de exoplanetas com o HYG
  const grid = new Map();
  const key = (ra, dec) => `${Math.floor(ra * 2)},${Math.floor((dec + 90) * 2)}`;
  for (let i = 0; i < nH; i++) {
    const { ra, dec } = xyz2radec([spos[i * 3], spos[i * 3 + 1], spos[i * 3 + 2]]);
    const k = key(ra, dec);
    let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i);
  }
  const extra = [];
  for (const h of hosts) {
    let best = -1, bestSep = 1e9;
    const cr = Math.floor(h.ra * 2), cd = Math.floor((h.dec + 90) * 2);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      for (const i of grid.get(`${(cr + a + 720) % 720},${cd + b}`) || []) {
        const p = [spos[i * 3], spos[i * 3 + 1], spos[i * 3 + 2]];
        const d = v3.len(p);
        const dd = Math.abs(d - h.d) / h.d;
        if (dd > 0.3) continue;
        const sep = Math.acos(Math.min(1, v3.dot(p, h.xyz) / (d * v3.len(h.xyz)))) * 206265;
        // estrelas próximas têm movimento próprio grande (Próxima: 3,8″/ano) e os catálogos têm épocas diferentes
        const ok = sep < 30 || (sep < 150 && dd < 0.05);
        if (ok && sep < bestSep) { best = i; bestSep = sep; }
      }
    }
    if (best >= 0) {
      h.star = best;
      const inf = info.get(best) || { names: [], spect: h.spec || '', lum: null, mag: null };
      // o nome do sistema planetário vem primeiro, a menos que a estrela já tenha nome próprio ou de Bayer
      if (!inf.names.includes(h.name)) {
        if (!inf.names.length || /^(HIP|HD|Gl|GJ) /.test(inf.names[0])) inf.names.unshift(h.name);
        else inf.names.push(h.name);
      }
      info.set(best, inf);
    } else {
      h.star = nH + extra.length;
      extra.push(h);
    }
  }

  // o Sol entra como última estrela, para brilhar quando visto de longe
  const sunIndex = nH + extra.length;
  extra.push({ xyz: [0, 0, 0], teff: 5772, rad: 1, v: -26.74, d: 4.848e-6, name: 'Sol', spec: 'G2V', sun: true });
  const n = nH + extra.length;
  const pos = new Float64Array(n * 3);
  pos.set(spos);
  const absmag = new Float32Array(n), color = new Float32Array(n * 3), teff = new Float32Array(n);
  for (let i = 0; i < nH; i++) {
    absmag[i] = sphot[i * 2];
    teff[i] = bvToTemp(sphot[i * 2 + 1]);
  }
  extra.forEach((h, k) => {
    const i = nH + k;
    pos.set(h.xyz, i * 3);
    teff[i] = h.teff;
    const lum = h.rad * h.rad * Math.pow(h.teff / 5772, 4);
    absmag[i] = h.sun ? 4.83 : h.v > -5 ? h.v - 5 * Math.log10(h.d / 10) : 4.83 - 2.5 * Math.log10(lum);
    info.set(i, { names: h.sun ? ['Sol', 'Sun'] : [h.name], spect: h.spec || '', lum, mag: h.v > -5 || h.sun ? h.v : null });
  });
  for (let i = 0; i < n; i++) color.set(tempToRGB(teff[i]), i * 3);
  // raio de exoplaneta hospedeiro conhecido tem precedência sobre a estimativa
  const radius = new Map();
  for (const h of hosts) if (h.rad > 0) radius.set(h.star, h.rad);
  const hostByStar = new Map(hosts.map(h => [h.star, h]));

  // velocidade (pc/ano): as do HYG; as estrelas acrescentadas (hospedeiras de exoplanetas e o Sol) ficam paradas
  const vel = new Float32Array(n * 3);
  vel.set(svel.subarray(0, nH * 3));
  DB.stars = { n, nHyg: nH, pos, vel, absmag, color, teff, info, radius, hostByStar, sunIndex };
  DB.hosts = hosts;

  // ---- galáxias
  const nG = gpos.length / 3;
  const gAbs = new Float32Array(nG), gRad = new Float32Array(nG), gMorph = new Float32Array(nG);
  for (let i = 0; i < nG; i++) {
    const d = Math.hypot(gpos[i * 3], gpos[i * 3 + 1], gpos[i * 3 + 2]);
    gRad[i] = gattr[i * 3];
    gAbs[i] = gattr[i * 3 + 1] - 5 * Math.log10(d / 10);
    gMorph[i] = gattr[i * 3 + 2];
  }
  DB.gals = { n: nG, pos: gpos, absK: gAbs, radius: gRad, morph: gMorph, names: new Map(gnames) };
  DB.curated = curated;
}

// Posição de uma estrela pelo índice, na data simulada (posição do ano 2000 + velocidade × tempo)
export const STARTIME = { years: 0 };
export const starPos = i => {
  const S = DB.stars, y = STARTIME.years;
  return [S.pos[i * 3] + S.vel[i * 3] * y, S.pos[i * 3 + 1] + S.vel[i * 3 + 1] * y, S.pos[i * 3 + 2] + S.vel[i * 3 + 2] * y];
};
export const galPos = i => [DB.gals.pos[i * 3], DB.gals.pos[i * 3 + 1], DB.gals.pos[i * 3 + 2]];

// Raio estimado (pc) de uma estrela, pela luminosidade e temperatura (Stefan-Boltzmann)
export function starRadiusSun(i) {
  const s = DB.stars;
  if (s.radius.has(i)) return s.radius.get(i);
  const inf = s.info.get(i);
  const L = inf?.lum > 0 ? inf.lum : Math.pow(10, (4.83 - s.absmag[i]) / 2.5);
  return Math.sqrt(L) * Math.pow(5772 / s.teff[i], 2);
}
