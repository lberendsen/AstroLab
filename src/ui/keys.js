// Teclado, botões da barra e cliques no 3D.
import * as labels from '../labels.js';
import * as scope from '../telescope.js';
import * as linkMode from '../link.js';
import * as feeds from '../feeds.js';
import * as time from '../time.js';
import { nav, wasClick, cancelFlight } from '../nav.js';
import { ui, select, go, toggleMode, openScope, startLink, openFeeds } from './actions.js';
import { renderInfo } from './info.js';
import { toggleMassaroca } from './menus.js';
import { input } from './searchbox.js';
import { perf } from './perf.js';
import { $, toast } from './dom.js';

export function wireControls(onTimeChange) {
  // ---- barra de baixo
  $('btnPlaces').onclick = () => { $('places').hidden = !$('places').hidden; $('btnPlaces').classList.toggle('on', !$('places').hidden); };
  $('btnMode').onclick = toggleMode;
  $('btnScope').onclick = () => openScope(ui.selected);
  $('btnHelp').onclick = () => { $('help').hidden = !$('help').hidden; };
  $('btnFeeds').onclick = () => ($('feeds').hidden ? openFeeds() : ($('feeds').hidden = true));
  $('scopeClose').onclick = () => scope.close();
  $('dsnClose').onclick = () => feeds.closeDSN();
  $('tPause').onclick = () => { time.togglePause(); onTimeChange(); };
  $('tSlower').onclick = () => { time.slower(); onTimeChange(); };
  $('tFaster').onclick = () => { time.faster(); onTimeChange(); };
  $('tNow').onclick = () => { time.now(); onTimeChange(); };
  for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => { $(b.dataset.close).hidden = true; if (b.dataset.close === 'info') select(null); };

  // ---- painel "visto da Terra"
  $('lkSide').onclick = () => linkMode.sideBySide();
  $('lkEarth').onclick = () => linkMode.fromEarth();
  $('lkClose').onclick = () => linkMode.stop();
  $('lkLoc').onclick = () => linkMode.useMyLocation(ok => toast(ok ? 'Usando a sua localização.' : 'Não foi possível obter a localização (permissão negada?).'));

  // ---- cliques no 3D: um clique seleciona, duplo clique viaja
  const canvas = $('view');
  canvas.addEventListener('pointerup', e => {
    if (!wasClick() || e.button !== 0) return;
    const t = labels.pickAt(e.clientX, e.clientY);
    if (t) select(t);
  });
  canvas.addEventListener('dblclick', e => {
    const t = labels.pickAt(e.clientX, e.clientY);
    if (t) go(t);
  });
  labels.setOnPick((t, dbl) => (dbl ? go(t) : select(t)));
  nav.onArrive = t => { if (ui.selected?.id === t.id) renderInfo(t); };

  // ---- teclado
  addEventListener('keydown', e => {
    if (e.key === 'F3') { e.preventDefault(); perf.toggle(); return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (scope.isOpen()) { if (e.key === 'Escape') scope.close(); return; }
    if (!$('viewer').hidden) return; // o visualizador de imagens tem as próprias teclas
    switch (e.key) {
      case 'Tab': e.preventDefault(); toggleMode(); break;
      case '/': e.preventDefault(); input.focus(); input.select(); break;
      case 'g': case 'G': go(ui.selected); break;
      case 't': case 'T': openScope(ui.selected); break;
      case 'l': case 'L': $('btnPlaces').click(); break;
      case 'x': case 'X': $('btnFeeds').click(); break;
      case 'v': case 'V': linkMode.link.target ? linkMode.stop() : startLink(ui.selected); break;
      case 'm': case 'M': toggleMassaroca(); break;
      case 'h': case 'H': case '?': $('btnHelp').click(); break;
      case ' ': e.preventDefault(); $('tPause').click(); break;
      case ',': $('tSlower').click(); break;
      case '.': $('tFaster').click(); break;
      case 'Escape':
        if (nav.flight) cancelFlight();
        else if (linkMode.link.target) linkMode.stop();
        else { $('help').hidden = true; $('places').hidden = true; $('layers').hidden = true; $('feeds').hidden = true; }
        break;
    }
  });
}
