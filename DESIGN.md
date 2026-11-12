---
name: Nível Rio
description: O nível dos rios da bacia do Itajaí pintado na parede de cada cidade, ao lado das cotas oficiais e das marcas das cheias.
colors:
  placa: "#1C3F8C"
  placa-escura: "#142E66"
  agua: "#1C3F8C"
  normal: "#2E7D4F"
  atencao: "#C98A00"
  alerta: "#DD5A12"
  emergencia: "#C8231B"
  parada: "#6B7378"
  normal-txt: "#1E5E39"
  atencao-txt: "#6E4D00"
  alerta-txt: "#8F3606"
  emergencia-txt: "#971712"
  reboco: "#CFD4D6"
  reboco-claro: "#DCE0E1"
  reboco-fundo: "#D8DCDE"
  reboco-escuro: "#B9C0C3"
  tinta: "#1D2327"
  tinta-2: "#3A4348"
  fio: "rgba(29, 35, 39, .3)"
  branco: "#FFFFFF"
  placa-noite: "#2D5BC0"
  placa-escura-noite: "#23489A"
  agua-noite: "#2D5BC0"
  link-noite: "#9DB8F2"
  normal-noite: "#4DB37A"
  atencao-noite: "#E2B13C"
  alerta-noite: "#F38A4E"
  emergencia-noite: "#F0675C"
  parada-noite: "#8B9499"
  normal-txt-noite: "#6FCB96"
  atencao-txt-noite: "#EBC15C"
  alerta-txt-noite: "#F79D69"
  emergencia-txt-noite: "#F58A81"
  reboco-noite: "#23292D"
  reboco-claro-noite: "#2B3237"
  reboco-fundo-noite: "#283035"
  reboco-escuro-noite: "#3A4349"
  tinta-noite: "#E4E8EA"
  tinta-2-noite: "#B3BCC1"
  fio-noite: "rgba(228, 232, 234, .25)"
typography:
  numero:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "3.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  titulo-estacao:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  titulo:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  frase:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
  sub:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.15
  corpo:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
  legenda:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  marca-parede:
    fontFamily: "Overpass, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1.2
rounded:
  reto: "0px"
  raio: "4px"
  placa: "7px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "28px"
  coluna: "36px"
  margem: "16px"
components:
  botao:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    rounded: "{rounded.raio}"
    padding: "9px 14px"
    height: "44px"
  botao-hover:
    backgroundColor: "{colors.reboco-claro}"
  botao-ativo:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.reboco}"
  placa:
    backgroundColor: "{colors.placa}"
    textColor: "{colors.branco}"
    typography: "{typography.numero}"
    rounded: "{rounded.placa}"
    padding: "12px 14px 10px"
  seletor:
    backgroundColor: "{colors.reboco-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.raio}"
    padding: "9px 12px"
    height: "44px"
  linha:
    textColor: "{colors.tinta}"
    rounded: "{rounded.reto}"
    padding: "10px 0"
  balao-mapa:
    backgroundColor: "{colors.reboco-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.raio}"
    padding: "12px 14px"
  painel-mapa:
    backgroundColor: "{colors.reboco-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.reto}"
    padding: "12px 14px"
---

# Design System: Nível Rio

Registro do sistema visual que foi ao ar no redesenho "Marcas da enchente" (11 nov 2026), tirado do código publicado (`public/estilo.css` e `public/js/`), não do plano. Os títulos das seções ficam em inglês porque a ferramenta os lê; o conteúdo é em português.

## Overview

**Creative North Star: "Marcas da enchente"**

Cada cidade tem uma parede de reboco cinza frio. Nela estão pintados a régua em metros, as cotas oficiais (atenção, alerta, emergência) e as marcas que as cheias passadas deixaram, cada uma com o ano. A água de agora sobe nessa parede. Ao lado, uma placa esmaltada azul com letra branca mostra o número. Tudo o mais (o mapa, as listas por cidade e pela ordem do rio, o gráfico da estação) é a mesma parede vista de outro jeito: a mini parede de cada linha, os pontos do mapa pintados com a cor da faixa e o gráfico que estica a parede no tempo.

