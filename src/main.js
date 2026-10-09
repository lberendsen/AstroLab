import * as THREE from 'three';
import { F, renderer, scene, camera, beginFrame, resize } from './engine.js';
import { DB, loadAll, starRadiusSun } from './data.js';
import * as sky from './layers/sky.js';
import * as stars from './layers/stars.js';
import * as galaxies from './layers/galaxies.js';
import * as milkyway from './layers/milkyway.js';
import * as solar from './layers/solar.js';
import * as systems from './layers/systems.js';
import * as images from './layers/images.js';
import * as sats from './layers/sats.js';
import * as craft from './layers/craft.js';
import * as deep from './layers/deep.js';
import * as linkMode from './link.js';
import * as feeds from './feeds.js';
import { craftTarget, satTarget } from './targets.js';
import { lightSentence, fmtYears, lookbackYears, AGE_OF_UNIVERSE, CMB_DISTANCE, comovingDistance } from './astro.js';
import { local, place } from './engine.js';
import * as labels from './labels.js';
import * as search from './search.js';
import * as scope from './telescope.js';
import { nav, flyTo, setOrbit, setMode, update as navUpdate, wasClick, cancelFlight, lookAtDir } from './nav.js';
import { bodyTarget, starTarget, exoTarget, curatedTarget, galTarget } from './targets.js';
import { BANDS } from './surveys.js';
import { v3, AU, KM, LY, R_SUN, R_EARTH, DEG, PC_KM, fmtDist, fmtLightTime, fmtSpeed, fmtNum, xyz2radec, gal2eq, GALACTIC_CENTER, normName } from './astro.js';

const $ = id => document.getElementById(id);
let selected = null;

// ---------------------------------------------------------------- inicialização
async function init() {
  const step = s => { $('loadStep').textContent = s; };
  await loadAll(step);
  step('naves e satélites');
  await Promise.all([sats.load(), craft.load()]);
  step('quasares');
  await deep.load();
  deep.addCurated(DB.curated);
  step('montando a cena');
  solar.build(); solar.computePositions();
  stars.build(); galaxies.build(); milkyway.build(); systems.build();
  sats.build(); craft.addNotableSats(); craft.build(); deep.build();
  search.buildIndex();
  buildPlaces(); buildLayersMenu(); buildSkyMenu();

  // começa olhando a Terra, com o Sol de lado
  const earth = bodyTarget('Earth');
  const E = earth.pos();
  const toSun = v3.norm(v3.scale(E, -1)), side = v3.norm(v3.cross(toSun, [0, 0, 1]));
  F.cam = v3.add(E, v3.scale(v3.norm(v3.add(v3.add(v3.scale(toSun, 0.55), v3.scale(side, 0.8)), [0, 0, 0.25])), earth.viewDist * 1.8));
  camera.quaternion.copy(lookAtDir(v3.norm(v3.sub(E, F.cam)), new THREE.Vector3(0, 0, 1)));
  setOrbit(earth);
  select(earth);

  $('loading').classList.add('done');
  last = performance.now();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- laço principal
let last = 0, frameNo = 0, paused = false, nearGal = Infinity;
const RATES = [-31557600, -2592000, -604800, -86400, -3600, -60, -1, 1, 60, 3600, 86400, 604800, 2592000, 31557600];
let rateIdx = 7;

function computeNear() {
  let n = Infinity;
  if (F.layers.solar !== false && v3.len(F.cam) < 0.5) n = Math.min(n, solar.nearestSurface().d);
  n = Math.min(n, systems.near.surface);
  for (const P of systems.planets) n = Math.min(n, v3.dist(F.cam, P.pos) - P.radius);
  if (nav.target) {
    const d = v3.dist(F.cam, nav.target.pos());
    const r = nav.target.radius || 0;
    n = Math.min(n, nav.target.kind === 'deep' || nav.target.kind === 'gal' ? Math.max(d - r, d * 0.3) : d - r);
  }
  if (frameNo % 30 === 0) {
    const G = DB.gals, [cx, cy, cz] = F.cam;
    nearGal = Infinity;
    for (let i = 0; i < G.n; i++) {
      const dx = G.pos[i * 3] - cx, dy = G.pos[i * 3 + 1] - cy, dz = G.pos[i * 3 + 2] - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      nearGal = Math.min(nearGal, Math.max(d - G.radius[i], d * 0.3));
    }
    for (const o of DB.curated) { const d = v3.dist(F.cam, o.xyz); nearGal = Math.min(nearGal, d * 0.5); }
    // a própria Via Láctea: dentro dela, a escala é a das estrelas
    const dGC = v3.dist(F.cam, GALACTIC_CENTER);
    nearGal = Math.min(nearGal, Math.max(dGC - 15000, dGC * 0.3));
  }
  n = Math.min(n, nearGal);
  return Math.max(n, 1e-15);
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  F.dt = dt;
  if (!paused) F.date = new Date(F.date.getTime() + dt * 1000 * RATES[rateIdx]);
  solar.computePositions();
  navUpdate(dt);
  // leve abertura do campo de visão durante a dobra
  const fov = 60 + 18 * nav.warp;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; resize(); }
  camera.updateMatrixWorld();
  F.near = computeNear();
  beginFrame();
  sky.update(); stars.update(); galaxies.update(); milkyway.update();
  solar.update(); systems.update(dt); images.update();
  sats.update(); sats.updateOrbitLine(local, place); craft.update(); deep.update(); linkMode.update();
  if (linkMode.link.target && frameNo % 30 === 0) linkMode.render();
  feeds.update();
  labels.update();
  $('warp').style.opacity = nav.warp.toFixed(3);
  renderer.render(scene, camera);
  if (frameNo++ % 10 === 0) hud();
}

