// Naves fora da órbita baixa (JPL Horizons), objetos na superfície de outros mundos e satélites em destaque.
// Marcadores de tamanho fixo na tela; modelo 3D em escala real quando a nave chega perto.
// A trajetória de cada nave é uma lista de trechos (segs): cada um tem um corpo central, um passo e amostras de
// posição e velocidade. Na data pedida, vale o trecho mais fino que a cobre (os trechos finos são as passagens
// perto de planetas). Fonte: data/spacecraft.* (atual, atualizado toda semana) e data/history.* (missões completas).
import * as THREE from 'three';
import { F, local, place } from '../engine.js';
import { BODY, surfacePoint } from './solar.js';
import { SAT, satPos, satPosKm, satsValidNow } from './sats.js';
import { makeModel } from '../models.js';
import { NOTABLE_SATS } from '../../tools/spacecraft.mjs';
import { KM, AU, v3 } from '../astro.js';

export const CRAFT = [];
export const showCraft = { probes: true, surface: true, notable: true, trails: true };
const KIND_COLOR = { probe: [0.5, 0.85, 1.0], surface: [1.0, 0.7, 0.45], sat: [0.62, 0.95, 0.77], natural: [1.0, 0.85, 0.6] };
const M_PC = 1e-3 * KM;
const JD_UNIX = 2440587.5;
const jdOf = tMs => tMs / 864e5 + JD_UNIX;

// Datas de pouso (os robôs só aparecem na superfície depois de chegar)
const LANDED = {
  apollo11: '1969-07-20T20:17Z', apollo12: '1969-11-19', apollo14: '1971-02-05', apollo15: '1971-07-30', apollo16: '1972-04-21', apollo17: '1972-12-11',
  luna2: '1959-09-13', luna9: '1966-02-03', luna16: '1970-09-20', lunokhod1: '1970-11-17', lunokhod2: '1973-01-15', luna24: '1976-08-18', luna25: '2023-08-19',
  surveyor1: '1966-06-02', change3: '2013-12-14', change4: '2019-01-03', change5: '2020-12-01', change6: '2024-06-01', chandrayaan3: '2023-08-23',
  slim: '2024-01-19', odysseus: '2024-02-22', blueghost: '2025-03-02', perseverance: '2021-02-18', ingenuity: '2021-02-18', curiosity: '2012-08-06',
  zhurong: '2021-05-14', insight: '2018-11-26', opportunity: '2004-01-25', spirit: '2004-01-04', pathfinder: '1997-07-04', viking1: '1976-07-20',
  viking2: '1976-09-03', phoenix: '2008-05-25', mars3: '1971-12-02', beagle2: '2003-12-25', venera7: '1970-12-15', venera9: '1975-10-22', venera13: '1982-03-01',
};

const centerPos = c => (c === 'Sun' ? [0, 0, 0] : BODY[c].pos);
function hash(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; }

// ---------------------------------------------------------------- trechos de trajetória
// Interpolação de Hermite cúbica com as velocidades do Horizons; km relativos ao centro do trecho
function segRel(s, jd) {
  const x = (jd - s.jd0) * 86400 / s.dt;
  const buf = s.buf;
  if (x < 0) return null;
  if (x >= s.n - 1) {
    if (!s.extrapolate) return null;
    const o = s.offset + (s.n - 1) * 6, extra = (x - (s.n - 1)) * s.dt; // depois do fim: segue em linha reta
    return [buf[o] + buf[o + 3] * extra, buf[o + 1] + buf[o + 4] * extra, buf[o + 2] + buf[o + 5] * extra];
  }
  const k = Math.floor(x), u = x - k, h = s.dt;
  const o0 = s.offset + k * 6, o1 = o0 + 6;
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = h00 * buf[o0 + i] + h10 * h * buf[o0 + 3 + i] + h01 * buf[o1 + i] + h11 * h * buf[o1 + 3 + i];
  return out;
}
// Órbita circular calculada (ex.: Apollo 11 em volta da Lua), km relativos ao centro
function circRel(s, jd) {
  const b = BODY[s.center], r = b.r + s.altKm;
  const M = 2 * Math.PI * (jd - s.jd0) * 1440 / s.periodMin;
  const { pm, pole } = b.basis || { pm: [1, 0, 0], pole: [0, 0, 1] };
  const inc = s.incDeg * Math.PI / 180, q = v3.cross(pole, pm);
  const w = v3.add(v3.scale(q, Math.cos(inc)), v3.scale(pole, Math.sin(inc)));
  return v3.add(v3.scale(pm, r * Math.cos(M)), v3.scale(w, r * Math.sin(M)));
}
const segEnd = s => s.jd0 + (s.n - 1) * s.dt / 86400;
// O trecho mais fino que cobre a data
function segAt(c, jd) {
  let best = null;
  for (const s of c.segs) {
    const covers = s.circ ? jd >= s.jd0 && jd <= s.jd1 : jd >= s.jd0 && (jd <= segEnd(s) || s.extrapolate);
    if (covers && (!best || s.dt < best.dt)) best = s;
  }
  return best;
}
function relAt(c, jd) {
  const s = segAt(c, jd);
  if (!s) return null;
  const r = s.circ ? circRel(s, jd) : segRel(s, jd);
  return r && { s, r };
}
export function craftCenterAt(c, tMs = F.date.getTime()) { return segAt(c, jdOf(tMs))?.center || c.center; }

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
const GM_SUN = 1.32712440018e11; // km³/s²
function escaping(buf, e) {
  const o = e.offset + (e.n - 1) * 6;
  const r = Math.hypot(buf[o], buf[o + 1], buf[o + 2]), v2 = buf[o + 3] ** 2 + buf[o + 4] ** 2 + buf[o + 5] ** 2;
  return v2 > 2 * GM_SUN / r;
}
const launched = c => F.date.getUTCFullYear() >= (c.launch || 0);

