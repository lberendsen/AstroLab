// Painel de lugares (lateral esquerda, permanente): todos os destinos numa árvore que começa recolhida,
// filtrada pela caixa de busca. Um clique voa até lá. O painel pode ser redimensionado e recolhido numa faixa.
import * as search from '../search.js';
import { DB, starPos } from '../data.js';
import { v3, gal2eq, GALACTIC_CENTER, fmtDist, normName } from '../astro.js';
import { BODIES } from '../layers/solar.js';
import { MOONS, PLANET_PT } from '../layers/moons.js';
import { CRAFT } from '../layers/craft.js';
import { SB } from '../layers/smallbodies.js';
import { P5 } from '../layers/phase5.js';
import { SHOWERS } from '../../tools/smallbodies.mjs';
import { bodyTarget, starTarget, exoTarget, curatedTarget, craftTarget, moonTarget, sbTarget, showerTarget } from '../targets.js';
import { pulsarTarget, structTarget } from './phenomena.js';
import { go } from './actions.js';
import { openNeo } from './neo.js';
import { TOURS, startTour } from './tours.js';
import { openPhenomena } from './phenomena.js';
import { openPlanetarium } from './planpanel.js';
import { PL, PRESETS, CONST } from '../planetarium.js';
import { CONST_PT } from '../link.js';
import { radec2xyz } from '../astro.js';
import { $ } from './dom.js';

