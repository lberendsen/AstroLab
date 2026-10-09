// Planetário: ficar em pé na Terra, na Lua ou em Marte e ver o céu daquele lugar, na data simulada.
// A câmera é presa a um ponto da superfície (que gira e viaja com o planeta); o planeta some e entra no lugar
// um chão (hemisfério de baixo) e, onde há ar, um céu (hemisfério de cima) que clareia com o Sol.
// As linhas das constelações são segmentos 3D entre as estrelas de verdade: vistas daqui formam os desenhos;
// vistas de longe (camada "Constelações no espaço") mostram que as estrelas não estão juntas.
import * as THREE from 'three';
import * as A from 'astronomy-engine';
import { F, local, place, camera } from './engine.js';
import { DB, starPos } from './data.js';
import { BODY, BODIES, surfacePoint, ephDate } from './layers/solar.js';
import { SAT, satPosKm, satsValidNow } from './layers/sats.js';
import { showCraft } from './layers/craft.js';
import { showSB } from './layers/smallbodies.js';
import { nav, ground, flyTo, setOrbit, lookAtDir } from './nav.js';
import { bodyTarget } from './targets.js';
import { CONST_PT } from './link.js';
import { v3, KM, AU, DEG } from './astro.js';

export const PL = {
  active: false, pending: null, body: 'Earth', lat: -23.55, lon: -46.63, name: 'São Paulo', az: 0, alt: 25, fov: 70,
  show: { lines: true, names: true, altaz: false, eqecl: false, atmo: true, ground: true, space: false },
  daylight: 0,
};
export const CONST = { list: [] };
const ATMO = { Earth: 'earth', Mars: 'mars' };
const GROUND_COLOR = { Earth: [0.10, 0.13, 0.09], Moon: [0.42, 0.41, 0.40], Mars: [0.45, 0.24, 0.14] };
const M = 1e-3 * KM; // 1 metro em parsecs

// ---------------------------------------------------------------- locais
export const PRESETS = {
  Earth: [
    ['São Paulo', -23.55, -46.63], ['Rio de Janeiro', -22.91, -43.17], ['Brasília', -15.79, -47.88], ['Salvador', -12.97, -38.51], ['Fortaleza', -3.73, -38.52],
    ['Manaus', -3.12, -60.02], ['Belém', -1.46, -48.50], ['Recife', -8.05, -34.88], ['Curitiba', -25.43, -49.27], ['Porto Alegre', -30.03, -51.23],
    ['Deserto do Atacama (observatórios do Chile)', -24.63, -70.40], ['Mauna Kea (Havaí)', 19.82, -155.47], ['Lisboa', 38.72, -9.14], ['Nova York', 40.71, -74.01],
    ['Londres', 51.51, -0.13], ['Tóquio', 35.68, 139.69], ['Sydney', -33.87, 151.21], ['Quito (linha do Equador)', -0.18, -78.47],
    ['Polo Norte', 89.99, 0], ['Polo Sul', -89.99, 0],
  ],
  Moon: [['Base Tranquilidade (Apollo 11)', 0.674, 23.473], ['Polo Sul da Lua', -89.9, 0], ["Lado oculto (Chang'e 4)", -45.44, 177.6], ['Cratera Copérnico', 9.62, -20.08]],
  Mars: [['Cratera Jezero (Perseverance)', 18.47, 77.30], ['Cratera Gale (Curiosity)', -4.72, 137.37], ['Monte Olimpo', 18.65, -133.8], ['Polo Norte de Marte', 89.9, 0]],
};
function loadLoc() {
  try { const l = JSON.parse(localStorage.getItem('astrolab.loc')); if (l?.lat != null) { PL.lat = l.lat; PL.lon = l.lon; PL.name = l.name; } } catch { /* sem armazenamento */ }
}
loadLoc();
export function setLocation(body, lat, lon, name) {
  Object.assign(PL, { body, lat, lon, name });
  if (body === 'Earth') try { localStorage.setItem('astrolab.loc', JSON.stringify({ lat, lon, name })); } catch { /* sem armazenamento */ }
}

