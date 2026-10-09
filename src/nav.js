// Controle da nave: orbitar um alvo, voar livre, e viagem automática em alta velocidade.
// A viagem interpola a distância ao alvo em escala logarítmica: atravessa milhões de anos-luz em segundos
// e desacelera suavemente na chegada.
import * as THREE from 'three';
import { F, camera } from './engine.js';
import { v3, PC_KM } from './astro.js';

export const nav = {
  mode: 'orbit',       // 'orbit' | 'free'
  target: null,        // alvo orbitado
  offset: new THREE.Vector3(0, 0, 1), // câmera - alvo (pc), em double
  flight: null,
  speed: 0,            // pc/s (para o painel)
  warp: 0,
  onArrive: null,
};

const keys = new Set();
let rotVel = [0, 0], fling = [0, 0], zoomVel = 0, dragging = false, last = [0, 0], moved = 0, lastMoveAt = 0;
const canvas = document.getElementById('view');

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();
const camAxis = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(camera.quaternion);

export function lookAtDir(dir, up = camAxis(0, 1, 0)) {
  _m.lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(...dir), up);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

export function setOrbit(t) {
  nav.target = t;
  nav.mode = 'orbit';
  const p = t.pos();
  nav.offset.set(F.cam[0] - p[0], F.cam[1] - p[1], F.cam[2] - p[2]);
  if (nav.offset.length() === 0) nav.offset.set(0, 0, t.viewDist || 1);
}

export function setMode(m) {
  nav.mode = m;
  if (m === 'orbit' && nav.target) setOrbit(nav.target);
}

const smoother = x => x * x * x * (x * (x * 6 - 15) + 10);

export function flyTo(t, { dist } = {}) {
  const T = t.pos();
  const rel = v3.sub(F.cam, T);
  const r0 = Math.max(v3.len(rel), 1e-16);
  const rf = Math.max(dist || t.viewDist || t.radius * 4 || 1, (t.radius || 0) * 1.3);
  let u0 = v3.scale(rel, 1 / r0);
  // chegada pelo lado iluminado, quando o alvo é iluminado pelo Sol (planetas e luas)
  let uf = u0;
  if (t.arriveDir) uf = typeof t.arriveDir === 'function' ? t.arriveDir() : t.arriveDir;
  else if (t.kind === 'planet' || t.kind === 'moon') {
    const toSun = v3.norm(v3.scale(T, -1));
    const side = v3.norm(v3.cross(toSun, [0, 0, 1]));
    uf = v3.norm(v3.add(v3.add(v3.scale(toSun, 0.75), v3.scale(side, 0.55)), [0, 0, 0.18]));
    // planeta com anéis: chega por cima do plano dos anéis, do lado iluminado
    const pole = t.body?.ring && t.body.pole;
    if (pole) uf = v3.norm(v3.add(v3.add(v3.scale(toSun, 0.7), v3.scale(side, 0.3)), v3.scale(pole, v3.dot(pole, toSun) >= 0 ? 0.6 : -0.6)));
  }
  const ratio = Math.abs(Math.log(r0 / rf));
  nav.flight = {
    t, start: [...F.cam], r0, rf, u0, uf, time: 0,
    turn: 0.7, dur: Math.min(Math.max(2.2 + 0.13 * ratio, 2.4), 9.5) + 0.7,
    q0: camera.quaternion.clone(),
  };
  nav.target = t;
}

function slerpVec(a, b, t) {
  const d = Math.min(Math.max(v3.dot(a, b), -1), 1);
  const th = Math.acos(d);
  if (th < 1e-6) return a;
  const s = Math.sin(th);
  return v3.add(v3.scale(a, Math.sin((1 - t) * th) / s), v3.scale(b, Math.sin(t * th) / s));
}

// Alvos na superfície de outro mundo: a câmera não entra no chão (mínimo de 1,7 m, altura de uma pessoa)
function keepAboveGround(t) {
  if (!t?.ground) return;
  const c = t.ground.center(), R = t.ground.radius + 0.0017 / PC_KM;
  const d = v3.dist(F.cam, c);
  if (d >= R) return;
  F.cam = v3.add(c, v3.scale(v3.sub(F.cam, c), R / d));
  const p = t.pos();
  nav.offset.set(F.cam[0] - p[0], F.cam[1] - p[1], F.cam[2] - p[2]);
}

