// Menus da barra de baixo: camadas (incluindo os objetos feitos pelo homem) e céu de fundo.
import { F } from '../engine.js';
import * as sky from '../layers/sky.js';
import * as stars from '../layers/stars.js';
import * as galaxies from '../layers/galaxies.js';
import * as sats from '../layers/sats.js';
import * as craft from '../layers/craft.js';
import * as smallbodies from '../layers/smallbodies.js';
import { PL } from '../planetarium.js';
import { BANDS } from '../surveys.js';
import { fmtNum } from '../astro.js';
import { $, toast } from './dom.js';

const LAYERS = [
  ['stars', 'Estrelas (HYG, 109 mil)'], ['galaxies', 'Galáxias (2MRS, 43 mil)'], ['milkyway', 'Via Láctea (modelo)'], ['solar', 'Sistema Solar'],
  ['quasars', 'Quasares (SDSS, 750 mil)'], ['cmb', 'Borda do universo observável (Planck)'], ['orbits', 'Órbitas'], ['exoplanets', 'Exoplanetas'], ['photos', 'Fotos reais (céu profundo)'], ['labels', 'Nomes'], ['sky', 'Céu de fundo'],
];

export function buildLayersMenu() {
  const m = $('layers');
  document.body.appendChild(m); // fora da barra: o transform e o overflow dela recortariam o menu
  m.innerHTML = LAYERS.map(([k, l]) => `<label><input type="checkbox" data-layer="${k}" checked> ${l}</label>`).join('') +
    `<h3>Brilho das estrelas</h3><input type="range" id="starGain" min="4" max="12" step="0.1" value="${stars.starUniforms.uLimit.value}">` +
    `<h3>Brilho das galáxias</h3><input type="range" id="galGain" min="9" max="18" step="0.1" value="${galaxies.galSettings.limit}">`;
  for (const cb of m.querySelectorAll('[data-layer]')) cb.onchange = () => { F.layers[cb.dataset.layer] = cb.checked; };
  m.insertAdjacentHTML('beforeend', `<label><input type="checkbox" id="constSpace"> Constelações no espaço (linhas 3D)</label>`);
  $('constSpace').onchange = e => { PL.show.space = e.target.checked; PL.show.only = null; };
  setInterval(() => { if ($('constSpace')) $('constSpace').checked = PL.show.space; }, 1000);
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
  // asteroides e cometas, por grupo
  if (smallbodies.SB.meta) {
    h += `<h3>Asteroides e cometas</h3><div id="sbStatus" class="muted small"></div>` +
      smallbodies.GROUPS.map(g => `<label><input type="checkbox" data-sbgroup="${g.key}" ${smallbodies.showSB.groups[g.key] ? 'checked' : ''}> <span class="dot" style="--c:${g.color}"></span> ${g.name}</label>`).join('') +
      `<label><input type="checkbox" data-sb="comets" checked> Cometas (${fmtNum(smallbodies.SB.comets.length, 0)})</label>` +
      `<label><input type="checkbox" data-sb="tails" checked> Caudas dos cometas</label>` +
      `<label><input type="checkbox" data-sb="asteroids" checked> Todos os asteroides</label>`;
  }
  m.insertAdjacentHTML('beforeend', h);
  for (const cb of m.querySelectorAll('[data-sbgroup]')) cb.onchange = () => { smallbodies.showSB.groups[cb.dataset.sbgroup] = cb.checked; smallbodies.setFilter(); };
  for (const cb of m.querySelectorAll('[data-sb]')) cb.onchange = () => { smallbodies.showSB[cb.dataset.sb] = cb.checked; };
  updateSbStatus();
  for (const cb of m.querySelectorAll('[data-craft]')) cb.onchange = () => { craft.showCraft[cb.dataset.craft] = cb.checked; };
  for (const cb of m.querySelectorAll('[data-satcat]')) cb.onchange = () => { sats.show.cats[+cb.dataset.satcat] = cb.checked; syncSatMenu(); };
  for (const b of m.querySelectorAll('[data-country]')) b.onclick = () => { const i = +b.dataset.country; sats.show.countries[i] = !sats.show.countries[i]; syncSatMenu(); };
  $('satAll') && ($('satAll').onclick = () => { sats.show.cats.fill(true); sats.show.countries.fill(true); syncSatMenu(); });
  $('satNone') && ($('satNone').onclick = () => { sats.show.cats.fill(false); sats.show.cats[0] = true; sats.show.countries.fill(true); syncSatMenu(); });
}

export function updateSbStatus() {
  const el = $('sbStatus'), SB = smallbodies.SB;
  if (!el || !SB.meta) return;
  const n = smallbodies.loadedCount();
  el.textContent = n < SB.meta.total
    ? `${fmtNum(n, 0)} de ${fmtNum(SB.meta.total, 0)} asteroides carregados${SB.loadingMore ? ' (carregando o resto…)' : ' (o resto carrega quando você estiver no Sistema Solar)'}`
    : `${fmtNum(n, 0)} asteroides com órbita conhecida (JPL)`;
}

export function syncSatMenu() {
  for (const cb of document.querySelectorAll('[data-satcat]')) cb.checked = sats.show.cats[+cb.dataset.satcat];
  for (const b of document.querySelectorAll('[data-country]')) b.classList.toggle('on', sats.show.countries[+b.dataset.country]);
  sats.setFilter();
}

// Tecla M: liga ou desliga tudo menos as estações
export function toggleMassaroca() {
  const on = !sats.show.cats.slice(1).some(Boolean);
  for (let i = 1; i < sats.show.cats.length; i++) sats.show.cats[i] = on;
  syncSatMenu();
  toast(on ? `Mostrando todos os ${fmtNum(sats.SAT.n, 0)} satélites e detritos (M para esconder)` : 'Massaroca escondida: só as estações (M para mostrar)');
}

export function buildSkyMenu() {
  const s = $('skySel');
  s.add(new Option('Visível (Mellinger)', 'local:mellinger'));
  for (const b of BANDS) for (const it of b.items) if (it.full && it.id !== 'CDS/P/Mellinger/color') s.add(new Option(`${b.name}: ${it.label}`, it.id));
  s.onchange = () => {
    toast('Baixando o mapa do céu inteiro (pode levar uns 20 segundos)…', 30000);
    sky.setSky(s.value, ok => toast(ok ? `Céu: ${s.selectedOptions[0].text}` : 'Não foi possível baixar este mapa agora.'));
  };
}
