// Picos de sensor: leituras que se afastam mais de 1 m do nível anterior e voltam para perto dele em até
// 30 minutos.
//
// Vistos nos dados de nov 2026: Rio do Sul caiu 1,19 m numa leitura e voltou na seguinte; Ascurra caiu
// 2,26 m e voltou; Ilhota teve quedas de até 6 m durante meia hora. Nenhum rio da bacia sobe ou desce 1 m
// e volta ao mesmo nível em 30 minutos, então isso é defeito de leitura.
//
// Só se apaga quando o nível volta. Uma subida de verdade, que não volta, nunca é apagada. A leitura mais
// recente, que ainda não tem a seguinte para confirmar, fica no ar até a próxima coleta decidir.
// Estações que medem de hora em hora (Blumenau) nunca entram: a leitura anterior está a mais de 30 minutos.

export const SALTO_M = 1;
export const JANELA_S = 30 * 60;

export type Ponto = { t: number; n: number };

// Recebe a série de uma estação em ordem de horário e devolve os pontos que são pico.
export function acharPicos<P extends Ponto>(serie: P[]): P[] {
  const picos: P[] = [];
  let antes: P | undefined; // última leitura aceita
  let i = 0;
  while (i < serie.length) {
    const p = serie[i];
    if (antes && Math.abs(p.n - antes.n) > SALTO_M && p.t - antes.t < JANELA_S) {
      // Procura a primeira leitura que volta para perto do nível de antes, dentro da janela.
      let j = i + 1;
      while (j < serie.length && serie[j].t - antes.t <= JANELA_S && Math.abs(serie[j].n - antes.n) > SALTO_M) j++;
      if (j < serie.length && serie[j].t - antes.t <= JANELA_S) {
        picos.push(...serie.slice(i, j));
        antes = serie[j];
        i = j + 1;
        continue;
      }
      // Não voltou (o nível mudou de fato) ou ainda não chegou a leitura seguinte: fica.
    }
    antes = p;
    i++;
  }
  return picos;
}

// Depois de gravar, confere as estações que ganharam leitura nova. Lê do banco a série em volta das
// leituras novas (com folga para trás, para achar a leitura de antes do pico) e apaga os picos,
// guardando cada um na tabela descartes. A consulta só devolve as estações em que a diferença entre
// o maior e o menor nível do trecho passa de 1 m; no dia a dia, nenhuma.
const FOLGA_S = JANELA_S + 600;

export async function limparPicos(db: D1Database, novas: Array<{ e: string; t: number }>): Promise<number> {
  if (!novas.length) return 0;
  const faixas = new Map<string, [number, number]>();
  for (const { e, t } of novas) {
    const f = faixas.get(e);
    if (!f) faixas.set(e, [t, t]);
    else {
      if (t < f[0]) f[0] = t;
      if (t > f[1]) f[1] = t;
    }
  }
  const { results } = await db
    .prepare(
      `WITH f AS (
         SELECT json_extract(value, '$[0]') AS e, json_extract(value, '$[1]') AS de, json_extract(value, '$[2]') AS ate FROM json_each(?1)
       ), x AS (
         SELECT l.estacao_id AS e, l.medido_em AS t, l.nivel_m AS n, l.fonte AS fonte,
                MAX(l.nivel_m) OVER (PARTITION BY l.estacao_id) - MIN(l.nivel_m) OVER (PARTITION BY l.estacao_id) AS amplitude
         FROM f JOIN leituras l ON l.estacao_id = f.e AND l.medido_em BETWEEN f.de AND f.ate
       )
       SELECT e, t, n, fonte FROM x WHERE amplitude > ?2 ORDER BY e, t`,
    )
    .bind(JSON.stringify([...faixas].map(([e, [de, ate]]) => [e, de - FOLGA_S, ate + FOLGA_S])), SALTO_M)
    .all<{ e: string; t: number; n: number; fonte: string }>();

  const porEstacao = new Map<string, typeof results>();
  for (const r of results) {
    const s = porEstacao.get(r.e);
    if (s) s.push(r);
    else porEstacao.set(r.e, [r]);
  }
  const picos = [...porEstacao.values()].flatMap((s) => acharPicos(s));
  if (!picos.length) return 0;

  const lista = JSON.stringify(picos.map((p) => [p.e, p.t, p.n, p.fonte]));
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO descartes (estacao_id, medido_em, nivel_m, fonte, motivo, descartado_em)
         SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]'), 'pico', ?2
         FROM json_each(?1)`,
      )
      .bind(lista, Math.floor(Date.now() / 1000)),
    db
      .prepare(
        `DELETE FROM leituras WHERE (estacao_id, medido_em) IN (
           SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?1)
         )`,
      )
      .bind(lista),
  ]);
  console.log(JSON.stringify({ picos: picos.slice(0, 20).map((p) => ({ estacao: p.e, t: p.t, nivel: p.n })) }));
  return picos.length;
}
