// Naves fora da órbita baixa (JPL Horizons), objetos na superfície de outros mundos e satélites em destaque.
// Marcadores de tamanho fixo na tela; modelo 3D em escala real quando a nave chega perto.
import * as THREE from 'three';
import { F, local, place } from '../engine.js';
import { BODY, surfacePoint } from './solar.js';
import { SAT, satPos, satPosKm } from './sats.js';
import { makeModel } from '../models.js';
import { NOTABLE_SATS } from '../../tools/spacecraft.mjs';
import { KM, AU, v3 } from '../astro.js';

export const CRAFT = [];
export const showCraft = { probes: true, surface: true, notable: true, trails: true };
const KIND_COLOR = { probe: [0.5, 0.85, 1.0], surface: [1.0, 0.7, 0.45], sat: [0.62, 0.95, 0.77] };
const M_PC = 1e-3 * KM;
const JD_UNIX = 2440587.5;
let eph = null;

const centerPos = c => (c === 'Sun' ? [0, 0, 0] : BODY[c].pos);
const centerR = c => BODY[c].radius;
function hash(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; }

// Interpolação de Hermite cúbica com as velocidades do Horizons
function ephRel(p, tMs) {
  const e = p.eph;
  const x = ((tMs / 864e5 + JD_UNIX) - e.jd0) * 86400 / e.dt;
  if (x < 0) return null;
  if (x >= e.n - 1) {
    if (p.center !== 'Sun') return null;
    const o = e.offset + (e.n - 1) * 6, extra = (x - (e.n - 1)) * e.dt; // depois do fim: segue em linha reta
    return [eph[o] + eph[o + 3] * extra, eph[o + 1] + eph[o + 4] * extra, eph[o + 2] + eph[o + 5] * extra];
  }
  const k = Math.floor(x), s = x - k, h = e.dt;
  const o0 = e.offset + k * 6, o1 = o0 + 6;
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = h00 * eph[o0 + i] + h10 * h * eph[o0 + 3 + i] + h01 * eph[o1 + i] + h11 * h * eph[o1 + 3 + i];
  return out;
}

