// Pinta o globo 3D com imagens reais de satélites:
//  - mosaicos diários globais (NASA GIBS) feitos por um satélite específico (NOAA-20, Terra, Aqua…)
//  - "Terra ao vivo": mosaico dos geoestacionários (GOES-Leste, GOES-Oeste, Meteosat-12, Meteosat-9 e Himawari-9),
//    cada pixel pesado pelo satélite que o vê mais de frente.
import * as THREE from 'three';
import { BODY } from './layers/solar.js';

export const skin = { active: null, label: '', time: null };
let original = null, timer = null;
const W = 4096, H = 2048;

// tempo-limite: uma fonte fora do ar não pode travar o mosaico inteiro
const loadImg = (src, cors = true, ms = 40000) => new Promise((res, rej) => {
  const i = new Image();
  const tm = setTimeout(() => { i.src = ''; rej(new Error('tempo esgotado: ' + src.slice(0, 90))); }, ms);
  if (cors) i.crossOrigin = 'anonymous';
  i.onload = () => { clearTimeout(tm); res(i); }; i.onerror = () => { clearTimeout(tm); rej(new Error('falhou: ' + src.slice(0, 90))); };
  i.src = src;
});
const proxied = u => '/proxy?u=' + encodeURIComponent(u);
const gibs = (layer, { w = W, h = H, time, png = false } = {}) =>
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?' + new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer, CRS: 'EPSG:4326', BBOX: '-90,-180,90,180',
    WIDTH: w, HEIGHT: h, FORMAT: png ? 'image/png' : 'image/jpeg', TRANSPARENT: png ? 'TRUE' : 'FALSE', ...(time ? { TIME: time } : {}) });
const eumet = (layer, w, h) => proxied('https://view.eumetsat.int/geoserver/ows?' + new URLSearchParams({
  service: 'WMS', request: 'GetMap', version: '1.3.0', layers: layer, crs: 'EPSG:4326', bbox: '-90,-180,90,180', width: w, height: h, format: 'image/png', transparent: 'true' }));

function canvasOf(img, w = W, h = H) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (img) g.drawImage(img, 0, 0, w, h);
  return { c, g };
}

function setEarthMap(canvas, label, hideClouds = true) {
  const e = BODY.Earth;
  if (!original) original = { map: e.mesh.material.map, clouds: e.cloudMesh?.visible ?? true };
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  e.mesh.material.map?.dispose?.();
  e.mesh.material.map = t; e.mesh.material.needsUpdate = true;
  if (e.cloudMesh) e.cloudMesh.visible = !hideClouds;
  skin.label = label;
}

export function restore() {
  clearInterval(timer); timer = null;
  if (!original) return;
  const e = BODY.Earth;
  if (e.mesh.material.map !== original.map) e.mesh.material.map?.dispose?.();
  e.mesh.material.map = original.map; e.mesh.material.needsUpdate = true;
  if (e.cloudMesh) e.cloudMesh.visible = original.clouds;
  original = null; skin.active = null; skin.label = ''; skin.time = null;
}

// Base sem nuvens (textura padrão) por baixo, para os buracos entre as faixas das órbitas e os polos
let baseImg = null;
async function base() { return baseImg ||= await loadImg('textures/2k_earth_daymap.jpg'); }

// ---------------------------------------------------------------- mosaico diário de um satélite
export async function applyDaily(layer, label, { overlay, date } = {}) {
  // o mosaico de hoje ainda está sendo montado: usa o de ontem (UTC)
  const day = date || new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const [b, img, ov] = await Promise.all([base(), loadImg(gibs(layer, { time: day, png: true })), overlay ? loadImg(gibs(overlay, { time: day, png: true })) : null]);
  const { c, g } = canvasOf(b);
  g.drawImage(img, 0, 0, W, H);
  if (ov) g.drawImage(ov, 0, 0, W, H);
  setEarthMap(c, `${label} · ${day.split('-').reverse().join('/')}`);
  skin.active = layer; skin.time = new Date(day + 'T12:00:00Z');
  return c;
}

// ---------------------------------------------------------------- Terra ao vivo (geoestacionários)
const RE = 6378.137, HSAT = 42164;
const LW = 2048, LH = 1024;

// Disco cheio (imagem quadrada com a Terra encostando nas bordas) -> mapa equirretangular, para o Himawari
function reprojectDisk(img, subLon) {
  const n = img.naturalWidth;
  const src = canvasOf(img, n, n).g.getImageData(0, 0, n, n).data;
  const out = new Uint8ClampedArray(LW * LH * 4);
  const tanMax = RE / Math.sqrt(HSAT * HSAT - RE * RE), r = n / 2;
  for (let j = 0; j < LH; j++) {
    const lat = (0.5 - (j + 0.5) / LH) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < LW; i++) {
      const dl = ((i + 0.5) / LW - 0.5) * 2 * Math.PI - subLon * Math.PI / 180;
      const x = RE * cl * Math.cos(dl), y = RE * cl * Math.sin(dl), z = RE * sl;
      if (x * HSAT < RE * RE * 1.0005) continue; // fora do disco visível
      const px = r + (y / (HSAT - x)) / tanMax * r, py = r - (z / (HSAT - x)) / tanMax * r;
      const sx = px | 0, sy = py | 0;
      if (sx < 0 || sy < 0 || sx >= n || sy >= n) continue;
      const s = (sy * n + sx) * 4, o = (j * LW + i) * 4;
      out[o] = src[s]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + 2]; out[o + 3] = 255;
    }
  }
  return out;
}

