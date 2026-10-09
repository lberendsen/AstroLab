// Trajetórias de naves pelo JPL Horizons: amostras de posição e velocidade (km, km/s) relativas ao corpo central,
// no referencial equatorial J2000 (ICRF). Gera data/spacecraft.json + data/spacecraft.bin (Float64).
import fs from 'node:fs';
import path from 'node:path';
import { PROBES, SURFACE } from './spacecraft.mjs';

const CENTER = { Sun: '500@10', Earth: '500@399', Moon: '500@301', Mars: '500@499', Jupiter: '500@599' };
const AU_KM = 149597870.7;
const iso = d => d.toISOString().slice(0, 10);

async function horizons(cmd, center, start, stop, step) {
  const p = new URLSearchParams({
    format: 'json', COMMAND: `'${cmd}'`, EPHEM_TYPE: 'VECTORS', CENTER: `'${center}'`, START_TIME: `'${start}'`, STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`, REF_PLANE: 'FRAME', REF_SYSTEM: 'ICRF', VEC_TABLE: '2', OUT_UNITS: 'KM-S', CSV_FORMAT: 'YES', OBJ_DATA: 'NO', VEC_LABELS: 'NO',
  });
  const r = await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + p);
  const j = await r.json();
  return j.result || j.error || '';
}

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const parseHzDate = s => { const m = s.match(/(\d{4})-([A-Z]{3})-(\d{2})/i); return m ? new Date(Date.UTC(+m[1], MONTHS[m[2].toUpperCase()], +m[3])) : null; };

async function fetchProbe(p) {
  const now = new Date();
  let start, stop;
  if (p.window) { start = new Date(now.getTime() + p.window[0] * 864e5); stop = new Date(now.getTime() + p.window[1] * 864e5); }
  else { start = new Date(Date.UTC(p.launch + 1, 0, 1)); stop = new Date(Date.UTC(2031, 0, 1)); }
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await horizons(p.hz, CENTER[p.center], iso(start), iso(stop), p.step);
    const soe = res.indexOf('$$SOE'), eoe = res.indexOf('$$EOE');
    if (soe >= 0) {
      const rows = res.slice(soe + 5, eoe).trim().split('\n').map(l => l.split(',').map(s => s.trim()));
      const jd = rows.map(r => +r[0]);
      const vals = rows.map(r => r.slice(2, 8).map(Number));
      return { jd0: jd[0], dt: (jd[1] - jd[0]) * 86400, n: rows.length, vals };
    }
    // ajusta o intervalo ao que o Horizons tem
    const before = res.match(/prior to A\.D\.\s*(\S+)/i), after = res.match(/after A\.D\.\s*(\S+)/i);
    let changed = false;
    if (before) { const d = parseHzDate(before[1]); if (d) { start = new Date(d.getTime() + 2 * 864e5); changed = true; } }
    if (after) { const d = parseHzDate(after[1]); if (d) { stop = new Date(d.getTime() - 864e5); changed = true; } }
    if (!changed || stop <= start) { console.warn(`  ${p.name}: ${res.split('\n').find(l => /error|no ephemeris|cannot/i.test(l)) || res.slice(0, 200)}`); return null; }
  }
  return null;
}

export async function buildSpacecraft(dataDir) {
  const index = [], chunks = [];
  let offset = 0;
  for (const p of PROBES) {
    const meta = { ...p };
    delete meta.hz;
    if (p.hz) {
      const eph = await fetchProbe(p);
      if (eph) {
        const arr = new Float64Array(eph.n * 6);
        eph.vals.forEach((v, i) => arr.set(v, i * 6));
        chunks.push(arr);
        meta.eph = { jd0: eph.jd0, dt: eph.dt, n: eph.n, offset };
        offset += arr.length;
        const last = eph.vals[eph.n - 1];
        console.log(`  ${p.name.padEnd(34)} ${eph.n} amostras, até ${(Math.hypot(last[0], last[1], last[2]) / (p.center === 'Sun' ? AU_KM : 1)).toFixed(p.center === 'Sun' ? 1 : 0)} ${p.center === 'Sun' ? 'UA' : 'km'} do centro`);
      } else meta.missing = true;
    }
    index.push(meta);
  }
  const all = new Float64Array(offset);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  fs.writeFileSync(path.join(dataDir, 'spacecraft.bin'), Buffer.from(all.buffer));
  fs.writeFileSync(path.join(dataDir, 'spacecraft.json'), JSON.stringify({ updated: new Date().toISOString(), probes: index, surface: SURFACE }));
  console.log(`naves: ${index.filter(p => p.eph).length} com efeméride, ${index.filter(p => p.approx).length} aproximadas, ${SURFACE.length} na superfície`);
}
