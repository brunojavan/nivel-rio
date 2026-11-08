// Gravação no banco definitivo.
//
// Regras (PLANO.md, "Modelo de dados" e "Como evitar a falsa estabilidade"):
// - cada leitura é gravada uma vez, pelo horário da medição; a mesma leitura vista em várias coletas não duplica;
// - "medicao" grava tudo o que é novo; "tapa-buraco" (histórico do Estado) só grava um ponto quando não há
//   nenhuma leitura da estação a menos de 5 minutos dele, para não misturar a série ao vivo com a de 10 min;
// - comportas e cotas só ganham linha nova quando mudam;
// - leituras novas passam pela conferência de picos (src/picos.ts); uma leitura já descartada não volta a entrar.
//
// Cada comando manda todas as linhas de uma vez, como um texto JSON lido com json_each,
// para gastar uma consulta só por tabela.
import type { Resultado } from './fontes/tipos';
import { limparPicos } from './picos';

export type Modo = 'medicao' | 'tapa-buraco';

export const TOLERANCIA_TAPA_BURACO_S = 300;

export type Gravacao = { leituras: number; barragens: number; comportas: number; cotas: number; linhas_gravadas: number; picos: number };

export async function gravar(db: D1Database, r: Resultado, fonte: string, modo: Modo, agora: number): Promise<Gravacao> {
  const cmds: Array<[keyof Omit<Gravacao, 'linhas_gravadas'>, D1PreparedStatement]> = [];
  const tapa = modo === 'tapa-buraco';

  if (r.leituras.length) {
    cmds.push([
      'leituras',
      db
        .prepare(
          `INSERT OR IGNORE INTO leituras (estacao_id, medido_em, nivel_m, fonte)
           SELECT e, t, n, ?2 FROM (
             SELECT json_extract(value, '$[0]') AS e, json_extract(value, '$[1]') AS t, json_extract(value, '$[2]') AS n
             FROM json_each(?1)
           ) p
           WHERE NOT EXISTS (
             SELECT 1 FROM leituras l WHERE l.estacao_id = p.e AND l.medido_em BETWEEN p.t - ?3 AND p.t + ?3
           ) AND NOT EXISTS (
             SELECT 1 FROM descartes d WHERE d.estacao_id = p.e AND d.medido_em BETWEEN p.t - ?3 AND p.t + ?3
           )
           RETURNING estacao_id, medido_em`,
        )
        .bind(JSON.stringify(r.leituras.map((l) => [l.estacao, l.t, l.nivel])), fonte, tapa ? TOLERANCIA_TAPA_BURACO_S : 0),
    ]);
  }

  if (r.barragens.length) {
    cmds.push([
      'barragens',
      db
        .prepare(
          `INSERT OR IGNORE INTO leituras_barragem (barragem_id, medido_em, montante_m, jusante_m, ocupacao_pct, volume_hm3, vertido_m, fonte)
           SELECT b, t, m, j, o, v, d, ?2 FROM (
             SELECT json_extract(value, '$[0]') AS b, json_extract(value, '$[1]') AS t, json_extract(value, '$[2]') AS m,
                    json_extract(value, '$[3]') AS j, json_extract(value, '$[4]') AS o, json_extract(value, '$[5]') AS v,
                    json_extract(value, '$[6]') AS d
             FROM json_each(?1)
           ) p
           WHERE NOT EXISTS (
             SELECT 1 FROM leituras_barragem x WHERE x.barragem_id = p.b AND x.medido_em BETWEEN p.t - ?3 AND p.t + ?3
           )`,
        )
        .bind(
          JSON.stringify(r.barragens.map((b) => [b.barragem, b.t, b.montante, b.jusante, b.ocupacao, b.volume, b.vertido])),
          fonte,
          tapa ? TOLERANCIA_TAPA_BURACO_S : 0,
        ),
    ]);
  }

  if (r.comportas.length) {
    // Compara com o último estado conhecido até aquele horário.
    cmds.push([
      'comportas',
      db
        .prepare(
          `INSERT OR IGNORE INTO comportas (barragem_id, comporta, desde, aberta, fonte)
           SELECT b, c, t, a, ?2 FROM (
             SELECT json_extract(value, '$[0]') AS b, json_extract(value, '$[1]') AS c, json_extract(value, '$[2]') AS t,
                    json_extract(value, '$[3]') AS a
             FROM json_each(?1)
           ) n
           WHERE (
             SELECT x.aberta FROM comportas x
             WHERE x.barragem_id = n.b AND x.comporta = n.c AND x.desde <= n.t
             ORDER BY x.desde DESC LIMIT 1
           ) IS NOT n.a`,
        )
        .bind(JSON.stringify(r.comportas.map((c) => [c.barragem, c.comporta, c.t, c.aberta])), fonte),
    ]);
  }

  if (r.cotas.length) {
    cmds.push([
      'cotas',
      db
        .prepare(
          `INSERT OR IGNORE INTO cotas (estacao_id, fonte, valida_desde, atencao_m, alerta_m, emergencia_m)
           SELECT e, ?2, ?3, a, b, c FROM (
             SELECT json_extract(value, '$[0]') AS e, json_extract(value, '$[1]') AS a, json_extract(value, '$[2]') AS b,
                    json_extract(value, '$[3]') AS c
             FROM json_each(?1)
           ) n
           WHERE NOT EXISTS (
             SELECT 1 FROM cotas x
             WHERE x.estacao_id = n.e AND x.fonte = ?2
               AND x.atencao_m IS n.a AND x.alerta_m IS n.b AND x.emergencia_m IS n.c
               AND x.valida_desde = (SELECT MAX(valida_desde) FROM cotas y WHERE y.estacao_id = n.e AND y.fonte = ?2)
           )`,
        )
        .bind(JSON.stringify(r.cotas.map((c) => [c.estacao, c.atencao, c.alerta, c.emergencia])), fonte, agora),
    ]);
  }

  const g: Gravacao = { leituras: 0, barragens: 0, comportas: 0, cotas: 0, linhas_gravadas: 0, picos: 0 };
  if (!cmds.length) return g;
  const res = await db.batch(cmds.map(([, c]) => c));
  let novas: Array<{ e: string; t: number }> = [];
  res.forEach((x, i) => {
    const tabela = cmds[i][0];
    g[tabela] = x.meta.changes ?? 0;
    g.linhas_gravadas += x.meta.rows_written ?? 0;
    if (tabela === 'leituras') novas = (x.results as Array<{ estacao_id: string; medido_em: number }>).map((r) => ({ e: r.estacao_id, t: r.medido_em }));
  });
  g.picos = await limparPicos(db, novas);
  return g;
}

