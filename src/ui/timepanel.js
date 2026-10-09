// Painel "Tempo": escolher a data (de 100 mil anos atrás a 100 mil anos à frente), eclipses e replays de missões.
import * as A from 'astronomy-engine';
import { F } from '../engine.js';
import * as solar from '../layers/solar.js';
import { CRAFT, setFocus } from '../layers/craft.js';
import { nav, flyTo, setMode } from '../nav.js';
import { bodyTarget, craftTarget } from '../targets.js';
import { REPLAYS } from '../replays.js';
import * as time from '../time.js';
import { v3, AU, KM, fmtNum } from '../astro.js';
import { select, go } from './actions.js';
import { $, toast } from './dom.js';

const Y_MS = 31557600000, J2000 = 946728000000;
const ECL_POLE = [0, -0.39777716, 0.91748206];

// ---------------------------------------------------------------- abas
export function openTime(tab = 'date') {
  $('timePanel').hidden = false;
  showTab(tab);
}
function showTab(tab) {
  for (const b of document.querySelectorAll('#timePanel [data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const s of document.querySelectorAll('#timePanel [data-pane]')) s.hidden = s.dataset.pane !== tab;
  if (tab === 'date') syncDate();
  if (tab === 'ecl') renderEclipses();
  if (tab === 'rep') renderReplays();
}

// ---------------------------------------------------------------- data
const pad = n => String(n).padStart(2, '0');
function syncDate() {
  const d = F.date, y = d.getUTCFullYear();
  if (y >= 1 && y <= 9999) $('tpDate').value = `${String(y).padStart(4, '0')}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  $('tpYear').value = Math.min(2100, Math.max(1900, y));
  $('tpEra').value = Math.round((d.getTime() - J2000) / Y_MS);
  $('tpEraLbl').textContent = time.fmtDate(d, false);
}
function jump(date, msg) {
  stopReplay(true);
  time.setDate(date);
  solar.computePositions();
  syncDate();
  if (msg) toast(msg, 6000);
}
export function wireTime() {
  for (const b of document.querySelectorAll('#timePanel [data-tab]')) b.onclick = () => showTab(b.dataset.tab);
  $('tpClose').onclick = () => { $('timePanel').hidden = true; };
  $('tpGo').onclick = () => { const v = $('tpDate').value; if (v) jump(new Date(v)); };
  $('tpYear').oninput = e => { const d = new Date(F.date); d.setUTCFullYear(+e.target.value); jump(d); };
  $('tpEra').oninput = e => {
    const y = +e.target.value;
    jump(new Date(J2000 + y * Y_MS));
    $('tpEraLbl').textContent = time.fmtDate(F.date, false);
  };
  for (const b of document.querySelectorAll('#timePanel [data-jump]')) b.onclick = () => {
    const v = b.dataset.jump;
    if (v === 'now') { stopReplay(true); time.now(); syncDate(); return; }
    jump(new Date(J2000 + (+v) * Y_MS), b.dataset.msg);
  };
  $('rcPause').onclick = () => { time.togglePause(); };
  $('rcNext').onclick = () => { if (!R) return; const s = R.r.steps[R.idx + 1]; time.setDate(s ? Date.parse(s.at) : Date.parse(R.r.end)); };
  $('rcStop').onclick = () => stopReplay();
}

// ---------------------------------------------------------------- eclipses
const KIND_PT = { total: 'total', annular: 'anular', partial: 'parcial', penumbral: 'penumbral', hybrid: 'híbrido' };
const FAMOUS_ECL = [
  { d: '1919-05-29', solar: true, note: 'Em Sobral (CE), astrônomos fotografaram estrelas perto do Sol eclipsado e confirmaram a relatividade de Einstein: a gravidade curva a luz.' },
  { d: '1991-07-11', solar: true, note: 'Um dos mais longos do século 20 (6 min 53 s): do Havaí ao México e ao Brasil.' },
  { d: '2017-08-21', solar: true, note: 'O "Grande Eclipse Americano", de costa a costa nos EUA.' },
  { d: '2024-04-08', solar: true, note: 'Atravessou México, EUA e Canadá.' },
  { d: '2027-02-06', solar: true, note: 'Anular: o "anel de fogo" passa pelo sul do Brasil (RS e SC), Uruguai e Argentina.' },
  { d: '2027-08-02', solar: true, note: 'O eclipse total mais longo do século 21 em terra: 6 min 23 s, sobre o Egito.' },
  { d: '2045-08-12', solar: true, note: 'Total sobre os EUA, o Caribe e o Brasil (Norte e Nordeste).' },
  { d: '2025-09-07', solar: false, note: 'Eclipse lunar total visto da Ásia, da África e da Europa.' },
];
function solarAt(dateStr) { return A.SearchGlobalSolarEclipse(A.MakeTime(new Date(Date.parse(dateStr) - 864e5))); }
function lunarAt(dateStr) { return A.SearchLunarEclipse(A.MakeTime(new Date(Date.parse(dateStr) - 864e5))); }
const fmtD = d => d.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
const latLon = (lat, lon) => `${fmtNum(Math.abs(lat), 0)}° ${lat >= 0 ? 'N' : 'S'}, ${fmtNum(Math.abs(lon), 0)}° ${lon >= 0 ? 'L' : 'O'}`;

function renderEclipses() {
  const box = $('tpEclList');
  const y = F.date.getUTCFullYear();
  if (y < 1600 || y > 2500) { box.innerHTML = '<p class="small muted">Os eclipses são calculados para datas entre 1600 e 2500. Volte a data para mais perto de hoje.</p>'; return; }
  const items = [];
  let e = A.SearchGlobalSolarEclipse(A.MakeTime(F.date));
  for (let k = 0; k < 6; k++) { items.push({ solar: true, info: e }); e = A.NextGlobalSolarEclipse(e.peak); }
  let l = A.SearchLunarEclipse(A.MakeTime(F.date));
  for (let k = 0; k < 6; k++) { items.push({ solar: false, info: l }); l = A.NextLunarEclipse(l.peak); }
  items.sort((a, b) => a.info.peak.date - b.info.peak.date);
  const row = (it, note) => {
    const i = it.info;
    const where = it.solar ? (i.latitude != null ? ` · máximo em ${latLon(i.latitude, i.longitude)}` : '') : '';
    return `<div class="eclRow ${it.solar ? 'sun' : 'moon'}" data-t="${i.peak.date.getTime()}" data-solar="${it.solar ? 1 : 0}" data-lat="${i.latitude ?? ''}"><b>${it.solar ? '☀️ Solar' : '🌕 Lunar'} ${KIND_PT[i.kind] || i.kind}</b><small>${fmtD(i.peak.date)}${where}${note ? '<br>' + note : ''}</small></div>`;
  };
  box.innerHTML = `<h3>Próximos a partir de ${time.fmtDate(F.date, false)}</h3>` + items.map(it => row(it)).join('') +
    `<h3>Famosos</h3>` + FAMOUS_ECL.map(f => row({ solar: f.solar, info: f.solar ? solarAt(f.d) : lunarAt(f.d) }, f.note)).join('') +
    `<p class="muted small">Cálculo: Astronomy Engine. A sombra no globo é calculada ponto a ponto pela posição real do Sol, da Lua e da Terra.</p>`;
  for (const r of box.querySelectorAll('.eclRow')) r.onclick = () => goEclipse(+r.dataset.t, r.dataset.solar === '1', r.dataset.lat === '' ? null : +r.dataset.lat);
}

function goEclipse(peakMs, solarEcl, lat) {
  stopReplay(true);
  // começa um pouco antes do máximo e passa a 5 minutos por segundo
  time.setDate(peakMs - (solarEcl ? 1.6 : 2.2) * 3600e3);
  solar.computePositions();
  time.setRate(300);
  syncDate();
  setMode('orbit');
  if (solarEcl) {
    const E = () => solar.BODY.Earth.pos, R = solar.BODY.Earth.radius, la = (lat || 0) * Math.PI / 180;
    // do lado do Sol, inclinado para a latitude do máximo
    const dir = () => v3.norm(v3.add(v3.scale(v3.norm(v3.scale(E(), -1)), Math.cos(la)), v3.scale([0, 0, 1], Math.sin(la))));
    flyTo({ id: 'v:ecl', name: 'Eclipse solar', kind: 'view', pos: E, radius: R, viewDist: R * 4.2, arriveDir: dir });
    toast('Eclipse solar: a mancha escura é a sombra da Lua correndo sobre a Terra (5 min por segundo; contraste da penumbra realçado).', 8000);
  } else {
    const M = solar.BODY.Moon;
    flyTo({ id: 'v:ecl', name: 'Eclipse lunar', kind: 'view', pos: () => M.pos, radius: M.radius, viewDist: M.radius * 5, arriveDir: () => v3.norm(v3.sub(solar.BODY.Earth.pos, M.pos)) });
    toast('Eclipse lunar: a Lua entra na sombra da Terra e fica avermelhada, iluminada pela luz que atravessa a atmosfera da Terra.', 8000);
  }
}

// ---------------------------------------------------------------- replays
let R = null; // { r, idx, waiting }
function renderReplays() {
  $('tpRepList').innerHTML = REPLAYS.map(r => `<div class="repRow" data-r="${r.id}"><b>${r.title}</b><small>${r.sub}</small></div>`).join('') +
    `<p class="muted small">Trajetórias reais do JPL Horizons. Durante o replay, o tempo acelera e desacelera sozinho; dá para pausar (espaço) ou pular para o próximo trecho.</p>`;
  for (const el of document.querySelectorAll('#tpRepList .repRow')) el.onclick = () => startReplay(REPLAYS.find(r => r.id === el.dataset.r));
}

function focusTarget(f) {
  const E = () => solar.BODY.Earth.pos;
  if (f.craft) { const c = CRAFT.find(x => x.id === f.craft); if (!c) return null; const t = craftTarget(c); t.viewDist = f.dist * KM; return t; }
  if (f.surface) { const c = CRAFT.find(x => x.id === f.surface); return c ? craftTarget(c) : null; }
  if (f.body) { const t = bodyTarget(f.body); t.viewDist = f.dist * KM; return t; }
  if (f.system) {
    const dir = f.tilt ? v3.norm(v3.add(ECL_POLE, [0.9, 0.2, 0])) : v3.norm(v3.add(ECL_POLE, [0.25, 0.1, 0]));
    return { id: 'v:sys' + f.system, name: 'Sistema Solar', kind: 'view', pos: () => [0, 0, 0], radius: 0, viewDist: f.system * AU, arriveDir: dir };
  }
  if (f.earthMoon) return { id: 'v:em', name: 'Terra e Lua', kind: 'view', pos: E, radius: solar.BODY.Earth.radius, viewDist: (f.far ? 1.3e6 : 9e5) * KM, arriveDir: () => v3.norm(v3.add(ECL_POLE, v3.scale(v3.norm(v3.sub(solar.BODY.Moon.pos, E())), -0.4))) };
  return null;
}

export function startReplay(r) {
  R = { r, idx: -1, waiting: false };
  $('timePanel').hidden = true;
  setFocus(r.craft);
  time.setDate(Date.parse(r.start));
  solar.computePositions();
  const c = CRAFT.find(x => x.id === r.craft[0]);
  if (c) select(craftTarget(c));
  $('replayCap').hidden = false;
  $('rcTitle').textContent = r.title;
  $('rcNote').textContent = r.note || '';
}

export function stopReplay(silent) {
  if (!R) return;
  R = null;
  setFocus([]);
  $('replayCap').hidden = true;
  time.setRate(1); time.now();
  if (!silent) toast('Replay encerrado: de volta ao presente.');
}

// Chamado a cada quadro
export function tick() {
  if (!R) return;
  const t = F.date.getTime(), r = R.r;
  const total = Date.parse(r.end) - Date.parse(r.start);
  $('rcBar').style.width = `${Math.min(100, Math.max(0, (t - Date.parse(r.start)) / total * 100)).toFixed(1)}%`;
  $('rcDate').textContent = time.fmtDate();
  if (t >= Date.parse(r.end)) {
    time.clock.paused = true;
    $('rcText').textContent = 'Fim do replay. Use ✕ para voltar ao presente ou explore este momento livremente.';
    return;
  }
  let i = -1;
  r.steps.forEach((s, k) => { if (Date.parse(s.at) <= t) i = k; });
  if (i !== R.idx && i >= 0) {
    R.idx = i;
    const s = r.steps[i];
    $('rcText').textContent = s.text;
    time.setRate(s.rate);
    if (s.follow) { const c = CRAFT.find(x => x.id === s.follow); if (c) select(craftTarget(c)); }
    const target = s.focus && focusTarget(s.focus);
    if (target) {
      // pausa o tempo durante o voo da câmera, para não perder a passagem
      time.clock.paused = true;
      setMode('orbit');
      flyTo(target);
      R.waiting = true;
    }
  }
  if (R.waiting && !nav.flight) { R.waiting = false; time.clock.paused = false; }
}
export const replayActive = () => !!R;
void go;
