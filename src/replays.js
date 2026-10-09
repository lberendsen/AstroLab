// Roteiros dos replays de missões. Cada passo começa numa data: mostra um texto, define a velocidade do tempo
// (segundos simulados por segundo real) e, se tiver "focus", leva a câmera até ali.
// focus: { craft: id, dist: km } · { body: chave, dist: km } · { system: UA } (vista de cima do Sistema Solar)
//        · { surface: id } (robô na superfície) · { earthMoon: true }
const H = 3600, D = 86400;

export const REPLAYS = [
  {
    id: 'apollo11', title: 'Apollo 11 (1969)', sub: 'Os primeiros passos na Lua', craft: ['apollo11'],
    start: '1969-07-16T16:46Z', end: '1969-07-21T18:00Z',
    note: 'A trajetória até a Lua é a do terceiro estágio do foguete (o JPL não guarda a da cápsula); em volta da Lua, uma órbita de 110 km.',
    steps: [
      { at: '1969-07-16T16:46Z', rate: 20 * 60, focus: { craft: 'apollo11', dist: 40000 }, text: '16 de julho de 1969. Três horas depois do lançamento, o terceiro estágio do Saturno V acaba de acender de novo: a nave com Armstrong, Aldrin e Collins sai da órbita da Terra rumo à Lua.' },
      { at: '1969-07-17T03:00Z', rate: 3 * H, focus: { earthMoon: true }, text: 'Três dias de viagem e 384 mil km. A nave vai perdendo velocidade enquanto sobe, puxada de volta pela gravidade da Terra.' },
      { at: '1969-07-19T16:20Z', rate: 10 * 60, focus: { body: 'Moon', dist: 9000 }, text: '19 de julho. Atrás da Lua, sem contato com a Terra, a Columbia acende o motor e entra em órbita, a 110 km da superfície.' },
      { at: '1969-07-20T19:30Z', rate: 60, focus: { surface: 'apollo11' }, text: '20 de julho, 20h17 (UTC): "Houston, aqui Base Tranquilidade. A Águia pousou." Seis horas depois, Neil Armstrong desce a escada.' },
      { at: '1969-07-20T21:00Z', rate: 2 * H, focus: { body: 'Moon', dist: 6000 }, text: 'Michael Collins segue sozinho na Columbia, dando uma volta na Lua a cada duas horas. No dia 21 a Águia decola e se reencontra com ele.' },
    ],
  },
  {
    id: 'voyager', title: 'Voyager: o Grand Tour (1977–hoje)', sub: 'Júpiter, Saturno, Urano, Netuno e o espaço interestelar', craft: ['voyager1', 'voyager2'],
    start: '1977-08-20T15:45Z', end: '2026-09-30T00:00Z',
    steps: [
      { at: '1977-08-20T15:45Z', rate: 6 * H, focus: { craft: 'voyager2', dist: 60000 }, text: '20 de agosto de 1977. A Voyager 2 sai primeiro. Um alinhamento raro dos planetas, que só se repete a cada 175 anos, permite visitar os quatro gigantes numa só viagem.' },
      { at: '1977-09-05T14:30Z', rate: 6 * H, focus: { craft: 'voyager1', dist: 60000 }, text: '5 de setembro. A Voyager 1 parte por um caminho mais rápido e ultrapassa a irmã antes de chegar a Júpiter.' },
      { at: '1977-09-20T00:00Z', rate: 20 * D, focus: { system: 9 }, text: 'Rumo a Júpiter: 640 milhões de km em um ano e meio.' },
      { at: '1979-02-28T00:00Z', rate: 6 * H, focus: { body: 'Jupiter', dist: 7e6 }, follow: 'voyager1', text: 'Março de 1979: a Voyager 1 passa por Júpiter. A gravidade do planeta curva o caminho e acelera a nave: é o "estilingue gravitacional". Ela descobre vulcões ativos em Io.' },
      { at: '1979-03-12T00:00Z', rate: 20 * D, focus: { system: 9 }, text: 'Cada nave sai de Júpiter mais rápida do que chegou.' },
      { at: '1979-07-04T00:00Z', rate: 6 * H, focus: { body: 'Jupiter', dist: 7e6 }, follow: 'voyager2', text: 'Julho de 1979: a Voyager 2 passa por Júpiter, mirando Saturno.' },
      { at: '1979-07-15T00:00Z', rate: 30 * D, focus: { system: 13 }, text: 'Próxima parada: Saturno.' },
      { at: '1980-11-09T00:00Z', rate: 5 * H, focus: { body: 'Saturn', dist: 4e6 }, follow: 'voyager1', text: 'Novembro de 1980: a Voyager 1 passa rente a Titã, a maior lua de Saturno. O desvio a joga para fora do plano dos planetas: ela não visita mais nenhum.' },
      { at: '1980-11-17T00:00Z', rate: 30 * D, focus: { system: 14, tilt: true }, text: 'Repare na Voyager 1 subindo, saindo do plano das órbitas.' },
      { at: '1981-08-22T00:00Z', rate: 5 * H, focus: { body: 'Saturn', dist: 4e6 }, follow: 'voyager2', text: 'Agosto de 1981: a Voyager 2 passa por Saturno, e o estilingue a manda para Urano.' },
      { at: '1981-09-01T00:00Z', rate: 60 * D, focus: { system: 24 }, text: 'Quatro anos e meio até Urano.' },
      { at: '1986-01-21T00:00Z', rate: 4 * H, focus: { body: 'Uranus', dist: 2e6 }, follow: 'voyager2', text: 'Janeiro de 1986: a primeira e única visita a Urano, o planeta que gira deitado. Ela descobre 10 luas novas.' },
      { at: '1986-01-29T00:00Z', rate: 60 * D, focus: { system: 34 }, text: 'Mais três anos e meio até Netuno.' },
      { at: '1989-08-22T00:00Z', rate: 3 * H, focus: { body: 'Neptune', dist: 1.5e6 }, follow: 'voyager2', text: 'Agosto de 1989: Netuno. A nave passa 4.950 km acima das nuvens e vê os gêiseres de Tritão. Fim do Grand Tour.' },
      { at: '1989-08-30T00:00Z', rate: 90 * D, focus: { system: 60 }, text: '14 de fevereiro de 1990: a Voyager 1 se vira e fotografa a Terra a 6 bilhões de km: o "Pálido Ponto Azul".' },
      { at: '1991-01-01T00:00Z', rate: 365 * D, focus: { system: 190, tilt: true }, text: 'As duas seguem para fora. Em 2012 a Voyager 1 cruza a heliopausa, onde o vento do Sol para, e entra no espaço interestelar; a Voyager 2 a segue em 2018. Hoje elas ainda falam com a Terra.' },
    ],
  },
  {
    id: 'newhorizons', title: 'New Horizons até Plutão (2006–2019)', sub: 'A primeira visita a Plutão', craft: ['newhorizons'],
    start: '2006-01-19T20:30Z', end: '2019-01-05T00:00Z',
    steps: [
      { at: '2006-01-19T20:30Z', rate: 2 * H, focus: { craft: 'newhorizons', dist: 60000 }, text: '19 de janeiro de 2006: a nave mais rápida já lançada da Terra. Passa pela órbita da Lua em 9 horas.' },
      { at: '2006-02-02T00:00Z', rate: 20 * D, focus: { system: 9 }, text: 'Plutão ainda era um planeta quando ela partiu; foi reclassificado em agosto de 2006.' },
      { at: '2007-02-24T00:00Z', rate: 6 * H, focus: { body: 'Jupiter', dist: 1e7 }, follow: 'newhorizons', text: 'Fevereiro de 2007: o estilingue de Júpiter encurta a viagem em três anos.' },
      { at: '2007-03-06T00:00Z', rate: 60 * D, focus: { system: 40 }, text: 'Oito anos de viagem, a maior parte em hibernação.' },
      { at: '2015-07-12T00:00Z', rate: 2 * H, focus: { body: 'Pluto', dist: 2e5 }, follow: 'newhorizons', text: '14 de julho de 2015: Plutão de perto pela primeira vez. Montanhas de gelo de água, planícies de nitrogênio congelado e o famoso "coração".' },
      { at: '2015-07-17T00:00Z', rate: 30 * D, focus: { system: 50 }, text: 'Em 1º de janeiro de 2019 ela passou por Arrokoth, o objeto mais distante já visitado.' },
    ],
  },
  {
    id: 'cassini', title: 'Cassini em Saturno (1997–2017)', sub: '20 anos, 13 em volta de Saturno, e o Grand Finale', craft: ['cassini'],
    start: '1997-10-16T00:00Z', end: '2017-09-15T10:31Z',
    steps: [
      { at: '1997-10-16T00:00Z', rate: 10 * D, focus: { system: 3 }, text: 'Outubro de 1997. Pesada demais para ir direto a Saturno, a Cassini rouba velocidade de Vênus (duas vezes), da Terra e de Júpiter.' },
      { at: '1999-08-17T12:00Z', rate: 30 * 60, focus: { body: 'Earth', dist: 1e5 }, follow: 'cassini', text: 'Agosto de 1999: passagem pela Terra a 1.171 km de altura, a 19 km/s.' },
      { at: '1999-08-19T00:00Z', rate: 30 * D, focus: { system: 12 }, text: 'Dezembro de 2000: passagem distante por Júpiter, junto com a Galileo.' },
      { at: '2004-06-27T00:00Z', rate: 3 * H, focus: { body: 'Saturn', dist: 3e6 }, follow: 'cassini', text: '1º de julho de 2004: a Cassini cruza o plano dos anéis e entra em órbita de Saturno.' },
      { at: '2004-07-05T00:00Z', rate: 40 * D, focus: { body: 'Saturn', dist: 1.2e7 }, follow: 'cassini', text: 'Em 14 de janeiro de 2005 a sonda Huygens, levada pela Cassini, pousa em Titã: o pouso mais distante já feito. Nos anos seguintes, 294 órbitas e os gêiseres de Encélado.' },
      { at: '2017-04-21T00:00Z', rate: 2 * D, focus: { body: 'Saturn', dist: 8e5 }, follow: 'cassini', text: 'Abril de 2017, o Grand Finale: 22 mergulhos pelo vão entre o planeta e os anéis, um lugar onde nenhuma nave tinha ido.' },
      { at: '2017-09-14T18:00Z', rate: 20 * 60, focus: { craft: 'cassini', dist: 3e5 }, text: '15 de setembro de 2017: sem combustível, a Cassini mergulha em Saturno de propósito, para nunca contaminar Encélado ou Titã, que podem ter vida. Transmitiu até o fim.' },
    ],
  },
  {
    id: 'rosetta', title: 'Rosetta e o cometa 67P (2004–2016)', sub: 'Dez anos para alcançar um cometa', craft: ['rosetta', 'c67p'],
    start: '2004-03-03T00:00Z', end: '2016-09-30T11:00Z',
    steps: [
      { at: '2004-03-03T00:00Z', rate: 20 * D, focus: { system: 4 }, text: 'Março de 2004. Para igualar a velocidade de um cometa, a Rosetta passa três vezes pela Terra e uma por Marte.' },
      { at: '2007-02-24T18:00Z', rate: H, focus: { body: 'Mars', dist: 5e4 }, follow: 'rosetta', text: 'Fevereiro de 2007: passagem rasante por Marte, a 250 km.' },
      { at: '2007-02-26T00:00Z', rate: 30 * D, focus: { system: 6 }, text: 'Em 2011 a nave hiberna por 31 meses, longe demais do Sol para ter energia. Acorda em janeiro de 2014.' },
      { at: '2014-07-20T00:00Z', rate: 12 * H, focus: { craft: 'c67p', dist: 2000 }, follow: 'rosetta', text: '6 de agosto de 2014: a Rosetta chega ao cometa 67P, uma montanha de 4 km em forma de pato.' },
      { at: '2014-11-11T12:00Z', rate: 30 * 60, focus: { craft: 'c67p', dist: 120 }, text: '12 de novembro de 2014: o robô Philae se solta e pousa no cometa (quica duas vezes e para numa sombra).' },
      { at: '2014-11-13T00:00Z', rate: 10 * D, focus: { system: 3 }, text: 'Agosto de 2015: o cometa passa o mais perto do Sol e solta jatos de gás e poeira, com a Rosetta ao lado.' },
      { at: '2016-09-29T00:00Z', rate: 30 * 60, focus: { craft: 'c67p', dist: 40 }, text: '30 de setembro de 2016: a Rosetta desce devagar e encerra a missão pousando no próprio cometa.' },
    ],
  },
  {
    id: 'galileo', title: 'Galileo em Júpiter (1989–2003)', sub: 'A primeira nave a orbitar Júpiter', craft: ['galileo'],
    start: '1989-10-19T03:00Z', end: '2003-09-21T18:00Z',
    steps: [
      { at: '1989-10-19T03:00Z', rate: 10 * D, focus: { system: 3 }, text: 'Outubro de 1989: lançada do ônibus espacial Atlantis. Vênus e duas passagens pela Terra dão o impulso.' },
      { at: '1990-12-07T12:00Z', rate: 30 * 60, focus: { body: 'Earth', dist: 1.2e5 }, follow: 'galileo', text: 'Dezembro de 1990: de passagem, a Galileo examina a Terra como se fosse um planeta desconhecido e encontra sinais de vida (oxigênio, metano e sinais de rádio).' },
      { at: '1990-12-09T00:00Z', rate: 30 * D, focus: { system: 7 }, text: 'No caminho, a primeira foto de perto de um asteroide (Gaspra, 1991) e a descoberta da primeira lua de asteroide (Dáctilo, de Ida, 1993). Em 1994 ela vê o cometa Shoemaker-Levy 9 se chocar com Júpiter.' },
      { at: '1995-12-01T00:00Z', rate: 30 * D, focus: { body: 'Jupiter', dist: 2.5e7 }, follow: 'galileo', text: 'Dezembro de 1995: a sonda atmosférica mergulha em Júpiter e a nave entra em órbita. Oito anos estudando as luas, com sinais de um oceano sob o gelo de Europa.' },
      { at: '2003-09-20T00:00Z', rate: H, focus: { craft: 'galileo', dist: 5e5 }, text: '21 de setembro de 2003: para não arriscar contaminar Europa, a Galileo é jogada dentro de Júpiter.' },
    ],
  },
  {
    id: 'artemis1', title: 'Artemis I (2022)', sub: 'Teste da Orion, sem tripulação', craft: ['artemis1'],
    start: '2022-11-16T09:00Z', end: '2022-12-11T17:15Z',
    steps: [
      { at: '2022-11-16T09:00Z', rate: H, focus: { craft: 'artemis1', dist: 40000 }, text: '16 de novembro de 2022: o foguete SLS lança a cápsula Orion, sem astronautas, num teste completo da viagem à Lua.' },
      { at: '2022-11-17T00:00Z', rate: 4 * H, focus: { earthMoon: true }, text: 'Em 21 de novembro, ela passa a 130 km da Lua e segue para uma órbita alta e distante em volta dela.' },
      { at: '2022-11-28T12:00Z', rate: 4 * H, focus: { earthMoon: true, far: true }, text: '28 de novembro: 432 mil km da Terra, mais longe que qualquer nave feita para pessoas.' },
      { at: '2022-12-05T13:00Z', rate: 30 * 60, focus: { body: 'Moon', dist: 15000 }, follow: 'artemis1', text: '5 de dezembro: nova passagem rasante, a 127 km da Lua, para pegar o caminho de volta.' },
      { at: '2022-12-06T00:00Z', rate: 4 * H, focus: { earthMoon: true }, text: '11 de dezembro: a Orion entra na atmosfera a 40 mil km/h e cai no Pacífico.' },
    ],
  },
  {
    id: 'artemis2', title: 'Artemis II (2026)', sub: 'Pessoas em volta da Lua de novo, depois de 53 anos', craft: ['artemis2'],
    start: '2026-04-02T02:05Z', end: '2026-04-10T23:45Z',
    steps: [
      { at: '2026-04-02T02:05Z', rate: H, focus: { craft: 'artemis2', dist: 40000 }, text: 'Abril de 2026: Reid Wiseman, Victor Glover, Christina Koch e Jeremy Hansen a bordo da Orion. A primeira mulher, a primeira pessoa negra e o primeiro não americano a viajar até a Lua.' },
      { at: '2026-04-03T00:00Z', rate: 3 * H, focus: { earthMoon: true }, text: 'Uma trajetória de "retorno livre": se o motor falhar, a própria gravidade da Lua traz a nave de volta.' },
      { at: '2026-04-06T19:00Z', rate: 20 * 60, focus: { body: 'Moon', dist: 25000 }, follow: 'artemis2', text: '6 de abril, 23h (UTC): a volta por trás da Lua, a 6.500 km da superfície e a 413 mil km da Terra: as pessoas mais distantes da Terra desde 1972.' },
      { at: '2026-04-07T06:00Z', rate: 3 * H, focus: { earthMoon: true }, text: 'O caminho de volta. Amerissagem no Pacífico em 10 de abril.' },
    ],
  },
];
