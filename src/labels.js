// Rótulos HTML projetados sobre o 3D e seleção por clique.
import * as THREE from 'three';
import { F, camera } from './engine.js';
import { DB, starPos } from './data.js';
import { BODIES } from './layers/solar.js';
import * as systems from './layers/systems.js';
import { bodyTarget, starTarget, curatedTarget, galTarget, exoTarget, craftTarget, satTarget } from './targets.js';
import { CRAFT, isVisible } from './layers/craft.js';
import * as sats from './layers/sats.js';
import * as deep from './layers/deep.js';
import { qsoTarget, sbTarget, cometTarget, astTarget } from './targets.js';
import * as smallbodies from './layers/smallbodies.js';
import { SB, showSB, bodyPos } from './layers/smallbodies.js';
import { labelCandidates as linkLabels } from './link.js';
import { AU, DEG, v3 } from './astro.js';

const root = document.getElementById('labels');
const pool = [];
let selectedId = null;
export let onPick = () => {};
export function setOnPick(f) { onPick = f; }
export function setSelected(t) { selectedId = t?.id || null; selectedT = t; }
let selectedT = null;

const _v = new THREE.Vector3();
export function project(p) {
  _v.set(p[0] - F.cam[0], p[1] - F.cam[1], p[2] - F.cam[2]);
  const d = _v.length();
  if (d === 0) return null;
  _v.divideScalar(d).applyMatrix4(camera.matrixWorldInverse);
  if (_v.z >= -1e-6) return null;
  _v.applyMatrix4(camera.projectionMatrix);
  if (Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) return null;
  return { x: (_v.x + 1) / 2 * F.width, y: (1 - _v.y) / 2 * F.height, d };
}

// O ponto está escondido atrás de um planeta, lua ou do Sol? (raio da câmera até o ponto cruza a esfera antes)
function occluded(pos, d) {
  if (F.layers.solar === false || v3.len(F.cam) > 0.5) return false;
  const dir = v3.scale(v3.sub(pos, F.cam), 1 / d);
  for (const b of BODIES) {
    if (v3.dist(pos, b.pos) < b.radius * 1.05) continue; // o ponto é o próprio corpo (ou está na superfície dele)
    const oc = v3.sub(b.pos, F.cam);
    const tca = v3.dot(oc, dir);
    if (tca <= 0) continue;
    const d2 = v3.dot(oc, oc) - tca * tca, R2 = b.radius * b.radius;
    if (d2 >= R2) continue;
    const t0 = tca - Math.sqrt(R2 - d2);
    if (t0 > 0 && t0 < d - b.radius * 0.002) return true;
  }
  return false;
}

