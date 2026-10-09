// Asteroides e cometas do JPL SBDB (Small-Body Database), compactados para o navegador.
//   data/ast-N.bin    elementos de 1,5 milhão de asteroides, em blocos por tamanho (os maiores primeiro):
//                     Float32 [a (UA), e, i, Ω, ω (rad, eclíptica J2000), M (rad na época de referência)] por asteroide
//   data/ast-N.meta   Uint8 [classe, H×8] por asteroide
//   data/ast-names.json  nomes e designações (os com nome, os próximos da Terra e os transnetunianos)
//   data/comets.json  os ~4 mil cometas;  data/smallbodies-famous.json  os famosos, com dados físicos
import fs from 'node:fs';
import path from 'node:path';
import { FAMOUS } from './smallbodies.mjs';

export const REF_EPOCH = 2461200.5; // a época padrão do SBDB em 2026 (JD TDB)
export const CLASSES = ['MBA', 'IMB', 'OMB', 'TJN', 'APO', 'ATE', 'AMO', 'IEO', 'MCA', 'CEN', 'TNO', 'AST', 'HYA', 'PAA'];
const TIERS = [100000, 500000, Infinity]; // tamanho acumulado de cada bloco
const GAUSS = 0.01720209895;               // constante gravitacional de Gauss (rad/dia, UA)
const D2R = Math.PI / 180;

async function getJSON(url, cacheFile, maxAgeDays = 30) {
  if (cacheFile && fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < maxAgeDays * 864e5) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  for (let tries = 0; ; tries++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!r.ok) throw new Error(`${r.status}`);
      const t = await r.text();
      if (cacheFile) fs.writeFileSync(cacheFile, t);
      return JSON.parse(t);
    } catch (e) {
      if (tries >= 3) throw new Error(`${e.message} em ${url.slice(0, 100)}`);
      await new Promise(r => setTimeout(r, 3000 * (tries + 1)));
    }
  }
}

const Q = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api?';

async function asteroids(DATA, RAW) {
  const PAGE = 100000, rows = [];
  for (let from = 0; ; from += PAGE) {
    const url = Q + new URLSearchParams({ fields: 'pdes,name,a,e,i,om,w,ma,epoch,H,class', 'sb-kind': 'a', limit: PAGE, 'limit-from': from });
    const j = await getJSON(url, path.join(RAW, `sb-a-${String(from / PAGE).padStart(2, '0')}.json`));
    rows.push(...j.data);
    process.stdout.write(`\r  asteroides: ${rows.length.toLocaleString('pt-BR')} de ${(+j.count).toLocaleString('pt-BR')}   `);
    if (j.data.length < PAGE) break;
  }
  console.log();
  const list = [];
  for (const [pdes, name, a, e, i, om, w, ma, epoch, H, cls] of rows) {
    const A = +a, E = +e;
    if (!(A > 0) || !(E < 1) || ma == null) continue; // hiperbólicos ficam de fora (os interestelares vêm da lista de famosos)
    const n = GAUSS / Math.pow(A, 1.5);
    let M = (+ma * D2R + n * (REF_EPOCH - +epoch)) % (2 * Math.PI);
    if (M < 0) M += 2 * Math.PI;
    const ci = CLASSES.indexOf(cls);
    list.push({ pdes, name, el: [A, E, +i * D2R, +om * D2R, +w * D2R, M], H: H == null ? 22 : +H, cls: ci >= 0 ? ci : CLASSES.indexOf('AST') });
  }
  list.sort((p, q) => p.H - q.H);
  const names = [];
  let start = 0;
  for (let t = 0; t < TIERS.length && start < list.length; t++) {
    const end = Math.min(TIERS[t], list.length);
    const el = new Float32Array((end - start) * 6), meta = new Uint8Array((end - start) * 2);
    for (let k = start; k < end; k++) {
      const o = list[k], j = k - start;
      el.set(o.el, j * 6);
      meta[j * 2] = o.cls;
      meta[j * 2 + 1] = Math.max(0, Math.min(255, Math.round(o.H * 8)));
      const c = CLASSES[o.cls];
      if (o.name || ['APO', 'ATE', 'AMO', 'IEO', 'TNO', 'CEN'].includes(c)) names.push(o.name ? [k, o.pdes, o.name] : [k, o.pdes]);
    }
    fs.writeFileSync(path.join(DATA, `ast-${t}.bin`), Buffer.from(el.buffer));
    fs.writeFileSync(path.join(DATA, `ast-${t}.meta`), Buffer.from(meta.buffer));
    console.log(`  bloco ${t}: ${(end - start).toLocaleString('pt-BR')} asteroides (H até ${list[end - 1].H}), ${(el.byteLength / 1048576).toFixed(1)} MB`);
    start = end;
  }
  fs.writeFileSync(path.join(DATA, 'ast-names.json'), JSON.stringify({ refEpoch: REF_EPOCH, classes: CLASSES, total: list.length, tiers: TIERS.map((t, i) => Math.min(t, list.length) - (i ? Math.min(TIERS[i - 1], list.length) : 0)), names }));
  console.log(`  nomes e designações: ${names.length.toLocaleString('pt-BR')}`);
}

