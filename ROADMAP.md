# AstroLab: plano de evolução

Uma fase de cada vez. Cada fase termina com o app funcionando, testado no navegador e com o README atualizado.
A ordem segue as dependências: o que vem antes serve de base para o que vem depois.

Legenda: ⬜ a fazer · 🟨 em andamento · ✅ pronto

---

## Fase 0: Fundações ✅ (2026-10-09)

- [x] **Controle de versão:** repositório git local, `.gitignore` (cache de 90 MB e arquivos reescritos pelo servidor ficam de fora) e um commit por etapa.
- [x] **`main.js` dividido:** de 633 para ~150 linhas, com a interface separada em `src/ui/` (ações, ficha, lugares, menus, busca, teclado) e o relógio em `src/time.js`.
- [x] **Painel de desempenho (tecla `F3`):** fps, CPU por etapa do quadro, chamadas de desenho, pontos e memória.
  - Primeiro diagnóstico: na vista dos quasares, a CPU usa 4 ms por quadro e o gargalo é a GPU (1 milhão de pontos sobrepostos).
  - Levar isso para a Fase 1: carregar e desenhar só o necessário (nível de detalhe).
- [x] **Teste de fumaça (`npm run smoke`):** 16 paradas, capturas em `tools/smoke-out/`. Fontes externas fora do ar dão aviso, não reprovação.

## Fase 1: Asteroides e cometas ⭐ ✅ (2026-10-09)

- [x] **Dados:** 1.571.226 asteroides do JPL SBDB em 3 blocos por tamanho (2,5 + 10 + 26,5 MB). O primeiro carrega com o app, o resto sob demanda. Mais 4.080 cometas e 50 objetos famosos com dados físicos.
- [x] **Desenho:** Kepler na GPU, com cores por família (cinturão, próximos da Terra, cruzadores de Marte, troianos, centauros, Kuiper) e nível de detalhe por distância. Filtros por família no menu Camadas.
- [x] **Nomes e busca:** 77 mil nomes e designações. Clicar num ponto da nuvem consulta o JPL na hora.
- [x] **Próximos da Terra:** painel "Passando perto da Terra" (JPL CAD, 60 dias), em distâncias da Lua; clicar carrega a órbita e viaja até o objeto.
- [x] **Cometas:** cauda de íons e de poeira, coma, brilho previsto visto da Terra e órbitas abertas (incluindo os visitantes interestelares 1I, 2I e 3I).
- [x] **Ligação com as naves:** a ficha do asteroide tem "ir até a nave que foi para lá" (Dawn, Lucy, Psyche, Hera, Hayabusa2, New Horizons, Tianwen-2).
- [x] **Chuvas de meteoros:** 10 chuvas. Ao escolher uma, a data vai para o pico, aparecem a corrente de poeira e a órbita do corpo de origem, e o telescópio mostra o radiante.

Observações de desempenho: com o processador livre, 60–77 fps. As vistas com o cinturão inteiro e a vista Terra–Marte ficam em 35–45 fps neste computador (Intel Iris Xe). Fica para a Fase 6, junto com o restante da renderização, um sistema de nível de detalhe mais fino.

## Fase 2: Planetário ⭐ ⬜

- [ ] **Modo "em pé":** a câmera fica na superfície, num lugar e numa hora escolhidos, e olha em volta com o mouse. Vale para a Terra, a Lua, Marte e o local de qualquer robô.
- [ ] **Horizonte e chão:** o chão esconde o que está abaixo do horizonte, e o céu clareia durante o dia, com crepúsculo e atmosfera azul na Terra ou rosada em Marte.
- [ ] **Constelações:** linhas e nomes (dados IAU / Stellarium), que podem ser ligados e desligados.
- [ ] **Grades:** pontos cardeais, grade de altura e azimute, eclíptica e equador celeste.
- [ ] **"O que está no céu agora":** o que está acima do horizonte na sua localização, ordenado por brilho.
- [ ] **Passagens da ISS e eventos:** as próximas passagens visíveis, eclipses (com a sombra no globo) e conjunções de planetas.
- [ ] **Constelações em 3D:** as mesmas linhas vistas de fora, mostrando que as estrelas não estão juntas.

## Fase 3: Viajar no tempo ✅ (2026-10-09)

- [x] **Linha do tempo:** painel 🕰️ Tempo com data livre e réguas de 1900–2100 e ±100 mil anos. Relógio de −1.000 a +1.000 anos por segundo, com datas a.C.
- [x] **Movimento das estrelas:** velocidades do HYG aplicadas na GPU. Conferido: Alfa Centauri chega a ~2,9 anos-luz daqui a 28 mil anos (literatura: ~3).
- [x] **Replays de missões:** Apollo 11, Voyager 1 e 2, New Horizons, Cassini, Rosetta + 67P, Galileo, Artemis I e Artemis II. Trajetórias em trechos (155 mil pontos, 7,4 MB) com passagens planetárias em alta resolução, narração e câmera automática.
- [x] **Eclipses passados e futuros:** lista calculada e eclipses famosos. A sombra é calculada por pixel na Terra (solar), na Lua (lunar, avermelhada) e em Júpiter (sombras das luas galileanas).

