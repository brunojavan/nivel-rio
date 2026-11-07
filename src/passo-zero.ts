// Passo zero: o que sobrou do coletor provisório.
// Até 7 nov 2026 ele guardava as respostas brutas a cada 5 minutos; a fase 1 assumiu essa coleta.
// Continua só o download único do histórico do Estado (últimos 90 dias), até a fila acabar.
// Depois, src/importacao.ts leva tudo para o banco definitivo e este arquivo sai do projeto.

import CONSULTA_TAGS from './consultas/estado-tags-data.graphql';
import CONSULTA_HISTORICO from './consultas/estado-historico.graphql';
import { conferirHistorico } from './historico';
import { guardarBruto as guardar } from './brutos';
import { baixar, postGraphql, URL_ESTADO } from './rede';

// Download único do histórico do Estado. A fila começa em 1º ago 2026, 0h de Brasília, mas o Estado
// só aceita consultas que começam nos últimos 90 dias (responde "Operação bloqueada" antes disso;
// medido em 7 nov 2026). Cada janela é cortada nesse limite na hora de baixar.
export const INICIO_HISTORICO = '2026-08-01T03:00:00.000Z';
const LIMITE_DIAS = 90;
const FOLGA_LIMITE_MS = 30 * 60_000;
const JANELA_DIAS = 7;
const MAX_TENTATIVAS = 5;

const decoder = new TextDecoder();

type EstacaoEstado = { codigo?: string; name?: { general?: string | null }; position?: { bacia?: string | null } };

// Monta a fila do download do histórico: cada estação da bacia do Itajaí, em janelas de 7 dias.
async function criarFila(env: Env, agora: string): Promise<void> {
  const r = await baixar(URL_ESTADO, postGraphql('Tags_data', {}, CONSULTA_TAGS));
  if (r.erro || !r.corpo) {
    console.log(JSON.stringify({ fonte: 'estado-historico', etapa: 'criar fila', erro: r.erro }));
    return;
  }
  const lista: EstacaoEstado[] = JSON.parse(decoder.decode(r.corpo))?.data?.tags_data?.qualle_meteorologia ?? [];
  const codigos = lista
    .filter((e) => (e.position?.bacia ?? '').includes('Itaja') || (e.name?.general ?? '').includes('Barragem'))
    .map((e) => e.codigo)
    .filter((c): c is string => !!c);

  const fimMs = Date.parse(agora);
  const janelas: Array<{ i: string; f: string }> = [];
  for (let ini = Date.parse(INICIO_HISTORICO); ini < fimMs; ini += JANELA_DIAS * 86_400_000) {
    janelas.push({ i: new Date(ini).toISOString(), f: new Date(Math.min(ini + JANELA_DIAS * 86_400_000, fimMs)).toISOString() });
  }
  const linhas = codigos.flatMap((c) => janelas.map((j) => ({ c, i: j.i, f: j.f })));

  await env.BRUTOS.batch([
    env.BRUTOS.prepare(
      `INSERT OR IGNORE INTO fila_historico (codigo, inicio, fim)
       SELECT json_extract(value, '$.c'), json_extract(value, '$.i'), json_extract(value, '$.f') FROM json_each(?)`,
    ).bind(JSON.stringify(linhas)),
    env.BRUTOS.prepare(`INSERT OR REPLACE INTO controle (chave, valor) VALUES ('fila_criada', ?)`).bind(
      JSON.stringify({ em: agora, estacoes: codigos.length, janelas: janelas.length, ate: agora }),
    ),
  ]);
  console.log(JSON.stringify({ fonte: 'estado-historico', etapa: 'fila criada', estacoes: codigos.length, janelas: linhas.length }));
}

// Baixa uma janela do histórico por execução, das mais antigas para as mais novas,
// porque as mais antigas são as primeiras a sumir do Estado.
// As consultas usam o índice (situacao, inicio, codigo) e leem poucas linhas: o plano grátis do D1
// permite 5 milhões de linhas lidas por dia na conta toda.
// Devolve false quando a fila acabou.
export async function passoHistorico(env: Env, agora: string): Promise<boolean> {
  const criada = await env.BRUTOS.prepare(`SELECT valor FROM controle WHERE chave = 'fila_criada'`).first();
  if (!criada) {
    await criarFila(env, agora);
    return true;
  }

  const limite = Date.parse(agora) - LIMITE_DIAS * 86_400_000 + FOLGA_LIMITE_MS;
  const limiteIso = new Date(limite).toISOString();

  // Janelas que já saíram inteiras do alcance do Estado ficam na frente da fila: marca e segue.
  let j: { codigo: string; inicio: string; fim: string } | null = null;
  for (let i = 0; i < 20; i++) {
    j = await env.BRUTOS.prepare(
      `SELECT codigo, inicio, fim FROM fila_historico WHERE situacao = 'pendente' ORDER BY inicio, codigo LIMIT 1`,
    ).first();
    if (!j || j.fim > limiteIso) break;
    await env.BRUTOS.prepare(`UPDATE fila_historico SET situacao = 'indisponivel', atualizado_em = ? WHERE codigo = ? AND inicio = ?`)
      .bind(agora, j.codigo, j.inicio)
      .run();
    j = null;
  }
  if (!j) return false;

  const inicioIso = new Date(Math.max(Date.parse(j.inicio), limite)).toISOString();
  const r = await baixar(
    URL_ESTADO,
    postGraphql('Historic', { stationCode: j.codigo, startDate: inicioIso, endDate: j.fim, interval: null }, CONSULTA_HISTORICO),
  );
  let erro = r.erro;
  let itens: number | null = null;
  if (!erro && r.corpo) ({ erro, itens } = conferirHistorico(r.corpo));
  const id = await guardar(env, 'estado-historico', `${j.codigo} ${inicioIso} ${j.fim}`, agora, r, erro);
  await env.BRUTOS.prepare(
    `UPDATE fila_historico
     SET situacao = CASE WHEN ?1 IS NULL THEN 'feito' WHEN tentativas + 1 >= ?2 THEN 'erro' ELSE 'pendente' END,
         tentativas = tentativas + 1, itens = ?3, bruto_id = ?4, atualizado_em = ?5
     WHERE codigo = ?6 AND inicio = ?7`,
  )
    .bind(erro, MAX_TENTATIVAS, itens, id, agora, j.codigo, j.inicio)
    .run();
  if (erro) console.log(JSON.stringify({ fonte: 'estado-historico', codigo: j.codigo, inicio: j.inicio, erro }));
  return true;
}
