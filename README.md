# AstroLab

Navegador 3D do universo com dados reais: planetas na posição de agora, 109 mil estrelas, 6.445 exoplanetas,
43 mil galáxias, fotos reais de nebulosas e galáxias, busca por nome em todo o céu catalogado (SIMBAD) e um
telescópio com mais de 50 filtros, de raios gama a ondas de rádio.

## Como abrir

Dê dois cliques em **`AstroLab.bat`**: ele sobe o servidor local e abre `http://localhost:8080` no navegador.
Também dá para rodar direto com `node serve.mjs`. Precisa de internet para as bibliotecas (CDN), as fotos,
a busca no SIMBAD e o telescópio.

## Lugares (painel da esquerda)

O universo é para passear, então os destinos ficam sempre à mão: o painel da esquerda é permanente e o 3D ocupa
o resto da tela. Todos os lugares estão numa árvore que começa recolhida, para se ver de relance todas as categorias:
tours, planetário, Sistema Solar (cada planeta com as luas e os robôs), feito pelo homem, estrelas com nome próprio,
os cerca de 4,8 mil sistemas de exoplanetas por distância, as 88 constelações em 3D, nebulosas, fenômenos extremos, galáxias
e o universo distante (mais de 12 mil destinos). Um clique no nome viaja; a seta abre e fecha.

- **Busca no topo:** filtra a árvore inteira enquanto se digita. Abaixo, "No catálogo inteiro" procura também o que
  não está na árvore: o índice local (milhões de estrelas, galáxias, asteroides, satélites) e, por último, o SIMBAD,
  com bilhões de objetos. `Enter` vai para o primeiro resultado; `Esc` limpa.
- **Largura:** arraste a borda direita do painel. Duplo clique na borda, o botão « ou a tecla `L` recolhem o painel
  numa faixa estreita (✦ abre de novo, 🔍 abre já na busca). A largura e o estado ficam guardados no navegador.

## Controles

| | |
|---|---|
| Arrastar | girar em volta do alvo / olhar em volta |
| Roda do mouse | aproximar / afastar |
| Clique / duplo clique | selecionar / viajar até lá |
| `Tab` | alternar entre orbitar e voar livre (`W A S D`, `R F`, `Q E`, `Shift` = turbo) |
| `U` | Tours guiados |
| `K` | Fenômenos: ondas gravitacionais, explosões, buracos negros, pulsares, estruturas |
| `P` | Planetário: o céu de um lugar da Terra, da Lua ou de Marte |
| `Y` | Tempo: data, eclipses e replays de missões |
| `X` | Transmissões: imagens e sinais dos aparelhos do catálogo |
| `V` | "Onde fica, visto da Terra": linha Terra ↔ objeto selecionado |
| `M` | mostrar / esconder a massaroca de satélites em volta da Terra |
| `/` | procurar · `G` ir até o selecionado · `T` telescópio · `L` recolher/abrir os lugares · `H` ajuda |
| `espaço` `,` `.` | pausar / desacelerar / acelerar o tempo |

## Dados

`tools/build-data.mjs` baixa e compacta os catálogos em `data/` e as texturas em `textures/`.
Os arquivos brutos ficam em `tools/raw/` como cache. Para atualizar (por exemplo, quando saírem
novos exoplanetas): `node tools/build-data.mjs exoplanets --force`.

