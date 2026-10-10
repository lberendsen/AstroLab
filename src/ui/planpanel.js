// Planetário sem painel próprio: o lugar onde se está em pé vira o selecionado, com ficha (situação do céu,
// "no céu agora", passagens de estações espaciais, conjunções, outro lugar, sair), e a árvore de lugares mostra o nó dele.
// O que aparece no céu (constelações, nomes, grade…) fica na seção Camadas do painel da direita.
import { F } from '../engine.js';
import * as PLN from '../planetarium.js';
import { PL, PRESETS } from '../planetarium.js';
import * as solar from '../layers/solar.js';
import { bodyTarget, starTarget, curatedTarget, satTarget } from '../targets.js';
import * as time from '../time.js';
import { fmtNum } from '../astro.js';
import { ui, select } from './actions.js';
import { stopReplay } from './timepanel.js';
import { revealPlanetarium, clearCurrent } from './places.js';
import { $, toast } from './dom.js';

const BODY_PT = { Earth: 'Terra', Moon: 'Lua', Mars: 'Marte' };
const fmtT = d => d ? d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtH = d => d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

// ---------------------------------------------------------------- o lugar como selecionado
export function placeTarget() {
  const sp = () => solar.surfacePoint(PL.body, PL.lat, PL.lon);
  return { id: `skyplace:${PL.body}:${PL.lat.toFixed(3)}:${PL.lon.toFixed(3)}`, name: PL.name, kind: 'skyplace', noGo: true,
    kindLabel: `Planetário · em pé ${PL.body === 'Earth' ? 'na Terra' : PL.body === 'Moon' ? 'na Lua' : 'em Marte'}`, pos: () => sp().pos, radius: 0 };
}
const isHere = t => t?.kind === 'skyplace';

export function openPlanetarium(body, lat, lon, name) {
  if (body) PLN.enter(body, lat, lon, name);
  else if (!PL.active && !PL.pending) PLN.enter();
  select(placeTarget());
  revealPlanetarium(PL.body, PL.name);
}