// ---------------------------------------------------------------- referencial local
let frame = null;
function computeFrame() {
  const sp = surfacePoint(PL.body, PL.lat, PL.lon, 0.0017); // olhos a 1,7 m
  const up = sp.normal;
  let east = v3.cross(sp.north, up);
  if (v3.len(east) < 1e-9) east = v3.cross([1, 0, 0], up); // nos polos
  east = v3.norm(east);
  const north = v3.cross(up, east);
  frame = { pos: sp.pos, up, east, north };
  return frame;
}
const dirFromAltAz = (alt, az) => {
  const a = alt * DEG, z = az * DEG, f = frame;
  return v3.add(v3.add(v3.scale(f.north, Math.cos(a) * Math.cos(z)), v3.scale(f.east, Math.cos(a) * Math.sin(z))), v3.scale(f.up, Math.sin(a)));
};
export function altAzOf(p) {
  if (!PL.active || !frame) return null;
  const d = v3.norm(v3.sub(p, frame.pos));
  return { alt: Math.asin(Math.max(-1, Math.min(1, v3.dot(d, frame.up)))) / DEG, az: (Math.atan2(v3.dot(d, frame.east), v3.dot(d, frame.north)) / DEG + 360) % 360 };
}
const CARD = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
export const azName = az => CARD[Math.round(az / 45) % 8];

// ---------------------------------------------------------------- malhas
let groundMesh, skyDome, gridLines, eqLines, constLines, built = false;
const skyUniforms = { uUp: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3() }, uKind: { value: 0 }, uOn: { value: 1 } };

export async function load() {
  try { CONST.list = await (await fetch('data/constellations.json')).json(); } catch { CONST.list = []; }
}

function hemisphere(lower) {
  // SphereGeometry: phi em torno de Y; theta de 0 (polo +Y) a π
  return new THREE.SphereGeometry(1, 96, 24, 0, Math.PI * 2, lower ? Math.PI / 2 : 0, Math.PI / 2);
}

