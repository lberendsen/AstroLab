// Transmissões: o que os aparelhos do catálogo mandam para a Terra.
// Cada canal sabe de qual satélite/nave vem, busca a imagem (ou lista de imagens) mais recente e abre no visualizador.
import * as THREE from 'three';
import { F, local, place } from './engine.js';
import { BODY, surfacePoint } from './layers/solar.js';
import { SAT } from './layers/sats.js';
import { CRAFT } from './layers/craft.js';
import { applyDaily, applyLive, restore, skin, LIVE_SOURCES } from './earthskin.js';
import { fmtNum, fmtDist, KM } from './astro.js';

const $ = id => document.getElementById(id);
const proxied = u => '/proxy?u=' + encodeURIComponent(u);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const gibsMap = (layers, bbox = '-90,-180,90,180', w = 1600, h = 800, time = yesterday()) => 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?' +
  new URLSearchParams({ SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layers, CRS: 'EPSG:4326', BBOX: bbox, WIDTH: w, HEIGHT: h, FORMAT: 'image/jpeg', TIME: time });

export function timeAgo(d) {
  if (!d || isNaN(d)) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 0) return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  if (s < 90) return 'agora há pouco';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${fmtNum(s / 3600, s < 36000 ? 1 : 0)} h`;
  if (s < 86400 * 45) return `há ${Math.round(s / 86400)} dias`;
  return d.toLocaleDateString('pt-BR');
}

// Data da imagem pelo cabeçalho Last-Modified (servidores com CORS, ou pelo nosso repassador)
async function lastModified(url) {
  try { const r = await fetch(url, { method: 'HEAD' }); const lm = r.headers.get('last-modified'); return lm ? new Date(lm) : null; } catch { return null; }
}
const single = (src, caption, { time, timeFrom = src } = {}) => async () => [{ src, caption, time: time || await lastModified(timeFrom) }];
const parseXML = t => new DOMParser().parseFromString(t, 'text/xml');
// fetch com tempo-limite (fontes fora do ar não deixam o visualizador "buscando…" para sempre)
const _fetch = globalThis.fetch.bind(globalThis);
const fetch = (url, opt = {}) => _fetch(url, { signal: AbortSignal.timeout(25000), ...opt });

// MAST: observações recém-liberadas do JWST ou do Hubble (imagens já calibradas, com prévia em JPEG)
async function mastLatest(coll) {
  const mjdNow = Date.now() / 864e5 + 40587;
  const req = { service: 'Mast.Caom.Filtered', format: 'json', params: { columns: 'obs_id,target_name,s_ra,s_dec,t_min,t_obs_release,instrument_name,filters,jpegURL', filters: [
    { paramName: 'obs_collection', values: [coll] }, { paramName: 'dataproduct_type', values: ['image'] }, { paramName: 'calib_level', values: [3] },
    { paramName: 't_obs_release', values: [{ min: mjdNow - 10, max: mjdNow }] }] }, pagesize: 300, page: 1, removenullcolumns: true, timeout: 30 };
  const r = await fetch('https://mast.stsci.edu/api/v0/invoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'request=' + encodeURIComponent(JSON.stringify(req)) });
  const data = ((await r.json()).data || []).filter(x => x.jpegURL && !/total|detection/i.test(x.filters || ''));
  data.sort((a, b) => b.t_obs_release - a.t_obs_release);
  const mjd = m => new Date((m - 40587) * 864e5);
  return data.slice(0, 80).map(x => ({
    src: proxied('https://mast.stsci.edu/api/v0.1/Download/file?uri=' + encodeURIComponent(x.jpegURL)),
    time: mjd(x.t_obs_release),
    caption: `<b>${x.target_name.replace(/-/g, ' ')}</b> · ${x.instrument_name} · filtro ${x.filters}<br>Observado em ${mjd(x.t_min).toLocaleDateString('pt-BR')}, liberado ${timeAgo(mjd(x.t_obs_release))}. Imagem científica calibrada (nível 3), sem tratamento artístico.`,
    sky: { ra: x.s_ra, dec: x.s_dec, name: x.target_name.replace(/-/g, ' ') },
  }));
}

async function esaFeed(url) {
  const x = parseXML(await (await fetch(url)).text());
  return [...x.querySelectorAll('item')].slice(0, 30).map(it => {
    const enc = it.querySelector('enclosure')?.getAttribute('url');
    const desc = it.querySelector('description')?.textContent || '';
    const img = enc || desc.match(/src="([^"]+)"/)?.[1];
    const text = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return { src: img, time: new Date(it.querySelector('pubDate')?.textContent), caption: `<b>${it.querySelector('title')?.textContent}</b><br>${text.slice(0, 420)}${text.length > 420 ? '…' : ''}`, link: it.querySelector('link')?.textContent };
  }).filter(i => i.src);
}

// ---------------------------------------------------------------- canais
// craft: { sat: nome no catálogo da CelesTrak } ou { probe: id da nave }
export const CHANNELS = [
  // ---------- A Terra agora
  { id: 'live', group: 'terra', title: 'Terra ao vivo, no globo 3D', sub: 'GOES-19, GOES-18, Meteosat-12, Meteosat-9 e Himawari-9 juntos', kind: 'globe-live',
    desc: 'Junta as fotos mais recentes dos cinco satélites geoestacionários que vigiam a Terra (atualizadas a cada 10–15 min) e pinta o globo com elas. Cada ponto usa o satélite que o vê mais de frente. Os polos ficam fora da vista deles.' },
  { id: 'goes19-ssa', group: 'terra', title: 'América do Sul agora', sub: 'GOES-19 · NOAA (EUA)', craft: { sat: 'GOES 19' }, viewpoint: true,
    fetch: single('https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/ssa/GEOCOLOR/1800x1080.jpg', 'GeoColor: cor real de dia; à noite, nuvens no infravermelho e as luzes das cidades. Nova imagem a cada 10 min.') },
  { id: 'goes19-fd', group: 'terra', title: 'Disco inteiro: as Américas', sub: 'GOES-19 (GOES-Leste) · NOAA', craft: { sat: 'GOES 19' }, viewpoint: true,
    fetch: single('https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg', 'A Terra inteira vista a 35.786 km de altura, sobre 75° O.') },
  { id: 'goes18-fd', group: 'terra', title: 'Disco inteiro: o Pacífico', sub: 'GOES-18 (GOES-Oeste) · NOAA', craft: { sat: 'GOES 18' }, viewpoint: true,
    fetch: single('https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/1808x1808.jpg', 'Vista de 137° O: o Oceano Pacífico, o oeste das Américas e a Oceania.') },
  { id: 'himawari', group: 'terra', title: 'Disco inteiro: Ásia e Oceania', sub: 'Himawari-9 · JMA (Japão)', craft: { sat: 'HIMAWARI-9' }, viewpoint: true,
    fetch: async () => {
      const j = await (await fetch(proxied('https://himawari8.nict.go.jp/img/D531106/latest.json'))).json();
      const d = j.date.replace(/[-: ]/g, ''), p = `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}/${d.slice(8, 14)}`;
      return [{ src: proxied(`https://himawari8.nict.go.jp/img/D531106/1d/550/${p}_0_0.png`), time: new Date(j.date.replace(' ', 'T') + 'Z'), caption: 'Cor real, vista de 140,7° L. Imagem do NICT (Japão), a cada 10 min.' }];
    } },
  { id: 'meteosat', group: 'terra', title: 'Europa e África agora', sub: 'Meteosat-12 (MTG-I1) · EUMETSAT (Europa)', craft: { sat: 'METEOSAT-12 (MTG-I1)' }, viewpoint: true,
    fetch: single(proxied('https://view.eumetsat.int/geoserver/ows?' + new URLSearchParams({ service: 'WMS', request: 'GetMap', version: '1.3.0', layers: 'mtg_fd:rgb_geocolour', crs: 'EPSG:4326', bbox: '-70,-75,72,75', width: 1500, height: 1420, format: 'image/png', transparent: 'true' })),
      'GeoColour da nova geração de satélites europeus, reprojetado em mapa.', { time: null }) },
  { id: 'fy4b', group: 'terra', title: 'Disco inteiro: China e Índico', sub: 'Fengyun-4B · CMA (China)', craft: { sat: 'FENGYUN 4B' }, viewpoint: true,
    fetch: single(proxied('http://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/GCLR/FY4B_DISK_GCLR.JPG'), 'Imagem colorida do satélite meteorológico chinês, vista de 105° L. Arquivo grande (18 MB): demora um pouco.') },
  { id: 'epic', group: 'terra', title: 'A Terra inteira, de 1,5 milhão de km', sub: 'DSCOVR / câmera EPIC · NASA e NOAA', craft: { probe: 'dscovr' }, viewpoint: true, play: true,
    fetch: async () => {
      const list = await (await fetch('https://epic.gsfc.nasa.gov/api/natural')).json();
      return list.map(x => {
        const [d] = x.date.split(' '), [Y, M, D] = d.split('-');
        return { src: `https://epic.gsfc.nasa.gov/archive/natural/${Y}/${M}/${D}/jpg/${x.image}.jpg`, time: new Date(x.date.replace(' ', 'T') + 'Z'),
          caption: `Do ponto L1, entre a Terra e o Sol: a face iluminada inteira. Centro da imagem em ${fmtNum(x.centroid_coordinates.lat, 1)}°, ${fmtNum(x.centroid_coordinates.lon, 1)}°. Uma foto a cada ~1 h; dá para ver a Terra girar (▶).` };
      });
    } },
  { id: 'noaa20', group: 'terra-dia', title: 'Planeta inteiro, ontem', sub: 'NOAA-20 · VIIRS', craft: { sat: 'NOAA 20 (JPSS-1)' }, kind: 'globe-daily', layer: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    desc: 'Mosaico de um dia inteiro de passagens do satélite, em cor real. As faixas escuras perto do equador são os vãos entre uma órbita e outra.' },
  { id: 'noaa21', group: 'terra-dia', title: 'Planeta inteiro, ontem', sub: 'NOAA-21 · VIIRS', craft: { sat: 'NOAA 21 (JPSS-2)' }, kind: 'globe-daily', layer: 'VIIRS_NOAA21_CorrectedReflectance_TrueColor' },
  { id: 'snpp', group: 'terra-dia', title: 'Planeta inteiro, ontem', sub: 'Suomi NPP · VIIRS', craft: { sat: 'SUOMI NPP' }, kind: 'globe-daily', layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor' },
  { id: 'terra', group: 'terra-dia', title: 'Planeta inteiro, ontem de manhã', sub: 'Terra · MODIS (passa às 10h30 locais)', craft: { sat: 'TERRA' }, kind: 'globe-daily', layer: 'MODIS_Terra_CorrectedReflectance_TrueColor' },
  { id: 'aqua', group: 'terra-dia', title: 'Planeta inteiro, ontem à tarde', sub: 'Aqua · MODIS (passa às 13h30 locais)', craft: { sat: 'AQUA' }, kind: 'globe-daily', layer: 'MODIS_Aqua_CorrectedReflectance_TrueColor' },
  { id: 'fires', group: 'terra-dia', title: 'Queimadas detectadas ontem', sub: 'NOAA-20 · VIIRS 375 m', craft: { sat: 'NOAA 20 (JPSS-1)' }, kind: 'globe-daily', layer: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', overlay: 'VIIRS_NOAA20_Thermal_Anomalies_375m_All',
    preview: () => gibsMap('VIIRS_NOAA20_CorrectedReflectance_TrueColor,VIIRS_NOAA20_Thermal_Anomalies_375m_All', '-35,-75,7,-33', 1400, 1400),
    desc: 'Cada ponto vermelho é um foco de calor detectado pelo satélite nas últimas 24 h. A prévia mostra o Brasil.' },
  { id: 'night', group: 'terra-dia', title: 'Luzes da noite, ontem', sub: 'NOAA-20 · VIIRS banda dia-noite', craft: { sat: 'NOAA 20 (JPSS-1)' }, kind: 'globe-daily', layer: 'VIIRS_NOAA20_DayNightBand_At_Sensor_Radiance',
    desc: 'O sensor que enxerga com a luz da Lua: cidades, navios pesqueiros, plataformas de petróleo e auroras.' },
  { id: 'sst', group: 'terra-dia', title: 'Temperatura do mar', sub: 'Vários satélites (GHRSST MUR)', kind: 'globe-daily', layer: 'GHRSST_L4_MUR_Sea_Surface_Temperature',
    desc: 'Temperatura da superfície do oceano combinando vários satélites: azul é frio, vermelho é quente.' },
  // ---------- O Sol agora
  { id: 'suvi', group: 'sol', title: 'O Sol no ultravioleta extremo', sub: 'GOES-19 · SUVI', craft: { sat: 'GOES 19' }, play: false,
    fetch: async () => Promise.all([['195', 'ferro a 1,5 milhão de °C: a coroa'], ['304', 'hélio a 50 mil °C: proeminências'], ['171', 'ferro a 600 mil °C: arcos magnéticos'], ['131', 'erupções muito quentes']].map(async ([b, t]) => {
      const u = `https://services.swpc.noaa.gov/images/animations/suvi/primary/${b}/latest.png`; return { src: u, time: await lastModified(u), caption: `${b} Å — ${t}.` };
    })) },
  { id: 'lasco', group: 'sol', title: 'A coroa e as ejeções do Sol', sub: 'SOHO · LASCO', craft: { probe: 'soho' },
    fetch: async () => Promise.all([['c2', 'até 6 raios solares'], ['c3', 'até 30 raios solares: dá para ver estrelas e, às vezes, cometas']].map(async ([c, t]) => {
      const u = proxied(`https://soho.nascom.nasa.gov/data/realtime/${c}/1024/latest.jpg`); return { src: u, time: await lastModified(u), caption: `Coronógrafo ${c.toUpperCase()}: um disco tapa o Sol para mostrar a coroa ${t}.` };
    })) },
  { id: 'sdo', group: 'sol', title: 'O Sol em alta resolução', sub: 'SDO · NASA', craft: { sat: 'SDO' },
    fetch: async () => Promise.all([['0193', 'AIA 193 Å: coroa'], ['0171', 'AIA 171 Å: arcos magnéticos'], ['0304', 'AIA 304 Å: cromosfera'], ['HMIIC', 'HMI: a superfície visível e as manchas solares']].map(async ([b, t]) => {
      const u = proxied(`https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_${b}.jpg`); return { src: u, time: await lastModified(u), caption: `${t}.` };
    })) },
  // ---------- Janelas para o universo
  { id: 'jwst-raw', group: 'universo', title: 'O que o JWST observou (dados recém-liberados)', sub: 'James Webb · arquivo MAST', craft: { probe: 'jwst' }, fetch: () => mastLatest('JWST'),
    desc: 'Observações científicas liberadas nos últimos 10 dias, do jeito que saem da calibração: em preto e branco, um filtro por vez.' },
  { id: 'hst-raw', group: 'universo', title: 'O que o Hubble observou (dados recém-liberados)', sub: 'Hubble · arquivo MAST', craft: { sat: 'HST' }, fetch: () => mastLatest('HST') },
  { id: 'webb-pr', group: 'universo', title: 'Imagens divulgadas do Webb', sub: 'ESA/Webb', craft: { probe: 'jwst' }, fetch: () => esaFeed('https://esawebb.org/images/feed/') },
  { id: 'hubble-pr', group: 'universo', title: 'Imagens divulgadas do Hubble', sub: 'ESA/Hubble', craft: { sat: 'HST' }, fetch: () => esaFeed('https://esahubble.org/images/feed/') },
  // ---------- Em outros mundos
  { id: 'm2020', group: 'mundos', title: 'Últimas fotos de Marte', sub: 'Perseverance · fotos brutas', craft: { probe: 'perseverance' },
    fetch: async () => {
      const j = await (await fetch('https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&num=150&order=sol+desc')).json();
      // só as câmeras que fotografam a paisagem (fora: céu, calibração, tubos de amostra)
      const scenic = /NAVCAM|MCZ|HAZCAM|SUPERCAM|WATSON/;
      const imgs = j.images.filter(x => scenic.test(x.camera.instrument));
      return (imgs.length ? imgs : j.images).map(x => ({ src: x.image_files.large || x.image_files.medium, time: new Date(x.date_taken_utc + 'Z'),
        caption: `Sol ${x.sol} (dia marciano da missão) · câmera ${x.camera.instrument.replace(/_/g, ' ')}${x.title ? ' · ' + x.title.replace(/Mars Perseverance Sol \d+: /, '') : ''}` }));
    } },
  { id: 'msl', group: 'mundos', title: 'Últimas fotos de Marte', sub: 'Curiosity · fotos brutas', craft: { probe: 'curiosity' },
    fetch: async () => {
      const j = await (await fetch('https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc,instrument_sort%20asc&per_page=150&page=0&condition_1=msl:mission')).json();
      const scenic = /NAV|MAST|HAZ|MAHLI|CHEMCAM/i;
      const items = j.items.filter(x => scenic.test(x.instrument) && !/_TN|thumb/i.test(x.url));
      return (items.length ? items : j.items).map(x => ({ src: x.https_url || x.url, time: new Date(x.date_taken), caption: `Sol ${x.sol} · câmera ${x.instrument}` }));
    } },
  // ---------- Ao vivo
  { id: 'iss', group: 'vivo', title: 'Ao vivo da Estação Espacial', sub: 'NASA · vídeo', craft: { sat: 'ISS (ZARYA)' }, kind: 'video',
    embed: 'https://www.youtube.com/embed/live_stream?channel=UCLA_DiR1FfKNvjuUpBHmylQ&autoplay=1&mute=1',
    desc: 'A transmissão ao vivo do canal da NASA. Quando a estação passa pelo lado noturno ou a ligação cai, a tela fica preta ou mostra outra programação da NASA.' },
  { id: 'dsn', group: 'vivo', title: 'Quem está falando com quem, agora', sub: 'Rede de Espaço Profundo (DSN) · NASA', kind: 'dsn',
    desc: 'As antenas gigantes da NASA na Califórnia, na Espanha e na Austrália recebem os sinais das naves. Esta é a lista ao vivo.' },
];
const GROUPS = { terra: '🌍 A Terra agora', 'terra-dia': '🛰️ O planeta inteiro, por satélite', sol: '☀️ O Sol agora', universo: '🔭 Janelas para o universo', mundos: '🤖 Em outros mundos', vivo: '📡 Ao vivo' };

