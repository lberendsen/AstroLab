// Realismo de perto (Fase 6):
//  - relevo real na Lua (LOLA), em Marte (MOLA) e em Mercúrio (MESSENGER): deslocamento da malha + mapa de normais
//  - texturas 4K (reduzidas das 8K) carregadas só para o corpo mais próximo
//  - Terra: luzes das cidades no lado noturno e reflexo do Sol nos oceanos
//  - atmosferas com dispersão: azul do lado do dia, laranja no terminador (Terra), rosada em Marte, amarelada em Vênus
//  - Saturno: sombra do planeta nos anéis e sombra dos anéis no planeta
import * as THREE from 'three';
import { F, loadTex, texLoader } from '../engine.js';
import { BODY, terrain } from './solar.js';
import { addPatch, after, before } from '../shaderpatch.js';
import { v3 } from '../astro.js';

export const FX = { dem: {}, exaggeration: 1, hires: true };
const rel = (p, out) => out.set((p[0] - F.cam[0]) * F.S, (p[1] - F.cam[1]) * F.S, (p[2] - F.cam[2]) * F.S);

// ---------------------------------------------------------------- relevo
const DEM_KEY = { Moon: 'moon', Mars: 'mars', Mercury: 'mercury' };
export async function load() {
  try {
    const meta = await (await fetch('data/dem.json')).json();
    await Promise.all(Object.entries(DEM_KEY).map(async ([body, key]) => {
      const m = meta[body];
      if (!m) return;
      const raw = new Int16Array(await (await fetch(`data/dem-${key}.bin`)).arrayBuffer());
      FX.dem[body] = { ...m, data: raw };
    }));
  } catch (e) { console.warn('relevo indisponível', e); }
}

// Altitude (km) num ponto, interpolada (longitude leste em graus, 0 no centro do mapa)
export function heightAt(body, lat, lon) {
  const d = FX.dem[body];
  if (!d) return 0;
  const x = ((((lon + 180) % 360) + 360) % 360) / 360 * d.w - 0.5, y = (90 - lat) / 180 * d.h - 0.5;
  const x0 = Math.floor(x), y0 = Math.max(0, Math.min(d.h - 2, Math.floor(y))), fx = x - x0, fy = Math.max(0, Math.min(1, y - y0));
  const at = (xx, yy) => d.data[yy * d.w + ((xx % d.w) + d.w) % d.w];
  const v = at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
  return v / 1000 * FX.exaggeration;
}

function demTextures(body) {
  const d = FX.dem[body], R = BODY[body].r, W = d.w, H = d.h;
  // altura em km, linhas de baixo para cima (convenção das DataTextures: v = 0 embaixo)
  const hf = new Uint16Array(W * H), nrm = new Uint8Array(W * H * 4);
  const hAt = (x, y) => d.data[Math.max(0, Math.min(H - 1, y)) * W + ((x % W) + W) % W] / 1000;
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI, dx = 2 * Math.PI * R * Math.max(Math.cos(lat), 0.02) / W, dy = Math.PI * R / H;
    for (let x = 0; x < W; x++) {
      const row = H - 1 - y;
      hf[row * W + x] = THREE.DataUtils.toHalfFloat(hAt(x, y));
      // normal no espaço tangente (u = leste, v = norte)
      const gx = (hAt(x + 1, y) - hAt(x - 1, y)) / (2 * dx), gy = (hAt(x, y - 1) - hAt(x, y + 1)) / (2 * dy);
      let nx = -gx, ny = -gy, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const o = (row * W + x) * 4;
      nrm[o] = (nx * 0.5 + 0.5) * 255; nrm[o + 1] = (ny * 0.5 + 0.5) * 255; nrm[o + 2] = (nz * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
    }
  }
  // meia precisão (16 bits): filtrável em qualquer WebGL2 (float de 32 bits com filtro linear depende de extensão e
  // é suspeito de travar a placa de vídeo); dá degraus de ~15 m nas altitudes de Marte
  const disp = new THREE.DataTexture(hf, W, H, THREE.RedFormat, THREE.HalfFloatType);
  disp.wrapS = THREE.RepeatWrapping; disp.magFilter = disp.minFilter = THREE.LinearFilter; disp.needsUpdate = true;
  const nm = new THREE.DataTexture(nrm, W, H, THREE.RGBAFormat);
  nm.wrapS = THREE.RepeatWrapping; nm.magFilter = THREE.LinearFilter; nm.minFilter = THREE.LinearMipmapLinearFilter; nm.generateMipmaps = true; nm.needsUpdate = true;
  // depois de enviadas à GPU, as cópias em JS (~16 MB por corpo) não servem mais; heightAt usa o DEM original
  for (const t of [disp, nm]) t.onUpdate = () => { t.image.data = null; t.onUpdate = null; };
  return { disp, nm };
}

