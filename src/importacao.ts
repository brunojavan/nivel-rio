// Importa para o banco definitivo o que o passo zero guardou no banco de brutos:
// 1. as respostas ao vivo (Estado, Itajaí, AlertaBlu) de 7 nov 2026 até a fase 1 entrar no ar;
// 2. o histórico do Estado desde 9 ago 2026, das janelas mais novas para as mais antigas.
// Uma resposta por execução. O histórico entra como tapa-buraco: não duplica o que a coleta ao vivo já gravou.
//
// O plano grátis do D1 permite 100 mil linhas gravadas por dia na conta toda. A coleta normal usa perto de 15 mil;
// a importação para quando passa de ORCAMENTO_DIA no dia (em UTC) e continua no dia seguinte.
import { gravar, gravarControle, lerControle } from './banco';
import { principaisDaFonte } from './catalogo';
import { lerAlertaBlu } from './fontes/alertablu';
import { lerEstadoAoVivo, lerHistoricoEstado } from './fontes/estado';
import { lerItajai } from './fontes/itajai';
import type { Resultado } from './fontes/tipos';
import { bytesDoBanco, gunzip } from './gzip';

export const ORCAMENTO_DIA = 50_000;

type Situacao = {
  dia: string;
  linhas_dia: number;
  cursor: Record<string, string>; // última resposta ao vivo importada, por fonte (coletado_em)
  ao_vivo_ok: boolean;
  respostas: number;
  janelas: number;
  linhas: number;
  terminou_em: string | null;
};

const AO_VIVO: Array<[string, (texto: string) => Resultado]> = [
  ['estado', lerEstadoAoVivo],
  ['itajai', lerItajai],
  ['alertablu', lerAlertaBlu],
];

const decoder = new TextDecoder();

// Devolve true quando gravou alguma coisa nova.
export async function importarPassoZero(env: Env): Promise<boolean> {
  const hoje = new Date().toISOString().slice(0, 10);
  const s: Situacao = (await lerControle<Situacao>(env.DB, 'importacao')) ?? {
    dia: hoje,
    linhas_dia: 0,
    cursor: {},
    ao_vivo_ok: false,
    respostas: 0,
    janelas: 0,
    linhas: 0,
    terminou_em: null,
  };
  if (s.terminou_em) return false;
  if (s.dia !== hoje) {
    s.dia = hoje;
    s.linhas_dia = 0;
  }
  if (s.linhas_dia >= ORCAMENTO_DIA) return false;

  let gravadas = 0;
  let novas = 0;

  if (!s.ao_vivo_ok) {
    let achou = false;
    for (const [fonte, ler] of AO_VIVO) {
      const b = await env.BRUTOS.prepare(
        `SELECT coletado_em, gzip FROM brutos WHERE fonte = ? AND coletado_em > ? AND erro IS NULL AND gzip IS NOT NULL
         ORDER BY coletado_em LIMIT 1`,
      )
        .bind(fonte, s.cursor[fonte] ?? '')
        .first<{ coletado_em: string; gzip: unknown }>();
      if (!b) continue;
      achou = true;
      try {
        const r = ler(decoder.decode(await gunzip(bytesDoBanco(b.gzip))));
        const g = await gravar(env.DB, r, fonte, 'medicao', Math.floor(Date.parse(b.coletado_em) / 1000));
        gravadas += g.linhas_gravadas;
        novas += g.leituras + g.barragens + g.comportas;
      } catch (e) {
        console.log(JSON.stringify({ importacao: fonte, coletado_em: b.coletado_em, erro: String(e) }));
      }
      s.cursor[fonte] = b.coletado_em;
      s.respostas++;
      break;
    }
    if (!achou) s.ao_vivo_ok = true;
  } else {
    // Histórico: pula as estações que não estão no catálogo (o passo zero baixou a bacia inteira).
    const estacoes = principaisDaFonte('estado');
    let feito = false;
    for (let i = 0; i < 40 && !feito; i++) {
      const j = await env.BRUTOS.prepare(
        `SELECT codigo, inicio, bruto_id FROM fila_historico WHERE situacao = 'feito' AND importado IS NULL
         ORDER BY inicio DESC LIMIT 1`,
      ).first<{ codigo: string; inicio: string; bruto_id: number }>();
      if (!j) {
        // Só termina de vez quando a fila do passo zero também acabou.
        const pendente = await env.BRUTOS.prepare(`SELECT 1 FROM fila_historico WHERE situacao = 'pendente' LIMIT 1`).first();
        if (!pendente) s.terminou_em = new Date().toISOString();
        break;
      }
      let importado = 0;
      if (estacoes.has(j.codigo)) {
        feito = true;
        const b = await env.BRUTOS.prepare(`SELECT gzip FROM brutos WHERE id = ?`).bind(j.bruto_id).first<{ gzip: unknown }>();
        if (b?.gzip) {
          try {
            const r = lerHistoricoEstado(decoder.decode(await gunzip(bytesDoBanco(b.gzip))), j.codigo);
            const g = await gravar(env.DB, r, 'estado', 'tapa-buraco', Math.floor(Date.now() / 1000));
            gravadas += g.linhas_gravadas;
            novas += g.leituras + g.barragens;
            importado = g.leituras + g.barragens;
          } catch (e) {
            console.log(JSON.stringify({ importacao: 'estado-historico', codigo: j.codigo, inicio: j.inicio, erro: String(e) }));
          }
        }
        s.janelas++;
      }
      await env.BRUTOS.prepare(`UPDATE fila_historico SET importado = ? WHERE codigo = ? AND inicio = ?`)
        .bind(importado, j.codigo, j.inicio)
        .run();
    }
  }

  s.linhas_dia += gravadas;
  s.linhas += novas;
  await gravarControle(env.DB, 'importacao', s).run();
  return novas > 0;
}
