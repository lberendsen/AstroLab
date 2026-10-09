// Tours guiados: roteiros em JSON (data/tours/*.json) que conduzem a câmera, o tempo e as camadas, com narração.
// Formato de um passo (todos os campos são opcionais, exceto "text"):
//   text        narração
//   go          nome para procurar ("Saturno", "M 42") ou vista especial ("@milkyway", "@web", "@qso", "@cmb",
//               "@sistema:9" = Sistema Solar visto de cima a 9 UA, "@terra-lua", "@grupolocal")
//   dist, unit  distância de chegada: unit = "km" | "ua" | "al" (anos-luz) | "pc" | "raios" (do alvo)
//   date        "2026-10-09T23:00:00Z" ou "now";  rate: segundos simulados por segundo real;  pause: true/false
//   planetarium { body, lat, lon, name, az, alt, fov }   ·   exitPlanetarium: true
//   constSpace  "Ori" (só uma constelação em 3D) | true (todas) | false
//   telescope   { target, fov }                          ·   select: nome (só seleciona, sem viajar)
//   button      { label, feed: id do canal }  ou  { label, telescope: nome }  — botão opcional na legenda
//   hold        segundos extras antes de avançar sozinho
import { F } from '../engine.js';
import * as solar from '../layers/solar.js';
import * as PLN from '../planetarium.js';
import * as feeds from '../feeds.js';
import * as search from '../search.js';
import * as time from '../time.js';
import { nav, setMode, flyTo } from '../nav.js';
import { v3, AU, KM, LY, DEG } from '../astro.js';
import { resolvePlace } from './places.js';
import { select, go, openScope } from './actions.js';
import { stopReplay } from './timepanel.js';
import { $, toast } from './dom.js';

export const TOURS = [];
const ECL_POLE = [0, -0.39777716, 0.91748206];
const UNIT = { km: KM, ua: AU, al: LY, pc: 1 };

export async function load() {
  try {
    const idx = await (await fetch('data/tours/index.json')).json();
    for (const f of idx) TOURS.push(await (await fetch(`data/tours/${f}`)).json());
  } catch (e) { console.warn('tours indisponíveis', e); }
}

// Resolve o alvo de um passo
function resolve(q) {
  if (q.startsWith('@sistema:')) {
    const au = +q.split(':')[1];
    return { id: 'v:sys' + au, name: 'Sistema Solar', kind: 'view', kindLabel: 'Visto de cima', pos: () => [0, 0, 0], radius: 0, viewDist: au * AU, arriveDir: v3.norm(v3.add(ECL_POLE, [0.3, 0.1, 0])) };
  }
  if (q === '@terra-lua') {
    const E = () => solar.BODY.Earth.pos;
    return { id: 'v:em', name: 'Terra e Lua', kind: 'view', kindLabel: 'O sistema Terra–Lua', pos: E, radius: solar.BODY.Earth.radius, viewDist: 9e5 * KM, arriveDir: () => v3.norm(v3.add(ECL_POLE, v3.scale(v3.norm(v3.sub(solar.BODY.Moon.pos, E())), -0.3))) };
  }
  if (q === '@grupolocal') {
    const m31 = resolvePlace('M 31').pos();
    const mid = v3.scale(m31, 0.5), side = v3.norm(v3.cross(m31, [0, 0, 1]));
    return { id: 'v:lg', name: 'Grupo Local', kind: 'view', kindLabel: 'A Via Láctea e Andrômeda', pos: () => mid, radius: 0, viewDist: 1.1 * v3.len(m31), arriveDir: v3.norm(v3.add(side, [0, 0, 0.5])) };
  }
  return resolvePlace(q);
}

// ---------------------------------------------------------------- execução
const T = { tour: null, i: -1, playing: true, stepStart: 0, flying: false, timer: null };

export function startTour(tour) {
  stopReplay(true);
  if (PLN.PL.active) PLN.exit(true);
  T.tour = tour; T.playing = true;
  $('places').hidden = true; $('btnPlaces').classList.remove('on');
  $('tourPanel').hidden = true;
  $('tourCap').hidden = false;
  $('tcTitle').textContent = tour.title;
  runStep(0);
}

export function stopTour(silent) {
  if (!T.tour) return;
  T.tour = null; T.i = -1;
  $('tourCap').hidden = true;
  if (PLN.PL.show.only) { PLN.PL.show.space = false; PLN.PL.show.only = null; }
  time.setRate(1); time.clock.paused = false;
  if (!silent) toast('Tour encerrado. Continue explorando daqui, ou use "agora" para voltar ao presente.', 6000);
}

