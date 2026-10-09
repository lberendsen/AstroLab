// Ao chegar perto de uma estrela: esfera com o raio estimado e, se houver, os exoplanetas conhecidos
// orbitando com raio e semieixo maior medidos. A inclinação das órbitas é ilustrativa (exceto que planetas
// detectados por trânsito são desenhados de perfil para a Terra, como precisam estar).
import * as THREE from 'three';
import { F, local, place } from '../engine.js';
import { DB, starPos, starRadiusSun, STARTIME } from '../data.js';
import { AU, R_SUN, R_EARTH, v3, tempToRGB } from '../astro.js';
import { GLOW_TEX } from './solar.js';

export const near = { star: -1, dist: Infinity, surface: Infinity };
let sphere, glow, sysGroup, sysHost = null;
export let planets = []; // { name, host, pl, pos, radius, mesh }

const starMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 } },
  vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vP = position;
      gl_Position = projectionMatrix * viewMatrix * w;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
    uniform vec3 uColor; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
    float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    float noise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
    void main() {
      #include <logdepthbuf_fragment>
      float mu = abs(dot(vN, vV));
      float limb = 0.4 + 0.6 * pow(mu, 0.5);              // escurecimento de borda
      float gran = 0.85 + 0.3 * noise(vP * 40.0 + uTime * 0.05) * noise(vP * 9.0 - uTime * 0.02);
      gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35) * limb * gran * 1.3, 1.0);
    }`,
});

export function build() {
  sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), starMat);
  glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sphere.visible = glow.visible = false;
  local.add(sphere, glow);
  sysGroup = new THREE.Group();
  local.add(sysGroup);
}

// Busca a estrela mais próxima por força bruta (é rápido: ~115 mil pontos), a cada poucos quadros
let frame = 0;
function findNearest() {
  const p = DB.stars.pos, v = DB.stars.vel, yr = STARTIME.years, n = DB.stars.n, [cx, cy, cz] = F.cam;
  let best = -1, bd = Infinity;
  for (let i = 0; i < n; i++) {
    const dx = p[i * 3] + v[i * 3] * yr - cx, dy = p[i * 3 + 1] + v[i * 3 + 1] * yr - cy, dz = p[i * 3 + 2] + v[i * 3 + 2] * yr - cz;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export function forceNearest() { frame = 0; }

function hashf(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; }

function kepler(M, e) {
  let E = M;
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

function planetColor(pl) {
  const t = pl.t || 300;
  if (pl.r > 6) return t > 900 ? [1.0, 0.55, 0.35] : [0.85, 0.75, 0.6];   // gigantes: quentes avermelhados, frios em faixas creme
  if (pl.r > 2.2) return [0.55, 0.75, 0.95];                                // mini-netunos
  if (t > 700) return [0.75, 0.35, 0.2];                                    // rochosos derretidos
  if (t > 180 && t < 320) return [0.45, 0.65, 0.55];                        // zona temperada
  return [0.7, 0.65, 0.6];
}

function buildSystem(host) {
  for (const c of [...sysGroup.children]) { sysGroup.remove(c); c.geometry?.dispose(); c.material?.dispose(); }
  planets = [];
  sysHost = host;
  if (!host) return;
  // plano orbital: perpendicular a uma direção que contém a linha de visada da Terra (de perfil)
  const los = v3.norm(host.xyz);
  let u = v3.norm(v3.cross(los, [0, 0, 1]));
  const w = v3.norm(v3.cross(los, u));
  const tilt = hashf(host.name) * Math.PI;
  const n = v3.add(v3.scale(u, Math.cos(tilt)), v3.scale(w, Math.sin(tilt))); // normal ⟂ linha de visada
  const e1 = los, e2 = v3.cross(n, los);
  for (const pl of host.planets) {
    if (!pl.a) continue;
    const rE = pl.r || (pl.m ? Math.min(Math.pow(pl.m, 0.55), 13) : 1.5);
    const radius = rE * R_EARTH;
    const c = planetColor({ ...pl, r: rE });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshLambertMaterial({ color: new THREE.Color(...c) }));
    mesh.scale.setScalar(radius);
    sysGroup.add(mesh);
    // órbita (elipse com a excentricidade medida)
    const pts = [];
    const a = pl.a * AU, e = Math.min(pl.e || 0, 0.95), ph = hashf(pl.n) * 2 * Math.PI;
    for (let k = 0; k <= 256; k++) {
      const E = k / 256 * 2 * Math.PI;
      const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const cw = Math.cos(ph), sw = Math.sin(ph);
      pts.push(new THREE.Vector3(...v3.add(v3.scale(e1, x * cw - y * sw), v3.scale(e2, x * sw + y * cw))));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fe0b0, transparent: true, opacity: 0.5, depthWrite: false }));
    line.frustumCulled = false;
    sysGroup.add(line);
    planets.push({ pl, host, a, e, ph, e1, e2, radius, rE, mesh, line, pos: [0, 0, 0], name: pl.n });
  }
}

export function update(dt) {
  if (frame++ % 8 === 0) {
    near.star = findNearest();
    const host = DB.stars.hostByStar.get(near.star) || null;
    if (host !== sysHost) buildSystem(host);
  }
  const i = near.star;
  if (i < 0 || i === DB.stars.sunIndex) { sphere.visible = glow.visible = false; near.surface = Infinity; setSysVisible(false); return; }
  const p = starPos(i);
  const r = starRadiusSun(i) * R_SUN;
  near.dist = v3.dist(F.cam, p);
  near.surface = near.dist - r;
  near.pos = p; near.radius = r;
  const vis = near.dist < 2e5 * r;
  sphere.visible = glow.visible = vis;
  setSysVisible(near.dist < 0.5 && F.layers.exoplanets !== false);
  if (!vis && !sysGroup.visible) return;
  place(sphere, p); sphere.scale.setScalar(r);
  place(glow, p); glow.scale.setScalar(r * 9);
  const c = tempToRGB(DB.stars.teff[i]);
  starMat.uniforms.uColor.value.setRGB(...c);
  starMat.uniforms.uTime.value += dt;
  glow.material.color.setRGB(...c.map(x => 0.5 + 0.5 * x));
  // luz da estrela para os planetas: reaproveita a luz do grupo local se o Sol estiver longe
  placePlanets(p);
}

function setSysVisible(v) { sysGroup.visible = v; }

let starLight;
function placePlanets(starP) {
  if (!sysHost || !sysGroup.visible) return;
  if (!starLight) { starLight = new THREE.PointLight(0xffffff, 3, 0, 0); sysGroup.add(starLight); }
  sysGroup.position.set(starP[0] - F.cam[0], starP[1] - F.cam[1], starP[2] - F.cam[2]);
  const days = F.date.getTime() / 8.64e7;
  for (const P of planets) {
    const per = P.pl.p || 365.25 * Math.pow(P.a / AU, 1.5);
    const M = 2 * Math.PI * (days / per) + P.ph;
    const E = kepler(M % (2 * Math.PI), P.e);
    const x = P.a * (Math.cos(E) - P.e), y = P.a * Math.sqrt(1 - P.e * P.e) * Math.sin(E);
    const cw = Math.cos(P.ph), sw = Math.sin(P.ph);
    const rel = v3.add(v3.scale(P.e1, x * cw - y * sw), v3.scale(P.e2, x * sw + y * cw));
    P.mesh.position.set(...rel);
    P.pos = v3.add(starP, rel);
    P.line.visible = v3.dist(F.cam, P.pos) > 300 * P.radius;
  }
}

export const currentHost = () => (sysGroup?.visible ? sysHost : null);
