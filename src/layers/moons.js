// As outras luas do Sistema Solar (184, JPL Horizons): elementos osculadores numa época recente, propagados por Kepler
// em volta do planeta, no referencial equatorial J2000. As grandes têm mapa real da superfície (sondas Voyager,
// Galileo, Cassini, New Horizons) e giram em rotação sincronizada: a mesma face sempre voltada para o planeta.
import * as THREE from 'three';
import { F, local, place, loadTex } from '../engine.js';
import { BODY } from './solar.js';
import { KM, v3 } from '../astro.js';

export const MOONS = [];
const JD_UNIX = 2440587.5;
export const PLANET_PT = { Mars: 'Marte', Jupiter: 'Júpiter', Saturn: 'Saturno', Uranus: 'Urano', Neptune: 'Netuno', Pluto: 'Plutão' };
const MAP_KEY = { 601: 'mimas', 602: 'enceladus', 603: 'tethys', 604: 'dione', 605: 'rhea', 606: 'titan', 608: 'iapetus', 705: 'miranda', 701: 'ariel', 702: 'umbriel', 703: 'titania', 704: 'oberon', 801: 'triton', 901: 'charon' };
export const SCOPE_KEY = { 606: 'Titan', 602: 'Enceladus', 601: 'Mimas', 603: 'Tethys', 604: 'Dione', 605: 'Rhea', 608: 'Iapetus', 705: 'Miranda', 701: 'Ariel', 702: 'Umbriel', 703: 'Titania', 704: 'Oberon', 801: 'Triton', 901: 'Charon' };
export const MOON_DESC = {
  401: 'A maior lua de Marte, a apenas 6.000 km da superfície. Está caindo devagar: em uns 50 milhões de anos vai se despedaçar num anel.',
  402: 'A lua pequena de Marte, com 12 km. Vista de Marte, parece uma estrela brilhante.',
  505: 'A lua mais avermelhada do Sistema Solar, dentro da radiação intensa de Júpiter.',
  601: 'A cratera Herschel, de 130 km, faz Mimas parecer a Estrela da Morte.',
  602: 'Do polo sul saem jatos de água salgada de um oceano escondido, com moléculas orgânicas. Um dos lugares mais promissores para procurar vida.',
  603: 'Feita quase toda de gelo de água, com um cânion de 2.000 km de comprimento.',
  604: 'Penhascos de gelo brilhantes e talvez um oceano interno.',
  605: 'A segunda maior lua de Saturno, um bloco de gelo e rocha cheio de crateras.',
  606: 'Maior que Mercúrio, com uma atmosfera mais densa que a da Terra, chuva de metano e lagos de hidrocarbonetos. A sonda Huygens pousou aqui em 2005, e a Dragonfly chega em 2034.',
  608: 'Um lado escuro como carvão e o outro branco como neve, e uma cordilheira de 20 km de altura bem no equador.',
  609: 'Gira ao contrário: provavelmente um objeto do Cinturão de Kuiper capturado por Saturno.',
  705: 'Tem penhascos de até 20 km de altura, os mais altos conhecidos.',
  701: 'A lua mais brilhante de Urano, com vales de gelo.',
  703: 'A maior lua de Urano.',
  801: 'Gira ao contrário da rotação de Netuno, sinal de que foi capturada. Tem gêiseres de nitrogênio, fotografados pela Voyager 2 em 1989.',
  901: 'Tão grande em relação a Plutão (metade do tamanho) que os dois giram em volta de um ponto entre eles. Tem uma calota polar avermelhada.',
};

export async function load() {
  try { const list = await (await fetch('data/moons.json')).json(); for (const m of list) MOONS.push({ ...m, pos: [0, 0, 0] }); } catch { /* sem luas */ }
}