async function himawariDisk() {
  const latest = await (await fetch(proxied('https://himawari8.nict.go.jp/img/D531106/latest.json'), { signal: AbortSignal.timeout(20000) })).json();
  const d = latest.date.replace(/[-: ]/g, '');
  const path = `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}/${d.slice(8, 14)}`;
  // 2×2 blocos de 550 px = disco de 1100 px
  const tiles = await Promise.all([0, 1].flatMap(x => [0, 1].map(y => loadImg(proxied(`https://himawari8.nict.go.jp/img/D531106/2d/550/${path}_${x}_${y}.png`)).then(img => ({ x, y, img })))));
  const { c, g } = canvasOf(null, 1100, 1100);
  for (const t of tiles) g.drawImage(t.img, t.x * 550, t.y * 550);
  const img = await loadImg(c.toDataURL('image/png'));
  return { img, time: new Date(latest.date.replace(' ', 'T') + 'Z') };
}

export const LIVE_SOURCES = [
  { key: 'goesE', name: 'GOES-19 (GOES-Leste, EUA)', lon: -75.2, url: () => gibs('GOES-East_ABI_GeoColor', { w: LW, h: LH, png: true }) },
  { key: 'goesW', name: 'GOES-18 (GOES-Oeste, EUA)', lon: -137.0, url: () => gibs('GOES-West_ABI_GeoColor', { w: LW, h: LH, png: true }) },
  { key: 'mtg', name: 'Meteosat-12 (Europa)', lon: 0, url: () => eumet('mtg_fd:rgb_geocolour', LW, LH) },
  { key: 'iodc', name: 'Meteosat-9 (Europa, sobre o Índico)', lon: 45.5, url: () => eumet('msg_iodc:rgb_naturalenhncd', LW, LH) },
  { key: 'him', name: 'Himawari-9 (Japão)', lon: 140.7, disk: true },
];

export async function applyLive(onProgress) {
  const results = await Promise.all(LIVE_SOURCES.map(async s => {
    try {
      if (s.disk) { const { img, time } = await himawariDisk(); return { s, px: reprojectDisk(img, s.lon), time }; }
      const img = await loadImg(s.url());
      return { s, px: canvasOf(img, LW, LH).g.getImageData(0, 0, LW, LH).data };
    } catch (e) { console.warn(s.name, e); return null; } finally { onProgress?.(s.name); }
  }));
  const ok = results.filter(Boolean);
  if (!ok.length) throw new Error('nenhum satélite respondeu');
  const b = await base();
  const { c, g } = canvasOf(b, LW, LH);
  const outImg = g.getImageData(0, 0, LW, LH), out = outImg.data;
  for (let j = 0; j < LH; j++) {
    const lat = (0.5 - (j + 0.5) / LH) * Math.PI, cl = Math.cos(lat);
    for (let i = 0; i < LW; i++) {
      const lon = ((i + 0.5) / LW - 0.5) * 360;
      let r = 0, gg = 0, bb = 0, wsum = 0;
      const o = (j * LW + i) * 4;
      for (const { s, px } of ok) {
        if (px[o + 3] < 128 || px[o] + px[o + 1] + px[o + 2] === 0 && !s.disk) continue;
        // peso = quanto o satélite vê o ponto de frente (cosseno do ângulo a partir do ponto subsatélite)
        const w = cl * Math.cos((lon - s.lon) * Math.PI / 180) - 0.15;
        if (w <= 0) continue;
        const w2 = w * w * w;
        r += px[o] * w2; gg += px[o + 1] * w2; bb += px[o + 2] * w2; wsum += w2;
      }
      if (wsum > 0) {
        const k = Math.min(1, wsum * 8); // perto da borda de cobertura, mistura com a base
        out[o] = out[o] * (1 - k) + r / wsum * k; out[o + 1] = out[o + 1] * (1 - k) + gg / wsum * k; out[o + 2] = out[o + 2] * (1 - k) + bb / wsum * k;
      }
    }
  }
  g.putImageData(outImg, 0, 0);
  setEarthMap(c, `Terra ao vivo · ${ok.length} satélites geoestacionários`);
  skin.active = 'live'; skin.time = new Date(); skin.sources = ok.map(x => x.s.name);
  clearInterval(timer);
  timer = setInterval(() => applyLive().catch(() => {}), 15 * 60e3); // atualiza a cada 15 min
  return { canvas: c, sources: skin.sources };
}

export const gibsPreview = (layer, time, overlay) => gibs(layer, { w: 1024, h: 512, time, png: false }) + (overlay ? '' : '');
