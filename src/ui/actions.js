// Ações centrais da interface: selecionar, ir até, apontar, abrir o telescópio, "visto da Terra" e transmissões.
// Os outros módulos de interface chamam estas funções em vez de se chamarem entre si.
import * as THREE from 'three';
import { F, camera } from '../engine.js';
import * as solar from '../layers/solar.js';
import * as images from '../layers/images.js';
import * as sats from '../layers/sats.js';
import * as craft from '../layers/craft.js';
import * as labels from '../labels.js';
import * as scope from '../telescope.js';
import * as linkMode from '../link.js';
import * as feeds from '../feeds.js';
import { nav, flyTo, setOrbit, setMode, cancelFlight, lookAtDir } from '../nav.js';
import { bodyTarget, craftTarget, satTarget, nextPeak } from '../targets.js';
import * as smallbodies from '../layers/smallbodies.js';
import * as P5L from '../layers/phase5.js';
import { bhForTarget } from './phenomena.js';
import { SCOPE_KEY } from '../layers/moons.js';
import { v3, KM, AU, DEG, xyz2radec } from '../astro.js';
import { renderInfo } from './info.js';
import { $, toast } from './dom.js';

export const ui = { selected: null };

// A ficha é uma coluna ao lado dos lugares: aberta, o 3D começa depois dela (classe info-open no body).
// Observa o atributo hidden, para valer também quando alguém fecha a ficha direto.
new MutationObserver(() => document.body.classList.toggle('info-open', !$('info').hidden))
  .observe($('info'), { attributes: true, attributeFilter: ['hidden'] });

export function select(t) {
  ui.selected = t;
  labels.setSelected(t);
  images.setExtra(t);
  sats.setSelected(t?.sat || t?.craft?.sat);
  craft.setSelected(t);
  // asteroide ou cometa: malha e órbita; chuva de meteoros: órbita do corpo de origem e a corrente de poeira
  const parent = t?.shower ? showerParent(t.shower) : null;
  smallbodies.setSelected(t?.sb || parent);
  smallbodies.showStream(parent);
  P5L.showBlackHole(bhForTarget(t));
  if (!t?.gw) P5L.showGwShell(0);
  if (linkMode.link.target && linkMode.link.target.id !== t?.id) linkMode.stop();
  if (!t) { $('info').hidden = true; return; }
  renderInfo(t);
  $('info').hidden = false;
}

export const showerParent = s => smallbodies.SB.famous.find(f => f.sstr === s.parent) || null;

export function go(t) {
  if (!t) return;
  if (t.kind === 'shower') {
    // vai para o dia do pico e mostra a Terra atravessando a poeira deixada pelo corpo de origem
    const peak = nextPeak(t.shower);
    F.date = peak;
    solar.computePositions();
    select(t);
    setMode('orbit');
    // de cima do plano da Terra, longe o bastante para ver a corrente de poeira cruzando a órbita
    flyTo({ ...t, viewDist: 2.2 * AU, arriveDir: () => v3.norm(v3.add(v3.scale(v3.norm(solar.BODY.Earth.pos), 0.3), [0, -0.38, 0.88])) });
    toast(`Data ajustada para o pico das ${t.name}: ${peak.toLocaleDateString('pt-BR')}. Use "agora" na barra para voltar.`, 7000);
    return;
  }
  if (t.kind === 'sky') { pointAt(t); toast('Sem distância medida para este objeto: abrindo no telescópio.'); openScope(t); return; }
  // buraco negro: chega perto o bastante para ver o horizonte de eventos (40 raios de Schwarzschild)
  const bh = t.curated?.type === 'bh' && bhForTarget(t);
  if (bh) { const rs = 2.95 * KM * bh.massSun; t.radius = rs; t.viewDist = 40 * rs; }
  select(t);
  setMode('orbit');
  flyTo(t);
}

export function pointAt(t) {
  const dir = v3.norm(v3.sub(t.pos(), F.cam));
  cancelFlight();
  setMode('free');
  camera.quaternion.copy(lookAtDir(dir));
}