function solveE(M, e) { let E = M; for (let k = 0; k < 12; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
// km, relativo ao planeta
export function moonRel(m, jd) {
  const M = (m.ma + m.n * (jd - m.jd)) % (2 * Math.PI);
  const e = Math.min(m.e, 0.95), E = solveE(M, e);
  const x = m.a * (Math.cos(E) - e), y = m.a * Math.sqrt(1 - e * e) * Math.sin(E);
  const co = Math.cos(m.om), so = Math.sin(m.om), cw = Math.cos(m.w), sw = Math.sin(m.w), ci = Math.cos(m.i), si = Math.sin(m.i);
  return [(co * cw - so * sw * ci) * x + (-co * sw - so * cw * ci) * y, (so * cw + co * sw * ci) * x + (-so * sw + co * cw * ci) * y, (sw * si) * x + (cw * si) * y];
}
export const moonRadius = m => (m.r || 2) * KM;
export const moonPeriodDays = m => 2 * Math.PI / m.n;

// ---------------------------------------------------------------- desenho
let points, posAttr, colAttr;
const meshes = new Map();
const _m = new THREE.Matrix4();
export function build() {
  const n = MOONS.length;
  const g = new THREE.BufferGeometry();
  posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3); posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr = new THREE.BufferAttribute(new Float32Array(n), 1); colAttr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', posAttr); g.setAttribute('vis', colAttr);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  points = new THREE.Points(g, new THREE.ShaderMaterial({
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
      attribute float vis; varying float vV;
      void main() { vV = vis; gl_PointSize = 3.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        if (vis < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
      varying float vV;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 p = gl_PointCoord * 2.0 - 1.0; if (dot(p, p) > 1.0) discard;
        gl_FragColor = vec4(vec3(0.85, 0.82, 0.75) * vV, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  local.add(points);
}

function meshFor(m) {
  let mesh = meshes.get(m.id);
  if (mesh) return mesh;
  const key = MAP_KEY[m.id];
  const mat = new THREE.MeshLambertMaterial(key ? { map: loadTex(`textures/moons/${key}.jpg`) } : { color: 0x9a9288 });
  mesh = new THREE.Mesh(new THREE.SphereGeometry(1, key ? 96 : 32, key ? 48 : 16), mat);
  // luas sem forma conhecida e pequenas: um pouco irregulares
  if (!key && (m.r || 0) < 150) mesh.scale.set(1.25, 0.85, 1);
  mesh.userData.base = mesh.scale.clone();
  local.add(mesh);
  meshes.set(m.id, mesh);
  return mesh;
}

// Rotação sincronizada: polo = normal da órbita; longitude 0 voltada para o planeta
export function syncOrient(obj, toPlanet, normal) {
  const pole = v3.norm(normal), pm = v3.norm(v3.sub(toPlanet, v3.scale(pole, v3.dot(toPlanet, pole))));
  const zl = v3.cross(pm, pole);
  _m.makeBasis(new THREE.Vector3(...pm), new THREE.Vector3(...pole), new THREE.Vector3(...zl));
  obj.quaternion.setFromRotationMatrix(_m);
}

export function update() {
  if (!points) return;
  const jd = F.date.getTime() / 864e5 + JD_UNIX;
  const on = F.layers.solar !== false && !F.ground;
  const pa = posAttr.array, va = colAttr.array;
  const want = new Set();
  MOONS.forEach((m, k) => {
    const P = BODY[m.planet];
    const rel = moonRel(m, jd);
    m.pos = v3.add(P.pos, v3.scale(rel, KM));
    pa[k * 3] = m.pos[0] - F.cam[0]; pa[k * 3 + 1] = m.pos[1] - F.cam[1]; pa[k * 3 + 2] = m.pos[2] - F.cam[2];
    const dP = v3.dist(F.cam, P.pos);
    m.nearPlanet = dP < 800 * P.radius;
    va[k] = on && m.nearPlanet ? 0.8 : 0;
    const d = v3.dist(F.cam, m.pos), R = moonRadius(m);
    if (on && d < 3000 * R) want.add(m.id);
  });
  posAttr.needsUpdate = colAttr.needsUpdate = true;
  points.visible = on;
  for (const [id, mesh] of meshes) if (!want.has(id)) mesh.visible = false;
  for (const id of want) {
    const m = MOONS.find(x => x.id === id), mesh = meshFor(m), R = moonRadius(m);
    mesh.visible = true;
    place(mesh, m.pos);
    mesh.scale.copy(mesh.userData.base).multiplyScalar(R);
    const rel = moonRel(m, jd), rel2 = moonRel(m, jd + 1e-3);
    syncOrient(mesh, v3.scale(rel, -1), v3.cross(rel, v3.sub(rel2, rel)));
  }
}

// Superfície mais próxima (para a escala da cena)
export function nearestSurface() {
  let best = Infinity;
  for (const m of MOONS) if (m.nearPlanet) best = Math.min(best, v3.dist(F.cam, m.pos) - moonRadius(m));
  return best;
}
