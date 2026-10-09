// Modelos simplificados de naves, em metros e na escala real. Não são réplicas: dão a forma e o tamanho.
// Convenção: +Y é o eixo principal (antena para a Terra, "para cima" no solo).
import * as THREE from 'three';

const M = {
  gold: new THREE.MeshPhongMaterial({ color: 0xc9a046, specular: 0x886622, shininess: 40 }),
  white: new THREE.MeshPhongMaterial({ color: 0xe6e6e6, specular: 0x444444, shininess: 20 }),
  grey: new THREE.MeshPhongMaterial({ color: 0x8a8d94, specular: 0x333333, shininess: 30 }),
  dark: new THREE.MeshPhongMaterial({ color: 0x2b2d33, shininess: 10 }),
  panel: new THREE.MeshPhongMaterial({ color: 0x1d2f6e, specular: 0x6688ff, shininess: 60, side: THREE.DoubleSide }),
  orangePanel: new THREE.MeshPhongMaterial({ color: 0x9c6a2a, specular: 0x553311, shininess: 40, side: THREE.DoubleSide }),
  shield: new THREE.MeshPhongMaterial({ color: 0xc8b9d8, specular: 0xffffff, shininess: 80, side: THREE.DoubleSide }),
  mirror: new THREE.MeshPhongMaterial({ color: 0xffc940, specular: 0xffffff, shininess: 120, side: THREE.DoubleSide }),
  red: new THREE.MeshPhongMaterial({ color: 0xc0141c, specular: 0xffffff, shininess: 90 }),
  black: new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 30 }),
};

const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const cyl = (r, h, m, x = 0, y = 0, z = 0, seg = 24, r2 = r) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), m); o.position.set(x, y, z); return o; };
const rotZ = (o, a) => { o.rotation.z = a; return o; };
const rotX = (o, a) => { o.rotation.x = a; return o; };
function dish(r, depth, m) {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const x = r * i / 16; pts.push(new THREE.Vector2(x, depth * (x / r) ** 2)); }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 40), m);
}
const g = (...kids) => { const o = new THREE.Group(); o.add(...kids); return o; };