// Log de cada execução e situação de cada fonte.
export async function registrarColeta(
  db: D1Database,
  c: { fonte: string; inicio: number; duracao_ms: number; novas: number; descartadas: number; erro: string | null },
  atualizarFonte = true,
): Promise<void> {
  const cmds = [
    db
      .prepare(`INSERT INTO coletas (fonte, inicio, duracao_ms, leituras_novas, descartadas, erro) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(c.fonte, c.inicio, c.duracao_ms, c.novas, c.descartadas, c.erro),
  ];
  if (atualizarFonte)
    cmds.push(
      c.erro
        ? db.prepare(`UPDATE fontes SET ultimo_erro = ?, ultimo_erro_em = ? WHERE id = ?`).bind(c.erro, c.inicio, c.fonte)
        : db.prepare(`UPDATE fontes SET ultimo_sucesso = ? WHERE id = ?`).bind(c.inicio, c.fonte),
    );
  await db.batch(cmds);
}

export async function lerControle<T>(db: D1Database, chave: string): Promise<T | null> {
  const r = await db.prepare(`SELECT valor FROM controle WHERE chave = ?`).bind(chave).first<{ valor: string }>();
  return r ? (JSON.parse(r.valor) as T) : null;
}

export function gravarControle(db: D1Database, chave: string, valor: unknown): D1PreparedStatement {
  return db.prepare(`INSERT OR REPLACE INTO controle (chave, valor) VALUES (?, ?)`).bind(chave, JSON.stringify(valor));
}
