// Asteroides e cometas famosos, com descrição. Os elementos orbitais e dados físicos vêm do JPL SBDB.
// sstr: como o SBDB encontra o objeto. visited: naves que o visitaram (ids de tools/spacecraft.mjs quando houver).
export const FAMOUS = [
  // ---------------------------------------------------------------- cinturão principal
  { sstr: '1', name: 'Ceres', desc: 'O maior objeto do cinturão de asteroides, classificado como planeta anão. Tem depósitos de sal brilhantes na cratera Occator, restos de um oceano salgado.', visited: 'Dawn (NASA, 2015–2018)', craft: 'dawn' },
  { sstr: '4', name: 'Vesta', desc: 'O segundo maior asteroide. Uma colisão arrancou parte do polo sul e deixou uma montanha central de 22 km, uma das mais altas do Sistema Solar.', visited: 'Dawn (NASA, 2011–2012)' },
  { sstr: '2', name: 'Palas', desc: 'Terceiro maior asteroide, com órbita bem inclinada.' },
  { sstr: '10', name: 'Hígia', desc: 'Quarto maior asteroide; quase esférico, pode ser um planeta anão.' },
  { sstr: '16', name: 'Psique', desc: 'Um asteroide rico em metal, talvez o núcleo exposto de um planeta que não chegou a se formar.', visited: 'Psyche (NASA, chegada em 2029)', craft: 'psyche' },
  { sstr: '21', name: 'Lutécia', desc: 'Asteroide antigo, de 100 km.', visited: 'Rosetta (ESA, 2010)' },
  { sstr: '243', name: 'Ida', desc: 'O primeiro asteroide em que se descobriu uma lua: Dáctilo.', visited: 'Galileo (NASA, 1993)' },
  { sstr: '253', name: 'Matilde', desc: 'Escuro como carvão e tão poroso que pode ser metade vazio por dentro.', visited: 'NEAR Shoemaker (NASA, 1997)' },
  { sstr: '951', name: 'Gaspra', desc: 'O primeiro asteroide fotografado de perto.', visited: 'Galileo (NASA, 1991)' },
  { sstr: '2867', name: 'Šteins', desc: 'Pequeno asteroide em forma de diamante.', visited: 'Rosetta (ESA, 2008)' },
  { sstr: '152830', name: 'Dinkinesh', desc: 'Tem uma lua que, na verdade, são duas pedras grudadas.', visited: 'Lucy (NASA, 2023)', craft: 'lucy' },
  { sstr: '52246', name: 'Donaldjohanson', desc: 'Batizado em homenagem ao descobridor do fóssil "Lucy".', visited: 'Lucy (NASA, 2025)', craft: 'lucy' },
  // ---------------------------------------------------------------- troianos de Júpiter (alvos da Lucy)
  { sstr: '3548', name: 'Eurybates', desc: 'Troiano de Júpiter, com uma pequena lua (Queta).', visited: 'Lucy (NASA, 2027)', craft: 'lucy' },
  { sstr: '617', name: 'Pátroclo', desc: 'Dois corpos de ~110 km orbitando um ao outro, entre os troianos.', visited: 'Lucy (NASA, 2033)', craft: 'lucy' },
  { sstr: '624', name: 'Heitor', desc: 'O maior troiano de Júpiter, alongado como um amendoim.' },
  // ---------------------------------------------------------------- próximos da Terra
  { sstr: '433', name: 'Eros', desc: 'O primeiro asteroide orbitado e o primeiro em que uma nave pousou.', visited: 'NEAR Shoemaker (NASA, 2000–2001)' },
  { sstr: '25143', name: 'Itokawa', desc: 'Um "monte de entulho" em forma de amendoim; primeira amostra de asteroide trazida à Terra.', visited: 'Hayabusa (Japão, 2005)' },
  { sstr: '162173', name: 'Ryugu', desc: 'Asteroide em forma de pião; as amostras trazidas têm aminoácidos.', visited: 'Hayabusa2 (Japão, 2018–2019)', craft: 'hayabusa2' },
  { sstr: '101955', name: 'Bennu', desc: 'Asteroide rico em carbono. As amostras trazidas em 2023 têm ingredientes da vida. Há uma chance pequena de colisão com a Terra no século 22.', visited: 'OSIRIS-REx (NASA, 2018–2021)' },
  { sstr: '99942', name: 'Apófis', desc: 'Em 13 de abril de 2029 vai passar a 32 mil km da Terra, mais perto que os satélites geoestacionários, visível a olho nu.' },
  { sstr: '65803', name: 'Dídimo', desc: 'Sua lua, Dimorfo, foi atingida de propósito pela nave DART em 2022: a primeira vez que a humanidade mudou a órbita de um corpo celeste.', visited: 'DART (NASA, 2022) e Hera (ESA, 2026)', craft: 'hera' },
  { sstr: '469219', name: 'Kamoʻoalewa', desc: 'Uma "quase-lua" da Terra: talvez um pedaço da Lua arrancado por um impacto.', visited: 'Tianwen-2 (China, 2026)', craft: 'tianwen2' },
  { sstr: '3200', name: 'Faetonte', desc: 'Asteroide que solta poeira perto do Sol: é a origem da chuva de meteoros Geminídeas.' },
  { sstr: '2024 YR4', name: '2024 YR4', desc: 'Em 2025 chegou a ter 3% de chance de atingir a Terra em 2032; novas observações descartaram a colisão. Ainda pode atingir a Lua.' },
  // ---------------------------------------------------------------- além de Netuno
  { sstr: '486958', name: 'Arrokoth', desc: 'O objeto mais distante já visitado: dois corpos grudados suavemente, intocados desde a formação do Sistema Solar.', visited: 'New Horizons (NASA, 2019)', craft: 'newhorizons' },
  { sstr: '136199', name: 'Éris', desc: 'Planeta anão quase do tamanho de Plutão; sua descoberta levou Plutão a ser reclassificado em 2006.' },
  { sstr: '136108', name: 'Haumea', desc: 'Planeta anão que gira tão rápido (4 horas) que ficou ovalado, e tem anéis.' },
  { sstr: '136472', name: 'Makemake', desc: 'Planeta anão do Cinturão de Kuiper.' },
  { sstr: '90377', name: 'Sedna', desc: 'Leva 11 mil anos para dar uma volta no Sol; nunca chega perto de Netuno.' },
  { sstr: '50000', name: 'Quaoar', desc: 'Tem um anel muito longe do corpo, onde a física diz que não deveria existir.' },
  { sstr: '225088', name: 'Gonggong', desc: 'Planeta anão avermelhado, um dos mais distantes conhecidos.' },
  { sstr: '2060', name: 'Quíron', desc: 'Um centauro: metade asteroide, metade cometa, entre Saturno e Urano.' },
  // ---------------------------------------------------------------- cometas
  { sstr: '1P', name: 'Cometa Halley', desc: 'O cometa mais famoso: volta a cada 76 anos. A próxima passagem é em 2061. É a origem das chuvas Eta Aquarídeas e Orionídeas.', visited: 'Giotto (ESA), Vega 1 e 2 (URSS) em 1986' },
  { sstr: '2P', name: 'Cometa Encke', desc: 'O cometa de período mais curto conhecido: 3,3 anos. Origem das Táuridas.' },
  { sstr: '67P', name: 'Cometa 67P/Churyumov–Gerasimenko', desc: 'Em forma de pato de borracha; primeiro cometa orbitado e com pouso (Philae).', visited: 'Rosetta e Philae (ESA, 2014–2016)' },
  { sstr: '109P', name: 'Cometa Swift–Tuttle', desc: 'Origem das Perseidas. Com 26 km, é o maior objeto que cruza a órbita da Terra repetidamente.' },
  { sstr: '55P', name: 'Cometa Tempel–Tuttle', desc: 'Origem das Leônidas, que às vezes viram tempestades de milhares de meteoros por hora.' },
  { sstr: '21P', name: 'Cometa Giacobini–Zinner', desc: 'Origem das Draconídeas; primeiro cometa atravessado por uma nave.', visited: 'ICE (NASA, 1985)' },
  { sstr: '8P', name: 'Cometa Tuttle', desc: 'Origem das Úrsidas.' },
  { sstr: '9P', name: 'Cometa Tempel 1', desc: 'Atingido de propósito por um projétil da missão Deep Impact.', visited: 'Deep Impact (2005) e Stardust (2011)' },
  { sstr: '81P', name: 'Cometa Wild 2', desc: 'A nave Stardust trouxe poeira dele para a Terra.', visited: 'Stardust (NASA, 2004)' },
  { sstr: '103P', name: 'Cometa Hartley 2', desc: 'Pequeno e hiperativo, soltando jatos de CO₂.', visited: 'EPOXI (NASA, 2010)' },
  { sstr: 'C/1995 O1', name: 'Cometa Hale–Bopp', desc: 'Visível a olho nu por 18 meses em 1996–97; volta em uns 2.400 anos.' },
  { sstr: 'C/2020 F3', name: 'Cometa NEOWISE', desc: 'O cometa brilhante de julho de 2020.' },
  { sstr: 'C/2023 A3', name: 'Cometa Tsuchinshan–ATLAS', desc: 'O cometa brilhante de outubro de 2024.' },
  { sstr: 'C/1861 G1', name: 'Cometa Thatcher', desc: 'Origem das Líridas, a chuva de meteoros registrada há mais tempo (687 a.C.).' },
  { sstr: '2003 EH1', name: '2003 EH1', desc: 'Provavelmente um cometa extinto: é a origem das Quadrântidas.' },
  // ---------------------------------------------------------------- interestelares
  { sstr: '1I', name: "1I/ʻOumuamua", desc: 'O primeiro objeto vindo de outra estrela a passar pelo Sistema Solar (2017). Alongado e sem cauda visível; acelerou de forma estranha.' },
  { sstr: '2I', name: '2I/Borisov', desc: 'O segundo visitante interestelar (2019), e o primeiro claramente um cometa.' },
  { sstr: '3I', name: '3I/ATLAS', desc: 'O terceiro visitante interestelar, descoberto em julho de 2025. Pode ser mais velho que o próprio Sistema Solar.' },
];

