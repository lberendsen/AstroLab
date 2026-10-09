// Caixa de busca do painel de lugares: filtra a árvore enquanto se digita e, abaixo dela, procura no catálogo
// inteiro (índice local com milhões de objetos e, como último item, o SIMBAD, com o resto do céu catalogado).
import * as search from '../search.js';
import { fmtDist } from '../astro.js';
import { go, select, pointAt } from './actions.js';
import { filterTree, toggleSide, sideOpen } from './places.js';
import { $, toast } from './dom.js';

export const input = $('search');
const sug = $('suggest');
let sugItems = [], sugSel = 0, simbadSeq = 0;

function renderSuggest() {
  sug.innerHTML = sugItems.map((r, i) => `<li class="${i === sugSel ? 'sel' : ''}" data-i="${i}"><span>${r.label}</span><small>${r.sub}</small></li>`).join('');
  $('catalog').hidden = !sugItems.length;
}

async function choose(r) {
  if (!r) return;
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
  go(r.make());
}

function update() {
  const q = input.value.trim();
  const hits = filterTree(q);
  // no catálogo: o que a árvore não mostrou (até 12), e o SIMBAD por último
  const inTree = new Set(hits.map(n => n.label));
  sugItems = q ? search.searchLocal(q, 20).filter(r => !inTree.has(r.label)).slice(0, 12) : [];
  if (q.length >= 2) sugItems.push({ label: `Procurar “${q}” no SIMBAD`, sub: 'bilhões de objetos catalogados', simbad: q });
  sugSel = 0;
  renderSuggest();
}

export function wireSearch() {
  input.addEventListener('input', update);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sugSel = Math.min(sugSel + 1, sugItems.length - 1); renderSuggest(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sugSel = Math.max(sugSel - 1, 0); renderSuggest(); e.preventDefault(); }
    else if (e.key === 'Enter') { choose(sugItems[sugSel]); }
    else if (e.key === 'Escape') { input.value = ''; update(); input.blur(); }
  });
  sug.addEventListener('mousedown', e => {
    const li = e.target.closest('li');
    if (li) { e.preventDefault(); choose(sugItems[+li.dataset.i]); }
  });
}

// atalho "/": abre o painel, se estiver recolhido, e põe o foco na busca
export function focusSearch() {
  if (!sideOpen()) toggleSide(true);
  input.focus(); input.select();
}