| O quê | Fonte |
|---|---|
| Estrelas | HYG v4.1 (Hipparcos + Yale + Gliese) |
| Planetas, luas, rotação | Astronomy Engine (efemérides VSOP87 e modelos da IAU) |
| Exoplanetas | NASA Exoplanet Archive, tabela `pscomppars` |
| Galáxias | 2MASS Redshift Survey (Huchra et al. 2012), distância pela lei de Hubble com H₀ = 70 |
| Objetos famosos | lista em `tools/curated.mjs`, com coordenadas e tamanhos do SIMBAD |
| Busca livre | Sesame + SIMBAD TAP (distância pela mediana das medidas publicadas, pela paralaxe ou pelo redshift) |
| Fotos e telescópio | HiPS do CDS via hips2fits e Aladin Lite (JWST, Hubble, DESI, DSS, WISE, Planck, Fermi…) |
| Texturas | Solar System Scope (CC BY 4.0) |
| Quasares | SDSS DR16Q (Lyke et al. 2020), 750 mil, posicionados pela distância comóvel do redshift |
| Borda do universo observável | Radiação cósmica de fundo do Planck (R3), numa esfera a 44 bilhões de anos-luz |
| Recordistas | TON 618, APM 08279+5255, ULAS J1342+0928, J0313−1806, GN-z11, JADES-GS-z14-0, MoM-z14 |
| Naves no espaço profundo | JPL Horizons (32 trajetórias reais) + 7 posições aproximadas para missões sem efeméride pública (China, Índia, Rússia) — lista em `tools/spacecraft.mjs` |
| Robôs e pousos | 38 locais na Lua, em Marte e em Vênus (coordenadas publicadas pelas missões) |
| Satélites da Terra | CelesTrak: ~17 mil objetos (elementos GP) com o país dono (SATCAT) |

### Transmissões (`src/feeds.js`, `src/earthskin.js`)

O botão **📡 Transmissões** (tecla `X`) abre as imagens que os aparelhos do catálogo mandam para a Terra. A ficha de cada aparelho tem o botão "O que ele transmite".

| Canal | Fonte | Atualização |
|---|---|---|
| A Terra agora: GOES-19/18, Himawari-9, Meteosat-12, Fengyun-4B | NOAA STAR, NICT, EUMETSAT, CMA | 10–15 min |
| Terra ao vivo no globo 3D: mosaico dos 5 geoestacionários | GIBS + EUMETSAT + NICT | refeito a cada 15 min |
| A Terra inteira de 1,5 milhão de km | DSCOVR/EPIC | diária, com 2–3 dias de atraso |
| Planeta inteiro, queimadas, luzes noturnas, temperatura do mar | NASA GIBS (NOAA-20/21, Suomi NPP, Terra, Aqua) | diária (dia anterior) |
| O Sol | GOES-SUVI, SOHO-LASCO, SDO | minutos a horas |
| O que o JWST e o Hubble observaram | arquivo MAST, últimos 10 dias | contínua |
| Imagens divulgadas do Webb e do Hubble | ESA/Webb e ESA/Hubble | quando há divulgação |
| Fotos brutas de Marte | Perseverance e Curiosity (NASA) | diária |
| Vídeo ao vivo da ISS | canal da NASA no YouTube | ao vivo |
| Rede de Espaço Profundo | DSN Now (NASA/JPL), com linhas antena → nave no 3D | 30 s |

Notas:

- **Repassador:** fontes que não liberam o navegador (CORS) passam pelo `/proxy` do `serve.mjs`, com lista fixa de domínios e cache de 5 min.
- **Disponibilidade:** as fontes são externas e às vezes saem do ar. Cada canal tem tempo-limite e avisa em vez de travar, e a Terra ao vivo usa os satélites que responderem.

### Onde fica, visto da Terra

Botão na ficha de qualquer objeto, ou tecla `V`. Desenha uma linha da superfície da Terra até o objeto e oferece duas câmeras:

- **Lado a lado:** a Terra numa ponta, o objeto na outra e a distância no meio. A câmera fica um pouco acima do plano das órbitas.
- **Olhar da Terra:** a câmera fica atrás da Terra, com o planeta embaixo na tela e a linha subindo até o objeto, na direção em que ele está no céu.

O painel da esquerda mostra:

- a constelação em que o objeto aparece;
- a direção dele na Via Láctea;
- a distância ao Sol no céu, para objetos do Sistema Solar;
- a posição agora para quem está em São Paulo (ou na sua localização, pelo botão 📍): se está acima do horizonte, em que direção e a altura máxima que alcança.

### Mais fiel de perto (Fase 6)

| O quê | Fonte | Arquivo |
|---|---|---|
| Relevo da Lua (1440×720, altitude em metros) | LRO LOLA (NASA SVS, `ldem_4.tif`) | `data/dem-moon.bin` |
| Relevo de Marte (2048×1024) | MGS MOLA, via hips2fits | `data/dem-mars.bin` |
| Relevo de Mercúrio (2048×1024) | MESSENGER, via hips2fits | `data/dem-mercury.bin` |
| Texturas 8K (Terra de dia e de noite, nuvens, Lua, Marte, Mercúrio, Júpiter, Saturno) | Solar System Scope (CC BY 4.0) | `textures/8k/` (originais, fora do git) |
| As mesmas, em 4096×2048 para o navegador | geradas por `node tools/resize-textures.mjs` | `textures/4k/` (fora do git) |

