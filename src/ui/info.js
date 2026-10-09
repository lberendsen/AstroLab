// Ficha de informações do objeto selecionado (painel da direita).
import { DB, starRadiusSun } from '../data.js';
import * as solar from '../layers/solar.js';
import * as images from '../layers/images.js';
import * as sats from '../layers/sats.js';
import * as craft from '../layers/craft.js';
import * as deep from '../layers/deep.js';
import * as scope from '../telescope.js';
import * as feeds from '../feeds.js';
import { setOrbit } from '../nav.js';
import { exoTarget } from '../targets.js';
import { v3, fmtDist, fmtLightTime, fmtNum, lightSentence, fmtYears, lookbackYears, AGE_OF_UNIVERSE, CMB_DISTANCE } from '../astro.js';
import { ui, go, openScope, startLink, openFeeds } from './actions.js';
import { $ } from './dom.js';

const row = (k, v) => v == null || v === '' ? '' : `<dt>${k}</dt><dd>${v}</dd>`;

export function renderInfo(t) {
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
      if (ui.selected !== t || !$('dsnLive')) return;
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
  if (ui.selected !== t || !$('photoBox')) return;
  if (e.state === 'ok') {
    const s = scope.SURVEY_BY_ID[e.survey];
    box.innerHTML = `<img class="thumb" src="${e.dataURL}" alt=""><p class="muted small">Foto: ${s?.label || e.survey} (via hips2fits/CDS)</p>`;
  } else box.innerHTML = '';
}

// Atualiza só os números que mudam com o tempo, sem refazer a ficha
export function refreshInfoDistances() {
  const t = ui.selected;
  if (!t || $('info').hidden) return;
  const sun = document.querySelector('#info [data-live=sun]');
  if (sun) sun.textContent = fmtDist(v3.len(t.pos()));
  const earth = document.querySelector('#info [data-live=earth]');
  if (earth) earth.textContent = fmtDist(v3.dist(t.pos(), solar.BODY.Earth.pos));
  const alt = document.querySelector('#info [data-live=alt]');
  const s = t.sat || t.craft?.sat;
  if (alt && s) alt.textContent = `${fmtNum(sats.satInfo(s).altKm, 0)} km`;
}
