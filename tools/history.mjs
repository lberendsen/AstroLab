// Trajetórias históricas (JPL Horizons), para os replays de missões. Gera data/history.json + data/history.bin.
// Cada nave tem trechos (segs): centro, intervalo e passo. Trechos curtos e finos cobrem as passagens perto de planetas,
// onde a trajetória dobra em poucas horas (com um passo de dias, a curva do estilingue sairia errada).
// Uso: node tools/build-data.mjs history
import fs from 'node:fs';
import path from 'node:path';

const CENTER = { Sun: '500@10', Earth: '500@399', Moon: '500@301', Venus: '500@299', Mars: '500@499', Jupiter: '500@599', Saturn: '500@699', Uranus: '500@799', Neptune: '500@899', Pluto: '500@999' };
const seg = (center, start, stop, step) => ({ center, start, stop, step });

// Naves que já existem no catálogo (tools/spacecraft.mjs) ganham o histórico; as outras são criadas aqui.
export const HISTORY = [
  { id: 'voyager1', hz: '-31', segs: [
    seg('Earth', '1977-09-05 14:05', '1977-09-25', '1 h'),
    seg('Sun', '1977-09-06', '2026-10-01', '5 d'),
    seg('Jupiter', '1979-02-28', '1979-03-12', '30 m'),
    seg('Saturn', '1980-11-08', '1980-11-17', '30 m'),
  ] },
  { id: 'voyager2', hz: '-32', segs: [
    seg('Earth', '1977-08-20 15:40', '1977-09-10', '1 h'),
    seg('Sun', '1977-08-21', '2026-10-01', '5 d'),
    seg('Jupiter', '1979-07-03', '1979-07-15', '30 m'),
    seg('Saturn', '1981-08-21', '1981-08-31', '30 m'),
    seg('Uranus', '1986-01-20', '1986-01-29', '20 m'),
    seg('Neptune', '1989-08-21', '1989-08-30', '15 m'),
  ] },
  { id: 'newhorizons', hz: '-98', segs: [
    seg('Earth', '2006-01-19 20:00', '2006-02-03', '1 h'),
    seg('Sun', '2006-01-20', '2026-10-01', '2 d'),
    seg('Jupiter', '2007-02-24', '2007-03-05', '30 m'),
    seg('Pluto', '2015-07-10', '2015-07-19', '10 m'),
  ] },
  { id: 'cassini', hz: '-82', name: 'Cassini', model: 'cassini', size: 7, country: 'EUA + Europa (ESA) + Itália', launch: 1997, status: 'mergulhou em Saturno em 2017', center: 'Sun', end: 'stop',
    desc: 'Orbitou Saturno por 13 anos e levou a sonda europeia Huygens, que pousou em Titã. Terminou mergulhando em Saturno de propósito, para não contaminar luas que podem ter vida.',
    segs: [
      seg('Sun', '1997-10-16', '2004-07-01', '1 d'),
      seg('Venus', '1998-04-24', '1998-04-28', '20 m'),
      seg('Venus', '1999-06-22', '1999-06-26', '20 m'),
      seg('Earth', '1999-08-16', '1999-08-20', '10 m'),
      seg('Saturn', '2004-06-20', '2017-09-15 10:00', '3 h'),
      seg('Saturn', '2017-04-20', '2017-09-15 10:30', '10 m'),
    ] },
  { id: 'galileo', hz: '-77', name: 'Galileo', model: 'sat', size: 11, country: 'EUA', launch: 1989, status: 'mergulhou em Júpiter em 2003', center: 'Sun', end: 'stop',
    desc: 'A primeira nave a orbitar Júpiter. Lançou uma sonda dentro da atmosfera do planeta e descobriu sinais do oceano de Europa.',
    segs: [
      seg('Sun', '1989-10-19 02:00', '1995-12-01', '1 d'),
      seg('Venus', '1990-02-08', '1990-02-12', '20 m'),
      seg('Earth', '1990-12-06', '1990-12-10', '10 m'),
      seg('Earth', '1992-12-06', '1992-12-10', '10 m'),
      seg('Jupiter', '1995-11-15', '2003-09-21 18:00', '3 h'),
    ] },
  { id: 'rosetta', hz: '-226', name: 'Rosetta', model: 'sat', size: 32, country: 'Europa (ESA)', launch: 2004, status: 'pousou no cometa em 2016', center: 'Sun', end: 'stop',
    desc: 'A primeira nave a orbitar um cometa e a primeira a pousar um robô nele (Philae, 2014). Terminou pousando no próprio cometa.',
    segs: [
      seg('Sun', '2004-03-03', '2016-09-30 10:00', '1 d'),
      seg('Earth', '2005-03-02', '2005-03-06', '10 m'),
      seg('Mars', '2007-02-23', '2007-02-27', '10 m'),
      seg('Earth', '2007-11-11', '2007-11-15', '10 m'),
      seg('Earth', '2009-11-11', '2009-11-15', '10 m'),
      seg('Sun', '2014-07-01', '2016-09-30 10:00', '1 h'),
    ] },
  // o cometa 67P precisa da trajetória real (a órbita média erra por milhares de km, e a Rosetta voava a dezenas de km dele)
  { id: 'c67p', hz: 'DES=67P;CAP<2017;NOFRAG;', name: 'Cometa 67P/Churyumov–Gerasimenko', natural: true, model: 'comet67p', size: 4100, country: '—', launch: 2014, status: 'cometa',
    desc: 'O cometa em forma de pato de borracha estudado pela Rosetta e pelo robô Philae.', center: 'Sun', end: 'stop',
    segs: [seg('Sun', '2014-07-01', '2016-09-30 12:00', '1 h')] },
  { id: 'apollo11', hz: '-399110', name: 'Apollo 11', model: 'apollo-stack', size: 25, country: 'EUA', launch: 1969, status: 'missão concluída em 24/07/1969', center: 'Earth', end: 'stop',
    desc: 'Neil Armstrong, Buzz Aldrin e Michael Collins. A trajetória até a Lua é a do terceiro estágio do Saturno V (S-IVB), registrada pelo JPL, que seguiu junto com a nave até o dia 17. Em órbita da Lua, a posição é a de uma órbita de 110 km (a órbita real da Columbia).',
    segs: [seg('Earth', '1969-07-16 16:45', '1969-07-19 17:00', '5 m')],
    // trecho calculado: órbita circular em volta da Lua entre a inserção (LOI) e a partida (TEI)
    circ: [{ center: 'Moon', start: '1969-07-19T17:22Z', stop: '1969-07-22T04:56Z', altKm: 110, incDeg: 178.8, periodMin: 118 }] },
  { id: 'artemis1', hz: '-1023', name: 'Artemis I (Orion)', model: 'orion', size: 14, country: 'EUA + Europa (ESA)', launch: 2022, status: 'missão concluída em 11/12/2022', center: 'Earth', end: 'stop',
    desc: 'Voo de teste sem tripulação da cápsula Orion. Chegou a 432 mil km da Terra, mais longe que qualquer nave feita para pessoas.',
    segs: [seg('Earth', '2022-11-16 08:50', '2022-12-11 17:20', '10 m')] },
  { id: 'artemis2', hz: '-1024', name: 'Artemis II (Orion)', model: 'orion', size: 14, country: 'EUA + Canadá + Europa (ESA)', launch: 2026, status: 'missão concluída em 10/04/2026', center: 'Earth', end: 'stop',
    desc: 'A primeira viagem de pessoas para perto da Lua desde 1972: Reid Wiseman, Victor Glover, Christina Koch e Jeremy Hansen deram a volta na Lua e voltaram.',
    segs: [seg('Earth', '2026-04-02 02:00', '2026-04-10 23:50', '5 m')] },
];