// ---- candidatos lentos (recalculados a cada ~12 quadros)
let slow = [];
let frame = 0;
function buildSlow() {
  const out = [];
  const S = DB.stars, [cx, cy, cz] = F.cam;
  // estrelas com nome próprio ou designação de Bayer, pelo brilho aparente daqui
  const stars = [];
  for (const [i, inf] of S.info) {
    if (i === S.sunIndex) continue;
    const n0 = inf.names[0];
    if (!n0 || /^(HIP|HD|Gl|GJ|Wo|NN) /.test(n0)) continue;
    const x = S.pos[i * 3] - cx, y = S.pos[i * 3 + 1] - cy, z = S.pos[i * 3 + 2] - cz;
    const d = Math.sqrt(x * x + y * y + z * z);
    const m = S.absmag[i] + 5 * Math.log10(Math.max(d, 1e-9) / 10);
    if (m < 3.2) stars.push([m, i]);
  }
  stars.sort((a, b) => a[0] - b[0]);
  for (const [m, i] of stars.slice(0, 45)) out.push({ id: 's:' + i, pos: starPos(i), name: S.info.get(i).names[0], cls: 'star', prio: 50 - m * 5, make: () => starTarget(i) });
  // objetos de céu profundo curados
  for (const o of DB.curated) {
    const d = v3.dist(F.cam, o.xyz);
    const size = o.maj ? o.d * Math.tan(o.maj / 60 * DEG) : 0;
    const px = size / d * F.pxPerRad;
    const bigScale = o.type === 'cluster' && v3.len(F.cam) > 2e7;
    if (px > 5 || bigScale || d < 3000 && o.d > 100 && v3.len(F.cam) > 50) out.push({ id: 'c:' + o.id, pos: o.xyz, name: o.name, cls: 'deep', prio: 40 + Math.min(px, 300) / 10, make: () => curatedTarget(o) });
  }
  // galáxias do 2MRS com nome de catálogo conhecido e tamanho visível
  const G = DB.gals;
  for (const [i, name] of G.names) {
    if (name.startsWith('2MASX')) continue;
    const x = G.pos[i * 3] - cx, y = G.pos[i * 3 + 1] - cy, z = G.pos[i * 3 + 2] - cz;
    const px = 2 * G.radius[i] / Math.sqrt(x * x + y * y + z * z) * F.pxPerRad;
    if (px > 14) out.push({ id: 'g:' + i, pos: [G.pos[i * 3], G.pos[i * 3 + 1], G.pos[i * 3 + 2]], name, cls: 'gal', prio: 20 + Math.min(px, 400) / 20, make: () => galTarget(i) });
  }
  // as 8 estrelas com exoplanetas mais próximas da nave (fora do Sistema Solar)
  const host = systems.currentHost();
  if (v3.len(F.cam) > 0.05) {
    const hs = [];
    for (const h of DB.hosts) {
      if (h === host) continue;
      const p = starPos(h.star), d = v3.dist(F.cam, p);
      if (d < 15) hs.push([d, h, p]);
    }
    hs.sort((a, b) => a[0] - b[0]);
    for (const [, h, p] of hs.slice(0, 8)) out.push({ id: 's:' + h.star, pos: p, name: h.name, cls: 'exo', prio: 30, make: () => starTarget(h.star) });
  }
  slow = out;
  // asteroides e cometas famosos, e cometas brilhantes agora (mudam devagar: recalculados junto com os lentos)
  sbCands = [];
  if (v3.len(F.cam) < 3000 * AU && F.layers.solar !== false) {
    if (showSB.asteroids) for (const f of SB.famous) {
      if (f.isComet && !showSB.comets) continue;
      const p = bodyPos(f), d = v3.dist(F.cam, p);
      if (d > 60 * AU) continue;
      sbCands.push({ id: 'sb:' + f.full, pos: p, name: f.name, cls: 'sb', prio: 62 - Math.log10(d / AU + 1) * 5, make: () => sbTarget(f) });
    }
    if (showSB.comets) for (const c of SB.comets) {
      if (!(c.mag < 11) || !c.now) continue;
      sbCands.push({ id: 'sb:' + c.full, pos: c.now, name: c.full.replace(/\s*\(.*\)$/, ''), cls: 'sb', prio: 66 - c.mag, make: () => cometTarget(c) });
    }
  }
}
let sbCands = [];

function fastCandidates() {
  const out = [];
  const nearSun = v3.len(F.cam) < 3000 * AU;
  if (nearSun && F.layers.solar !== false) {
    for (const b of BODIES) {
      if (b.parent) {
        const pd = v3.dist(F.cam, b.pos);
        const parent = BODIES.find(x => x.key === b.parent);
        if (pd > 600 * parent.radius) continue;
      }
      out.push({ id: 'b:' + b.key, pos: b.pos, name: b.name, cls: b.kind === 'moon' ? 'moon' : 'planet', prio: b.kind === 'moon' ? 70 : 90, radius: b.radius, make: () => bodyTarget(b.key) });
    }
  }
  if (nearSun) out.push(...sbCands);
  for (const c of CRAFT) {
    // rótulo só quando a nave está relativamente perto (o marcador aparece de mais longe)
    if (!isVisible(c, c.now) || v3.dist(F.cam, c.now) > (c.kind === 'surface' ? 25 : 40) * c.sep()) continue;
    out.push({ id: 'm:' + c.id, pos: c.now, name: c.name, cls: 'craft', prio: c.kind === 'probe' ? 78 : 74, make: () => craftTarget(c) });
  }
  const host = systems.currentHost();
  if (host) for (const P of systems.planets) out.push({ id: 'p:' + P.name, pos: P.pos, name: P.name.replace(host.name, '').trim() || P.name, full: P.name, cls: 'exo', prio: 85, radius: P.radius, make: () => exoTarget(host, P.name) });
  if (host) out.push({ id: 's:' + host.star, pos: starPos(host.star), name: host.name, cls: 'star', prio: 88, make: () => starTarget(host.star) });
  return out;
}

