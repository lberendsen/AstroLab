// O universo distante: 750 mil quasares do SDSS DR16Q (até ~30 bilhões de anos-luz, em distância comóvel)
// e a esfera da radiação cósmica de fundo (Planck), a borda do universo observável a partir da Terra.
import * as THREE from 'three';
import { F, scene, local, place, rteGeometry, pointsMaterial } from '../engine.js';
import { CMB_DISTANCE, v3 } from '../astro.js';

export const QSO = { n: 0, pos: null, z: null, M: null };
const qsoUniforms = { uLimit: { value: 7.0 }, uMap: { value: 0 } };
let points, cmb;

export async function load() {
  try {
    const f = new Float32Array(await (await fetch('data/quasars.bin')).arrayBuffer());
    const n = f.length / 5;
    QSO.n = n;
    QSO.pos = new Float64Array(n * 3); QSO.z = new Float32Array(n); QSO.M = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      QSO.pos[i * 3] = f[i * 5] * 1e6; QSO.pos[i * 3 + 1] = f[i * 5 + 1] * 1e6; QSO.pos[i * 3 + 2] = f[i * 5 + 2] * 1e6;
      QSO.z[i] = f[i * 5 + 3]; QSO.M[i] = f[i * 5 + 4];
    }
  } catch { QSO.n = 0; }
}
// Recordistas da lista curada (quasares e galáxias de alto redshift) entram na mesma nuvem, com brilho estimado
const CURATED_MAG = { 'TON 618': -30.7, 'APM 08279+5255': -31.5, 'ULAS J1342+0928': -26.8, 'J0313-1806': -26.1, 'GN-z11': -21.6, 'JADES-GS-z14-0': -20.8, 'MoM-z14': -20.2 };
export function addCurated(list) {
  const extra = list.filter(o => o.z);
  if (!extra.length || !QSO.n) return;
  const n = QSO.n, m = n + extra.length;
  const pos = new Float64Array(m * 3), z = new Float32Array(m), M = new Float32Array(m);
  pos.set(QSO.pos); z.set(QSO.z); M.set(QSO.M);
  extra.forEach((o, k) => { pos.set(o.xyz, (n + k) * 3); z[n + k] = o.z; M[n + k] = CURATED_MAG[o.id] ?? (o.type === 'qso' ? -27 : -21); });
  Object.assign(QSO, { pos, z, M, nSdss: n, n: m });
}
export const qsoPos = i => [QSO.pos[i * 3], QSO.pos[i * 3 + 1], QSO.pos[i * 3 + 2]];

