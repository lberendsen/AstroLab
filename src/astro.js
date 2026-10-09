// Constantes, conversões e formatação. Unidade de distância do mundo: parsec.
// Sistema de referência: equatorial J2000 (ICRS), X para RA=0, Z para o polo norte celeste.

export const PC_KM = 3.0856775814913673e13;
export const KM = 1 / PC_KM;
export const AU = 1.495978707e8 * KM;
export const LY = 1 / 3.2615637771674337; // parsecs por ano-luz
export const R_SUN = 695700 * KM;
export const R_EARTH = 6371 * KM;
export const DEG = Math.PI / 180;

export const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  len: a => Math.hypot(a[0], a[1], a[2]),
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

export function radec2xyz(raDeg, decDeg, d) {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  return [d * Math.cos(dec) * Math.cos(ra), d * Math.cos(dec) * Math.sin(ra), d * Math.sin(dec)];
}
export function xyz2radec(p) {
  const d = v3.len(p);
  let ra = Math.atan2(p[1], p[0]) / DEG;
  if (ra < 0) ra += 360;
  return { ra, dec: Math.asin(p[2] / (d || 1)) / DEG, d };
}

// Equatorial J2000 -> galáctico (matriz da IAU/Hipparcos)
export const EQ2GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
];
export function gal2eq(g) {
  const m = EQ2GAL;
  return [m[0][0] * g[0] + m[1][0] * g[1] + m[2][0] * g[2], m[0][1] * g[0] + m[1][1] * g[1] + m[2][1] * g[2], m[0][2] * g[0] + m[1][2] * g[1] + m[2][2] * g[2]];
}
export const GC_DIST = 8178; // Sgr A*, GRAVITY 2019
export const GALACTIC_CENTER = gal2eq([GC_DIST, 0, -6.6]); // b = -0.046°

// Divide um double em duas partes float32 (técnica "relative to eye" para não perder precisão na GPU).
export function splitDouble(src, hi, lo) {
  for (let i = 0; i < src.length; i++) {
    const h = Math.fround(src[i]);
    hi[i] = h;
    lo[i] = src[i] - h;
  }
}

// Índice de cor B-V -> temperatura (Ballesteros 2012) -> cor RGB aproximada de corpo negro
export const bvToTemp = bv => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
export function tempToRGB(t) {
  t = Math.min(Math.max(t, 1000), 40000) / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.52 * Math.log(t - 10) - 305.04;
  const c = x => Math.min(Math.max(x, 0), 255) / 255;
  return [c(r), c(g), c(b)];
}

// Distâncias para gente
const nf = (x, d = 1) => x.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export function fmtDist(pc) {
  const km = pc * PC_KM;
  if (km < 1e6) return `${nf(km, km < 100 ? 1 : 0)} km`;
  if (km < 1e9) return `${nf(km / 1e6, 1)} milhões de km`;
  const au = pc / AU;
  if (au < 5000) return `${nf(au, au < 10 ? 2 : 0)} UA`;
  const ly = pc / LY;
  if (ly < 1e4) return `${nf(ly, ly < 10 ? 2 : ly < 100 ? 1 : 0)} anos-luz`;
  if (ly < 1e6) return `${nf(ly / 1e3, 1)} mil anos-luz`;
  if (ly < 1e9) return `${nf(ly / 1e6, 1)} milhões de anos-luz`;
  return `${nf(ly / 1e9, 2)} bilhões de anos-luz`;
}
export function fmtLightTime(pc) {
  const s = pc * PC_KM / 299792.458;
  if (s < 60) return `${nf(s, 1)} segundos`;
  if (s < 3600) return `${nf(s / 60, 1)} minutos`;
  if (s < 86400) return `${nf(s / 3600, 1)} horas`;
  const y = s / 31557600;
  if (y < 1) return `${nf(s / 86400, 0)} dias`;
  if (y < 1e4) return `${nf(y, y < 10 ? 1 : 0)} anos`;
  if (y < 1e6) return `${nf(y / 1e3, 1)} mil anos`;
  if (y < 1e9) return `${nf(y / 1e6, 1)} milhões de anos`;
  return `${nf(y / 1e9, 2)} bilhões de anos`;
}
export function fmtSpeed(pcPerSec) {
  const c = pcPerSec * PC_KM / 299792.458;
  if (c < 1e-3) return `${nf(pcPerSec * PC_KM, 0)} km/s`;
  if (c < 1000) return `${nf(c, c < 10 ? 2 : 0)} × luz`;
  return `${c.toExponential(1).replace('e+', '×10^')} × luz`;
}
export const fmtNum = nf;

// ---------------------------------------------------------------- Cosmologia (ΛCDM plano: H0 = 70, Ωm = 0,3, com radiação)
// Integrais no fator de escala a = 1/(1+z), em passos de ln(a): valem de z = 0 até a radiação cósmica de fundo (z = 1090).
const H0 = 70, OM = 0.3, OR = 8.5e-5, OL = 1 - OM - OR, C_KMS = 299792.458;
const E = a => Math.sqrt(OR / a ** 4 + OM / a ** 3 + OL);
const HUBBLE_GYR = 977.792 / H0;
function cosmoIntegral(z, f, n = 400) {
  const la = -Math.log(1 + z);
  let s = 0;
  for (let i = 0; i < n; i++) { const a = Math.exp(la * (i + 0.5) / n); s += f(a); }
  return s * -la / n;
}
// Distância comóvel (a de hoje, em parsecs)
export const comovingDistance = z => (z <= 0 ? 0 : C_KMS / H0 * 1e6 * cosmoIntegral(z, a => 1 / (a * E(a))));
// Tempo de viagem da luz (anos)
export const lookbackYears = z => (z <= 0 ? 0 : HUBBLE_GYR * 1e9 * cosmoIntegral(z, a => 1 / E(a)));
export const AGE_OF_UNIVERSE = HUBBLE_GYR * 1e9 * cosmoIntegral(1e8, a => 1 / E(a), 2000);
export const CMB_DISTANCE = comovingDistance(1090);
// Redshift a partir da distância comóvel (bisseção)
export function zFromComoving(dpc) {
  let lo = 0, hi = 1100;
  for (let k = 0; k < 60; k++) { const m = Math.sqrt(lo * hi) || (lo + hi) / 2; if (comovingDistance(m) < dpc) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export function fmtYears(y) {
  if (y < 1e6) return `${nf(y / 1e3, 1)} mil anos`;
  if (y < 1e9) return `${nf(y / 1e6, 1)} milhões de anos`;
  return `${nf(y / 1e9, 2)} bilhões de anos`;
}
// Frase sobre a luz: perto, distância = tempo; longe, a expansão do universo separa as duas coisas
export function lightSentence(dpc, z) {
  if (dpc < 3e7 && !(z > 0.007)) return `A luz que vemos saiu de lá há ${fmtLightTime(dpc)}.`;
  z = z > 0 ? z : zFromComoving(dpc);
  const lb = lookbackYears(z);
  return `A luz que vemos saiu de lá há ${fmtYears(lb)}, quando o universo tinha ${fmtYears(AGE_OF_UNIVERSE - lb)}. ` +
    `Durante a viagem o espaço se expandiu: hoje esse lugar está a ${fmtDist(dpc)} (redshift z = ${nf(z, z < 1 ? 3 : 2)}).`;
}

export const normName = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+\-*]/g, '');