A página é tinta escura sobre reboco, com textura leve de grão e manchas. Não usa cartões: as seções se separam por linhas de tinta (2px) e as linhas de lista por fios finos. A densidade é de quadro de avisos: números grandes, frases inteiras, uma coluna no celular. O texto explica a situação em vez de dar só o rótulo ("Normal. Faltam 32 cm para a cota de atenção.").

Este sistema substitui o site anterior, que a crítica de 11 nov 2026 avaliou com 22/40: 37 cartões iguais com raio de 16px e sombra, degradê decorativo, rótulos em maiúsculas espaçadas, pílulas, anel de progresso, só a fonte do sistema, 20 tamanhos de letra e emoji.

**Key Characteristics:**
- Reboco cinza frio (nunca bege), tinta quase preta, um azul só (placa e água).
- Verde, âmbar, laranja e vermelho reservados para a faixa do rio, sempre com a palavra junto.
- Uma família, Overpass, servida pelo próprio site, numa escala fixa.
- Cantos retos ou quase; nenhuma pílula; sombra só na placa esmaltada.
- Um único movimento com significado: a água sobe na parede.

## Colors

Uma paleta de material: reboco e tinta são o mundo; o azul esmaltado é o objeto; as quatro cores de faixa são o estado do rio e nada mais. Os valores dos dois temas estão no frontmatter; o tema claro é o padrão, mesmo com o sistema no escuro; o tema escuro (sufixo `-noite`, "a mesma parede à noite") entra só pelo botão do topo, com `data-tema="escuro"` na raiz, e a escolha fica guardada no aparelho (`localStorage`, chave `tema`).

### Primary
- **Azul da placa** (placa): fundo da placa esmaltada com o número principal, cor dos links e do contorno de foco (3px), seleção de texto, rios no mapa e pontos das barragens.
- **Azul da água** (agua): o mesmo azul, como a água de agora na parede (86% de opacidade), na mini parede, no reservatório das barragens, na barra de chuva e no preenchimento do gráfico. A linha do gráfico usa o azul fundo da placa (placa-escura).
- **Link à noite** (link-noite): azul claro para links e botões-link no tema escuro, onde o azul da placa não tem contraste sobre o reboco escuro.

### Secondary
As faixas do rio. Cada uma tem duas versões: a cor cheia, para traços, quadradinhos e pontos do mapa, e a versão `-txt`, mais escura (mais clara à noite), para texto sobre o reboco com contraste de 4,5:1 ou mais.
- **Verde normal** (normal / normal-txt): rio abaixo da cota de atenção.
- **Âmbar atenção** (atencao / atencao-txt): cota de atenção alcançada.
- **Laranja alerta** (alerta / alerta-txt): cota de alerta alcançada.
- **Vermelho emergência** (emergencia / emergencia-txt): cota de emergência alcançada; também o "Atualizado" quando os dados da página ficam velhos.
- **Cinza parada** (parada): estação sem leitura nova ou fora do ar.

### Neutral
- **Reboco** (reboco): fundo da página, sob a textura de grão.
- **Reboco de fundo** (reboco-fundo): fundo da parede, do gráfico e do mapa, com grão e manchas.
- **Reboco claro** (reboco-claro): balão e painel do mapa, seletor, hover de botão, linha da estação atual, ponto "sem cota oficial" no mapa.
- **Reboco escuro** (reboco-escuro): trilhos vazios (mini parede, reservatório, barra de chuva, comporta).
- **Tinta** (tinta): texto, linhas de seção, contorno de botão e de ponto do mapa.
- **Tinta clara** (tinta-2): texto secundário, régua da parede, marcas históricas, eixos do gráfico.
- **Fio** (fio): divisões entre linhas de lista, borda da parede, do mapa e do balão.
- **Branco** (branco): letra da placa, rótulo da água e nome das cotas submersas.

