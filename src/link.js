// "Onde fica, visto da Terra": linha da Terra até o objeto selecionado, duas câmeras (lado a lado e olhar da Terra)
// e a seção "Visto da Terra" da ficha, que traduz a posição em coisas do céu de quem está na Terra: constelação,
// direção na Via Láctea e se dá para ver agora, de onde você está.
import * as THREE from 'three';
import * as A from 'astronomy-engine';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { F, local } from './engine.js';
import { BODY, ephDate } from './layers/solar.js';
import { flyTo } from './nav.js';
import { v3, AU, KM, EQ2GAL, xyz2radec, fmtDist, fmtNum } from './astro.js';

export const link = { target: null, mode: null };
const $ = id => document.getElementById(id);
const R_E = () => BODY.Earth.radius;

// ---------------------------------------------------------------- linha
let line, mat;
function ensureLine() {
  if (line) return;
  const g = new LineGeometry();
  g.setPositions([0, 0, 0, 1, 0, 0]);
  g.setColors([0.35, 0.65, 1, 1, 0.7, 0.3]);
  mat = new LineMaterial({ linewidth: 3, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, worldUnits: false });
  line = new Line2(g, mat);
  line.frustumCulled = false;
  line.renderOrder = 7;
  local.add(line);
}

const earth = () => BODY.Earth.pos;
export const separation = () => (link.target ? v3.dist(link.target.pos(), earth()) : 0);

export function update() {
  if (!link.target) { if (line) line.visible = false; return; }
  ensureLine();
  const P = link.target.pos();
  // a linha sai da superfície da Terra, do ponto que está de frente para o objeto
  const E = v3.add(earth(), v3.scale(v3.norm(v3.sub(P, earth())), R_E() * 1.002));
  const a = v3.sub(E, F.cam), b = v3.sub(P, F.cam);
  line.geometry.setPositions([a[0], a[1], a[2], b[0], b[1], b[2]]);
  line.computeLineDistances();
  mat.resolution.set(F.width, F.height);
  line.visible = true;
}

// ---------------------------------------------------------------- câmeras
function frame() {
  const E = earth(), P = link.target.pos();
  const dir = v3.norm(v3.sub(P, E));
  // câmera de lado, um pouco acima do plano das órbitas (polo da eclíptica), para não ver tudo de perfil
  const ECL = [0, -0.39777716, 0.91748206];
  let side = v3.cross(dir, ECL);
  if (v3.len(side) < 1e-3) side = v3.cross(dir, [1, 0, 0]);
  side = v3.norm(side);
  const poleP = v3.norm(v3.cross(side, dir)); // polo da eclíptica, perpendicular à linha
  const perp = v3.norm(v3.add(v3.scale(side, 0.55), v3.scale(poleP, 0.84)));
  const up = v3.norm(v3.cross(perp, dir)); // com "direita" = direção Terra → objeto, a Terra fica à esquerda
  return { E, P, dir, perp, up, D: v3.dist(P, E) };
}

export function sideBySide() {
  link.mode = 'side';
  const t = link.target;
  const f0 = frame();
  flyTo({
    id: 'link:side', name: `Terra ↔ ${t.name}`, kind: 'view', radius: 0,
    pos: () => v3.lerp(earth(), t.pos(), 0.5),
    // longe o bastante para as duas pontas caberem entre os painéis laterais
    viewDist: f0.D * 1.5 + R_E() * 3 + (t.radius || 0) * 3,
    arriveDir: () => frame().perp,
    arriveUp: () => frame().up,
  });
  render();
}

export function fromEarth() {
  link.mode = 'earth';
  const f0 = frame();
  // atrás da Terra, um pouco acima: a Terra embaixo na tela e a linha subindo até o objeto, no centro
  flyTo({
    id: 'link:earth', name: 'Terra', kind: 'view', radius: R_E(),
    pos: () => earth(),
    viewDist: R_E() * 4.3,
    arriveDir: () => { const f = frame(); return v3.norm(v3.add(v3.scale(f.dir, -4), v3.scale(f.up, 1.6))); },
    arriveUp: () => frame().up,
    finalLook: () => link.target.pos(),
  });
  void f0;
  render();
}

