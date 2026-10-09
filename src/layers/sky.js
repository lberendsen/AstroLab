// Céu de fundo: mapa real do céu inteiro em projeção cilíndrica (equatorial).
// Vale para quem está perto do Sol; some à medida que a nave se afasta, porque de outro lugar o céu é outro.
import * as THREE from 'three';
import { F, scene, texLoader } from '../engine.js';
import { hips2fitsURL } from '../surveys.js';
import { v3 } from '../astro.js';
import { yearsSinceJ2000 } from '../time.js';

const mat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, uFade: { value: 1 }, uGain: { value: 0.75 }, uDestar: { value: 0 }, uTexel: { value: new THREE.Vector2(1 / 4096, 1 / 2048) } },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = position;
      vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
      gl_Position = p.xyww;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D map;
    uniform float uFade, uGain, uDestar;
    uniform vec2 uTexel;
    varying vec3 vDir;
    float lum(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }
    // fundo em volta de um ponto: o menor entre os pares opostos de vizinhos (uma estrela não sobrevive a isso)
    vec3 around(vec2 uv, float r) {
      vec2 dx = vec2(uTexel.x * r, 0.0), dy = vec2(0.0, uTexel.y * r), dd = vec2(uTexel.x, uTexel.y) * r * 0.7071;
      vec3 a = (texture2D(map, uv + dx).rgb + texture2D(map, uv - dx).rgb) * 0.5;
      vec3 b = (texture2D(map, uv + dy).rgb + texture2D(map, uv - dy).rgb) * 0.5;
      vec3 c = (texture2D(map, uv + dd).rgb + texture2D(map, uv - dd).rgb) * 0.5;
      vec3 e = (texture2D(map, uv + vec2(dd.x, -dd.y)).rgb + texture2D(map, uv - vec2(dd.x, -dd.y)).rgb) * 0.5;
      vec3 m = a;
      if (lum(b) < lum(m)) m = b;
      if (lum(c) < lum(m)) m = c;
      if (lum(e) < lum(m)) m = e;
      return m;
    }
    void main() {
      vec3 d = normalize(vDir);
      float u = fract(0.5 - atan(d.y, d.x) / 6.28318530718);
      float v = 0.5 + asin(clamp(d.z, -1.0, 1.0)) / 3.14159265359;
      vec3 c = texture2D(map, vec2(u, v)).rgb;
      // as estrelas brilhantes da foto também são desenhadas pelo catálogo em 3D. Perto do Sol coincidem; longe dele, as 3D
      // se deslocam e as da foto viravam estrelas duplas. Então, ao sair da vizinhança do Sol, a foto perde as estrelas.
      // (Não vale perto do Sol porque o filtro também apaga o miolo de aglomerados e nebulosas compactas.)
      if (uDestar > 0.0) {
        vec3 m1 = around(vec2(u, v), 2.5), m2 = around(vec2(u, v), 5.0);
        vec3 m = lum(m2) < lum(m1) ? m2 : m1;
        float excess = lum(c) - lum(m);
        c = mix(c, min(c, m * 1.1 + 0.01), smoothstep(0.04, 0.16, excess) * uDestar);
      }
      gl_FragColor = vec4(c * uGain * uFade, 1.0);
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide, depthWrite: false, depthTest: false,
});

const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 96, 48), mat);
mesh.frustumCulled = false;
mesh.renderOrder = -1000;
scene.add(mesh);

const cache = new Map();
function prep(t) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export let currentSky = 'local:mellinger';
export function setSky(id, onDone) {
  currentSky = id;
  if (cache.has(id)) { mat.uniforms.map.value = cache.get(id); onDone?.(true); return; }
  const url = id === 'local:mellinger' ? 'textures/sky-mellinger.jpg'
    : hips2fitsURL(id, { ra: 0, dec: 0, fov: 360, width: 4096, height: 2048, projection: 'CAR' });
  texLoader.load(url, t => {
    cache.set(id, prep(t));
    if (currentSky === id) mat.uniforms.map.value = t;
    onDone?.(true);
  }, undefined, () => onDone?.(false));
}
setSky('local:mellinger');

export function update() {
  const r = v3.len(F.cam);
  // some entre 30 pc e 600 pc do Sol
  const t = Math.min(Math.max((r - 30) / 570, 0), 1);
  // a foto é do céu de hoje: longe no tempo (as estrelas já se moveram), ela some
  const yrs = Math.abs(yearsSinceJ2000());
  const ty = Math.min(Math.max((yrs - 300) / 2700, 0), 1);
  mat.uniforms.uFade.value = (1 - t * t * (3 - 2 * t)) * (1 - ty) * (F.layers.sky === false ? 0 : 1);
  mesh.visible = mat.uniforms.uFade.value > 0.002;
  // supressão das estrelas da foto: de 0,5 a 5 pc do Sol (só na foto Mellinger; os levantamentos ficam intactos)
  const s = Math.min(Math.max((r - 0.5) / 4.5, 0), 1);
  mat.uniforms.uDestar.value = currentSky === 'local:mellinger' ? s : 0;
}
export const skyMaterial = mat;