Os passos `textures8k` e `dems` de `tools/build-data.mjs` baixam as texturas e os relevos. Depois, com o servidor rodando (`node serve.mjs 8080`), `node tools/resize-textures.mjs` gera as versões 4K. Sem elas, o app funciona com as texturas 2K.

Em Camadas → **Planetas de perto**: liga e desliga as texturas em alta resolução e escolhe o exagero do relevo (real, 3×, 6×, 12×). Na escala real, o Monte Olimpo é só um calombo na borda de Marte. Para diagnóstico, `?fx=rhesa` na URL liga só os efeitos listados: r relevo, h alta resolução, e Terra noturna, s Saturno, a atmosferas (`?fx=-` desliga todos).

### Mais universo (Fase 5)

| O quê | Fonte | Arquivo |
|---|---|---|
| 2,2 milhões de estrelas a menos de 650 anos-luz (paralaxe com erro < 10%) | Gaia DR3 (ESA), via TAP | `data/gaia.bin` (17 MB, 8 bytes por estrela) |
| 2.481 pulsares com distância | Catálogo ATNF (VizieR B/psr) | `data/pulsars.json` |
| 184 luas (além da Lua e das galileanas), com elementos orbitais | JPL Horizons | `data/moons.json` |
| Mapas de 19 luas e de Plutão | HiPS do CDS (Voyager, Galileo, Cassini, New Horizons) | `textures/moons/` |
| 9 buracos negros com massa medida, imagens do EHT | literatura + ESO/EHT | `tools/curated.mjs`, `src/ui/phenomena.js` |
| 282 detecções de ondas gravitacionais | GWOSC, ao vivo | — |
| Supernovas e explosões dos últimos 30 dias | Transient Name Server, ao vivo | — |
| 10 superaglomerados e vazios | literatura (posição e tamanho aproximados) | `src/layers/phase5.js` |

O botão **💥** (tecla `K`) abre o painel de fenômenos, com cinco abas:

- **Ondas gravitacionais:** ao escolher uma, aparece a casca a essa distância, porque a direção é incerta. GW170817 leva à galáxia NGC 4993.
- **Explosões recentes:** as que têm redshift permitem viajar até lá; as outras abrem no telescópio.
- **Buracos negros:** o horizonte de eventos aparece em escala real, com disco de acreção ilustrativo nos que se alimentam de uma companheira.
- **Pulsares:** no 3D, piscam no ritmo real até ~5 Hz; os mais rápidos ficam acesos.
- **Estruturas:** Laniakea, o Grande Atrator, a Grande Muralha Sloan e o Vazio de Boötes, desenhados em arame sobre as galáxias reais.

Notas:

- **Luas:** giram em rotação sincronizada; o telescópio abre o mapa da superfície (o radar da Cassini mostra os lagos de Titã).
- **Gaia:** carrega quando a nave está a menos de ~2.600 anos-luz do Sol e só desenha as estrelas que podem aparecer daquela posição.
- **Desempenho:** a Via Láctea em modelo agora desenha menos pontos quando está fraca (a 700 pc, foi de 20 para 71 fps).

### Tours guiados (Fase 4)

O ramo **🎬 Tours guiados** dos Lugares (ou a tecla `U`) traz cinco viagens narradas. A câmera, o tempo e as camadas andam sozinhos; ⏮ ❚❚ ⏭ controlam, e ✕ encerra.

- **Do seu quarto ao universo observável** (13 paradas): do céu de São Paulo à radiação cósmica de fundo.
- **A vida de uma estrela** (12): berçário, aglomerado, o Sol, gigante vermelha, nebulosa planetária, anã branca, supergigante, supernova, pulsar e buraco negro.
- **Somos feitos de poeira de estrelas** (8): de onde vêm os átomos do corpo humano.
- **A corrida espacial e as missões de hoje** (12): de Luna 2 (1959) a Artemis II (2026), com a data ajustada em cada parada.
- **Existe vida lá fora?** (9): Terra, Marte, Europa, Saturno, Proxima b, TRAPPIST-1, K2-18 b, Kepler-452 b e o Disco de Ouro da Voyager.

