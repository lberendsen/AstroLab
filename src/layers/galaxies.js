// 43 mil galáxias do 2MASS Redshift Survey, com tamanho físico real e brilho no infravermelho (banda K).
// De perto elas viram foto (ver images.js); de longe, manchas elípticas que desenham a teia cósmica.
import * as THREE from 'three';
import { F, scene, rteGeometry, pointsMaterial } from '../engine.js';
import { DB } from '../data.js';

export const galUniforms = { uGLimit: { value: 13.5 }, uFade: { value: 1 } };
export const galSettings = { limit: 13.5 };
let points;

export function build() {
  const G = DB.gals;
  const g = rteGeometry(G.pos);
  const shape = new Float32Array(G.n * 2);
  for (let i = 0; i < G.n; i++) {
    // orientação e achatamento ilustrativos (o catálogo compacto não guarda o ângulo de posição)
    const h = Math.sin(i * 12.9898) * 43758.5453;
    shape[i * 2] = (h - Math.floor(h)) * Math.PI;
    shape[i * 2 + 1] = G.morph[i] ? 0.25 + 0.75 * Math.abs(Math.sin(i * 7.31)) : 0.55 + 0.45 * Math.abs(Math.sin(i * 3.7));
  }
  g.setAttribute('absK', new THREE.BufferAttribute(G.absK, 1));
  g.setAttribute('radius', new THREE.BufferAttribute(G.radius, 1));
  g.setAttribute('morph', new THREE.BufferAttribute(G.morph, 1));
  g.setAttribute('shape', new THREE.BufferAttribute(shape, 2));
  const mat = pointsMaterial({
    uniforms: galUniforms,
    vertex: /* glsl */`
      uniform float uGLimit;
      attribute float absK, radius, morph;
      attribute vec2 shape;
      varying vec3 vColor;
      varying float vAlpha;
      varying vec2 vShape;
      void main() {
        vec3 rel = relPos();
        float d = max(length(rel), 1e-6);
        float px = 2.0 * radius / d * uPx;
        float m = absK + 5.0 * log10(d / 10.0);
        float b = pow(10.0, -0.4 * (m - uGLimit));
        vAlpha = clamp(b, 0.0, 1.0) * clamp(6.0 / max(px, 1.0), 0.18, 1.0) * smoothstep(1200.0, 300.0, px);
        if (px < 2.0) vAlpha *= px / 2.0 + 0.6;
        vColor = morph < 0.5 ? vec3(1.0, 0.82, 0.62) : vec3(0.72, 0.82, 1.0);
        vShape = shape;
        gl_PointSize = clamp(px, 2.0, 1200.0);
        gl_Position = project(rel);
        if (vAlpha < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragment: /* glsl */`
      uniform float uFade;
      varying vec3 vColor;
      varying float vAlpha;
      varying vec2 vShape;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float c = cos(vShape.x), s = sin(vShape.x);
        p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
        p.y /= vShape.y;
        float r = length(p);
        if (r > 1.0) discard;
        float i = exp(-r * 5.0) + 0.5 * exp(-r * r * 40.0);
        gl_FragColor = vec4(vColor * i * vAlpha * uFade, 1.0);
      }`,
  });
  points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 1;
  scene.add(points);
}

export function update() {
  points.visible = F.layers.galaxies !== false;
  // longe do Grupo Local, "abre o diafragma" para que a teia cósmica fique visível
  const r = Math.hypot(...F.cam);
  galUniforms.uGLimit.value = galSettings.limit + Math.min(Math.max(3 * Math.log10(r / 2e7), 0), 6);
}