Ficou de fora:
- Replays de missões sem efeméride pública: Philae, Huygens e as missões soviéticas.
- O caminho da Apollo 11 depois do dia 17 é aproximado (órbita circular calculada).

## Fase 4: Tours guiados ⭐ ⬜

- [ ] **Motor de roteiro:** uma sequência de passos (voar até X, esperar, mostrar texto, abrir uma transmissão, mudar a hora), com pausa, avanço e barra de progresso.
- [ ] **Tours iniciais:**
  - [ ] "Do seu quarto ao universo observável"
  - [ ] "A vida de uma estrela" (berçário → Sol → gigante vermelha → nebulosa planetária → anã branca; e a outra via: supergigante → supernova → pulsar/buraco negro)
  - [ ] "Somos feitos de poeira de estrelas"
  - [ ] "A corrida espacial e as missões de hoje"
  - [ ] "Existe vida lá fora?" (zona habitável, Europa, Encélado, TRAPPIST-1)
- [ ] **Formato aberto:** os roteiros ficam em JSON, então dá para criar novos sem programar.

## Fase 5: Mais universo ⬜

- [ ] **Gaia DR3:** de 2 a 5 milhões de estrelas próximas, com distância, cor e velocidade, misturadas ao HYG. O HYG fica para os nomes.
- [ ] **Pulsares** (catálogo ATNF), com o período de rotação piscando em tempo real (opcional).
- [ ] **Buracos negros:** os conhecidos (Gaia BH1–3, Cyg X-1, Sgr A*, M87*), com a foto do EHT.
- [ ] **Ondas gravitacionais (LIGO/Virgo):** as fusões detectadas, com a região de incerteza no céu.
- [ ] **Eventos desta semana:** supernovas e transientes (TNS, ou alertas do Vera Rubin, se houver acesso público).
- [ ] **Estruturas com nome:** Laniakea, Grande Atrator, Grande Muralha, Vazio de Boötes e o Vazio Local, rotulados na teia cósmica.
- [ ] **Mais luas** (~400 conhecidas), com mapas reais onde existem: Titã, Encélado, Tritão, Caronte, Mimas e outras.

## Fase 6: Mais fiel de perto ⬜

- [ ] **Relevo real:** altitude na Lua (LOLA) e em Marte (MOLA), carregada em blocos conforme a aproximação. Montanhas e crateras com sombra.
- [ ] **Atmosferas:** dispersão de luz na Terra (céu azul, pôr do sol laranja), em Marte (pôr do sol azul), em Vênus e em Titã.
- [ ] **Terra à noite:** luzes das cidades no lado escuro, com a textura "Black Marble" (NASA).
- [ ] **Sombras:** dos anéis de Saturno, de Saturno sobre os anéis e das luas de Júpiter sobre o planeta.
- [ ] **Mapas melhores nos planetas do 3D:** a resolução da textura vem dos mapas HiPS do telescópio, carregada em blocos conforme o zoom.
- [ ] **Exoplanetas:** zona habitável desenhada em cada sistema e comparação de tamanho com a Terra.

## Fase 7: Entender e compartilhar ⬜

- [ ] **Escala comparativa:** corpos lado a lado (Terra × Júpiter, Sol × Betelgeuse × UY Scuti, Via Láctea × Andrômeda).
- [ ] **Favoritos:** lugares salvos com a vista e o instante.
- [ ] **Links:** o endereço guarda o estado (`#alvo=M31&t=2026-10-09`), então um link abre o app naquela vista.
- [ ] **Captura de tela** em alta resolução, com legenda.
- [ ] **Pedir ao Claude:** perguntas em linguagem natural que viram ações ("me leva a uma estrela parecida com o Sol com planeta na zona habitável") e explicações do que está na tela. Exige chave de API: o servidor local faz a chamada, para a chave não ficar no navegador.

---

## Princípios que valem para todas as fases

- **Dados reais,** e o app sempre diz o que é medido e o que é ilustrativo.
- **Responde rápido mesmo com milhões de objetos:** o pesado fica na GPU, e o que é grande carrega sob demanda.
- **Fontes externas podem cair:** tempo-limite, cache e aviso, nunca uma tela travada.
- **Interface em português,** com os nomes científicos entre parênteses quando ajudam a procurar mais.
- **Cada fase é validada no navegador:** capturas de tela e console limpo antes de dar como pronta.
