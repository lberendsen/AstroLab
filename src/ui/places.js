// Lista de "Lugares legais" (painel da esquerda).
import * as search from '../search.js';
import { v3, gal2eq, GALACTIC_CENTER } from '../astro.js';
import { go } from './actions.js';
import { $ } from './dom.js';

const PLACES = [
  ['Sistema Solar', [['Terra'], ['Lua'], ['Sol'], ['Marte'], ['Júpiter'], ['Saturno'], ['Urano'], ['Netuno'], ['Plutão']]],
  ['Feito pelo homem', [['Estação Espacial Internacional (ISS)'], ['Estação Espacial Tiangong'], ['Telescópio Espacial Hubble'], ['Telescópio Espacial James Webb'],
    ['Voyager 1', 'o mais distante'], ['Voyager 2'], ['New Horizons'], ['Parker Solar Probe', 'o mais rápido'], ['Juno'],
    ['Apollo 11 (Base da Tranquilidade)'], ['Lunokhod 1'], ["Chang'e 4 e jipe Yutu-2 (lado oculto)"], ['Chandrayaan-3 (Vikram e Pragyan)'],
    ['Perseverance'], ['Curiosity'], ['Zhurong'], ['Venera 13'], ['Tesla Roadster de Elon Musk']]],
  ['Estrelas', [['Próxima Centauri', 'a mais próxima'], ['Alfa Centauri'], ['Sírius', 'a mais brilhante'], ['Betelgeuse', 'supergigante vermelha'], ['Rigel'], ['Estrela Polar'], ['Vega'], ['Antares']]],
  ['Mundos alienígenas', [['TRAPPIST-1 e', 'zona habitável'], ['Proxima Cen b'], ['Kepler-452 b', '"primo" da Terra'], ['TOI-700 d'], ['51 Peg b', 'primeiro em estrela tipo Sol'], ['HD 189733 b', 'chove vidro'], ['55 Cnc e', 'oceano de lava'], ['WASP-12 b', 'sendo devorado']]],
  ['Nebulosas', [['M 42'], ['M 16'], ['NGC 3372'], ['IC 434'], ['M 57'], ['NGC 7293'], ['NGC 3132'], ['M 1'], ['NGC 2070']]],
  ['Aglomerados', [['M 45'], ['NGC 5139'], ['NGC 104'], ['M 13'], ['NGC 4755']]],
  ['Nossa galáxia', [['Sgr A*', 'buraco negro central'], ['@milkyway', 'Via Láctea vista de fora']]],
  ['Galáxias', [['LMC'], ['M 31'], ['M 33'], ['M 51'], ['M 81'], ['M 82'], ['M 104'], ['NGC 5128'], ['M 87'], ['NGC 4038'], ['ESO 350-40'], ['NGC 1300']]],
  ['Universo profundo', [['NGC 7319'], ['NGC 4889'], ['NGC 6505'], ['3C 273'], ['SMACS J0723.3-7327'], ['Abell 2744'], ['@web', 'A teia cósmica (2MRS)']]],
  ['Até a borda do universo', [['TON 618'], ['APM 08279+5255'], ['ULAS J1342+0928'], ['J0313-1806'], ['GN-z11'], ['JADES-GS-z14-0'], ['MoM-z14'],
    ['@qso', '750 mil quasares'], ['@cmb', 'radiação cósmica de fundo']]],
];

// Vistas especiais (não são objetos do catálogo)
export function resolvePlace(q) {
  if (q === '@milkyway') {
    // chega por cima do disco, inclinado, com o lado do Sol à frente
    const arriveDir = v3.norm(v3.add(v3.scale(gal2eq([0, 0, 1]), 0.8), v3.scale(gal2eq([-1, 0, 0]), 0.6)));
    return { id: 'v:mw', name: 'Via Láctea', kind: 'view', kindLabel: 'Nossa galáxia (modelo)', pos: () => GALACTIC_CENTER, radius: 15000, viewDist: 55000, arriveDir };
  }
  if (q === '@qso') return { id: 'v:qso', name: 'Mapa dos quasares (SDSS)', kind: 'view', kindLabel: 'Universo distante', pos: () => [0, 0, 0], radius: 0, viewDist: 2.6e10, arriveDir: v3.norm([-0.5, 0.35, 0.8]) };
  if (q === '@cmb') return { id: 'v:cmb', name: 'Borda do universo observável', kind: 'view', kindLabel: 'Radiação cósmica de fundo (Planck)', pos: () => [0, 0, 0], radius: 0, viewDist: 4.2e10 };
  if (q === '@web') return { id: 'v:web', name: 'Teia cósmica (2MRS) — a Via Láctea está no centro', kind: 'view', kindLabel: 'Estrutura em grande escala', pos: () => [0, 0, 0], radius: 0, viewDist: 9e8 };
  const r = search.searchLocal(q, 1)[0];
  return r ? r.make() : null;
}

export function buildPlaces() {
  const box = $('placeList');
  for (const [cat, items] of PLACES) {
    box.insertAdjacentHTML('beforeend', `<div class="cat">${cat}</div>`);
    for (const [q, hint] of items) {
      const t = resolvePlace(q);
      if (!t) continue;
      const b = document.createElement('button');
      b.innerHTML = `${t.name}${hint ? `<small>${hint}</small>` : ''}`;
      b.onclick = () => { go(t); };
      box.appendChild(b);
    }
  }
}