### Named Rules
**A Regra da Faixa.** Verde, âmbar, laranja e vermelho só dizem o estado do rio. Nenhum botão, ícone, destaque ou gráfico usa essas cores para outra coisa, e nenhuma faixa aparece só como cor: vem sempre com a palavra (quadradinho pintado + "Atenção").

**A Regra do Azul Único.** O azul é a placa e a água. Não vira cor de marca, fundo de seção nem destaque genérico.

**A Regra do Contraste.** Todo texto fica em 4,5:1 ou mais nos dois temas; por isso as faixas têm a versão `-txt` e o tema escuro tem link próprio.

## Typography

**Display Font:** Overpass (com system-ui, sans-serif)
**Body Font:** Overpass (com system-ui, sans-serif)

**Character:** Overpass é uma grotesca derivada da sinalização de estrada (Highway Gothic): lê como placa pintada, combina com a régua e a placa esmaltada. Arquivo variável próprio (`/fontes/overpass-latin.woff2`, pesos 100–900, licença OFL em `fontes/Overpass-OFL.txt`), `font-display: swap`.

### Hierarchy
- **Número** (800, 3,25rem, altura de linha 1, -0,02em, algarismos tabulares): só o número da placa; cai para 2,75rem em telas de até 380px. A unidade "m" vai menor (1,375rem, 650).
- **Título de estação** (800, 2,25rem, 1,15): o h1 da página da estação.
- **Título** (800, 1,875rem, 1,15): título de seção, de cidade e do mapa.
- **Frase** (600, 1,5rem, 1,3, até 34ch): a frase da bacia no topo; as palavras de estado em 800.
- **Sub** (800, 1,25rem): h3 dentro de seção e o resumo "Sobre os dados".
- **Corpo** (400, 1,0625rem, 1,45): texto corrido, até 60–68ch.
- **Legenda** (400, 0,875rem): rodapé, nota de fonte, subtítulo de linha, explicação.
- **Marca da parede** (800 no nome, 0,75rem; marcas históricas em 0,6875rem): nomes das cotas e anos pintados na parede.

Pesos usados: 400, 600, 650 (links e botões), 700, 800. Números sempre com algarismos tabulares.

### Named Rules
**A Regra da Escala Fixa.** Os tamanhos saem dos tokens `--t-*` (13, 17, 20, 24, 30 e 52px) e dos poucos tamanhos de apoio listados acima. Não criar tamanhos novos por componente.

**A Regra da Frase.** Estado se escreve em frase com o número e a distância até a próxima cota, nunca só como rótulo.

## Layout

- **Largura:** coluna de até 1160px centrada, margem lateral de 16px.
- **Celular (padrão):** uma coluna. Ordem da tela inicial: topo com nome e "Atualizado às…", linha da Defesa Civil, frase da bacia, caso grave (só em alerta ou emergência), sua cidade (parede à esquerda com 156px, placa e frases à direita), mapa, níveis, barragens, chuva, avisos, "Sobre os dados".
- **A partir de 560px:** a parede passa a 190px e o vão a 22px; o mapa sai da altura fixa de 300px.
- **A partir de 900px:** listas em duas colunas com vão de 36px.
- **A partir de 1000px:** primeira tela em duas colunas (até 520px | resto), com o mapa fixo (sticky) à direita, altura da tela menos 120px, até 760px. A página da estação usa a mesma grade (parede e placa | gráfico).
- **Ritmo:** seções separadas por 28px e uma linha de tinta de 2px; dentro, 12px depois da linha; linhas de lista com 10px em cima e embaixo.
- **Toque:** todo botão, link de ação, seletor e resumo tem pelo menos 44px de altura; os pontos do mapa têm alvo invisível de 18px de raio.