export async function load() {
  const get = async (j, b) => { try { return [await (await fetch(j)).json(), new Float64Array(await (await fetch(b)).arrayBuffer())]; } catch { return [null, null]; } };
  const [doc, buf] = await get('data/spacecraft.json', 'data/spacecraft.bin');
  const [hist, hbuf] = await get('data/history.json', 'data/history.bin');
  if (!doc) return;
  const histById = new Map((hist || []).map(h => [h.id, h]));
  const mkSegs = (list, b, extra = {}) => list.map(s => ({ ...s, buf: b, ...extra }));
  const withPos = c => {
    if (c.segs?.length) c.pos = t => { const x = relAt(c, jdOf(t)); return x && v3.add(centerPos(x.s.center), v3.scale(x.r, KM)); };
    else if (c.approxOrbit) c.pos = t => (launched(c) ? v3.add(centerPos(c.center), v3.scale(approxRel(c, t), KM)) : null);
    else if (c.approxPlace) c.pos = () => { if (!launched(c)) return null; const E = BODY.Earth.pos, u = v3.norm(E); return v3.add(E, v3.scale(u, (c.approxPlace === 'L2' ? 1 : -1) * 1.5e6 * KM)); };
    else return false;
    c.sep = () => { const p = c.now || c.pos(F.date.getTime()); const cc = craftCenterAt(c); return p ? (cc === 'Sun' ? v3.len(p) : v3.dist(p, centerPos(cc))) : 1; };
    return true;
  };
  for (const p of doc.probes) {
    if (p.missing && !p.approxOrbit && !p.approxPlace && !histById.has(p.id)) continue;
    const c = { ...p, kind: 'probe', center: p.center || p.approxOrbit?.center || 'Earth', segs: [] };
    // trecho atual (semanal): continua em linha reta depois do fim, para naves que seguem viajando
    // (sem histórico, a nave só aparece a partir do primeiro ponto do trecho atual, um ano após o lançamento)
    // depois do fim da tabela, segue em linha reta só quem está escapando do Sistema Solar (v² > 2GM/r)
    if (p.eph) c.segs.push({ ...p.eph, center: c.center, buf, extrapolate: c.center === 'Sun' && escaping(buf, p.eph) });
    const h = histById.get(p.id);
    if (h) { c.segs.push(...mkSegs(h.segs, hbuf)); c.hasHistory = true; histById.delete(p.id); }
    if (withPos(c)) CRAFT.push(c);
  }
  // missões encerradas que só existem no histórico (Cassini, Galileo, Rosetta, Apollo 11, Artemis…)
  for (const h of histById.values()) {
    const c = { ...h, kind: h.natural ? 'natural' : 'probe', segs: mkSegs(h.segs, hbuf), hasHistory: true };
    for (const k of h.circ || []) c.segs.push({ circ: true, center: k.center, jd0: jdOf(Date.parse(k.start)), jd1: jdOf(Date.parse(k.stop)), dt: 1, altKm: k.altKm, incDeg: k.incDeg, periodMin: k.periodMin });
    if (withPos(c)) CRAFT.push(c);
  }
  for (const s of doc.surface) {
    const c = { ...s, kind: 'surface', center: s.body, landed: LANDED[s.id] ? Date.parse(LANDED[s.id]) : Date.UTC(s.launch + (s.body === 'Moon' ? 0 : 1), 0, 1) };
    c.pos = () => (F.date.getTime() >= c.landed ? surfacePoint(s.body, s.lat, s.lon).pos : null);
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
    c.pos = t => (satsValidNow() ? satPos(s, t) : null);
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
  const on = c.kind === 'probe' || c.kind === 'natural' ? showCraft.probes : c.kind === 'surface' ? showCraft.surface : showCraft.notable;
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

// Uma linha por trecho. Trechos em volta do Sol: visíveis na vista de longe. Trechos em volta de planetas
// (passagens, órbitas): só da nave selecionada ou do replay, com a câmera perto daquele planeta.
function buildTrails() {
  for (const c of CRAFT) {
    if (!c.segs) continue;
    // o trecho atual (semanal) repete o histórico: com histórico, só entra a parte depois do fim dele
    const histSunEnd = Math.max(0, ...c.segs.filter(s => s.center === 'Sun' && !s.extrapolate && !s.circ).map(segEnd));
    for (const s of c.segs) {
      if (s.circ) continue;
      const k0 = s.extrapolate && histSunEnd ? Math.max(0, Math.ceil((histSunEnd - s.jd0) * 86400 / s.dt)) : 0;
      if (k0 >= s.n - 1) continue;
      addTrail(c, s, k0);
    }
  }
}
function addTrail(c, s, k0) {
  {
    const e = s, buf = s.buf, stepN = Math.max(1, Math.floor((e.n - k0) / 3000));
    const pos = [], tms = [];
    for (let k = k0; k < e.n; k += stepN) {
      const o = e.offset + k * 6;
      pos.push(buf[o] * KM, buf[o + 1] * KM, buf[o + 2] * KM);
      tms.push(((e.jd0 + k * e.dt / 86400) - JD_UNIX) * 864e5 / 1e9); // em 10^9 ms para caber em float32 com folga
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('tms', new THREE.Float32BufferAttribute(tms, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uNow: { value: 0 }, uColor: { value: new THREE.Color(0x7fd8ff) }, uBoost: { value: 1 } },
      vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
        attribute float tms; varying float vT;
        void main() { vT = tms; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
        uniform float uNow, uBoost; uniform vec3 uColor; varying float vT;
        void main() {
        #include <logdepthbuf_fragment>
       
          gl_FragColor = vec4(uColor * uBoost, (vT <= uNow ? 0.55 : 0.12) * min(uBoost, 1.4)); }`,
      transparent: true, depthWrite: false,
    });
    if (c.kind === 'natural') mat.uniforms.uColor.value.set(0xffc36b);
    const line = new THREE.Line(g, mat);
    line.frustumCulled = false;
    line.userData = { craft: c, seg: s };
    local.add(line);
    trails.push(line);
  }
}
export let focusIds = new Set(); // naves acompanhadas por um replay
export function setFocus(ids) { focusIds = new Set(ids || []); }

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
    if (vis && d < 4000 * (c.size || 5) * M_PC) near.push([d, c]);
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

  const wide = F.near > 0.05 * AU && !F.linkActive; // no modo "visto da Terra", só a linha importa
  for (const l of trails) {
    const { craft: c, seg: s } = l.userData;
    const mine = c.id === selectedId || focusIds.has(c.id);
    // durante um replay, só as trajetórias da missão; fora dele, só as das naves que existem na data
    const on = showCraft.trails && showCraft.probes && F.layers.solar !== false && (focusIds.size ? focusIds.has(c.id) : !!c.now);
    l.material.uniforms.uNow.value = t / 1e9;
    l.material.uniforms.uBoost.value = mine ? 1.6 : 1;
    if (s.center === 'Sun') {
      place(l, [0, 0, 0]);
      // todas aparecem na vista de longe; perto de um planeta, só a da nave selecionada.
      // Com a câmera colada na nave, a linha (em float32 a partir do Sol) perde precisão: some.
      l.visible = on && v3.len(F.cam) < 5 && (wide || mine) && !(c.now && v3.dist(F.cam, c.now) < 0.02 * AU && craftCenterAt(c) !== 'Sun');
    } else {
      const P = BODY[s.center].pos;
      place(l, P);
      l.visible = on && mine && v3.dist(F.cam, P) < 0.3 * AU;
    }
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
  if (c.segs?.length) {
    const a = relAt(c, jdOf(t)), b = relAt(c, jdOf(t + 1000));
    return a && b && a.s === b.s ? v3.dist(a.r, b.r) : null;
  }
  if (c.approxOrbit) return v3.dist(approxRel(c, t), approxRel(c, t + 1000));
  return null;
}