// Órbita aproximada (missões sem efeméride pública): elipse com os parâmetros publicados, fase ilustrativa
function approxRel(p, tMs) {
  const o = p.approxOrbit, b = BODY[o.center];
  const rp = b.r + o.peri, ra = b.r + o.apo, a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
  const M = 2 * Math.PI * (tMs / 3600e3 / o.periodH + hash(p.id));
  let E = M; for (let k = 0; k < 10; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const { pm, pole } = b.basis || { pm: [1, 0, 0], pole: [0, 0, 1] };
  const inc = o.inc * Math.PI / 180;
  const q = v3.cross(pole, pm);
  const u = pm, w = v3.add(v3.scale(q, Math.cos(inc)), v3.scale(pole, Math.sin(inc)));
  return v3.add(v3.scale(u, x), v3.scale(w, y));
}

export async function load() {
  let doc;
  try {
    doc = await (await fetch('data/spacecraft.json')).json();
    eph = new Float64Array(await (await fetch('data/spacecraft.bin')).arrayBuffer());
  } catch { return; }
  for (const p of doc.probes) {
    if (p.missing && !p.approxOrbit && !p.approxPlace) continue;
    const c = { ...p, kind: 'probe', center: p.center || p.approxOrbit?.center || 'Earth' };
    if (p.eph) c.pos = t => { const r = ephRel(c, t); return r && v3.add(centerPos(c.center), v3.scale(r, KM)); };
    else if (p.approxOrbit) c.pos = t => v3.add(centerPos(c.center), v3.scale(approxRel(c, t), KM));
    else if (p.approxPlace) c.pos = () => { const E = BODY.Earth.pos, u = v3.norm(E); return v3.add(E, v3.scale(u, (p.approxPlace === 'L2' ? 1 : -1) * 1.5e6 * KM)); };
    else continue;
    c.sep = () => (c.center === 'Sun' ? v3.len(c.pos(F.date.getTime()) || [1, 0, 0]) : v3.dist(c.pos(F.date.getTime()) || centerPos(c.center), centerPos(c.center)));
    CRAFT.push(c);
  }
  for (const s of doc.surface) {
    const c = { ...s, kind: 'surface', center: s.body };
    c.pos = () => surfacePoint(s.body, s.lat, s.lon).pos;
    c.sep = () => BODY[s.body].radius * 0.15;
    c.ground = { center: () => BODY[s.body].pos, radius: BODY[s.body].radius, up: () => surfacePoint(s.body, s.lat, s.lon).normal };
    CRAFT.push(c);
  }
}

// Satélites em destaque (precisam de satellites.json carregado)
export function addNotableSats() {
  for (const s of SAT.list) {
    const n = NOTABLE_SATS[s.name];
    if (!n) continue;
    const c = { id: 'sat-' + s.norad, name: n[0], model: n[1], size: n[2], desc: n[3], kind: 'sat', center: 'Earth', sat: s, country: null };
    c.pos = t => satPos(s, t);
    c.sep = () => v3.len(satPosKm(s)) * KM;
    s.craft = c;
    CRAFT.push(c);
  }
}

let selectedId = null;
export function setSelected(t) { selectedId = t?.craft?.id || null; }

// Agora é dia ou noite no local de um objeto de superfície?
export function isNight(c) {
  if (c.kind !== 'surface') return null;
  const sp = surfacePoint(c.body, c.lat, c.lon);
  return v3.dot(sp.normal, v3.norm(v3.scale(sp.pos, -1))) < 0;
}

export function isVisible(c, pos) {
  const on = c.kind === 'probe' ? showCraft.probes : c.kind === 'surface' ? showCraft.surface : showCraft.notable;
  if (!on || !pos || F.layers.solar === false) return false;
  const factor = c.kind === 'surface' ? 60 : 300;
  return v3.dist(F.cam, pos) < factor * c.sep();
}

// ---------------------------------------------------------------- desenho
let points, posAttr, colAttr;
const models = new Map();
let ground;
const trails = [];

export function build() {
  const n = Math.max(CRAFT.length, 1);
  const g = new THREE.BufferGeometry();
  posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3); posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr = new THREE.BufferAttribute(new Float32Array(n * 4), 4); colAttr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', posAttr); g.setAttribute('color', colAttr);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  const mat = new THREE.ShaderMaterial({
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
      attribute vec4 color; varying vec4 vC;
      void main() { vC = color; gl_PointSize = 9.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        if (color.a < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
      varying vec4 vC;
      void main() {
        #include <logdepthbuf_fragment>
       
        vec2 p = abs(gl_PointCoord * 2.0 - 1.0); float d = p.x + p.y;   // losango vazado
        if (d > 1.0 || d < 0.45) discard;
        gl_FragColor = vec4(vC.rgb, vC.a); }`,
    transparent: true, depthWrite: false,
  });
  points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  local.add(points);
  CRAFT.forEach((c, i) => {
    const col = KIND_COLOR[c.kind];
    colAttr.array.set([...col, 0], i * 4);
  });
  // chão local para quem pousa perto de um robô: disco tangente que cobre as facetas da esfera do planeta
  const tex = groundTexture();
  ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshLambertMaterial({ map: tex }));
  ground.visible = false;
  local.add(ground);
  buildTrails();
}

function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const img = g.createImageData(512, 512);
  for (let i = 0; i < 512 * 512; i++) {
    const n = 0.75 + 0.25 * Math.random() + 0.1 * Math.sin(i * 0.002) * Math.cos(i * 0.0007);
    img.data.set([255 * n, 255 * n, 255 * n, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  // crateras pequenas
  for (let k = 0; k < 140; k++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 2 + Math.random() ** 3 * 30;
    const grd = g.createRadialGradient(x, y, r * 0.2, x, y, r);
    grd.addColorStop(0, 'rgba(0,0,0,0.35)'); grd.addColorStop(0.8, 'rgba(0,0,0,0.1)'); grd.addColorStop(1, 'rgba(255,255,255,0.15)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(400, 400); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const GROUND_COLOR = { Moon: 0x8d8b88, Mars: 0xb26e45, Venus: 0x9a6c3a };

function buildTrails() {
  for (const c of CRAFT) {
    if (!c.eph || c.center !== 'Sun') continue;
    const e = c.eph, stepN = Math.max(1, Math.floor(e.n / 1500));
    const pos = [], tms = [];
    for (let k = 0; k < e.n; k += stepN) {
      const o = e.offset + k * 6;
      pos.push(eph[o] * KM, eph[o + 1] * KM, eph[o + 2] * KM);
      tms.push(((e.jd0 + k * e.dt / 86400) - JD_UNIX) * 864e5 / 1e9); // em 10^9 ms para caber em float32 com folga
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('tms', new THREE.Float32BufferAttribute(tms, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uNow: { value: 0 }, uColor: { value: new THREE.Color(0x7fd8ff) } },
      vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
        attribute float tms; varying float vT;
        void main() { vT = tms; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
        uniform float uNow; uniform vec3 uColor; varying float vT;
        void main() {
        #include <logdepthbuf_fragment>
       
          gl_FragColor = vec4(uColor, vT <= uNow ? 0.55 : 0.14); }`,
      transparent: true, depthWrite: false,
    });
    const line = new THREE.Line(g, mat);
    line.frustumCulled = false;
    line.userData.craft = c;
    local.add(line);
    trails.push(line);
  }
}