function hud() {
  const dSun = v3.len(F.cam);
  let html = `Distância do Sol: <b>${dSun < 1e-9 ? '—' : fmtDist(dSun)}</b>`;
  if (nav.target) html += `<br>Até ${nav.target.name}: <b>${fmtDist(Math.max(v3.dist(F.cam, nav.target.pos()) - (nav.target.radius || 0), 0))}</b>`;
  if (nav.speed > 0) html += `<br>Velocidade: <b>${fmtSpeed(nav.speed)}</b>`;
  $('where').innerHTML = html;
  const r = RATES[rateIdx];
  const rl = paused ? 'pausado' : rateLabel(r);
  $('clock').innerHTML = `${F.date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}<br><small>${rl}</small>`;
  $('tPause').textContent = paused ? '▶' : '❚❚';
  $('btnMode').textContent = nav.mode === 'orbit' ? '⟲ Orbitar' : '✈ Voar livre';
  if (selected && !$('info').hidden && frameNo % 30 === 0) refreshInfoDistances();
}
function rateLabel(r) {
  const map = { 1: 'tempo real', 60: '1 min/s', 3600: '1 hora/s', 86400: '1 dia/s', 604800: '1 semana/s', 2592000: '1 mês/s', 31557600: '1 ano/s' };
  const base = map[Math.abs(r)] || `${Math.abs(r)}×`;
  return r < 0 ? `◀ ${base} para trás` : base;
}

// ---------------------------------------------------------------- seleção e ficha
function select(t) {
  selected = t;
  labels.setSelected(t);
  images.setExtra(t);
  sats.setSelected(t?.sat || t?.craft?.sat);
  craft.setSelected(t);
  if (!t) { $('info').hidden = true; return; }
  renderInfo(t);
  $('info').hidden = false;
}

function go(t) {
  if (!t) return;
  if (t.kind === 'sky') { pointAt(t); toast('Sem distância medida para este objeto: abrindo no telescópio.'); openScope(t); return; }
  select(t);
  setMode('orbit');
  flyTo(t);
}

function pointAt(t) {
  const dir = v3.norm(v3.sub(t.pos(), F.cam));
  cancelFlight();
  setMode('free');
  camera.quaternion.copy(lookAtDir(dir));
}