export function build() {
  groundMesh = new THREE.Mesh(hemisphere(true), new THREE.MeshBasicMaterial({ color: 0x223322, side: THREE.BackSide }));
  groundMesh.renderOrder = 40;
  skyDome = new THREE.Mesh(hemisphere(false), new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
      uniform vec3 uUp, uSun; uniform float uKind, uOn; varying vec3 vW;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 v = normalize(vW);
        float h = max(dot(v, uUp), 0.0), sa = dot(uSun, uUp), cs = dot(v, uSun);
        float day = smoothstep(-0.16, 0.08, sa);                  // do crepúsculo náutico ao dia
        float horizon = pow(1.0 - h, 3.0);
        vec3 zen, hor, glow;
        if (uKind < 1.5) { zen = vec3(0.10, 0.28, 0.66); hor = vec3(0.62, 0.76, 0.93); glow = vec3(1.0, 0.55, 0.25); }   // Terra
        else { zen = vec3(0.42, 0.28, 0.19); hor = vec3(0.66, 0.47, 0.33); glow = vec3(0.35, 0.55, 0.95); }              // Marte: pôr do sol azul
        vec3 col = mix(zen, hor, horizon) * day;
        // crepúsculo: faixa colorida no horizonte do lado do Sol
        float dusk = exp(-pow(sa / 0.12, 2.0)) * pow(max(cs, 0.0), 2.0) * horizon;
        col += glow * dusk * 0.9;
        // halo em volta do Sol e o disco
        float halo = pow(max(cs, 0.0), 300.0) * 1.5 + pow(max(cs, 0.0), 12.0) * 0.25 * day;
        float disc = smoothstep(0.999986, 0.999992, cs);
        // em Marte a poeira fina espalha o azul para perto do Sol: o halo é azulado
        vec3 haloCol = uKind < 1.5 ? vec3(1.0, 0.95, 0.85) : vec3(0.55, 0.72, 1.0);
        if (uKind > 1.5) { float aure = pow(max(cs, 0.0), 25.0) * 0.8; col = mix(col, glow * (0.5 + day * 0.5), aure); }
        col += haloCol * halo * step(0.0, sa + 0.01) + vec3(1.0, 0.97, 0.9) * disc * 6.0 * step(0.0, sa + 0.01);
        float a = clamp(day * 0.94 + dusk * 0.6 + halo + disc, 0.0, 1.0) * uOn;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.BackSide,
  }));
  skyDome.renderOrder = 50;
  // grade de altura e azimute (no referencial local) e círculos do equador celeste e da eclíptica (no J2000)
  const gp = [];
  const circle = (fn, n = 180) => { for (let k = 0; k < n; k++) gp.push(...fn(k / n), ...fn((k + 1) / n)); };
  for (const alt of [0, 15, 30, 45, 60, 75]) circle(t => { const a = alt * DEG, z = t * 2 * Math.PI; return [Math.cos(a) * Math.cos(z), Math.sin(a), Math.cos(a) * Math.sin(z)]; });
  for (let az = 0; az < 360; az += 30) circle(t => { const a = t * Math.PI / 2, z = az * DEG; return [Math.cos(a) * Math.cos(z), Math.sin(a), Math.cos(a) * Math.sin(z)]; }, 30);
  gridLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)),
    new THREE.LineBasicMaterial({ color: 0x6f9be0, transparent: true, opacity: 0.35, depthWrite: false }));
  const ep = [], ec = [], eps = 23.4393 * DEG;
  for (let k = 0; k < 360; k++) {
    const a = k * DEG, b = (k + 1) * DEG;
    ep.push(Math.cos(a), Math.sin(a), 0, Math.cos(b), Math.sin(b), 0);
    ec.push(Math.cos(a), Math.sin(a) * Math.cos(eps), Math.sin(a) * Math.sin(eps), Math.cos(b), Math.sin(b) * Math.cos(eps), Math.sin(b) * Math.sin(eps));
  }
  const eqGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([...ep, ...ec], 3));
  eqGeo.setAttribute('color', new THREE.Float32BufferAttribute([...ep.map((_, i) => [0.45, 0.75, 1][i % 3]), ...ec.map((_, i) => [1, 0.8, 0.35][i % 3])], 3));
  eqLines = new THREE.LineSegments(eqGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false }));
  // constelações: segmentos entre posições 3D de estrelas
  const nSeg = CONST.list.reduce((s, c) => s + c.segs.length, 0);
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nSeg * 3), 3).setUsage(THREE.DynamicDrawUsage));
  cg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  constLines = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x5f8fd0, transparent: true, opacity: 0.55, depthWrite: false }));
  for (const o of [groundMesh, skyDome, gridLines, eqLines, constLines]) { o.frustumCulled = false; o.visible = false; local.add(o); }
  gridLines.renderOrder = eqLines.renderOrder = 55;
  constLines.renderOrder = 56;
  built = true;
  ground.update = groundUpdate;
}

// ---------------------------------------------------------------- entrar e sair
let saved = null;
export function enter(body = PL.body, lat = PL.lat, lon = PL.lon, name = PL.name) {
  if (PL.active) exit(true); // trocando de lugar: sai sem voar para longe
  setLocation(body, lat, lon, name);
  // voo até 3 km acima do lugar; ao chegar, a câmera "pousa"
  const tgt = {
    id: 'pl:' + name, name, kind: 'view', radius: 0,
    pos: () => surfacePoint(PL.body, PL.lat, PL.lon).pos, viewDist: 3 * KM,
    arriveDir: () => surfacePoint(PL.body, PL.lat, PL.lon).normal,
    arriveUp: () => surfacePoint(PL.body, PL.lat, PL.lon).north,
  };
  nav.mode = 'orbit';
  flyTo(tgt);
  PL.pending = true;
}