// ---------------------------------------------------------------- vistas especiais (não são objetos do catálogo)
export function resolvePlace(q) {
  if (q === '@neo') return { name: '☄️ Próximas aproximações', action: openNeo };
  if (q.startsWith('@pl:')) {
    const [body, i] = q.slice(4).split('#'), p = PRESETS[body][+i];
    return { name: `🌅 ${p[0]}`, action: () => openPlanetarium(body, p[1], p[2], p[0]) };
  }
  if (q.startsWith('@tour:')) {
    const t = TOURS.find(x => x.id === q.slice(6));
    return t ? { name: `🎬 ${t.title}`, action: () => startTour(t) } : null;
  }
  if (q.startsWith('@phen:')) {
    const k = q.slice(6);
    return { name: k === 'gw' ? '💥 Ondas gravitacionais' : '💥 Explosões recentes', action: () => openPhenomena(k) };
  }
  if (q === '@plhere') return { name: '🌅 O céu daqui, agora', action: () => openPlanetarium('Earth', PL.lat, PL.lon, PL.name) };
  if (q === '@const3d') {
    const t = constTarget('Ori');
    return t && { name: '✨ Constelações em 3D: Órion de lado', action: () => { t.before(); go(t); } };
  }
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

// Constelação em 3D, vista de lado: as estrelas do desenho estão a distâncias muito diferentes da Terra
function constTarget(abbr) {
  const c = CONST.list.find(x => x.abbr === abbr);
  if (!c?.segs.length) return null;
  const ps = [...new Set(c.segs)].map(i => starPos(i));
  const mid = v3.scale(ps.reduce((a, p) => v3.add(a, p), [0, 0, 0]), 1 / ps.length);
  const ext = Math.max(...ps.map(p => v3.dist(p, mid)));
  const los = v3.norm(mid), side = v3.norm(v3.cross(los, [0, 0, 1]));
  const name = CONST_PT[abbr] || c.name;
  return { id: 'v:c3d:' + abbr, name: `${name} vista de lado`, kind: 'view', kindLabel: 'Constelação em 3D', pos: () => mid, radius: 0, viewDist: ext * 1.7,
    arriveDir: v3.norm(v3.add(side, v3.scale(los, -0.25))),
    before: () => { PL.show.space = true; PL.show.only = abbr; } };
}

// ---------------------------------------------------------------- a árvore
// Nó: { label, hint, make (→ alvo), action, kids, open, parent }
const node = (label, o = {}) => ({ label, ...o });
const cat = (label, kids, o = {}) => node(label, { kids: kids.filter(Boolean), ...o });
const fromQ = (q, hint) => { const t = resolvePlace(q); return t ? node(t.name, { make: () => resolvePlace(q), hint }) : null; };

// dicas curtas ao lado de destinos conhecidos
const HINTS = {
  'Voyager 1': 'o objeto humano mais distante', 'Parker Solar Probe': 'o mais rápido', 'Tesla Roadster de Elon Musk': 'um carro em órbita do Sol',
  'Apófis': 'passa raspando em 2029', 'Dídimo': 'desviado pela DART', 'Bennu': 'amostras trazidas à Terra', 'Psique': 'metálico',
  'Arrokoth': 'o mais distante já visitado', "1I/ʻOumuamua": 'veio de outra estrela', '3I/ATLAS': 'visitante interestelar de 2025',
  'Geminídeas': 'a mais forte', 'Orionídeas': 'poeira do Halley', 'Ceres': 'planeta anão',
};

const BODY_PT = { Sun: 'Sol', Moon: 'Lua', Mercury: 'Mercúrio', Venus: 'Vênus', Earth: 'Terra', Mars: 'Marte', Jupiter: 'Júpiter', Saturn: 'Saturno', Uranus: 'Urano', Neptune: 'Netuno', Pluto: 'Plutão' };
const byName = (a, b) => a.label.localeCompare(b.label, 'pt-BR');
const craftNode = c => node(c.name, { make: () => craftTarget(c), hint: HINTS[c.name] || (c.launch ? `${c.country || ''} ${c.launch}`.trim() : '') });

function solarSystem() {
  const moonsOf = key => {
    const main = BODIES.filter(b => b.kind === 'moon' && b.parent === key).map(b => node(b.name, { make: () => bodyTarget(b.key) }));
    const others = MOONS.filter(m => m.planet === key).sort((a, b) => (b.r || 0) - (a.r || 0)).map(m => node(m.name, { make: () => moonTarget(m), hint: m.r ? `${Math.round(m.r * 2).toLocaleString('pt-BR')} km` : '' }));
    const big = others.filter((_, i) => i < 8), small = others.slice(8);
    return [...main, ...big, small.length ? cat(`Outras ${small.length} luas pequenas`, small) : null];
  };
  const onSurface = key => CRAFT.filter(c => c.kind === 'surface' && c.body === key).map(craftNode).sort(byName);
  const planet = b => {
    // a Lua tem os próprios pousos; a Terra, as estações e os satélites em destaque
    const kids = b.key === 'Earth'
      ? [node('Lua', { make: () => bodyTarget('Moon'), kids: [cat('Robôs e pousos', onSurface('Moon'))] }),
        cat('Estações e satélites', CRAFT.filter(c => c.kind === 'sat').map(craftNode).sort(byName))]
      : [...moonsOf(b.key), onSurface(b.key).length ? cat('Robôs e pousos', onSurface(b.key)) : null];
    return node(b.name, { make: () => bodyTarget(b.key), kids });
  };
  const famous = SB.famous || [];
  const DWARF = /^(Ceres|Éris|Haumea|Makemake|Sedna|Quaoar|Gonggong|Orcus)$/;
  const sbNode = f => node(f.name, { make: () => sbTarget(f), hint: HINTS[f.name] || '' });
  return cat('☀️ Sistema Solar', [
    node('Sol', { make: () => bodyTarget('Sun') }),
    cat('Planetas', BODIES.filter(b => b.kind === 'planet' && !b.dwarf).map(planet)),
    cat('Planetas anões', [...BODIES.filter(b => b.dwarf).map(planet), ...famous.filter(f => DWARF.test(f.name)).map(sbNode)]),
    cat('Asteroides', [fromQ('@neo', 'passando perto da Terra agora'), ...famous.filter(f => !f.isComet && !DWARF.test(f.name)).map(sbNode)]),
    cat('Cometas', famous.filter(f => f.isComet).map(sbNode)),
    cat('Chuvas de meteoros', SHOWERS.map(s => node(s.name, { make: () => showerTarget(s), hint: HINTS[s.name] || `pico em ${s.peak[1]}/${s.peak[0]}` }))),
  ]);
}

function humanMade() {
  const probes = CRAFT.filter(c => c.kind === 'probe');
  const active = probes.filter(c => c.eph || c.approxOrbit || c.approxPlace);
  const ended = probes.filter(c => !(c.eph || c.approxOrbit || c.approxPlace));
  const around = {};
  for (const c of active) if (c.center !== 'Sun') (around[c.center] ||= []).push(c);
  const surface = {};
  for (const c of CRAFT.filter(c => c.kind === 'surface')) (surface[c.body] ||= []).push(c);
  return cat('🛰️ Feito pelo homem', [
    cat('Estações e satélites em volta da Terra', CRAFT.filter(c => c.kind === 'sat').map(craftNode).sort(byName)),
    cat('Naves viajando pelo Sistema Solar', active.filter(c => c.center === 'Sun').map(craftNode).sort(byName)),
    cat('Naves em volta de outros mundos', Object.entries(around).map(([k, l]) => cat(`Em volta de ${BODY_PT[k] || k}`, l.map(craftNode).sort(byName)))),
    cat('Na superfície de outros mundos', Object.entries(surface).map(([k, l]) => cat(`${BODY_PT[k] || k}`, l.map(craftNode).sort(byName)))),
    cat('Missões encerradas (replay)', ended.map(craftNode).sort(byName)),
  ]);
}

// Estrelas com nome próprio (IAU): descarta designações de catálogo e de Bayer/Flamsteed
const CATALOG = /^(HIP|HD|HR|Gl|GJ|LHS|LTT|LP|Wolf|Ross|BD|CD|CPD|TYC|2MASS|Gaia|G \d|NLTT|WD|L \d|LFT|LPM|UGPS|SCR|DENIS|WISE|Struve|Stein|Kruger|Lalande|Groombridge|Lacaille|AC|EGGR|BPM|GD|LDS|LSPM)\b/;
const BAYER = /^[A-Z][a-z]{1,2}(-\d)? [A-Z][a-zA-Z]{2}$/;
function stars() {
  const S = DB.stars, named = [];
  for (const [i, inf] of S.info) {
    if (i === S.sunIndex || i >= S.nHyg) continue;
    const n = inf.names[0];
    if (!n || CATALOG.test(n) || BAYER.test(n) || /^[\d a-z]/.test(n)) continue;
    named.push(node(n, { make: () => starTarget(i), hint: inf.spect ? inf.spect.slice(0, 4) : '' }));
  }
  named.sort(byName);
  const letters = {};
  for (const s of named) (letters[normName(s.label)[0]?.toUpperCase() || '#'] ||= []).push(s);
  return cat('⭐ Estrelas', [
    cat('Destaques', [fromQ('Próxima Centauri', 'a mais próxima'), fromQ('Alfa Centauri'), fromQ('Sírius', 'a mais brilhante'), fromQ('Betelgeuse', 'supergigante vermelha'),
      fromQ('Rigel'), fromQ('Estrela Polar'), fromQ('Vega'), fromQ('Antares'), fromQ('Canopo', 'a segunda mais brilhante'), fromQ('Estrela de Barnard', 'a que mais se move no céu')]),
    cat(`Com nome próprio (${named.length})`, Object.entries(letters).sort().map(([l, list]) => cat(l, list))),
  ]);
}

function exoplanets() {
  const LY = 1 / 3.2616;
  const bands = [[0, 20, 'a menos de 20 anos-luz'], [20, 50, '20 a 50 anos-luz'], [50, 100, '50 a 100 anos-luz'], [100, 500, '100 a 500 anos-luz'], [500, 2000, '500 a 2.000 anos-luz'], [2000, Infinity, 'mais de 2.000 anos-luz']];
  const hosts = DB.hosts.map(h => ({ h, ly: v3.len(h.xyz) / LY })).sort((a, b) => a.ly - b.ly);
  const sys = ({ h }) => node(h.name, { make: () => starTarget(h.star), hint: `${h.planets.length} planeta${h.planets.length > 1 ? 's' : ''} · ${fmtDist(v3.len(h.xyz))}`,
    kids: h.planets.map(p => node(p.n, { make: () => exoTarget(h, p.n), hint: p.r ? `${p.r.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} × Terra` : '' })) });
  return cat('🪐 Mundos alienígenas', [
    cat('Destaques', [fromQ('TRAPPIST-1 e', 'zona habitável'), fromQ('Proxima Cen b'), fromQ('Kepler-452 b', '"primo" da Terra'), fromQ('TOI-700 d'),
      fromQ('51 Peg b', 'primeiro em estrela tipo Sol'), fromQ('HD 189733 b', 'chove vidro'), fromQ('55 Cnc e', 'oceano de lava'), fromQ('WASP-12 b', 'sendo devorado')]),
    cat(`Todos os sistemas (${hosts.length}), por distância`, bands.map(([a, b, l]) => cat(l, hosts.filter(x => x.ly >= a && x.ly < b).map(sys)))),
  ]);
}

function constellations() {
  const list = CONST.list.filter(c => c.segs.length).map(c => node(CONST_PT[c.abbr] || c.name, { make: () => constTarget(c.abbr), hint: c.name !== CONST_PT[c.abbr] ? c.name : '' })).sort(byName);
  return cat('✨ Constelações em 3D', [fromQ('@plhere', 'como elas aparecem no céu'), ...list], { hint: 'as estrelas não estão juntas' });
}

function deepSky() {
  const C = DB.curated;
  const of = (type, f = () => true) => C.filter(o => o.type === type && f(o)).map(o => node(o.name, { make: () => curatedTarget(o), hint: o.id !== o.name ? o.id : '' }));
  return [
    cat('🌫️ Nebulosas e aglomerados', [cat('Nebulosas', of('neb')), cat('Nebulosas planetárias', of('pn')), cat('Restos de supernova', of('snr')),
      cat('Aglomerados abertos', of('open')), cat('Aglomerados globulares', of('glob'))]),
    cat('💥 Fenômenos extremos', [fromQ('@phen:gw', 'colisões que sacodem o espaço'), fromQ('@phen:sn', 'supernovas deste mês'),
      cat('Buracos negros', [...of('bh'), ...C.filter(o => /^(M 87|TON 618)$/.test(o.id)).map(o => node(o.name, { make: () => curatedTarget(o) }))]),
      cat('Pulsares', P5.pulsars.filter(p => p.name).map(p => node(p.name, { make: () => pulsarTarget(p) })))]),
    cat('🌌 Nossa galáxia', [fromQ('@milkyway', 'vista de fora (modelo)'), fromQ('Sgr A*', 'o buraco negro central'),
      cat('Galáxias vizinhas (Grupo Local)', of('gal', o => o.d < 3e6))]),
    cat('🌀 Galáxias', [cat('Galáxias próximas', of('gal', o => o.d >= 3e6 && o.d < 1e8)), cat('Galáxias distantes', of('gal', o => o.d >= 1e8 && o.d < 1e9)),
      cat('Aglomerados de galáxias', of('cluster'))]),
    cat('🕸️ Universo em grande escala', [fromQ('@web', 'a teia cósmica'), ...P5.structures.map(s => node(s.name, { make: () => structTarget(s), hint: s.kind }))]),
    cat('🔭 Até a borda do universo', [...of('qso'), ...of('gal', o => o.d >= 1e9), fromQ('@qso', '750 mil quasares'), fromQ('@cmb', 'radiação cósmica de fundo')]),
  ];
}

function planetarium() {
  const HINT = { 'Earth#10': 'céu mais escuro da Terra', 'Earth#18': 'o céu gira em volta de você', 'Moon#0': 'a Terra parada no céu', 'Mars#0': 'pôr do sol azul' };
  const NAME = { Earth: 'Na Terra', Moon: 'Na Lua', Mars: 'Em Marte' };
  return cat('🌅 Planetário: o céu de outros lugares', [fromQ('@plhere'),
    ...Object.entries(PRESETS).map(([b, list]) => cat(NAME[b], list.map((p, i) => node(p[0], { action: () => openPlanetarium(b, p[1], p[2], p[0]), hint: HINT[`${b}#${i}`] || '' }))))]);
}

let ROOT = [], ALL = [];
function buildTree() {
  ROOT = [
    cat('🎬 Tours guiados', TOURS.map(t => node(t.title, { action: () => startTour(t), hint: t.subtitle || '' }))),
    planetarium(), solarSystem(), humanMade(), stars(), exoplanets(), constellations(), ...deepSky(),
  ].filter(n => n.kids?.length);
  ALL = [];
  const walk = (list, parent) => {
    for (const n of list) {
      n.parent = parent; n.key = normName(n.label); n.idx = ALL.length;
      ALL.push(n);
      if (n.kids) { n.kids = n.kids.filter(Boolean); if (!n.kids.length) delete n.kids; else walk(n.kids, n); }
    }
  };
  walk(ROOT, null);
  // contagem de destinos dentro de cada categoria
  const count = n => (n.kids ? n.kids.reduce((s, k) => s + count(k), 0) + (n.make || n.action ? 1 : 0) : 1);
  for (const n of ALL) if (n.kids && !n.make && !n.action) n.count = count(n);
}

// ---------------------------------------------------------------- desenho
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let treeEl, filterQ = '', shownKids = null;

function activate(n) {
  if (n.action) return n.action();
  const t = n.make?.();
  if (!t) return;
  if (t.action) return t.action();
  t.before?.();
  go(t);
}

function rowHTML(n, depth, mark) {
  const hasKids = !!n.kids, open = isOpen(n);
  const target = !!(n.make || n.action);
  const label = mark ? highlight(n.label, mark) : esc(n.label);
  return `<div class="tn${target ? ' go' : ''}${hasKids ? ' br' : ''}${open ? ' open' : ''}" style="--d:${depth}" data-i="${n.idx}">` +
    `<span class="tw">${hasKids ? '▸' : ''}</span><span class="tl">${label}</span>` +
    (n.count ? `<small class="tc">${n.count.toLocaleString('pt-BR')}</small>` : n.hint ? `<small>${esc(n.hint)}</small>` : '') + `</div>`;
}
// destaca o trecho digitado, sem diferenciar acentos e maiúsculas (tirar os acentos preserva o comprimento)
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let rawQ = '';
function highlight(label, _q) {
  const f = fold(label), i = rawQ ? f.indexOf(rawQ) : -1;
  if (i < 0 || f.length !== label.length) return esc(label);
  return esc(label.slice(0, i)) + '<mark>' + esc(label.slice(i, i + rawQ.length)) + '</mark>' + esc(label.slice(i + rawQ.length));
}

// aberto: no modo normal, o que o usuário abriu; no filtro, os ancestrais dos encontrados (a menos que fechados)
const isOpen = n => (shownKids ? !n.fclosed && !!n.kids?.some(k => shownKids.has(k)) : !!n.open);

// desenha os filhos visíveis de uma lista (recursivo nos abertos)
function renderList(list, depth) {
  let h = '';
  for (const n of list) {
    if (shownKids && !shownKids.has(n)) continue;
    h += rowHTML(n, depth, filterQ);
    if (n.kids && isOpen(n)) h += renderList(n.kids, depth + 1);
  }
  return h;
}
function render() { treeEl.innerHTML = renderList(ROOT, 0) || `<p class="muted small empty">Nenhum lugar com esse nome. Veja abaixo no catálogo inteiro.</p>`; }

// Filtro: mostra os nós que casam e os ancestrais deles (abertos); um nó que casa mostra os filhos recolhidos
const MAX_MATCH = 400;
export function filterTree(q) {
  filterQ = normName(q || '');
  rawQ = fold((q || '').trim());
  for (const n of ALL) delete n.fclosed;
  if (!filterQ) { shownKids = null; render(); return []; }
  const show = new Set(), hits = [];
  for (const n of ALL) {
    if (!n.key.includes(filterQ)) continue;
    hits.push(n);
    if (hits.length > MAX_MATCH) break;
    for (let p = n; p; p = p.parent) show.add(p);
  }
  shownKids = show;
  render();
  return hits;
}

function toggle(n) {
  if (shownKids) {
    // no modo filtro: abrir um nó encontrado mostra todos os filhos dele
    if (!n.kids) return;
    if (isOpen(n)) n.fclosed = true;
    else { n.fclosed = false; for (const k of n.kids) shownKids.add(k); }
  } else n.open = !n.open;
  render();
}

// ---------------------------------------------------------------- painel: largura e recolhimento
const SIDE = { w: 300, collapsed: false };
const RAIL = 44;
function applySide() {
  const w = SIDE.collapsed ? RAIL : SIDE.w;
  document.documentElement.style.setProperty('--side-w', `${w}px`);
  document.body.classList.toggle('side-collapsed', SIDE.collapsed);
  try { localStorage.setItem('astrolab.side', JSON.stringify(SIDE)); } catch { /* sem armazenamento */ }
}
export function toggleSide(force) {
  SIDE.collapsed = force != null ? !force : !SIDE.collapsed;
  applySide();
}
export const sideOpen = () => !SIDE.collapsed;

function wireSide() {
  try { Object.assign(SIDE, JSON.parse(localStorage.getItem('astrolab.side')) || {}); } catch { /* sem armazenamento */ }
  SIDE.w = Math.min(Math.max(SIDE.w, 220), 700);
  applySide();
  $('sideToggle').onclick = () => toggleSide();
  $('sideRail').onclick = e => { toggleSide(true); if (e.target.closest('[data-rail=search]')) setTimeout(() => $('search').focus(), 50); };
  // arrastar a borda direita muda a largura; duplo clique recolhe
  const grip = $('sideGrip');
  grip.addEventListener('pointerdown', e => {
    if (SIDE.collapsed) return;
    e.preventDefault(); grip.setPointerCapture(e.pointerId); document.body.classList.add('resizing');
    const move = ev => { SIDE.w = Math.min(Math.max(ev.clientX, 220), Math.min(700, innerWidth * 0.6)); applySide(); };
    const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); document.body.classList.remove('resizing'); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
  });
  grip.addEventListener('dblclick', () => toggleSide());
}

export function buildPlaces() {
  treeEl = $('tree');
  buildTree();
  render();
  treeEl.addEventListener('click', e => {
    const row = e.target.closest('.tn');
    if (!row) return;
    const n = ALL[+row.dataset.i];
    // seta: abre/fecha; nome: viaja (ou abre, se for só uma categoria)
    if (e.target.closest('.tw') || !(n.make || n.action)) toggle(n);
    else activate(n);
  });
  wireSide();
}

// Usado pelo teste de fumaça e pelos atalhos: ativa o primeiro destino cujo nome contém o texto
export function goPlace(text) {
  const k = normName(text);
  const ok = x => x.make || x.action;
  const n = ALL.find(x => ok(x) && x.key === k) || ALL.find(x => ok(x) && x.key.includes(k));
  if (n) activate(n);
  return !!n;
}
export const placeCount = () => ALL.filter(n => n.make || n.action).length;
