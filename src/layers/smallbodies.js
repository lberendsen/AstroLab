// Asteroides e cometas (JPL SBDB). Os asteroides andam na GPU: cada vértice resolve a equação de Kepler a partir dos
// seus elementos orbitais, na data simulada. Os cometas (4 mil) são calculados no JS, com órbitas abertas e caudas.
// Os famosos têm órbita em precisão dupla, malha 3D no tamanho real e ficha própria.
import * as THREE from 'three';
import { F, local, place, scene } from '../engine.js';
import { AU, KM, v3 } from '../astro.js';
import { BODY } from './solar.js';

export const SB = { meta: null, tiers: [], famous: [], comets: [], loadedTiers: 0, loadingMore: false, names: [] };
const GAUSS = 0.01720209895, EPS = 23.4392911 * Math.PI / 180, CE = Math.cos(EPS), SE = Math.sin(EPS);
const JD_UNIX = 2440587.5;
export const jdNow = () => F.date.getTime() / 864e5 + JD_UNIX;

// Grupos para cor e filtro (índices de classe em ast-names.json: MBA IMB OMB TJN APO ATE AMO IEO MCA CEN TNO AST HYA PAA)
export const GROUPS = [
  { key: 'main', name: 'Cinturão principal', classes: ['MBA', 'IMB', 'OMB', 'AST'], color: '#b9a98e', on: true },
  { key: 'neo', name: 'Próximos da Terra', classes: ['APO', 'ATE', 'AMO', 'IEO'], color: '#ff6b5e', on: true },
  { key: 'mca', name: 'Cruzam a órbita de Marte', classes: ['MCA'], color: '#e8a050', on: true },
  { key: 'tjn', name: 'Troianos de Júpiter', classes: ['TJN'], color: '#6fe3c1', on: true },
  { key: 'cen', name: 'Centauros', classes: ['CEN'], color: '#c8a2ff', on: true },
  { key: 'tno', name: 'Além de Netuno (Kuiper)', classes: ['TNO'], color: '#6fa8ff', on: true },
];
export const showSB = { asteroids: true, comets: true, tails: true, groups: Object.fromEntries(GROUPS.map(g => [g.key, g.on])) };

// ---------------------------------------------------------------- órbitas em precisão dupla (famosos, cometas, selecionado)
function solveE(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; }
  return E;
}
function solveH(M, e) {
  let H = Math.asinh(M / e);
  for (let k = 0; k < 50; k++) { const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1); H -= d; if (Math.abs(d) < 1e-12) break; }
  return H;
}
// Posição heliocêntrica (UA, eclíptica J2000) por q, e, i, Ω, ω e passagem pelo periélio tp (JD). Vale para elipse, parábola e hipérbole.
function orbitXY(q, e, tp, jd) {
  const dt = jd - tp;
  if (e < 0.98) {
    const a = q / (1 - e), n = GAUSS / Math.pow(a, 1.5);
    let M = (n * dt) % (2 * Math.PI);
    const E = solveE(M, e);
    return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
  }
  if (e > 1.02) {
    const a = q / (e - 1), n = GAUSS / Math.pow(a, 1.5);
    const H = solveH(n * dt, e);
    return [a * (e - Math.cosh(H)), a * Math.sqrt(e * e - 1) * Math.sinh(H)];
  }
  // quase parabólica: equação de Barker
  const W = 3 * GAUSS / Math.sqrt(2 * q * q * q) * dt;
  const Y = Math.cbrt(W / 2 + Math.sqrt(W * W / 4 + 1));
  const s = Y - 1 / Y;
  return [q * (1 - s * s), 2 * q * s];
}
function toEq(x, y, i, om, w) {
  const co = Math.cos(om), so = Math.sin(om), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  const X = (co * cw - so * sw * ci) * x + (-co * sw - so * cw * ci) * y;
  const Y = (so * cw + co * sw * ci) * x + (-so * sw + co * cw * ci) * y;
  const Z = (sw * si) * x + (cw * si) * y;
  return [X, Y * CE - Z * SE, Y * SE + Z * CE];
}
// Corpo com elementos { q, e, i, om, w, tp } ou { a, e, i, om, w, ma, epoch }
export function bodyPosAU(o, jd = jdNow()) {
  let xy;
  if (o.tp != null && o.e != null && o.q != null) xy = orbitXY(o.q, o.e, o.tp, jd);
  else {
    const n = GAUSS / Math.pow(o.a, 1.5), E = solveE((o.ma + n * (jd - o.epoch)) % (2 * Math.PI), o.e);
    xy = [o.a * (Math.cos(E) - o.e), o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E)];
  }
  return toEq(xy[0], xy[1], o.i, o.om, o.w);
}
export const bodyPos = (o, jd) => v3.scale(bodyPosAU(o, jd), AU);

