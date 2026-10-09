// Relógio da simulação: instante simulado e velocidade do tempo.
import { F } from './engine.js';

export const RATES = [-31557600, -2592000, -604800, -86400, -3600, -60, -1, 1, 60, 3600, 86400, 604800, 2592000, 31557600];
const REAL_TIME = RATES.indexOf(1);
export const clock = { rateIdx: REAL_TIME, paused: false };

export function advance(dt) {
  if (!clock.paused) F.date = new Date(F.date.getTime() + dt * 1000 * RATES[clock.rateIdx]);
}
export const slower = () => { clock.rateIdx = Math.max(clock.rateIdx - 1, 0); clock.paused = false; };
export const faster = () => { clock.rateIdx = Math.min(clock.rateIdx + 1, RATES.length - 1); clock.paused = false; };
export const togglePause = () => { clock.paused = !clock.paused; };
export const now = () => { F.date = new Date(); clock.rateIdx = REAL_TIME; clock.paused = false; };

export function rateLabel() {
  if (clock.paused) return 'pausado';
  const r = RATES[clock.rateIdx];
  const map = { 1: 'tempo real', 60: '1 min/s', 3600: '1 hora/s', 86400: '1 dia/s', 604800: '1 semana/s', 2592000: '1 mês/s', 31557600: '1 ano/s' };
  const base = map[Math.abs(r)] || `${Math.abs(r)}×`;
  return r < 0 ? `◀ ${base} para trás` : base;
}
