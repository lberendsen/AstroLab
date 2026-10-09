// Painel do Planetário: lugar, camadas do céu, "no céu agora", passagens de estações espaciais e conjunções.
import { F } from '../engine.js';
import * as PLN from '../planetarium.js';
import { PL, PRESETS } from '../planetarium.js';
import * as solar from '../layers/solar.js';
import { bodyTarget, starTarget, curatedTarget, satTarget } from '../targets.js';
import * as time from '../time.js';
import { v3, fmtNum } from '../astro.js';
import { select } from './actions.js';
import { stopReplay } from './timepanel.js';
import { $, toast } from './dom.js';

const BODY_PT = { Earth: 'Terra', Moon: 'Lua', Mars: 'Marte' };
const fmtT = d => d ? d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtH = d => d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

export function openPlanetarium(body, lat, lon, name) {
  $('planPanel').hidden = false;
  if (body) PLN.enter(body, lat, lon, name);
  else if (!PL.active && !PL.pending) PLN.enter();
  renderPanel();
}

function fillLocations() {
  const sel = $('plLoc');
  sel.innerHTML = '';
  for (const [n, la, lo] of PRESETS[PL.body] || []) sel.add(new Option(n, `${la},${lo},${n}`));
  if (!(PRESETS[PL.body] || []).some(p => p[0] === PL.name)) sel.add(new Option(PL.name, `${PL.lat},${PL.lon},${PL.name}`), 0);
  sel.value = `${PL.lat},${PL.lon},${PL.name}`;
  $('plBody').value = PL.body;
  $('plLat').value = fmtNum(PL.lat, 2).replace(',', '.').replace(/\.(?=.*\.)/g, '');
  $('plLon').value = String(+PL.lon.toFixed(2));
  $('plLat').value = String(+PL.lat.toFixed(2));
}

let tab = 'up';
export function renderPanel() {
  if ($('planPanel').hidden) return;
  fillLocations();
  for (const b of document.querySelectorAll('#planPanel [data-pltab]')) b.classList.toggle('on', b.dataset.pltab === tab);
  const head = $('plStatus');
  if (PL.pending) { head.textContent = `Descendo em ${PL.name}…`; $('plList').innerHTML = ''; return; }
  if (!PL.active) { head.textContent = ''; return; }
  const sun = PLN.altAzOf(solar.BODY.Sun.pos);
  let st = `<b>${PL.name}</b> · ${BODY_PT[PL.body]} · ${time.fmtDate()}<br>`;
  st += sun.alt > 0 ? `☀️ Dia: Sol a ${fmtNum(sun.alt, 0)}° de altura` : sun.alt > -6 ? '🌇 Crepúsculo' : sun.alt > -18 ? '🌆 Anoitecendo / amanhecendo' : '🌙 Noite fechada';
  const rs = PLN.riseSet('Sun');
  if (rs) st += ` · nasce ${fmtH(rs.rise)}, põe ${fmtH(rs.set)}`;
  if (PL.body !== 'Earth') st += `<br><span class="muted small">Sem a luz difusa de uma atmosfera densa${PL.body === 'Mars' ? ' (o céu de Marte é cor de caramelo de dia e azul no pôr do sol)' : ': o céu é preto mesmo de dia'}.</span>`;
  head.innerHTML = st;
  if (tab === 'up') renderUp();
  if (tab === 'iss') renderPasses();
  if (tab === 'conj') renderConj();
}

function renderUp() {
  const list = PLN.whatsUp().filter(o => o.alt > 0);
  const mag = o => (o.mag != null ? ` · magnitude ${(Math.round(o.mag * 10) / 10 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}` : '');
  $('plList').innerHTML = `<p class="muted small">Acima do horizonte agora, de ${PL.name}. Clique para olhar.</p>` + list.map((o, i) =>
    `<div class="plRow" data-i="${i}"><b>${o.name}</b><small>${fmtNum(o.alt, 0)}° de altura, para o ${PLN.azName(o.az)}${mag(o)}</small></div>`).join('') || '<p class="muted">Nada notável acima do horizonte.</p>';
  for (const el of document.querySelectorAll('#plList .plRow')) el.onclick = () => {
    const o = list[+el.dataset.i];
    PLN.lookAt(o.pos);
    const t = o.kind === 'body' ? bodyTarget(o.key) : o.kind === 'star' ? starTarget(o.idx) : o.kind === 'deep' ? curatedTarget(o.cur) : satTarget(o.sat);
    select(t);
  };
}