// As texturas de relevo (~15 MB de memória de vídeo por corpo) só existem perto do corpo; longe dele, o material
// fica com texturas de 1×1 (altura zero, normal "para cima") no lugar, sem precisar recompilar o shader.
let reliefGeo = null;   // esfera unitária densa, a mesma para os três corpos (~14 MB de vértices)
const flatDisp = new THREE.DataTexture(new Uint16Array([0]), 1, 1, THREE.RedFormat, THREE.HalfFloatType);
const flatNormal = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat);
flatDisp.needsUpdate = flatNormal.needsUpdate = true;
const RELIEF_IN = 30, RELIEF_OUT = 45;   // raios do corpo
export function applyRelief() {
  for (const body of Object.keys(DEM_KEY)) {
    const b = BODY[body];
    if (!b?.mesh || !FX.dem[body]) continue;
    b.mesh.geometry = reliefGeo ||= new THREE.SphereGeometry(1, 720, 360);
    const m = b.mesh.material;
    m.displacementMap = flatDisp;
    m.normalMap = flatNormal;
    b.reliefMaterial = m;
    b.reliefOn = false;
    setExaggeration(FX.exaggeration);
    m.needsUpdate = true;
  }
}
function reliefIn(body) {
  const b = BODY[body], m = b.reliefMaterial;
  const { disp, nm } = demTextures(body);
  m.displacementMap = disp; m.normalMap = nm;
  b.reliefOn = true;
}
function reliefOut(body) {
  const b = BODY[body], m = b.reliefMaterial;
  if (m.displacementMap !== flatDisp) m.displacementMap.dispose();
  if (m.normalMap !== flatNormal) m.normalMap.dispose();
  m.displacementMap = flatDisp; m.normalMap = flatNormal;
  b.reliefOn = false;
}
function updateRelief() {
  for (const body of Object.keys(DEM_KEY)) {
    const b = BODY[body];
    if (!b?.reliefMaterial) continue;
    const d = v3.dist(F.cam, b.pos) / b.radius;
    if (!b.reliefOn && d < RELIEF_IN) reliefIn(body);
    else if (b.reliefOn && d > RELIEF_OUT) reliefOut(body);
  }
}
export function setExaggeration(k) {
  FX.exaggeration = k;
  for (const body of Object.keys(DEM_KEY)) {
    const b = BODY[body], m = b?.reliefMaterial;
    if (!m) continue;
    m.displacementScale = k / b.r;           // a esfera tem raio 1 = raio do corpo; a altura está em km
    m.normalScale = new THREE.Vector2(Math.min(k, 4), Math.min(k, 4));
  }
}