**A Regra da Primeira Tela.** No celular de 390px, a frase da bacia e a parede da sua cidade com a placa cabem antes de rolar; em cheia, o caso mais grave entra acima da sua cidade.

## Elevation & Depth

O sistema é plano. A profundidade vem do material: textura de grão em tudo, manchas na parede e no gráfico, linhas de tinta e fios. Nenhum cartão, balão ou painel tem sombra (a sombra padrão do MapLibre é retirada).

### Shadow Vocabulary
- **Placa esmaltada** (`box-shadow: inset 0 0 0 3px var(--placa), inset 0 0 0 5px var(--branco), 0 2px 3px rgba(20, 26, 30, .35)`): só na placa. Faz o filete branco da borda esmaltada e a pequena sombra de um objeto parafusado na parede.

**A Regra do Objeto Único.** Só a placa é um objeto sobre a parede; todo o resto é pintado nela.

## Shapes

Cantos retos ou quase. Botões, seletor e balão do mapa têm 4px; a placa tem 7px (esmalte); parede, mini parede, trilhos, linhas e painel do mapa são retos. Nada de pílula. Círculos só nos pontos do mapa e na legenda dele. As linhas pintadas têm espessura fixa: 4px para cotas e marcas históricas, 2px para divisão de seção, 1px para fios. A marca histórica tem um traço curto girado -0,8 grau, como pintado à mão.

## Components

### Parede
O gesto do mundo; usar para a sua cidade, o caso grave e o topo da página da estação.
- **Estrutura:** figura de 430px de altura em reboco de fundo com grão e manchas; régua de 22px à esquerda com um número a cada 1, 2 ou 5 m; 1 m = `--m` px; a linha mais alta fica a pelo menos 40px do topo.
- **Cota:** faixa de 4px na cor da faixa, nome em 800 e valor na versão `-txt`. Quando a água passa da cota, ela fica "submersa": o nome desce para baixo da faixa, em branco sobre o azul, nunca em cima da linha d'água.
- **Marcas históricas:** traço curto em tinta clara com ano e nível; marcas a menos de 15px uma da outra viram um traço só com os rótulos empilhados, a mais alta em cima; anos repetidos levam o mês. Com o rio em atenção ou pior, as marcas passam para tinta cheia.
- **Água:** azul a 86% com borda de 4px na cor da faixa; rótulo "Agora X m" só onde não cobre o nome de uma cota.
- **Movimento:** `sobe`, a água cresce de baixo em 1,1s (`cubic-bezier(.16, 1, .3, 1)`); desligado com `prefers-reduced-motion: reduce`.
- **Acessibilidade:** `role="img"` com rótulo em frase (nível, cotas, cheias).
- Estações que medem altitude não têm parede.

### Placa
Retângulo azul esmaltado com o nome do ponto (0,9375rem, 650) e o número no tamanho Número. Só um por bloco de cidade; nunca para outro dado.

### Frases de estado
Abaixo da placa: sentido com ícone ("Subindo 4 cm por hora"), "Medido às…", estado com quadradinho pintado e palavra na cor `-txt`, explicação em tinta clara e ações (links). Estação parada mostra "Parada. Sem leitura nova desde…" e esconde o sentido.

### Frase da bacia
Uma frase no tamanho Frase que resume a bacia ("Rio do Sul está em ■ atenção: 5,69 m, subindo 4 cm/h (cota a confirmar). No resto da bacia, o rio está ■ normal.").

### Bloco de cidade
Cabeçalho (título + link "Trocar cidade") e a leitura (parede + placa). O caso grave usa o mesmo desenho, com a linha de cima em 6px na cor da faixa em vez de 2px de tinta. Na primeira visita, o bloco vira a pergunta "Onde você mora?" com um seletor.

