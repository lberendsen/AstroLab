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
import { exoTarget, sbTarget, craftTarget, nextPeak } from '../targets.js';
import * as smallbodies from '../layers/smallbodies.js';
import { habitableZone } from '../layers/systems.js';
import * as PLN from '../planetarium.js';
import { MOON_DESC, PLANET_PT, SCOPE_KEY, moonPeriodDays } from '../layers/moons.js';
import { BH_INFO } from './phenomena.js';
import { KM, R_EARTH } from '../astro.js';
import { openPlanetarium } from './planpanel.js';
import { v3, DEG, fmtDist, fmtLightTime, fmtNum, lightSentence, fmtYears, lookbackYears, AGE_OF_UNIVERSE, CMB_DISTANCE } from '../astro.js';
import { ui, go, openScope, startLink, openFeeds, showerParent } from './actions.js';
import { $ } from './dom.js';

const row = (k, v) => v == null || v === '' ? '' : `<dt>${k}</dt><dd>${v}</dd>`;

// Desenho em escala: a Terra ao lado do planeta (e Júpiter, se o planeta for grande)
function sizeCompare(rE, estimated) {
  const ref = rE > 4 ? [['Terra', 1, '#4f8fd8'], ['Júpiter', 11.2, '#d8b48a']] : [['Terra', 1, '#4f8fd8']];
  const all = [...ref, ['Este planeta', rE, '#7fe0b0']];
  const H = 90, k = (H / 2 - 4) / Math.max(...all.map(x => x[1]));
  let x = 6, svg = '';
  for (const [name, r, c] of all) {
    const rp = Math.max(r * k, 1.2);
    svg += `<circle cx="${x + rp}" cy="${H / 2}" r="${rp}" fill="${c}"/><text x="${x + rp}" y="${H + 12}" text-anchor="middle">${name}</text>`;
    x += 2 * rp + 26;
  }
  return `<h3>Tamanho comparado</h3><svg class="sizecmp" viewBox="0 0 ${x} ${H + 18}" width="100%" style="max-height:120px">${svg}</svg>` +
    (estimated ? `<div class="note">Raio estimado pela massa: este planeta nunca foi visto passando na frente da estrela.</div>` : '');
}

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
    const hz = t.host ? habitableZone(i) : null;
    if (hz) dl += row('Zona habitável', `${fmtNum(hz.inner, hz.inner < 1 ? 3 : 2)} a ${fmtNum(hz.outer, hz.outer < 1 ? 3 : 2)} UA`);
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
    const hz = habitableZone(t.host.star);
    if (hz && p.a) dl += row('Zona habitável', p.a < hz.inner ? 'não: perto demais da estrela (quente)' : p.a > hz.outer ? 'não: longe demais da estrela (fria)' : '<b class="hz">sim</b>: água líquida seria possível na superfície');
    extra += sizeCompare(t.radius / R_EARTH, !p.r);
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
    const now = c.pos(solar.nowMs());
    if (!now) {
      notes += `<div class="note">${c.kind === 'surface' ? 'Na data mostrada, ainda não tinha pousado.' : 'Na data mostrada, esta nave ainda não tinha sido lançada ou a missão já tinha terminado.'} Mude a data no painel 🕰️ Tempo.</div>`;
    } else {
      const p = t.pos(), dE = v3.dist(p, solar.BODY.Earth.pos), cc = craft.craftCenterAt(c);
      dl += row('Distância da Terra', `<span data-live="earth">${fmtDist(dE)}</span>`);
      if (cc === 'Sun') dl += row('Distância do Sol', `<span data-live="sun">${fmtDist(v3.len(p))}</span>`);
      const sp = craft.speedKmS(c);
      const PT = { Earth: 'Terra', Mars: 'Marte', Moon: 'Lua', Jupiter: 'Júpiter', Saturn: 'Saturno', Venus: 'Vênus', Uranus: 'Urano', Neptune: 'Netuno', Pluto: 'Plutão' };
      if (sp) dl += row(cc === 'Sun' ? 'Velocidade (em relação ao Sol)' : `Velocidade (em relação a ${PT[cc] || cc})`, `<span data-live="speed">${fmtNum(sp, 2)} km/s (${fmtNum(sp * 3600, 0)} km/h)</span>`);
      if (c.kind !== 'natural') notes += `<div class="lighttime">Um sinal de rádio leva <span data-live="light">${fmtLightTime(dE)}</span> para ir da Terra até aqui.</div>`;
    }
    notes += `<div class="note">${c.approx ? `Posição aproximada. ${c.approx}` : c.segs ? 'Trajetória real: JPL Horizons (NASA).' : c.kind === 'surface' ? 'Local de pouso publicado pela missão.' : ''}${c.kind === 'natural' ? '' : ` O modelo 3D é simplificado, mas está no tamanho real (${fmtNum(c.size, 1)} m).`}</div>`;
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
  } else if (t.moon) {
    const m = t.moon, P = solar.BODY[m.planet];
    if (MOON_DESC[m.id]) h += `<p>${MOON_DESC[m.id]}</p>`;
    dl += row('Diâmetro', m.r ? `${fmtNum(m.r * 2, m.r < 50 ? 1 : 0)} km` : 'desconhecido (alguns km)');
    dl += row(`Distância de ${PLANET_PT[m.planet]}`, `${fmtNum(m.a, 0)} km (${fmtNum(m.a / P.r, 1)} raios do planeta)`);
    const per = moonPeriodDays(m);
    dl += row('Uma volta', per < 2 ? `${fmtNum(per * 24, 1)} horas` : per < 500 ? `${fmtNum(per, 1)} dias` : `${fmtNum(per / 365.25, 1)} anos`);
    // sentido em relação à rotação do planeta (a inclinação do Horizons é medida no equador da Terra)
    const nrm = [Math.sin(m.om) * Math.sin(m.i), -Math.cos(m.om) * Math.sin(m.i), Math.cos(m.i)];
    if (P.pole && v3.dot(nrm, P.pole) < 0) dl += row('Sentido', 'retrógrado (gira ao contrário do planeta): provavelmente capturada');
    dl += row('Distância da Terra', `<span data-live="earth">${fmtDist(v3.dist(t.pos(), solar.BODY.Earth.pos))}</span>`);
    notes += `<div class="note">Órbita: elementos do JPL Horizons numa época de 2026, propagados por Kepler (posição muito boa perto de hoje; a fase se desvia com os anos). ${SCOPE_KEY[m.id] ? 'Mapa real da superfície; rotação sincronizada.' : 'Forma e cor ilustrativas.'}</div>`;
  } else if (t.kind === 'psr') {
    const p = t.psr;
    if (p.desc) h += `<p>${p.desc}</p>`;
    else h += `<p>Uma estrela de nêutrons: o núcleo de uma estrela que explodiu, com mais massa que o Sol espremida numa bola de ~20 km. Feixes de rádio saem dos polos magnéticos e varrem a Terra a cada volta, como um farol.</p>`;
    dl += row('Rotação', p.p ? (p.p < 1 ? `${fmtNum(1 / p.p, 1)} voltas por segundo (período de ${fmtNum(p.p * 1000, 2)} ms)` : `uma volta a cada ${fmtNum(p.p, 3)} s`) : null);
    dl += row('Distância (estimada)', fmtDist(p.d));
    dl += row('Idade característica', p.age ? (p.age > 1e9 ? `${fmtNum(p.age / 1e9, 1)} bilhões de anos` : p.age > 1e6 ? `${fmtNum(p.age / 1e6, 1)} milhões de anos` : `${fmtNum(p.age / 1e3, 1)} mil anos`) : null);
    dl += row('Associado a', p.assoc || null);
    dl += row('Sistema binário', p.bin || null);
    notes += `<div class="note">Catálogo ATNF (via VizieR). A distância da maioria dos pulsares é estimada pela dispersão do sinal de rádio no gás da galáxia, com erros de 20–50%.</div>`;
  } else if (t.kind === 'view' && (t.struct || t.gw)) {
    if (t.struct) { h += `<p>${t.struct.desc}</p>`; dl += row('Distância', fmtDist(t.struct.d * 1e6)); dl += row('Tamanho (aprox.)', fmtDist(t.struct.r * 2e6)); notes += `<div class="note">Contorno aproximado (esfera de arame). As galáxias em volta são reais (2MRS).</div>`; }
    if (t.gw) {
      const e = t.gw;
      h += `<p>Em ${e.date.toLocaleDateString('pt-BR')}, os detectores sentiram o espaço esticar e encolher por uma fração do tamanho de um próton: o sinal de dois objetos colidindo.</p>`;
      dl += row('Massas', `${fmtNum(e.m1, 1)} e ${fmtNum(e.m2, 1)} vezes a massa do Sol`);
      if (e.mf) dl += row('Resultado', `${fmtNum(e.mf, 1)} massas solares; ${fmtNum(e.m1 + e.m2 - e.mf, 1)} viraram energia em ondas gravitacionais`);
      dl += row('Distância', fmtDist(e.d * 1e6));
      notes += `<div class="note">A casca lilás mostra a distância. A direção quase nunca é conhecida com precisão: a fonte pode estar em qualquer ponto de uma grande região do céu. Fonte: GWOSC (${e.cat}).</div>`;
    }
  } else if (t.kind === 'sb') {
    const o = t.sb;
    if (o.desc) h += `<p>${o.desc}</p>`;
    const dKm = o.isComet ? o.diameter : smallbodies.diameterKm(o);
    dl += row(o.isComet ? 'Núcleo' : 'Diâmetro', dKm ? `${dKm < 1 ? fmtNum(dKm * 1000, 0) + ' m' : fmtNum(dKm, dKm < 10 ? 1 : 0) + ' km'}${o.diameter ? '' : ' (estimado pelo brilho)'}` : null);
    dl += row('Distância do Sol', `<span data-live="sun">${fmtDist(dSun)}</span>`);
    dl += row('Distância da Terra', `<span data-live="earth">${fmtDist(v3.dist(t.pos(), solar.BODY.Earth.pos))}</span>`);
    const a = o.a || (o.q && o.e < 1 ? o.q / (1 - o.e) : null);
    if (o.e < 1 && a) {
      const yrs = Math.pow(a, 1.5);
      dl += row('Uma volta no Sol', yrs < 2 ? `${fmtNum(yrs * 365.25, 0)} dias` : `${fmtNum(yrs, yrs < 100 ? 1 : 0)} anos`);
      dl += row('Órbita', `de ${fmtNum(a * (1 - o.e), 2)} a ${fmtNum(a * (1 + o.e), 2)} UA do Sol`);
    } else if (o.e >= 1) dl += row('Órbita', `aberta (excentricidade ${fmtNum(o.e, 3)}): passa uma vez e vai embora`);
    dl += row('Inclinação', `${fmtNum(o.i / DEG, 1)}°`);
    if (o.tp) {
      const per = o.e < 1 && a ? 365.25 * Math.pow(a, 1.5) : null;
      const now = smallbodies.jdNow();
      let tp = o.tp, extrapolated = false;
      if (per) while (tp < now - per / 2) { tp += per; extrapolated = true; }
      const d = new Date((tp - 2440587.5) * 864e5);
      // somar períodos ignora as perturbações dos planetas: para órbitas longas, só o ano é confiável
      const txt = extrapolated && per > 3650 ? `${d.getUTCFullYear()} (aproximado: os planetas perturbam a órbita)` : d.toLocaleDateString('pt-BR');
      dl += row(tp < now ? 'Último periélio' : 'Próximo periélio', txt);
    }
    if (o.rot) dl += row('Rotação', o.rot < 48 ? `${fmtNum(o.rot, 2)} horas` : `${fmtNum(o.rot / 24, 1)} dias`);
    if (o.isComet) { const st = smallbodies.cometState(o); if (st.mag < 30) dl += row('Brilho previsto agora', `magnitude ${fmtNum(st.mag, 1)}${st.mag < 6 ? ' (a olho nu)' : st.mag < 10 ? ' (binóculo)' : ''}`); }
    if (o.discovery?.date) dl += row('Descoberta', `${o.discovery.date}${o.discovery.who ? ' · ' + o.discovery.who : ''}`);
    if (o.visited) dl += row('Visitado por', o.visited);
    notes += `<div class="note">Órbita do JPL Small-Body Database. ${o.diameter ? '' : 'Tamanho estimado pelo brilho. '}A forma 3D é ilustrativa${o.visited ? ', exceto pelo tamanho' : ''}.${o.isComet ? ' A cauda é desenhada pela distância ao Sol e pela atividade do cometa.' : ''}</div>`;
    if (o.craft) extra += `<button id="aVisitor" class="small">🛰️ Ir até a nave que foi para lá</button>`;
    if (o.fromCloud && o.pdes) extra += `<div id="sbMore" class="muted small">consultando o JPL…</div>`;
  } else if (t.kind === 'shower') {
    const s = t.shower, p = showerParent(s), peak = nextPeak(s);
    h += `<p>Quando a Terra atravessa a poeira deixada por ${p ? p.name : s.parent}, os grãos entram na atmosfera a ${s.v} km/s e queimam como estrelas cadentes. Todos parecem sair do mesmo ponto do céu, o radiante.</p>`;
    dl += row('Pico', peak.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }));
    dl += row('Radiante', `constelação de ${s.const}`);
    dl += row('Meteoros por hora', `até ~${s.zhr} (com céu perfeito e o radiante no alto)`);
    dl += row('Velocidade', `${s.v} km/s`);
    dl += row('Origem', p ? `${p.name} (${p.isComet ? 'cometa' : 'asteroide'})` : s.parent);
    if (s.note) notes += `<div class="note">${s.note}</div>`;
    notes += `<div class="note">Os pontos dourados mostram a poeira ao longo da órbita do corpo de origem: mais densa logo atrás dele (a poeira recente) e tênue no resto da órbita (a antiga). O espalhamento é ilustrativo.</div>`;
    extra += `<div class="actions"><button id="aRadiant">🔭 Ver o radiante no céu</button>${p ? '<button id="aParent">☄️ Ir até a origem</button>' : ''}</div>`;
  } else if (t.kind === 'view') {
    if (t.id === 'v:qso') notes += `<div class="note">Cada ponto é um quasar real do SDSS (750 mil), colorido pelo redshift: azul mais perto, vermelho mais longe. O formato de cunha é a área do céu que o telescópio do SDSS cobriu, vista de fora. Os mais distantes estão a ~30 bilhões de anos-luz (distância comóvel): a luz deles saiu quando o universo tinha menos de 1 bilhão de anos.</div>`;
    if (t.id === 'v:cmb') notes += `<div class="note">A esfera é a radiação cósmica de fundo, medida pelo satélite Planck: a luz mais antiga que existe, de quando o universo tinha 380 mil anos. Hoje esse lugar está a ${fmtDist(CMB_DISTANCE)}: é a borda do universo <b>observável a partir da Terra</b>, não a borda do universo. As manchas são diferenças de temperatura de 1 parte em 100 mil, as sementes de todas as galáxias. A faixa clara é a região tapada pelo disco da Via Láctea, preenchida por interpolação.</div>`;
    if (t.id === 'v:ori3d') notes += `<div class="note">As linhas ligam as estrelas de Órion nas posições 3D reais. Daqui de lado, o desenho do caçador some: Betelgeuse está a ~550 anos-luz, Bellatrix a ~250 e as Três Marias entre 700 e 1.300. Elas só parecem formar uma figura vistas da Terra. Para esconder as linhas, desmarque "Constelações no espaço" em Camadas.</div>`;
    if (t.id === 'v:mw') notes += `<div class="note">Ninguém tem foto da Via Láctea vista de fora. Isto é um modelo feito com medidas reais: disco de ~100 mil anos-luz, barra central, 4 braços espirais, e o Sol a 26.700 anos-luz do centro, entre os braços de Perseu e de Sagitário.</div>`;
    if (t.id === 'v:web') notes += `<div class="note">Cada ponto é uma galáxia real do 2MASS Redshift Survey (43 mil), posicionada pela distância do redshift. Os filamentos e vazios são a teia cósmica. A faixa vazia é a "zona de evitação": o disco da Via Láctea tapa essa parte do céu.</div>`;
  } else {
    // céu profundo, galáxias, SIMBAD
    const size = (t.radius || 0) * 2;
    if (t.curated) dl += row('SIMBAD', t.curated.mainId);
    if (t.simbad) { dl += row('SIMBAD', t.simbad.mainId); dl += row('Tipo', t.simbad.otypeLabel); }
    if (t.kind !== 'sky') {
      dl += row('Distância do Sol', fmtDist(dSun));
      if (size > 0 && !t.curated?.z && t.curated?.type !== 'bh') dl += row('Tamanho', fmtDist(size));
      if (t.curated?.z) dl += row('Redshift', `z = ${t.curated.z}`);
      notes += `<div class="lighttime">${lightSentence(dSun, t.curated?.z || t.simbad?.z)}</div>`;
    }
    const bh = t.curated && BH_INFO[t.curated.id];
    if (bh) {
      h += `<p>${bh.desc}</p>`;
      dl += row('Massa', `${fmtNum(bh.mass, bh.mass < 100 ? 1 : 0)} vezes a do Sol`);
      dl += row('Horizonte de eventos', `${fmtDist(2 * 2.95 * bh.mass * KM)} de diâmetro`);
      if (bh.eht) extra += `<img class="eht" src="${bh.eht}" alt=""><p class="muted small">Imagem do Event Horizon Telescope (ESO/EHT): a sombra do buraco negro dentro do anel de gás quente.</p>`;
      if (bh.mass < 1e5) notes += `<div class="note">Chegando perto: a esfera preta tem o tamanho real do horizonte de eventos (${fmtNum(2 * 2.95 * bh.mass, 0)} km). ${bh.disk ? 'O disco brilhante é ilustrativo: o gás roubado da estrela companheira.' : 'Este buraco negro não tem disco: só se sabe dele pela gravidade.'}</div>`;
    }
    if (t.gal != null) notes += `<div class="note">Distância estimada pelo redshift (lei de Hubble, H₀ = 70 km/s/Mpc). O tamanho é o raio medido no infravermelho pelo 2MASS.</div>`;
    if (t.simbad?.dSource) notes += `<div class="note">Distância: ${t.simbad.dSource}.</div>`;
    if (t.kind === 'sky') notes += `<div class="note">O SIMBAD não tem distância medida para este objeto, então não dá para viajar até ele. Dá para observá-lo no telescópio.</div>`;
    extra += `<div id="photoBox"></div>`;
  }
  // no planetário: onde está no céu de quem está em pé
  const aa = PLN.altAzOf(t.pos());
  if (aa) dl = row('No seu céu', aa.alt > 0 ? `${fmtNum(aa.alt, 0)}° de altura, para o ${PLN.azName(aa.az)}` : `abaixo do horizonte (${fmtNum(aa.alt, 0)}°)`) + dl;
  h += `<dl>${dl}</dl>${notes}${extra}`;
  const skyHere = t.craft?.kind === 'surface' ? [t.craft.body, t.craft.lat, t.craft.lon, t.craft.name] : t.body && ['Earth', 'Moon', 'Mars'].includes(t.body.key) ? [t.body.key] : null;
  if (skyHere && !PLN.PL.active) h += `<div class="actions"><button id="aSky" title="Ficar em pé aí e ver o céu (P)">🌅 Ver o céu daqui</button></div>`;
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
    // o contato da DSN é o de agora: só faz sentido com a data simulada perto do presente
    if (id && Math.abs(solar.nowMs() - Date.now()) < 864e5) feeds.dsnFor(id).then(ls => {
      if (ui.selected !== t || !$('dsnLive')) return;
      $('dsnLive').innerHTML = ls.length ? `📡 Agora, ao vivo: ${ls.map(feeds.describeLink).join(' ')}` : '';
    });
  }
  if (t.kind === 'sb') wireSb(t);
  if ($('aSky')) $('aSky').onclick = () => {
    if (skyHere.length > 1) openPlanetarium(...skyHere);
    else { const k = skyHere[0], p = k === 'Earth' ? null : PLN.PRESETS[k][0]; p ? openPlanetarium(k, p[1], p[2], p[0]) : openPlanetarium('Earth', PLN.PL.lat, PLN.PL.lon, PLN.PL.name); }
  };
  if (t.kind === 'shower') {
    $('aRadiant').onclick = () => scope.open({ ra: t.shower.ra, dec: t.shower.dec, fovDeg: 40, name: `Radiante das ${t.shower.name}` });
    const p = showerParent(t.shower);
    $('aParent') && ($('aParent').onclick = () => go(sbTarget(p)));
  }
  for (const li of document.querySelectorAll('#info [data-planet]')) li.onclick = () => go(exoTarget(t.host, li.dataset.planet));
  if ($('photoBox')) showPhoto(t);
}