function land() {
  PL.pending = false; PL.active = true;
  saved = { orbits: F.layers.orbits, trails: showCraft.trails, probes: showCraft.probes, surface: showCraft.surface, ast: showSB.asteroids, com: showSB.comets };
  F.layers.orbits = false; showCraft.trails = false; showCraft.probes = false; showCraft.surface = false; showSB.asteroids = false; showSB.comets = false;
  nav.mode = 'ground';
  F.ground = true;
  computeFrame();
  // começa olhando para o objeto mais vistoso acima do horizonte (Lua ou planeta), ou para o meridiano
  const best = whatsUp().find(o => o.kind === 'body' && o.key !== 'Sun' && o.alt > 8);
  PL.az = best ? best.az : PL.lat < 0 ? 180 : 0;
  PL.alt = best ? Math.min(Math.max(best.alt, 15), 50) : 25;
  PL.fov = 70;
  onChange?.();
}

export function exit(quiet = false) {
  if (!PL.active && !PL.pending) return;
  if (quiet) {
    PL.active = false; F.ground = false;
    if (saved) { F.layers.orbits = saved.orbits; showCraft.trails = saved.trails; showCraft.probes = saved.probes; showCraft.surface = saved.surface; showSB.asteroids = saved.ast; showSB.comets = saved.com; saved = null; }
    BODY[PL.body].group.visible = true;
    return;
  }
  const was = PL.active;
  PL.active = false; PL.pending = false; F.ground = false; F.fovOverride = null;
  if (saved) { F.layers.orbits = saved.orbits; showCraft.trails = saved.trails; showCraft.probes = saved.probes; showCraft.surface = saved.surface; showSB.asteroids = saved.ast; showSB.comets = saved.com; saved = null; }
  for (const o of [groundMesh, skyDome, gridLines, eqLines]) o.visible = false;
  BODY[PL.body].group.visible = true;
  if (was && nav.mode === 'ground') { nav.mode = 'orbit'; const t = bodyTarget(PL.body); setOrbit(t); flyTo(t); }
  onChange?.();
}
let onChange = null;
export const setOnChange = f => { onChange = f; };

// ---------------------------------------------------------------- câmera em pé
function groundUpdate(dt, rx, ry, zoom) {
  if (!PL.active) return;
  computeFrame();
  const k = PL.fov / 60;
  PL.az = (PL.az - rx * 57.3 * 0.9 * k + 360) % 360;
  PL.alt = Math.max(-30, Math.min(89.5, PL.alt + ry * 57.3 * 0.9 * k));
  if (Math.abs(zoom) > 1e-5) PL.fov = Math.max(1, Math.min(110, PL.fov * Math.exp(zoom * dt * 3)));
  F.cam = frame.pos;
  camera.quaternion.copy(lookAtDir(dirFromAltAz(PL.alt, PL.az), new THREE.Vector3(...frame.up)));
  F.fovOverride = PL.fov;
}
export function lookAt(p) {
  const aa = altAzOf(p);
  if (aa) { PL.az = aa.az; PL.alt = Math.max(-5, Math.min(85, aa.alt)); }
}

