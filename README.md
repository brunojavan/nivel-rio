# Nível Rio

Nível dos rios Itajaí-Açu e Itajaí-Mirim e situação das três barragens da bacia (incluindo quais comportas estão abertas), com histórico próprio, site público e alertas.

**Endereço:** https://niveldorio.net (o endereço antigo, https://nivel-rio.nivel-rio.workers.dev, continua funcionando)

> Este site não substitui a Defesa Civil. Em caso de cheia, ligue **199** e cadastre-se para receber alertas por SMS no **40199** (mande o seu CEP).

O plano completo, com as fontes, as decisões e as fases, está em [PLANO.md](PLANO.md).

## Como funciona

Tudo roda na Cloudflare, no plano gratuito:

- **Worker** (`src/`): roda a cada minuto, consulta as fontes, grava as leituras e responde a API em `/api/*`.
- **D1**: dois bancos SQLite. `nivel-rio` é o definitivo; `nivel-rio-brutos` guarda o que o coletor provisório (passo zero) baixou e as respostas que o coletor não conseguiu entender.
- **Site** (`public/`): HTML, CSS e JavaScript puros (módulos em `public/js/`), servidos pelo mesmo Worker. Mapa com MapLibre e fundo do OpenFreeMap (gratuito, sem chave); traçado dos rios do OpenStreetMap em `public/mapa/rios.geojson`. Gráfico grande com uPlot; os pequenos são SVG feitos à mão. As bibliotecas ficam copiadas em `public/vendor/`.

Cada push na branch `main` publica a versão nova automaticamente (Workers Builds, ligado no painel da Cloudflare). O comando de publicação é `npm run deploy`, que aplica as migrações dos bancos e publica o Worker.

## Estrutura

| Caminho | O que tem |
|---|---|
| `src/index.ts` | Entrada do Worker: rotas da API e o que roda em cada minuto |
| `src/fontes/` | Um parser por fonte (Estado, Itajaí, AlertaBlu) |
| `src/coletor.ts` | Coleta ao vivo e tapa-buraco com o histórico do Estado |
| `src/banco.ts` | Gravação: sem duplicar leitura, comporta e cota só quando mudam |
| `src/picos.ts` | Apaga picos de sensor (salto de mais de 1 m que volta em até 30 min) e guarda cada um na tabela `descartes` |
| `src/agora.ts` | Resumo da tela inicial, montado depois de cada coleta |
| `src/graficos.ts` | Séries de 24 h de todas as estações (um ponto a cada 30 min), para os gráficos pequenos |
| `src/alertas.ts` | Avisos: mudança de faixa, subida rápida, comporta, fonte fora do ar; Telegram quando houver bot |
| `src/importacao.ts` | Importa o que o passo zero guardou (roda sozinho até acabar) |
| `src/passo-zero.ts` | Download único do histórico do Estado (últimos 90 dias) |
| `src/consultas/` | Consultas GraphQL do Estado, idênticas às do site deles (não editar) |
| `catalogo/estacoes.json` | Catálogo de estações: id, rio, município, coordenadas, ordem rio abaixo, códigos em cada fonte |
| `migrations/` | Estrutura do banco definitivo |
| `migrations-brutos/` | Estrutura do banco de brutos |
| `amostras/` | Respostas reais das fontes, usadas nos testes |
| `public/index.html`, `public/js/inicio.js` | Tela inicial: mapa, níveis por cidade ou por região do rio, barragens, chuva e avisos |
| `public/estacao.html`, `public/js/estacao.js` | Página de cada estação e barragem (`/estacao/{id}`) |
| `public/js/mapa.js`, `graficos.js`, `componentes.js`, `comum.js` | Mapa, gráficos e peças comuns |
| `public/saude.html` | Saúde do coletor |
| `test/` | Testes (Vitest); `banco.test.ts` usa um D1 local |

## API

| Endereço | O que devolve |
|---|---|
| `/api/agora` | Tudo o que a tela inicial mostra: última leitura de cada estação (com coordenadas), leituras de 1 h e 3 h antes, cotas, barragens e comportas, situação das fontes, avisos das últimas 24 h, séries de 24 h (`graficos`) e a chuva nos pluviômetros da bacia (`chuva`) |
| `/api/estacoes/{id}?horas=24` | Série de uma estação (24, 72, 168 ou 720 horas). Barragens devolvem ocupação, nível e o histórico de cada comporta |
| `/api/status` | Situação do coletor e da importação, os picos descartados e os avisos (com o resultado do envio ao Telegram) |

As páginas `/` e `/estacao/{id}` passam pelo Worker: recebem os dados já embutidos e, na estação, o título com o nível atual (aparece quando o link é compartilhado).

## Telegram (avisos)

Os avisos já são gerados e aparecem no site. Para irem também para o Telegram, crie um bot com o @BotFather, um canal público com o bot como administrador, e guarde três segredos no Worker:

```bash
npx wrangler secret put TELEGRAM_TOKEN   # token do bot
npx wrangler secret put TELEGRAM_CANAL   # @nome_do_canal (avisos públicos)
npx wrangler secret put TELEGRAM_ADMIN   # id do seu chat (fonte fora do ar)
```

## Comandos

```bash
npm install          # instala as ferramentas
npm test             # roda os testes
npm run typecheck    # confere os tipos
npm run deploy       # publica na Cloudflare (normalmente é automático pelo GitHub)
```

Para conferir se há buracos nas últimas 72 horas (critério da fase 1), veja `consultas/buracos.sql`.

## Fontes

| Fonte | Uso |
|---|---|
| Defesa Civil de SC, Rede Integrada de Monitoramento | Estações da bacia e barragens, com comportas; chuva acumulada dos pluviômetros |
| Defesa Civil de Itajaí | As 11 estações da cidade |
| AlertaBlu (Defesa Civil de Blumenau) | Nível oficial de Blumenau e as cotas de lá |

Os dados pertencem às Defesas Civis. O projeto só os guarda e apresenta. Mapa: © colaboradores do OpenStreetMap (ODbL); fundo pelo OpenFreeMap.