function updateFlight(dt) {
  const f = nav.flight;
  f.time += dt;
  const T = f.t.pos();
  if (f.time < f.turn) {
    const k = smoother(f.time / f.turn);
    camera.quaternion.slerpQuaternions(f.q0, lookAtDir(v3.norm(v3.sub(T, F.cam))), k);
    nav.warp = 0;
    return;
  }
  const s = Math.min((f.time - f.turn) / (f.dur - f.turn), 1);
  const e = smoother(s);
  const lr = Math.log(f.r0) + (Math.log(f.rf) - Math.log(f.r0)) * e;
  // a direção de chegada se completa antes da aproximação final, para não atravessar o planeta
  const dir = slerpVec(f.u0, f.uf, smoother(Math.min(Math.max((s - 0.2) / 0.5, 0), 1)));
  const prev = [...F.cam];
  const r = Math.exp(lr);
  F.cam = v3.add(T, v3.scale(dir, r));
  keepAboveGround(f.t);
  // na superfície, o "para cima" da câmera é a vertical do lugar, para o horizonte ficar nivelado
  let up;
  const wantUp = f.t.ground ? f.t.ground.up() : f.t.arriveUp?.();
  if (wantUp) {
    const k = smoother(Math.min(Math.max((s - 0.4) / 0.4, 0), 1));
    up = camAxis(0, 1, 0).multiplyScalar(1 - k).add(new THREE.Vector3(...wantUp).multiplyScalar(k)).normalize();
  }
  // alvo de olhar diferente na chegada (ex.: parado atrás da Terra, olhando para o objeto)
  let look = v3.norm(v3.sub(T, F.cam));
  if (f.t.finalLook) {
    const k = smoother(Math.min(Math.max((s - 0.5) / 0.5, 0), 1));
    look = slerpVec(look, v3.norm(v3.sub(f.t.finalLook(), F.cam)), k);
  }
  camera.quaternion.copy(lookAtDir(look, up));
  nav.speed = v3.dist(prev, F.cam) / Math.max(dt, 1e-3);
  // intensidade do efeito de dobra: velocidade relativa à distância, em escala log
  const rate = Math.abs(Math.log(f.rf / f.r0)) * 30 * s * (1 - s) / (f.dur - f.turn);
  nav.warp = Math.min(1, rate / 6);
  if (s >= 1) {
    nav.flight = null; nav.warp = 0; nav.speed = 0;
    setOrbit(f.t);
    nav.onArrive?.(f.t);
  }
}

export function update(dt) {
  if (nav.flight) { updateFlight(dt); return; }
  // rotação com inércia
  const [rx, ry] = rotVel;
  if (Math.abs(rx) + Math.abs(ry) > 1e-5) {
    const up = camAxis(0, 1, 0), right = camAxis(1, 0, 0);
    if (nav.mode === 'orbit' && nav.target) {
      _q.setFromAxisAngle(up, -rx); _q2.setFromAxisAngle(right, -ry);
      _q.multiply(_q2);
      nav.offset.applyQuaternion(_q);
      camera.quaternion.premultiply(_q);
    } else {
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rx * 0.6);
      _q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ry * 0.6);
      camera.quaternion.multiply(_q).multiply(_q2);
    }
    if (dragging) { fling = [rx, ry]; rotVel = [0, 0]; }
    else { const decay = Math.pow(0.004, dt); rotVel = [rx * decay, ry * decay]; }
  }
  if (nav.mode === 'orbit' && nav.target) {
    const r = nav.offset.length();
    const R = nav.target.radius || 0;
    if (Math.abs(zoomVel) > 1e-5) {
      const minSurf = Math.max(R * 0.015, 0.004 / PC_KM); // até 4 m de objetos pequenos (naves, jipes)
      const surf = Math.max(r - R, minSurf);
      const ns = Math.max(surf * Math.exp(zoomVel * dt * 6), minSurf);
      nav.offset.setLength(R + ns);
      zoomVel *= Math.pow(0.002, dt);
    }
    const p = nav.target.pos();
    F.cam = [p[0] + nav.offset.x, p[1] + nav.offset.y, p[2] + nav.offset.z];
    keepAboveGround(nav.target);
    nav.speed = 0;
  } else {
    // voo livre
    const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 20 : 1;
    const v = Math.max(F.near, 1e-12) * 0.9 * boost;
    const mv = [0, 0, 0];
    if (keys.has('KeyW') || keys.has('ArrowUp')) mv[2] -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mv[2] += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mv[0] -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mv[0] += 1;
    if (keys.has('KeyR')) mv[1] += 1;
    if (keys.has('KeyF')) mv[1] -= 1;
    mv[2] += -zoomVel * 3; zoomVel *= Math.pow(0.01, dt);
    if (keys.has('KeyQ') || keys.has('KeyE')) {
      _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (keys.has('KeyQ') ? 1 : -1) * dt * 1.2);
      camera.quaternion.multiply(_q);
    }
    _v.set(...mv).applyQuaternion(camera.quaternion).multiplyScalar(v * dt);
    F.cam = [F.cam[0] + _v.x, F.cam[1] + _v.y, F.cam[2] + _v.z];
    nav.speed = _v.length() / Math.max(dt, 1e-3);
  }
}

// ---- entrada
canvas.addEventListener('pointerdown', e => {
  dragging = true; moved = 0; last = [e.clientX, e.clientY];
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - last[0], dy = e.clientY - last[1];
  last = [e.clientX, e.clientY];
  moved += Math.abs(dx) + Math.abs(dy);
  if (nav.flight) return;
  rotVel[0] += dx * 0.0042; rotVel[1] += dy * 0.0042;
  lastMoveAt = performance.now();
});
canvas.addEventListener('pointerup', e => {
  dragging = false;
  canvas.releasePointerCapture(e.pointerId);
  if (performance.now() - lastMoveAt < 60) rotVel = fling.map(v => v * 0.9); // inércia ao soltar
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (nav.flight) return;
  zoomVel += Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) / 100, 3) * 0.35;
}, { passive: false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

export const wasClick = () => moved < 5;
export function cancelFlight() { if (nav.flight) { nav.flight = null; nav.warp = 0; if (nav.target) setOrbit(nav.target); } }
