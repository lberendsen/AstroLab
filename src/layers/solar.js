// Sistema Solar com efemérides reais (Astronomy Engine): posições heliocêntricas no referencial equatorial J2000,
// eixos de rotação e ângulo de rotação da IAU. Tamanhos em escala real.
import * as THREE from 'three';
import * as A from 'astronomy-engine';
import { F, local, place, loadTex } from '../engine.js';
import { AU, KM, v3 } from '../astro.js';

const T = 'textures/';
export const BODIES = [
  { key: 'Sun', name: 'Sol', kind: 'sun', r: 695700, tex: '2k_sun.jpg', color: 0xffe9b0, desc: 'Nossa estrela: uma anã amarela do tipo G2V com 4,6 bilhões de anos.' },
  { key: 'Mercury', name: 'Mercúrio', kind: 'planet', r: 2439.7, tex: '2k_mercury.jpg', period: 87.97, orbit: 0x9a8f86, desc: 'O menor planeta e o mais próximo do Sol. Um ano lá dura 88 dias.' },
  { key: 'Venus', name: 'Vênus', kind: 'planet', r: 6051.8, tex: '2k_venus_atmosphere.jpg', period: 224.7, orbit: 0xd9b16b, atmo: 0xffd9a0, desc: 'Coberto de nuvens de ácido sulfúrico, com 465 °C na superfície. Gira ao contrário.' },
  { key: 'Earth', name: 'Terra', kind: 'planet', r: 6371, tex: '2k_earth_daymap.jpg', clouds: '2k_earth_clouds.jpg', period: 365.256, orbit: 0x5fa8ff, atmo: 0x6fb2ff, desc: 'Você está aqui.' },
  { key: 'Moon', name: 'Lua', kind: 'moon', parent: 'Earth', r: 1737.4, tex: '2k_moon.jpg', period: 27.32, orbit: 0x9c9c9c, desc: 'Nosso único satélite natural, a 384 mil km da Terra.' },
  { key: 'Mars', name: 'Marte', kind: 'planet', r: 3389.5, tex: '2k_mars.jpg', period: 686.98, orbit: 0xe2734a, atmo: 0xe8a080, desc: 'O planeta vermelho. Tem o Monte Olimpo, o maior vulcão conhecido.' },
  { key: 'Jupiter', name: 'Júpiter', kind: 'planet', r: 69911, flat: 0.06487, tex: '2k_jupiter.jpg', period: 4332.6, orbit: 0xd8b48a, desc: 'O gigante gasoso. A Grande Mancha Vermelha é uma tempestade maior que a Terra.' },
  { key: 'Io', name: 'Io', kind: 'moon', parent: 'Jupiter', r: 1821.6, color: 0xe8d36a, period: 1.769, orbit: 0xb0a060, desc: 'O corpo com mais vulcões ativos do Sistema Solar.' },
  { key: 'Europa', name: 'Europa', kind: 'moon', parent: 'Jupiter', r: 1560.8, color: 0xd9cbb0, period: 3.551, orbit: 0xb0a080, desc: 'Esconde um oceano de água salgada sob o gelo.' },
  { key: 'Ganymede', name: 'Ganimedes', kind: 'moon', parent: 'Jupiter', r: 2634.1, color: 0xa89f92, period: 7.155, orbit: 0x9a9080, desc: 'A maior lua do Sistema Solar, maior que Mercúrio.' },
  { key: 'Callisto', name: 'Calisto', kind: 'moon', parent: 'Jupiter', r: 2410.3, color: 0x6e655a, period: 16.69, orbit: 0x857a6a, desc: 'Uma das superfícies mais cheias de crateras que se conhecem.' },
  { key: 'Saturn', name: 'Saturno', kind: 'planet', r: 58232, flat: 0.09796, tex: '2k_saturn.jpg', ring: [74500, 140220], period: 10759, orbit: 0xe3cf98, desc: 'Os anéis têm 280 mil km de diâmetro e, em média, só uns 10 metros de espessura.' },
  { key: 'Uranus', name: 'Urano', kind: 'planet', r: 25362, flat: 0.0229, tex: '2k_uranus.jpg', period: 30687, orbit: 0x9fe3e8, desc: 'Gira deitado: o eixo de rotação está inclinado 98°.' },
  { key: 'Neptune', name: 'Netuno', kind: 'planet', r: 24622, flat: 0.0171, tex: '2k_neptune.jpg', period: 60190, orbit: 0x5f84ff, desc: 'Ventos de 2.000 km/h, os mais rápidos do Sistema Solar.' },
  { key: 'Pluto', name: 'Plutão', kind: 'planet', dwarf: true, r: 1188.3, color: 0xd8c2a8, period: 90560, orbit: 0xa89880, desc: 'Planeta anão no Cinturão de Kuiper; tem um coração de gelo de nitrogênio.' },
];
export const BODY = Object.fromEntries(BODIES.map(b => [b.key, b]));
for (const b of BODIES) { b.pos = [0, 0, 0]; b.radius = b.r * KM; }

