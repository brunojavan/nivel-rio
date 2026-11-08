// Séries das últimas 24 horas de todas as estações, com um ponto a cada 30 minutos, para os gráficos
// pequenos da tela inicial e do mapa. São montadas a cada 30 minutos e guardadas prontas (instantaneo
// 'graficos'); a leitura mais recente de cada estação vem do resumo de 5 em 5 minutos (/api/agora).
//
// O passo vai escrito na consulta, não como parâmetro: o D1 manda número do JavaScript como decimal,
// e a divisão deixaria de ser inteira.
// A consulta agrupa no próprio banco (um ponto por meia hora: a última leitura dela), então o Worker
// recebe perto de 2 mil linhas em vez de 11 mil. O banco ainda percorre as 24 h de cada estação
// (perto de 11 mil linhas lidas), 48 vezes por dia: cerca de 550 mil das 5 milhões diárias do plano grátis.
import { ESTACOES } from './catalogo';

export const PASSO_S = 1800;
const HORAS = 24;

const RIOS = ESTACOES.filter((e) => e.tipo === 'rio').map((e) => e.id);
const BARRAGENS = ESTACOES.filter((e) => e.tipo === 'barragem').map((e) => e.id);

export type Graficos = {
  gerado_em: string;
  de: number; // início da primeira meia hora (segundos UTC)
  passo: number;
  rios: Record<string, Array<number | null>>; // nível em m, um valor por meia hora
  barragens: Record<string, Array<number | null>>; // ocupação em %
};

export async function montarGraficos(db: D1Database, agora = Math.floor(Date.now() / 1000)): Promise<Graficos> {
  const de = Math.floor((agora - HORAS * 3600) / PASSO_S) * PASSO_S;
  const n = Math.floor((agora - de) / PASSO_S) + 1;
  const [rios, barragens] = await db.batch([
    db
      .prepare(
        `SELECT l.estacao_id AS e, l.medido_em / ${PASSO_S} AS b, l.nivel_m AS v, MAX(l.medido_em) AS t
         FROM json_each(?1) j JOIN leituras l ON l.estacao_id = j.value AND l.medido_em >= ?2
         GROUP BY l.estacao_id, l.medido_em / ${PASSO_S}`,
      )
      .bind(JSON.stringify(RIOS), de),
    db
      .prepare(
        `SELECT l.barragem_id AS e, l.medido_em / ${PASSO_S} AS b, l.ocupacao_pct AS v, MAX(l.medido_em) AS t
         FROM json_each(?1) j JOIN leituras_barragem l ON l.barragem_id = j.value AND l.medido_em >= ?2
         WHERE l.ocupacao_pct IS NOT NULL
         GROUP BY l.barragem_id, l.medido_em / ${PASSO_S}`,
      )
      .bind(JSON.stringify(BARRAGENS), de),
  ]);

  const montar = (ids: string[], linhas: Array<{ e: string; b: number; v: number }>, casas: number) => {
    const f = 10 ** casas;
    const saida: Record<string, Array<number | null>> = {};
    for (const id of ids) saida[id] = new Array(n).fill(null);
    for (const r of linhas) {
      const i = r.b - de / PASSO_S;
      if (i >= 0 && i < n && saida[r.e]) saida[r.e][i] = Math.round(r.v * f) / f;
    }
    return saida;
  };

  return {
    gerado_em: new Date(agora * 1000).toISOString(),
    de,
    passo: PASSO_S,
    rios: montar(RIOS, rios.results as Array<{ e: string; b: number; v: number }>, 2),
    barragens: montar(BARRAGENS, barragens.results as Array<{ e: string; b: number; v: number }>, 1),
  };
}

export async function atualizarGraficos(db: D1Database): Promise<void> {
  const g = await montarGraficos(db);
  await db
    .prepare(`INSERT OR REPLACE INTO instantaneo (chave, gerado_em, json) VALUES ('graficos', ?, ?)`)
    .bind(Math.floor(Date.now() / 1000), JSON.stringify(g))
    .run();
}