// ---------------------------------------------------------------- ligação com o catálogo
let hooks = {};
export function setHooks(h) { hooks = h; }
export function craftOf(ch) {
  if (!ch.craft) return null;
  if (ch.craft.probe) return CRAFT.find(c => c.id === ch.craft.probe) || null;
  const s = SAT.list.find(x => x.name === ch.craft.sat);
  return s ? { sat: s } : null;
}
export function channelsFor(t) {
  const sat = t?.sat || t?.craft?.sat, probe = t?.craft?.id;
  return CHANNELS.filter(ch => (sat && ch.craft?.sat === sat.name) || (probe && ch.craft?.probe === probe));
}

// ---------------------------------------------------------------- painel de canais
export function buildPanel(filterFor = null) {
  const box = $('feedList');
  const list = filterFor ? channelsFor(filterFor) : CHANNELS;
  let html = filterFor ? `<p class="muted small">Transmissões de <b>${filterFor.name}</b> · <a href="#" id="feedAll">ver todas</a></p>` : '';
  let last = null;
  for (const ch of list) {
    if (ch.group !== last && !filterFor) { html += `<div class="cat">${GROUPS[ch.group]}</div>`; last = ch.group; }
    html += `<button data-ch="${ch.id}"><span>${ch.title}</span><small>${ch.sub}</small></button>`;
  }
  box.innerHTML = html;
  for (const b of box.querySelectorAll('[data-ch]')) b.onclick = () => open(CHANNELS.find(c => c.id === b.dataset.ch));
  $('feedAll') && ($('feedAll').onclick = e => { e.preventDefault(); buildPanel(); });
  if (skin.active) box.insertAdjacentHTML('afterbegin', `<div class="skin">🌍 Globo: ${skin.label} <button id="skinOff">voltar ao normal</button></div>`);
  $('skinOff') && ($('skinOff').onclick = () => { restore(); buildPanel(filterFor); hooks.toast?.('Globo de volta à textura padrão.'); });
}