const JUP_MOONS = { Io: 'io', Europa: 'europa', Ganymede: 'ganymede', Callisto: 'callisto' };

let sunLight;
const orbitLines = [];

function rimMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSun: { value: new THREE.Vector3() } },
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform vec3 uSun; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        #include <logdepthbuf_fragment>
        float f = pow(1.0 - abs(dot(vN, vV)), 3.0);
        float lit = smoothstep(-0.3, 0.5, dot(vN, normalize(uSun - vW)));
        gl_FragColor = vec4(uColor * f * lit * 1.4, 1.0);
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,245,220,1)'); grd.addColorStop(0.08, 'rgba(255,230,170,0.9)');
  grd.addColorStop(0.25, 'rgba(255,190,90,0.25)'); grd.addColorStop(1, 'rgba(255,150,40,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const GLOW_TEX = glowTexture();

export function build() {
  local.add(new THREE.AmbientLight(0xffffff, 0.07));
  sunLight = new THREE.PointLight(0xffffff, 3.2, 0, 0);
  local.add(sunLight);

  for (const b of BODIES) {
    const geo = new THREE.SphereGeometry(1, 96, 48);
    let mat;
    if (b.kind === 'sun') mat = new THREE.MeshBasicMaterial({ map: loadTex(T + b.tex), color: 0xffffff });
    else mat = new THREE.MeshLambertMaterial({ map: b.tex ? loadTex(T + b.tex) : null, color: b.tex ? 0xffffff : b.color });
    const mesh = new THREE.Mesh(geo, mat);
    // eixo do polo da esfera do three é +Y; a escala achata os gigantes gasosos
    mesh.scale.set(b.radius, b.radius * (1 - (b.flat || 0)), b.radius);
    mesh.matrixAutoUpdate = true;
    const group = new THREE.Group();
    group.add(mesh);
    b.mesh = mesh; b.group = group;
    if (b.clouds) {
      const cm = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, alphaMap: loadTex(T + b.clouds, false), transparent: true, depthWrite: false }));
      cm.scale.setScalar(b.radius * 1.006);
      mesh.add(cm); cm.scale.setScalar(1.006); b.cloudMesh = cm;
    }
    if (b.atmo) {
      const am = new THREE.Mesh(geo, rimMaterial(b.atmo));
      am.scale.setScalar(1.025); mesh.add(am); b.atmoMesh = am;
    }
    if (b.ring) {
      const [ri, ro] = b.ring.map(x => x / b.r);
      const rg = new THREE.RingGeometry(ri, ro, 180, 1);
      const uv = rg.attributes.uv, p = rg.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const r = Math.hypot(p.getX(i), p.getY(i));
        uv.setXY(i, (r - ri) / (ro - ri), 0.5);
      }
      const tex = loadTex(T + '2k_saturn_ring_alpha.png');
      const rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xd8ccb0 }));
      rm.rotation.x = -Math.PI / 2; // anel no plano equatorial (XZ local)
      rm.scale.set(b.radius, b.radius, b.radius);
      group.add(rm); b.ringMesh = rm;
    }
    if (b.kind === 'sun') {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.setScalar(b.radius * 9);
      group.add(sp); b.glow = sp;
    }
    local.add(group);
  }
  buildOrbits();
}

function buildOrbits() {
  const now = A.MakeTime(ephDate());
  for (const b of BODIES) {
    if (!b.period) continue;
    const n = 360, pts = [];
    for (let i = 0; i <= n; i++) {
      const t = now.AddDays(b.period * (i / n - 0.5));
      const p = b.parent ? relToParent(b, t) : vec(A.HelioVector(A.Body[b.key], t));
      pts.push(new THREE.Vector3(...p));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: b.orbit, transparent: true, opacity: 0.45, depthWrite: false }));
    line.frustumCulled = false;
    line.userData.body = b;
    local.add(line);
    orbitLines.push(line);
    b.orbitBuiltAt = ephDate().getTime();
  }
}

const vec = v => [v.x * AU, v.y * AU, v.z * AU];
function relToParent(b, t) {
  if (b.key === 'Moon') return vec(A.GeoMoon(t));
  const jm = A.JupiterMoons(t)[JUP_MOONS[b.key]];
  return [jm.x * AU, jm.y * AU, jm.z * AU];
}

// Orientação do corpo: polo (eixo Y local) e meridiano principal (eixo X local) no referencial J2000
const _m = new THREE.Matrix4();
function orient(b, t) {
  let axis;
  try { axis = A.RotationAxis(A.Body[b.key], t); } catch { return; }
  const pole = [axis.north.x, axis.north.y, axis.north.z];
  b.pole = pole;
  let node = v3.cross([0, 0, 1], pole);
  node = v3.len(node) < 1e-6 ? [1, 0, 0] : v3.norm(node);
  const W = axis.spin * Math.PI / 180;
  const q90 = v3.cross(pole, node);
  const pm = v3.add(v3.scale(node, Math.cos(W)), v3.scale(q90, Math.sin(W)));
  const zl = v3.cross(pm, pole); // eixo Z local = PM × polo
  b.basis = { pm, pole, zl };
  _m.makeBasis(new THREE.Vector3(...pm), new THREE.Vector3(...pole), new THREE.Vector3(...zl));
  b.group.quaternion.setFromRotationMatrix(_m);
}

