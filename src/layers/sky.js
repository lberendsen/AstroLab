// Céu de fundo: mapa real do céu inteiro em projeção cilíndrica (equatorial).
// Vale para quem está perto do Sol; some à medida que a nave se afasta, porque de outro lugar o céu é outro.
import * as THREE from 'three';
import { F, scene, texLoader } from '../engine.js';
import { hips2fitsURL } from '../surveys.js';
import { v3 } from '../astro.js';

const mat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, uFade: { value: 1 }, uGain: { value: 0.75 } },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = position;
      vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
      gl_Position = p.xyww;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D map;
    uniform float uFade, uGain;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float u = fract(0.5 - atan(d.y, d.x) / 6.28318530718);
      float v = 0.5 + asin(clamp(d.z, -1.0, 1.0)) / 3.14159265359;
      vec3 c = texture2D(map, vec2(u, v)).rgb;
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
  mat.uniforms.uFade.value = (1 - t * t * (3 - 2 * t)) * (F.layers.sky === false ? 0 : 1);
  mesh.visible = mat.uniforms.uFade.value > 0.002;
}
export const skyMaterial = mat;