// ---------------------------------------------------------------- visualizador
const V = { ch: null, items: [], i: 0, playTimer: null };

export async function open(ch) {
  stopPlay();
  V.ch = ch; V.items = []; V.i = 0;
  if (ch.kind === 'globe-live') return runGlobeLive(ch);
  if (ch.kind === 'globe-daily') return showDaily(ch);
  if (ch.kind === 'dsn') return openDSN();
  $('viewer').hidden = false;
  $('vTitle').innerHTML = `${ch.title} <small>${ch.sub}</small>`;
  $('vImg').hidden = true; $('vFrame').hidden = true; $('vStatus').textContent = 'buscando…';
  $('vCaption').innerHTML = ch.desc ? `<span class="muted">${ch.desc}</span>` : ''; $('vNav').hidden = true;
  renderActions(ch);
  if (ch.kind === 'video') {
    $('vFrame').src = ch.embed; $('vFrame').hidden = false;
    $('vStatus').textContent = ''; $('vCaption').innerHTML = ch.desc; $('vNav').hidden = true;
    return;
  }
  try {
    V.items = (await ch.fetch()).filter(x => x.src);
    if (V.ch !== ch) return;
    if (!V.items.length) { $('vStatus').textContent = 'Nenhuma imagem disponível agora.'; return; }
    // séries para animar (EPIC) vêm da mais antiga para a mais nova: abre na mais nova
    show(ch.play ? V.items.length - 1 : 0);
  } catch (e) {
    console.error(e);
    if (V.ch === ch) $('vStatus').textContent = e.name === 'TimeoutError' ? 'A fonte não respondeu a tempo (pode estar fora do ar). Tente de novo mais tarde.' : 'Não foi possível buscar agora (fonte fora do ar ou sem internet).';
  }
}

