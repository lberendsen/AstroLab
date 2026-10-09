// Painel da direita: os controles globais da vista (camadas, tempo, telescópio) em seções que
// abrem e fecham clicando no título, como os painéis do Expression Design. Várias podem ficar abertas ao mesmo tempo.
// O painel inteiro também recolhe numa faixa estreita com os ícones das seções.
import { $ } from './dom.js';

// seções abertas valem só durante o uso: o app sempre abre com todas fechadas, para se ver o painel inteiro
const CTL = { open: {}, collapsed: false };
const RAIL = 44, WIDTH = 340;
const onOpen = {};   // seção → função chamada ao abrir (ex.: Tempo atualiza a data)

function save() { try { localStorage.setItem('astrolab.ctl', JSON.stringify({ collapsed: CTL.collapsed })); } catch { /* sem armazenamento */ } }
function apply() {
  document.documentElement.style.setProperty('--ctl-w', `${CTL.collapsed ? RAIL : WIDTH}px`);
  document.body.classList.toggle('ctl-collapsed', CTL.collapsed);
  for (const s of document.querySelectorAll('#ctl .sec')) s.classList.toggle('open', !!CTL.open[s.dataset.sec]);
  save();
}

// Abre uma seção (e o painel, se estiver recolhido) e a traz à vista; toggle = fecha se já estiver aberta
export function openSection(key, { toggle = false } = {}) {
  if (toggle && CTL.open[key] && !CTL.collapsed) { CTL.open[key] = false; apply(); return false; }
  CTL.open[key] = true; CTL.collapsed = false;
  apply();
  onOpen[key]?.();
  document.querySelector(`#ctl .sec[data-sec="${key}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
}
export const isSectionOpen = key => !CTL.collapsed && !!CTL.open[key];
export function onSectionOpen(key, fn) { onOpen[key] = fn; }

export function wireCtl() {
  try { CTL.collapsed = !!JSON.parse(localStorage.getItem('astrolab.ctl'))?.collapsed; } catch { /* sem armazenamento */ }
  apply();
  for (const h of document.querySelectorAll('#ctl .secHead')) h.onclick = () => {
    const key = h.parentElement.dataset.sec;
    CTL.open[key] = !CTL.open[key];
    apply();
    if (CTL.open[key]) onOpen[key]?.();
  };
  $('ctlToggle').onclick = () => { CTL.collapsed = true; apply(); };
  for (const b of document.querySelectorAll('#ctlRail [data-rail]')) b.onclick = () => openSection(b.dataset.rail);
}