export function toggleMode() {
  const s = ui.selected;
  if (nav.mode === 'orbit') setMode('free');
  else if (s && s.kind !== 'sky') setOrbit(s);
  else if (nav.target) setOrbit(nav.target);
  toast(nav.mode === 'orbit' ? 'Orbitando o alvo' : 'Voo livre: W A S D para voar, Shift para turbo');
}

// ---------------------------------------------------------------- telescópio
export const lookDir = () => { const v = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); return [v.x, v.y, v.z]; };

// Latitude/longitude (planetocêntricas, leste) do ponto de um corpo que está de frente para p
function subPoint(b, p) {
  const { pm, pole, zl } = b.basis || { pm: [1, 0, 0], pole: [0, 0, 1], zl: [0, -1, 0] };
  const d = v3.norm(v3.sub(p, b.pos));
  return { lat: Math.asin(Math.max(-1, Math.min(1, v3.dot(d, pole)))) / DEG, lon: Math.atan2(-v3.dot(d, zl), v3.dot(d, pm)) / DEG };
}
const surfaceMarkers = key => craft.CRAFT.filter(c => c.kind === 'surface' && c.body === key).map(c => ({ lon: c.lon, lat: c.lat, name: c.name, desc: `${c.country} · ${c.launch}` }));

export function openScope(t) {
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
    const sky = bodyKey === 'Earth' ? null : { ...solar.geocentricRaDec(b), fovDeg: 0.5 };
    scope.open({ body: bodyKey, lon, lat, fovDeg: fov, name: t.name, markers: surfaceMarkers(bodyKey), sky });
    return;
  }
  // luas com mapa: o telescópio abre no mapa da superfície (longitude 0 = face voltada para o planeta)
  if (t?.moon && SCOPE_KEY[t.moon.id] && scope.hasBodyMaps(SCOPE_KEY[t.moon.id])) { scope.open({ body: SCOPE_KEY[t.moon.id], lon: 0, lat: 0, fovDeg: 180, name: t.name }); return; }
  if (t?.shower) { scope.open({ ra: t.shower.ra, dec: t.shower.dec, fovDeg: 40, name: `Radiante das ${t.shower.name}` }); return; }
  let ra, dec, fov = 1, name;
  if (t?.body) {
    if (t.body.key === 'Earth') { const d = xyz2radec(lookDir()); ra = d.ra; dec = d.dec; fov = 60; name = 'direção da nave'; }
    else ({ ra, dec } = solar.geocentricRaDec(t.body));
    name ??= t.name; fov = t.body.key === 'Earth' ? 60 : 0.5;
  } else if (t && (t.kind === 'craft' || t.kind === 'sat' || t.kind === 'sb')) {
    // direção vista da Terra (naves, asteroides e cometas estão perto o bastante para a posição da Terra importar)
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

// ---------------------------------------------------------------- "onde fica, visto da Terra"
export function startLink(t) {
  if (!t || t.kind === 'sky' || t.kind === 'view' || t.id === 'b:Earth') { toast('Selecione um objeto (que não seja a Terra) para ver onde ele fica em relação à Terra.'); return; }
  linkMode.start(t);
}

// ---------------------------------------------------------------- transmissões
export function openFeeds(filterFor = null) {
  linkMode.link.target && linkMode.stop();
  feeds.buildPanel(filterFor);
  $('feeds').hidden = false;
}
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
export function wireFeeds() {
  feeds.setHooks({
    toast,
    goCraft: c => go(craftToTarget(c)),
    viewpoint: viewpointOf,
    sky: s => scope.open({ ra: s.ra, dec: s.dec, fovDeg: 0.15, name: s.name }),
    lookEarth: () => { if (v3.dist(F.cam, solar.BODY.Earth.pos) > 2e6 * KM) go(bodyTarget('Earth')); },
  });
  feeds.wireViewer();
}