const row = (k, v) => v == null || v === '' ? '' : `<dt>${k}</dt><dd>${v}</dd>`;
function renderInfo(t) {
  const dSun = v3.len(t.pos());
  let h = `<div class="kind">${t.kindLabel || ''}</div><h2>${t.name}</h2>`;
  if (t.aka?.length) h += `<div class="aka">${t.aka.slice(0, 5).join(' · ')}</div>`;
  let dl = '', notes = '', extra = '';
  if (t.body) {
    const b = t.body;
    if (b.desc) h += `<p>${b.desc}</p>`;
    dl += row('Raio', `${fmtNum(b.r, 0)} km` + (b.key !== 'Sun' ? ` (${fmtNum(b.r / 6371, 2)} × Terra)` : ''));
    if (b.key !== 'Sun') dl += row('Distância do Sol', `<span data-live="sun">${fmtDist(dSun)}</span>`);
    if (b.period) dl += row(b.parent ? 'Órbita' : 'Ano', b.period < 400 ? `${fmtNum(b.period, 1)} dias` : `${fmtNum(b.period / 365.25, 1)} anos`);
    if (b.key !== 'Earth' && b.key !== 'Sun') {
      const dE = v3.dist(t.pos(), solar.BODY.Earth.pos);
      dl += row('Distância da Terra', `<span data-live="earth">${fmtDist(dE)}</span>`);
      notes += `<div class="lighttime">A luz leva ${fmtLightTime(dE)} para chegar daqui até a Terra.</div>`;
    }
    if (b.key === 'Sun') notes += `<div class="lighttime">A luz do Sol leva ${fmtLightTime(v3.len(solar.BODY.Earth.pos))} para chegar à Terra.</div>`;
  } else if (t.kind === 'star') {
    const i = t.star, inf = DB.stars.info.get(i) || {};
    const T = DB.stars.teff[i], R = starRadiusSun(i);
    dl += row('Tipo espectral', inf.spect);
    dl += row('Temperatura', `${fmtNum(Math.round(T / 10) * 10, 0)} K`);
    dl += row('Raio (estimado)', `${fmtNum(R, R < 10 ? 2 : 0)} × Sol`);
    if (inf.lum) dl += row('Luminosidade', `${inf.lum < 10 ? (+inf.lum.toPrecision(2)).toLocaleString('pt-BR') : fmtNum(inf.lum, 0)} × Sol`);
    if (inf.mag != null) dl += row('Magnitude vista da Terra', fmtNum(inf.mag, 2));
    dl += row('Distância do Sol', fmtDist(dSun));
    notes += `<div class="lighttime">A luz que vemos desta estrela saiu dela há ${fmtLightTime(dSun)}.</div>`;
    if (t.host) {
      extra += `<h3>Exoplanetas conhecidos</h3><ul class="planets">` + t.host.planets.map(p =>
        `<li data-planet="${p.n}"><span>${p.n}</span><small>${p.r ? fmtNum(p.r, 1) + ' R⊕' : p.m ? fmtNum(p.m, 0) + ' M⊕' : ''}${p.a ? ' · ' + fmtNum(p.a, 3) + ' UA' : ''}</small></li>`).join('') + '</ul>';
    }
  } else if (t.kind === 'exo') {
    const p = t.pl;
    dl += row('Estrela', t.host.name);
    dl += row('Raio', p.r ? `${fmtNum(p.r, 2)} × Terra` : 'desconhecido');
    dl += row('Massa', p.m ? `${fmtNum(p.m, p.m < 10 ? 2 : 0)} × Terra` : 'desconhecida');
    dl += row('Temperatura de equilíbrio', p.t ? `${fmtNum(p.t, 0)} K (${fmtNum(p.t - 273, 0)} °C)` : null);
    dl += row('Distância da estrela', p.a ? `${fmtNum(p.a, 4)} UA` : null);
    dl += row('Ano', p.p ? (p.p < 2 ? `${fmtNum(p.p * 24, 1)} horas` : p.p < 1000 ? `${fmtNum(p.p, 2)} dias` : `${fmtNum(p.p / 365.25, 1)} anos`) : null);
    dl += row('Excentricidade', p.e ? fmtNum(p.e, 3) : null);
    dl += row('Descoberto', `${p.y || '?'} · ${p.how || ''}`);
    dl += row('Distância do Sol', fmtDist(dSun));
    notes += `<div class="note">Tamanho e órbita vêm de medidas reais. A cor e a inclinação da órbita são ilustrativas: ninguém viu este planeta de perto.</div>`;
  } else if (t.kind === 'craft' && t.craft.kind !== 'sat') {
    const c = t.craft;
    if (c.desc) h += `<p>${c.desc}</p>`;
    dl += row('País / agência', c.country);
    dl += row('Lançamento', c.launch);
    dl += row('Situação', c.status);
    if (c.kind === 'surface') {
      dl += row('Local', `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? 'N' : 'S'}, ${Math.abs(c.lon).toFixed(2)}° ${c.lon >= 0 ? 'L' : 'O'}`);
      dl += row('Agora', craft.isNight(c) ? '🌙 noite (o Sol está abaixo do horizonte)' : '☀️ dia');
    }
    const p = t.pos(), dE = v3.dist(p, solar.BODY.Earth.pos);
    dl += row('Distância da Terra', `<span data-live="earth">${fmtDist(dE)}</span>`);
    if (c.center === 'Sun') dl += row('Distância do Sol', `<span data-live="sun">${fmtDist(v3.len(p))}</span>`);
    const sp = craft.speedKmS(c);
    if (sp) dl += row(c.center === 'Sun' ? 'Velocidade (em relação ao Sol)' : `Velocidade (em relação a ${{ Earth: 'Terra', Mars: 'Marte', Moon: 'Lua', Jupiter: 'Júpiter' }[c.center]})`, `${fmtNum(sp, 2)} km/s (${fmtNum(sp * 3600, 0)} km/h)`);
    notes += `<div class="lighttime">Um sinal de rádio leva ${fmtLightTime(dE)} para ir da Terra até aqui.</div>`;
    notes += `<div class="note">${c.approx ? `Posição aproximada. ${c.approx}` : c.eph ? 'Trajetória real: JPL Horizons (NASA).' : c.kind === 'surface' ? 'Local de pouso publicado pela missão.' : ''} O modelo 3D é simplificado, mas está no tamanho real (${fmtNum(c.size, 1)} m).</div>`;
  } else if (t.sat || t.craft?.sat) {
    const s = t.sat || t.craft.sat, c = t.craft;
    const inf = sats.satInfo(s);
    if (c?.desc) h += `<p>${c.desc}</p>`;
    dl += row('País', s.owner === 'ISS' ? 'Internacional (EUA, Rússia, Europa, Japão e Canadá)' : `${sats.SAT.meta.countries[s.country]}${s.owner ? ` (${s.owner})` : ''}`);
    dl += row('Lançamento', s.year);
    dl += row('Tipo', sats.SAT.meta.cats[s.cat]);
    dl += row('NORAD', s.norad);
    dl += row('Altitude', `<span data-live="alt">${fmtNum(inf.altKm, 0)} km</span>`);
    dl += row('Órbita', s.e > 0.02 ? `${fmtNum(inf.perigee, 0)} × ${fmtNum(inf.apogee, 0)} km` : 'quase circular');
    dl += row('Velocidade', `${fmtNum(inf.speedKmS, 2)} km/s (${fmtNum(inf.speedKmS * 3600, 0)} km/h)`);
    dl += row('Uma volta na Terra', inf.periodMin < 200 ? `${fmtNum(inf.periodMin, 1)} min` : `${fmtNum(inf.periodMin / 60, 1)} h`);
    dl += row('Inclinação', `${fmtNum(s.i, 1)}°`);
    notes += `<div class="note">Posição calculada com os elementos orbitais públicos da CelesTrak de ${new Date(s.epoch).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}, com erro típico de alguns km.${c ? ` O modelo 3D é simplificado, no tamanho real (${fmtNum(c.size, 1)} m).` : ''}</div>`;
  } else if (t.kind === 'qso') {
    const i = t.qso, z = t.z, M = deep.QSO.M[i];
    h += `<p>O núcleo de uma galáxia distante, onde um buraco negro supermassivo engole matéria e brilha mais que a galáxia inteira.</p>`;
    dl += row('Redshift', `z = ${fmtNum(z, 3)}`);
    dl += row('Distância hoje (comóvel)', fmtDist(dSun));
    dl += row('Luz viajou', fmtYears(lookbackYears(z)));
    dl += row('Idade do universo quando a luz saiu', fmtYears(AGE_OF_UNIVERSE - lookbackYears(z)));
    dl += row('Magnitude absoluta (i)', fmtNum(M, 1));
    dl += row('Brilho', `~${fmtNum(Math.pow(10, -0.4 * (M + 21)), 0)} × a Via Láctea inteira`);
    dl += row('Coordenadas', `RA ${fmtNum(t.ra, 4)}°, Dec ${fmtNum(t.dec, 4)}°`);
    notes += `<div class="note">Catálogo SDSS DR16Q (Lyke et al. 2020), 750 mil quasares. Quem está perto de um quasar o veria como uma estrela ofuscante.</div>`;
    extra += `<div id="photoBox"></div>`;
  } else if (t.kind === 'view') {
    if (t.id === 'v:qso') notes += `<div class="note">Cada ponto é um quasar real do SDSS (750 mil), colorido pelo redshift: azul mais perto, vermelho mais longe. O formato de cunha é a área do céu que o telescópio do SDSS cobriu, vista de fora. Os mais distantes estão a ~30 bilhões de anos-luz (distância comóvel): a luz deles saiu quando o universo tinha menos de 1 bilhão de anos.</div>`;
    if (t.id === 'v:cmb') notes += `<div class="note">A esfera é a radiação cósmica de fundo, medida pelo satélite Planck: a luz mais antiga que existe, de quando o universo tinha 380 mil anos. Hoje esse lugar está a ${fmtDist(CMB_DISTANCE)}: é a borda do universo <b>observável a partir da Terra</b>, não a borda do universo. As manchas são diferenças de temperatura de 1 parte em 100 mil, as sementes de todas as galáxias. A faixa clara é a região tapada pelo disco da Via Láctea, preenchida por interpolação.</div>`;
    if (t.id === 'v:mw') notes += `<div class="note">Ninguém tem foto da Via Láctea vista de fora. Isto é um modelo feito com medidas reais: disco de ~100 mil anos-luz, barra central, 4 braços espirais, e o Sol a 26.700 anos-luz do centro, entre os braços de Perseu e de Sagitário.</div>`;
    if (t.id === 'v:web') notes += `<div class="note">Cada ponto é uma galáxia real do 2MASS Redshift Survey (43 mil), posicionada pela distância do redshift. Os filamentos e vazios são a teia cósmica. A faixa vazia é a "zona de evitação": o disco da Via Láctea tapa essa parte do céu.</div>`;
  } else {
    // céu profundo, galáxias, SIMBAD
    const size = (t.radius || 0) * 2;
    if (t.curated) dl += row('SIMBAD', t.curated.mainId);
    if (t.simbad) { dl += row('SIMBAD', t.simbad.mainId); dl += row('Tipo', t.simbad.otypeLabel); }
    if (t.kind !== 'sky') {
      dl += row('Distância do Sol', fmtDist(dSun));
      if (size > 0 && !t.curated?.z) dl += row('Tamanho', fmtDist(size));
      if (t.curated?.z) dl += row('Redshift', `z = ${t.curated.z}`);
      notes += `<div class="lighttime">${lightSentence(dSun, t.curated?.z || t.simbad?.z)}</div>`;
    }
    if (t.gal != null) notes += `<div class="note">Distância estimada pelo redshift (lei de Hubble, H₀ = 70 km/s/Mpc). O tamanho é o raio medido no infravermelho pelo 2MASS.</div>`;
    if (t.simbad?.dSource) notes += `<div class="note">Distância: ${t.simbad.dSource}.</div>`;
    if (t.kind === 'sky') notes += `<div class="note">O SIMBAD não tem distância medida para este objeto, então não dá para viajar até ele. Dá para observá-lo no telescópio.</div>`;
    extra += `<div id="photoBox"></div>`;
  }
  h += `<dl>${dl}</dl>${notes}${extra}`;
  // transmissões deste aparelho e contato ao vivo com a Rede de Espaço Profundo
  const chans = feeds.channelsFor(t);
  if (t.craft?.kind === 'probe' || t.craft?.kind === 'surface') h += `<div id="dsnLive" class="lighttime small"></div>`;
  const canLink = t.kind !== 'sky' && t.kind !== 'view' && t.id !== 'b:Earth';
  h += `<div class="actions">${chans.length ? `<button id="aFeeds" class="accent" title="Ver as imagens que ele manda para a Terra">📡 O que ele transmite (${chans.length})</button>` : ''}${t.kind !== 'sky' ? '<button id="aGo" class="accent">🚀 Ir até lá</button>' : ''}${canLink ? '<button id="aLink" title="Mostrar este objeto e a Terra juntos, com uma linha ligando os dois (V)">🌍 Onde fica, visto da Terra</button>' : ''}<button id="aScope">🔭 Telescópio</button>${t.kind !== 'sky' ? '<button id="aOrbit">⟲ Orbitar daqui</button>' : ''}</div>`;
  $('infoBody').innerHTML = h;
  $('aGo') && ($('aGo').onclick = () => go(t));
  $('aOrbit') && ($('aOrbit').onclick = () => { setOrbit(t); });
  $('aScope').onclick = () => openScope(t);
  $('aLink') && ($('aLink').onclick = () => startLink(t));
  $('aFeeds') && ($('aFeeds').onclick = () => (chans.length === 1 ? feeds.open(chans[0]) : openFeeds(t)));
  if ($('dsnLive')) {
    const id = t.craft.kind === 'surface' ? { 'perseverance': 'perseverance', 'curiosity': 'curiosity' }[t.craft.id] : t.craft.id;
    if (id) feeds.dsnFor(id).then(ls => {
      if (selected !== t || !$('dsnLive')) return;
      $('dsnLive').innerHTML = ls.length ? `📡 Agora, ao vivo: ${ls.map(feeds.describeLink).join(' ')}` : '';
    });
  }
  for (const li of document.querySelectorAll('#info [data-planet]')) li.onclick = () => go(exoTarget(t.host, li.dataset.planet));
  if ($('photoBox')) showPhoto(t);
}

