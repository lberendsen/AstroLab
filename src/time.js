// Relógio da simulação: instante simulado e velocidade do tempo.
import { F } from './engine.js';

const Y = 31557600; // segundos num ano juliano
export const RATES = [-1000 * Y, -100 * Y, -10 * Y, -Y, -2592000, -604800, -86400, -3600, -60, -1, 1, 60, 3600, 86400, 604800, 2592000, Y, 10 * Y, 100 * Y, 1000 * Y];
const REAL_TIME = RATES.indexOf(1);
// custom: velocidade livre (segundos simulados por segundo), usada pelos replays e eclipses
export const clock = { rateIdx: REAL_TIME, paused: false, custom: null };

export const rate = () => (clock.custom != null ? clock.custom : RATES[clock.rateIdx]);
export function advance(dt) {
  if (clock.paused) return;
  const t = F.date.getTime() + dt * 1000 * rate();
  // limite do objeto Date do JavaScript: ±270 mil anos
  F.date = new Date(Math.max(-8.5e15, Math.min(8.5e15, t)));
}
// ao sair de uma velocidade livre, continua da velocidade da lista mais parecida (mesmo sentido, mais perto em escala log)
function leaveCustom() {
  if (clock.custom == null) return;
  const r = clock.custom || 1, lr = Math.log(Math.abs(r));
  let best = REAL_TIME, bd = Infinity;
  RATES.forEach((x, i) => { const d = Math.abs(Math.log(Math.abs(x)) - lr); if (Math.sign(x) === Math.sign(r) && d < bd) { bd = d; best = i; } });
  clock.rateIdx = best; clock.custom = null;
}
export const slower = () => { leaveCustom(); clock.rateIdx = Math.max(clock.rateIdx - 1, 0); clock.paused = false; };
export const faster = () => { leaveCustom(); clock.rateIdx = Math.min(clock.rateIdx + 1, RATES.length - 1); clock.paused = false; };
export const togglePause = () => { clock.paused = !clock.paused; };
export const now = () => { F.date = new Date(); clock.rateIdx = REAL_TIME; clock.custom = null; clock.paused = false; };
export function setRate(secPerSec) { clock.custom = secPerSec; clock.paused = false; }
export function setDate(d) { F.date = new Date(d); }

export function rateLabel() {
  if (clock.paused) return 'pausado';
  const r = rate(), a = Math.abs(r);
  const map = { 1: 'tempo real', 60: '1 min/s', 3600: '1 hora/s', 86400: '1 dia/s', 604800: '1 semana/s', 2592000: '1 mês/s', [Y]: '1 ano/s', [10 * Y]: '10 anos/s', [100 * Y]: '100 anos/s', [1000 * Y]: '1.000 anos/s' };
  let base = map[a];
  if (!base) base = a < 3600 ? `${Math.round(a / 60)} min/s` : a < 86400 ? `${(a / 3600).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h/s` : a < Y ? `${(a / 86400).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias/s` : `${(a / Y).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} anos/s`;
  return r < 0 ? `◀ ${base} para trás` : base;
}

// Data para mostrar: normal entre os anos 1 e 9999; fora disso, só o ano (a.C./d.C.)
export function fmtDate(d = F.date, withTime = true) {
  const y = d.getUTCFullYear();
  if (y >= 1 && y <= 9999) return withTime ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString('pt-BR');
  const n = Math.abs(y <= 0 ? 1 - y : y).toLocaleString('pt-BR');
  return y <= 0 ? `ano ${n} a.C.` : `ano ${n}`;
}
// anos desde J2000 (época das posições das estrelas)
export const yearsSinceJ2000 = (d = F.date) => (d.getTime() - 946728000000) / (Y * 1000);
