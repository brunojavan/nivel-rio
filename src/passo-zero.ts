// Passo zero: coletor provisório.
// Guarda as respostas das fontes do jeito que vieram (comprimidas), sem interpretar nada,
// para o histórico começar já. O coletor da fase 1 importa tudo e este arquivo sai do projeto.

import CONSULTA_TAGS from './consultas/estado-tags-data.graphql';
import CONSULTA_HISTORICO from './consultas/estado-historico.graphql';
import { gzip } from './gzip';

export const URL_ESTADO = 'https://monitoramento.defesacivil.sc.gov.br/graphql';
export const URL_ITAJAI = 'https://monitoramento.defesacivil.itajai.sc.gov.br/data/current/app.json';
export const URL_ALERTABLU = 'https://defesacivil.blumenau.sc.gov.br/static/data/nivel_oficial.json';

const USER_AGENT = 'nivel-rio/0.1 (+https://github.com/brunojavan/nivel-rio)';
const TIMEOUT_MS = 25_000;

// Download único do histórico do Estado. A fila começa em 1º ago 2026, 0h de Brasília, mas o Estado
// só aceita consultas que começam nos últimos 90 dias (responde "Operação bloqueada" antes disso;
// medido em 7 nov 2026). Cada janela é cortada nesse limite na hora de baixar.
export const INICIO_HISTORICO = '2026-08-01T03:00:00.000Z';
const LIMITE_DIAS = 90;
const FOLGA_LIMITE_MS = 30 * 60_000;
const JANELA_DIAS = 7;
const JANELAS_POR_EXECUCAO = 2;
const MAX_TENTATIVAS = 5;

type Resposta = { status: number | null; corpo: Uint8Array | null; ms: number; erro: string | null };

async function baixar(url: string, init: RequestInit = {}): Promise<Resposta> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      ...init,
      headers: { 'user-agent': USER_AGENT, accept: 'application/json', ...(init.headers as Record<string, string>) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const corpo = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, corpo, ms: Date.now() - t0, erro: r.ok ? null : `HTTP ${r.status}` };
  } catch (e) {
    return { status: null, corpo: null, ms: Date.now() - t0, erro: String(e) };
  }
}

function postGraphql(operationName: string, variables: Record<string, unknown>, query: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operationName, variables, query }),
  };
}

const decoder = new TextDecoder();
function comecaCom(corpo: Uint8Array | null, prefixo: string): boolean {
  return !!corpo && decoder.decode(corpo.subarray(0, prefixo.length)) === prefixo;
}

async function guardar(env: Env, fonte: string, chave: string | null, coletadoEm: string, r: Resposta, erro: string | null): Promise<number> {
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

// Resumo ao vivo do Estado: todas as estações de SC numa consulta só, incluindo as comportas.
// O Estado não guarda histórico das comportas, então esta coleta é a única forma de ter esse dado.
export async function coletarEstado(env: Env, agora: string): Promise<void> {
  const r = await baixar(URL_ESTADO, postGraphql('Tags_data', {}, CONSULTA_TAGS));
  let erro = r.erro;
  if (!erro && !comecaCom(r.corpo, '{"data":{"tags_data":{')) erro = 'resposta inesperada';
  await guardar(env, 'estado', null, agora, r, erro);
  if (erro) console.log(JSON.stringify({ fonte: 'estado', erro }));
}

// Itajaí publica uma série de 12 h; coletar duas vezes por hora já não perde nada.
export async function coletarItajai(env: Env, agora: string): Promise<void> {
  const r = await baixar(URL_ITAJAI);
  let erro = r.erro;
  if (!erro && !comecaCom(r.corpo, '{')) erro = 'resposta inesperada';
  await guardar(env, 'itajai', null, agora, r, erro);
  if (erro) console.log(JSON.stringify({ fonte: 'itajai', erro }));
}

// AlertaBlu: nível oficial de Blumenau, de hora em hora, com série de 24 h.
export async function coletarAlertaBlu(env: Env, agora: string): Promise<void> {
  const r = await baixar(URL_ALERTABLU);
  let erro = r.erro;
  if (!erro && !comecaCom(r.corpo, '{')) erro = 'resposta inesperada';
  await guardar(env, 'alertablu', null, agora, r, erro);
  if (erro) console.log(JSON.stringify({ fonte: 'alertablu', erro }));
}

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

// Baixa algumas janelas do histórico por execução, das mais antigas para as mais novas,
// porque as mais antigas são as primeiras a sumir do Estado.
export async function passoHistorico(env: Env, agora: string): Promise<void> {
  const criada = await env.BRUTOS.prepare(`SELECT valor FROM controle WHERE chave = 'fila_criada'`).first();
  if (!criada) return criarFila(env, agora);

  const { results } = await env.BRUTOS.prepare(
    `SELECT codigo, inicio, fim FROM fila_historico
     WHERE situacao IN ('pendente', 'erro') AND tentativas < ?
     ORDER BY inicio, codigo LIMIT ?`,
  )
    .bind(MAX_TENTATIVAS, JANELAS_POR_EXECUCAO)
    .all<{ codigo: string; inicio: string; fim: string }>();

  const limite = Date.parse(agora) - LIMITE_DIAS * 86_400_000 + FOLGA_LIMITE_MS;
  for (const j of results) {
    const inicio = Math.max(Date.parse(j.inicio), limite);
    if (inicio >= Date.parse(j.fim)) {
      // A janela inteira já saiu do alcance do Estado.
      await env.BRUTOS.prepare(
        `UPDATE fila_historico SET situacao = 'indisponivel', atualizado_em = ? WHERE codigo = ? AND inicio = ?`,
      )
        .bind(agora, j.codigo, j.inicio)
        .run();
      continue;
    }
    const inicioIso = new Date(inicio).toISOString();
    const r = await baixar(
      URL_ESTADO,
      postGraphql('Historic', { stationCode: j.codigo, startDate: inicioIso, endDate: j.fim, interval: null }, CONSULTA_HISTORICO),
    );
    let erro = r.erro;
    let itens: number | null = null;
    if (!erro && r.corpo) {
      try {
        const d = JSON.parse(decoder.decode(r.corpo));
        if (d?.errors?.length) erro = 'GraphQL: ' + JSON.stringify(d.errors).slice(0, 300);
        else itens = d?.data?.historic?.items?.length ?? 0;
      } catch {
        erro = 'JSON inválido';
      }
    }
    const id = await guardar(env, 'estado-historico', `${j.codigo} ${inicioIso} ${j.fim}`, agora, r, erro);
    await env.BRUTOS.prepare(
      `UPDATE fila_historico SET situacao = ?, tentativas = tentativas + 1, itens = ?, bruto_id = ?, atualizado_em = ?
       WHERE codigo = ? AND inicio = ?`,
    )
      .bind(erro ? 'erro' : 'feito', itens, id, agora, j.codigo, j.inicio)
      .run();
    if (erro) console.log(JSON.stringify({ fonte: 'estado-historico', codigo: j.codigo, inicio: j.inicio, erro }));
  }
}