Algumas paradas têm um botão extra, como "ver em raios X" no telescópio ou a transmissão ao vivo da ISS.

**Criar um tour sem programar:** os roteiros ficam em `data/tours/*.json`, listados em `data/tours/index.json`. Cada passo tem `text` (narração) e, opcionalmente:

| Campo | O que faz |
|---|---|
| `go` | nome para procurar (`"Saturno"`, `"M 42"`) ou vista especial (`@milkyway`, `@web`, `@qso`, `@cmb`, `@sistema:9`, `@terra-lua`, `@grupolocal`) |
| `dist` + `unit` | distância de chegada (`km`, `ua`, `al` = anos-luz, `pc`, `raios`) |
| `date`, `rate`, `pause` | data (ISO ou `"now"`), velocidade do tempo (segundos por segundo) e pausa |
| `planetarium` | `{ body, lat, lon, name, az, alt, fov }`: pousar e olhar para uma direção |
| `constSpace` | `"Ori"` (só uma constelação em 3D), `true` ou `false` |
| `select`, `telescope` | selecionar um objeto ou abrir o telescópio nele |
| `button` | `{ label, feed }` ou `{ label, telescope }`: botão opcional na legenda |
| `hold` | segundos a mais antes de avançar |

O teste de fumaça confere se todos os alvos dos tours existem na busca.

### Planetário (Fase 2)

O ramo **🌅 Planetário** dos Lugares (ou a tecla `P`, que usa o último lugar escolhido) põe você em pé num lugar da Terra, da Lua ou de Marte, na data simulada. A ficha dos robôs e pousos tem o botão "Ver o céu daqui".

- **Olhar em volta:** arrastar o mouse; a roda faz zoom de 110° a 1°, como um binóculo.
- **Lugares:** capitais brasileiras, observatórios, os polos e lugares da Lua e de Marte, ou qualquer latitude e longitude. O 📍 usa a sua localização.
- **Céu:** chão no lugar do planeta.
  - **Na Terra:** atmosfera que clareia com o Sol, crepúsculo e halo.
  - **Em Marte:** céu cor de caramelo e pôr do sol azul.
  - **Na Lua:** céu preto mesmo de dia.
- **Camadas:** linhas e nomes das 88 constelações (Stellarium, padrão IAU), grade de altura e azimute, equador celeste, eclíptica e pontos cardeais.
- **No céu agora:** o que está acima do horizonte, com altura, direção e magnitude. Na Terra também mostra o nascer e o pôr do Sol.
- **Estações espaciais:** passagens visíveis da ISS, da Tiangong e do Hubble nas próximas 72 h (a estação iluminada e o céu escuro); clicar leva ao momento da passagem.
- **Conjunções:** encontros de planetas e da Lua nos próximos 12 meses; clicar leva ao melhor horário para ver.
- **Constelações em 3D:** as linhas ligam as posições 3D reais das estrelas. Em **Camadas → Constelações no espaço**, ou no lugar "Órion de lado", dá para ver que as estrelas de uma constelação estão a distâncias muito diferentes.

Limites:

- **Refração e brilho:** não há refração atmosférica nem apagamento das estrelas perto do horizonte.
- **Chão:** é plano, sem relevo; o relevo fica para a Fase 6.
- **Estrelas:** 24 das 819 linhas de constelação ficaram de fora, porque usam estrelas que não estão no catálogo HYG.

### Viajar no tempo (Fase 3)

O botão **🕰️ Tempo** (tecla `Y`) tem três abas.

- **Data:** escolher qualquer data e hora.
  - Uma régua de 1900 a 2100.
  - Outra de 100 mil anos atrás a 100 mil anos à frente.
  - Atalhos para momentos marcantes (as pirâmides, o ano 1, Vega como estrela polar, Alfa Centauri no ponto mais próximo).
  - As estrelas se movem com as velocidades do catálogo (Hipparcos), e o relógio vai até 1.000 anos por segundo.