// ---------------------------------------------------------------- quadro
const placeAtCam = (o, radiusPc, quat) => { place(o, F.cam); o.scale.setScalar(radiusPc); if (quat) o.quaternion.copy(quat); else o.quaternion.identity(); };
const _q = new THREE.Quaternion();
export function update() {
  if (!built) return;
  // um voo iniciado por outra ação tira do modo em pé
  if (PL.active && (nav.mode !== 'ground' || nav.flight)) exit();
  if (PL.pending && !nav.flight) land();
  const on = PL.active;
  // constelações também no espaço, se pedido
  const linesOn = (on && PL.show.lines) || PL.show.space;
  constLines.visible = linesOn;
  if (linesOn) updateConstLines(on ? 1 - PL.daylight * 0.9 : 1);
  if (!on) { PL.daylight = 0; return; }
  computeFrame();
  F.cam = frame.pos;
  BODY[PL.body].group.visible = false;
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...frame.up));
  // chão: iluminado pelo Sol
  const sunDir = v3.norm(v3.scale(frame.pos, -1));
  const sunAlt = v3.dot(sunDir, frame.up);
  const atmo = ATMO[PL.body];
  const lightLevel = atmo ? 0.04 + 0.96 * Math.min(1, Math.max(0, (sunAlt + 0.1) / 0.35)) : (sunAlt > 0 ? 0.25 + 0.75 * Math.min(1, sunAlt * 4) : 0.02);
  const gc = GROUND_COLOR[PL.body] || [0.3, 0.3, 0.3];
  groundMesh.material.color.setRGB(gc[0] * lightLevel, gc[1] * lightLevel, gc[2] * lightLevel);
  groundMesh.visible = PL.show.ground;
  placeAtCam(groundMesh, 1000 * M, _q);
  // céu
  skyDome.visible = !!atmo && PL.show.atmo;
  skyUniforms.uKind.value = atmo === 'mars' ? 2 : 1;
  skyUniforms.uUp.value.set(...frame.up);
  skyUniforms.uSun.value.set(...sunDir);
  placeAtCam(skyDome, 900 * M, _q);
  PL.daylight = skyDome.visible ? Math.min(1, Math.max(0, (sunAlt + 0.16) / 0.24)) : 0;
  // grades
  gridLines.visible = PL.show.altaz;
  if (gridLines.visible) {
    // a grade foi gerada com Y para cima e X para o norte, Z para o leste
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...frame.north), new THREE.Vector3(...frame.up), new THREE.Vector3(...frame.east));
    placeAtCam(gridLines, 500 * M, new THREE.Quaternion().setFromRotationMatrix(m));
  }
  eqLines.visible = PL.show.eqecl;
  if (eqLines.visible) placeAtCam(eqLines, 500 * M);
}

let lastConstT = -1;
function updateConstLines(opacity) {
  constLines.material.opacity = 0.55 * opacity;
  const pos = constLines.geometry.attributes.position.array;
  let k = 0;
  // no espaço, com um filtro (ex.: Órion de lado), só a constelação escolhida; as outras viram segmentos nulos
  const only = !PL.active && PL.show.only;
  for (const c of CONST.list) for (const i of c.segs) {
    if (only && c.abbr !== only) { pos[k++] = 0; pos[k++] = 0; pos[k++] = 0; continue; }
    const p = starPos(i);
    pos[k++] = p[0] - F.cam[0]; pos[k++] = p[1] - F.cam[1]; pos[k++] = p[2] - F.cam[2];
  }
  constLines.geometry.attributes.position.needsUpdate = true;
  place(constLines, F.cam); // os vértices já são relativos à câmera
  constLines.position.set(0, 0, 0);
  void lastConstT;
}

