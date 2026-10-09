// Fotos reais de nebulosas e galáxias: quando um objeto fica grande na tela, pede-se ao hips2fits (CDS)
// um recorte da melhor imagem disponível — JWST, Hubble, DESI Legacy ou DSS — e ele vira um painel no espaço.
// A foto é a vista da Terra; de outros ângulos ela continua sendo essa mesma foto.
import * as THREE from 'three';
import { F, local, camera } from '../engine.js';
import { DB, galPos } from '../data.js';
import { hips2fitsURL } from '../surveys.js';
import { v3, xyz2radec, DEG } from '../astro.js';

const DEFAULT_ARCMIN = { neb: 50, pn: 4, snr: 20, open: 40, glob: 18, gal: 10, cluster: 8, qso: 2, bh: 12 };
const cache = new Map();    // chave -> { state, tex, survey }
const shown = new Map();    // chave -> mesh
const MAX_SHOWN = 14;

const alphaTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.75, '#fff'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const planeGeo = new THREE.PlaneGeometry(1, 1);

// Descrição da foto de um objeto curado ou de uma galáxia do 2MRS
// Tamanho físico de um recorte: em distâncias cosmológicas vale a distância de diâmetro angular, d/(1+z)
export function photoSpec(obj) {
  if (obj.qso != null) {
    const z = obj.z;
    return { key: 'q:' + obj.qso, ra: obj.ra, dec: obj.dec, arcmin: 1.5, pos: obj.pos(), distSun: v3.len(obj.pos()) / (1 + z), noBillboard: true,
      surveys: ['CDS/P/DESI-Legacy-Surveys/DR10/color', 'CDS/P/SDSS9/color', 'CDS/P/PanSTARRS/DR1/color-z-zg-g', 'CDS/P/DSS2/color'] };
  }
  if (obj.curated) {
    const o = obj.curated;
    const arcmin = Math.min(Math.max((o.maj || DEFAULT_ARCMIN[o.type] || 10) * 1.5, 2), 600);
    return { key: 'c:' + o.id, ra: o.ra, dec: o.dec, arcmin, pos: o.xyz, distSun: o.z ? o.d / (1 + o.z) : o.d, noBillboard: o.type === 'qso' || o.z > 1,
      surveys: o.type === 'qso' ? ['CDS/P/DESI-Legacy-Surveys/DR10/color', 'CDS/P/SDSS9/color', 'CDS/P/PanSTARRS/DR1/color-z-zg-g', 'CDS/P/DSS2/color'] : undefined };
  }
  if (obj.gal != null) {
    const p = galPos(obj.gal), { ra, dec, d } = xyz2radec(p);
    const arcmin = Math.min(Math.max(2 * DB.gals.radius[obj.gal] / d / DEG * 60 * 1.6, 1.5), 120);
    return { key: 'g:' + obj.gal, ra, dec, arcmin, pos: p, distSun: d };
  }
  if (obj.simbad) {
    const s = obj.simbad;
    const arcmin = Math.min(Math.max((s.maj || 6) * 1.5, 2), 600);
    return { key: 's:' + s.oid, ra: s.ra, dec: s.dec, arcmin, pos: s.xyz, distSun: s.d };
  }
  return null;
}

function surveysFor(spec) {
  if (spec.surveys) return spec.surveys;
  const list = [];
  if (spec.arcmin < 25) list.push('CDS/P/JWST/EPO', 'CDS/P/HST/EPO');
  if (spec.arcmin < 60) list.push('CDS/P/DESI-Legacy-Surveys/DR10/color');
  if (spec.arcmin > 400) list.push('CDS/P/Mellinger/color');
  list.push('CDS/P/DSS2/color');
  return list;
}

// Carrega a imagem e verifica cobertura (levantamentos parciais devolvem preto fora da área coberta)
function tryLoad(url, minCover, litMin = 12) {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 48;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 48, 48);
      const d = g.getImageData(0, 0, 48, 48).data;
      let lit = 0, center = 0;
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] + d[i + 1] + d[i + 2];
        if (v > litMin && v < 720) lit++; // branco puro = sem cobertura em alguns levantamentos
        const px = (i / 4) % 48, py = Math.floor(i / 4 / 48);
        if (Math.abs(px - 24) < 8 && Math.abs(py - 24) < 8 && v > 30) center++;
      }
      res(lit / (48 * 48) >= minCover && center > 40 ? img : null);
    };
    img.onerror = () => res(null);
    img.src = url;
  });
}

// Fora da área coberta, alguns levantamentos (JWST/HST) vêm em branco. Pinta de preto as regiões quase brancas
// ligadas às bordas (preenchimento por inundação), sem tocar no núcleo saturado das estrelas.
function clearBlankEdges(img) {
  const c = document.createElement('canvas');
  const w = c.width = img.naturalWidth, h = c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, w, h), d = id.data;
  const white = p => d[p * 4] > 240 && d[p * 4 + 1] > 240 && d[p * 4 + 2] > 240;
  const seen = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !white(p)) continue;
    seen[p] = 1;
    d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
  }
  g.putImageData(id, 0, 0);
  return c;
}

