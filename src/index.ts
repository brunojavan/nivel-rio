import { atualizarAgora } from './agora';
import { POR_ID, sincronizarCatalogo } from './catalogo';
import { coletar, tapaBuraco } from './coletor';
import { importarPassoZero } from './importacao';
import { passoHistorico } from './passo-zero';
import { isoDeUnix } from './tempo';

function json(dados: unknown, status = 200, maxAge = 30): Response {
  return new Response(typeof dados === 'string' ? dados : JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` },
  });
}

// Guarda as respostas por alguns segundos dentro do próprio Worker, para poupar o banco quando muita gente
// abre o site ao mesmo tempo.
const memoria = new Map<string, { ate: number; texto: string }>();
async function lembrar(chave: string, segundos: number, gerar: () => Promise<string>): Promise<string> {
  const m = memoria.get(chave);
  if (m && m.ate > Date.now()) return m.texto;
  const texto = await gerar();
  if (memoria.size > 200) memoria.clear();
  memoria.set(chave, { ate: Date.now() + segundos * 1000, texto });
  return texto;
}

async function agora(env: Env): Promise<Response> {
  const texto = await lembrar('agora', 20, async () => {
    const r = await env.DB.prepare(`SELECT json FROM instantaneo WHERE chave = 'agora'`).first<{ json: string }>();
    return r?.json ?? (await atualizarAgora(env.DB));
  });
  return json(texto, 200, 30);
}

const HORAS_PERMITIDAS = new Set([24, 72, 168, 720]);

// Série de uma estação: /api/estacoes/rio-do-sul?horas=24
async function serie(env: Env, id: string, url: URL): Promise<Response> {
  const est = POR_ID.get(id);
  if (!est) return json({ erro: 'estação não encontrada' }, 404);
  const horas = Number(url.searchParams.get('horas') ?? 24);
  if (!HORAS_PERMITIDAS.has(horas)) return json({ erro: 'horas deve ser 24, 72, 168 ou 720' }, 400);
  const de = Math.floor(Date.now() / 1000) - horas * 3600;
  const chave = `${id}:${horas}:${Math.floor(Date.now() / 120_000)}`;

  const texto = await lembrar(chave, 120, async () => {
    if (est.tipo === 'barragem') {
      const { results } = await env.DB.prepare(
        `SELECT medido_em AS t, montante_m AS m, ocupacao_pct AS o FROM leituras_barragem
         WHERE barragem_id = ? AND medido_em >= ? ORDER BY medido_em`,
      )
        .bind(id, de)
        .all<{ t: number; m: number | null; o: number | null }>();
      return JSON.stringify({
        id,
        horas,
        t: results.map((r) => r.t),
        montante_m: results.map((r) => r.m),
        ocupacao_pct: results.map((r) => r.o),
      });
    }
    const { results } = await env.DB.prepare(
      `SELECT medido_em AS t, nivel_m AS n FROM leituras WHERE estacao_id = ? AND medido_em >= ? ORDER BY medido_em`,
    )
      .bind(id, de)
      .all<{ t: number; n: number }>();
    return JSON.stringify({ id, horas, t: results.map((r) => r.t), nivel_m: results.map((r) => r.n) });
  });
  return json(texto, 200, 120);
}

async function status(env: Env): Promise<Response> {
  const texto = await lembrar('status', 30, async () => {
    const [resumo, fila] = await env.BRUTOS.batch([
      env.BRUTOS.prepare(`SELECT * FROM resumo ORDER BY fonte`),
      env.BRUTOS.prepare(`SELECT situacao, COUNT(*) AS janelas, SUM(itens) AS itens FROM fila_historico GROUP BY situacao`),
    ]);
    const [coletas, contagem, importacao] = await env.DB.batch([
      env.DB.prepare(
        `SELECT fonte, COUNT(*) AS execucoes, SUM(erro IS NOT NULL) AS erros, SUM(leituras_novas) AS novas, MAX(inicio) AS ultima
         FROM coletas WHERE inicio >= ? GROUP BY fonte`,
      ).bind(Math.floor(Date.now() / 1000) - 86_400),
      env.DB.prepare(`SELECT (SELECT COUNT(*) FROM coletas) AS coletas`),
      env.DB.prepare(`SELECT valor FROM controle WHERE chave = 'importacao'`),
    ]);
    const imp = (importacao.results[0] as { valor?: string } | undefined)?.valor;
    return JSON.stringify({
      agora: new Date().toISOString(),
      versao: env.VERSAO,
      coletor: {
        ultimas_24h: (coletas.results as Array<Record<string, number | string>>).map((c) => ({ ...c, ultima: isoDeUnix(c.ultima as number) })),
        importacao_passo_zero: imp ? JSON.parse(imp) : null,
      },
      passo_zero: { fontes: resumo.results, historico: { situacoes: fila.results }, banco_bytes: resumo.meta.size_after },
      banco_principal: { bytes: contagem.meta.size_after },
    });
  });
  return json(texto, 200, 30);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'GET') return json({ erro: 'método não permitido' }, 405);
    try {
      if (url.pathname === '/api/agora') return await agora(env);
      if (url.pathname === '/api/status') return await status(env);
      const m = url.pathname.match(/^\/api\/estacoes\/([a-z0-9-]+)$/);
      if (m) return await serie(env, m[1], url);
    } catch (e) {
      console.log(JSON.stringify({ rota: url.pathname, erro: String(e) }));
      return json({ erro: 'falha temporária, tente de novo em instantes' }, 503, 0);
    }
    return json({ erro: 'não encontrado' }, 404);
  },

  // Roda a cada minuto, uma tarefa por minuto: o plano grátis dá 10 ms de CPU por execução, e cada ida ao
  // banco também gasta CPU (medido em 7 nov 2026: coleta do Estado com o resumo junto, 24 a 36 ms).
  //   xx:02, xx:07, ...  resumo ao vivo do Estado (estações e barragens, com as comportas)
  //   xx:03, xx:08, ...  monta o resumo do site (/api/agora) e confere se o catálogo mudou
  //   xx:04, xx:09, ...  Itajaí (série de 12 h)
  //   xx:00, xx:05, ...  tapa-buraco com o histórico do Estado (3 estações por vez)
  //   xx:16 e xx:46      AlertaBlu (Blumenau mede de hora em hora e publica uns 10 min depois)
  //   demais xx:01, ...  download do histórico do passo zero até acabar; depois, a importação dele
  async scheduled(controller, env): Promise<void> {
    const minuto = new Date(controller.scheduledTime).getUTCMinutes();
    switch (minuto % 5) {
      case 2:
        await coletar(env, 'estado');
        break;
      case 3:
        await sincronizarCatalogo(env.DB);
        await atualizarAgora(env.DB);
        break;
      case 4:
        await coletar(env, 'itajai');
        break;
      case 0:
        await tapaBuraco(env);
        break;
      default:
        if (minuto === 16 || minuto === 46) await coletar(env, 'alertablu');
        else if (!(await passoHistorico(env, new Date().toISOString()))) await importarPassoZero(env);
    }
  },
} satisfies ExportedHandler<Env>;