// ---------------------------------------------------------------- seção da ficha
const open = { up: true, iss: false, conj: false };   // blocos abertos (valem enquanto o app está aberto)
export function sectionHTML() {
  const block = (k, title) => `<details data-plblock="${k}"${open[k] ? ' open' : ''}><summary>${title}</summary><div class="plList" id="pl-${k}"></div></details>`;
  return `<div id="plStatus" class="small"></div>` +
    block('up', '✨ No céu agora') + block('iss', '🛰️ Estações espaciais passando') + block('conj', '🪐 Conjunções do ano') +
    `<h3>Outro lugar</h3><div class="row"><input id="plLat" placeholder="latitude" size="7"><input id="plLon" placeholder="longitude" size="7"><button id="plGo">Ir</button><button id="plMe" title="Usar a localização do navegador">📍 Minha localização</button></div>` +
    `<p class="muted small">Os lugares prontos estão no ramo Planetário dos Lugares. Arraste para olhar em volta; a roda do mouse faz zoom (como um binóculo). Acelere o tempo para ver o céu girar. O que aparece no céu (constelações, nomes, grade, chão) fica em Camadas, no painel da direita.</p>` +
    `<div class="actions"><button id="plExit">Sair do planetário</button></div>`;
}
export function wireSection() {
  $('plLat').value = String(+PL.lat.toFixed(2)); $('plLon').value = String(+PL.lon.toFixed(2));
  $('plExit').onclick = leave;
  $('plGo').onclick = () => {
    const la = parseFloat($('plLat').value.replace(',', '.')), lo = parseFloat($('plLon').value.replace(',', '.'));
    if (!(Math.abs(la) <= 90 && Math.abs(lo) <= 180)) { toast('Latitude entre −90 e 90, longitude entre −180 e 180.'); return; }
    openPlanetarium(PL.body, Math.max(-89.99, Math.min(89.99, la)), lo, `${fmtNum(la, 2)}°, ${fmtNum(lo, 2)}°`);
  };
  $('plMe').onclick = () => {
    if (!navigator.geolocation) { toast('O navegador não oferece localização.'); return; }
    navigator.geolocation.getCurrentPosition(p => openPlanetarium('Earth', p.coords.latitude, p.coords.longitude, 'sua localização'),
      () => toast('Não foi possível obter a localização (permissão negada?).'), { timeout: 10000 });
  };
  for (const d of document.querySelectorAll('#info [data-plblock]')) d.ontoggle = () => { open[d.dataset.plblock] = d.open; if (d.open) renderBlock(d.dataset.plblock); };
  refresh();
}
// situação e listas abertas (sem refazer a ficha inteira)
export function refresh() {
  const head = $('plStatus');
  if (!head) return;
  if (PL.pending) { head.textContent = `Descendo em ${PL.name}…`; return; }
  if (!PL.active) { head.textContent = ''; return; }
  const sun = PLN.altAzOf(solar.BODY.Sun.pos);
  let st = `${BODY_PT[PL.body]} · ${time.fmtDate()}<br>`;
  st += sun.alt > 0 ? `☀️ Dia: Sol a ${fmtNum(sun.alt, 0)}° de altura` : sun.alt > -6 ? '🌇 Crepúsculo' : sun.alt > -18 ? '🌆 Anoitecendo / amanhecendo' : '🌙 Noite fechada';
  const rs = PLN.riseSet('Sun');
  if (rs) st += ` · nasce ${fmtH(rs.rise)}, põe ${fmtH(rs.set)}`;
  if (PL.body !== 'Earth') st += `<br><span class="muted small">Sem a luz difusa de uma atmosfera densa${PL.body === 'Mars' ? ' (o céu de Marte é cor de caramelo de dia e azul no pôr do sol)' : ': o céu é preto mesmo de dia'}.</span>`;
  head.innerHTML = st;
  for (const k of Object.keys(open)) if (open[k]) renderBlock(k);
}
function renderBlock(k) {
  if (!PL.active || !$('pl-' + k)) return;
  ({ up: renderUp, iss: renderPasses, conj: renderConj })[k]();
}

function renderUp() {
  const box = $('pl-up');
  const list = PLN.whatsUp().filter(o => o.alt > 0);
  const mag = o => (o.mag != null ? ` · magnitude ${(Math.round(o.mag * 10) / 10 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}` : '');
  box.innerHTML = `<p class="muted small">Acima do horizonte agora. Clique para olhar.</p>` + (list.map((o, i) =>
    `<div class="plRow" data-i="${i}"><b>${o.name}</b><small>${fmtNum(o.alt, 0)}° de altura, para o ${PLN.azName(o.az)}${mag(o)}</small></div>`).join('') || '<p class="muted">Nada notável acima do horizonte.</p>');
  for (const el of box.querySelectorAll('.plRow')) el.onclick = () => {
    const o = list[+el.dataset.i];
    PLN.lookAt(o.pos);
    select(o.kind === 'body' ? bodyTarget(o.key) : o.kind === 'star' ? starTarget(o.idx) : o.kind === 'deep' ? curatedTarget(o.cur) : satTarget(o.sat));
  };
}

function renderPasses() {
  const box = $('pl-iss');
  if (PL.body !== 'Earth') { box.innerHTML = '<p class="muted small">As passagens são calculadas para quem está na Terra.</p>'; return; }
  if (box.dataset.for === PL.name + PL.body && box.children.length > 1) return;   // pesado: só refaz se mudou o lugar
  box.innerHTML = '<p class="muted small">calculando…</p>';
  setTimeout(() => {
    const ps = PLN.stationPasses(72);
    box.dataset.for = PL.name + PL.body;
    box.innerHTML = `<p class="muted small">Passagens visíveis nas próximas 72 h: a estação está iluminada pelo Sol e o céu daí está escuro. Aparece como um ponto brilhante que cruza o céu em poucos minutos, sem piscar.</p>` +
      (ps.map((p, i) => `<div class="plRow" data-i="${i}"><b>${p.sat.craft?.name || p.sat.name}</b><small>${fmtT(new Date(p.start))} · surge no ${PLN.azName(p.startAz)}, sobe até ${fmtNum(p.maxAlt, 0)}°, some no ${PLN.azName(p.endAz)} · ${fmtNum((p.end - p.start) / 60e3, 0)} min</small></div>`).join('') ||
        '<p class="muted">Nenhuma passagem visível nas próximas 72 horas daí.</p>');
    for (const el of box.querySelectorAll('.plRow')) el.onclick = () => {
      const p = ps[+el.dataset.i];
      stopReplay(true);
      time.setDate(p.start - 30e3); time.setRate(1);
      solar.computePositions();
      toast('A estação aparece em instantes. Olhe para o ' + PLN.azName(p.startAz) + '.', 6000);
      PL.az = p.startAz; PL.alt = 20; PL.fov = 90;
      select(satTarget(p.sat));
    };
  }, 30);
}

