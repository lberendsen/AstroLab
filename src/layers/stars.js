// Estrelas como pontos: o brilho aparente é recalculado na GPU a partir da magnitude absoluta e da distância
// até a nave, então as constelações se deformam e as estrelas acendem ou apagam conforme você viaja.
import * as THREE from 'three';
import { F, scene, rteGeometry, pointsMaterial } from '../engine.js';
import { DB, STARTIME } from '../data.js';
import { yearsSinceJ2000 } from '../time.js';

export const starUniforms = { uLimit: { value: 7.0 }, uFade: { value: 1 }, uYears: { value: 0 } };
let points;

export function build() {
  const s = DB.stars;
  const g = rteGeometry(s.pos);
  g.setAttribute('absmag', new THREE.BufferAttribute(s.absmag, 1));
  g.setAttribute('color', new THREE.BufferAttribute(s.color, 3));
  g.setAttribute('vel', new THREE.BufferAttribute(s.vel, 3));
  const mat = pointsMaterial({
    uniforms: starUniforms,
    vertex: /* glsl */`
      uniform float uLimit, uYears;
      attribute float absmag;
      attribute vec3 color;
      attribute vec3 vel;   // pc/ano
      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlow;
      void main() {
        vec3 rel = relPos() + vel * uYears;   // movimento próprio desde o ano 2000
        float d = max(length(rel), 1e-12);
        float m = absmag + 5.0 * log10(d / 10.0);
        float b = pow(10.0, -0.4 * (m - uLimit));        // fluxo relativo ao limite de visibilidade
        float size = 2.2 * pow(max(b, 1e-6), 0.22);
        vAlpha = clamp(b, 0.0, 1.0);
        vGlow = clamp(log(max(b, 1.0)) / 14.0, 0.0, 1.0);
        gl_PointSize = clamp(size, 2.0, 110.0);
        vColor = color;
        gl_Position = project(rel);
        if (vAlpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragment: /* glsl */`
      uniform float uFade;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlow;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        float core = exp(-r2 * 18.0);
        float halo = exp(-sqrt(r2) * 5.0) * 0.55 * vGlow;
        float spikes = vGlow * 0.35 * (exp(-abs(p.x) * 40.0) + exp(-abs(p.y) * 40.0)) * (1.0 - sqrt(r2));
        vec3 c = mix(vColor, vec3(1.0), core * 0.6);
        gl_FragColor = vec4(c * (core + halo + spikes) * vAlpha * uFade, 1.0);
      }`,
  });
  points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);
}

export function update() {
  points.visible = F.layers.stars !== false;
  STARTIME.years = yearsSinceJ2000();
  starUniforms.uYears.value = STARTIME.years;
}