async function showPhoto(t) {
  const spec = images.photoSpec(t);
  if (!spec) return;
  const box = $('photoBox');
  box.innerHTML = '<p class="muted small">buscando foto…</p>';
  const e = await images.fetchPhoto(spec);
  if (selected !== t || !$('photoBox')) return;
  if (e.state === 'ok') {
    const s = scope.SURVEY_BY_ID[e.survey];
    box.innerHTML = `<img class="thumb" src="${e.dataURL}" alt=""><p class="muted small">Foto: ${s?.label || e.survey} (via hips2fits/CDS)</p>`;
  } else box.innerHTML = '';
}

function refreshInfoDistances() {
  const t = selected;
  const sun = document.querySelector('#info [data-live=sun]');
  if (sun) sun.textContent = fmtDist(v3.len(t.pos()));
  const earth = document.querySelector('#info [data-live=earth]');
  if (earth) earth.textContent = fmtDist(v3.dist(t.pos(), solar.BODY.Earth.pos));
  const alt = document.querySelector('#info [data-live=alt]');
  const s = t.sat || t.craft?.sat;
  if (alt && s) alt.textContent = `${fmtNum(sats.satInfo(s).altKm, 0)} km`;
}

// ---------------------------------------------------------------- telescópio
// Latitude/longitude (planetocêntricas, leste) do ponto de um corpo que está de frente para p
function subPoint(b, p) {
  const { pm, pole, zl } = b.basis || { pm: [1, 0, 0], pole: [0, 0, 1], zl: [0, -1, 0] };
  const d = v3.norm(v3.sub(p, b.pos));
  return { lat: Math.asin(Math.max(-1, Math.min(1, v3.dot(d, pole)))) / DEG, lon: Math.atan2(-v3.dot(d, zl), v3.dot(d, pm)) / DEG };
}
const surfaceMarkers = key => craft.CRAFT.filter(c => c.kind === 'surface' && c.body === key).map(c => ({ lon: c.lon, lat: c.lat, name: c.name, desc: `${c.country} · ${c.launch}` }));

