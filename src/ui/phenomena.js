// Fenômenos extremos: ondas gravitacionais (GWOSC, ao vivo), explosões recentes (TNS, ao vivo), buracos negros,
// pulsares e estruturas. Não há painel próprio: tudo vira ramos da árvore de lugares (places.js), com as
// informações de cada item na dica que aparece ao parar o mouse em cima.
import { DB } from '../data.js';
import * as P5L from '../layers/phase5.js';
import { P5 } from '../layers/phase5.js';
import { curatedTarget, simbadTarget } from '../targets.js';
import { v3, radec2xyz, comovingDistance, fmtDist, fmtNum } from '../astro.js';
import { go, select, openScope } from './actions.js';
import { toast } from './dom.js';

const proxied = u => '/proxy?u=' + encodeURIComponent(u);

// textos das dicas das categorias
export const INTRO = {
  all: 'Os lugares mais violentos e extremos do universo: colisões que sacodem o próprio espaço, estrelas explodindo agora, buracos negros, estrelas de nêutrons girando centenas de vezes por segundo e as maiores estruturas que existem.',
  gw: 'Colisões registradas como ondulações do próprio espaço (LIGO, Virgo, KAGRA). Os detectores medem bem a distância, mas a direção vem como uma mancha enorme no céu: ao escolher uma, aparece a casca lilás a essa distância, porque o evento está "em algum lugar" dela. Fonte: GWOSC (catálogos GWTC), consultado ao abrir o app.',
  sn: 'Supernovas e outras explosões descobertas nos últimos 30 dias e já classificadas. Com redshift, dá para viajar até lá; sem, o telescópio mostra o lugar no céu. Tipo Ia: explosão de uma anã branca; tipo II: colapso de uma estrela gigante. Fonte: Transient Name Server (IAU), consultado ao abrir o app.',
  bh: 'Buracos negros com massa e distância medidas, do "dormente" mais próximo aos gigantes do centro das galáxias.',
  psr: 'Estrelas de nêutrons que giram e varrem o espaço com um feixe, como um farol. O 3D mostra os 2.481 pulsares do catálogo ATNF piscando no próprio ritmo; aqui estão os famosos.',
  lss: 'As maiores estruturas do universo próximo, desenhadas como esferas de arame sobre a teia das galáxias reais. Posição e tamanho são aproximados: as bordas dessas estruturas são difusas.',
};

// ---------------------------------------------------------------- buracos negros (massas em massas solares)
export const BH_INFO = {
  'Sgr A*': { mass: 4.3e6, eht: 'https://cdn.eso.org/images/screen/eso2208-eht-mwa.jpg', desc: 'O buraco negro no centro da Via Láctea. Em 2022 o Event Horizon Telescope mostrou a sombra dele: um anel de luz em volta de um buraco escuro do tamanho da órbita de Mercúrio.' },
  'M 87': { mass: 6.5e9, eht: 'https://cdn.eso.org/images/screen/eso1907a.jpg', desc: 'No centro da galáxia M87 está o primeiro buraco negro fotografado, em 2019 (Event Horizon Telescope): 6,5 bilhões de vezes a massa do Sol.' },
  'TON 618': { mass: 4e10, desc: 'Um dos buracos negros mais massivos conhecidos, cerca de 40 bilhões de vezes a massa do Sol.' },
  'Gaia BH1': { mass: 9.6, desc: 'Descoberto em 2022 pelo bamboleio de uma estrela parecida com o Sol que o orbita a cada 186 dias. Está quieto: não come nada e não emite raios X.' },
  'Gaia BH2': { mass: 8.9, desc: 'Orbitado por uma gigante vermelha a cada 3,5 anos. Também é "dormente", visto só pela gravidade.' },
  'Gaia BH3': { mass: 33, desc: 'Encontrado em 2024 nos dados do Gaia: 33 vezes a massa do Sol, o maior buraco negro de origem estelar conhecido na Via Láctea.' },
  'Cyg X-1': { mass: 21, disk: true, desc: 'O primeiro objeto aceito como buraco negro (anos 1970). Arranca gás de uma supergigante azul, que forma um disco quente e brilha em raios X. Foi tema de uma aposta famosa entre Stephen Hawking e Kip Thorne.' },
  'V404 Cyg': { mass: 9, disk: true, desc: 'Teve erupções violentas de raios X em 1989 e 2015, quando engoliu gás da estrela companheira.' },
  'V616 Mon': { mass: 6.6, disk: true, desc: 'Um dos buracos negros mais próximos com estrela companheira, a cerca de 3.500 anos-luz.' },
};
export function bhForTarget(t) {
  const id = t?.curated?.id;
  const info = id && BH_INFO[id];
  if (!info) return null;
  return { ...info, pos: t.pos(), massSun: info.mass };
}
// item da árvore: { label, tip, go }
export function bhItems() {
  return Object.entries(BH_INFO).map(([id, b]) => ({ b, o: DB.curated.find(c => c.id === id) })).filter(x => x.o)
    .sort((a, b) => a.o.d - b.o.d)
    .map(({ b, o }) => ({ label: o.name, tip: `${fmtNum(b.mass, b.mass < 100 ? 1 : 0)} vezes a massa do Sol · a ${fmtDist(o.d)}\n${b.desc}`, go: () => go(curatedTarget(o)) }));
}