// Chuvas de meteoros: radiante (graus, J2000), pico (mês e dia), taxa horária zenital, velocidade e corpo de origem
export const SHOWERS = [
  { name: 'Quadrântidas', peak: [1, 3], ra: 230, dec: 49, zhr: 110, v: 41, parent: '2003 EH1', const: 'Boieiro' },
  { name: 'Líridas', peak: [4, 22], ra: 271, dec: 34, zhr: 18, v: 49, parent: 'C/1861 G1', const: 'Lira' },
  { name: 'Eta Aquarídeas', peak: [5, 6], ra: 338, dec: -1, zhr: 50, v: 66, parent: '1P', const: 'Aquário', note: 'Melhor no Hemisfério Sul.' },
  { name: 'Perseidas', peak: [8, 12], ra: 48, dec: 58, zhr: 100, v: 59, parent: '109P', const: 'Perseu', note: 'Melhor no Hemisfério Norte.' },
  { name: 'Draconídeas', peak: [10, 8], ra: 262, dec: 54, zhr: 10, v: 20, parent: '21P', const: 'Dragão' },
  { name: 'Orionídeas', peak: [10, 21], ra: 95, dec: 16, zhr: 20, v: 66, parent: '1P', const: 'Órion' },
  { name: 'Táuridas do Sul', peak: [11, 5], ra: 52, dec: 15, zhr: 5, v: 27, parent: '2P', const: 'Touro', note: 'Poucos meteoros, mas com bolas de fogo.' },
  { name: 'Leônidas', peak: [11, 17], ra: 152, dec: 22, zhr: 15, v: 71, parent: '55P', const: 'Leão', note: 'A cada ~33 anos vira tempestade.' },
  { name: 'Geminídeas', peak: [12, 14], ra: 112, dec: 33, zhr: 150, v: 35, parent: '3200', const: 'Gêmeos', note: 'A chuva mais forte do ano; boa nos dois hemisférios.' },
  { name: 'Úrsidas', peak: [12, 22], ra: 217, dec: 76, zhr: 10, v: 33, parent: '8P', const: 'Ursa Menor' },
];
