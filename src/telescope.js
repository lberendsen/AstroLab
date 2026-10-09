// Modo telescópio, com Aladin Lite (CDS). Dois usos:
//  - céu: a foto real do céu vista da Terra, em qualquer comprimento de onda;
//  - mundo: para corpos do Sistema Solar, os mapas da superfície feitos por sondas (as fotos do céu foram
//    tiradas anos atrás, quando a Lua e os planetas estavam em outro lugar, então lá eles não aparecem).
import { BANDS, SURVEY_BY_ID } from './surveys.js';

const ALADIN_URL = 'https://cdn.jsdelivr.net/npm/aladin-lite@3.8.2/dist/aladin.js';
let aladin = null, loading = null, skySurvey = 'CDS/P/DSS2/color', current = skySurvey;
let state = null; // última abertura: { mode, ... }
let markerCat = null;
const $ = id => document.getElementById(id);

// Mapas de superfície por corpo (chaves de BODY em solar.js). Verificados no MocServer em 2026-10.
export const BODY_MAPS = {
  Moon: [
    ['CDS/P/Moon/LROC-WAC-100m', 'LRO (NASA): mosaico global, 100 m'],
    ['China-VO/P/Change2/moon/7m/DOM', "Chang'e 2 (China): 7 m por pixel"],
    ['CDS/P/Moon/Kaguya-Evening-V04-474m', 'Kaguya (Japão): luz do entardecer'],
    ['CDS/P/Moon/Clementine-750nm-118m', 'Clementine (EUA), 750 nm'],
    ['CDS/P/Moon/geological-map', 'Mapa geológico unificado (USGS)'],
  ],
  Mars: [
    ['CDS/P/Mars/Viking-MDIM21-color', 'Viking (NASA): cor'],
    ['CDS/P/Mars/Tianwen1-MoRIC', 'Tianwen-1 (China): cor real'],
    ['CDS/P/Mars/Express286545', 'Mars Express (ESA)'],
    ['CDS/P/Mars/MRO-CTX', 'MRO CTX (NASA): 6 m por pixel'],
    ['CDS/P/Mars/THEMIS-color', 'THEMIS (NASA): infravermelho de dia'],
    ['CDS/P/Mars/THEMIS-IR-Night-100m-v14', 'THEMIS: infravermelho à noite'],
    ['CDS/P/Mars/MOLA-color', 'MOLA: relevo colorido por altitude'],
  ],
  Mercury: [['CDS/P/Mercury/MESSENGER-MDIS-LOI-166m', 'MESSENGER (NASA)'], ['CDS/P/Mercury/MDIS-enhanced-color', 'MESSENGER: cor realçada (composição)'], ['CDS/P/Mercury/DEM-665m', 'Relevo']],
  Venus: [['CDS/P/Venus/Magellan/C3-MDIR-ClrTopo-6600m-color', 'Magellan (radar): relevo colorido'], ['CDS/P/Venus/Magellan/C3-MDIR-2025m', 'Magellan: radar através das nuvens'], ['CDS/P/Venus/Magellan/Topography-4641m', 'Topografia']],
  Earth: [['CDS/P/Earth/BlueMarble', 'Blue Marble (NASA)'], ['CDS/P/Earth/DEM/elevation-hillshading', 'Relevo e fundo do mar']],
  Jupiter: [['CDS/P/Jupiter/PIA07782', 'Cassini (NASA/ESA)']],
  Io: [['CDS/P/Io/Galileo-SSI-1km', 'Galileo (NASA)']],
  Europa: [['CDS/P/Europa/Voyager-GalileoSSI-500m', 'Voyager e Galileo (NASA)']],
  Ganymede: [['CDS/P/Ganymede/VoyagerGalileo-SSI-1km', 'Voyager e Galileo (NASA)']],
  Callisto: [['CDS/P/Callisto/Voyager-Galileo-simp-1km', 'Voyager e Galileo (NASA)']],
  Neptune: [['CDS/P/Neptune/Voyager2', 'Voyager 2 (NASA)']],
  Pluto: [['CDS/P/Pluto/NewHorizons-Jul2017-300m', 'New Horizons (NASA)']],
  Sun: [['CDS/P/Sun/euvi-aia304-2012', 'STEREO e SDO, ultravioleta 304 Å (2012)']],
};
const BODY_PT = { Moon: 'Lua', Mars: 'Marte', Mercury: 'Mercúrio', Venus: 'Vênus', Earth: 'Terra', Jupiter: 'Júpiter', Io: 'Io', Europa: 'Europa', Ganymede: 'Ganimedes', Callisto: 'Calisto', Neptune: 'Netuno', Pluto: 'Plutão', Sun: 'Sol' };
export const hasBodyMaps = key => !!BODY_MAPS[key];

// a distribuição do Aladin Lite 3 é um módulo ES com export default; A.init é uma promessa
function loadScript() {
  if (loading) return loading;
  loading = import(ALADIN_URL)
    .then(async m => { window.A = m.default; await m.default.init; })
    .catch(e => { loading = null; throw new Error('não foi possível carregar o Aladin Lite: ' + (e.message || e)); });
  return loading;
}

