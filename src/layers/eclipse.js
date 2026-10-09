// Sombras de eclipse calculadas pixel a pixel: cada ponto da superfície mede quanto do disco do Sol está tapado
// pelos corpos à sua frente (área de sobreposição de dois discos). Dá sozinho a umbra, a penumbra e o eclipse anular.
//   Terra  ← sombra da Lua (eclipse solar)
//   Lua    ← sombra da Terra (eclipse lunar), com o tom avermelhado da luz filtrada pela atmosfera da Terra
//   Júpiter ← sombras de Io, Europa, Ganimedes e Calisto
import * as THREE from 'three';
import { F } from '../engine.js';
import { BODY } from './solar.js';
import { R_SUN } from '../astro.js';

const MAX_OCC = 4;
export const patched = []; // { key, occluders, uniforms }

const vertexInject = /* glsl */`
  #include <project_vertex>
  vEclW = (modelMatrix * vec4(transformed, 1.0)).xyz;`;
const fragHead = /* glsl */`
  varying vec3 vEclW;
  uniform vec4 uEclSun;            // posição (cena) e raio do Sol
  uniform vec4 uEclOcc[${MAX_OCC}];   // posição e raio de cada corpo que pode fazer sombra
  uniform int uEclN;
  uniform float uEclRed;           // 1 = luz avermelhada dentro da umbra (Lua)
  uniform float uEclBoost;           // realce da penumbra (0 = físico)
  // área de sobreposição de dois discos (aproximação suave: a fórmula exata perde precisão na GPU
  // quando os dois discos têm quase o mesmo tamanho, que é justamente o caso do Sol e da Lua)
  float eclLens(float r1, float r2, float d) {
    float rmin = min(r1, r2), rmax = max(r1, r2);
    if (d >= r1 + r2) return 0.0;
    float full = 3.14159265 * rmin * rmin;
    if (d <= rmax - rmin) return full;
    return full * smoothstep(0.0, 1.0, (r1 + r2 - d) / (2.0 * rmin));
  }
  // fração do disco do Sol tapada, vista do ponto p
  float eclCover(vec3 p) {
    vec3 s = uEclSun.xyz - p; float ds = length(s); vec3 sn = s / ds;
    float as = uEclSun.w / ds, cover = 0.0;
    for (int k = 0; k < ${MAX_OCC}; k++) {
      if (k >= uEclN) break;
      vec3 o = uEclOcc[k].xyz - p; float dO = length(o);
      if (dO > ds) continue;                         // atrás do Sol: não tapa
      float ao = uEclOcc[k].w / dO;
      float th = 2.0 * asin(clamp(length(sn - o / dO) * 0.5, 0.0, 1.0)); // ângulo entre Sol e corpo (estável para ângulos pequenos)
      cover = max(cover, eclLens(as, ao, th) / (3.14159265 * as * as));
    }
    return clamp(cover, 0.0, 1.0);
  }`;
const fragInject = /* glsl */`
  #include <lights_fragment_end>
  {
    float f = eclCover(vEclW);
    vec3 lit = reflectedLight.directDiffuse;
    // contraste realçado: a penumbra real é suave demais para se notar na tela (50% de luz parece 75% de brilho)
    float shade = pow(1.0 - f, 1.0 + uEclBoost);
    reflectedLight.directDiffuse = lit * shade + lit * vec3(0.55, 0.16, 0.06) * 0.22 * uEclRed * smoothstep(0.88, 1.0, f);  }`;

function patch(material, uniforms) {
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec3 vEclW;\n' + sh.vertexShader.replace('#include <project_vertex>', vertexInject);
    sh.fragmentShader = fragHead + '\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', fragInject);
  };
  material.needsUpdate = true;
}

export function build() {
  const def = [['Earth', ['Moon'], 0], ['Moon', ['Earth'], 1], ['Jupiter', ['Io', 'Europa', 'Ganymede', 'Callisto'], 0]];
  for (const [key, occ, red] of def) {
    const b = BODY[key];
    if (!b?.mesh) continue;
    const uniforms = {
      uEclSun: { value: new THREE.Vector4() },
      uEclOcc: { value: Array.from({ length: MAX_OCC }, () => new THREE.Vector4()) },
      uEclN: { value: occ.length }, uEclRed: { value: red }, uEclBoost: { value: 1.2 },
    };
    patch(b.mesh.material, uniforms);
    if (b.cloudMesh) patch(b.cloudMesh.material, uniforms);
    patched.push({ key, occ, uniforms });
  }
}

// posições relativas à câmera, na escala da cena (como o resto do grupo local)
const rel = (p, out, r) => out.set((p[0] - F.cam[0]) * F.S, (p[1] - F.cam[1]) * F.S, (p[2] - F.cam[2]) * F.S, r * F.S);
export function update() {
  for (const P of patched) {
    rel([0, 0, 0], P.uniforms.uEclSun.value, R_SUN);
    P.occ.forEach((k, i) => { const b = BODY[k]; rel(b.pos, P.uniforms.uEclOcc.value[i], b.radius); });
  }
}