- **Eclipses:** os próximos eclipses solares e lunares (Astronomy Engine) e alguns famosos, como Sobral 1919 e o anular de 2027 no sul do Brasil. Ao escolher um, a sombra aparece no globo, calculada ponto a ponto pela posição real do Sol, da Lua e da Terra. A Lua fica avermelhada no eclipse lunar total.
- **Missões:** replays narrados com trajetórias reais do JPL Horizons:
  - Apollo 11, Voyager 1 e 2 (de 1977 até hoje), New Horizons, Cassini, Rosetta e o cometa 67P, Galileo, Artemis I e Artemis II.
  - O tempo acelera e desacelera sozinho, a câmera acompanha cada passagem por um planeta, e a barra do replay permite pausar, pular de trecho ou sair.

Detalhes técnicos:

- **Trajetórias em trechos (`tools/history.mjs` → `data/history.*`):** em cada passagem por um planeta, um trecho fino (10–30 min) centrado nele mostra a curva do estilingue gravitacional. Em cada data, vale o trecho mais fino disponível.
- **Depois do fim dos dados:** só as naves que estão escapando do Sistema Solar (Voyager, Pioneer, New Horizons) seguem em linha reta; as outras somem.
- **Robôs e pousos** só aparecem na superfície a partir da data em que pousaram.

Limites:

- **Planetas:** são calculados entre os anos 200 e 3800 (alcance da tabela de Plutão da biblioteca). Fora disso, ficam parados, e o relógio avisa "planetas fixos".
- **Satélites da Terra:** só aparecem até 4 meses longe de hoje, porque as órbitas públicas envelhecem.
- **Foto do céu de fundo:** some a mais de alguns séculos de hoje, porque é o céu atual.
- **Apollo 11:** a trajetória até a Lua é a do terceiro estágio do foguete, que viajou junto até o dia 17 (o JPL não guarda a da cápsula). Em volta da Lua, a nave segue uma órbita circular de 110 km.
- **Eclipses:** o contraste da penumbra é realçado para ficar visível na tela.

### Asteroides e cometas (Fase 1)

| O quê | Fonte | Arquivos |
|---|---|---|
| 1,57 milhão de asteroides, ordenados por tamanho em 3 blocos | JPL SBDB Query API | `data/ast-0..2.bin` (elementos), `.meta` (classe e magnitude H) |
| 77 mil nomes e designações (com nome, próximos da Terra, Kuiper, centauros) | JPL SBDB | `data/ast-names.json` |
| 4.080 cometas | JPL SBDB | `data/comets.json` |
| 50 famosos, com tamanho medido, rotação, descoberta e a nave que visitou | JPL SBDB API + `tools/smallbodies.mjs` | `data/smallbodies-famous.json` |
| Próximas aproximações da Terra (60 dias) | JPL CAD API, ao vivo | — |
| 10 chuvas de meteoros, com radiante e corpo de origem | IMO (valores de referência) | `tools/smallbodies.mjs` |

Como funciona:

- **Movimento:** os asteroides andam na GPU (Kepler resolvido por vértice, na data simulada).
- **Carregamento:** os 100 mil maiores carregam com o app (2,5 MB); o resto (34 MB) baixa sozinho quando você entra no Sistema Solar.
- **Nível de detalhe:** os blocos de asteroides menores só aparecem com a câmera perto do Sol, e somem quando você está colado num planeta ou numa nave.
- **Cometas:** a cauda de íons (azul) aponta para longe do Sol; a de poeira (amarelada) se curva para trás da órbita. O comprimento é estimado pela atividade do cometa (M1) e pela distância ao Sol.
- **Asteroide clicado na nuvem:** a ficha busca no JPL, na hora, o nome completo, o tamanho medido e a descoberta.

O que é ilustrativo:

- A forma 3D dos asteroides e cometas (o tamanho é real).
- O espalhamento da poeira das chuvas de meteoros.
- As datas de periélio extrapoladas para órbitas longas, porque os planetas perturbam a órbita.

### Universo distante