const BUILD = {
  voyager() { // antena de 3,7 m, barramento decagonal, braço do magnetômetro de 13 m, RTGs
    const d = dish(1.85, 0.45, M.white); d.position.y = 0.6;
    return g(d, cyl(0.9, 0.45, M.gold, 0, 0.1, 0, 10), rotZ(cyl(0.02, 13, M.grey, 6.5, 0, 0, 6), Math.PI / 2),
      rotZ(cyl(0.03, 3, M.grey, -1.8, -0.2, 0, 6), Math.PI / 2.4), cyl(0.2, 1.4, M.dark, -3.2, -0.8, 0),
      rotX(cyl(0.03, 2.5, M.grey, 0, -0.3, 1.6, 6), Math.PI / 2.2), box(0.4, 0.4, 0.4, M.grey, 0, -0.3, 2.8), cyl(0.15, 0.02, M.gold, 0.6, 0.25, 0.6));
  },
  pioneer() {
    const d = dish(1.37, 0.4, M.white); d.position.y = 0.4;
    return g(d, cyl(0.7, 0.36, M.gold, 0, 0, 0, 6), rotZ(cyl(0.03, 3, M.grey, 1.8, 0, 0, 6), Math.PI / 2), cyl(0.2, 0.6, M.dark, 3.2, 0, 0), rotZ(cyl(0.03, 3, M.grey, -1.8, 0, 0, 6), Math.PI / 2), cyl(0.2, 0.6, M.dark, -3.2, 0, 0));
  },
  probe() { // New Horizons
    const d = dish(1.05, 0.3, M.white); d.position.y = 0.9;
    return g(d, cyl(1.0, 0.7, M.gold, 0, 0.3, 0, 3), cyl(0.21, 1.1, M.dark, 1.3, 0.2, 0));
  },
  parker() {
    const s = cyl(1.15, 0.12, M.white, 0, 1.4, 0, 32);
    return g(s, cyl(0.5, 1.4, M.gold, 0, 0.5, 0, 6), box(0.05, 0.8, 0.5, M.panel, 0.8, 0.3, 0), box(0.05, 0.8, 0.5, M.panel, -0.8, 0.3, 0));
  },
  sat(size = 10) { // barramento + duas asas de painel solar com a envergadura do objeto
    const span = Math.max(size, 3), bus = Math.max(size * 0.12, 1);
    const d = dish(bus * 0.45, bus * 0.12, M.white); d.position.y = bus * 0.6;
    return g(box(bus, bus, bus, M.gold), box(span / 2 - bus / 2, 0.04, bus * 0.9, M.panel, span / 4 + bus / 4, 0, 0), box(span / 2 - bus / 2, 0.04, bus * 0.9, M.panel, -span / 4 - bus / 4, 0, 0), d);
  },
  juno() {
    const wing = (a) => { const w = box(9, 0.05, 2.6, M.panel, 5.4, 0, 0); const p = g(w); p.rotation.y = a; return p; };
    const d = dish(1.25, 0.3, M.white); d.position.y = 1.2;
    return g(cyl(1.75, 1.6, M.dark, 0, 0, 0, 6), wing(0), wing(2.094), wing(4.189), d);
  },
  telescope(size = 6) {
    const L = size, r = size * 0.18;
    return g(cyl(r, L * 0.75, M.white, 0, 0, 0), box(L * 0.9, 0.04, r * 1.5, M.panel, 0, -L * 0.1, r * 1.4), cyl(r * 1.05, 0.05, M.dark, 0, L * 0.375, 0));
  },
  hubble() {
    const tube = cyl(2.1, 13.2, M.grey, 0, 0, 0, 32);
    const p1 = box(2.5, 7.1, 0.05, M.orangePanel, 4.4, 1, 0), p2 = box(2.5, 7.1, 0.05, M.orangePanel, -4.4, 1, 0);
    const door = cyl(2.15, 0.1, M.dark, 0, 6.65, 0, 32);
    return g(tube, p1, p2, door, cyl(2.3, 3, M.white, 0, -5, 0, 32));
  },
  jwst() { // escudo de 21 × 14 m em 5 camadas, espelho de 6,5 m com 18 hexágonos dourados
    const o = new THREE.Group();
    const kite = new THREE.Shape([new THREE.Vector2(-10.5, 0), new THREE.Vector2(0, -7), new THREE.Vector2(10.5, 0), new THREE.Vector2(0, 7)]);
    for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.ShapeGeometry(kite), M.shield); s.rotation.x = -Math.PI / 2; s.position.y = k * 0.25; s.scale.setScalar(1 - k * 0.04); o.add(s); }
    const hex = new THREE.CylinderGeometry(0.66, 0.66, 0.05, 6);
    const centers = [[0, 0]];
    for (let ring = 1; ring <= 2; ring++) for (let k = 0; k < 6 * ring; k++) {
      const a = Math.floor(k / ring) * Math.PI / 3, b = a + 2 * Math.PI / 3, t = k % ring;
      centers.push([ring * Math.cos(a) + t * Math.cos(b), ring * Math.sin(a) + t * Math.sin(b)]);
    }
    const mirror = new THREE.Group();
    for (const [x, y] of centers.slice(1)) { const h = new THREE.Mesh(hex, M.mirror); h.rotation.x = Math.PI / 2; h.position.set(x * 1.32 * 0.866 * 1.15, y * 1.32 * 0.866 * 1.15, 0); mirror.add(h); }
    mirror.position.set(0, 4.2, 0);
    o.add(mirror, cyl(0.04, 7.2, M.dark, 0, 4.2, 3.6, 6), box(1.6, 1.4, 1.6, M.dark, 0, -0.9, 0));
    o.children.at(-2).rotation.x = Math.PI / 2;
    return o;
  },
  station() { // ISS: treliça de 109 m, 8 asas solares de 35 × 12 m, módulos pressurizados
    const o = new THREE.Group();
    o.add(box(109, 1.8, 1.8, M.grey));
    for (const x of [-48, -33, 33, 48]) for (const z of [-1, 1]) o.add(box(11.6, 0.05, 35, M.orangePanel, x, 0, z * 19));
    for (const x of [-20, 20]) o.add(box(12, 0.05, 6, M.white, x, -2.5, 0));
    const mods = [[0, 0, -4, 9], [0, 0, 6, 8], [0, 0, 14, 9], [0, 0, -12, 12], [0, 0, -22, 13], [6, 0, 6, 7], [-6, 0, 6, 9]];
    for (const [x, y, z, L] of mods) { const c = cyl(2.1, L, M.white, x, y - 2, z); c.rotation.x = Math.PI / 2; if (x) c.rotation.set(0, 0, Math.PI / 2); o.add(c); }
    o.add(box(4, 0.05, 30, M.panel, 0, -2, -38)); // asas do segmento russo
    return o;
  },
  tiangong() { // módulo central Tianhe e laboratórios Wentian e Mengtian em T
    const o = new THREE.Group();
    const core = cyl(2.1, 16.6, M.white); core.rotation.x = Math.PI / 2; o.add(core);
    for (const s of [-1, 1]) { const lab = cyl(2.1, 17.9, M.white, s * 10, 0, 8.3); lab.rotation.z = Math.PI / 2; o.add(lab); o.add(box(55, 0.05, 4.2, M.panel, s * 10 + s * 0, 0, 8.3).translateY(3)); }
    o.add(box(4, 0.05, 25, M.panel, 0, 0, -4).translateX(3));
    return o;
  },
  rover() { // jipe tipo Curiosity/Perseverance: 3 m de comprimento, 6 rodas, mastro com câmeras
    const o = g(box(2.6, 0.9, 1.9, M.white, 0, 1.1, 0), box(0.9, 0.8, 1.5, M.grey, -1.4, 1.2, 0));
    for (const x of [-1.1, 0, 1.1]) for (const z of [-1.2, 1.2]) { const w = cyl(0.26, 0.4, M.dark, x, 0.26, z, 16); w.rotation.x = Math.PI / 2; o.add(w); }
    o.add(cyl(0.05, 1.3, M.grey, 1.0, 2.2, 0.6, 8), box(0.5, 0.25, 0.3, M.white, 1.0, 2.9, 0.6), cyl(0.05, 1.6, M.grey, 1.6, 1.5, -0.4, 6));
    o.children.at(-1).rotation.z = 0.8;
    return o;
  },
  heli() {
    const o = g(box(0.14, 0.14, 0.14, M.grey, 0, 0.45, 0), cyl(0.6, 0.01, M.dark, 0, 0.75, 0, 2), cyl(0.6, 0.01, M.dark, 0, 0.8, 0, 2), cyl(0.01, 0.4, M.grey, 0, 0.62, 0, 6), box(0.4, 0.01, 0.2, M.panel, 0, 0.84, 0));
    o.children[2].rotation.y = Math.PI / 2;
    for (const [x, z] of [[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]) { const l = cyl(0.008, 0.5, M.grey, x, 0.2, z, 4); l.rotation.set(z * 1.5, 0, -x * 1.5); o.add(l); }
    return o;
  },
  lander(size = 3) {
    const s = size / 3;
    const o = g(cyl(0.9 * s, 1.0 * s, M.gold, 0, 1.4 * s, 0, 8), box(2.4 * s, 0.04, 1 * s, M.panel, 0, 2.1 * s, 0), cyl(0.4 * s, 0.6 * s, M.white, 0, 2.3 * s, 0, 12));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const l = cyl(0.04 * s, 1.6 * s, M.grey, Math.cos(a) * 1.1 * s, 0.7 * s, Math.sin(a) * 1.1 * s, 6); l.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); o.add(l, cyl(0.2 * s, 0.05, M.grey, Math.cos(a) * 1.45 * s, 0.03, Math.sin(a) * 1.45 * s, 12)); }
    return o;
  },
  apollo() { // estágio de descida do módulo lunar (o que ficou na Lua), com a bandeira
    const o = g(cyl(2.1, 1.6, M.gold, 0, 1.5, 0, 8));
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      const l = cyl(0.07, 2.6, M.gold, Math.cos(a) * 2.6, 0.9, Math.sin(a) * 2.6, 6);
      l.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
      o.add(l, cyl(0.45, 0.08, M.gold, Math.cos(a) * 3.6, 0.04, Math.sin(a) * 3.6, 16));
    }
    o.add(cyl(0.02, 2.4, M.white, 5, 1.2, 1, 6), box(0.9, 0.6, 0.01, M.red, 5.45, 2.1, 1), box(0.35, 0.3, 0.012, M.panel, 5.18, 2.25, 1));
    return o;
  },
  lunokhod() {
    const o = g(cyl(1.1, 0.6, M.grey, 0, 0.9, 0, 24), cyl(1.15, 0.05, M.panel, 0, 1.25, 0, 24));
    for (const x of [-0.9, -0.3, 0.3, 0.9]) for (const z of [-0.95, 0.95]) { const w = cyl(0.25, 0.2, M.dark, x, 0.25, z, 12); w.rotation.x = Math.PI / 2; o.add(w); }
    return o;
  },
  venera() { return g(new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), M.white).translateY(1.2), cyl(1.0, 0.25, M.grey, 0, 0.15, 0, 24), cyl(1.0, 0.06, M.dark, 0, 2.1, 0, 24)); },
  cassini() { // corpo de 6,8 m, antena de 4 m, braço do magnetômetro de 11 m, sonda Huygens ao lado
    const d = dish(2, 0.5, M.white); d.position.y = 3.2;
    const o = g(cyl(0.9, 3, M.gold, 0, 1.2, 0, 12), cyl(0.5, 1.4, M.dark, 0, -0.9, 0, 12), d, rotZ(cyl(0.03, 11, M.grey, 5.5, 1.8, 0, 6), Math.PI / 2));
    const huy = cyl(1.35, 0.6, M.gold, 1.4, 0.8, 0, 24, 0.3); huy.rotation.z = -Math.PI / 2; o.add(huy);
    return o;
  },
  'apollo-stack'() { // módulo de comando e serviço (Columbia) acoplado ao módulo lunar (Eagle)
    const o = g(cyl(0.05, 3.2, M.white, 0, 6.5, 0, 24, 1.95), cyl(1.95, 7.5, M.grey, 0, 1.4, 0, 24), cyl(0.9, 2, M.dark, 0, -3.2, 0, 24, 1.3));
    const lm = BUILD.apollo(); lm.scale.setScalar(0.8); lm.rotation.z = Math.PI; lm.position.y = 11.5; o.add(lm);
    return o;
  },
  orion() { // cápsula de 5 m e módulo de serviço europeu com 4 asas solares em X (19 m)
    const o = g(cyl(0.6, 3.3, M.white, 0, 3.6, 0, 32, 2.5), cyl(2.05, 4, M.grey, 0, 0, 0, 32));
    for (let k = 0; k < 4; k++) { const w = box(7, 0.05, 2, M.panel, 5.5, 0, 0); const p = g(w); p.rotation.y = k * Math.PI / 2 + Math.PI / 4; o.add(p); }
    return o;
  },
  comet67p(size = 4100) { // duas "cabeças" grudadas (forma de pato), em metros
    const s = size / 4.1;
    const a = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), M.dark); a.scale.set(2.05 * s, 1.6 * s, 1.5 * s);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), M.dark); b.scale.set(1.3 * s, 1.15 * s, 1.05 * s); b.position.set(1.4 * s, 1.9 * s, 0.2 * s);
    return g(a, b);
  },
  roadster() {
    const o = g(box(3.9, 0.5, 1.8, M.red, 0, 0.6, 0), box(1.6, 0.4, 1.6, M.black, -0.3, 1.05, 0));
    for (const x of [-1.3, 1.3]) for (const z of [-0.9, 0.9]) { const w = cyl(0.33, 0.25, M.black, x, 0.33, z, 16); w.rotation.x = Math.PI / 2; o.add(w); }
    o.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), M.white).translateY(1.55).translateX(-0.1)); // Starman
    return o;
  },
};

export function makeModel(type, size) {
  const f = BUILD[type] || BUILD.sat;
  const o = f(size);
  o.traverse(m => { if (m.isMesh) m.frustumCulled = false; });
  return o;
}
