// Modelo da Via Láctea vista de fora. Ninguém tem foto dela de fora; isto é um modelo com parâmetros medidos:
// disco exponencial (escala 2,6 kpc), barra de ~5 kpc inclinada 27°, 4 braços espirais com passo de 12°,
// Sol a 8,18 kpc do centro entre os braços de Perseu e Sagitário. Some quando a nave está perto do Sol.
import * as THREE from 'three';
import { F, scene, rteGeometry, pointsMaterial } from '../engine.js';
import { gal2eq, GC_DIST, v3 } from '../astro.js';

const uniforms = { uFade: { value: 0 } };
let points;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function build() {
  const R = rng(42);
  const gauss = () => { let u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
  const pts = [], col = [], size = [];
  const k = Math.tan(12 * Math.PI / 180);
  const phi0 = Math.PI - Math.log(10.0 / 8.178) / k; // Perseu passa a 10 kpc do centro na direção do Sol
  // galactocêntrico com eixo x do Sol para o centro: o Sol fica em (-8178, 0, +20)
  const push = (x, y, z, c, s) => {
    const g = [GC_DIST + x, y, z - 6.6];
    pts.push(...gal2eq(g)); col.push(...c); size.push(s);
  };
  const bar = 27 * Math.PI / 180;
  // bojo e barra
  for (let i = 0; i < 22000; i++) {
    const a = gauss() * 1800, b = gauss() * 650, z = gauss() * 450;
    const x = a * Math.cos(bar) - b * Math.sin(bar), y = a * Math.sin(bar) + b * Math.cos(bar);
    const w = 0.5 + 0.1 * R();
    push(-x, y, z, [1.0 * w, 0.78 * w, 0.52 * w], 260 + R() * 260);
  }
  // braços
  for (let arm = 0; arm < 4; arm++) {
    const major = arm % 2 === 0; // Perseu e Escudo-Centauro são os braços principais
    const n = major ? 26000 : 15000;
    for (let i = 0; i < n; i++) {
      const r = 2600 + Math.pow(R(), 0.8) * 13500;
      const phi = phi0 + arm * Math.PI / 2 + Math.log(r / 8178) / k;
      const spread = 260 + r * 0.035;
      const ox = gauss() * spread, oy = gauss() * spread;
      const x = r * Math.cos(phi) + ox, y = r * Math.sin(phi) + oy;
      const z = gauss() * (90 + r * 0.008);
      const hii = R() < 0.05;
      const c = hii ? [1.0, 0.45, 0.62] : R() < 0.5 ? [0.66, 0.78, 1.0] : [0.92, 0.93, 1.0];
      const w = Math.exp(-r / 6500) * 1.6 + 0.25;
      push(x, y, z, c.map(v => v * w), hii ? 70 + R() * 120 : 140 + R() * 180);
    }
  }
  // esporão de Órion (onde o Sol está)
  for (let i = 0; i < 2500; i++) {
    const t = (R() - 0.5) * 4000;
    const x = -8250 + t * 0.25 + gauss() * 350, y = t + gauss() * 350;
    push(x, y, gauss() * 80, [0.32, 0.35, 0.42], 160 + R() * 120);
  }
  // disco difuso entre os braços
  for (let i = 0; i < 40000; i++) {
    const r = -2600 * Math.log(1 - R() * 0.995);
    const phi = R() * 2 * Math.PI;
    const z = gauss() * 300;
    const w = 0.55;
    push(r * Math.cos(phi), r * Math.sin(phi), z, [1.0 * w, 0.88 * w, 0.72 * w], 220 + R() * 200);
  }

  const g = rteGeometry(new Float64Array(pts));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(size), 1));
  const mat = pointsMaterial({
    uniforms,
    vertex: /* glsl */`
      attribute vec3 color;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vec3 rel = relPos();
        float d = max(length(rel), 1.0);
        float px = 2.0 * size / d * uPx;
        float a = 0.05 * min(1.0, px * px / 4.0) * clamp(40.0 / px, 0.08, 1.0);
        vColor = color * a;
        gl_PointSize = clamp(px, 2.0, 300.0);
        gl_Position = project(rel);
      }`,
    fragment: /* glsl */`
      uniform float uFade;
      varying vec3 vColor;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        gl_FragColor = vec4(vColor * exp(-r2 * 4.0) * uFade, 1.0);
      }`,
  });
  points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  scene.add(points);
}

export function update() {
  const r = v3.len(F.cam);
  const t = Math.min(Math.max((r - 600) / 5000, 0), 1);
  uniforms.uFade.value = t * t * (3 - 2 * t);
  points.visible = F.layers.milkyway !== false && uniforms.uFade.value > 0.001;
}