function show(i) {
  const it = V.items[i]; if (!it) return;
  V.i = i;
  const img = $('vImg');
  $('vStatus').textContent = 'carregando imagem…';
  img.hidden = true;
  img.onload = () => { if (V.items[V.i] === it) { $('vStatus').textContent = ''; img.hidden = false; } };
  img.onerror = () => { if (V.items[V.i] === it) $('vStatus').textContent = 'A imagem não carregou (a fonte pode estar fora do ar).'; };
  clearTimeout(V.slowTimer);
  V.slowTimer = setTimeout(() => { if (V.items[V.i] === it && img.hidden && $('vStatus').textContent.startsWith('carregando')) $('vStatus').textContent = 'carregando… (a fonte está lenta)'; }, 12000);
  img.src = it.src;
  const when = it.time && !isNaN(it.time) ? `${it.time.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} (${timeAgo(it.time)})` : 'imagem mais recente';
  $('vCaption').innerHTML = `${it.caption || ''}<div class="muted small">${when}${V.items.length > 1 ? ` · ${i + 1} de ${V.items.length}` : ''}${it.link ? ` · <a href="${it.link}" target="_blank" rel="noopener">página original</a>` : ''}</div>`;
  $('vNav').hidden = V.items.length < 2;
  $('vSky').hidden = !it.sky;
  // pré-carrega a próxima
  if (V.items[i + 1]) { const p = new Image(); p.src = V.items[i + 1].src; }
}