// ---------------------------------------------------------------- texturas 8K sob demanda
// As originais são 8K (textures/8k); o navegador usa as versões 4096×2048 de textures/4k (tools/resize-textures.mjs).
// Uma 8K com mipmaps ocupa ~170 MB de memória de vídeo e, numa Intel Iris Xe, três delas derrubaram o contexto WebGL;
// reduzir no navegador com createImageBitmap(resize) também falhou ("texSubImage2D: bad image data"). Só o corpo mais
// próximo recebe alta resolução.
const HIRES = { Earth: ['4k_earth_daymap.jpg'], Moon: ['4k_moon.jpg'], Mars: ['4k_mars.jpg'], Mercury: ['4k_mercury.jpg'], Jupiter: ['4k_jupiter.jpg'], Saturn: ['4k_saturn.jpg'] };
const hiState = {};
const HIRES_AFTER_MS = 20000;
function swapIn(key) {
  const b = BODY[key], st = (hiState[key] ||= { state: 'none', gen: 0 });
  if (st.state !== 'none') return;
  st.state = 'loading';
  const gen = ++st.gen;   // um swapOut durante o carregamento invalida esta carga
  const [day, clouds, night] = HIRES[key];
  const ld = (f, srgb = true) => texLoader.loadAsync(`textures/4k/${f}`).then(t => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, () => null);
  Promise.all([ld(day), clouds ? ld(clouds, false) : null, night ? ld(night) : null]).then(([d, c, n]) => {
    if (gen !== st.gen || st.state !== 'loading' || !d) { if (gen === st.gen) st.state = 'none'; for (const t of [d, c, n]) t?.dispose(); return; }
    st.orig = { map: b.mesh.material.map, clouds: b.cloudMesh?.material.alphaMap, night: earthU?.uNight.value };
    // trocar uma textura por outra do mesmo tipo não exige recompilar o shader
    b.mesh.material.map = d; if (!st.orig.map) b.mesh.material.needsUpdate = true;
    if (c && b.cloudMesh) { b.cloudMesh.material.alphaMap = c; }
    if (n && earthU) earthU.uNight.value = n;
    st.hi = [d, c, n]; st.state = 'on';
  });
}
function swapOut(key) {
  const b = BODY[key], st = hiState[key];
  if (!st || st.state === 'none') return;
  if (st.state === 'on') {
    b.mesh.material.map = st.orig.map; if (!st.orig.map) b.mesh.material.needsUpdate = true;
    if (b.cloudMesh && st.orig.clouds) { b.cloudMesh.material.alphaMap = st.orig.clouds; }
    if (earthU && key === 'Earth') earthU.uNight.value = st.orig.night;
    for (const t of st.hi) t?.dispose();
  }
  st.gen++;
  st.state = 'none';
}

