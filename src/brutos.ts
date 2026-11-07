// Banco de brutos: guarda, comprimida, a resposta de uma fonte quando algo dá errado
// (o parser não entendeu, ou a fonte respondeu com erro), para dar para investigar depois.
import { gzip } from './gzip';
import type { Resposta } from './rede';

export async function guardarBruto(
  env: Env,
  fonte: string,
  chave: string | null,
  coletadoEm: string,
  r: Resposta,
  erro: string | null,
): Promise<number> {
  const gz = r.corpo && r.corpo.byteLength > 0 ? await gzip(r.corpo) : null;
  const tamGz = gz?.byteLength ?? 0;
  const [ins] = await env.BRUTOS.batch<{ id: number }>([
    env.BRUTOS.prepare(
      `INSERT INTO brutos (fonte, chave, coletado_em, status_http, duracao_ms, bytes, bytes_gz, gzip, erro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ).bind(fonte, chave, coletadoEm, r.status, r.ms, r.corpo?.byteLength ?? null, gz ? tamGz : null, gz, erro),
    env.BRUTOS.prepare(
      `INSERT INTO resumo (fonte, coletas, erros, bytes_gz, ultima_coleta, ultimo_sucesso, ultimo_erro, ultimo_erro_em)
       VALUES (?1, 1, ?2, ?3, ?4, CASE WHEN ?2 = 0 THEN ?4 END, ?5, CASE WHEN ?2 = 1 THEN ?4 END)
       ON CONFLICT (fonte) DO UPDATE SET
         coletas = coletas + 1,
         erros = erros + ?2,
         bytes_gz = bytes_gz + ?3,
         ultima_coleta = ?4,
         ultimo_sucesso = CASE WHEN ?2 = 0 THEN ?4 ELSE ultimo_sucesso END,
         ultimo_erro = CASE WHEN ?2 = 1 THEN ?5 ELSE ultimo_erro END,
         ultimo_erro_em = CASE WHEN ?2 = 1 THEN ?4 ELSE ultimo_erro_em END`,
    ).bind(fonte, erro ? 1 : 0, tamGz, coletadoEm, erro),
  ]);
  return ins.results[0].id;
}