function wireSb(t) {
  const o = t.sb;
  if ($('aVisitor')) $('aVisitor').onclick = () => { const c = craft.CRAFT.find(x => x.id === o.craft); if (c) go(craftTarget(c)); };
  // asteroide clicado na nuvem: busca no JPL o nome completo, o tamanho medido e a descoberta
  if ($('sbMore')) smallbodies.fetchSbdb(o.pdes).then(full => {
    if (ui.selected !== t || !$('sbMore')) return;
    if (!full) { $('sbMore').remove(); return; }
    Object.assign(o, { full: full.full, diameter: full.diameter, albedo: full.albedo, rot: full.rot, discovery: full.discovery, pha: full.pha, fromCloud: false });
    renderInfo(t);
  }).catch(() => $('sbMore')?.remove());
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
  const light = document.querySelector('#info [data-live=light]');
  if (light) light.textContent = fmtLightTime(v3.dist(t.pos(), solar.BODY.Earth.pos));
  const alt = document.querySelector('#info [data-live=alt]');
  const s = t.sat || t.craft?.sat;
  if (alt && s) alt.textContent = `${fmtNum(sats.satInfo(s).altKm, 0)} km`;
  const spd = document.querySelector('#info [data-live=speed]');
  if (spd && t.craft) { const v = craft.speedKmS(t.craft); if (v) spd.textContent = `${fmtNum(v, 2)} km/s (${fmtNum(v * 3600, 0)} km/h)`; }
  // nave cujo corpo central mudou (ex.: replay passando por um planeta): refaz a ficha
  if (t.craft?.segs) {
    const cc = craft.craftCenterAt(t.craft);
    if (t._cc && t._cc !== cc) renderInfo(t);
    t._cc = cc;
  }
}