export async function fetchPhoto(spec, size = 512) {
  let entry = cache.get(spec.key);
  if (entry) return entry.ready;
  entry = { state: 'loading' };
  cache.set(spec.key, entry);
  entry.ready = (async () => {
    for (const s of surveysFor(spec)) {
      const url = hips2fitsURL(s, { ra: spec.ra, dec: spec.dec, fov: spec.arcmin / 60, width: size, height: size });
      // imagens de divulgação: fora da área coberta vem cinza-escuro, não preto
      const img = await tryLoad(url, s.includes('EPO') ? 0.6 : 0.85, s.includes('EPO') ? 60 : 12);
      if (img) {
        const canvas = clearBlankEdges(img);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        Object.assign(entry, { state: 'ok', tex, survey: s, url, dataURL: canvas.toDataURL('image/jpeg', 0.9) });
        return entry;
      }
    }
    entry.state = 'none';
    return entry;
  })();
  return entry.ready;
}

// Candidatos: objetos curados e galáxias que aparecem grandes na tela
const _v = new THREE.Vector3();
function candidates() {
  const out = [];
  const consider = (obj, spec) => {
    if (spec.noBillboard) return; // quasares são pontos; a foto do campo só aparece na ficha
    const d = v3.dist(F.cam, spec.pos);
    const size = spec.distSun * Math.tan(spec.arcmin / 60 * DEG); // tamanho físico do recorte
    const px = size / Math.max(d, 1e-9) * F.pxPerRad;
    if (px < 70) return;
    _v.set(spec.pos[0] - F.cam[0], spec.pos[1] - F.cam[1], spec.pos[2] - F.cam[2]).normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (_v.dot(fwd) < -0.2 && d > size) return;
    out.push({ obj, spec, px, d, size });
  };
  for (const o of DB.curated) consider({ curated: o }, photoSpec({ curated: o }));
  for (const i of bigGalaxies) consider({ gal: i }, photoSpec({ gal: i }));
  if (extra) consider(extra, photoSpec(extra));
  out.sort((a, b) => b.px - a.px);
  return out.slice(0, MAX_SHOWN);
}

// Galáxias do 2MRS que podem estar grandes na tela (pré-filtro barato a cada ~1 s)
let bigGalaxies = [];
let extra = null; // objeto do SIMBAD selecionado pela busca
export function setExtra(obj) { extra = obj?.simbad ? obj : null; }

let frame = 0;
export function update() {
  const on = F.layers.photos !== false;
  if (frame++ % 60 === 0) {
    const G = DB.gals, [cx, cy, cz] = F.cam;
    bigGalaxies = [];
    for (let i = 0; i < G.n; i++) {
      const dx = G.pos[i * 3] - cx, dy = G.pos[i * 3 + 1] - cy, dz = G.pos[i * 3 + 2] - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (G.radius[i] * 3 / d * F.pxPerRad > 50) bigGalaxies.push(i);
    }
  }
  const want = on ? (frame % 10 === 0 ? candidates() : null) : [];
  if (want) {
    const keys = new Set(want.map(c => c.spec.key));
    for (const [k, m] of shown) if (!keys.has(k)) { local.remove(m); m.material.dispose(); shown.delete(k); }
    for (const c of want) {
      if (shown.has(c.spec.key)) { shown.get(c.spec.key).userData.c = c; continue; }
      const e = cache.get(c.spec.key);
      if (!e) { fetchPhoto(c.spec); continue; }
      if (e.state !== 'ok') continue;
      const m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: e.tex, alphaMap: alphaTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      m.userData.c = c;
      m.renderOrder = 3;
      local.add(m);
      shown.set(c.spec.key, m);
    }
  }
  for (const m of shown.values()) {
    const { spec, size } = m.userData.c;
    m.position.set(spec.pos[0] - F.cam[0], spec.pos[1] - F.cam[1], spec.pos[2] - F.cam[2]);
    m.quaternion.copy(camera.quaternion);
    m.scale.setScalar(size);
    const d = v3.dist(F.cam, spec.pos);
    const px = size / d * F.pxPerRad;
    // aparece aos poucos e some quando a nave atravessa o painel
    const target = 0.55 * Math.min(1, (px - 70) / 80) * Math.min(1, Math.max(0, (d / size - 0.25) / 0.5));
    m.material.opacity += (Math.max(target, 0) - m.material.opacity) * 0.08;
  }
}

export function photoInfo(obj) {
  const spec = photoSpec(obj);
  return spec ? cache.get(spec.key) : null;
}