export const nowMs = () => F.date.getTime();
// As efemérides dos planetas valem por alguns milênios; além disso (e para Plutão a biblioteca simularia a gravidade
// passo a passo, sem fim), os planetas ficam na posição de ±3.000 anos. As estrelas continuam se movendo.
// (a tabela de Plutão da biblioteca cobre do ano 0 ao 4000; a órbita desenhada pede ±125 anos de folga)
const EPH_MIN = Date.UTC(200, 0, 1), EPH_MAX = Date.UTC(3800, 0, 1);
export const ephDate = () => new Date(Math.max(EPH_MIN, Math.min(EPH_MAX, F.date.getTime())));
export const ephFrozen = () => F.date.getTime() < EPH_MIN || F.date.getTime() > EPH_MAX;
let posTime = null;
export function computePositions() {
  if (posTime === ephDate().getTime()) return;
  posTime = ephDate().getTime();
  const t = A.MakeTime(ephDate());
  for (const b of BODIES) {
    if (b.kind === 'sun') b.pos = [0, 0, 0];
    else if (b.parent) b.pos = v3.add(BODY[b.parent].pos, relToParent(b, t));
    else b.pos = vec(A.HelioVector(A.Body[b.key], t));
  }
  for (const b of BODIES) orient(b, t);
}

// Ponto na superfície: latitude/longitude planetocêntricas (graus, longitude leste) e altitude em km
export function surfacePoint(key, lat, lon, altKm = 0) {
  const b = BODY[key];
  const { pm, pole, zl } = b.basis || { pm: [1, 0, 0], pole: [0, 0, 1], zl: [0, -1, 0] };
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  const lx = Math.cos(la) * Math.cos(lo), ly = Math.sin(la), lz = -Math.cos(la) * Math.sin(lo);
  const n = [pm[0] * lx + pole[0] * ly + zl[0] * lz, pm[1] * lx + pole[1] * ly + zl[1] * lz, pm[2] * lx + pole[2] * ly + zl[2] * lz];
  return { pos: v3.add(b.pos, v3.scale(n, (b.r + altKm) * KM)), normal: n, north: pole };
}

export function update() {
  computePositions();
  const show = F.layers.solar !== false;
  for (const b of BODIES) {
    place(b.group, b.pos);
    b.group.visible = show;
    if (b.cloudMesh) b.cloudMesh.rotation.y = F.date.getTime() / 8.64e7 * 0.25;
    if (b.atmoMesh) {
      b.atmoMesh.material.uniforms.uSun.value.set(-F.cam[0], -F.cam[1], -F.cam[2]).multiplyScalar(F.S);
    }
  }
  place(sunLight, [0, 0, 0]);
  sunLight.visible = v3.len(F.cam) < 1; // sem atenuação, então só vale dentro do Sistema Solar
  const showOrbits = show && F.layers.orbits !== false;
  for (const l of orbitLines) {
    const b = l.userData.body;
    place(l, b.parent ? BODY[b.parent].pos : [0, 0, 0]);
    // órbitas de luas só aparecem quando se está perto do planeta
    const d = v3.dist(F.cam, b.parent ? BODY[b.parent].pos : [0, 0, 0]);
    // a órbita do próprio corpo atravessa o planeta: some quando se está perto dele
    const own = v3.dist(F.cam, b.pos) < 300 * b.radius;
    l.visible = showOrbits && !own && (b.parent ? d < 400 * BODY[b.parent].radius : d < 3000 * AU);
  }
  // reconstrói as órbitas se o tempo simulado andou muito
  if (Math.abs(ephDate().getTime() - (orbitLines[0]?.userData.body.orbitBuiltAt ?? 0)) > 3e10) {
    for (const l of orbitLines.splice(0)) { local.remove(l); l.geometry.dispose(); }
    buildOrbits();
  }
}

// Distância da câmera à superfície mais próxima do Sistema Solar
export function nearestSurface() {
  let best = Infinity, body = null;
  for (const b of BODIES) {
    const d = v3.dist(F.cam, b.pos) - b.radius;
    if (d < best) { best = d; body = b; }
  }
  return { d: best, body };
}

// Ascensão reta e declinação de um corpo vistas do centro da Terra
export function geocentricRaDec(b) {
  const t = A.MakeTime(ephDate());
  const g = A.GeoVector(A.Body[b.key], t, true);
  const ra = (Math.atan2(g.y, g.x) * 180 / Math.PI + 360) % 360;
  return { ra, dec: Math.asin(g.z / Math.hypot(g.x, g.y, g.z)) * 180 / Math.PI };
}