// Asteroide da nuvem (índice global) em precisão dupla
export function astElements(idx) {
  let base = 0;
  for (const t of SB.tiers) {
    if (idx < base + t.n) { const j = idx - base, e = t.el; return { a: e[j * 6], e: e[j * 6 + 1], i: e[j * 6 + 2], om: e[j * 6 + 3], w: e[j * 6 + 4], ma: e[j * 6 + 5], epoch: SB.meta.refEpoch, cls: SB.meta.classes[t.meta[j * 2]], H: t.meta[j * 2 + 1] / 8 }; }
    base += t.n;
  }
  return null;
}

// ---------------------------------------------------------------- carregamento
const bin = async (url, T) => new T(await (await fetch(url)).arrayBuffer());
export async function load() {
  try {
    const [meta, famous, comets] = await Promise.all(['data/ast-names.json', 'data/smallbodies-famous.json', 'data/comets.json'].map(u => fetch(u).then(r => r.json())));
    SB.meta = meta; SB.famous = famous;
    for (const f of famous) f.isComet = /^c/.test(f.kind || '');
    SB.comets = comets.comets.map(([full, pdes, name, q, e, i, om, w, tp, cls, M1, K1]) => ({ full, pdes, name, q, e, i, om, w, tp, cls, M1, K1 }));
    await loadTier(0);
  } catch (e) { console.warn('asteroides e cometas indisponíveis', e); }
}
async function loadTier(t) {
  const [el, meta] = await Promise.all([bin(`data/ast-${t}.bin`, Float32Array), bin(`data/ast-${t}.meta`, Uint8Array)]);
  const tier = { el, meta, n: el.length / 6 };
  SB.tiers[t] = tier;
  SB.loadedTiers = t + 1;
  if (built) addTierPoints(tier);
  return tier;
}
// Carrega os blocos restantes quando o usuário está no Sistema Solar com a camada ligada
export async function loadMore(onProgress) {
  if (SB.loadingMore || !SB.meta || SB.loadedTiers >= SB.meta.tiers.length) return;
  SB.loadingMore = true;
  try {
    for (let t = SB.loadedTiers; t < SB.meta.tiers.length; t++) { await loadTier(t); onProgress?.(loadedCount()); }
  } finally { SB.loadingMore = false; }
}
export const loadedCount = () => SB.tiers.reduce((s, t) => s + (t?.n || 0), 0);

// ---------------------------------------------------------------- nuvem de asteroides (GPU)
let built = false;
const astUniforms = {
  uDays: { value: 0 }, uCam: { value: new THREE.Vector3() }, uScale: { value: 1 }, uFade: { value: 1 },
  uRot: { value: new THREE.Matrix3().set(1, 0, 0, 0, CE, -SE, 0, SE, CE) },
  uColor: { value: [] }, uShow: { value: [] }, uBright: { value: 1 },
};
const astPoints = [];
const TIER_RANGE_AU = [3000, 30, 7]; // bloco 0: 100 mil maiores; 1: +400 mil; 2: +1,07 milhão (menores que ~1 km)

function classArrays() {
  const colors = [], show = [];
  for (const c of SB.meta.classes) {
    const g = GROUPS.find(g => g.classes.includes(c)) || GROUPS[0];
    colors.push(new THREE.Color(g.color));
    show.push(showSB.groups[g.key] ? 1 : 0);
  }
  return { colors, show };
}
export function setFilter() {
  if (!SB.meta) return;
  const { show } = classArrays();
  astUniforms.uShow.value = show;
}