// ---------------------------------------------------------------- rótulos
const CARD_LBL = [['N', 0], ['NE', 45], ['L', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315]];
export function labelCandidates() {
  const out = [];
  if (PL.active && frame) {
    for (const [t, az] of CARD_LBL) out.push({ id: 'card:' + t, pos: v3.add(F.cam, v3.scale(dirFromAltAz(1.5, az), 1e-6)), name: t, cls: 'card', prio: 800, make: () => null });
  }
  if ((PL.active && PL.show.names) || PL.show.space) {
    for (const c of CONST.list) {
      if (!c.segs.length || (!PL.active && PL.show.only && c.abbr !== PL.show.only)) continue;
      let sx = 0, sy = 0, sz = 0;
      const seen = new Set();
      for (const i of c.segs) {
        if (seen.has(i)) continue; seen.add(i);
        const d = v3.norm(v3.sub(starPos(i), F.cam)); sx += d[0]; sy += d[1]; sz += d[2];
      }
      const dir = v3.norm([sx, sy, sz]);
      out.push({ id: 'const:' + c.abbr, pos: v3.add(F.cam, v3.scale(dir, PL.active ? 1e-6 : 30)), name: CONST_PT[c.abbr] || c.name, cls: 'const', prio: 45, make: () => null });
    }
  }
  return out;
}
// No modo em pé: só o que faz sentido no céu, e acima do horizonte
const SKY_CLS = new Set(['planet', 'moon', 'star', 'const', 'card', 'sel', 'craft', 'deep', 'exo']);
export function labelFilter(c) {
  if (!PL.active) return true;
  if (!SKY_CLS.has(c.cls)) return false;
  if (c.cls === 'card') return true;
  // de dia, só o que se vê de dia (Sol, Lua, planetas brilhantes) e o que estiver selecionado
  if (PL.daylight > 0.6 && (c.cls === 'const' || c.cls === 'star' || c.cls === 'deep' || c.cls === 'exo')) return false;
  const aa = altAzOf(c.pos);
  return aa && aa.alt > -0.5;
}

// ---------------------------------------------------------------- o que está no céu
function apparentMag(i) { const d = v3.dist(starPos(i), F.cam); return DB.stars.absmag[i] + 5 * Math.log10(d / 10); }
export function whatsUp() {
  if (!frame) computeFrame();
  const out = [];
  const add = (o, p) => { const aa = altAzOf(p) || (() => { const d = v3.norm(v3.sub(p, frame.pos)); return { alt: Math.asin(v3.dot(d, frame.up)) / DEG, az: (Math.atan2(v3.dot(d, frame.east), v3.dot(d, frame.north)) / DEG + 360) % 360 }; })(); out.push({ ...o, alt: aa.alt, az: aa.az, pos: p }); };
  for (const b of BODIES) {
    if (b.key === PL.body || (b.parent && b.parent !== PL.body && b.key !== 'Moon')) continue;
    if (b.parent === 'Jupiter') continue;
    add({ kind: 'body', key: b.key, name: b.name, mag: null }, b.pos);
  }
  for (const [i, inf] of DB.stars.info) {
    // só estrelas do catálogo HYG (as acrescentadas por hospedarem exoplanetas não têm brilho confiável)
    if (i >= DB.stars.nHyg || !inf.names[0] || /^(HIP|HD|Gl|GJ) /.test(inf.names[0])) continue;
    const m = apparentMag(i);
    if (m < 1.6) add({ kind: 'star', idx: i, name: inf.names[0], mag: m }, starPos(i));
  }
  for (const o of DB.curated) if (/^M \d+$|^NGC (5139|104|3372)$|^LMC$|^SMC$/.test(o.id) && ['neb', 'glob', 'open', 'gal', 'pn'].includes(o.type) && o.d < 2e7) add({ kind: 'deep', cur: o, name: o.name, mag: null }, o.xyz);
  if (PL.body === 'Earth' && satsValidNow()) for (const s of SAT.list) if (s.notable && /ISS|CSS|HST/.test(s.name)) add({ kind: 'sat', sat: s, name: s.craft?.name || s.name, mag: null }, v3.add(BODY.Earth.pos, v3.scale(satPosKm(s), KM)));
  return out.sort((a, b) => (b.kind === 'body') - (a.kind === 'body') || (a.mag ?? 99) - (b.mag ?? 99));
}

// Nascer e pôr (só na Terra; Astronomy Engine)
export function riseSet(key) {
  if (PL.body !== 'Earth') return null;
  const obs = new A.Observer(PL.lat, PL.lon, 0), t = A.MakeTime(ephDate());
  const r = A.SearchRiseSet(A.Body[key], obs, +1, t, 1), s = A.SearchRiseSet(A.Body[key], obs, -1, t, 1);
  return { rise: r?.date, set: s?.date };
}

