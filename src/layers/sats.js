// Satélites e detritos em órbita da Terra (CelesTrak). Cada ponto é propagado na GPU por Kepler com as perturbações
// seculares do achatamento da Terra (J2) e o decaimento por arrasto (derivada do movimento médio): erro de poucos km
// perto da época dos elementos. O mesmo cálculo existe em JS para seleção, rótulos e o alvo da nave.
import * as THREE from 'three';
import * as A from 'astronomy-engine';
import { F, scene, pointsMaterial } from '../engine.js';
import { BODY } from './solar.js';
import { KM, v3 } from '../astro.js';

const MU = 398600.4418, RE = 6378.137, J2 = 1.08262668e-3, TAU = 2 * Math.PI, D2R = Math.PI / 180;
export const COUNTRY_COLORS = ['#6fa8ff', '#ff6b5e', '#c8a2ff', '#6fe3c1', '#ff9ad5', '#ffa94d', '#ffe14d', '#9aa3b5'];
// visíveis por padrão: só estações. A "massaroca" começa desligada.
export const show = { cats: [true, false, false, false, false, false], countries: [true, true, true, true, true, true, true, true] };

export const SAT = { list: [], meta: null, n: 0 };
let points, geo, uniforms, tRef = 0;
let el; // elementos por satélite: Float64Array(n*10)

export async function load() {
  try {
    const doc = await (await fetch('data/satellites.json')).json();
    SAT.meta = doc;
    SAT.list = doc.sats.map(s => ({ norad: s[0], name: s[1], epoch: s[2], mm: s[3], e: s[4], i: s[5], raan: s[6], argp: s[7], M: s[8], mmdot: s[9], cat: s[10], country: s[11], owner: s[12], year: s[13], notable: s[14] }));
    SAT.n = SAT.list.length;
  } catch { SAT.list = []; SAT.n = 0; }
}

// Constantes por satélite que não mudam: a, n, taxas seculares
function prep(s) {
  const n = s.mm * TAU / 86400;
  const a = Math.cbrt(MU / (n * n));
  const p = a * (1 - s.e * s.e);
  const k = 1.5 * J2 * (RE / p) ** 2 * n;
  const ci = Math.cos(s.i * D2R), si2 = 1 - ci * ci;
  s._n = n; s._a = a;
  s._ndot = s.mmdot * TAU / (86400 * 86400); // rad/s² (a TLE traz ṅ/2)
  s._dRaan = -k * ci;
  s._dArgp = k * (2 - 2.5 * si2);
}

// Elementos no instante t (ms)
function elementsAt(s, tMs) {
  const dt = (tMs - s.epoch) / 1000;
  return {
    M: s.M * D2R + s._n * dt + s._ndot * dt * dt,
    n: s._n + 2 * s._ndot * dt,
    raan: s.raan * D2R + s._dRaan * dt,
    argp: s.argp * D2R + s._dArgp * dt,
  };
}

// Matriz do equador verdadeiro da data (≈ TEME) para J2000, atualizada de hora em hora
let rot = null, rotAt = -Infinity;
const rotM = new THREE.Matrix3();
function rotation(tMs) {
  if (Math.abs(tMs - rotAt) > 3600e3) {
    rot = A.Rotation_EQD_EQJ(A.MakeTime(new Date(tMs))).rot;
    rotM.fromArray(rot.flat());
    rotAt = tMs;
  }
  return rot;
}

