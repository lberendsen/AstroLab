// Telescópios: quem fez cada levantamento do céu que o telescópio do app mostra (surveys.js).
// No espaço: os que estão no catálogo de naves e satélites usam a ficha deles; os aposentados têm ficha própria.
// Na Terra: pontos na superfície (latitude, longitude, altitude), como os robôs na Lua e em Marte.
// show: um campo onde o levantamento dele brilha, para "ver o céu por este telescópio".
// Textos escritos para o app a partir das informações públicas das missões e observatórios.
import { BODY, surfacePoint } from './layers/solar.js';
import { CRAFT } from './layers/craft.js';
import { SAT } from './layers/sats.js';
import { craftTarget, satTarget } from './targets.js';
import { v3, KM } from './astro.js';

const ALLSKY = { ra: 266.4, dec: -28.9, fov: 180, name: 'o céu inteiro' };
const GC = (fov = 2) => ({ ra: 266.42, dec: -29.0, fov, name: 'o centro da Via Láctea' });

export const TELESCOPES = [
  // ---------------------------------------------------------------- no espaço, no catálogo
  { key: 'hubble', where: 'space', craft: { sat: 'HST' }, name: 'Telescópio Espacial Hubble', who: 'NASA e ESA (EUA e Europa)', years: 'desde 1990', mirror: 'espelho de 2,4 m',
    light: 'ultravioleta, visível e infravermelho próximo', orbit: 'em volta da Terra, a 540 km de altitude',
    desc: 'Lançado em 1990 e consertado cinco vezes por astronautas do ônibus espacial. Acima da atmosfera, que borra as imagens, faz fotos muito mais nítidas que telescópios do mesmo tamanho no chão.',
    surveys: ['CDS/P/HST/EPO', 'CDS/P/HST/Halpha'], show: { ra: 274.70, dec: -13.84, fov: 0.08, name: 'os Pilares da Criação (M16)' } },
  { key: 'jwst', where: 'space', craft: { probe: 'jwst' }, name: 'Telescópio Espacial James Webb', who: 'NASA, ESA e CSA (EUA, Europa e Canadá)', years: 'desde 2021', mirror: 'espelho de 6,5 m em 18 segmentos de berílio banhados a ouro',
    light: 'infravermelho, de 0,6 a 28 µm', orbit: 'no ponto L2, a 1,5 milhão de km da Terra, do lado oposto ao Sol',
    desc: 'Enxerga o calor: por isso precisa ficar a −233 °C, atrás de um escudo do tamanho de uma quadra de tênis. Vê galáxias de quando o universo tinha menos de 300 milhões de anos e a atmosfera de planetas de outras estrelas.',
    surveys: ['CDS/P/JWST/EPO', 'CDS/P/JWST/F150W', 'CDS/P/JWST/F444W'], show: { ra: 110.83, dec: -73.454, fov: 0.05, name: 'o Primeiro Campo Profundo (SMACS 0723)' } },
  { key: 'euclid', where: 'space', craft: { probe: 'euclid' }, name: 'Euclid', who: 'ESA (Europa)', years: 'desde 2023', mirror: 'espelho de 1,2 m',
    light: 'visível e infravermelho próximo', orbit: 'no ponto L2, a 1,5 milhão de km da Terra',
    desc: 'Mapeia um terço do céu para medir como a matéria escura e a energia escura moldaram o universo nos últimos 10 bilhões de anos. Cada foto cobre 2,5 vezes a área da Lua cheia, muito para um telescópio espacial.',
    surveys: ['CDS/P/Euclid/Q1/color', 'CDS/P/Euclid/ERO/color'], show: { ra: 85.25, dec: -2.46, fov: 0.5, name: 'a Nebulosa Cabeça de Cavalo' } },
  { key: 'spitzer', where: 'space', craft: { probe: 'spitzer' }, name: 'Telescópio Spitzer', who: 'NASA (EUA)', years: '2003 a 2020', mirror: 'espelho de 0,85 m',
    light: 'infravermelho, de 3,6 a 160 µm', orbit: 'em volta do Sol, seguindo a Terra de longe',
    desc: 'Viu através da poeira o centro da Via Láctea e os berçários de estrelas. Ajudou a descobrir os sete planetas de TRAPPIST-1.',
    surveys: ['CDS/P/SPITZER/color'], show: GC(1.5) },
  { key: 'fermi', where: 'space', craft: { sat: 'FGRST (GLAST)' }, name: 'Telescópio Fermi de Raios Gama', who: 'NASA, com França, Alemanha, Itália, Japão e Suécia', years: 'desde 2008',
    mirror: 'sem espelho: raios gama atravessam qualquer espelho, então ele registra os pares de partículas que cada raio cria',
    light: 'raios gama, de 20 MeV a 300 GeV', orbit: 'em volta da Terra, a 530 km de altitude',
    desc: 'Vê o céu inteiro a cada 3 horas na luz mais energética que existe: jatos de buracos negros, pulsares e explosões. Descobriu as "bolhas de Fermi", que saem do centro da Via Láctea.',
    surveys: ['CDS/P/Fermi/color'], show: ALLSKY },
  // ---------------------------------------------------------------- no espaço, aposentados
  { key: 'cgro', where: 'space', name: 'Observatório Compton de Raios Gama (EGRET)', who: 'NASA (EUA)', years: '1991 a 2000', mirror: 'o EGRET era uma câmara de faíscas: registrava o rastro das partículas criadas pelos raios gama',
    light: 'raios gama, de 20 MeV a 30 GeV', orbit: 'em volta da Terra; foi derrubado de propósito sobre o Pacífico em 2000',
    desc: 'O segundo dos "Grandes Observatórios" da NASA, depois do Hubble. O EGRET fez o primeiro mapa do céu inteiro em raios gama de alta energia.',
    surveys: ['CDS/P/EGRET/Dif/100-150'], show: ALLSKY },
  { key: 'rosat', where: 'space', name: 'ROSAT', who: 'Alemanha, com EUA e Reino Unido', years: '1990 a 1999', mirror: 'espelhos de 0,84 m em forma de tubo',
    light: 'raios X, de 0,1 a 2,4 keV', orbit: 'em volta da Terra; reentrou na atmosfera em 2011',
    desc: 'Raios X não refletem num espelho comum: só batendo de raspão em espelhos em forma de tubo. O ROSAT fez o primeiro mapa do céu inteiro com um telescópio de raios X, com mais de 100 mil fontes.',
    surveys: ['CDS/P/RASS'], show: ALLSKY },
  { key: 'galex', where: 'space', name: 'GALEX', who: 'NASA (EUA)', years: '2003 a 2013', mirror: 'espelho de 0,5 m',
    light: 'ultravioleta, de 135 a 280 nm', orbit: 'em volta da Terra, a 700 km (desligado, ainda em órbita)',
    desc: 'Mapeou o ultravioleta, a luz das estrelas jovens e quentes: mostra onde as galáxias estão formando estrelas agora.',
    surveys: ['CDS/P/GALEXGR6_7/color', 'CDS/P/GALEXGR6_7/FUV', 'CDS/P/GALEXGR6_7/NUV'], show: { ra: 10.685, dec: 41.269, fov: 3, name: 'a Galáxia de Andrômeda' } },
  { key: 'wise', where: 'space', name: 'WISE / NEOWISE', who: 'NASA (EUA)', years: '2009 a 2024', mirror: 'espelho de 0,4 m',
    light: 'infravermelho, de 3,4 a 22 µm', orbit: 'em volta da Terra; reentrou na atmosfera em novembro de 2024',
    desc: 'Fotografou o céu inteiro duas vezes no infravermelho. Depois, como NEOWISE, caçou asteroides e cometas perto da Terra (o cometa NEOWISE de 2020 leva o nome dele).',
    surveys: ['CDS/P/allWISE/color', 'CDS/P/allWISE/W1', 'CDS/P/allWISE/W2', 'CDS/P/allWISE/W3', 'CDS/P/allWISE/W4'], show: { ra: 84, dec: -3, fov: 25, name: 'Órion' } },
  { key: 'iras', where: 'space', name: 'IRAS', who: 'EUA, Países Baixos e Reino Unido', years: '1983 (10 meses)', mirror: 'espelho de 0,57 m',
    light: 'infravermelho, de 12 a 100 µm', orbit: 'em volta da Terra, a 900 km (desligado, ainda em órbita)',
    desc: 'O primeiro telescópio a mapear o céu inteiro no infravermelho. Descobriu discos de poeira em volta de estrelas como Vega e os "cirros" de poeira da Via Láctea. O mapa IRIS é o reprocessamento moderno dos dados dele.',
    surveys: ['CDS/P/IRIS/color'], show: ALLSKY },
  { key: 'akari', where: 'space', name: 'AKARI', who: 'Japão (JAXA), com a ESA', years: '2006 a 2011', mirror: 'espelho de 0,685 m',
    light: 'infravermelho, de 1,7 a 180 µm', orbit: 'em volta da Terra; reentrou na atmosfera em 2023',
    desc: 'Fez o segundo mapa do céu inteiro no infravermelho distante, mais nítido que o do IRAS: a poeira fria da Via Láctea.',
    surveys: ['CDS/P/AKARI/FIS/Color'], show: ALLSKY },
  { key: 'herschel', where: 'space', name: 'Herschel', who: 'ESA (Europa)', years: '2009 a 2013', mirror: 'espelho de 3,5 m, o maior no espaço antes do Webb',
    light: 'infravermelho distante, de 55 a 672 µm', orbit: 'trabalhava no ponto L2; hoje está em órbita do Sol', l2: true,
    desc: 'Viu a poeira fria onde as estrelas nascem. Funcionou até acabar o hélio líquido que o mantinha a −271 °C.',
    surveys: ['ESAVO/P/HERSCHEL/PACS-color'], show: { ra: 83.82, dec: -5.39, fov: 1, name: 'a Nebulosa de Órion' } },
  { key: 'planck', where: 'space', name: 'Planck', who: 'ESA (Europa)', years: '2009 a 2013', mirror: 'espelho de 1,5 m',
    light: 'micro-ondas, de 30 a 857 GHz', orbit: 'trabalhava no ponto L2; hoje está em órbita do Sol', l2: true,
    desc: 'Mediu a radiação cósmica de fundo, a luz mais antiga do universo, com precisão sem precedentes. Daí vêm a idade do universo (13,8 bilhões de anos) e quanto dele é matéria escura.',
    surveys: ['CDS/P/PLANCK/R3/CMB', 'CDS/P/PLANCK/R2/HFI/color'], show: ALLSKY },
  { key: 'spherex', where: 'space', name: 'SPHEREx', who: 'NASA (EUA)', years: 'desde 2025', mirror: 'espelho de 0,2 m',
    light: 'infravermelho, de 0,75 a 5 µm, em 102 cores', orbit: 'em volta da Terra, a 650 km, passando sobre os polos',
    desc: 'Fotografa o céu inteiro a cada seis meses em 102 cores do infravermelho: mede a distância de centenas de milhões de galáxias e procura gelo de água nas nuvens onde nascem estrelas.',
    surveys: ['CDS/P/SPHEREx/QR2/color'], show: ALLSKY },
  // ---------------------------------------------------------------- na Terra
  { key: 'palomar', where: 'ground', name: 'Telescópio Samuel Oschin (Palomar)', site: { lat: 33.358, lon: -116.859, alt: 1.7, place: 'Monte Palomar, Califórnia (EUA)' }, who: 'Caltech (EUA)', years: 'desde 1948',
    mirror: 'câmera Schmidt de 1,2 m', light: 'visível (chapas fotográficas azul e vermelha)',
    desc: 'Uma câmera de campo largo: cada chapa fotográfica cobria 6,5° × 6,5° do céu. Fez os dois grandes atlas do céu do norte (anos 1950 e 1990), digitalizados no DSS. Hoje faz o levantamento ZTF, que descobre supernovas toda noite.',
    surveys: ['CDS/P/DSS2/color', 'CDS/P/DSS2/blue', 'CDS/P/DSS2/red'], show: { ra: 10.685, dec: 41.269, fov: 3, name: 'a Galáxia de Andrômeda' } },
  { key: 'ukst', where: 'ground', name: 'UK Schmidt (Siding Spring)', site: { lat: -31.272, lon: 149.071, alt: 1.16, place: 'Siding Spring, Austrália' }, who: 'Reino Unido e Austrália', years: 'desde 1973',
    mirror: 'câmera Schmidt de 1,2 m', light: 'visível (chapas fotográficas azul e vermelha)',
    desc: 'O irmão do sul do Schmidt de Palomar: fotografou o céu do sul para o mesmo atlas. Os dois juntos formam o DSS, o primeiro mapa digital do céu inteiro.',
    surveys: ['CDS/P/DSS2/color', 'CDS/P/DSS2/blue', 'CDS/P/DSS2/red'], show: { ra: 80.89, dec: -69.76, fov: 8, name: 'a Grande Nuvem de Magalhães' } },
  { key: 'panstarrs', where: 'ground', name: 'Pan-STARRS1', site: { lat: 20.707, lon: -156.256, alt: 3.05, place: 'Haleakalā, ilha de Maui, Havaí (EUA)' }, who: 'Universidade do Havaí (EUA)', years: 'desde 2010',
    mirror: 'espelho de 1,8 m e câmera de 1,4 bilhão de pixels', light: 'visível e infravermelho próximo (filtros g, r, i, z, y)',
    desc: 'Fotografou três quartos do céu, tudo o que se vê do Havaí, várias vezes entre 2010 e 2014. Hoje caça asteroides perigosos; descobriu ʻOumuamua, o primeiro objeto vindo de outra estrela.',
    surveys: ['CDS/P/PanSTARRS/DR1/color-z-zg-g', 'CDS/P/PanSTARRS/DR1/g', 'CDS/P/PanSTARRS/DR1/r', 'CDS/P/PanSTARRS/DR1/i', 'CDS/P/PanSTARRS/DR1/z', 'CDS/P/PanSTARRS/DR1/y'], show: { ra: 210.80, dec: 54.35, fov: 0.4, name: 'a Galáxia do Cata-vento (M101)' } },
  { key: 'sdss', where: 'ground', name: 'Telescópio Sloan (SDSS)', site: { lat: 32.780, lon: -105.820, alt: 2.79, place: 'Apache Point, Novo México (EUA)' }, who: 'consórcio de universidades (EUA, Japão, Alemanha e outros)', years: 'desde 2000',
    mirror: 'espelho de 2,5 m', light: 'visível (filtros u, g, r, i, z)',
    desc: 'O levantamento que mudou a cosmologia: fotografou um terço do céu e mediu a distância de milhões de galáxias e quasares. Os 750 mil quasares do app vêm dele.',
    surveys: ['CDS/P/SDSS9/color', 'CDS/P/SDSS9/u', 'CDS/P/SDSS9/g', 'CDS/P/SDSS9/r', 'CDS/P/SDSS9/i', 'CDS/P/SDSS9/z'], show: { ra: 202.47, dec: 47.195, fov: 0.25, name: 'a Galáxia do Rodamoinho (M51)' } },
  { key: 'blanco', where: 'ground', name: 'Telescópio Víctor Blanco (DECam)', site: { lat: -30.169, lon: -70.806, alt: 2.2, place: 'Cerro Tololo, Chile' }, who: 'NOIRLab (EUA)', years: 'desde 1976',
    mirror: 'espelho de 4 m e a DECam, câmera de 570 megapixels', light: 'visível (filtros g, r, i, z)',
    desc: 'Com a DECam, feita para estudar a energia escura, fez a maior parte do Legacy Survey: o mapa usado para escolher as galáxias que o DESI mede.',
    surveys: ['CDS/P/DESI-Legacy-Surveys/DR10/color'], show: { ra: 53.40, dec: -36.14, fov: 0.2, name: 'a Grande Espiral Barrada (NGC 1365)' } },
  { key: 'mayall', where: 'ground', name: 'Telescópio Mayall (Kitt Peak)', site: { lat: 31.964, lon: -111.600, alt: 2.12, place: 'Kitt Peak, Arizona (EUA)' }, who: 'NOIRLab (EUA)', years: 'desde 1973',
    mirror: 'espelho de 4 m', light: 'visível e infravermelho próximo',
    desc: 'Fotografou o céu do norte para o Legacy Survey e hoje abriga o DESI, que mede a luz de 5 mil galáxias de uma vez, com 5 mil fibras óticas posicionadas por robôs.',
    surveys: ['CDS/P/DESI-Legacy-Surveys/DR10/color'], show: { ra: 339.01, dec: 33.96, fov: 0.1, name: 'o Quinteto de Stephan' } },
  { key: 'rubin', where: 'ground', name: 'Observatório Vera C. Rubin', site: { lat: -30.245, lon: -70.749, alt: 2.66, place: 'Cerro Pachón, Chile' }, who: 'NSF e Departamento de Energia (EUA)', years: 'desde 2025',
    mirror: 'espelho de 8,4 m e a maior câmera já feita, de 3,2 gigapixels', light: 'visível e infravermelho próximo',
    desc: 'Vai fotografar o céu do sul inteiro a cada três noites por dez anos, fazendo um "filme" do universo: supernovas, asteroides, estrelas que piscam. As primeiras imagens saíram em junho de 2025.',
    surveys: ['CDS/P/Rubin/FirstLook'], show: { ra: 270.9, dec: -23.4, fov: 2.5, name: 'as nebulosas Trífida e da Lagoa' } },
  { key: 'shassa', where: 'ground', name: 'SHASSA (Cerro Tololo)', site: { lat: -30.165, lon: -70.815, alt: 2.2, place: 'Cerro Tololo, Chile' }, who: 'Universidade Estadual de Wisconsin e outros (EUA)', years: '1997 a 2000',
    mirror: 'lente de 52 mm: uma câmera pequena, não um telescópio grande', light: 'hidrogênio-alfa (656 nm)',
    desc: 'Uma câmera robótica com filtro de hidrogênio que fotografou o céu do sul inteiro: o brilho vermelho do gás ionizado em volta de estrelas quentes.',
    surveys: ['CDS/P/SHASSA/H'], show: { ra: 84, dec: -2, fov: 30, name: 'Órion' } },
  { key: 'vtss', where: 'ground', name: 'VTSS (Virginia Tech)', site: { lat: 37.22, lon: -80.42, alt: 0.6, place: 'Blacksburg, Virgínia (EUA)' }, who: 'Virginia Tech (EUA)', years: 'anos 1990',
    mirror: 'câmera com lente grande-angular', light: 'hidrogênio-alfa (656 nm)',
    desc: 'O equivalente do norte do SHASSA: mapeou o gás de hidrogênio ionizado no céu do norte.',
    surveys: ['CDS/P/VTSS/Ha'], show: { ra: 310, dec: 42, fov: 20, name: 'a região de Cisne' } },
  { key: '2mass-n', where: 'ground', name: '2MASS (Monte Hopkins)', site: { lat: 31.681, lon: -110.878, alt: 2.33, place: 'Monte Hopkins, Arizona (EUA)' }, who: 'Universidade de Massachusetts e Caltech (EUA)', years: '1997 a 2001',
    mirror: 'espelho de 1,3 m', light: 'infravermelho próximo (J, H, K: 1,2 a 2,2 µm)',
    desc: 'Um de dois telescópios gêmeos, um em cada hemisfério, que fotografaram o céu inteiro no infravermelho próximo: 470 milhões de estrelas e 1,6 milhão de galáxias. As 43 mil galáxias do app vêm do 2MASS.',
    surveys: ['CDS/P/2MASS/color', 'CDS/P/2MASS/J', 'CDS/P/2MASS/H', 'CDS/P/2MASS/K'], show: GC(5) },
  { key: '2mass-s', where: 'ground', name: '2MASS (Cerro Tololo)', site: { lat: -30.168, lon: -70.805, alt: 2.2, place: 'Cerro Tololo, Chile' }, who: 'Universidade de Massachusetts e Caltech (EUA)', years: '1997 a 2001',
    mirror: 'espelho de 1,3 m', light: 'infravermelho próximo (J, H, K: 1,2 a 2,2 µm)',
    desc: 'O gêmeo do sul do 2MASS. Os dois juntos cobriram o céu inteiro com o mesmo equipamento, o que torna o mapa uniforme.',
    surveys: ['CDS/P/2MASS/color', 'CDS/P/2MASS/J', 'CDS/P/2MASS/H', 'CDS/P/2MASS/K'], show: GC(5) },
  { key: 'vla', where: 'ground', name: 'Very Large Array (VLA)', site: { lat: 34.078, lon: -107.618, alt: 2.12, place: 'Planície de San Agustin, Novo México (EUA)' }, who: 'NRAO (EUA)', years: 'desde 1980',
    mirror: '27 antenas de 25 m sobre trilhos, até 36 km de distância uma da outra', light: 'rádio',
    desc: 'As antenas trabalham juntas como um único telescópio do tamanho da distância entre elas (interferometria). O NVSS fotografou 82% do céu em 1,4 GHz: quasares, radiogaláxias, restos de supernova.',
    surveys: ['CDS/P/NVSS'], show: { ra: 299.868, dec: 40.734, fov: 0.5, name: 'a radiogaláxia Cygnus A' } },
  { key: 'meerkat', where: 'ground', name: 'MeerKAT', site: { lat: -30.713, lon: 21.443, alt: 1.04, place: 'Karoo, África do Sul' }, who: 'SARAO (África do Sul)', years: 'desde 2018',
    mirror: '64 antenas de 13,5 m', light: 'rádio',
    desc: 'Precursor do SKA, o maior radiotelescópio do mundo, em construção. Fez a imagem mais detalhada do centro da Via Láctea em rádio, com filamentos magnéticos de centenas de anos-luz que ninguém sabe explicar direito.',
    surveys: ['CDS/P/MeerKAT/Galactic-Centre-1284MHz-StokesI'], show: GC(2) },
  { key: 'effelsberg', where: 'ground', name: 'Radiotelescópio de Effelsberg', site: { lat: 50.525, lon: 6.884, alt: 0.37, place: 'Effelsberg, Alemanha' }, who: 'Instituto Max Planck de Radioastronomia (Alemanha)', years: 'desde 1972',
    mirror: 'antena de 100 m', light: 'rádio',
    desc: 'Um dos maiores radiotelescópios orientáveis do mundo. Fez a metade norte do HI4PI, o mapa do hidrogênio neutro no céu inteiro (linha de 21 cm), e parte do mapa de Haslam.',
    surveys: ['CDS/P/HI4PI/NHI', 'CDS/P/Haslam408/v2'], show: ALLSKY },
  { key: 'parkes', where: 'ground', name: 'Radiotelescópio de Parkes (Murriyang)', site: { lat: -32.998, lon: 148.264, alt: 0.39, place: 'Parkes, Austrália' }, who: 'CSIRO (Austrália)', years: 'desde 1961',
    mirror: 'antena de 64 m', light: 'rádio',
    desc: 'Recebeu as imagens da Apollo 11 na Lua para a TV do mundo inteiro. Fez a metade sul do HI4PI e parte do mapa de Haslam, e registrou o primeiro "fast radio burst", em 2007.',
    surveys: ['CDS/P/HI4PI/NHI', 'CDS/P/Haslam408/v2'], show: ALLSKY },
  { key: 'jodrell', where: 'ground', name: 'Telescópio Lovell (Jodrell Bank)', site: { lat: 53.237, lon: -2.309, alt: 0.08, place: 'Jodrell Bank, Inglaterra' }, who: 'Universidade de Manchester (Reino Unido)', years: 'desde 1957',
    mirror: 'antena de 76 m', light: 'rádio',
    desc: 'Rastreou o Sputnik em 1957. Junto com Effelsberg e Parkes, fez o mapa de Haslam (408 MHz, 1982): o céu inteiro em rádio, com o brilho dos elétrons que espiralam no campo magnético da galáxia.',
    surveys: ['CDS/P/Haslam408/v2'], show: ALLSKY },
  // ---------------------------------------------------------------- não são telescópios
  { key: 'mellinger', where: 'none', name: 'Panorama da Via Láctea (Axel Mellinger)', who: 'Axel Mellinger (Universidade Central de Michigan, EUA)', years: '2000 a 2009',
    mirror: 'câmeras fotográficas comuns, com lentes de 50 mm', light: 'visível, como o olho humano vê',
    desc: 'Não é um telescópio: o astrônomo Axel Mellinger juntou milhares de fotos tiradas com câmeras comuns em Michigan e no Texas (EUA) e na África do Sul para montar o céu inteiro. É o céu de fundo do 3D.',
    surveys: ['CDS/P/Mellinger/color'], show: ALLSKY },
  { key: 'finkbeiner', where: 'none', name: 'Mapa de hidrogênio-alfa de Finkbeiner', who: 'Douglas Finkbeiner (EUA)', years: '2003',
    mirror: 'combinação de três levantamentos', light: 'hidrogênio-alfa (656 nm)',
    desc: 'Não é um telescópio: Douglas Finkbeiner juntou o SHASSA (sul), o VTSS (norte) e o WHAM (que mede o brilho do gás com grande precisão) num único mapa do céu inteiro em hidrogênio-alfa.',
    surveys: ['CDS/P/Finkbeiner'], show: ALLSKY },
];

