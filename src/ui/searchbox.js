// Caixa de busca: sugestões do índice local e, como último item, a busca no SIMBAD.
import * as search from '../search.js';
import { fmtDist } from '../astro.js';
import { go, select, pointAt } from './actions.js';
import { $, toast } from './dom.js';

export const input = $('search');
const sug = $('suggest');
let sugItems = [], sugSel = 0, simbadSeq = 0;

function renderSuggest() {
  sug.innerHTML = sugItems.map((r, i) => `<li class="${i === sugSel ? 'sel' : ''}" data-i="${i}"><span>${r.label}</span><small>${r.sub}</small></li>`).join('');
  sug.hidden = !sugItems.length;
}

async function choose(r) {
  if (!r) return;
  sug.hidden = true; input.blur();
  if (r.simbad) {
    const seq = ++simbadSeq;
    toast(`Consultando o SIMBAD: “${r.simbad}”…`, 20000);
    try {
      const t = await search.searchSimbad(r.simbad);
      if (seq !== simbadSeq) return;
      if (!t) { toast(`O SIMBAD não conhece “${r.simbad}”.`); return; }
      toast(t.simbad.d ? `${t.simbad.mainId}: ${t.kindLabel}, a ${fmtDist(t.simbad.d)}` : `${t.simbad.mainId}: ${t.kindLabel} (sem distância medida)`);
      if (t.kind === 'sky') { select(t); pointAt(t); } else go(t);
    } catch (err) { toast('Falha ao consultar o SIMBAD (sem internet?).'); console.error(err); }
    return;
  }
  input.value = r.label;
  go(r.make());
}

export function wireSearch() {
  input.addEventListener('input', () => {
    const q = input.value.trim();
    sugItems = q ? search.searchLocal(q, 10) : [];
    if (q.length >= 2) sugItems.push({ label: `Procurar “${q}” no SIMBAD`, sub: 'todo o céu catalogado', simbad: q });
    sugSel = 0;
    renderSuggest();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sugSel = Math.min(sugSel + 1, sugItems.length - 1); renderSuggest(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sugSel = Math.max(sugSel - 1, 0); renderSuggest(); e.preventDefault(); }
    else if (e.key === 'Enter') { choose(sugItems[sugSel]); }
    else if (e.key === 'Escape') { sug.hidden = true; input.blur(); }
  });
  sug.addEventListener('mousedown', e => {
    const li = e.target.closest('li');
    if (li) { e.preventDefault(); choose(sugItems[+li.dataset.i]); }
  });
  input.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 150));
}