// ---------------------------------------------------------------- ondas gravitacionais (GWOSC)
export const GW = { list: null, failed: false };
const gpsToDate = g => new Date(Date.UTC(1980, 0, 6) + (g - 18) * 1000);
const gwKind = e => (e.m2 < 3 && e.m1 < 3 ? 'duas estrelas de nêutrons' : e.m2 < 3 ? 'buraco negro e estrela de nêutrons' : 'dois buracos negros');
export async function loadGw() {
  try {
    const j = await (await fetch('https://gwosc.org/eventapi/json/GWTC/', { signal: AbortSignal.timeout(30000) })).json();
    GW.list = Object.values(j.events).filter(e => e.luminosity_distance && e.mass_1_source).map(e => ({
      name: e.commonName, date: gpsToDate(e.GPS), m1: e.mass_1_source, m2: e.mass_2_source, mf: e.final_mass_source, d: e.luminosity_distance, snr: e.network_matched_filter_snr, cat: e['catalog.shortName'],
    })).sort((a, b) => b.date - a.date);
  } catch (err) { console.warn('GWOSC indisponível', err); GW.failed = true; }
}
export function gwItems() {
  return (GW.list || []).map(e => ({
    label: e.name,
    tip: `${e.date.toLocaleDateString('pt-BR')} · ${gwKind(e)} de ${fmtNum(e.m1, 0)} e ${fmtNum(e.m2, 1)} sóis${e.mf ? `, virando um de ${fmtNum(e.mf, 0)}` : ''}\na ${fmtDist(e.d * 1e6)} (distância de luminosidade)${e.cat ? ` · catálogo ${e.cat}` : ''}`,
    go: () => gwGo(e),
  }));
}
function gwGo(e) {
  if (e.name === 'GW170817') {
    const t = curatedTarget(DB.curated.find(o => o.id === 'NGC 4993'));
    P5L.showGwShell(0); go(t);
    toast('GW170817 é o único evento com galáxia conhecida: a explosão também foi vista em luz (kilonova), em NGC 4993.', 8000);
    return;
  }
  P5L.showGwShell(e.d * 1e6);
  go({ id: 'gw:' + e.name, name: e.name, kind: 'view', kindLabel: 'Onda gravitacional', gw: e, pos: () => [0, 0, 0], radius: 0, viewDist: e.d * 1e6 * 2.8, arriveDir: v3.norm([0.3, -0.5, 0.8]) });
}