function openScope(t) {
  // Lua, planetas e robôs na superfície: mapas da superfície feitos por sondas
  const bodyKey = t?.body?.key || (t?.craft?.kind === 'surface' ? t.craft.body : null);
  if (bodyKey && scope.hasBodyMaps(bodyKey)) {
    const b = solar.BODY[bodyKey];
    let lon, lat, fov;
    // perto o bastante para ver a cratera ou a região do pouso (Jezero tem 45 km; 1° na Lua são 30 km)
    if (t.craft) { lon = t.craft.lon; lat = t.craft.lat; fov = bodyKey === 'Mars' ? 4 : 1.2; }
    else {
      // a face que a nave está vendo (de perto) ou a que está virada para a Terra
      const near = v3.dist(F.cam, b.pos) < 60 * b.radius;
      ({ lon, lat } = subPoint(b, near || bodyKey === 'Earth' ? F.cam : solar.BODY.Earth.pos));
      fov = 180;
    }
    const sky = bodyKey === 'Earth' ? null : { ...solar.geocentricRaDec(b), fovDeg: 0.5 };    scope.open({ body: bodyKey, lon, lat, fovDeg: fov, name: t.name, markers: surfaceMarkers(bodyKey), sky });
    return;
  }
  let ra, dec, fov = 1, name;
  if (t?.body) {
    if (t.body.key === 'Earth') { const d = xyz2radec(lookDir()); ra = d.ra; dec = d.dec; fov = 60; name = 'direção da nave'; }
    else ({ ra, dec } = solar.geocentricRaDec(t.body));
    name ??= t.name; fov = t.body.key === 'Earth' ? 60 : 0.5;
  } else if (t && (t.kind === 'craft' || t.kind === 'sat')) {
    // como seria vista da Terra (só faz sentido para naves longe da Terra)
    ({ ra, dec } = xyz2radec(v3.sub(t.pos(), solar.BODY.Earth.pos)));
    name = t.name; fov = 0.3;
  } else if (t) {
    ({ ra, dec } = xyz2radec(t.pos()));
    name = t.name;
    const ang = t.radius && v3.len(t.pos()) ? 2 * Math.atan(t.radius / v3.len(t.pos())) / DEG : 0;
    fov = Math.max(ang * 2.2, t.kind === 'star' || t.kind === 'exo' ? 0.15 : 0.1);
  } else {
    ({ ra, dec } = xyz2radec(lookDir())); fov = 30; name = 'direção da nave';
  }
  scope.open({ ra, dec, fovDeg: fov, name });
}
const lookDir = () => { const v = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); return [v.x, v.y, v.z]; };