// ---------------------------------------------------------------- passagens de estações espaciais (só na Terra)
export function stationPasses(hours = 72) {
  if (PL.body !== 'Earth' || !satsValidNow()) return [];
  const list = SAT.list.filter(s => /^(ISS \(ZARYA\)|CSS \(TIANHE\)|HST)$/.test(s.name));
  const obs = new A.Observer(PL.lat, PL.lon, 0), RE = 6378.137;
  const t0 = F.date.getTime(), step = 20e3, out = [];
  // pré-calcula observador e Sol por passo (comuns a todos os satélites)
  const samples = [];
  for (let t = t0; t < t0 + hours * 3600e3; t += step) {
    const at = A.MakeTime(new Date(t));
    const o = A.ObserverVector(at, obs, false), s = A.GeoVector(A.Body.Sun, at, false);
    const ov = [o.x * 149597870.7, o.y * 149597870.7, o.z * 149597870.7], up = v3.norm(ov);
    const sv = v3.norm([s.x, s.y, s.z]);
    samples.push({ t, ov, up, sun: sv, dark: v3.dot(sv, up) < -0.105 }); // Sol 6° abaixo do horizonte
  }
  for (const s of list) {
    let cur = null;
    for (const sm of samples) {
      const p = satPosKm(s, sm.t), d = v3.sub(p, sm.ov), dn = v3.norm(d);
      const alt = Math.asin(v3.dot(dn, sm.up)) / DEG;
      if (alt > 10) {
        const along = v3.dot(p, sm.sun), perp = v3.len(v3.sub(p, v3.scale(sm.sun, along)));
        const lit = along > 0 || perp > RE;
        const vis = lit && sm.dark;
        const east = v3.norm(v3.cross([0, 0, 1], sm.up)), north = v3.cross(sm.up, east);
        const az = (Math.atan2(v3.dot(dn, east), v3.dot(dn, north)) / DEG + 360) % 360;
        if (!cur) cur = { sat: s, start: sm.t, startAz: az, maxAlt: alt, maxT: sm.t, visible: false };
        if (alt > cur.maxAlt) { cur.maxAlt = alt; cur.maxT = sm.t; }
        cur.visible = cur.visible || vis; cur.end = sm.t; cur.endAz = az;
      } else if (cur) { out.push(cur); cur = null; }
    }
  }
  return out.filter(p => p.visible).sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------- conjunções (vistas da Terra, próximos 12 meses)
export function conjunctions(days = 365) {
  const keys = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const t0 = ephDate().getTime(), step = 6 * 3600e3, n = Math.floor(days * 4);
  const dirs = keys.map(() => []);
  for (let k = 0; k < n; k++) {
    const at = A.MakeTime(new Date(t0 + k * step));
    keys.forEach((key, j) => { const g = A.GeoVector(A.Body[key], at, true); dirs[j].push(v3.norm([g.x, g.y, g.z])); });
  }
  const sunDir = k => { const g = A.GeoVector(A.Body.Sun, A.MakeTime(new Date(t0 + k * step)), true); return v3.norm([g.x, g.y, g.z]); };
  const out = [];
  for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
    const lim = a === 0 ? 3 : 2;
    const sep = k => Math.acos(Math.min(1, v3.dot(dirs[a][k], dirs[b][k]))) / DEG;
    for (let k = 1; k < n - 1; k++) {
      const s = sep(k);
      if (s < lim && s <= sep(k - 1) && s < sep(k + 1)) {
        const elong = Math.acos(Math.min(1, v3.dot(dirs[b][k], sunDir(k)))) / DEG;
        if (elong < 15) continue; // perto demais do Sol para ver
        out.push({ a: keys[a], b: keys[b], t: t0 + k * step, sep: s, elong });
      }
    }
  }
  return out.sort((x, y) => x.t - y.t);
}
void AU;