export function start(t) {
  link.target = t;
  F.linkActive = true;
  sideBySide();
}
export function stop() {
  link.target = null; link.mode = null; F.linkActive = false;
  if (line) line.visible = false;
  syncButtons();
}

// ---------------------------------------------------------------- painel
export const CONST_PT = {
  And: 'Andrômeda', Ant: 'Máquina Pneumática', Aps: 'Ave do Paraíso', Aqr: 'Aquário', Aql: 'Águia', Ara: 'Altar', Ari: 'Áries', Aur: 'Cocheiro', Boo: 'Boieiro',
  Cae: 'Buril', Cam: 'Girafa', Cnc: 'Câncer', CVn: 'Cães de Caça', CMa: 'Cão Maior', CMi: 'Cão Menor', Cap: 'Capricórnio', Car: 'Quilha', Cas: 'Cassiopeia',
  Cen: 'Centauro', Cep: 'Cefeu', Cet: 'Baleia', Cha: 'Camaleão', Cir: 'Compasso', Col: 'Pomba', Com: 'Cabeleira de Berenice', CrA: 'Coroa Austral',
  CrB: 'Coroa Boreal', Crv: 'Corvo', Crt: 'Taça', Cru: 'Cruzeiro do Sul', Cyg: 'Cisne', Del: 'Golfinho', Dor: 'Dourado', Dra: 'Dragão', Equ: 'Cavalo Menor',
  Eri: 'Erídano', For: 'Fornalha', Gem: 'Gêmeos', Gru: 'Grou', Her: 'Hércules', Hor: 'Relógio', Hya: 'Hidra', Hyi: 'Hidra Macho', Ind: 'Índio', Lac: 'Lagarto',
  Leo: 'Leão', LMi: 'Leão Menor', Lep: 'Lebre', Lib: 'Libra', Lup: 'Lobo', Lyn: 'Lince', Lyr: 'Lira', Men: 'Mesa', Mic: 'Microscópio', Mon: 'Unicórnio',
  Mus: 'Mosca', Nor: 'Esquadro', Oct: 'Oitante', Oph: 'Serpentário', Ori: 'Órion', Pav: 'Pavão', Peg: 'Pégaso', Per: 'Perseu', Phe: 'Fênix', Pic: 'Pintor',
  Psc: 'Peixes', PsA: 'Peixe Austral', Pup: 'Popa', Pyx: 'Bússola', Ret: 'Retículo', Sge: 'Flecha', Sgr: 'Sagitário', Sco: 'Escorpião', Scl: 'Escultor',
  Sct: 'Escudo', Ser: 'Serpente', Sex: 'Sextante', Tau: 'Touro', Tel: 'Telescópio', Tri: 'Triângulo', TrA: 'Triângulo Austral', Tuc: 'Tucano',
  UMa: 'Ursa Maior', UMi: 'Ursa Menor', Vel: 'Vela', Vir: 'Virgem', Vol: 'Peixe Voador', Vul: 'Raposa',
};
const AZ_PT = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];

function loadLoc() {
  try { const l = JSON.parse(localStorage.getItem('astrolab.loc')); if (l?.lat != null) return l; } catch { /* sem armazenamento */ }
  return { lat: -23.55, lon: -46.63, name: 'São Paulo' };
}
let loc = loadLoc();

// Posição vista do observador: vetor topocêntrico J2000 -> equador da data -> altura/azimute
function horizonOf(p, time, obs) {
  const ov = A.ObserverVector(time, obs, false); // AU, J2000
  const topo = v3.sub(p, v3.add(earth(), [ov.x * AU, ov.y * AU, ov.z * AU]));
  const vec = new A.Vector(topo[0], topo[1], topo[2], time);
  const eqd = A.RotateVector(A.Rotation_EQJ_EQD(time), vec);
  const sph = A.EquatorFromVector(eqd);
  return { hor: A.Horizon(time, obs, sph.ra, sph.dec, 'normal'), decDate: sph.dec };
}

