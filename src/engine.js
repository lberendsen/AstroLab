// Renderização com origem flutuante: a câmera fica sempre na origem da cena e tudo é desenhado
// em posição relativa a ela, calculada em double no JS (malhas) ou em double emulado na GPU (nuvens de pontos).
// A escala de renderização S (unidades de cena por parsec) acompanha a distância à superfície mais próxima,
// o que mantém o buffer de profundidade logarítmico útil de 1 km até bilhões de anos-luz.
import * as THREE from 'three';

export const F = {
  cam: [0, 0, 0],               // posição da câmera em parsecs (double)
  camHi: new THREE.Vector3(),
  camLo: new THREE.Vector3(),
  S: 1,                         // unidades de cena por parsec
  near: 1,                      // distância (pc) até a superfície mais próxima
  pxPerRad: 1000,               // pixels por radiano no centro da tela
  width: 1, height: 1,
  dt: 0,
  date: new Date(),             // instante simulado
  timeRate: 1,                  // segundos simulados por segundo real
  layers: {},                   // camadas visíveis
};

export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('view'), antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(60, 1, 1e-3, 1e33);
camera.position.set(0, 0, 0);
scene.add(camera);

// Grupo das malhas próximas: filhos posicionados em parsecs relativos à câmera, o grupo aplica a escala S
export const local = new THREE.Group();
scene.add(local);

export function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  F.width = w; F.height = h;
  F.pxPerRad = h / (2 * Math.tan(camera.fov * Math.PI / 360));
}
addEventListener('resize', resize);
resize();

// Coloca uma malha na posição absoluta p (pc), relativa à câmera
export function place(obj, p) {
  obj.position.set(p[0] - F.cam[0], p[1] - F.cam[1], p[2] - F.cam[2]);
}

export function beginFrame() {
  const hx = Math.fround(F.cam[0]), hy = Math.fround(F.cam[1]), hz = Math.fround(F.cam[2]);
  F.camHi.set(hx, hy, hz);
  F.camLo.set(F.cam[0] - hx, F.cam[1] - hy, F.cam[2] - hz);
  F.S = 1 / Math.max(F.near, 1e-16);
  local.scale.setScalar(F.S);
  pointUniforms.camHi.value.copy(F.camHi);
  pointUniforms.camLo.value.copy(F.camLo);
  pointUniforms.uS.value = F.S;
  pointUniforms.uPx.value = F.pxPerRad * renderer.getPixelRatio();
}

// Uniformes compartilhados por todas as nuvens de pontos
export const pointUniforms = {
  camHi: { value: new THREE.Vector3() },
  camLo: { value: new THREE.Vector3() },
  uS: { value: 1 },
  uPx: { value: 1000 },
};

export const RTE_VERTEX = /* glsl */`
  uniform vec3 camHi;
  uniform vec3 camLo;
  uniform float uS;
  uniform float uPx;
  attribute vec3 posLo;
  vec3 relPos() { return (position - camHi) + (posLo - camLo); }
  vec4 project(vec3 rel) { return projectionMatrix * viewMatrix * vec4(rel * uS, 1.0); }
  float log10(float x) { return log(x) * 0.4342944819; }
`;

// Cria geometria de pontos a partir de posições Float64 (pc)
export function rteGeometry(pos64) {
  const n = pos64.length / 3;
  const hi = new Float32Array(n * 3), lo = new Float32Array(n * 3);
  for (let i = 0; i < pos64.length; i++) {
    const h = Math.fround(pos64[i]);
    hi[i] = h; lo[i] = pos64[i] - h;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(hi, 3));
  g.setAttribute('posLo', new THREE.BufferAttribute(lo, 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return g;
}

export function pointsMaterial({ uniforms = {}, vertex, fragment, blending = THREE.AdditiveBlending }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...pointUniforms, ...uniforms },
    vertexShader: `#include <common>\n#include <logdepthbuf_pars_vertex>\n${RTE_VERTEX}\n${vertex}`.replace(/}\s*$/, '#include <logdepthbuf_vertex>\n}'),
    fragmentShader: `#include <common>\n#include <logdepthbuf_pars_fragment>\n${fragment}`.replace(/}\s*$/, '#include <logdepthbuf_fragment>\n}'),
    transparent: true, depthWrite: false, depthTest: true, blending,
  });
}

export const texLoader = new THREE.TextureLoader();
export function loadTex(url, srgb = true) {
  const t = texLoader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
