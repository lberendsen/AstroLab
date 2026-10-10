# AstroLab: plano de evolução

Uma fase de cada vez. Cada fase termina com o app funcionando, testado no navegador e com a documentação ([docs/DOCUMENTACAO.md](docs/DOCUMENTACAO.md)) atualizada.
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

## Fase 2: Planetário ⭐ ✅ (2026-10-09)

- [x] **Modo "em pé":** Terra, Lua, Marte e o local de qualquer robô, com 30 lugares prontos ou latitude e longitude livres. Olhar em volta e zoom de binóculo.
- [x] **Horizonte e chão:** chão iluminado pelo Sol. Céu da Terra azul com crepúsculo; o de Marte é caramelo, com pôr do sol azul; o da Lua é preto.
- [x] **Constelações:** 88 constelações (Stellarium, padrão IAU), 795 linhas e nomes em português.
- [x] **Grades:** pontos cardeais, altura e azimute, equador e eclíptica.
- [x] **"No céu agora":** o que está acima do horizonte, com altura, direção e magnitude; nascer e pôr do Sol.
- [x] **Passagens e eventos:** passagens visíveis da ISS, da Tiangong e do Hubble em 72 h; conjunções em 12 meses; eclipses (Fase 3).
- [x] **Constelações em 3D:** as linhas ligam posições 3D reais; lugar "Órion de lado" e camada "Constelações no espaço".

Ficou para depois:
- Refração e apagamento das estrelas perto do horizonte.
- Relevo do horizonte (Fase 6).

## Fase 3: Viajar no tempo ✅ (2026-10-09)

- [x] **Linha do tempo:** painel 🕰️ Tempo com data livre e réguas de 1900–2100 e ±100 mil anos. Relógio de −1.000 a +1.000 anos por segundo, com datas a.C.
- [x] **Movimento das estrelas:** velocidades do HYG aplicadas na GPU. Conferido: Alfa Centauri chega a ~2,9 anos-luz daqui a 28 mil anos (literatura: ~3).
- [x] **Replays de missões:** Apollo 11, Voyager 1 e 2, New Horizons, Cassini, Rosetta + 67P, Galileo, Artemis I e Artemis II. Trajetórias em trechos (155 mil pontos, 7,4 MB) com passagens planetárias em alta resolução, narração e câmera automática.
- [x] **Eclipses passados e futuros:** lista calculada e eclipses famosos. A sombra é calculada por pixel na Terra (solar), na Lua (lunar, avermelhada) e em Júpiter (sombras das luas galileanas).

Ficou de fora:
- Replays de missões sem efeméride pública: Philae, Huygens e as missões soviéticas.
- O caminho da Apollo 11 depois do dia 17 é aproximado (órbita circular calculada).

## Fase 4: Tours guiados ⭐ ✅ (2026-10-09)

- [x] **Motor de roteiro (`src/ui/tours.js`):** voo, data, velocidade do tempo, planetário, constelações 3D, telescópio e transmissões. Avança sozinho depois do voo e do tempo de leitura, com pausa, volta, avanço e barra de progresso.
- [x] **Tours iniciais:** os cinco previstos, com 54 paradas no total e fatos revisados.
- [x] **Formato aberto:** `data/tours/*.json`, documentado em docs/DOCUMENTACAO.md; o teste de fumaça valida os alvos.

Ficou de fora:
- Encélado e Titã ainda não são modelados; o tour "Existe vida lá fora?" vai a Saturno (as luas entram na Fase 5).

## Fase 5: Mais universo ✅ (2026-10-09)

- [x] **Gaia DR3:** 2,2 milhões de estrelas a menos de 200 pc, com cor BP−RP. Carregamento sob demanda e corte por brilho.
- [x] **Pulsares:** 2.481 do ATNF, piscando no ritmo real, com 10 famosos comentados.
- [x] **Buracos negros:** 9, de Gaia BH1 a TON 618, com o horizonte em escala real e as imagens do EHT (Sgr A* e M87*).
- [x] **Ondas gravitacionais:** 282 eventos do GWOSC. A casca de distância mostra a incerteza; GW170817 leva a NGC 4993.
- [x] **Eventos recentes:** supernovas e transientes classificados nos últimos 30 dias (TNS).
- [x] **Estruturas com nome:** Laniakea, Grande Atrator, Virgem, Shapley, Perseu-Peixes, Hércules, Horologium, Grande Muralha Sloan, Vazio de Boötes e Vazio Local.
- [x] **Mais luas:** 184 do Horizons (189 no total), com mapas reais de 19 delas (Titã, Encélado, Tritão, Caronte…) e rotação sincronizada. O tour "Existe vida lá fora?" agora visita Encélado e Titã.

Ficou de fora:
- Movimento próprio das estrelas do Gaia (velocidades não baixadas, para manter 8 bytes por estrela).
- Alertas do Vera Rubin (ainda sem acesso público estável).
- Luas pequenas: muitas não têm raio publicado e aparecem com tamanho mínimo.

## Fase 6: Mais fiel de perto ✅ (2026-10-09)

- [x] **Relevo real:** Lua (LRO LOLA), Marte (MGS MOLA) e Mercúrio (MESSENGER), com malha deslocada e mapa de normais. Entra quando a nave chega a 30 raios do corpo. Exagero ajustável em Camadas (real, 3×, 6×, 12×). Os pousos ficam na altitude do terreno.
- [x] **Atmosferas:** Terra (azul, e laranja no terminador), Marte (pôr do sol azulado), Vênus (amarelada) e Titã (névoa laranja que esconde a superfície, como na luz visível).
- [x] **Terra à noite:** luzes das cidades no lado escuro, acendendo ao longo do crepúsculo, e reflexo do Sol nos oceanos.
- [x] **Sombras de Saturno:** do planeta sobre os anéis e dos anéis sobre o planeta.
- [x] **Texturas em alta resolução:** 4096×2048 (reduzidas das 8K do Solar System Scope) na Terra, na Lua, em Marte, em Mercúrio, em Júpiter e em Saturno. Só o corpo mais próximo recebe, para caber na memória de vídeo.
- [x] **Exoplanetas:** zona habitável (Kopparapu et al. 2014) como anel verde em cada sistema, na ficha da estrela e do planeta ("dentro" ou "fora"), e desenho do tamanho comparado com a Terra (e Júpiter).
- [x] **Chuvas de meteoros:** a corrente de poeira fica densa logo atrás do corpo de origem e tênue no resto da órbita.
- [x] **Céu de fundo:** ao sair da vizinhança do Sol, a foto perde as estrelas brilhantes, que o catálogo 3D já desenha (antes viravam estrelas duplas).

Observações de memória de vídeo (Intel Iris Xe): uma textura 8K com mipmaps ocupa ~170 MB, e três delas derrubaram o contexto WebGL. Por isso as texturas são 4K, só o corpo mais próximo recebe alta resolução e o relevo só existe perto do corpo. Se o contexto cair, a alta resolução se desliga, o 3D é restaurado e um aviso aparece. O teste de fumaça agora reprova se a tela ficar em branco.

Ficou de fora:
- Sombras das luas de Júpiter sobre o planeta.
- Relevo do horizonte no planetário (de Marte, da Lua).
- Texturas em blocos vindas do HiPS conforme o zoom (as 4K resolveram a maior parte da diferença).
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