function galacticPhrase(p, d) {
  const g = EQ2GAL.map(r => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]);
  const l = (Math.atan2(g[1], g[0]) * 180 / Math.PI + 360) % 360, b = Math.asin(g[2] / (v3.len(g) || 1)) * 180 / Math.PI;
  const ll = l > 180 ? l - 360 : l;
  if (d < 0.5) return null;
  if (d < 3e4) {
    const where = Math.abs(ll) < 30 ? 'na direção do centro da Via Láctea' : Math.abs(ll) > 150 ? 'na direção oposta ao centro da Via Láctea'
      : ll > 0 ? 'na direção em que o Sol viaja em volta da galáxia' : 'na direção de onde o Sol vem em sua volta pela galáxia';
    const plane = b > 15 ? ', acima do disco' : b < -15 ? ', abaixo do disco' : ', no plano do disco';
    return `${where}${plane}`;
  }
  return Math.abs(b) < 12 ? 'perto da faixa da Via Láctea no céu: a poeira da nossa galáxia atrapalha a vista'
    : 'longe da faixa da Via Láctea no céu, numa região limpa de poeira';
}

// A seção pode ser mostrada para qualquer objeto (exceto a Terra, vistas e pontos do céu sem distância)
export const canShow = t => t && t.kind !== 'sky' && t.kind !== 'view' && t.id !== 'b:Earth';
export const tooClose = t => v3.dist(t.pos(), earth()) < 25 * R_E();   // a Terra taparia a vista "olhar da Terra"