### Linha de estação
Para toda lista de pontos (mais pontos de uma cidade, ordem do rio, mesmo rio). Grade de três colunas: mini parede (14 × 40px, água azul e cotas em traços de 2px; vazia quando a estação não tem cota), nome em 700 e nível em 800 com algarismos tabulares; embaixo, rio/cidade e estado em palavra com sentido ("■ Normal, subindo 3 cm/h"). Parada: nível riscado em tinta clara e "parada desde…". Altitude: rótulo "altitude" ao lado do número. A estação aberta na página aparece com fundo reboco claro e contorno de tinta de 2px. Hover sublinha o nome.

### Botões e links
- **Botão:** retângulo de tinta, contorno de 2px, fundo transparente, 650, mínimo de 44px. Hover: reboco claro. Ativo ou pressionado (`aria-pressed`): tinta cheia com letra em reboco. Usado para abas de período e de ordem, "Compartilhar", "Fechar".
- **Link e botão-link:** azul da placa (link-noite no escuro), 650, sublinhado de 1,5px a 3px do texto, mínimo de 44px quando é ação.
- **Foco:** contorno de 3px no azul da placa, afastado 2px, em tudo.

### Seletor
Campo nativo com fundo reboco claro, contorno de tinta de 2px, raio de 4px, 44px de altura, mínimo de 220px de largura.

### Linha da Defesa Civil
Logo abaixo do topo, em todas as páginas: "Este site não substitui a Defesa Civil.", "Emergência: 199" (1,25rem, 800) e "Alertas por SMS: mande seu CEP para 40199". Com qualquer estação em alerta ou emergência o 199 cresce para 1,75rem.

### Topo
Marca (ícone SVG de 30px + "Nível Rio" em 800, 1,375rem) e, à direita, "Atualizado às…" e o botão do tema; linha de tinta de 2px embaixo. Quando os dados ficam velhos, "Atualizado" passa a emergencia-txt em 700.

**Botão do tema:** quadrado de 44px com borda de tinta de 2px e canto de 4px, como os outros botões, só com ícone: lua no claro, sol no escuro. É um botão de alternar (`aria-pressed`, nome "Tema escuro"). O `<head>` de cada página aplica a escolha guardada antes de desenhar, para o claro não piscar; mapa e gráfico, que pintam as cores em JavaScript, são refeitos na troca (evento `tema`, em `js/tema.js`). A cor da barra do navegador (`theme-color`) acompanha o reboco do tema. Em telas de até 400px a marca e o "Atualizado" encolhem um pouco para tudo caber numa linha.

### Gráfico da estação
A parede esticada no tempo.
- Água em azul cheio (86%) sob uma linha de 2px no azul fundo, sem grade, sobre o mesmo reboco com grão e manchas da parede.
- Cotas como faixas de 4px pintadas por cima da água, com nome e valor numa margem de 82px à direita, fora da área dos dados, separados 30px entre si.
- A escala sempre inclui a cota mais próxima abaixo e a mais próxima acima do que o rio fez no período; a régua usa as casas decimais que o passo pede.
- Sem legenda: uma linha de texto em cima ("Última leitura, 11/11, 16h00: 3,66 m. Passe o mouse ou toque no gráfico…") que passa a mostrar o horário sob o cursor ou o dedo.
- Buraco onde não houve medição. Se a série guardada atrasou, a leitura de agora entra como um ponto marcado depois de um tracejado, nunca como linha contínua inventada.
- Abas de período (24 horas, 3, 7, 30 dias) são botões.

### Estatísticas e ficha
Pares de rótulo em tinta clara e valor; nas estatísticas o valor vai em 700 tabular; na ficha cada par tem fio em cima. A ficha diz fonte, cotas e quem as publica, tipo de medida (régua ou altitude), maré e intervalo de leitura.

### Cheias passadas
Lista de linhas com data por extenso e nível, a maior marcada "a maior registrada", seguida da nota "Fonte:" com link.