- **Cosmologia:** ΛCDM plano, com H₀ = 70, Ωm = 0,3 e radiação, em `src/astro.js`. Idade do universo: 13,46 bilhões de anos.
- **Distâncias:** são comóveis, isto é, onde o objeto está hoje. A ficha também mostra quanto tempo a luz viajou e a idade do universo quando ela saiu. Perto de casa as duas coisas coincidem; longe, a expansão do universo as separa.
- **Mapa dos quasares:** visto de fora, tem forma de cunha porque o SDSS só cobriu parte do céu.
- **Esfera da radiação cósmica de fundo:** é a borda do universo observável **a partir da Terra**, e está centrada em nós. A faixa clara no mapa é a região do disco da Via Láctea, que o Planck preenche por interpolação.
- **Brilho dos recordistas:** a magnitude absoluta deles é estimada.

### Objetos feitos pelo homem

- **Satélites:** a "massaroca" em volta da Terra começa desligada; só as estações aparecem.
  - A tecla **`M`** liga e desliga tudo.
  - Em **Camadas → Em volta da Terra** dá para escolher por tipo (megaconstelações, navegação, geoestacionários, outros, detritos) e por país.
  - As posições são calculadas na GPU pelos elementos orbitais (Kepler + J2 + arrasto), com erro de alguns km.
- **Atualização automática:** o `serve.mjs` atualiza os satélites uma vez por dia e as trajetórias uma vez por semana. A CelesTrak bloqueia (403) quem baixa o mesmo grupo mais de uma vez em 2 horas; por isso há cache em `tools/raw/`, e, se o grupo `active` for recusado, o catálogo é montado pelos grupos temáticos.
- **Limitação:** a maior parte dos ~35 mil objetos rastreados (detritos e estágios de foguete) só está disponível no Space-Track, que exige conta; aqui entram os detritos das quatro colisões e testes antissatélite que a CelesTrak publica.
- **Modelos 3D:** são simplificados, mas em tamanho real. Os jipes que andam (Curiosity, Perseverance) estão numa posição recente aproximada.

O que é **ilustrativo**, e o app avisa onde aparece:

- A Via Láctea vista de fora é um modelo com parâmetros medidos.
- A cor dos exoplanetas e a inclinação das órbitas que não foram medidas.
- O achatamento e a orientação das manchas de galáxias distantes.
- As fotos de nebulosas e galáxias são a vista da Terra; vistas de outro ângulo, continuam sendo a mesma foto.

## Desenvolvimento

- `npm install` instala a dependência de teste (`puppeteer-core`, que usa o Edge ou o Chrome já instalado).
- `npm run smoke` roda o teste de fumaça: visita os lugares principais e reprova com erro de JavaScript. As capturas ficam em `tools/smoke-out/`. Com `npm run smoke -- rapido`, pula as paradas que dependem de fontes externas. Com `-- ate=massaroca`, para depois dessa parada; com a variável `SMOKE_VERBOSE=1`, mostra todos os avisos do console junto com a parada em que aconteceram. Também reprova se o contexto WebGL cair (tela em branco).
- **F3** dentro do app abre o painel de desempenho: quadros por segundo, tempo de CPU de cada etapa do quadro e o que a GPU desenhou. Se a CPU gasta pouco e os fps caem, o gargalo é a placa de vídeo.
- O plano de evolução está em [ROADMAP.md](ROADMAP.md).

## Estrutura

- `src/engine.js`: renderização com origem flutuante e double emulado na GPU, o que permite ir de 1 km a bilhões de anos-luz sem tremer.
- `src/layers/`: céu de fundo, estrelas, galáxias, Via Láctea, Sistema Solar, sistemas exoplanetários, fotos.
- `src/nav.js`: órbita, voo livre e viagem em escala logarítmica.
- `src/main.js`: inicialização e laço de quadros. `src/time.js`: relógio da simulação.
- `src/ui/`: interface.
  - `actions.js`: selecionar, ir até, telescópio, "visto da Terra".
  - `info.js`: ficha de informações.
  - `places.js`: painel de lugares (árvore montada a partir dos dados, filtro, largura e recolhimento).
  - `searchbox.js`: busca do painel (filtra a árvore e procura no catálogo inteiro e no SIMBAD).
  - `menus.js`, `keys.js`: menus e teclado.
  - `perf.js`: painel F3.
- `src/search.js`, `src/telescope.js`, `src/labels.js`, `src/link.js`, `src/feeds.js`: busca, telescópio, rótulos, "visto da Terra", transmissões.
