// AstroLab: inicialização e laço de quadros. A interface fica em ui/, as camadas do 3D em layers/.
import * as THREE from 'three';
import { F, renderer, scene, camera, beginFrame, resize, local, place } from './engine.js';
import { DB, loadAll } from './data.js';
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
import * as smallbodies from './layers/smallbodies.js';
import * as linkMode from './link.js';
import * as feeds from './feeds.js';
import * as labels from './labels.js';
import * as search from './search.js';
import * as time from './time.js';
import { nav, flyTo, setOrbit, update as navUpdate, lookAtDir } from './nav.js';
import { bodyTarget } from './targets.js';
import { v3, AU, fmtDist, fmtSpeed, GALACTIC_CENTER } from './astro.js';
import { ui, select, go, wireFeeds } from './ui/actions.js';
import { refreshInfoDistances } from './ui/info.js';
import { buildPlaces } from './ui/places.js';
import { buildLayersMenu, buildSkyMenu, updateSbStatus } from './ui/menus.js';
import { wireSearch } from './ui/searchbox.js';
import { wireControls } from './ui/keys.js';
import { perf } from './ui/perf.js';
import { $ } from './ui/dom.js';

// ---------------------------------------------------------------- inicialização
async function init() {
  const step = s => { $('loadStep').textContent = s; };
  await loadAll(step);
  step('naves e satélites');
  await Promise.all([sats.load(), craft.load()]);
  step('asteroides e cometas');
  await smallbodies.load();
  step('quasares');
  await deep.load();
  deep.addCurated(DB.curated);
  step('montando a cena');
  solar.build(); solar.computePositions();
  stars.build(); galaxies.build(); milkyway.build(); systems.build();
  sats.build(); craft.addNotableSats(); craft.build(); deep.build(); smallbodies.build();
  search.buildIndex();
  buildPlaces(); buildLayersMenu(); buildSkyMenu();
  wireSearch(); wireFeeds(); wireControls(hud);

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

// ---------------------------------------------------------------- escala da cena
// Distância até a superfície mais próxima: define a escala de renderização (ver engine.js)
let nearGal = Infinity;
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

// ---------------------------------------------------------------- laço principal
let last = 0, frameNo = 0;
const T = perf.time;

function loop(now) {
  requestAnimationFrame(loop);
  const t0 = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  F.dt = dt;
  time.advance(dt);
  T('efemérides', () => solar.computePositions());
  T('navegação', () => navUpdate(dt));
  // leve abertura do campo de visão durante a dobra
  const fov = 60 + 18 * nav.warp;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; resize(); }
  camera.updateMatrixWorld();
  F.near = T('escala', computeNear);
  beginFrame();
  T('céu e estrelas', () => { sky.update(); stars.update(); galaxies.update(); milkyway.update(); });
  T('Sistema Solar', () => solar.update());
  T('exoplanetas', () => systems.update(dt));
  T('fotos', () => images.update());
  T('satélites', () => { sats.update(); sats.updateOrbitLine(local, place); });
  T('naves', () => craft.update());
  T('asteroides/cometas', () => smallbodies.update());
  T('quasares/CMB', () => deep.update());
  T('linhas', () => { linkMode.update(); if (linkMode.link.target && frameNo % 30 === 0) linkMode.render(); feeds.update(); });
  T('rótulos', () => labels.update());
  $('warp').style.opacity = nav.warp.toFixed(3);
  T('desenho (CPU)', () => renderer.render(scene, camera));
  if (frameNo++ % 10 === 0) hud();
  perf.frame(performance.now() - t0);
}

function hud() {
  const dSun = v3.len(F.cam);
  let html = `Distância do Sol: <b>${dSun < 1e-9 ? '—' : fmtDist(dSun)}</b>`;
  if (nav.target) html += `<br>Até ${nav.target.name}: <b>${fmtDist(Math.max(v3.dist(F.cam, nav.target.pos()) - (nav.target.radius || 0), 0))}</b>`;
  if (nav.speed > 0) html += `<br>Velocidade: <b>${fmtSpeed(nav.speed)}</b>`;
  $('where').innerHTML = html;
  $('clock').innerHTML = `${F.date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}<br><small>${time.rateLabel()}</small>`;
  $('tPause').textContent = time.clock.paused ? '▶' : '❚❚';
  $('btnMode').textContent = nav.mode === 'orbit' ? '⟲ Orbitar' : '✈ Voar livre';
  if (frameNo % 30 === 0) refreshInfoDistances();
  maybeLoadMoreAsteroids();
}

// O resto dos asteroides (1,5 milhão; ~34 MB) só é baixado quando o usuário está no Sistema Solar, após o início
let sbAsked = false;
function maybeLoadMoreAsteroids() {
  const SB = smallbodies.SB;
  if (sbAsked || !SB.meta || performance.now() < 8000) return;
  if (v3.len(F.cam) > 200 * AU || !smallbodies.showSB.asteroids || F.layers.solar === false) return;
  sbAsked = true;
  updateSbStatus();
  smallbodies.loadMore(() => updateSbStatus()).then(() => updateSbStatus());
}

init().catch(err => {
  console.error(err);
  $('loadStep').textContent = 'Erro: ' + err.message;
});

// para depuração no console e para o teste de fumaça
window.astro = { F, nav, DB, go, select, search, flyTo, solar, systems, sats, craft, perf, ui, smallbodies };
