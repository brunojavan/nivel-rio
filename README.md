# Nível Rio

Nível dos rios Itajaí-Açu e Itajaí-Mirim e situação das três barragens da bacia (incluindo quais comportas estão abertas), com histórico próprio, site público e alertas.

**Endereço:** https://nivel-rio.nivel-rio.workers.dev (primeira versão, em teste)

> Este site não substitui a Defesa Civil. Em caso de cheia, ligue **199** e cadastre-se para receber alertas por SMS no **40199** (mande o seu CEP).

O plano completo, com as fontes, as decisões e as fases, está em [PLANO.md](PLANO.md).

## Como funciona

Tudo roda na Cloudflare, no plano gratuito:

- **Worker** (`src/`): roda a cada minuto, consulta as fontes, grava as leituras e responde a API em `/api/*`.
- **D1**: dois bancos SQLite. `nivel-rio` é o definitivo; `nivel-rio-brutos` guarda o que o coletor provisório (passo zero) baixou e as respostas que o coletor não conseguiu entender.
- **Site** (`public/`): HTML, CSS e JavaScript puros, servidos pelo mesmo Worker. Gráficos com uPlot (copiado em `public/vendor/`).

Cada push na branch `main` publica a versão nova automaticamente (Workers Builds, ligado no painel da Cloudflare). O comando de publicação é `npm run deploy`, que aplica as migrações dos bancos e publica o Worker.

## Estrutura

| Caminho | O que tem |
|---|---|
| `src/index.ts` | Entrada do Worker: rotas da API e o que roda em cada minuto |
| `src/fontes/` | Um parser por fonte (Estado, Itajaí, AlertaBlu) |
| `src/coletor.ts` | Coleta ao vivo e tapa-buraco com o histórico do Estado |
| `src/banco.ts` | Gravação: sem duplicar leitura, comporta e cota só quando mudam |
| `src/agora.ts` | Resumo da tela inicial, montado depois de cada coleta |
| `src/importacao.ts` | Importa o que o passo zero guardou (roda sozinho até acabar) |
| `src/passo-zero.ts` | Download único do histórico do Estado (últimos 90 dias) |
| `src/consultas/` | Consultas GraphQL do Estado, idênticas às do site deles (não editar) |
| `catalogo/estacoes.json` | Catálogo de estações: id, rio, município, coordenadas, ordem rio abaixo, códigos em cada fonte |
| `migrations/` | Estrutura do banco definitivo |
| `migrations-brutos/` | Estrutura do banco de brutos |
| `amostras/` | Respostas reais das fontes, usadas nos testes |
| `public/` | Site |
| `test/` | Testes (Vitest); `banco.test.ts` usa um D1 local |

## API

| Endereço | O que devolve |
|---|---|
| `/api/agora` | Tudo o que a tela inicial mostra: última leitura de cada estação, leituras de 1 h e 3 h antes, cotas, barragens e comportas, situação das fontes |
| `/api/estacoes/{id}?horas=24` | Série de uma estação (24, 72, 168 ou 720 horas). Barragens devolvem ocupação e nível |
| `/api/status` | Situação do coletor e da importação |

## Comandos

```bash
npm install          # instala as ferramentas
npm test             # roda os testes
npm run typecheck    # confere os tipos
npm run deploy       # publica na Cloudflare (normalmente é automático pelo GitHub)
```

## Fontes

| Fonte | Uso |
|---|---|
| Defesa Civil de SC, Rede Integrada de Monitoramento | Estações da bacia e barragens, com comportas |
| Defesa Civil de Itajaí | As 11 estações da cidade |
| AlertaBlu (Defesa Civil de Blumenau) | Nível oficial de Blumenau e as cotas de lá |

Os dados pertencem às Defesas Civis. O projeto só os guarda e apresenta.