// ---------------------------------------------------------------- painel
function buildPanel() {
  const bands = $('bands'), ov = $('overlaySel');
  bands.innerHTML = '';
  ov.innerHTML = '<option value="">— nenhum —</option>';
  const groups = state.mode === 'body'
    ? [{ name: `Mapas de ${BODY_PT[state.body]}`, range: 'feitos por sondas', items: BODY_MAPS[state.body].map(([id, label]) => ({ id, label })) }]
    : BANDS;
  if (state.mode === 'body') {
    bands.insertAdjacentHTML('beforeend', `<p class="small">Fotos das sondas que mapearam ${BODY_PT[state.body]}. Arraste para girar o globo; a roda do mouse aproxima.${state.markers?.length ? ' Os marcadores laranja são os robôs e pousos do catálogo.' : ''}</p>`);
  }
  for (const b of groups) {
    const div = document.createElement('div');
    div.className = 'band';
    div.innerHTML = `<h3>${b.name} <span>${b.range}</span></h3>`;
    const og = document.createElement('optgroup'); og.label = b.name;
    for (const s of b.items) {
      const bt = document.createElement('button');
      bt.textContent = s.label; bt.dataset.id = s.id;
      bt.onclick = () => setSurvey(s.id);
      div.appendChild(bt);
      og.appendChild(new Option(s.label, s.id));
    }
    ov.appendChild(og);
    bands.appendChild(div);
  }
  if (state.mode === 'body' && state.sky) {
    const b = document.createElement('button');
    b.className = 'switch';
    b.textContent = '🌌 Ver o céu atrás dele, visto da Terra';
    b.title = 'As fotos do céu foram tiradas anos atrás: o corpo não aparece nelas, só as estrelas do fundo';
    b.onclick = () => open({ ...state.sky, name: state.name });
    bands.appendChild(b);
  } else if (state.mode === 'sky' && state.bodyArgs) {
    const b = document.createElement('button');
    b.className = 'switch';
    b.textContent = `🗺️ Voltar aos mapas de ${BODY_PT[state.bodyArgs.body]}`;
    b.onclick = () => open(state.bodyArgs);
    bands.appendChild(b);
  }
  ov.onchange = () => setOverlay(ov.value);
  $('overlayOp').value = 0.5; $('overlayOp').disabled = true;
  $('overlayOp').oninput = e => { try { aladin.getOverlayImageLayer('compare')?.setOpacity(+e.target.value); } catch { /* camada ausente */ } };
}

function mark() {
  for (const b of document.querySelectorAll('#bands button[data-id]')) b.classList.toggle('on', b.dataset.id === current);
}

export function setSurvey(id) {
  current = id;
  if (state.mode === 'sky') skySurvey = id;
  aladin?.setImageSurvey(id);
  mark();
}

function setOverlay(id) {
  const op = $('overlayOp');
  op.disabled = !id;
  try {
    if (!id) { aladin.removeImageLayer?.('compare'); return; }
    aladin.setOverlayImageLayer(aladin.newImageSurvey(id), 'compare');
    aladin.getOverlayImageLayer('compare').setOpacity(+op.value);
  } catch (e) { console.warn('sobreposição', e); }
}

function setMarkers(list) {
  try { if (markerCat) aladin.removeLayer?.(markerCat); } catch { /* sem camada */ }
  markerCat = null;
  if (!list?.length) return;
  markerCat = window.A.catalog({ name: 'Robôs e pousos', color: '#ffb35c', sourceSize: 14, shape: 'circle' });
  aladin.addCatalog(markerCat);
  markerCat.addSources(list.map(m => window.A.marker((m.lon + 360) % 360, m.lat, { popupTitle: m.name, popupDesc: m.desc || '' })));
}

// ---------------------------------------------------------------- abrir
// Céu:   open({ ra, dec, fovDeg, name })
// Mundo: open({ body, lon, lat, fovDeg, name, markers, sky: { ra, dec, fovDeg } })
export async function open(args) {
  const prevBody = state?.mode === 'body' ? state : null;
  state = { ...args, mode: args.body && BODY_MAPS[args.body] ? 'body' : 'sky' };
  if (state.mode === 'sky' && prevBody && !args.body) state.bodyArgs = prevBody;
  $('scope').hidden = false;
  $('scopeTarget').textContent = state.mode === 'body' ? `${args.name || BODY_PT[args.body]}: a superfície, em mapas de sondas` : args.name ? `${args.name}: como aparece no céu, visto da Terra` : 'O céu visto da Terra';
  try { await loadScript(); }
  catch (e) { $('scopeTarget').textContent = e.message + ' (precisa de internet)'; return; }
  const survey = state.mode === 'body' ? BODY_MAPS[args.body][0][0] : skySurvey;
  const fov = Math.min(Math.max(args.fovDeg || 1, 0.002), 180);
  const lon = state.mode === 'body' ? (args.lon + 360) % 360 : args.ra, lat = state.mode === 'body' ? args.lat : args.dec;
  current = survey;
  if (!aladin) {
    aladin = window.A.aladin('#aladin', {
      survey, fov, target: `${lon} ${lat}`, cooFrame: 'ICRSd', projection: state.mode === 'body' ? 'SIN' : 'TAN', showReticle: true,
      showCooGrid: false, showProjectionControl: false, showFullscreenControl: false, showLayersControl: true,
      showSimbadPointerControl: true, showCooGridControl: true, showShareControl: false, showFrame: true, showZoomControl: true,
    });
  } else {
    aladin.setImageSurvey(survey);
    try { aladin.removeImageLayer?.('compare'); } catch { /* sem sobreposição */ }
    // o Aladin inverte a longitude ao abrir um mapa de planeta; no céu, desfaz
    if (state.mode === 'sky') aladin.reverseLongitude?.(false);
    aladin.setProjection?.(state.mode === 'body' ? 'SIN' : 'TAN');
    aladin.gotoRaDec(lon, lat);
    aladin.setFoV(fov);
  }
  setMarkers(state.mode === 'body' ? args.markers : null);
  buildPanel();
  mark();
}

export function close() { $('scope').hidden = true; }
export const isOpen = () => !$('scope').hidden;
export { SURVEY_BY_ID };