function runStep(i) {
  const tour = T.tour;
  if (!tour) return;
  if (i >= tour.steps.length) { finish(); return; }
  T.i = Math.max(0, i);
  const s = tour.steps[T.i];
  $('tcStep').textContent = `${T.i + 1} de ${tour.steps.length}`;
  $('tcText').textContent = s.text;
  $('tcBar').style.width = `${((T.i + 1) / tour.steps.length * 100).toFixed(1)}%`;
  $('tcPlay').textContent = T.playing ? '❚❚' : '▶';
  // ---- ações
  try {
    if (s.exitPlanetarium && PLN.PL.active) PLN.exit(true);
    if (s.date) { time.setDate(s.date === 'now' ? new Date() : new Date(s.date)); solar.computePositions(); }
    if (s.rate != null) time.setRate(s.rate);
    if (s.pause != null) time.clock.paused = s.pause;
    if (s.constSpace != null) { PLN.PL.show.space = !!s.constSpace; PLN.PL.show.only = typeof s.constSpace === 'string' ? s.constSpace : null; }
    if (s.planetarium) {
      const p = s.planetarium;
      PLN.enter(p.body || 'Earth', p.lat ?? PLN.PL.lat, p.lon ?? PLN.PL.lon, p.name || PLN.PL.name);
      T.plView = p;
    } else if (s.go) {
      if (PLN.PL.active) PLN.exit(true);
      const t = resolve(s.go);
      if (!t) console.warn('tour: alvo não encontrado', s.go);
      else if (t.action) t.action();
      else {
        if (s.dist) t.viewDist = s.dist * (s.unit === 'raios' ? (t.radius || 1) : UNIT[s.unit || 'km']);
        go(t);
      }
    }
    if (s.select) { const r = search.searchLocal(s.select, 1)[0]; if (r) select(r.make()); }
    if (s.telescope) { const r = search.searchLocal(s.telescope.target, 1)[0]; if (r) openScope(r.make()); }
  } catch (e) { console.error('tour', e); }
  // botão opcional
  const b = $('tcExtra');
  b.hidden = !s.button;
  if (s.button) {
    b.textContent = s.button.label;
    b.onclick = () => {
      T.playing = false; $('tcPlay').textContent = '▶';
      if (s.button.feed) { const ch = feeds.CHANNELS.find(c => c.id === s.button.feed); if (ch) feeds.open(ch); }
      if (s.button.telescope) { const r = search.searchLocal(s.button.telescope, 1)[0]; if (r) openScope(r.make()); }
    };
  }
  T.stepStart = performance.now();
  T.flying = true;
}

function finish() {
  $('tcText').textContent = T.tour.end || 'Fim do tour. Continue explorando daqui.';
  $('tcStep').textContent = 'fim';
  $('tcExtra').hidden = true;
  T.playing = false; $('tcPlay').textContent = '▶';
  T.i = T.tour.steps.length;
}

// Chamado a cada quadro: espera o voo terminar, dá tempo de ler e avança
export function tick() {
  if (!T.tour || T.i < 0 || T.i >= T.tour.steps.length) return;
  const s = T.tour.steps[T.i];
  const busy = nav.flight || PLN.PL.pending;
  if (T.flying && !busy) {
    T.flying = false; T.arrived = performance.now();
    // ao pousar no planetário, aponta o olhar
    if (s.planetarium && PLN.PL.active) { const p = s.planetarium; if (p.az != null) PLN.PL.az = p.az; if (p.alt != null) PLN.PL.alt = p.alt; if (p.fov != null) PLN.PL.fov = p.fov; }
  }
  if (!T.playing || T.flying) return;
  const read = Math.max(5, s.text.length / 16) + (s.hold || 0);
  if ((performance.now() - T.arrived) / 1000 > read) runStep(T.i + 1);
}

export function wireTours() {
  $('tcPlay').onclick = () => { if (!T.tour) return; if (T.i >= T.tour.steps.length) { runStep(0); T.playing = true; } else { T.playing = !T.playing; T.arrived = performance.now(); } $('tcPlay').textContent = T.playing ? '❚❚' : '▶'; };
  $('tcNext').onclick = () => T.tour && runStep(T.i + 1);
  $('tcPrev').onclick = () => T.tour && runStep(Math.max(0, T.i - 1));
  $('tcStop').onclick = () => stopTour();
  $('btnTours').onclick = () => { $('tourPanel').hidden = !$('tourPanel').hidden; renderList(); };
  $('tpClose2').onclick = () => { $('tourPanel').hidden = true; };
}
export function renderList() {
  $('tourList').innerHTML = TOURS.map((t, i) => `<div class="repRow" data-i="${i}"><b>${t.title}</b><small>${t.sub} · ${t.steps.length} paradas, ~${Math.round(t.steps.reduce((s, x) => s + Math.max(5, x.text.length / 16) + (x.hold || 0) + 6, 0) / 60)} min</small></div>`).join('');
  for (const el of document.querySelectorAll('#tourList .repRow')) el.onclick = () => startTour(TOURS[+el.dataset.i]);
}
export const tourActive = () => !!T.tour;
void F; void DEG; void setMode; void flyTo;