let lastProjected = [];
export function update() {
  if (frame++ % 12 === 0) buildSlow();
  const show = F.layers.labels !== false;
  let cands = [...fastCandidates(), ...slow];
  cands.push(...linkLabels());
  // de muito longe, marca onde nós estamos
  if (v3.len(F.cam) > 3e7) cands.push({ id: 'home', pos: [0, 0, 0], name: 'Você está aqui (Via Láctea)', cls: 'sel', prio: 900, make: () => bodyTarget('Earth') });
  if (selectedT) cands.push({ id: selectedT.id, pos: selectedT.pos(), name: selectedT.name, cls: 'sel', prio: 1000, radius: selectedT.radius, make: () => selectedT });
  const seen = new Set();
  const proj = [];
  for (const c of cands) {
    if (seen.has(c.id) && c.cls !== 'sel') continue;
    const p = project(c.pos);
    if (!p || occluded(c.pos, p.d)) continue;
    const rpx = c.radius ? c.radius / p.d * F.pxPerRad : 0;
    proj.push({ ...c, x: p.x, y: p.y - Math.min(rpx, F.height) - (rpx > 2 ? 6 : 0), cx: p.x, cy: p.y, rpx, sel: c.id === selectedId });
    seen.add(c.id);
  }
  proj.sort((a, b) => (b.sel - a.sel) || b.prio - a.prio);
  lastProjected = proj;
  // posicionamento com rejeição de sobreposição
  const placed = [];
  let k = 0;
  if (show) for (const c of proj) {
    if (k >= 70) break;
    const w = c.name.length * 6.6 + 10, h = 15;
    const box = [c.x + 4, c.y - h / 2, c.x + 4 + w, c.y + h / 2];
    if (!c.sel && placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
    if (c.sel && placed.some(b => b.id === c.id)) continue;
    placed.push(Object.assign(box, { id: c.id }));
    let el = pool[k];
    if (!el) {
      el = document.createElement('div');
      el.addEventListener('click', ev => { ev.stopPropagation(); const t = el._c?.make(); if (t) onPick(t, ev.detail >= 2); });
      root.appendChild(el); pool.push(el);
    }
    el._c = c;
    el.className = `lbl ${c.sel ? 'sel ' : ''}${c.cls}`;
    if (el.textContent !== c.name) el.textContent = c.name;
    el.style.transform = `translate(${(c.x + 4) | 0}px, ${(c.y - 8) | 0}px)`;
    el.style.display = '';
    k++;
  }
  for (; k < pool.length; k++) pool[k].style.display = 'none';
}

// Clique no canvas: rótulos/candidatos primeiro, depois a estrela ou galáxia mais brilhante sob o cursor
export function pickAt(x, y) {
  let best = null, bd = 18;
  for (const c of lastProjected) {
    const d = Math.hypot(c.cx - x, c.cy - y) - Math.min(c.rpx || 0, 400);
    if (d < bd) { bd = d; best = c; }
  }
  if (best) return best.make();
  const sat = sats.pick(project, x, y);
  if (sat) return satTarget(sat);
  const com = smallbodies.pickComet(project, x, y);
  if (com) return cometTarget(com);
  const ast = smallbodies.pickAsteroid(project, x, y);
  if (ast >= 0) return astTarget(ast);
  // estrelas: o ponto mais brilhante perto do cursor
  const S = DB.stars, [cx, cy, cz] = F.cam;
  let bi = -1, bscore = -Infinity;
  const ray = rayAt(x, y);
  const cosMax = Math.cos(14 / F.pxPerRad);
  for (let i = 0; i < S.n; i++) {
    const dx = S.pos[i * 3] - cx, dy = S.pos[i * 3 + 1] - cy, dz = S.pos[i * 3 + 2] - cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const c = (dx * ray[0] + dy * ray[1] + dz * ray[2]) / d;
    if (c < cosMax) continue;
    const m = S.absmag[i] + 5 * Math.log10(d / 10);
    if (m > 9.5) continue;
    const score = -m - (1 - c) * F.pxPerRad * 0.8;
    if (score > bscore) { bscore = score; bi = i; }
  }
  if (bi >= 0) return starTarget(bi);
  const q = deep.pick(ray);
  if (q >= 0) return qsoTarget(q);
  const G = DB.gals;
  let gi = -1, gs = -Infinity;
  for (let i = 0; i < G.n; i++) {
    const dx = G.pos[i * 3] - cx, dy = G.pos[i * 3 + 1] - cy, dz = G.pos[i * 3 + 2] - cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const c = (dx * ray[0] + dy * ray[1] + dz * ray[2]) / d;
    const ang = Math.max(G.radius[i] / d, 12 / F.pxPerRad);
    if (Math.acos(Math.min(c, 1)) > ang) continue;
    const s = G.radius[i] / d;
    if (s > gs) { gs = s; gi = i; }
  }
  return gi >= 0 ? galTarget(gi) : null;
}

export function rayAt(x, y) {
  const t = Math.tan(camera.fov * Math.PI / 360);
  const v = new THREE.Vector3(((x / F.width) * 2 - 1) * t * camera.aspect, (-(y / F.height) * 2 + 1) * t, -1).normalize().applyQuaternion(camera.quaternion);
  return [v.x, v.y, v.z];
}
