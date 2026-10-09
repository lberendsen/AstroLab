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

## Fase 1: Asteroides e cometas ⭐ ⬜

- [ ] **Dados:** elementos orbitais do JPL (SBDB, ~1,4 milhão de corpos), em binário compacto: a, e, i, Ω, ω, M, época, magnitude H e classe. Com ~40 MB, o download é dividido: os 100 mil mais brilhantes primeiro e o resto sob demanda.
- [ ] **Desenho:** propagação de Kepler na GPU, como nos satélites. As cores indicam a família: cinturão principal, troianos, Kuiper, próximos da Terra e cometas.
- [ ] **Nomes e busca:** Ceres, Vesta, Bennu, Apophis, Arrokoth, Halley…
- [ ] **Próximos da Terra:** lista das próximas aproximações (JPL CAD API), com a distância em "distâncias da Lua".
- [ ] **Cometas:** cauda apontando para o lado oposto ao Sol, que cresce perto dele.
- [ ] **Ligação com as naves:** Lucy até os troianos, Psyche, Hera até Dimorphos, Hayabusa2, Dawn em Ceres.
- [ ] **Chuvas de meteoros:** o radiante no céu e o cometa de origem.

## Fase 2: Planetário ⭐ ⬜

- [ ] **Modo "em pé":** a câmera fica na superfície, num lugar e numa hora escolhidos, e olha em volta com o mouse. Vale para a Terra, a Lua, Marte e o local de qualquer robô.
- [ ] **Horizonte e chão:** o chão esconde o que está abaixo do horizonte, e o céu clareia durante o dia, com crepúsculo e atmosfera azul na Terra ou rosada em Marte.
- [ ] **Constelações:** linhas e nomes (dados IAU / Stellarium), que podem ser ligados e desligados.
- [ ] **Grades:** pontos cardeais, grade de altura e azimute, eclíptica e equador celeste.
- [ ] **"O que está no céu agora":** o que está acima do horizonte na sua localização, ordenado por brilho.
- [ ] **Passagens da ISS e eventos:** as próximas passagens visíveis, eclipses (com a sombra no globo) e conjunções de planetas.
- [ ] **Constelações em 3D:** as mesmas linhas vistas de fora, mostrando que as estrelas não estão juntas.

## Fase 3: Viajar no tempo ⬜

- [ ] **Linha do tempo:** um controle deslizante de 1950 a 2100 para o Sistema Solar, com o tempo acelerado de verdade.
- [ ] **Movimento das estrelas:** velocidades do HYG/Gaia projetadas por ±100 mil anos. O Cruzeiro do Sul e a Ursa Maior se desmancham.
- [ ] **Replays de missões** (trajetórias históricas do Horizons, com a câmera seguindo a nave):
  - [ ] Apollo 11
  - [ ] Voyager 1 e 2, de 1977 até hoje
  - [ ] New Horizons chegando a Plutão
  - [ ] o Grand Finale da Cassini
  - [ ] Rosetta e o cometa 67P
- [ ] **Eclipses passados e futuros:** a sombra da Lua correndo sobre a Terra.

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