const BY_KEY = new Map(TELESCOPES.map(t => [t.key, t]));
export const telescopeByKey = k => BY_KEY.get(k);
// quem fez um levantamento (pode ser mais de um: o DSS vem de Palomar e de Siding Spring)
export const telescopesOfSurvey = id => TELESCOPES.filter(t => t.surveys.includes(id));

// telescópio por trás de um alvo: ficha própria (kind telescope) ou nave/satélite do catálogo
export function telescopeOf(t) {
  if (t?.tel) return t.tel;
  const probe = t?.craft?.id, sat = (t?.sat || t?.craft?.sat)?.name;
  return TELESCOPES.find(T => (probe && T.craft?.probe === probe) || (sat && T.craft?.sat === sat)) || null;
}

// Alvo do telescópio: nave ou satélite do catálogo, ponto na superfície da Terra, ou só a ficha (aposentados)
export function telescopeTarget(T) {
  if (T.craft?.probe) { const c = CRAFT.find(x => x.id === T.craft.probe); if (c) return craftTarget(c); }
  if (T.craft?.sat) {
    const s = SAT.list.find(x => x.name === T.craft.sat);
    // satélite com ficha de destaque (Hubble) usa a dele; os outros (Fermi) ganham o nome do telescópio
    if (s) return s.craft ? craftTarget(s.craft) : { ...satTarget(s), name: T.name, tel: T };
  }
  if (T.where === 'ground') {
    const sp = () => surfacePoint('Earth', T.site.lat, T.site.lon, T.site.alt || 0);
    return {
      id: 'tel:' + T.key, name: T.name, kind: 'telescope', tel: T, kindLabel: `Telescópio na Terra · ${T.site.place}`,
      pos: () => sp().pos, radius: 0.05 * KM, viewDist: 2500 * KM,
      ground: { center: () => BODY.Earth.pos, radius: BODY.Earth.radius, up: () => sp().normal },
      arriveDir: () => { const n = sp().normal, side = v3.norm(v3.cross(n, [0, 0, 1])); return v3.norm(v3.add(v3.scale(n, 0.8), v3.scale(side, 0.6))); },
    };
  }
  // aposentado ou não localizável: a ficha fica junto da Terra (ou do ponto L2, onde trabalhava)
  const E = () => BODY.Earth.pos, L2 = () => v3.add(E(), v3.scale(v3.norm(E()), 1.5e6 * KM));
  return {
    id: 'tel:' + T.key, name: T.name, kind: 'telescope', tel: T, noGo: true,
    kindLabel: T.where === 'none' ? 'Mapa do céu montado a partir de fotos' : 'Telescópio espacial',
    pos: T.l2 ? L2 : E, radius: T.l2 ? 0 : BODY.Earth.radius, viewDist: T.l2 ? 2e6 * KM : BODY.Earth.radius * 4,
  };
}