function renderConj() {
  const box = $('pl-conj');
  if (PL.body !== 'Earth') { box.innerHTML = '<p class="muted small">As conjunções são calculadas como vistas da Terra.</p>'; return; }
  if (box.children.length > 1) return;   // o ano não muda enquanto se olha
  const cs = PLN.conjunctions(365);
  const N = { Moon: 'a Lua', Mercury: 'Mercúrio', Venus: 'Vênus', Mars: 'Marte', Jupiter: 'Júpiter', Saturn: 'Saturno' };
  box.innerHTML = `<p class="muted small">Encontros aparentes no céu nos próximos 12 meses: dois astros a menos de 2° um do outro (3° com a Lua). Um dedo esticado à distância do braço cobre cerca de 1°.</p>` +
    (cs.map((c, i) => `<div class="plRow" data-i="${i}"><b>${N[c.a][0].toUpperCase() + N[c.a].slice(1)} e ${N[c.b]}</b><small>${new Date(c.t).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })} · ${fmtNum(c.sep, 1)}° de distância · ${fmtNum(c.elong, 0)}° do Sol</small></div>`).join('') || '<p class="muted">Nenhuma conjunção próxima neste período.</p>');
  for (const el of box.querySelectorAll('.plRow')) el.onclick = () => {
    const c = cs[+el.dataset.i];
    stopReplay(true);
    // a hora em que o par está mais alto no céu escuro daí, perto da data do encontro
    let best = c.t, bestAlt = -99;
    for (let h = -12; h <= 12; h += 0.5) {
      time.setDate(c.t + h * 3600e3); solar.computePositions();
      const s = PLN.altAzOf(solar.BODY.Sun.pos), p = PLN.altAzOf(solar.BODY[c.b].pos);
      if (s && p && s.alt < -8 && p.alt > bestAlt) { bestAlt = p.alt; best = c.t + h * 3600e3; }
    }
    time.setDate(best); time.setRate(1); time.clock.paused = true;
    solar.computePositions();
    PLN.lookAt(solar.BODY[c.b].pos); PL.fov = 25;
    toast(bestAlt > 0 ? `Tempo pausado no melhor horário para ver daí: ${time.fmtDate()}.` : 'Daí, este encontro acontece abaixo do horizonte ou de dia.', 6000);
    refresh();
  };
}

// tecla P: entra no planetário (no lugar salvo) ou sai dele
export const togglePlanetarium = () => (PL.active || PL.pending ? leave() : openPlanetarium());

export function wirePlanetarium() {
  // ao pousar (por qualquer caminho, inclusive tours), o lugar vira o selecionado; ao sair, a ficha dele fecha
  PLN.setOnChange(() => {
    if (PL.active && !isHere(ui.selected)) { select(placeTarget()); revealPlanetarium(PL.body, PL.name); }
    else if (!PL.active && !PL.pending) { clearCurrent(); if (isHere(ui.selected)) select(null); }
    else refresh();
  });
  // a lista "no céu agora" muda devagar: refaz a cada 2,5 s
  setInterval(() => { if (PL.active && isHere(ui.selected)) refresh(); }, 2500);
}

function leave() { PLN.exit(); }
void F;
