# AstroLab

Navegador 3D do universo com dados reais: planetas na posição de agora, 109 mil estrelas, 6.445 exoplanetas,
43 mil galáxias, fotos reais de nebulosas e galáxias, busca por nome em todo o céu catalogado (SIMBAD) e um
telescópio com mais de 50 filtros, de raios gama a ondas de rádio.

## Como abrir

Dê dois cliques em **`AstroLab.bat`**: ele sobe o servidor local e abre `http://localhost:8080` no navegador.
Também dá para rodar direto com `node serve.mjs`. Precisa de internet para as bibliotecas (CDN), as fotos,
a busca no SIMBAD e o telescópio.

## Controles

| | |
|---|---|
| Arrastar | girar em volta do alvo / olhar em volta |
| Roda do mouse | aproximar / afastar |
| Clique / duplo clique | selecionar / viajar até lá |
| `Tab` | alternar entre orbitar e voar livre (`W A S D`, `R F`, `Q E`, `Shift` = turbo) |
| `X` | Transmissões: imagens e sinais dos aparelhos do catálogo |
| `V` | "Onde fica, visto da Terra": linha Terra ↔ objeto selecionado |
| `M` | mostrar / esconder a massaroca de satélites em volta da Terra |
| `/` | procurar · `G` ir até o selecionado · `T` telescópio · `L` lugares · `H` ajuda |
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
- `npm run smoke` roda o teste de fumaça: visita os lugares principais e reprova com erro de JavaScript. As capturas ficam em `tools/smoke-out/`. Com `npm run smoke -- rapido`, pula as paradas que dependem de fontes externas.
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
  - `places.js`, `menus.js`, `searchbox.js`, `keys.js`: lugares, menus, busca, teclado.
  - `perf.js`: painel F3.
- `src/search.js`, `src/telescope.js`, `src/labels.js`, `src/link.js`, `src/feeds.js`: busca, telescópio, rótulos, "visto da Terra", transmissões.