export function update() {
  if (!points) return;
  const t = F.date.getTime();
  const pa = posAttr.array, ca = colAttr.array;
  const near = [];
  CRAFT.forEach((c, i) => {
    const p = c.pos(t);
    c.now = p;
    const vis = isVisible(c, p);
    ca[i * 4 + 3] = vis ? 0.95 : 0;
    if (!p) return;
    pa[i * 3] = p[0] - F.cam[0]; pa[i * 3 + 1] = p[1] - F.cam[1]; pa[i * 3 + 2] = p[2] - F.cam[2];
    const d = v3.dist(F.cam, p);
    if (d < 4000 * (c.size || 5) * M_PC) near.push([d, c]);
  });
  posAttr.needsUpdate = colAttr.needsUpdate = true;
  points.visible = F.layers.solar !== false;

  // modelos dos 3 mais próximos
  near.sort((a, b) => a[0] - b[0]);
  const want = new Set(near.slice(0, 3).map(([, c]) => c.id));
  for (const [id, m] of models) if (!want.has(id)) { m.visible = false; }
  for (const [, c] of near.slice(0, 3)) {
    let m = models.get(c.id);
    if (!m) { m = makeModel(c.model, c.size); models.set(c.id, m); local.add(m); }
    m.visible = true;
    place(m, c.now);
    m.scale.setScalar(M_PC);
    orientModel(m, c, t);
  }

  // chão local do objeto de superfície mais próximo
  const s = near.find(([d, c]) => c.kind === 'surface' && d < 300 * KM);
  if (s) {
    const c = s[1], sp = surfacePoint(c.body, c.lat, c.lon);
    ground.visible = true;
    place(ground, sp.pos);
    ground.scale.setScalar(40 * KM);
    ground.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...sp.normal));
    ground.material.color.setHex(GROUND_COLOR[c.body] || 0x888888);
  } else ground.visible = false;

  for (const l of trails) {
    const c = l.userData.craft;
    place(l, [0, 0, 0]);
    l.material.uniforms.uNow.value = t / 1e9;
    // perto da nave, a linha (em float32) perde precisão: some
    // todas aparecem na vista de longe; perto de um planeta, só a da nave selecionada
    const wide = F.near > 0.05 * AU && !F.linkActive; // no modo "visto da Terra", só a linha importa
    l.visible = showCraft.trails && showCraft.probes && F.layers.solar !== false && v3.len(F.cam) < 5 && (wide || c.id === selectedId) && !(c.now && v3.dist(F.cam, c.now) < 0.05 * AU);
  }
}

const _m = new THREE.Matrix4();
function orientModel(m, c, t) {
  let up, fwd;
  if (c.kind === 'surface') {
    const sp = surfacePoint(c.body, c.lat, c.lon);
    up = sp.normal; fwd = v3.norm(v3.cross(sp.north, up));
    const a = hash(c.id) * 6.28; // rumo ilustrativo
    const side = v3.cross(up, fwd);
    fwd = v3.add(v3.scale(fwd, Math.cos(a)), v3.scale(side, Math.sin(a)));
  } else if (c.kind === 'sat') {
    up = v3.norm(satPosKm(c.sat, t));
    fwd = v3.norm(v3.sub(satPosKm(c.sat, t + 1000), satPosKm(c.sat, t)));
  } else {
    up = v3.norm(v3.sub(BODY.Earth.pos, c.now)); // antena apontada para a Terra
    fwd = v3.norm(v3.cross(up, [0, 0, 1]));
  }
  const x = v3.norm(v3.cross(up, fwd)), z = v3.cross(x, up);
  _m.makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...up), new THREE.Vector3(...z));
  m.quaternion.setFromRotationMatrix(_m);
}

// Velocidade (km/s) em relação ao corpo central
export function speedKmS(c) {
  const t = F.date.getTime();
  const rel = c.eph ? x => ephRel(c, x) : c.approxOrbit ? x => approxRel(c, x) : null;
  if (!rel) return null;
  const a = rel(t), b = rel(t + 1000);
  return a && b ? v3.dist(a, b) : null;
}
