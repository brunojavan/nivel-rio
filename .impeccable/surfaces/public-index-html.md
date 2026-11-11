---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/estacao.html","public/saude.html"]
---

# Tela inicial (public/index.html)

Modo: operar (o morador consulta o rio). Construção pelo código (sem imagem de referência).

Público e tarefa: o morador da bacia do Itajaí, no celular, com chuva ou rio subindo, quer saber em segundos se o rio da sua cidade está perigoso e se ainda sobe; o detalhe técnico fica um toque abaixo. Restrições: dados com menos de 15 min, página com dados em menos de 2 s num 4G, marcas históricas só com fonte.

Decisões do Bruno (11 nov 2026): resumo e minha cidade no topo, mapa logo abaixo; cidade escolhida numa lista na primeira visita, lembrada no aparelho; em alerta ou emergência o caso grave toma o topo.

## Direction contract

THESIS: Cada cidade mostra o nível de agora pintado na sua parede, ao lado das cotas oficiais e das marcas que as cheias deixaram; recusa o painel de cartões iguais com número gigante e gráfico de área, que é o padrão da categoria.

OWN-WORLD: Reboco de concreto cinza frio (#CFD4D6, nunca bege), tinta #1D2327, placa esmaltada azul #1C3F8C com letra branca para o número principal, linhas pintadas na parede com nome ou ano; verde #2E7D4F, âmbar #C98A00, laranja #DD5A12 e vermelho #C8231B só para o estado do rio. Uma família, Overpass, servida pelo próprio site, numa escala fixa. Cantos retos ou quase; nada de pílula nem sombra suave em cartão.

STORY: O morador lê a frase da bacia, vê a parede da sua cidade com a água de agora e quanto falta para a próxima cota, entende se sobe ou desce e, se preciso, desce para o mapa e para as outras cidades na ordem do rio.

FIRST VIEWPORT: Celular 390 px: topo com o nome e "Atualizado às 15h17"; linha da Defesa Civil com o 199 em destaque; a frase da bacia em letra grande; à esquerda a parede da sua cidade (linha de água, cotas pintadas, marcas históricas acima), à direita a placa azul com o número, sentido, hora e "faltam X para a atenção"; "Mais N pontos" e "Trocar cidade"; o mapa começa logo abaixo. Em cheia, o caso mais grave entra acima da sua cidade.

FORM: Marcas da enchente, primeira da lista ordenada (escolha do Impeccable, aprovada pelo Bruno). seed:d6000fde56338615

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