function renderPasses() {
  if (PL.body !== 'Earth') { $('plList').innerHTML = '<p class="muted small">As passagens são calculadas para quem está na Terra.</p>'; return; }
  $('plList').innerHTML = '<p class="muted small">calculando…</p>';
  setTimeout(() => {
    const ps = PLN.stationPasses(72);
    $('plList').innerHTML = `<p class="muted small">Passagens visíveis nas próximas 72 h, de ${PL.name}: a estação está iluminada pelo Sol e o céu daí está escuro. Aparece como um ponto brilhante que cruza o céu em poucos minutos, sem piscar.</p>` +
      (ps.map((p, i) => `<div class="plRow" data-i="${i}"><b>${p.sat.craft?.name || p.sat.name}</b><small>${fmtT(new Date(p.start))} · surge no ${PLN.azName(p.startAz)}, sobe até ${fmtNum(p.maxAlt, 0)}°, some no ${PLN.azName(p.endAz)} · ${fmtNum((p.end - p.start) / 60e3, 0)} min</small></div>`).join('') ||
        '<p class="muted">Nenhuma passagem visível nas próximas 72 horas daí.</p>');
    for (const el of document.querySelectorAll('#plList .plRow')) el.onclick = () => {
      const p = ps[+el.dataset.i];
      stopReplay(true);
      time.setDate(p.start - 30e3); time.setRate(1);
      solar.computePositions();
      select(satTarget(p.sat));
      toast('A estação aparece em instantes. Olhe para o ' + PLN.azName(p.startAz) + '.', 6000);
      PL.az = p.startAz; PL.alt = 20; PL.fov = 90;
      renderPanel();
    };
  }, 30);
}

function renderConj() {
  if (PL.body !== 'Earth') { $('plList').innerHTML = '<p class="muted small">As conjunções são calculadas como vistas da Terra.</p>'; return; }
  const cs = PLN.conjunctions(365);
  const N = { Moon: 'a Lua', Mercury: 'Mercúrio', Venus: 'Vênus', Mars: 'Marte', Jupiter: 'Júpiter', Saturn: 'Saturno' };
  $('plList').innerHTML = `<p class="muted small">Encontros aparentes no céu nos próximos 12 meses: dois astros a menos de 2° um do outro (3° com a Lua). Um dedo esticado à distância do braço cobre cerca de 1°.</p>` +
    (cs.map((c, i) => `<div class="plRow" data-i="${i}"><b>${N[c.a][0].toUpperCase() + N[c.a].slice(1)} e ${N[c.b]}</b><small>${new Date(c.t).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })} · ${fmtNum(c.sep, 1)}° de distância · ${fmtNum(c.elong, 0)}° do Sol</small></div>`).join('') || '<p class="muted">Nenhuma conjunção próxima neste período.</p>');
  for (const el of document.querySelectorAll('#plList .plRow')) el.onclick = () => {
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
    renderPanel();
  };
}

// tecla P: entra no planetário (no lugar salvo) ou sai dele
export const togglePlanetarium = () => (PL.active || PL.pending ? leave() : openPlanetarium());

export function wirePlanetarium() {
  PLN.setOnChange(renderPanel);
  $('plExit').onclick = leave;
  $('plClose').onclick = () => { $('planPanel').hidden = true; };
  $('plBody').onchange = () => { const b = $('plBody').value, [n, la, lo] = PRESETS[b][0]; PLN.enter(b, la, lo, n); renderPanel(); };
  $('plLoc').onchange = () => { const [la, lo, ...n] = $('plLoc').value.split(','); PLN.enter(PL.body, +la, +lo, n.join(',')); renderPanel(); };
  $('plGo').onclick = () => {
    const la = parseFloat($('plLat').value.replace(',', '.')), lo = parseFloat($('plLon').value.replace(',', '.'));
    if (!(Math.abs(la) <= 90 && Math.abs(lo) <= 180)) { toast('Latitude entre −90 e 90, longitude entre −180 e 180.'); return; }
    PLN.enter(PL.body, Math.max(-89.99, Math.min(89.99, la)), lo, `${fmtNum(la, 2)}°, ${fmtNum(lo, 2)}°`); renderPanel();
  };
  $('plMe').onclick = () => {
    if (!navigator.geolocation) { toast('O navegador não oferece localização.'); return; }
    navigator.geolocation.getCurrentPosition(p => { PLN.enter('Earth', p.coords.latitude, p.coords.longitude, 'sua localização'); renderPanel(); },
      () => toast('Não foi possível obter a localização (permissão negada?).'), { timeout: 10000 });
  };
  for (const cb of document.querySelectorAll('#planPanel [data-plshow]')) {
    cb.checked = PL.show[cb.dataset.plshow];
    cb.onchange = () => { PL.show[cb.dataset.plshow] = cb.checked; };
  }
  for (const b of document.querySelectorAll('#planPanel [data-pltab]')) b.onclick = () => { tab = b.dataset.pltab; renderPanel(); };
  // a lista "no céu agora" muda devagar: refaz a cada 5 s, ou logo se a data saltou
  let lastT = 0;
  setInterval(() => {
    if (!PL.active || $('planPanel').hidden) return;
    const jumped = Math.abs(F.date.getTime() - lastT) > 30 * 60e3;
    if (tab === 'up' || jumped) renderPanel();
    lastT = F.date.getTime();
  }, 2500);
}

function leave() { PLN.exit(); $('planPanel').hidden = true; }
void F; void v3;
