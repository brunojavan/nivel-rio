# Product

<!-- impeccable:product-schema 1 -->

Registro do produto para o Impeccable (skill de design). Os títulos das seções ficam em inglês porque a ferramenta os lê; o conteúdo é em português. Confirmado com o Bruno em 11 nov 2026.

## Platform

web

## Users

Principal: o morador de uma cidade da bacia do Itajaí (Santa Catarina), olhando no celular, quase sempre com chuva forte ou com o rio já subindo. A pergunta a responder em segundos é "o rio da minha cidade está ficando perigoso, e ainda está subindo?" e, quando está, "quão perto está das marcas oficiais, e o que vem de rio acima?". O detalhe técnico (histórico, outras estações, fonte, cotas) fica um nível abaixo dessa resposta, nunca na frente dela.

Imprensa, voluntários e equipes da Defesa Civil são bem-vindos, mas secundários: o site não é ajustado para eles.

## Product Purpose

O Nível Rio junta num lugar só o nível do Itajaí-Açu, do Itajaí-Mirim e dos afluentes, as três barragens com o estado de cada comporta, a chuva nos pluviômetros da bacia e avisos quando uma estação muda de faixa ou sobe rápido. Consulta as fontes oficiais a cada 5 minutos e guarda histórico próprio. Dá certo quando o morador entende a situação da sua cidade poucos segundos depois de abrir a página, no celular, num 4G, durante uma cheia.

Não substitui a Defesa Civil. Toda página diz isso e aponta os canais oficiais (telefone 199, alertas por SMS no 40199).

## Positioning

Os dados oficiais estão espalhados em três sites que não conversam entre si (Defesa Civil de SC, Defesa Civil de Itajaí, AlertaBlu de Blumenau), cada um com seu formato e suas cotas. O Nível Rio junta os três, das barragens do Alto Vale até a foz, com a origem de cada número e de cada cota ao lado, um histórico que as próprias fontes não guardam e as comportas das barragens, que o site do Estado mostra só no estado atual.

## Operating Context

- Usado sobretudo no celular, em condição ruim: chuva, sinal fraco, nervosismo, uma mão só. A primeira tela precisa funcionar sem rolar e sem conhecer o vocabulário.
- Durante a cheia, a pessoa volta várias vezes ao longo de horas e manda o link de uma estação no WhatsApp; o link leva o nível atual no título.
- O rio sobe e desce ao longo de horas; o sentido (subindo, parado, descendo) importa tanto quanto o número.
- A bacia vai de cima para baixo: Alto Vale (Itajaí do Oeste, do Sul, Hercílio e as três barragens) → Rio do Sul → Blumenau → Gaspar e Ilhota → Itajaí, na foz, onde a maré também mexe no rio. O Itajaí-Mirim passa por Brusque e encontra o Itajaí-Açu perto da foz.

## Capabilities and Constraints

- Fontes: Defesa Civil de SC (a maioria das estações, as barragens e comportas, os pluviômetros), Defesa Civil de Itajaí (11 estações da cidade, com cotas), AlertaBlu (nível oficial de Blumenau, de hora em hora). As cotas (atenção, alerta, emergência) só existem onde a fonte publica; a maioria das estações não tem. As de Rio do Sul ainda estão "a confirmar".
- Algumas estações medem a altitude da água (metros acima do nível do mar), não a régua: esses números não se comparam com os outros e precisam de rótulo.
- Dado velho nunca pode parecer atual: todo valor mostra quando foi medido, e a estação parada há mais do dobro do intervalo normal aparece marcada.
- Picos de sensor (salto de mais de 1 m que volta em até 30 min) são retirados e listados em /saude.
- Só planos gratuitos (Cloudflare Workers, D1, arquivos estáticos). HTML, CSS e JavaScript puros, sem etapa de build; uPlot no gráfico grande, MapLibre com o fundo gratuito do OpenFreeMap no mapa.
- A página precisa mostrar os dados em menos de 2 segundos num 4G; os dados vêm embutidos no HTML e o mapa carrega depois.
- Páginas: inicial (mapa, níveis por cidade ou por região do rio, barragens, chuva, avisos), uma por estação ou barragem em /estacao/{id}, saúde do coletor em /saude.
- Em aberto: canal no Telegram para os avisos (falta o bot), maré na foz, comparação com cheias anteriores.

## Brand Commitments

- O nome "Nível Rio" e o ícone atual podem mudar (Bruno, 11 nov 2026).
- Tom: próximo e explicativo. Falar como um vizinho que conhece o rio: português simples, explicar cota, montante, régua e comporta na primeira vez que importarem, nenhum termo técnico sem explicação. Sério quando o rio está sério, nunca alarmista, nunca minimizando.
- Sempre presente e visível: "Este site não substitui a Defesa Civil", telefone 199, SMS 40199.
- Os dados pertencem às Defesas Civis; o projeto só guarda e mostra. Código aberto (github.com/brunojavan/nivel-rio).

## Evidence on Hand

- Dados ao vivo das três fontes, histórico desde 1º nov 2026 (90 dias sendo importados até perto de 18 nov 2026) e a cheia de 7 nov 2026 nos dados (Blumenau 8,06 m, emergência; Rio do Sul 8,70 m).
- Traçado dos rios do OpenStreetMap (public/mapa/rios.geojson); catálogo de estações com coordenadas (catalogo/estacoes.json).
- Não existem apoios, parcerias, depoimentos nem números de uso. Não sugerir nenhum vínculo oficial com as Defesas Civis; o contato com elas ainda está pendente.

## Product Principles

1. A resposta da minha cidade primeiro; a explicação a um toque.
2. Número velho nunca parece novo; a origem de cada número e de cada cota nunca fica escondida.
3. O sentido importa tanto quanto o nível: subindo, parado ou descendo está sempre ao lado do número.
4. Feito para o celular na chuva com sinal fraco, não para a mesa do escritório.
5. Apontar para a Defesa Civil, nunca competir com ela.

## Accessibility & Inclusion

Legível para moradores mais velhos e sob luz forte ao ar livre: números grandes, contraste alto, nenhum significado só na cor (as faixas também precisam de palavra), áreas de toque para dedo molhado. Só em português.
