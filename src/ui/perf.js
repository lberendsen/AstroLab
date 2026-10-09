// Painel de desempenho (tecla F3): quadros por segundo, tempo de CPU de cada etapa do quadro e o que a GPU desenhou.
// Fechado, não mede nada: perf.time() só chama a função.
import { renderer } from '../engine.js';

const stats = new Map();   // etapa -> média móvel em ms
let lastFrameEnd = 0;
let enabled = false, el = null, lastShow = 0, frames = 0, fpsT0 = performance.now(), fps = 0, frameMs = 0, worst = 0;
const EMA = 0.08;

// ?debug na URL: registra no console os quadros lentos (> 300 ms) e as etapas que pesaram
const DEBUG = new URLSearchParams(location.search).has('debug');
let slowParts = [];
export const perf = {
  get enabled() { return enabled; },
  time(name, fn) {
    if (DEBUG) { const t = performance.now(); const r = fn(); const dt = performance.now() - t; if (dt > 50) slowParts.push(`${name} ${dt | 0} ms`); if (!enabled) return r; stats.set(name, (stats.get(name) ?? dt) * (1 - EMA) + dt * EMA); return r; }
    if (!enabled) return fn();
    const t = performance.now();
    const r = fn();
    const dt = performance.now() - t;
    stats.set(name, (stats.get(name) ?? dt) * (1 - EMA) + dt * EMA);
    return r;
  },
  // chamado no fim de cada quadro com o tempo total de CPU do quadro
  frame(ms) {
    frames++;
    if (DEBUG) {
      const now = performance.now();
      if (lastFrameEnd && now - lastFrameEnd > 300) console.warn(`[lento] intervalo entre quadros ${(now - lastFrameEnd) | 0} ms; neste quadro: ${slowParts.join(', ') || 'nada > 50 ms'}`);
      lastFrameEnd = now; slowParts = [];
    }
    if (!enabled) return;
    frameMs = frameMs * (1 - EMA) + ms * EMA;
    worst = Math.max(worst, ms);
    const now = performance.now();
    if (now - fpsT0 >= 1000) { fps = frames * 1000 / (now - fpsT0); frames = 0; fpsT0 = now; }
    if (now - lastShow > 250) { lastShow = now; show(); worst *= 0.5; }
  },
  toggle() {
    enabled = !enabled;
    if (!el) { el = document.createElement('div'); el.id = 'perf'; document.getElementById('stage').appendChild(el); }
    el.hidden = !enabled;
    stats.clear(); frameMs = 0; worst = 0; frames = 0; fpsT0 = performance.now();
    if (enabled) el.textContent = 'medindo…';
  },
};

const fmt = (x, d = 1) => x.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d });
function show() {
  const info = renderer.info;
  const rows = [...stats.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(r => r[1]));
  const mem = performance.memory ? `${fmt(performance.memory.usedJSHeapSize / 1048576, 0)} MB de memória JS` : '';
  const budget = 1000 / 60;
  el.innerHTML =
    `<div class="head"><b class="${fps < 30 ? 'bad' : fps < 55 ? 'warn' : 'ok'}">${fmt(fps, 0)} fps</b> · CPU ${fmt(frameMs)} ms/quadro (pior ${fmt(worst)} ms)</div>` +
    `<div class="gpu">${info.render.calls} chamadas de desenho · ${fmt(info.render.points / 1e3, 0)} mil pontos · ${fmt(info.render.triangles / 1e3, 0)} mil triângulos · ${info.memory.textures} texturas</div>` +
    rows.map(([k, v]) => `<div class="r"><span>${k}</span><i style="width:${(v / max * 100).toFixed(0)}%;${v > budget / 4 ? 'background:#ff8a5c' : ''}"></i><em>${fmt(v, 2)} ms</em></div>`).join('') +
    `<div class="foot">${mem}${mem ? ' · ' : ''}orçamento para 60 fps: ${fmt(budget)} ms · F3 fecha</div>`;
}