const astMaterial = () => new THREE.ShaderMaterial({
  uniforms: astUniforms,
  vertexShader: /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_vertex>
    uniform float uDays, uScale, uBright;
    uniform vec3 uCam;
    uniform mat3 uRot;
    uniform vec3 uColor[14];
    uniform float uShow[14];
    attribute vec3 el2;   // Ω, ω, M0
    attribute vec2 meta;  // classe, H×8
    varying vec3 vColor;
    varying float vA;
    void main() {
      int c = int(meta.x + 0.5);
      float a = position.x, e = position.y, inc = position.z;
      float n = 0.01720209895 / pow(a, 1.5);
      float M = mod(el2.z + n * uDays, 6.28318530718);
      float E = M + e * sin(M);
      // Newton a partir de M + e·sen M: 3 passos bastam para e < 0,5 (quase todos); excêntricos ganham mais
      int iters = e < 0.5 ? 3 : 8;
      for (int k = 0; k < 8; k++) { if (k >= iters) break; E -= (E - e * sin(E) - M) / (1.0 - e * cos(E)); }
      float x = a * (cos(E) - e), y = a * sqrt(1.0 - e * e) * sin(E);
      float co = cos(el2.x), so = sin(el2.x), cw = cos(el2.y), sw = sin(el2.y), ci = cos(inc), si = sin(inc);
      vec3 ecl = vec3((co * cw - so * sw * ci) * x + (-co * sw - so * cw * ci) * y,
                      (so * cw + co * sw * ci) * x + (-so * sw + co * cw * ci) * y,
                      (sw * si) * x + (cw * si) * y);
      vec3 rel = uRot * ecl - uCam;                       // UA, relativo à câmera
      float H = meta.y / 8.0;
      // os maiores aparecem mais (mapa, não brilho real: quase todos seriam invisíveis a olho nu)
      vA = clamp((20.0 - H) / 10.0, 0.035, 1.0) * uBright * uShow[c];
      vColor = uColor[c];
      gl_PointSize = H < 10.0 ? 3.5 : H < 14.0 ? 2.2 : H < 17.0 ? 1.4 : 1.0;
      gl_Position = projectionMatrix * viewMatrix * vec4(rel * uScale, 1.0);
      if (vA < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_fragment>
    uniform float uFade;
    varying vec3 vColor;
    varying float vA;
    void main() {
      #include <logdepthbuf_fragment>
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      if (dot(p, p) > 1.0) discard;
      gl_FragColor = vec4(vColor * vA * uFade * 0.55, 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

function addTierPoints(tier) {
  const g = new THREE.BufferGeometry();
  const n = tier.n, pos = new Float32Array(n * 3), el2 = new Float32Array(n * 3);
  for (let j = 0; j < n; j++) {
    pos[j * 3] = tier.el[j * 6]; pos[j * 3 + 1] = tier.el[j * 6 + 1]; pos[j * 3 + 2] = tier.el[j * 6 + 2];
    el2[j * 3] = tier.el[j * 6 + 3]; el2[j * 3 + 1] = tier.el[j * 6 + 4]; el2[j * 3 + 2] = tier.el[j * 6 + 5];
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('el2', new THREE.BufferAttribute(el2, 3));
  g.setAttribute('meta', new THREE.BufferAttribute(tier.meta, 2));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  const p = new THREE.Points(g, astMaterial());
  p.frustumCulled = false;
  p.renderOrder = 3;
  scene.add(p);
  astPoints.push(p);
}

// ---------------------------------------------------------------- cometas (JS)
let cometPoints, cometPos, cometCol, cometsReady = false, cometJd = 0;
const tails = [];
export function cometState(c, jd = jdNow()) {
  const p = bodyPosAU(c, jd), r = v3.len(p);
  // brilho visto da Terra (Δ = distância Terra–cometa), não da nave
  const d = v3.dist(v3.scale(p, AU), BODY.Earth.pos) / AU || 1e-9;
  const mag = c.M1 != null ? c.M1 + 5 * Math.log10(d) + (c.K1 ?? 10) * Math.log10(r) : 99;
  return { p, r, mag };
}

function buildComets() {
  const n = SB.comets.length;
  const g = new THREE.BufferGeometry();
  cometPos = new THREE.BufferAttribute(new Float32Array(n * 3), 3); cometPos.setUsage(THREE.DynamicDrawUsage);
  cometCol = new THREE.BufferAttribute(new Float32Array(n * 4), 4); cometCol.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', cometPos); g.setAttribute('color', cometCol);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  cometPoints = new THREE.Points(g, new THREE.ShaderMaterial({
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
      attribute vec4 color; varying vec4 vC;
      void main() { vC = color; gl_PointSize = 2.0 + color.a * 4.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        if (color.a < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
      varying vec4 vC;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard;
        gl_FragColor = vec4(vC.rgb * exp(-r2 * 3.0) * vC.a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  cometPoints.frustumCulled = false;
  local.add(cometPoints);
}

// Caudas: de íons (azul, reta, oposta ao Sol) e de poeira (amarelada, larga e curvada para trás na órbita).
// Comprimento estimado pela atividade (magnitude absoluta M1) e pela distância ao Sol.
const tailMat = (color, width) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: 1 } },
  vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
    varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
    uniform vec3 uColor; uniform float uOp; varying vec2 vUv;
    void main() {
      #include <logdepthbuf_fragment>
      float along = 1.0 - vUv.y, across = abs(vUv.x - 0.5) * 2.0;   // 0 no núcleo, 1 na ponta
      float w = mix(0.15, 1.0, along);                       // abre ao se afastar do núcleo
      float a = (1.0 - along) * (1.0 - along) * exp(-pow(across / w, 2.0) * 3.0);
      gl_FragColor = vec4(uColor * a * uOp, 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function makeTail() {
  const ion = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 16), tailMat(0x6fb0ff));
  const dust = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 16), tailMat(0xffe0a8));
  ion.frustumCulled = dust.frustumCulled = false;
  local.add(ion, dust);
  return { ion, dust };
}
// Coloca um plano do núcleo até a ponta, virado para a câmera (billboard cilíndrico); a poeira se curva para trás da órbita
function layTail(mesh, nucleus, dir, back, L, W, bend) {
  const pos = mesh.geometry.attributes.position, n = pos.count / 2;
  for (let k = 0; k < n; k++) {
    const s = k / (n - 1);
    const axis = v3.norm(v3.add(dir, v3.scale(back, bend * s)));
    const c = v3.add(nucleus, v3.scale(axis, L * s));
    const toCam = v3.norm(v3.sub(F.cam, c));
    const side = v3.norm(v3.cross(axis, toCam));
    const w = W * (0.15 + 0.85 * s);
    for (let m = 0; m < 2; m++) {
      const q = v3.add(c, v3.scale(side, (m ? 0.5 : -0.5) * w));
      const idx = k * 2 + m;
      pos.setXYZ(idx, q[0] - F.cam[0], q[1] - F.cam[1], q[2] - F.cam[2]);
    }
  }
  // a geometria do plano tem os vértices em linhas de 2 (x=-0.5, x=+0.5) ao longo de y; uv.y vai de 1 a 0
  pos.needsUpdate = true;
  mesh.position.set(0, 0, 0);
}

// Recalcula as órbitas dos cometas em fatias (1/20 por quadro) e, ao fim de cada volta, escolhe os que ganham cauda
let activeComets = [], cometCursor = 0;
const COMET_SLICES = 20;
function recomputeComets() {
  const jd = jdNow(), n = SB.comets.length, ca = cometCol.array;
  const step = Math.ceil(n / COMET_SLICES), k0 = cometCursor, k1 = Math.min(n, k0 + step);
  cometCursor = k1 >= n ? 0 : k1;
  for (let k = k0; k < k1; k++) {
    const c = SB.comets[k];
    const st = cometState(c, jd);
    c.now = v3.scale(st.p, AU); c.r = st.r; c.mag = st.mag;
    // brilho: os ativos (perto do Sol) se destacam; os distantes ficam como pontinhos azulados
    const vis = st.mag < 12 ? 1 : st.r < 6 ? 0.55 : 0.25;
    ca[k * 4] = 0.65; ca[k * 4 + 1] = 0.95; ca[k * 4 + 2] = 1; ca[k * 4 + 3] = vis;
  }
  cometCol.needsUpdate = true;
  if (cometCursor === 0) {
    const active = SB.comets.filter(c => c.r < 5 && c.M1 != null && c.mag < 14);
    active.sort((a, b) => a.mag - b.mag);
    activeComets = active.slice(0, 12);
  }
  // cometa famoso selecionado (não está na lista geral): calcula à parte
  if (selectedComet && !activeComets.includes(selectedComet)) {
    const st = cometState(selectedComet, jd);
    Object.assign(selectedComet, { now: v3.scale(st.p, AU), r: st.r, mag: st.mag });
    if (st.r < 5 && selectedComet.M1 != null) activeComets.push(selectedComet);
  }
}

function drawTails(active) {
  while (tails.length < active.length) tails.push(makeTail());
  tails.forEach((t, k) => {
    const c = active[k];
    t.ion.visible = t.dust.visible = !!c;
    if (!c) return;
    const anti = v3.norm(c.now);                           // oposto ao Sol
    const ahead = v3.norm(v3.sub(bodyPos(c, jdNow() + 1), c.now)); // direção do movimento
    const back = v3.scale(ahead, -1);
    const act = Math.pow(10, -0.2 * ((c.M1 ?? 12) - 6));   // mais brilhante, mais ativo
    const L = Math.min(Math.max(0.12 * act / (c.r * c.r), 0.002), 0.6) * AU;
    // cauda com menos de 3 pixels na tela: não vale o cálculo
    if (L / Math.max(v3.dist(F.cam, c.now), 1e-12) * F.pxPerRad < 3) { t.ion.visible = t.dust.visible = false; return; }
    layTail(t.ion, c.now, anti, back, L * 1.3, L * 0.05, 0.05);
    layTail(t.dust, c.now, anti, back, L, L * 0.22, 0.6);
    t.ion.scale.setScalar(1); t.dust.scale.setScalar(1);
    t.ion.material.uniforms.uOp.value = 0.9; t.dust.material.uniforms.uOp.value = 0.8;
  });
}

// ---------------------------------------------------------------- objeto selecionado: malha, órbita
let selectedComet = null, selMesh = null, selOrbit = null, selObj = null, coma = null;
function rockGeometry(seed, irregular) {
  const g = new THREE.SphereGeometry(1, 128, 96); // indexada: normais suaves
  const p = g.attributes.position;
  const h = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453; return s - Math.floor(s); };
  for (let k = 0; k < p.count; k++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, k);
    let d = 1;
    // forma ilustrativa: alongada e com crateras para corpos pequenos; quase esférica para os grandes
    if (irregular) {
      d *= 1 + 0.28 * Math.sin(v.x * 2.1 + seed) * Math.cos(v.y * 1.7 + seed * 0.5) + 0.12 * Math.sin(v.z * 3.3 + seed * 2);
      d *= 1 - 0.06 * Math.pow(h(Math.round(v.x * 4), Math.round(v.y * 4), Math.round(v.z * 4)), 6);
      v.x *= 1.35;
    } else d *= 1 + 0.015 * Math.sin(v.x * 7 + seed) * Math.sin(v.y * 6);
    p.setXYZ(k, v.x * d, v.y * d, v.z * d);
  }
  g.computeVertexNormals();
  return g;
}

// Diâmetro em km: medido, ou estimado pela magnitude absoluta H com albedo típico de 0,14
export function diameterKm(o) {
  if (o.diameter) return o.diameter;
  const H = o.H ?? 18, alb = o.albedo || 0.14;
  return 1329 / Math.sqrt(alb) * Math.pow(10, -H / 5);
}

export function setSelected(obj) {
  selObj = obj || null;
  selectedComet = obj?.isComet ? obj : null;
  if (selMesh) { local.remove(selMesh); selMesh.geometry.dispose(); selMesh = null; }
  if (selOrbit) { local.remove(selOrbit); selOrbit.geometry.dispose(); selOrbit = null; }
  if (!obj) return;
  const dKm = obj.isComet ? (obj.diameter || 5) : diameterKm(obj);
  const seed = (obj.full || obj.name || '').length * 7.3;
  selMesh = new THREE.Mesh(rockGeometry(seed, dKm < 300), new THREE.MeshLambertMaterial({ color: obj.isComet ? 0x4a4440 : 0x8a8178 }));
  selMesh.scale.setScalar(dKm / 2 * KM);
  local.add(selMesh);
  obj.radius = dKm / 2 * KM;
  // órbita: uma volta (elipse) ou ±3 anos em torno de agora (abertas)
  const pts = [], jd = jdNow();
  const ell = (obj.e ?? 0) < 0.98, a = obj.a || (obj.q && ell ? obj.q / (1 - obj.e) : null);
  const per = ell && a ? 365.25 * Math.pow(a, 1.5) : 2000;
  for (let k = 0; k <= 720; k++) pts.push(new THREE.Vector3(...bodyPos(obj, jd + (k / 720 - 0.5) * per)));
  selOrbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: obj.isComet ? 0x8fdcff : 0xffc36b, transparent: true, opacity: 0.7, depthWrite: false }));
  selOrbit.frustumCulled = false;
  local.add(selOrbit);
}

// ---------------------------------------------------------------- consulta individual ao SBDB (via repassador do serve.mjs)
const proxied = u => '/proxy?u=' + encodeURIComponent(u);
const D2R = Math.PI / 180;
export async function fetchSbdb(sstr) {
  const j = await (await fetch(proxied('https://ssd-api.jpl.nasa.gov/sbdb.api?' + new URLSearchParams({ sstr, 'phys-par': 1, discovery: 1 })), { signal: AbortSignal.timeout(25000) })).json();
  if (!j.orbit) return null;
  const el = Object.fromEntries(j.orbit.elements.map(x => [x.name, x.value == null ? null : +x.value]));
  const phys = Object.fromEntries((j.phys_par || []).map(x => [x.name, x.value]));
  const isComet = j.object.kind?.startsWith('c');
  return {
    name: j.object.shortname || j.object.fullname, full: j.object.fullname, kind: j.object.kind, cls: j.object.orbit_class?.code, clsName: j.object.orbit_class?.name,
    neo: j.object.neo, pha: j.object.pha, isComet,
    epoch: +j.orbit.epoch, e: el.e, q: el.q, a: el.a, i: el.i * D2R, om: el.om * D2R, w: el.w * D2R, tp: el.tp, ma: el.ma == null ? null : el.ma * D2R, per: el.per,
    H: phys.H != null ? +phys.H : null, diameter: phys.diameter != null ? +phys.diameter : null, albedo: phys.albedo != null ? +phys.albedo : null,
    rot: phys.rot_per != null ? +phys.rot_per : null, M1: phys.M1 != null ? +phys.M1 : null, K1: phys.K1 != null ? +phys.K1 : null,
    discovery: j.discovery ? { date: j.discovery.date, who: j.discovery.who, where: j.discovery.location } : null,
  };
}

// ---------------------------------------------------------------- corrente de meteoroides de uma chuva de meteoros
// Poeira solta pelo corpo de origem, espalhada ao longo da órbita dele. Ilustrativa: a dispersão real varia muito.
let stream = null;
export function showStream(parent) {
  if (stream) { local.remove(stream); stream.geometry.dispose(); stream = null; }
  if (!parent) return;
  // A poeira mais nova ainda acompanha o corpo de origem (um "trilho" denso logo à frente e atrás dele);
  // a mais velha já se espalhou pela órbita inteira, num anel tênue.
  const n = 20000, pts = new Float32Array(n * 3), col = new Float32Array(n * 4);
  const ell = parent.e < 0.98, a = parent.a || (ell ? parent.q / (1 - parent.e) : null);
  const per = ell && a ? 365.25 * Math.pow(a, 1.5) : 4000;
  let s = 12345;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const g = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const now = jdNow(), base = [1, 0.83, 0.54];
  for (let k = 0; k < n; k++) {
    const young = rnd() < 0.6;
    // jovem: atraso/avanço de poucos por cento do período (mais para trás: a poeira fica para trás do cometa)
    const dt = young ? (g() * 0.03 - 0.015) * per : (rnd() - 0.5) * per;
    const p = bodyPosAU(parent, now + dt);
    const r = v3.len(p), spread = young ? 0.004 + Math.abs(dt / per) * 0.1 : 0.012;
    for (let m = 0; m < 3; m++) pts[k * 3 + m] = (p[m] + g() * spread * r) * AU;
    // cor fixa; a opacidade é que cai com a idade (somar brilho saturava tudo em branco)
    const alpha = young ? 0.6 * Math.exp(-Math.abs(dt / per) / 0.03) + 0.18 : 0.12;
    col.set([...base, alpha], k * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  stream = new THREE.Points(geo, new THREE.PointsMaterial({ vertexColors: true, size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false }));
  stream.frustumCulled = false;
  local.add(stream);
}

// ---------------------------------------------------------------- quadro
export function build() {
  if (!SB.meta) return;
  const { colors, show } = classArrays();
  astUniforms.uColor.value = colors; astUniforms.uShow.value = show;
  for (const t of SB.tiers) if (t) addTierPoints(t);
  built = true;
  buildComets();
  coma = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  coma.visible = false;
  local.add(coma);
}

export function update() {
  if (!built) return;
  const r = v3.len(F.cam);
  const inSystem = r < 3000 * AU;
  const on = F.layers.solar !== false && inSystem;
  // fora do Sistema Solar, some (e não custa nada na GPU)
  const fade = 1 - Math.min(Math.max((r / AU - 300) / 1500, 0), 1);
  astUniforms.uFade.value = fade;
  astUniforms.uDays.value = jdNow() - SB.meta.refEpoch;
  astUniforms.uCam.value.set(F.cam[0] / AU, F.cam[1] / AU, F.cam[2] / AU);
  astUniforms.uScale.value = AU * F.S;
  // nível de detalhe: os blocos de asteroides menores só aparecem com a câmera mais perto do Sol
  // (de longe eles somam um borrão e custam muito à GPU)
  const dAU = r / AU;
  // perto de um planeta, lua ou nave (escala da cena menor que ~0,02 UA), os menores viram só ruído no fundo
  const closeUp = F.near < 0.02 * AU;
  astPoints.forEach((p, k) => { p.visible = on && showSB.asteroids && dAU < TIER_RANGE_AU[Math.min(k, 2)] && !(closeUp && k > 0); });
  // de longe os pontos se acumulam: menos brilho por ponto
  astUniforms.uBright.value = Math.min(1, Math.max(0.22, 2.5 / Math.max(dAU, 0.1)));
  const cometsOn = on && showSB.comets;
  cometPoints.visible = cometsOn;
  if (cometsOn) {
    // na primeira vez (ou após o tempo dar um salto), calcula todos de uma vez
    const jd = jdNow();
    if (!cometsReady || Math.abs(jd - cometJd) > 30) { cometCursor = 0; for (let s = 0; s < COMET_SLICES; s++) recomputeComets(); cometsReady = true; cometJd = jd; }
    else { recomputeComets(); if (cometCursor === 0) cometJd = jd; }
    // posição relativa à câmera a cada quadro (a câmera anda mais rápido que os cometas)
    const pa = cometPos.array;
    SB.comets.forEach((c, k) => { if (c.now) { pa[k * 3] = c.now[0] - F.cam[0]; pa[k * 3 + 1] = c.now[1] - F.cam[1]; pa[k * 3 + 2] = c.now[2] - F.cam[2]; } });
    cometPos.needsUpdate = true;
  }
  drawTails(cometsOn && showSB.tails ? activeComets : []);
  if (selMesh && selObj) {
    const p = bodyPos(selObj);
    selObj.now = p;
    place(selMesh, p);
    selMesh.rotation.y = F.date.getTime() / 3600e3 * 2 * Math.PI / (selObj.rot || 8);
    selMesh.visible = on;
    place(selOrbit, [0, 0, 0]);
    selOrbit.visible = on && F.layers.orbits !== false;
    if (selObj.isComet && coma) {
      const st = cometState(selObj);
      coma.visible = on && st.r < 6;
      place(coma, p);
      coma.scale.setScalar(Math.min(Math.max(2e5 / (st.r * st.r), 3e3), 1e6) * KM);
    }
  } else if (coma) coma.visible = false;
  if (stream) { place(stream, [0, 0, 0]); stream.visible = on; }
}

// ---------------------------------------------------------------- escolha por clique
export function pickAsteroid(project, x, y) {
  if (!built || !showSB.asteroids || !astPoints[0]?.visible) return -1;
  const days = jdNow() - SB.meta.refEpoch;
  let best = -1, bd = 7, base = 0;
  for (const t of SB.tiers) {
    if (!t) continue;
    const e = t.el;
    for (let j = 0; j < t.n; j++) {
      const a = e[j * 6], ec = e[j * 6 + 1];
      const n = GAUSS / Math.pow(a, 1.5);
      const M = (e[j * 6 + 5] + n * days) % (2 * Math.PI);
      let E = M + ec * Math.sin(M);
      for (let k = 0; k < 5; k++) E -= (E - ec * Math.sin(E) - M) / (1 - ec * Math.cos(E));
      const q = toEq(a * (Math.cos(E) - ec), a * Math.sqrt(1 - ec * ec) * Math.sin(E), e[j * 6 + 2], e[j * 6 + 3], e[j * 6 + 4]);
      const s = project([q[0] * AU, q[1] * AU, q[2] * AU]);
      if (!s) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = base + j; }
    }
    base += t.n;
  }
  return best;
}
export function pickComet(project, x, y) {
  if (!cometPoints?.visible) return null;
  let best = null, bd = 9;
  for (const c of SB.comets) {
    if (!c.now) continue;
    const s = project(c.now);
    if (!s) continue;
    const d = Math.hypot(s.x - x, s.y - y) - (c.mag < 12 ? 4 : 0);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