// ---------------------------------------------------------------- lugares
const PLACES = [
  ['Sistema Solar', [['Terra'], ['Lua'], ['Sol'], ['Marte'], ['Júpiter'], ['Saturno'], ['Urano'], ['Netuno'], ['Plutão']]],
  ['Feito pelo homem', [['Estação Espacial Internacional (ISS)'], ['Estação Espacial Tiangong'], ['Telescópio Espacial Hubble'], ['Telescópio Espacial James Webb'],
    ['Voyager 1', 'o mais distante'], ['Voyager 2'], ['New Horizons'], ['Parker Solar Probe', 'o mais rápido'], ['Juno'],
    ['Apollo 11 (Base da Tranquilidade)'], ['Lunokhod 1'], ["Chang'e 4 e jipe Yutu-2 (lado oculto)"], ['Chandrayaan-3 (Vikram e Pragyan)'],
    ['Perseverance'], ['Curiosity'], ['Zhurong'], ['Venera 13'], ['Tesla Roadster de Elon Musk']]],
  ['Estrelas', [['Próxima Centauri', 'a mais próxima'], ['Alfa Centauri'], ['Sírius', 'a mais brilhante'], ['Betelgeuse', 'supergigante vermelha'], ['Rigel'], ['Estrela Polar'], ['Vega'], ['Antares']]],
  ['Mundos alienígenas', [['TRAPPIST-1 e', 'zona habitável'], ['Proxima Cen b'], ['Kepler-452 b', '"primo" da Terra'], ['TOI-700 d'], ['51 Peg b', 'primeiro em estrela tipo Sol'], ['HD 189733 b', 'chove vidro'], ['55 Cnc e', 'oceano de lava'], ['WASP-12 b', 'sendo devorado']]],
  ['Nebulosas', [['M 42'], ['M 16'], ['NGC 3372'], ['IC 434'], ['M 57'], ['NGC 7293'], ['NGC 3132'], ['M 1'], ['NGC 2070']]],
  ['Aglomerados', [['M 45'], ['NGC 5139'], ['NGC 104'], ['M 13'], ['NGC 4755']]],
  ['Nossa galáxia', [['Sgr A*', 'buraco negro central'], ['@milkyway', 'Via Láctea vista de fora']]],
  ['Galáxias', [['LMC'], ['M 31'], ['M 33'], ['M 51'], ['M 81'], ['M 82'], ['M 104'], ['NGC 5128'], ['M 87'], ['NGC 4038'], ['ESO 350-40'], ['NGC 1300']]],
  ['Universo profundo', [['NGC 7319'], ['NGC 4889'], ['NGC 6505'], ['3C 273'], ['SMACS J0723.3-7327'], ['Abell 2744'], ['@web', 'A teia cósmica (2MRS)']]],
  ['Até a borda do universo', [['TON 618'], ['APM 08279+5255'], ['ULAS J1342+0928'], ['J0313-1806'], ['GN-z11'], ['JADES-GS-z14-0'], ['MoM-z14'],
    ['@qso', '750 mil quasares'], ['@cmb', 'radiação cósmica de fundo']]],
];
function resolvePlace(q) {
  if (q === '@milkyway') {
    // chega por cima do disco, inclinado, com o lado do Sol à frente
    const arriveDir = v3.norm(v3.add(v3.scale(gal2eq([0, 0, 1]), 0.8), v3.scale(gal2eq([-1, 0, 0]), 0.6)));
    return { id: 'v:mw', name: 'Via Láctea', kind: 'view', kindLabel: 'Nossa galáxia (modelo)', pos: () => GALACTIC_CENTER, radius: 15000, viewDist: 55000, arriveDir };
  }
  if (q === '@qso') return { id: 'v:qso', name: 'Mapa dos quasares (SDSS)', kind: 'view', kindLabel: 'Universo distante', pos: () => [0, 0, 0], radius: 0, viewDist: 2.6e10, arriveDir: v3.norm([-0.5, 0.35, 0.8]) };
  if (q === '@cmb') return { id: 'v:cmb', name: 'Borda do universo observável', kind: 'view', kindLabel: 'Radiação cósmica de fundo (Planck)', pos: () => [0, 0, 0], radius: 0, viewDist: 4.2e10 };
  if (q === '@web') return { id: 'v:web', name: 'Teia cósmica (2MRS) — a Via Láctea está no centro', kind: 'view', kindLabel: 'Estrutura em grande escala', pos: () => [0, 0, 0], radius: 0, viewDist: 9e8 };
  const r = search.searchLocal(q, 1)[0];
  return r ? r.make() : null;
}
function buildPlaces() {
  const box = $('placeList');
  for (const [cat, items] of PLACES) {
    box.insertAdjacentHTML('beforeend', `<div class="cat">${cat}</div>`);
    for (const [q, hint] of items) {
      const t = resolvePlace(q);
      if (!t) continue;
      const b = document.createElement('button');
      b.innerHTML = `${t.name}${hint ? `<small>${hint}</small>` : ''}`;
      b.onclick = () => { go(t); };
      box.appendChild(b);
    }
  }
}