// Posição geocêntrica J2000 em km
export function satPosKm(s, tMs = F.date.getTime()) {
  if (s._n === undefined) prep(s);
  const { M, raan, argp } = elementsAt(s, tMs);
  const e = s.e, a = s._a;
  let E = M;
  for (let k = 0; k < 12; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cO = Math.cos(raan), sO = Math.sin(raan), cw = Math.cos(argp), sw = Math.sin(argp), ci = Math.cos(s.i * D2R), si = Math.sin(s.i * D2R);
  const X = (cO * cw - sO * sw * ci) * x + (-cO * sw - sO * cw * ci) * y;
  const Y = (sO * cw + cO * sw * ci) * x + (-sO * sw + cO * cw * ci) * y;
  const Z = (sw * si) * x + (cw * si) * y;
  const r = rotation(tMs);
  return [r[0][0] * X + r[1][0] * Y + r[2][0] * Z, r[0][1] * X + r[1][1] * Y + r[2][1] * Z, r[0][2] * X + r[1][2] * Y + r[2][2] * Z];
}
export const satPos = (s, tMs) => v3.add(BODY.Earth.pos, v3.scale(satPosKm(s, tMs), KM));
export function satInfo(s) {
  if (s._n === undefined) prep(s);
  const r = v3.len(satPosKm(s));
  return { altKm: r - RE, periodMin: TAU / s._n / 60, speedKmS: Math.sqrt(MU * (2 / r - 1 / s._a)), perigee: s._a * (1 - s.e) - RE, apogee: s._a * (1 + s.e) - RE };
}

// Os elementos orbitais públicos só valem perto da data em que foram medidos (o arrasto muda as órbitas baixas)
export const satsValidNow = () => Math.abs(F.date.getTime() - Date.now()) < 120 * 864e5;

export function build() {
  if (!SAT.n) return;
  const n = SAT.n;
  for (const s of SAT.list) prep(s);
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  el = new Float32Array(n * 8); // M, n, raan, argp, e, a, dRaan, dArgp
  const st = new Float32Array(n * 3); // inclinação, categoria, país
  SAT.list.forEach((s, i) => { st[i * 3] = s.i * D2R; st[i * 3 + 1] = s.cat; st[i * 3 + 2] = s.country; });
  geo.setAttribute('el1', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  geo.setAttribute('el2', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  geo.setAttribute('st', new THREE.BufferAttribute(st, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  uniforms = {
    uT: { value: 0 }, uEarth: { value: new THREE.Vector3() }, uKm: { value: 1 }, uRot: { value: rotM }, uFade: { value: 1 },
    uCat: { value: show.cats.map(Number) }, uCountry: { value: show.countries.map(Number) },
    uColors: { value: COUNTRY_COLORS.map(c => new THREE.Color(c)) },
  };
  const mat = pointsMaterial({
    uniforms,
    vertex: /* glsl */`
      uniform float uT, uKm, uCat[6], uCountry[8];
      uniform vec3 uEarth;
      uniform mat3 uRot;
      uniform vec3 uColors[8];
      attribute vec4 el1, el2;
      attribute vec3 st;
      varying vec3 vColor;
      varying float vA;
      void main() {
        int cat = int(st.y + 0.5), ctry = int(st.z + 0.5);
        float on = uCat[cat] * uCountry[ctry];
        float M = el1.x + el1.y * uT, raan = el1.z + el2.z * uT, argp = el1.w + el2.w * uT;
        float e = el2.x, a = el2.y, inc = st.x;
        float E = M;
        for (int k = 0; k < 10; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
        float x = a * (cos(E) - e), y = a * sqrt(1.0 - e * e) * sin(E);
        float cO = cos(raan), sO = sin(raan), cw = cos(argp), sw = sin(argp), ci = cos(inc), si = sin(inc);
        vec3 p = vec3((cO * cw - sO * sw * ci) * x + (-cO * sw - sO * cw * ci) * y,
                      (sO * cw + cO * sw * ci) * x + (-sO * sw + cO * cw * ci) * y,
                      (sw * si) * x + (cw * si) * y);
        vec3 rel = uEarth + uRot * p;                          // km, relativo à câmera
        vColor = uColors[ctry] * (cat == 5 ? 0.6 : 1.0);
        vA = on;
        gl_PointSize = cat == 0 ? 4.0 : 2.4;
        gl_Position = projectionMatrix * viewMatrix * vec4(rel * uKm, 1.0);
        if (on < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragment: /* glsl */`
      uniform float uFade;
      varying vec3 vColor;
      varying float vA;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        gl_FragColor = vec4(vColor * (1.0 - r2 * 0.6) * uFade * vA, 1.0);
      }`,
  });
  mat.blending = THREE.AdditiveBlending;
  points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 4;
  scene.add(points);
  rebase(F.date.getTime());
}

// Reescreve os elementos para um novo instante de referência (o shader só soma a variação desde tRef)
function rebase(tMs) {
  tRef = tMs;
  const e1 = geo.attributes.el1.array, e2 = geo.attributes.el2.array;
  SAT.list.forEach((s, i) => {
    const E = elementsAt(s, tMs);
    e1[i * 4] = E.M % TAU; e1[i * 4 + 1] = E.n; e1[i * 4 + 2] = E.raan % TAU; e1[i * 4 + 3] = E.argp % TAU;
    e2[i * 4] = s.e; e2[i * 4 + 1] = s._a; e2[i * 4 + 2] = s._dRaan; e2[i * 4 + 3] = s._dArgp;
  });
  geo.attributes.el1.needsUpdate = geo.attributes.el2.needsUpdate = true;
}

export function setFilter() {
  if (!uniforms) return;
  uniforms.uCat.value = show.cats.map(Number);
  uniforms.uCountry.value = show.countries.map(Number);
}
export const visible = (s) => show.cats[s.cat] && show.countries[s.country];

export function update() {
  if (!points) return;
  const t = F.date.getTime();
  if (Math.abs(t - tRef) > 1800e3) rebase(t);
  rotation(t);
  uniforms.uT.value = (t - tRef) / 1000;
  const E = BODY.Earth.pos;
  const d = v3.dist(F.cam, E);
  uniforms.uEarth.value.set((E[0] - F.cam[0]) / KM, (E[1] - F.cam[1]) / KM, (E[2] - F.cam[2]) / KM);
  uniforms.uKm.value = KM * F.S;
  // some quando a Terra vira um ponto (a mais de ~5 milhões de km)
  const fade = 1 - Math.min(Math.max((d / KM - 2e6) / 3e6, 0), 1);
  uniforms.uFade.value = fade;
  points.visible = fade > 0.01 && F.layers.solar !== false && show.cats.some(Boolean) && satsValidNow();
}

// Clique: satélite visível mais próximo do cursor
export function pick(project, x, y) {
  if (!points?.visible) return null;
  let best = null, bd = 9;
  for (const s of SAT.list) {
    if (!visible(s)) continue;
    const p = project(satPos(s));
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// Linha da órbita do satélite selecionado (uma volta, centrada no instante atual)
let orbitLine = null, orbitSat = null, orbitAt = 0;
export function setSelected(s) {
  orbitSat = s || null;
  orbitAt = -Infinity;
}
export function updateOrbitLine(localGroup, place) {
  if (!orbitSat || F.layers.orbits === false) { if (orbitLine) orbitLine.visible = false; return; }
  const t0 = F.date.getTime();
  if (Math.abs(t0 - orbitAt) > 60e3) {
    const s = orbitSat;
    if (s._n === undefined) prep(s);
    const P = TAU / s._n * 1000, pts = [];
    for (let k = 0; k <= 240; k++) pts.push(new THREE.Vector3(...satPosKm(s, t0 + (k / 240 - 0.5) * P)).multiplyScalar(KM));
    if (!orbitLine) {
      orbitLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x9ff0c4, transparent: true, opacity: 0.6, depthWrite: false }));
      orbitLine.frustumCulled = false;
      localGroup.add(orbitLine);
    }
    orbitLine.geometry.dispose();
    orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    orbitAt = t0;
  }
  orbitLine.visible = true;
  place(orbitLine, BODY.Earth.pos);
}