// ---------------------------------------------------------------- explosões recentes (TNS)
export const SN = { list: null, failed: false };
const sexa = (s, h) => { const [a, b, c] = s.split(':').map(Number); const sg = s.trim().startsWith('-') ? -1 : 1; return sg * (Math.abs(a) + b / 60 + c / 3600) * (h ? 15 : 1); };
function parseCSV(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift(); return rows.filter(r => r.length === h.length).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
export async function loadSn() {
  try {
    const end = new Date(), start = new Date(Date.now() - 30 * 864e5), d = x => x.toISOString().slice(0, 10);
    const url = 'https://www.wis-tns.org/search?' + new URLSearchParams({ format: 'csv', num_page: 200, classified_sne: 1, 'date_start[date]': d(start), 'date_end[date]': d(end) });
    const rows = parseCSV(await (await fetch(proxied(url), { signal: AbortSignal.timeout(40000) })).text());
    SN.list = rows.map(r => {
      const z = parseFloat(r.Redshift) || parseFloat(r['Host Redshift']) || null;
      return { name: r.Name, type: r['Obj. Type'], ra: sexa(r.RA, true), dec: sexa(r.DEC, false), z, host: r['Host Name'], mag: parseFloat(r['Discovery Mag/Flux']) || null, date: new Date(r['Discovery Date (UT)'].replace(' ', 'T') + 'Z') };
    }).filter(s => isFinite(s.ra) && s.type).sort((a, b) => b.date - a.date);
  } catch (err) { console.warn('TNS indisponível', err); SN.failed = true; }
}
export function snItems() {
  return (SN.list || []).map(s => ({
    label: `${s.name} · ${s.type}`,
    tip: `descoberta em ${s.date.toLocaleDateString('pt-BR')}${s.mag ? ` · magnitude ${fmtNum(s.mag, 1)}` : ''}${s.host ? `\nna galáxia ${s.host}` : ''}${s.z ? `\nz = ${s.z} (a ${fmtDist(comovingDistance(s.z))})` : '\nsem distância: abre no telescópio'}`,
    go: () => {
      const dist = s.z ? comovingDistance(s.z) : null;
      const t = simbadTarget({ oid: 'tns-' + s.name, name: s.name, mainId: s.name, ra: s.ra, dec: s.dec, otype: s.type, otypeLabel: `${s.type} descoberta em ${s.date.toLocaleDateString('pt-BR')}`, d: dist, z: s.z, xyz: radec2xyz(s.ra, s.dec, dist || 1e10), dSource: s.z ? `redshift z = ${s.z} (TNS)` : null, maj: 0.5 });
      if (dist) go(t); else { select(t); openScope(t); }
    },
  }));
}

// ---------------------------------------------------------------- pulsares
export function pulsarTarget(p) {
  return { id: 'psr:' + p.j, name: p.name || `PSR ${p.j}`, aka: p.name ? [`PSR ${p.j}`, p.b && `PSR ${p.b}`].filter(Boolean) : p.b ? [`PSR ${p.b}`] : [], kind: 'psr', psr: p, pos: () => p.xyz, radius: 0, viewDist: 0.3, kindLabel: 'Pulsar (estrela de nêutrons)' };
}
export function psrItems() {
  return P5.pulsars.filter(p => p.name).map(p => ({
    label: p.name,
    tip: `PSR ${p.j} · ${p.p < 1 ? `${fmtNum(1 / p.p, 0)} voltas por segundo` : `uma volta a cada ${fmtNum(p.p, 2)} s`} · a ${fmtDist(p.d)}`,
    go: () => go(pulsarTarget(p)),
  }));
}

// ---------------------------------------------------------------- estruturas
export function structTarget(s) {
  return { id: 'lss:' + s.name, name: s.name, kind: 'view', struct: s, kindLabel: s.kind === 'vazio' ? 'Vazio cósmico' : s.kind === 'superaglomerado' ? 'Superaglomerado de galáxias' : 'Estrutura do universo', pos: () => s.xyz, radius: s.r * 1e6, viewDist: Math.max(s.r * 3.2, 40) * 1e6, arriveDir: v3.norm([0.3, -0.4, 0.85]) };
}
export function lssItems() {
  return P5.structures.map(s => ({
    label: s.name,
    tip: `${s.kind} · a ${fmtDist(s.d * 1e6)} · ~${fmtNum(s.r * 2 * 3.26, 0)} milhões de anos-luz de diâmetro\n${s.desc || ''}`.trim(),
    go: () => go(structTarget(s)),
  }));
}