function renderActions(ch) {
  const c = craftOf(ch);
  $('vGoCraft').hidden = !c; $('vView').hidden = !(c && ch.viewpoint);
  $('vPlay').hidden = !ch.play;
  $('vSky').hidden = true;
}

function stopPlay() { clearInterval(V.playTimer); V.playTimer = null; $('vPlay') && ($('vPlay').textContent = '▶'); }
export function close() { stopPlay(); $('viewer').hidden = true; $('vFrame').src = 'about:blank'; }

export function wireViewer() {
  $('vClose').onclick = close;
  $('vPrev').onclick = () => show((V.i - 1 + V.items.length) % V.items.length);
  $('vNext').onclick = () => show((V.i + 1) % V.items.length);
  $('vPlay').onclick = () => {
    if (V.playTimer) return stopPlay();
    // a lista do EPIC vem do mais antigo para o mais novo
    $('vPlay').textContent = '❚❚';
    V.playTimer = setInterval(() => show((V.i + 1) % V.items.length), 700);
  };
  $('vGoCraft').onclick = () => { const c = craftOf(V.ch); if (c) { close(); hooks.goCraft?.(c); } };
  $('vView').onclick = () => { const c = craftOf(V.ch); if (c) { close(); hooks.viewpoint?.(c); } };
  $('vSky').onclick = () => { const it = V.items[V.i]; if (it?.sky) { close(); hooks.sky?.(it.sky); } };
  addEventListener('keydown', e => {
    if ($('viewer').hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') $('vNext').click();
    else if (e.key === 'ArrowLeft') $('vPrev').click();
  });
}

// ---------------------------------------------------------------- globo com imagens de satélite
async function runGlobeLive(ch) {
  hooks.toast?.('Buscando as fotos mais recentes de 5 satélites geoestacionários…', 60000);
  const got = [];
  try {
    const r = await applyLive(n => got.push(n));
    const missing = LIVE_SOURCES.map(s => s.name).filter(n => !r.sources.includes(n));
    hooks.toast?.(`Globo pintado com a Terra de agora: ${r.sources.join(', ')}.${missing.length ? ` Sem resposta agora: ${missing.join(', ')}.` : ''}`, 10000);
    hooks.lookEarth?.();
    buildPanel();
  } catch (e) { hooks.toast?.('Não foi possível montar a Terra ao vivo agora.'); console.error(e); }
  void ch;
}

async function showDaily(ch) {
  // prévia no visualizador + botão para pintar o globo
  $('viewer').hidden = false;
  $('vTitle').innerHTML = `${ch.title} <small>${ch.sub}</small>`;
  $('vFrame').hidden = true; $('vNav').hidden = true; $('vSky').hidden = true;
  renderActions(ch);
  V.items = [{ src: ch.preview ? ch.preview() : gibsMap(ch.layer), time: new Date(yesterday() + 'T12:00:00Z'), caption: (ch.desc || '') + '<div class="globeBtn"><button id="vGlobe" class="accent">🌍 Pintar o globo 3D com esta imagem</button></div>' }];
  show(0);
  setTimeout(() => {
    $('vGlobe') && ($('vGlobe').onclick = async () => {
      close();
      hooks.toast?.('Montando o planeta inteiro…', 30000);
      try { await applyDaily(ch.layer, `${ch.sub} — ${ch.title}`, { overlay: ch.overlay }); hooks.toast?.(`Globo: ${ch.title} (${ch.sub}).`, 6000); hooks.lookEarth?.(); buildPanel(); }
      catch (e) { console.error(e); hooks.toast?.('Não foi possível baixar o mosaico agora.'); }
    });
  }, 0);
}

// ---------------------------------------------------------------- Rede de Espaço Profundo (DSN)
const DSN_TO_CRAFT = { VGR1: 'voyager1', VGR2: 'voyager2', NHPC: 'newhorizons', SPP: 'parker', JNO: 'juno', MRO: 'mro', M20: 'perseverance', MSL: 'curiosity',
  MVN: 'maven', ODY: 'odyssey', M01O: 'odyssey', TGO: 'tgo', MEX: 'mex', EMM: 'hope', JWST: 'jwst', LRO: 'lro', KPLO: 'danuri', LUCY: 'lucy', PSYC: 'psyche', EURC: 'clipper',
  JUCE: 'juice', BEPI: 'bepi', SOHO: 'soho', DSCO: 'dscovr', SOLO: 'solo', HERA: 'hera', HYB2: 'hayabusa2', CHDR: 'chandrayaan2', GAIA: 'gaia', EUCL: 'euclid' };
let dsnConfig = null, dsnCache = { t: 0, data: null };
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
function byName(friendly) {
  const f = norm(friendly);
  if (!f) return undefined;
  return CRAFT.find(c => c.kind === 'probe' && (norm(c.name) === f || f.startsWith(norm(c.name)) || norm(c.name).startsWith(f)))?.id;
}

async function loadDSN() {
  if (Date.now() - dsnCache.t < 25e3 && dsnCache.data) return dsnCache.data;
  if (!dsnConfig) {
    const x = parseXML(await (await fetch('https://eyes.nasa.gov/dsn/config.xml')).text());
    dsnConfig = { sites: {}, craft: {} };
    for (const s of x.querySelectorAll('site')) dsnConfig.sites[s.getAttribute('name')] = { name: s.getAttribute('friendlyName'), lat: +s.getAttribute('latitude'), lon: +s.getAttribute('longitude') };
    for (const c of x.querySelectorAll('spacecraft')) dsnConfig.craft[c.getAttribute('name').toUpperCase()] = c.getAttribute('friendlyName');
  }
  const x = parseXML(await (await fetch('https://eyes.nasa.gov/dsn/data/dsn.xml?r=' + Math.floor(Date.now() / 5000))).text());
  const links = [];
  let site = null;
  for (const el of x.documentElement.children) {
    if (el.tagName === 'station') { site = dsnConfig.sites[el.getAttribute('name')] || { name: el.getAttribute('friendlyName') }; continue; }
    if (el.tagName !== 'dish') continue;
    const dish = el.getAttribute('name');
    for (const tg of el.querySelectorAll('target')) {
      const code = tg.getAttribute('name').toUpperCase();
      if (['DSN', 'TEST', 'TST'].includes(code)) continue;
      const down = [...el.querySelectorAll('downSignal')].find(s => s.getAttribute('spacecraft')?.toUpperCase() === code && s.getAttribute('active') === 'true');
      const up = [...el.querySelectorAll('upSignal')].find(s => s.getAttribute('spacecraft')?.toUpperCase() === code && s.getAttribute('active') === 'true');
      links.push({
        site, dish: dish.replace('DSS', 'DSS '), code, name: dsnConfig.craft[code] || code, craftId: DSN_TO_CRAFT[code] || byName(dsnConfig.craft[code]),
        range: +tg.getAttribute('downlegRange') || +tg.getAttribute('uplegRange'), rtlt: +tg.getAttribute('rtlt'),
        rate: down ? +down.getAttribute('dataRate') : 0, power: down ? +down.getAttribute('power') : null, band: down?.getAttribute('band') || up?.getAttribute('band'),
        down: !!down, up: !!up, activity: el.getAttribute('activity'),
      });
    }
  }
  dsnCache = { t: Date.now(), data: links };
  return links;
}

const fmtRate = r => (r >= 1e6 ? `${fmtNum(r / 1e6, 1)} Mbit/s` : r >= 1e3 ? `${fmtNum(r / 1e3, 1)} kbit/s` : `${fmtNum(r, 0)} bit/s`);
const fmtPower = dbm => { const w = Math.pow(10, (dbm - 30) / 10); const e = Math.floor(Math.log10(w)); return `${fmtNum(w / 10 ** e, 1)}×10<sup>${e}</sup> W`; };

export function describeLink(l) {
  const dir = l.down && l.up ? 'falando e ouvindo' : l.down ? 'recebendo' : l.up ? 'enviando comandos' : 'apontada';
  return `Antena ${l.dish} em ${l.site?.name || '?'}: ${dir}${l.down && l.rate ? ` a ${fmtRate(l.rate)}` : ''}${l.power != null && l.down ? `, sinal de ${fmtPower(l.power)}` : ''}${l.range > 0 ? ` · ${fmtDist(l.range * KM)}` : ''}.`;
}

// Estado da DSN para uma nave do catálogo (para a ficha)
export async function dsnFor(craftId) {
  try { return (await loadDSN()).filter(l => l.craftId === craftId); } catch { return []; }
}

let dsnLinks = [], dsnOpen = false;
async function openDSN() {
  dsnOpen = true;
  $('dsnPanel').hidden = false;
  await refreshDSN();
}
async function refreshDSN() {
  if (!dsnOpen) return;
  const body = $('dsnBody');
  try {
    dsnLinks = await loadDSN();
    const bySite = {};
    for (const l of dsnLinks) (bySite[l.site?.name || '?'] ||= []).push(l);
    body.innerHTML = Object.entries(bySite).map(([s, ls]) => `<h3>${s}</h3>` + ls.map(l =>
      `<div class="dsnRow ${l.craftId ? 'go' : ''}" data-c="${l.craftId || ''}"><b>${l.name}</b><small>${describeLink(l).replace(/^Antena /, '')}</small></div>`).join('')).join('') +
      `<p class="muted small">Atualiza a cada 30 s. As linhas no 3D ligam cada complexo de antenas às naves com que ele está em contato. Fonte: DSN Now (NASA/JPL).</p>`;
    for (const r of body.querySelectorAll('.dsnRow.go')) r.onclick = () => { const c = CRAFT.find(x => x.id === r.dataset.c); if (c) hooks.goCraft?.(c); };
  } catch (e) { body.textContent = 'Não foi possível acessar a DSN agora.'; }
  setTimeout(refreshDSN, 30e3);
}
export function closeDSN() { dsnOpen = false; $('dsnPanel').hidden = true; for (const l of lines) l.visible = false; }

// Linhas antena → nave no 3D
const lines = [];
export function update() {
  if (!dsnOpen) return;
  let k = 0;
  for (const l of dsnLinks) {
    const c = l.craftId && CRAFT.find(x => x.id === l.craftId);
    const p = c?.now;
    if (!p || !l.site?.lat) continue;
    let line = lines[k];
    if (!line) {
      line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x7fffb0, transparent: true, opacity: 0.8, depthWrite: false }));
      line.frustumCulled = false; local.add(line); lines.push(line);
    }
    const a = surfacePoint('Earth', l.site.lat, l.site.lon).pos;
    place(line, a);
    const arr = line.geometry.attributes.position.array;
    arr[0] = arr[1] = arr[2] = 0; arr[3] = p[0] - a[0]; arr[4] = p[1] - a[1]; arr[5] = p[2] - a[2];
    line.geometry.attributes.position.needsUpdate = true;
    line.visible = true; k++;
  }
  for (; k < lines.length; k++) lines[k].visible = false;
}
void LIVE_SOURCES; void BODY;