export function build() {
  if (QSO.n) {
    const g = rteGeometry(QSO.pos);
    g.setAttribute('zred', new THREE.BufferAttribute(QSO.z, 1));
    g.setAttribute('absM', new THREE.BufferAttribute(QSO.M, 1));
    const mat = pointsMaterial({
      uniforms: qsoUniforms,
      vertex: /* glsl */`
        uniform float uLimit, uMap;
        attribute float zred, absM;
        varying vec3 vColor;
        varying float vA;
        void main() {
          vec3 rel = relPos();
          float d = max(length(rel), 1.0);
          float m = absM + 5.0 * log10(d / 10.0);              // brilho visto daqui (perto de um quasar, ele ofusca)
          float b = pow(10.0, -0.4 * (m - uLimit));
          vA = max(clamp(b, 0.0, 1.0), uMap * 0.09);           // no mapa, fraco: 750 mil pontos somados
          gl_PointSize = clamp(2.2 * pow(max(b, 1e-6), 0.22), 1.4, 70.0);
          // cor pelo redshift: perto azul-branco, longe laranja-vermelho
          float t = clamp(zred / 4.5, 0.0, 1.0);
          vColor = t < 0.33 ? mix(vec3(0.55, 0.75, 1.0), vec3(1.0), t / 0.33)
                 : t < 0.66 ? mix(vec3(1.0), vec3(1.0, 0.75, 0.35), (t - 0.33) / 0.33)
                 : mix(vec3(1.0, 0.75, 0.35), vec3(1.0, 0.35, 0.25), (t - 0.66) / 0.34);
          gl_Position = project(rel);
          if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragment: /* glsl */`
        varying vec3 vColor;
        varying float vA;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;
          gl_FragColor = vec4(vColor * (exp(-r2 * 5.0) + 0.3 * exp(-sqrt(r2) * 3.0)) * vA, 1.0);
        }`,
    });
    points = new THREE.Points(g, mat);
    points.frustumCulled = false;
    points.renderOrder = 1;
    scene.add(points);
  }

  // Esfera da radiação cósmica de fundo, centrada na Terra/Sol, com o mapa real do Planck
  const tex = new THREE.TextureLoader().load('textures/cmb-planck.jpg');
  tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  cmb = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uOp: { value: 0 }, uInside: { value: 1 } },
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>
      varying vec3 vDir; varying vec3 vN; varying vec3 vV;
      void main() { vDir = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>
      uniform sampler2D map; uniform float uOp, uInside; varying vec3 vDir; varying vec3 vN; varying vec3 vV;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 d = normalize(vDir);
        float u = fract(0.5 - atan(d.y, d.x) / 6.28318530718);
        float v = 0.5 + asin(clamp(d.z, -1.0, 1.0)) / 3.14159265359;
        vec3 c = texture2D(map, vec2(u, v)).rgb;
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
        float a = uOp * mix(mix(0.05, 1.0, rim), 1.0, uInside);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  }));
  cmb.frustumCulled = false;
  cmb.renderOrder = -500;
  local.add(cmb);
}

export function update() {
  const r = v3.len(F.cam);
  const sm = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  qsoUniforms.uMap.value = sm(2e8, 2e9, r);
  // o quasar mais próximo está a ~200 Mpc: perto de casa a camada não contribui com nada e só custaria GPU
  if (points) points.visible = F.layers.quasars !== false && r > 3e7;
  const inside = r < CMB_DISTANCE;
  cmb.material.uniforms.uInside.value = inside ? 1 : 0;
  cmb.material.uniforms.uOp.value = inside ? 0.16 * sm(3e9, 9e9, r) : 0.9;
  cmb.visible = F.layers.cmb !== false && cmb.material.uniforms.uOp.value > 0.003;
  place(cmb, [0, 0, 0]);
  cmb.scale.setScalar(CMB_DISTANCE);
}

// Clique: o quasar mais próximo da nave entre os que estão sob o cursor
export function pick(ray) {
  if (!points?.visible || !QSO.n) return -1;
  const [cx, cy, cz] = F.cam, p = QSO.pos;
  const cosMax = Math.cos(8 / F.pxPerRad), mapOn = qsoUniforms.uMap.value > 0.1;
  let best = -1, bd = Infinity;
  for (let i = 0; i < (QSO.nSdss ?? QSO.n); i++) { // os recordistas têm rótulo próprio
    const dx = p[i * 3] - cx, dy = p[i * 3 + 1] - cy, dz = p[i * 3 + 2] - cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if ((dx * ray[0] + dy * ray[1] + dz * ray[2]) / d < cosMax) continue;
    if (!mapOn && QSO.M[i] + 5 * Math.log10(d / 10) > 9) continue; // longe do mapa, só os que brilham daqui
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Nome SDSS a partir das coordenadas: SDSS JHHMMSS.ss±DDMMSS.s
export function sdssName(ra, dec) {
  const h = ra / 15, hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = ((h - hh) * 60 - mm) * 60;
  const s = dec < 0 ? '−' : '+', a = Math.abs(dec), dd = Math.floor(a), dm = Math.floor((a - dd) * 60), ds = ((a - dd) * 60 - dm) * 60;
  const p = (x, n, f = 0) => x.toFixed(f).padStart(n + (f ? f + 1 : 0), '0');
  return `SDSS J${p(hh, 2)}${p(mm, 2)}${p(Math.floor(ss * 100) / 100, 2, 2)}${s}${p(dd, 2)}${p(dm, 2)}${p(Math.floor(ds * 10) / 10, 2, 1)}`;
}