// HTML da seção "Visto da Terra" da ficha; os botões são ligados pela ficha (info.js)
export function sectionHTML(t) {
  return `<section class="earthSec"><h3>Visto da Terra</h3><div id="earthBody">${bodyHTML(t)}</div>` +
    `<div class="actions"><button data-lk="side" title="A Terra numa ponta, o objeto na outra, com uma linha ligando os dois (V)">↔ Lado a lado</button>` +
    `<button data-lk="earth" title="Atrás da Terra, olhando para o objeto"${tooClose(t) ? ' disabled' : ''}>🌍 Olhar da Terra</button>` +
    `<button data-lk="loc" title="Calcular a visibilidade a partir de onde você está">📍 Usar minha localização</button>` +
    `<button data-lk="stop" title="Sair da vista Terra–objeto (Esc)" hidden>✕ Sair desta vista</button></div></section>`;
}
// atualiza os números da seção aberta (a posição muda com o tempo) e o estado dos botões
export function render(t = link.target) {
  const box = $('earthBody');
  if (box && t) box.innerHTML = bodyHTML(t);
  syncButtons();
}
function syncButtons() {
  for (const b of document.querySelectorAll('#info [data-lk]')) {
    if (b.dataset.lk === 'stop') b.hidden = !link.target;
    else b.classList.toggle('on', !!link.target && b.dataset.lk === link.mode);
  }
}
function bodyHTML(t) {
  const time = A.MakeTime(ephDate());
  const P = t.pos(), E = earth();
  const geo = v3.sub(P, E), D = v3.len(geo);
  const { ra, dec } = xyz2radec(geo);
  const c = A.Constellation(ra / 15, dec);
  const obs = new A.Observer(loc.lat, loc.lon, 0);
  const { hor } = horizonOf(P, time, obs);
  const sunH = A.Horizon(time, obs, ...(() => { const s = A.Equator(A.Body.Sun, time, obs, true, true); return [s.ra, s.dec]; })(), 'normal');
  const near = D < 25 * R_E();
  const rows = [];
  // a distância da Terra não se repete aqui: a ficha já mostra (no Sistema Solar) ou é igual à do Sol (fora dele)
  rows.push(['No céu, fica em', `${CONST_PT[c.symbol] || c.name} <small class="muted">(${c.name})</small>`]);
  const gal = galacticPhrase(P, v3.len(P));
  if (gal) rows.push(['Na Via Láctea', gal]);
  // separação angular do Sol (objetos do Sistema Solar e próximos)
  const sunDir = v3.norm(v3.scale(E, -1)), objDir = v3.norm(geo);
  const elong = Math.acos(Math.min(1, Math.max(-1, v3.dot(sunDir, objDir)))) * 180 / Math.PI;
  if (!near && elong < 25) rows.push(['Perto do Sol no céu', `${fmtNum(elong, 0)}° do Sol: ${elong < 10 ? 'escondido no brilho do Sol' : 'só aparece perto do nascer ou do pôr do Sol'}`]);
  rows.push(['Coordenadas', `AR ${fmtNum(ra / 15, 2)} h · Dec ${dec >= 0 ? '+' : ''}${fmtNum(dec, 1)}°`]);

  let vis;
  const az = AZ_PT[Math.round(hor.azimuth / 45) % 8];
  const isNight = sunH.altitude < -6;
  if (near) vis = hor.altitude > 0 ? `Agora está ${fmtNum(hor.altitude, 0)}° acima do horizonte, para o ${az}.` : 'Agora está abaixo do horizonte.';
  else {
    const maxAlt = 90 - Math.abs(loc.lat - dec);
    if (maxAlt < 0) vis = `Nunca aparece no céu daí: fica sempre abaixo do horizonte.`;
    else {
      vis = hor.altitude > 0
        ? (hor.altitude < 2 ? `Agora: rente ao horizonte, para o ${az}` : `Agora: ${fmtNum(hor.altitude, 0)}° acima do horizonte, para o ${az}`) + `${isNight ? '' : ' (mas é dia aí)'}.`
        : 'Agora está abaixo do horizonte.';
      vis += ` Chega a ${fmtNum(maxAlt, 0)}° de altura${90 - Math.abs(loc.lat + dec) < 0 && Math.sign(loc.lat) === Math.sign(dec) ? ' e nunca se põe' : ''}.`;
    }
  }
  // (a frase sobre a luz já está na ficha, logo acima)
  return `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` +
    `<p class="small"><b>De ${loc.name}:</b> ${vis}${isNight ? ' É noite aí.' : ''}</p>`;
}

export function useMyLocation(onDone, t) {
  if (!navigator.geolocation) { onDone?.(false); return; }
  navigator.geolocation.getCurrentPosition(p => {
    loc = { lat: p.coords.latitude, lon: p.coords.longitude, name: 'sua localização' };
    try { localStorage.setItem('astrolab.loc', JSON.stringify(loc)); } catch { /* sem armazenamento */ }
    render(t || link.target); onDone?.(true);
  }, () => onDone?.(false), { timeout: 10000 });
}

// Rótulos extras: "Terra" sempre visível e a distância no meio da linha (no modo lado a lado)
export function labelCandidates() {
  if (!link.target) return [];
  const E = earth(), P = link.target.pos(), D = v3.dist(E, P);
  const out = [{ id: 'link:earth', pos: E, name: '🌍 Terra', cls: 'sel link', prio: 950, radius: R_E(), make: () => null }];
  // a distância vai no meio da linha; se o objeto está colado na Terra, vai perto dele (o meio fica dentro da Terra)
  if (link.mode === 'side') out.push({ id: 'link:mid', pos: D < 25 * R_E() ? v3.lerp(E, P, 0.92) : v3.lerp(E, P, 0.5), name: D < 25 * R_E() ? `${fmtDist(Math.max(D - R_E(), 0))} de altura` : fmtDist(D), cls: 'link dist', prio: 940, make: () => null });
  return out;
}