async function horizons(cmd, center, start, stop, step) {
  const p = new URLSearchParams({
    format: 'json', COMMAND: `'${cmd}'`, EPHEM_TYPE: 'VECTORS', CENTER: `'${center}'`, START_TIME: `'${start}'`, STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`, REF_PLANE: 'FRAME', REF_SYSTEM: 'ICRF', VEC_TABLE: '2', OUT_UNITS: 'KM-S', CSV_FORMAT: 'YES', OBJ_DATA: 'NO', VEC_LABELS: 'NO',
  });
  for (let tries = 0; tries < 3; tries++) {
    try {
      const j = await (await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + p, { signal: AbortSignal.timeout(120000) })).json();
      return j.result || j.error || '';
    } catch (e) { if (tries === 2) throw e; await new Promise(r => setTimeout(r, 3000)); }
  }
}

export async function buildHistory(DATA, RAW) {
  const out = [], chunks = [];
  let offset = 0;
  for (const h of HISTORY) {
    const meta = { ...h, segs: [] };
    delete meta.hz;
    for (const s of h.segs) {
      const cache = path.join(RAW, `hz-${h.id}-${s.center}-${s.start.replace(/\W/g, '')}-${s.step.replace(/\W/g, '')}.txt`);
      let res = fs.existsSync(cache) ? fs.readFileSync(cache, 'utf8') : null;
      if (!res) { res = await horizons(h.hz, CENTER[s.center], s.start, s.stop, s.step); fs.writeFileSync(cache, res); }
      const soe = res.indexOf('$$SOE'), eoe = res.indexOf('$$EOE');
      if (soe < 0) { console.warn(`  ${h.id} ${s.center} ${s.start}: ${res.split('\n').find(l => /error|no ephemeris|cannot|prior|after/i.test(l)) || res.slice(0, 160)}`); continue; }
      const rows = res.slice(soe + 5, eoe).trim().split('\n').map(l => l.split(',').map(x => x.trim()));
      const arr = new Float64Array(rows.length * 6);
      rows.forEach((r, i) => arr.set(r.slice(2, 8).map(Number), i * 6));
      chunks.push(arr);
      meta.segs.push({ center: s.center, jd0: +rows[0][0], dt: (+rows[1][0] - +rows[0][0]) * 86400, n: rows.length, offset });
      offset += arr.length;
    }
    console.log(`  ${h.id.padEnd(12)} ${meta.segs.length}/${h.segs.length} trechos, ${meta.segs.reduce((a, s) => a + s.n, 0).toLocaleString('pt-BR')} amostras`);
    out.push(meta);
  }
  const all = new Float64Array(offset);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  fs.writeFileSync(path.join(DATA, 'history.bin'), Buffer.from(all.buffer));
  fs.writeFileSync(path.join(DATA, 'history.json'), JSON.stringify(out));
  console.log(`histórico: ${out.length} naves, ${(all.byteLength / 1048576).toFixed(1)} MB`);
}