// ---------------------------------------------------------------- Terra: luzes noturnas e reflexo no mar
let earthU = null;
function patchEarth() {
  const e = BODY.Earth;
  earthU = { uNight: { value: loadTex('textures/2k_earth_nightmap.jpg') }, uSunW: { value: new THREE.Vector3() } };
  addPatch(e.mesh.material, 'earth-night', sh => {
    Object.assign(sh.uniforms, earthU);
    sh.vertexShader = 'varying vec3 vEarthW;\nvarying vec3 vEarthN;\n' + after(sh.vertexShader, 'project_vertex', 'vEarthW = (modelMatrix * vec4(transformed, 1.0)).xyz; vEarthN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D uNight; uniform vec3 uSunW; varying vec3 vEarthW; varying vec3 vEarthN;\n' + after(sh.fragmentShader, 'lights_fragment_end', `
      {
        vec3 n = normalize(vEarthN), L = normalize(uSunW - vEarthW), V = normalize(cameraPosition - vEarthW);
        float sunUp = dot(n, L);
        // luzes das cidades: só do lado da noite, acendendo ao longo do crepúsculo
        vec3 city = texture2D(uNight, vMapUv).rgb;
        totalEmissiveRadiance += city * city * 1.6 * smoothstep(0.05, -0.15, sunUp);
        // reflexo do Sol no mar: água = pixel escuro e azulado no mapa do dia
        vec3 day = texture2D(map, vMapUv).rgb;
        float water = smoothstep(0.02, 0.10, day.b - day.r) * smoothstep(0.45, 0.2, day.g);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(n, H), 0.0), 400.0) * water * smoothstep(0.0, 0.15, sunUp);
        totalEmissiveRadiance += vec3(1.0, 0.92, 0.8) * spec * 0.55;   // o Lambert não soma o especular
      }`);
  });
}

// ---------------------------------------------------------------- atmosferas
const ATMO = {
  Earth: { day: [0.35, 0.6, 1.0], dusk: [1.0, 0.45, 0.15], k: 1.6 },
  Venus: { day: [1.0, 0.88, 0.6], dusk: [1.0, 0.6, 0.3], k: 2.2 },
  Mars: { day: [0.95, 0.65, 0.5], dusk: [0.45, 0.6, 1.0], k: 0.9 },
  // névoa laranja de hidrocarbonetos: na luz visível ela esconde a superfície (veil = opacidade sobre o disco)
  Titan: { day: [0.95, 0.6, 0.28], dusk: [0.6, 0.3, 0.1], k: 1.6, veil: 0.82 },
};
const atmoMats = [];
function atmoMaterial(spec) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3() }, uDay: { value: new THREE.Color(...spec.day) }, uDusk: { value: new THREE.Color(...spec.dusk) }, uK: { value: spec.k }, uVeil: { value: spec.veil || 0 } },
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
      uniform vec3 uSun, uDay, uDusk; uniform float uK, uVeil; varying vec3 vN; varying vec3 vW;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uSun - vW);
        float rim = pow(1.0 - abs(dot(n, V)), 2.6);
        float mu = dot(n, L);
        float lit = smoothstep(-0.25, 0.25, mu);
        // perto do terminador a luz atravessa mais ar: sobra o vermelho (Terra) ou o azul (Marte)
        vec3 col = mix(uDusk, uDay, smoothstep(-0.05, 0.35, mu));
        // espalhamento para a frente: brilho quando se olha em direção ao Sol, por trás do planeta
        float fwd = pow(max(dot(-V, L), 0.0), 8.0) * 0.8;
        if (uVeil > 0.0) {   // névoa opaca (Titã): cobre o disco, com a borda mais clara
          float l = smoothstep(-0.15, 0.4, mu);
          gl_FragColor = vec4(col * (l * (0.75 + rim * uK) + fwd), clamp(uVeil + rim, 0.0, 1.0));
        } else gl_FragColor = vec4(col * rim * (lit + fwd) * uK, 1.0);
      }`,
    blending: spec.veil ? THREE.NormalBlending : THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  atmoMats.push(m);
  return m;
}

// névoa de uma lua com atmosfera (Titã): casca em volta da malha da lua, que herda a escala dela
export function addHaze(mesh, key, scale = 1.08) {
  if (!ATMO[key] || mesh.userData.haze) return;
  const h = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), atmoMaterial(ATMO[key]));
  h.scale.setScalar(scale);
  mesh.add(h);
  mesh.userData.haze = h;
}

// ---------------------------------------------------------------- Saturno: sombras entre anéis e planeta
let satU = null;
function patchSaturn() {
  const s = BODY.Saturn;
  if (!s?.ringMesh) return;
  const [ri, ro] = s.ring.map(x => x / s.r);
  satU = { uSunS: { value: new THREE.Vector3() }, uCenS: { value: new THREE.Vector3() }, uPoleS: { value: new THREE.Vector3() }, uRS: { value: 1 }, uRing: { value: s.ringMesh.material.map }, uRi: { value: ri }, uRo: { value: ro } };
  // sombra do planeta nos anéis
  addPatch(s.ringMesh.material, 'ring-shadow', sh => {
    Object.assign(sh.uniforms, satU);
    sh.vertexShader = 'varying vec3 vRingW;\n' + after(sh.vertexShader, 'project_vertex', 'vRingW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec3 uSunS, uCenS; uniform float uRS; varying vec3 vRingW;\n' + before(sh.fragmentShader, 'opaque_fragment', `
      {
        vec3 d = normalize(uSunS - vRingW), oc = uCenS - vRingW;
        float t = dot(oc, d), dist = length(oc - d * t);
        float sh = (t > 0.0) ? smoothstep(uRS * 0.98, uRS * 1.02, dist) : 1.0;
        outgoingLight *= mix(0.06, 1.0, sh);
      }`);
  });
  // sombra dos anéis no planeta
  addPatch(s.mesh.material, 'ring-on-planet', sh => {
    Object.assign(sh.uniforms, satU);
    sh.vertexShader = 'varying vec3 vSatW;\n' + after(sh.vertexShader, 'project_vertex', 'vSatW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec3 uSunS, uCenS, uPoleS; uniform float uRS, uRi, uRo; uniform sampler2D uRing; varying vec3 vSatW;\n' + after(sh.fragmentShader, 'lights_fragment_end', `
      {
        vec3 d = normalize(uSunS - vSatW);
        float den = dot(d, uPoleS);
        if (abs(den) > 1e-4) {
          float t = dot(uCenS - vSatW, uPoleS) / den;
          if (t > 0.0) {
            float r = length(vSatW + d * t - uCenS) / uRS;
            if (r > uRi && r < uRo) {
              float a = texture2D(uRing, vec2((r - uRi) / (uRo - uRi), 0.5)).a;
              reflectedLight.directDiffuse *= 1.0 - a * 0.85;
            }
          }
        }
      }`);
  });
}

// ---------------------------------------------------------------- montar e atualizar
export function build() {
  // memória de vídeo esgotada: desliga a alta resolução e avisa (o three.js tenta restaurar o contexto)
  const cv = document.getElementById('view');
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); FX.hires = false; FX.onLost?.(); });
  // contexto de volta: as texturas de relevo não guardam cópia em JS, então são refeitas a partir do DEM
  cv.addEventListener('webglcontextrestored', () => {
    for (const body of Object.keys(DEM_KEY)) if (BODY[body]?.reliefOn) { reliefOut(body); reliefIn(body); }
  });
  // diagnóstico: ?fx=rhesa liga só os efeitos listados (r relevo, h alta resolução, e Terra, s Saturno, a atmosferas)
  const q = new URLSearchParams(location.search).get('fx');
  const on = k => q == null || q.includes(k);
  FX.hires = on('h');
  if (on('r')) { applyRelief(); terrain.height = heightAt; }
  if (on('e')) patchEarth();
  if (on('a')) for (const [key, spec] of Object.entries(ATMO)) {
    const b = BODY[key];
    if (b?.atmoMesh) { b.atmoMesh.material = atmoMaterial(spec); b.atmoMesh.scale.setScalar(key === 'Venus' ? 1.04 : 1.025); }
    else if (b?.mesh) { const am = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), atmoMaterial(spec)); am.scale.setScalar(1.02); b.mesh.add(am); b.atmoMesh = am; }
  }
  if (on('s')) patchSaturn();
}

export function update() {
  const sun = new THREE.Vector3(); rel([0, 0, 0], sun);
  for (const m of atmoMats) m.uniforms.uSun.value.copy(sun);
  if (earthU) earthU.uSunW.value.copy(sun);
  if (satU) {
    const s = BODY.Saturn;
    satU.uSunS.value.copy(sun); rel(s.pos, satU.uCenS.value); satU.uRS.value = s.radius * F.S;
    if (s.pole) satU.uPoleS.value.set(...s.pole);
  }
  updateRelief();
  // alta resolução: só o corpo mais próximo, a menos de 25 raios; os outros voltam ao normal.
  // Espera o fim da carga inicial (céu, relevo, Gaia), que já disputa a memória de vídeo.
  if (performance.now() < HIRES_AFTER_MS) return;
  let best = null, bd = 25;
  for (const key of Object.keys(HIRES)) { const d = v3.dist(F.cam, BODY[key].pos) / BODY[key].radius; if (d < bd && BODY[key].group.visible) { bd = d; best = key; } }
  for (const key of Object.keys(HIRES)) {
    if (FX.hires && key === best) swapIn(key);
    else if (key !== best && (v3.dist(F.cam, BODY[key].pos) / BODY[key].radius > 40 || !FX.hires)) swapOut(key);
  }
}
export const hiresState = key => hiState[key]?.state || 'none';
