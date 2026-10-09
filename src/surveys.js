// Levantamentos HiPS (CDS) agrupados por faixa do espectro. Todos existem no MocServer (verificado em 2026-10).
// full: cobre o céu inteiro (pode virar céu de fundo da nave). cmap: paleta para mapas monocromáticos.
export const BANDS = [
  { name: 'Raios gama', range: '> 100 keV', items: [
    { id: 'CDS/P/Fermi/color', label: 'Fermi LAT (cor)', full: true },
    { id: 'CDS/P/EGRET/Dif/100-150', label: 'EGRET 100–150 MeV', full: true, cmap: 'inferno' },
  ] },
  { name: 'Raios X', range: '0,1–10 keV', items: [
    { id: 'CDS/P/RASS', label: 'ROSAT (céu inteiro)', full: true, cmap: 'magma' },
  ] },
  { name: 'Ultravioleta', range: '150–280 nm', items: [
    { id: 'CDS/P/GALEXGR6_7/color', label: 'GALEX (cor)' },
    { id: 'CDS/P/GALEXGR6_7/FUV', label: 'GALEX FUV 152 nm' },
    { id: 'CDS/P/GALEXGR6_7/NUV', label: 'GALEX NUV 231 nm' },
  ] },
  { name: 'Visível', range: '400–700 nm', items: [
    { id: 'CDS/P/DSS2/color', label: 'DSS2 cor', full: true },
    { id: 'CDS/P/Mellinger/color', label: 'Mellinger (céu inteiro)', full: true },
    { id: 'CDS/P/DSS2/blue', label: 'DSS2 azul' },
    { id: 'CDS/P/DSS2/red', label: 'DSS2 vermelho' },
    { id: 'CDS/P/DESI-Legacy-Surveys/DR10/color', label: 'DESI Legacy DR10 (g r i z)' },
    { id: 'CDS/P/PanSTARRS/DR1/color-z-zg-g', label: 'Pan-STARRS cor' },
    { id: 'CDS/P/PanSTARRS/DR1/g', label: 'Pan-STARRS g' },
    { id: 'CDS/P/PanSTARRS/DR1/r', label: 'Pan-STARRS r' },
    { id: 'CDS/P/PanSTARRS/DR1/i', label: 'Pan-STARRS i' },
    { id: 'CDS/P/PanSTARRS/DR1/z', label: 'Pan-STARRS z' },
    { id: 'CDS/P/PanSTARRS/DR1/y', label: 'Pan-STARRS y' },
    { id: 'CDS/P/SDSS9/color', label: 'SDSS cor' },
    { id: 'CDS/P/SDSS9/u', label: 'SDSS u' },
    { id: 'CDS/P/SDSS9/g', label: 'SDSS g' },
    { id: 'CDS/P/SDSS9/r', label: 'SDSS r' },
    { id: 'CDS/P/SDSS9/i', label: 'SDSS i' },
    { id: 'CDS/P/SDSS9/z', label: 'SDSS z' },
    { id: 'CDS/P/HST/EPO', label: 'Hubble: imagens de divulgação' },
    { id: 'CDS/P/Rubin/FirstLook', label: 'Vera Rubin: primeiras imagens' },
  ] },
  { name: 'Hidrogênio-alfa', range: '656 nm', items: [
    { id: 'CDS/P/Finkbeiner', label: 'Hα Finkbeiner (céu inteiro)', full: true, cmap: 'hot' },
    { id: 'CDS/P/SHASSA/H', label: 'SHASSA Hα (sul)', cmap: 'hot' },
    { id: 'CDS/P/VTSS/Ha', label: 'VTSS Hα (norte)', cmap: 'hot' },
    { id: 'CDS/P/HST/Halpha', label: 'Hubble Hα (F656N)' },
  ] },
  { name: 'Infravermelho próximo', range: '1–5 µm', items: [
    { id: 'CDS/P/2MASS/color', label: '2MASS J H K', full: true },
    { id: 'CDS/P/2MASS/J', label: '2MASS J 1,2 µm' },
    { id: 'CDS/P/2MASS/H', label: '2MASS H 1,7 µm' },
    { id: 'CDS/P/2MASS/K', label: '2MASS K 2,2 µm' },
    { id: 'CDS/P/SPHEREx/QR2/color', label: 'SPHEREx (céu inteiro)', full: true },
    { id: 'CDS/P/Euclid/Q1/color', label: 'Euclid Q1' },
    { id: 'CDS/P/Euclid/ERO/color', label: 'Euclid: primeiras imagens' },
    { id: 'CDS/P/JWST/EPO', label: 'JWST: imagens de divulgação' },
    { id: 'CDS/P/JWST/F150W', label: 'JWST NIRCam F150W' },
    { id: 'CDS/P/JWST/F444W', label: 'JWST NIRCam F444W' },
  ] },
  { name: 'Infravermelho médio', range: '3–25 µm', items: [
    { id: 'CDS/P/allWISE/color', label: 'WISE W1 W2 W4', full: true },
    { id: 'CDS/P/allWISE/W1', label: 'WISE W1 3,4 µm' },
    { id: 'CDS/P/allWISE/W2', label: 'WISE W2 4,6 µm' },
    { id: 'CDS/P/allWISE/W3', label: 'WISE W3 12 µm' },
    { id: 'CDS/P/allWISE/W4', label: 'WISE W4 22 µm' },
    { id: 'CDS/P/SPITZER/color', label: 'Spitzer IRAC (plano galáctico)' },
  ] },
  { name: 'Infravermelho distante', range: '60–500 µm', items: [
    { id: 'CDS/P/IRIS/color', label: 'IRAS/IRIS (poeira)', full: true },
    { id: 'CDS/P/AKARI/FIS/Color', label: 'AKARI FIS', full: true },
    { id: 'ESAVO/P/HERSCHEL/PACS-color', label: 'Herschel PACS' },
  ] },
  { name: 'Micro-ondas', range: '0,3–1 mm', items: [
    { id: 'CDS/P/PLANCK/R3/CMB', label: 'Radiação cósmica de fundo (Planck)', full: true, cmap: 'RdYlBu_r', stretch: 'linear' },
    { id: 'CDS/P/PLANCK/R2/HFI/color', label: 'Planck HFI 353–857 GHz (poeira)', full: true },
  ] },
  { name: 'Rádio', range: '21 cm – 1 m', items: [
    { id: 'CDS/P/HI4PI/NHI', label: 'Hidrogênio neutro 21 cm (HI4PI)', full: true, cmap: 'viridis' },
    { id: 'CDS/P/Haslam408/v2', label: 'Haslam 408 MHz', full: true, cmap: 'inferno' },
    { id: 'CDS/P/NVSS', label: 'NVSS 1,4 GHz (VLA)' },
    { id: 'CDS/P/MeerKAT/Galactic-Centre-1284MHz-StokesI', label: 'MeerKAT: centro galáctico' },
  ] },
];

export const SURVEY_BY_ID = Object.fromEntries(BANDS.flatMap(b => b.items.map(s => [s.id, { ...s, band: b.name }])));

export function hips2fitsURL(id, { ra, dec, fov, width = 512, height = 512, projection = 'TAN' }) {
  const s = SURVEY_BY_ID[id];
  const p = new URLSearchParams({ hips: id, width, height, projection, fov, ra, dec, coordsys: 'icrs', format: 'jpg' });
  if (s?.cmap) { p.set('cmap', s.cmap); p.set('stretch', s.stretch || 'asinh'); }
  return 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?' + p;
}