async function comets(DATA, RAW) {
  const j = await getJSON(Q + new URLSearchParams({ fields: 'full_name,pdes,name,q,e,i,om,w,tp,epoch,class,M1,K1', 'sb-kind': 'c', limit: 10000 }), path.join(RAW, 'sb-c.json'));
  const out = j.data.filter(r => r[3] != null && r[8] != null).map(([full, pdes, name, q, e, i, om, w, tp, , cls, M1, K1]) =>
    [full.trim(), pdes, name, +q, +e, +i * D2R, +om * D2R, +w * D2R, +tp, cls, M1 == null ? null : +M1, K1 == null ? null : +K1]);
  fs.writeFileSync(path.join(DATA, 'comets.json'), JSON.stringify({ fields: ['full', 'pdes', 'name', 'q', 'e', 'i', 'om', 'w', 'tp', 'class', 'M1', 'K1'], comets: out }));
  console.log(`  cometas: ${out.length}`);
}

async function famous(DATA, RAW) {
  const out = [];
  for (const f of FAMOUS) {
    const safe = f.sstr.replace(/[^\w]/g, '_');
    let j;
    try { j = await getJSON('https://ssd-api.jpl.nasa.gov/sbdb.api?' + new URLSearchParams({ sstr: f.sstr, 'phys-par': 1, discovery: 1 }), path.join(RAW, `sbdb-${safe}.json`)); }
    catch (e) { console.warn('  não encontrado:', f.sstr, e.message); continue; }
    if (!j.orbit) { console.warn('  sem órbita:', f.sstr, JSON.stringify(j).slice(0, 120)); continue; }
    const el = Object.fromEntries(j.orbit.elements.map(x => [x.name, x.value == null ? null : +x.value]));
    const phys = Object.fromEntries((j.phys_par || []).map(x => [x.name, x.value]));
    out.push({
      ...f, full: j.object.fullname, kind: j.object.kind, cls: j.object.orbit_class?.code, clsName: j.object.orbit_class?.name, neo: j.object.neo, pha: j.object.pha,
      epoch: +j.orbit.epoch, e: el.e, q: el.q, a: el.a, i: el.i * D2R, om: el.om * D2R, w: el.w * D2R, tp: el.tp, ma: el.ma == null ? null : el.ma * D2R, per: el.per,
      H: phys.H != null ? +phys.H : null, diameter: phys.diameter != null ? +phys.diameter : null, albedo: phys.albedo != null ? +phys.albedo : null,
      rot: phys.rot_per != null ? +phys.rot_per : null, M1: phys.M1 != null ? +phys.M1 : null, K1: phys.K1 != null ? +phys.K1 : null,
      discovery: j.discovery ? { date: j.discovery.date, who: j.discovery.who, where: j.discovery.location } : null,
    });
  }
  fs.writeFileSync(path.join(DATA, 'smallbodies-famous.json'), JSON.stringify(out, null, 1));
  console.log(`  famosos: ${out.length}/${FAMOUS.length}`);
}

export async function buildSmallBodies(DATA, RAW) {
  await famous(DATA, RAW);
  await comets(DATA, RAW);
  await asteroids(DATA, RAW);
}
