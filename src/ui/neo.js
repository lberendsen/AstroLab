// Painel "Passando perto da Terra": as próximas aproximações de asteroides e cometas (JPL CAD API).
import { fetchSbdb } from '../layers/smallbodies.js';
import { sbTarget } from '../targets.js';
import { fmtNum } from '../astro.js';
import { go } from './actions.js';
import { $, toast } from './dom.js';

const LD_AU = 0.00256955529; // distância média Terra–Lua em UA
const proxied = u => '/proxy?u=' + encodeURIComponent(u);
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const cadDate = s => { const m = s.match(/(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})/); return m ? new Date(Date.UTC(+m[1], MON[m[2]], +m[3], +m[4], +m[5])) : null; };
const fmtWhen = d => d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const estSize = H => { const d = 1329 / Math.sqrt(0.14) * Math.pow(10, -H / 5) * 1000; return d < 1000 ? `~${fmtNum(d, 0)} m` : `~${fmtNum(d / 1000, 1)} km`; };

export async function openNeo() {
  $('places').hidden = true; $('btnPlaces').classList.remove('on');
  $('neoPanel').hidden = false;
  const body = $('neoBody');
  body.textContent = 'consultando o JPL…';
  try {
    const url = 'https://ssd-api.jpl.nasa.gov/cad.api?' + new URLSearchParams({ 'date-min': 'now', 'date-max': '+60', 'dist-max': '0.05', fullname: 'true', diameter: 'true', sort: 'date' });
    const j = await (await fetch(proxied(url), { signal: AbortSignal.timeout(25000) })).json();
    const f = Object.fromEntries(j.fields.map((k, i) => [k, i]));
    const rows = j.data.map(r => ({
      des: r[f.des], name: r[f.fullname].trim(), date: r[f.cd], ld: +r[f.dist] / LD_AU, v: +r[f.v_rel], H: +r[f.h], dia: r[f.diameter] ? +r[f.diameter] : null,
    }));
    const closest = rows.reduce((m, r) => (r.ld < m.ld ? r : m), rows[0]);
    body.innerHTML = `<p class="small">${rows.length} passagens a menos de 19,5 distâncias da Lua (0,05 UA) nos próximos 60 dias. A mais próxima: <b>${closest.name}</b>, a ${fmtNum(closest.ld, 2)} vezes a distância da Lua.</p>` +
      rows.map((r, i) => `<div class="neoRow ${r.ld < 1 ? 'inside' : ''}" data-i="${i}"><b>${r.name}</b><small>${fmtWhen(cadDate(r.date))} · ${fmtNum(r.ld, 2)} × distância da Lua (${fmtNum(r.ld * 384400, 0)} km) · ${fmtNum(r.v, 1)} km/s · ${r.dia ? `${fmtNum(r.dia, 2)} km` : estSize(r.H)}</small></div>`).join('') +
      `<p class="muted small">Fonte: JPL Close Approach Data. Os vermelhos passam mais perto que a Lua. Clique para ir até o asteroide (o JPL calcula a órbita na hora).</p>`;
    for (const el of body.querySelectorAll('.neoRow')) el.onclick = async () => {
      const r = rows[+el.dataset.i];
      toast(`Buscando a órbita de ${r.name} no JPL…`, 15000);
      try {
        const o = await fetchSbdb(r.des);
        if (!o) { toast('O JPL não devolveu a órbita deste objeto.'); return; }
        o.desc = `Passa a ${fmtNum(r.ld, 2)} vezes a distância da Lua em ${fmtWhen(cadDate(r.date))}, a ${fmtNum(r.v, 1)} km/s em relação à Terra.`;
        toast(`${r.name}: órbita carregada.`, 2500);
        go(sbTarget(o));
      } catch { toast('Falha ao consultar o JPL (sem internet?).'); }
    };
  } catch (e) { console.error(e); body.textContent = 'Não foi possível consultar o JPL agora.'; }
}
