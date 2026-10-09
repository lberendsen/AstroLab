// Camadas da Fase 5:
//  - Gaia DR3: 2,2 milhões de estrelas a menos de 650 anos-luz (carregadas quando a nave está por perto)
//  - Pulsares (ATNF): piscam no próprio ritmo de rotação, até ~5 vezes por segundo (os mais rápidos ficam acesos)
//  - Estruturas do universo: superaglomerados e vazios, com posição e tamanho aproximados
//  - Ondas gravitacionais: a "casca" de distância de um evento (a direção quase nunca é bem conhecida)
import * as THREE from 'three';
import { F, scene, local, place, rteGeometry, pointsMaterial, pointUniforms } from '../engine.js';
import { starUniforms } from './stars.js';
import { v3, radec2xyz, KM, AU, LY } from '../astro.js';

export const P5 = { gaiaN: 0, gaiaLoading: false, pulsars: [], structures: [], show: { gaia: true, pulsars: true, structures: true } };

// ---------------------------------------------------------------- Gaia
let gaiaPoints = null;
export async function loadGaia(onDone) {
  if (gaiaPoints || P5.gaiaLoading) return;
  P5.gaiaLoading = true;
  try {
    const buf = await (await fetch('data/gaia.bin')).arrayBuffer();
    const n = buf.byteLength / 8, dv = new DataView(buf);
    // ordenadas da mais luminosa para a menos: assim dá para desenhar só o começo da lista (drawRange)
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    const Mof = i => dv.getUint8(i * 8 + 6);
    order.sort((a, b) => Mof(a) - Mof(b));
    const pos = new Float32Array(n * 3), absG = new Float32Array(n), col = new Float32Array(n);
    const S = 200 / 32767;
    for (let k = 0; k < n; k++) {
      const i = order[k];
      pos[k * 3] = dv.getInt16(i * 8, true) * S; pos[k * 3 + 1] = dv.getInt16(i * 8 + 2, true) * S; pos[k * 3 + 2] = dv.getInt16(i * 8 + 4, true) * S;
      absG[k] = dv.getUint8(i * 8 + 6) / 10 - 5; col[k] = dv.getUint8(i * 8 + 7) / 50 - 0.5;
    }
    P5.gaiaAbs = absG;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('absG', new THREE.BufferAttribute(absG, 1));
    g.setAttribute('bprp', new THREE.BufferAttribute(col, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...pointUniforms, uLimit: starUniforms.uLimit, uCamPc: { value: new THREE.Vector3() } },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        uniform float uLimit, uS; uniform vec3 uCamPc;
        attribute float absG, bprp;
        varying vec3 vColor; varying float vA;
        vec3 bprpColor(float c) {   // cor aproximada pelo índice BP−RP do Gaia
          if (c < 0.3) return mix(vec3(0.62, 0.72, 1.0), vec3(0.95, 0.96, 1.0), clamp((c + 0.3) / 0.6, 0.0, 1.0));
          if (c < 1.0) return mix(vec3(0.95, 0.96, 1.0), vec3(1.0, 0.86, 0.62), (c - 0.3) / 0.7);
          return mix(vec3(1.0, 0.86, 0.62), vec3(1.0, 0.5, 0.3), clamp((c - 1.0) / 2.0, 0.0, 1.0));
        }
        void main() {
          vec3 rel = position - uCamPc;
          float d = max(length(rel), 1e-9);
          float m = absG + 5.0 * log(d / 10.0) * 0.4342944819;
          float b = pow(10.0, -0.4 * (m - uLimit));
          vA = clamp(b, 0.0, 1.0);
          gl_PointSize = clamp(2.2 * pow(max(b, 1e-6), 0.22), 2.0, 40.0);
          vColor = bprpColor(bprp);
          gl_Position = projectionMatrix * viewMatrix * vec4(rel * uS, 1.0);
          if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 vColor; varying float vA;
        void main() {
          #include <logdepthbuf_fragment>
          vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard;
          gl_FragColor = vec4(vColor * exp(-r2 * 14.0) * vA, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    gaiaPoints = new THREE.Points(g, mat);
    gaiaPoints.frustumCulled = false;
    gaiaPoints.renderOrder = 2;
    scene.add(gaiaPoints);
    P5.gaiaN = n;
    onDone?.(n);
  } catch (e) { console.warn('Gaia indisponível', e); }
  P5.gaiaLoading = false;
}

// ---------------------------------------------------------------- pulsares
let psrPoints = null;
const psrUniforms = { uT: { value: 0 } };
export async function load() {
  try { P5.pulsars = await (await fetch('data/pulsars.json')).json(); } catch { P5.pulsars = []; }
  for (const p of P5.pulsars) p.xyz = radec2xyz(p.ra, p.dec, p.d);
  P5.structures = STRUCTURES.map(s => ({ ...s, xyz: radec2xyz(s.ra, s.dec, s.d * 1e6) }));
}

// Superaglomerados, aglomerados e vazios (posição e tamanho aproximados, da literatura)
const STRUCTURES = [
  { name: 'Aglomerado de Virgem', ra: 187.7, dec: 12.3, d: 16.5, r: 2.2, kind: 'aglomerado', desc: 'Cerca de 1.500 galáxias, incluindo M87. O centro do nosso Superaglomerado Local.' },
  { name: 'Grande Atrator (Aglomerado de Norma)', ra: 243.9, dec: -60.9, d: 67, r: 8, kind: 'atrator', desc: 'Uma concentração de massa que puxa a Via Láctea e milhares de galáxias vizinhas a ~600 km/s. Fica atrás do disco da Via Láctea, difícil de observar.' },
  { name: 'Laniakea', ra: 250, dec: -50, d: 60, r: 80, kind: 'superaglomerado', desc: '"Céu imenso" em havaiano: o superaglomerado de 100 mil galáxias do qual fazemos parte, definido em 2014 pelo movimento das galáxias. Diâmetro de ~520 milhões de anos-luz (contorno aproximado).' },
  { name: 'Superaglomerado de Shapley', ra: 202, dec: -31.5, d: 200, r: 25, kind: 'superaglomerado', desc: 'A maior concentração de galáxias no universo próximo.' },
  { name: 'Superaglomerado de Perseu-Peixes', ra: 40, dec: 38, d: 75, r: 25, kind: 'superaglomerado', desc: 'Uma longa cadeia de aglomerados de galáxias, uma das estruturas mais marcantes do céu do norte.' },
  { name: 'Superaglomerado de Hércules', ra: 241, dec: 17, d: 150, r: 20, kind: 'superaglomerado', desc: 'Parte da grande parede de galáxias que inclui o Aglomerado de Coma.' },
  { name: 'Superaglomerado de Horologium-Reticulum', ra: 50, dec: -50, d: 270, r: 40, kind: 'superaglomerado', desc: 'Um dos maiores superaglomerados do céu do sul.' },
  { name: 'Grande Muralha Sloan', ra: 197, dec: 1, d: 310, r: 70, kind: 'muralha', desc: 'Uma "parede" de galáxias com ~1,4 bilhão de anos-luz de comprimento, descoberta pelo SDSS em 2003.' },
  { name: 'Vazio de Boötes', ra: 218, dec: 46, d: 215, r: 40, kind: 'vazio', desc: 'O "Grande Nada": uma bolha de ~250 milhões de anos-luz de diâmetro quase sem galáxias. Se a Via Láctea estivesse no centro, só saberíamos da existência de outras galáxias nos anos 1960.' },
  { name: 'Vazio Local', ra: 285, dec: 18, d: 23, r: 22, kind: 'vazio', desc: 'Um vazio vizinho à Via Láctea. Ele "empurra" o Grupo Local, junto com a atração de Virgem e do Grande Atrator.' },
];
const KIND_COLOR = { vazio: 0x7aa7ff, superaglomerado: 0xffc36b, aglomerado: 0xffd9a0, atrator: 0xff8a6b, muralha: 0xffc36b };

let structGroup = null, gwShell = null, gwShellDist = 0, bhGroup = null;
export function build() {
  if (P5.pulsars.length) {
    const pos = new Float64Array(P5.pulsars.length * 3), per = new Float32Array(P5.pulsars.length), fam = new Float32Array(P5.pulsars.length);
    P5.pulsars.forEach((p, i) => { pos.set(p.xyz, i * 3); per[i] = p.p || 1; fam[i] = p.name ? 1 : 0; });
    const g = rteGeometry(pos);
    g.setAttribute('per', new THREE.BufferAttribute(per, 1));
    g.setAttribute('fam', new THREE.BufferAttribute(fam, 1));
    psrPoints = new THREE.Points(g, pointsMaterial({
      uniforms: psrUniforms,
      vertex: /* glsl */`
        uniform float uT;
        attribute float per, fam;
        varying float vB; varying float vF;
        void main() {
          vec3 rel = relPos();
          // pisca no ritmo real; acima de ~5 Hz, o olho não acompanha: fica aceso
          float ph = fract(uT / max(per, 1e-3));
          vB = per > 0.2 ? (ph < 0.18 ? 1.0 : 0.25) : 0.7;
          vF = fam;
          gl_PointSize = fam > 0.5 ? 7.0 : 4.0;
          gl_Position = project(rel);
        }`,
      fragment: /* glsl */`
        varying float vB; varying float vF;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard;
          vec3 c = mix(vec3(0.55, 0.85, 1.0), vec3(0.85, 0.6, 1.0), vF);
          gl_FragColor = vec4(c * vB * exp(-r2 * 3.0), 1.0);
        }`,
    }));
    psrPoints.frustumCulled = false;
    psrPoints.renderOrder = 3;
    scene.add(psrPoints);
  }
  // estruturas: esferas de arame (contorno aproximado)
  structGroup = new THREE.Group();
  for (const s of P5.structures) {
    const m = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 2)),
      new THREE.LineBasicMaterial({ color: KIND_COLOR[s.kind], transparent: true, opacity: 0.22, depthWrite: false }));
    m.userData.s = s; m.frustumCulled = false;
    structGroup.add(m);
  }
  local.add(structGroup);
  // casca das ondas gravitacionais
  gwShell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshBasicMaterial({ color: 0xb08cff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, wireframe: true }));
  gwShell.visible = false; gwShell.frustumCulled = false;
  local.add(gwShell);
  // buraco negro selecionado: horizonte (esfera preta) e brilho do disco de acreção
  bhGroup = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(3, 12, 96), new THREE.ShaderMaterial({
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
      varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
      varying vec2 vUv;
      void main() {
        #include <logdepthbuf_fragment>
        float r = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.3, r) * smoothstep(0.2, 0.32, r);
        gl_FragColor = vec4(mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.45, 0.1), r) * a * 1.6, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  ring.rotation.x = Math.PI / 2.4;
  bhGroup.add(hole, ring);
  bhGroup.visible = false;
  local.add(bhGroup);
}

// GW: mostra a casca a uma distância (pc); null esconde
export function showGwShell(dPc) { gwShellDist = dPc || 0; }
// Buraco negro: { pos, massSun, disk }
let bhSel = null;
export function showBlackHole(b) { bhSel = b; }

export function update(dt) {
  const r = v3.len(F.cam);
  // Gaia: dentro de ~2.000 anos-luz do Sol
  if (gaiaPoints) {
    // perto do Sol o HYG já cobre o céu visível; o Gaia entra quando a nave sai da vizinhança imediata
    gaiaPoints.visible = P5.show.gaia && F.layers.stars !== false && r > 0.3 && r < 800;
    gaiaPoints.material.uniforms.uCamPc.value.set(...F.cam);
    if (gaiaPoints.visible) {
      // só as estrelas que podem aparecer: magnitude absoluta < limite − 5·log10(distância mínima / 10 pc)
      // distância da nave até a estrela mais próxima possível do conjunto (esfera de 200 pc em volta do Sol)
      const dmin = r < 200 ? 0.5 : r - 200;
      const Mmax = starUniforms.uLimit.value + 1.5 - 5 * Math.log10(Math.max(dmin, 0.5) / 10);
      const A = P5.gaiaAbs;
      let lo = 0, hi = A.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (A[mid] <= Mmax) lo = mid + 1; else hi = mid; }
      gaiaPoints.geometry.setDrawRange(0, lo);
    }
  }
  if (psrPoints) {
    psrUniforms.uT.value = (psrUniforms.uT.value + dt) % 1000;
    psrPoints.visible = P5.show.pulsars && r > 0.05 && r < 1e5;
  }
  const far = r > 4e6;
  structGroup.visible = P5.show.structures && far;
  if (far) for (const m of structGroup.children) { place(m, m.userData.s.xyz); m.scale.setScalar(m.userData.s.r * 1e6); }
  gwShell.visible = gwShellDist > 0;
  if (gwShell.visible) { place(gwShell, [0, 0, 0]); gwShell.scale.setScalar(gwShellDist); }
  bhGroup.visible = !!bhSel && v3.dist(F.cam, bhSel.pos) < 2e6 * KM * bhSel.massSun;
  if (bhGroup.visible) {
    place(bhGroup, bhSel.pos);
    bhGroup.scale.setScalar(2.95 * KM * bhSel.massSun); // raio de Schwarzschild
    bhGroup.children[1].visible = !!bhSel.disk;
    bhGroup.children[1].lookAt(new THREE.Vector3(0, 0, 0));
  }
}
export const pulsarPos = p => p.xyz;
export const nearestBhSurface = () => (bhSel ? v3.dist(F.cam, bhSel.pos) - 2.95 * KM * bhSel.massSun : Infinity);
void AU; void LY;
