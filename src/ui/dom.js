// Atalhos de DOM compartilhados pela interface.
export const $ = id => document.getElementById(id);

let toastTimer;
export function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