### Barragens, chuva e comportas
Linhas sem cartão: ocupação em 800 com trilho de 14px preenchido de azul; comportas como quadrados de 14px de contorno (cheios = abertas); chuva com barra de 10px azul; na página da barragem, um trilho por comporta preenchido em tinta onde esteve aberta.

### Avisos
Lista com hora (4,25rem, tabular, tinta clara) e o texto em peso normal; aberturas de comporta agrupadas por barragem em 24 horas.

### Ícones
SVG próprios de um traço só (2,4px, pontas redondas, cor do texto, 1em): sobe, desce, estável, volta, maré e marca (triângulo sobre três linhas de água, o mesmo do favicon.svg e do topo).

### Mapa
- **Fundo:** estilo do OpenFreeMap recolorido: terra em reboco de fundo, água em azul apagado (#B9C6D6; #2A3A52 à noite), ruas claras, texto em tinta clara; rios principais em azul da placa.
- **Pontos:** cor da faixa com contorno de tinta; reboco claro para estação sem cota oficial; cinza para parada; azul da placa com contorno mais grosso para barragem. Em atenção ou pior, o ponto cresce (raio 9) e o nome ganha a palavra ("em alerta", com "(a confirmar)" quando a cota é de Rio do Sul) na cor `-txt`.
- **Legenda:** círculos com a palavra de cada faixa, "sem cota oficial" e "parada".
- **Itajaí:** abaixo do zoom 10, os 12 pontos viram um só no centro deles ("Itajaí, 12 pontos"), com o nível do ponto mais perto da cota de atenção.
- **Prioridade dos nomes:** a cidade do morador > atenção ou pior > Blumenau, Itajaí, Brusque e Rio do Sul > barragens > o resto. Os nomes urgentes ficam numa camada própria e nunca somem.
- **Celular (mapa com menos de 520px):** só esses níveis de cima ganham nome; o toque abre um painel no pé do mapa (reboco claro, contorno de tinta de 2px, botão "Fechar") em vez do balão.
- **Computador:** hover mostra o balão (reboco claro, fio, raio 4px, sem sombra; nível em 1,75rem 800); clique abre a estação.
- Gestos cooperativos (dois dedos), sem rotação, textos em português.

## Data Truth Rules

Regras de dado que mudam o desenho. Valem para qualquer tela nova.

**A Regra da Fonte da Marca.** Marca de cheia passada só entra na parede, na lista ou no gráfico com fonte citada e link (hoje as 8 marcas do catálogo têm fonte e endereço). Sem fonte, não pinta.

**A Regra da Cota a Confirmar.** As cotas de Rio do Sul ainda não estão confirmadas. Todo estado que depende delas leva "cota a confirmar" (frase da bacia, frase de estado, linha da estação, "(a confirmar)" no mapa).

**A Regra da Maré.** As estações de Itajaí sobem e descem com a maré: o sentido aparece como "Sobe e desce com a maré, agora subindo" com o ícone de maré, nunca como seta de subida.

**A Regra da Altitude.** Estação que mede altitude da água não tem parede, cota nem mini parede com escala, leva o rótulo "altitude" junto do número e nunca é comparada com leituras de régua.

**A Regra do Número Velho.** Leitura velha nunca parece atual: todo valor diz quando foi medido; estação sem leitura nova há mais que o dobro do intervalo vira "parada" (cinza, nível riscado, sem sentido); "Atualizado" fica em vermelho de texto quando a página envelhece; no gráfico, o atraso aparece como tracejado.

## Do's and Don'ts

### Do:
- **Do** mostrar o nível de uma cidade na parede, com a placa ao lado, sempre que a pergunta for "como está o rio aqui".
- **Do** escrever o estado em frase, com a distância até a próxima cota e o sentido.
- **Do** juntar cor de faixa e palavra (quadradinho pintado + nome da faixa).
- **Do** separar seções com linha de tinta de 2px e linhas de lista com fio de 1px.
- **Do** usar os ícones SVG do próprio conjunto, na cor do texto.
- **Do** manter a única animação (a água subindo) e desligá-la com `prefers-reduced-motion`.
- **Do** manter contraste de 4,5:1 ou mais nos dois temas e alvos de toque de 44px.

### Don't:
- **Don't** usar verde, âmbar, laranja ou vermelho para algo que não seja o estado do rio.
- **Don't** usar o azul fora da placa, da água, dos rios e dos links.
- **Don't** pôr rótulo pequeno em maiúsculas espaçadas acima de título (eyebrow).
- **Don't** usar borda lateral colorida para marcar estado.
- **Don't** pôr sparkline decorativo ou gráfico de área sem cotas e régua; gráfico de nível é sempre a parede no tempo.
- **Don't** usar emoji, caractere como ícone ou fonte de ícones; só SVG.
- **Don't** usar cartões com sombra, pílulas, degradês ou anéis de progresso.
- **Don't** criar movimento além da água subindo.

## Finish

A revisão de acabamento rodou três rodadas; todas as correções materiais foram aplicadas e confirmadas. Notas de teto deixadas pelo revisor para depois (não bloqueiam):
- O tema escuro lembra menos o mundo de reboco.
- A lista na ordem do rio é longa e plana.
- As marcas pintadas não têm variação de mão.

## Raster Provenance

Imagens rasterizadas publicadas em `public/` (os ícones e a imagem de prévia do link; o resto do site é SVG, CSS e texto):

| Arquivo | Tamanho | Origem verificável |
|---|---|---|
| `favicon.ico` | 3 imagens PNG: 16, 32 e 48 px | Gerado em 11 nov 2026 a partir de `public/favicon.svg` por `scripts/icones.mjs` (Chrome sem janela): a marca em tinta `#1D2327` sobre o reboco `#CFD4D6`, cantos de 2 a 6 px. |
| `favicon.png` | 16 × 16 | Mesmo processo (`scripts/icones.mjs`), 11 nov 2026. |
| `favicon@2x.png` | 32 × 32 | Mesmo processo, 11 nov 2026. |
| `favicon@3x.png` | 48 × 48 | Mesmo processo, 11 nov 2026. |
| `apple-touch-icon.png` | 180 × 180 | Mesmo processo, 11 nov 2026: a marca a 64% sobre o reboco, sem canto (o iPhone arredonda). É o `apple-touch-icon` das três páginas. |
| `compartilhar.jpg` | 1200 × 630, JPEG | Gerado em 12 nov 2026 por `scripts/compartilhar.mjs` (Chrome sem janela). É a prévia do link nas redes (`og:image` da página inicial e das estações). À esquerda, a marca, a chamada "O nível do rio na sua cidade, agora." e a placa esmaltada com `niveldorio.net`; à direita, a parede de Blumenau com as cotas do AlertaBlu (lidas de `/api/agora` na hora de gerar) e as seis cheias do catálogo com a fonte escrita embaixo. A parede vai sem a água de agora, porque a imagem fica parada e um nível desenhado nela pareceria a leitura do dia. Para refazer: `node scripts/compartilhar.mjs public/compartilhar.jpg`; se a imagem mudar, troque também o nome do arquivo, porque WhatsApp e Facebook guardam a prévia antiga. |

Todos saem do mesmo desenho do `favicon.svg` (o vetor, que os navegadores atuais usam e que muda de cor no tema escuro); os raster ficam sempre na versão clara, sobre o reboco, para aparecerem em aba clara ou escura. Para refazer depois de mudar o desenho: `node scripts/icones.mjs public/favicon.svg <pasta>` e copiar os arquivos para `public/`. Os ícones antigos (quadrado vermelho com ponto de exclamação, da "Versão Alpha" de 2023) foram substituídos porque o vermelho é só para o estado do rio. Os tiles do mapa vêm do OpenFreeMap em tempo de execução e não são arquivos publicados pelo site.