// ---------------------------------------------------------------- menus
const LAYERS = [
  ['stars', 'Estrelas (HYG, 109 mil)'], ['galaxies', 'Galáxias (2MRS, 43 mil)'], ['milkyway', 'Via Láctea (modelo)'], ['solar', 'Sistema Solar'],
  ['quasars', 'Quasares (SDSS, 750 mil)'], ['cmb', 'Borda do universo observável (Planck)'], ['orbits', 'Órbitas'], ['exoplanets', 'Exoplanetas'], ['photos', 'Fotos reais (céu profundo)'], ['labels', 'Nomes'], ['sky', 'Céu de fundo'],
];
function buildLayersMenu() {
  const m = $('layers');
  document.body.appendChild(m); // fora da barra: o transform e o overflow dela recortariam o menu
  m.innerHTML = LAYERS.map(([k, l]) => `<label><input type="checkbox" data-layer="${k}" checked> ${l}</label>`).join('') +
    `<h3>Brilho das estrelas</h3><input type="range" id="starGain" min="4" max="12" step="0.1" value="${stars.starUniforms.uLimit.value}">` +
    `<h3>Brilho das galáxias</h3><input type="range" id="galGain" min="9" max="18" step="0.1" value="${galaxies.galSettings.limit}">`;
  for (const cb of m.querySelectorAll('[data-layer]')) cb.onchange = () => { F.layers[cb.dataset.layer] = cb.checked; };
  buildHumanMenu(m);
  $('starGain').oninput = e => { stars.starUniforms.uLimit.value = +e.target.value; };
  $('galGain').oninput = e => { galaxies.galSettings.limit = +e.target.value; };
  $('btnLayers').onclick = ev => {
    const r = ev.currentTarget.getBoundingClientRect();
    m.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 336))}px`;
    m.hidden = !m.hidden;
  };
}
// Objetos feitos pelo homem. A "massaroca" de satélites começa desligada e se liga por categoria e por país.
function buildHumanMenu(m) {
  const meta = sats.SAT.meta;
  const count = c => sats.SAT.list.filter(s => s.cat === c).length;
  let h = `<h3>Feito pelo homem</h3>
    <label><input type="checkbox" data-craft="probes" checked> Naves no espaço profundo</label>
    <label><input type="checkbox" data-craft="trails" checked> Trajetórias das naves</label>
    <label><input type="checkbox" data-craft="surface" checked> Robôs e pousos em outros mundos</label>
    <label><input type="checkbox" data-craft="notable" checked> Satélites em destaque</label>`;
  if (meta) {
    h += `<h3>Em volta da Terra</h3>` + meta.cats.map((c, i) =>
      `<label><input type="checkbox" data-satcat="${i}" ${sats.show.cats[i] ? 'checked' : ''}> ${c} <small class="muted">${fmtNum(count(i), 0)}</small></label>`).join('');
    h += `<div class="chips">` + meta.countries.map((c, i) =>
      `<button class="chip on" data-country="${i}" style="--c:${sats.COUNTRY_COLORS[i]}">${c}</button>`).join('') + `</div>`;
    h += `<div class="row"><button id="satAll">Mostrar tudo</button><button id="satNone">Só o essencial</button></div>`;
    h += `<p class="muted small">${fmtNum(sats.SAT.n, 0)} objetos com órbita pública (CelesTrak, ${new Date(meta.updated).toLocaleDateString('pt-BR')}). O catálogo militar rastreia ${fmtNum(meta.onOrbitTracked, 0)} objetos em órbita; a maior parte dos detritos só sai para quem tem conta no Space-Track.</p>`;
  }
  m.insertAdjacentHTML('beforeend', h);
  for (const cb of m.querySelectorAll('[data-craft]')) cb.onchange = () => { craft.showCraft[cb.dataset.craft] = cb.checked; };
  const sync = () => {
    for (const cb of m.querySelectorAll('[data-satcat]')) cb.checked = sats.show.cats[+cb.dataset.satcat];
    for (const b of m.querySelectorAll('[data-country]')) b.classList.toggle('on', sats.show.countries[+b.dataset.country]);
    sats.setFilter();
  };
  for (const cb of m.querySelectorAll('[data-satcat]')) cb.onchange = () => { sats.show.cats[+cb.dataset.satcat] = cb.checked; sync(); };
  for (const b of m.querySelectorAll('[data-country]')) b.onclick = () => { const i = +b.dataset.country; sats.show.countries[i] = !sats.show.countries[i]; sync(); };
  $('satAll') && ($('satAll').onclick = () => { sats.show.cats.fill(true); sats.show.countries.fill(true); sync(); });
  $('satNone') && ($('satNone').onclick = () => { sats.show.cats.fill(false); sats.show.cats[0] = true; sats.show.countries.fill(true); sync(); });
}

function buildSkyMenu() {
  const s = $('skySel');
  s.add(new Option('Visível (Mellinger)', 'local:mellinger'));
  for (const b of BANDS) for (const it of b.items) if (it.full && it.id !== 'CDS/P/Mellinger/color') s.add(new Option(`${b.name}: ${it.label}`, it.id));
  s.onchange = () => {
    toast('Baixando o mapa do céu inteiro (pode levar uns 20 segundos)…', 30000);
    sky.setSky(s.value, ok => toast(ok ? `Céu: ${s.selectedOptions[0].text}` : 'Não foi possível baixar este mapa agora.'));
  };
}

let toastTimer;
function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------------------------------------------------------------- busca
const input = $('search'), sug = $('suggest');
let sugItems = [], sugSel = 0, simbadSeq = 0;
function renderSuggest() {
  sug.innerHTML = sugItems.map((r, i) => `<li class="${i === sugSel ? 'sel' : ''}" data-i="${i}"><span>${r.label}</span><small>${r.sub}</small></li>`).join('');
  sug.hidden = !sugItems.length;
}
input.addEventListener('input', () => {
  const q = input.value.trim();
  sugItems = q ? search.searchLocal(q, 10) : [];
  if (q.length >= 2) sugItems.push({ label: `Procurar “${q}” no SIMBAD`, sub: 'todo o céu catalogado', simbad: q });
  sugSel = 0;
  renderSuggest();
});
input.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { sugSel = Math.min(sugSel + 1, sugItems.length - 1); renderSuggest(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sugSel = Math.max(sugSel - 1, 0); renderSuggest(); e.preventDefault(); }
  else if (e.key === 'Enter') { choose(sugItems[sugSel]); }
  else if (e.key === 'Escape') { sug.hidden = true; input.blur(); }
});
sug.addEventListener('mousedown', e => {
  const li = e.target.closest('li');
  if (li) { e.preventDefault(); choose(sugItems[+li.dataset.i]); }
});
input.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 150));
async function choose(r) {
  if (!r) return;
  sug.hidden = true; input.blur();
  if (r.simbad) {
    const seq = ++simbadSeq;
    toast(`Consultando o SIMBAD: “${r.simbad}”…`, 20000);
    try {
      const t = await search.searchSimbad(r.simbad);
      if (seq !== simbadSeq) return;
      if (!t) { toast(`O SIMBAD não conhece “${r.simbad}”.`); return; }
      toast(t.simbad.d ? `${t.simbad.mainId}: ${t.kindLabel}, a ${fmtDist(t.simbad.d)}` : `${t.simbad.mainId}: ${t.kindLabel} (sem distância medida)`);
      if (t.kind === 'sky') { select(t); pointAt(t); } else go(t);
    } catch (err) { toast('Falha ao consultar o SIMBAD (sem internet?).'); console.error(err); }
    return;
  }
  input.value = r.label;
  go(r.make());
}

// ---------------------------------------------------------------- botões e teclado
$('btnPlaces').onclick = () => { $('places').hidden = !$('places').hidden; $('btnPlaces').classList.toggle('on', !$('places').hidden); };
$('btnMode').onclick = toggleMode;
$('btnScope').onclick = () => openScope(selected);
$('btnHelp').onclick = () => { $('help').hidden = !$('help').hidden; };
$('scopeClose').onclick = () => scope.close();
$('tPause').onclick = () => { paused = !paused; hud(); };
$('tSlower').onclick = () => { rateIdx = Math.max(rateIdx - 1, 0); paused = false; hud(); };
$('tFaster').onclick = () => { rateIdx = Math.min(rateIdx + 1, RATES.length - 1); paused = false; hud(); };
$('tNow').onclick = () => { F.date = new Date(); rateIdx = 7; paused = false; hud(); };
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => { $(b.dataset.close).hidden = true; if (b.dataset.close === 'info') select(null); };

// ---------------------------------------------------------------- transmissões
function openFeeds(filterFor = null) {
  $('places').hidden = true; $('btnPlaces').classList.remove('on');
  linkMode.link.target && linkMode.stop();
  feeds.buildPanel(filterFor);
  $('feeds').hidden = false;
}
$('btnFeeds').onclick = () => ($('feeds').hidden ? openFeeds() : ($('feeds').hidden = true));
$('dsnClose').onclick = () => feeds.closeDSN();
const craftToTarget = c => (c.sat && !c.id ? satTarget(c.sat) : craftTarget(c));
// Câmera onde o satélite está, olhando para a Terra
function viewpointOf(c) {
  const t = craftToTarget(c);
  const E = () => solar.BODY.Earth.pos;
  const d0 = v3.dist(t.pos(), E());
  select(t);
  setMode('orbit');
  flyTo({ id: 'vp:' + t.id, name: `A Terra vista por ${t.name}`, kind: 'view', pos: E, radius: solar.BODY.Earth.radius, viewDist: d0, arriveDir: () => v3.norm(v3.sub(t.pos(), E())) });
  toast(`Você está onde ${t.name} está, olhando para a Terra.`, 5000);
}
feeds.setHooks({
  toast,
  goCraft: c => go(craftToTarget(c)),
  viewpoint: viewpointOf,
  sky: s => scope.open({ ra: s.ra, dec: s.dec, fovDeg: 0.15, name: s.name }),
  lookEarth: () => { if (v3.dist(F.cam, solar.BODY.Earth.pos) > 2e6 * KM) go(bodyTarget('Earth')); },
});
feeds.wireViewer();

// ---------------------------------------------------------------- "onde fica, visto da Terra"
function startLink(t) {
  if (!t || t.kind === 'sky' || t.kind === 'view' || t.id === 'b:Earth') { toast('Selecione um objeto (que não seja a Terra) para ver onde ele fica em relação à Terra.'); return; }
  $('places').hidden = true; $('btnPlaces').classList.remove('on');
  linkMode.start(t);
}
$('lkSide').onclick = () => linkMode.sideBySide();
$('lkEarth').onclick = () => linkMode.fromEarth();
$('lkClose').onclick = () => linkMode.stop();
$('lkLoc').onclick = () => linkMode.useMyLocation(ok => toast(ok ? 'Usando a sua localização.' : 'Não foi possível obter a localização (permissão negada?).'));

function toggleMode() {
  if (nav.mode === 'orbit') setMode('free');
  else if (selected && selected.kind !== 'sky') setOrbit(selected);
  else if (nav.target) setOrbit(nav.target);
  toast(nav.mode === 'orbit' ? 'Orbitando o alvo' : 'Voo livre: W A S D para voar, Shift para turbo');
}

const canvas = $('view');
let clickTimer = null;
canvas.addEventListener('pointerup', e => {
  if (!wasClick() || e.button !== 0) return;
  const t = labels.pickAt(e.clientX, e.clientY);
  if (!t) return;
  select(t);
});
canvas.addEventListener('dblclick', e => {
  const t = labels.pickAt(e.clientX, e.clientY);
  if (t) go(t);
});
labels.setOnPick((t, dbl) => (dbl ? go(t) : select(t)));
nav.onArrive = t => { if (selected?.id === t.id) renderInfo(t); };

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (scope.isOpen()) { if (e.key === 'Escape') scope.close(); return; }
  if (!$('viewer').hidden) return; // o visualizador de imagens tem as próprias teclas
  switch (e.key) {
    case 'Tab': e.preventDefault(); toggleMode(); break;
    case '/': e.preventDefault(); input.focus(); input.select(); break;
    case 'g': case 'G': go(selected); break;
    case 't': case 'T': openScope(selected); break;
    case 'l': case 'L': $('btnPlaces').click(); break;
    case 'x': case 'X': $('btnFeeds').click(); break;
    case 'v': case 'V': linkMode.link.target ? linkMode.stop() : startLink(selected); break;
    case 'm': case 'M': {
      const on = !sats.show.cats.slice(1).some(Boolean);
      for (let i = 1; i < sats.show.cats.length; i++) sats.show.cats[i] = on;
      sats.setFilter();
      for (const cb of document.querySelectorAll('[data-satcat]')) cb.checked = sats.show.cats[+cb.dataset.satcat];
      toast(on ? `Mostrando todos os ${fmtNum(sats.SAT.n, 0)} satélites e detritos (M para esconder)` : 'Massaroca escondida: só as estações (M para mostrar)');
      break;
    }
    case 'h': case 'H': case '?': $('btnHelp').click(); break;
    case ' ': e.preventDefault(); $('tPause').click(); break;
    case ',': $('tSlower').click(); break;
    case '.': $('tFaster').click(); break;
    case 'Escape':
      if (nav.flight) cancelFlight();
      else if (linkMode.link.target) linkMode.stop();
      else { $('help').hidden = true; $('places').hidden = true; $('layers').hidden = true; $('feeds').hidden = true; }
      break;
  }
});

init().catch(err => {
  console.error(err);
  $('loadStep').textContent = 'Erro: ' + err.message;
});

// para depuração no console
window.astro = { F, nav, DB, go, select, search, flyTo, solar, systems, sats, craft };
