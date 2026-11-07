# Nível Rio

Nível dos rios Itajaí-Açu e Itajaí-Mirim e situação das três barragens da bacia (incluindo quais comportas estão abertas), com histórico próprio, site público e alertas.

**Endereço:** https://nivel-rio.nivel-rio.workers.dev (em construção)

> Este site não substitui a Defesa Civil. Em caso de cheia, ligue **199** e cadastre-se para receber alertas por SMS no **40199** (mande o seu CEP).

O plano completo, com as fontes, as decisões e as fases, está em [PLANO.md](PLANO.md).

## Como funciona

Tudo roda na Cloudflare, no plano gratuito:

- **Worker** (`src/`): roda a cada minuto, consulta as fontes e responde a API em `/api/*`.
- **D1**: dois bancos SQLite. `nivel-rio` é o definitivo; `nivel-rio-brutos` guarda as respostas brutas do coletor provisório (passo zero).
- **Site** (`public/`): arquivos estáticos servidos pelo mesmo Worker.

Cada push na branch `main` publica a versão nova automaticamente (Workers Builds, ligado no painel da Cloudflare). O comando de publicação é `npm run deploy`, que aplica as migrações dos bancos e publica o Worker.

## Estrutura

| Caminho | O que tem |
|---|---|
| `src/index.ts` | Entrada do Worker: API e agendamento (o que roda em cada minuto) |
| `src/passo-zero.ts` | Coletor provisório: guarda as respostas brutas e baixa o histórico do Estado |
| `src/consultas/` | Consultas GraphQL do Estado, idênticas às do site deles (não editar) |
| `catalogo/estacoes.json` | Catálogo de estações: id, rio, município, coordenadas, ordem rio abaixo, códigos em cada fonte |
| `migrations/` | Estrutura do banco definitivo |
| `migrations-brutos/` | Estrutura do banco provisório |
| `amostras/` | Respostas reais das fontes, usadas nos testes |
| `public/` | Site |
| `test/` | Testes (Vitest) |

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
| AlertaBlu (Defesa Civil de Blumenau) | Nível oficial de Blumenau |

Os dados pertencem às Defesas Civis. O projeto só os guarda e apresenta.
