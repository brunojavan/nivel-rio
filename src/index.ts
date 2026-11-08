import { atualizarAgora } from './agora';
import { POR_ID, sincronizarCatalogo } from './catalogo';
import { atualizarGraficos } from './graficos';
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

// Resumo da tela inicial com os gráficos de 24 h e a chuva juntos, num JSON só. Os três ficam prontos no
// banco (instantaneo 'agora', 'graficos' e 'chuva'); aqui só se emendam os textos, sem interpretar.
async function textoAgora(env: Env): Promise<string> {
  return lembrar('agora', 20, async () => {
    const { results } = await env.DB.prepare(`SELECT chave, json FROM instantaneo WHERE chave IN ('agora', 'graficos', 'chuva')`).all<{
      chave: string;
      json: string;
    }>();
    const agoraJson = results.find((r) => r.chave === 'agora')?.json ?? (await atualizarAgora(env.DB));
    const graficos = results.find((r) => r.chave === 'graficos')?.json ?? 'null';
    const chuva = results.find((r) => r.chave === 'chuva')?.json ?? 'null';
    return `${agoraJson.slice(0, -1)},"graficos":${graficos},"chuva":${chuva}}`;
  });
}

async function agora(env: Env): Promise<Response> {
  return json(await textoAgora(env), 200, 30);
}

// Páginas com os dados já embutidos (uma ida a menos ao servidor no celular). A página de cada estação
// ganha também o título e a descrição com o nível atual, que aparecem quando o link é compartilhado.
type EstacaoResumo = { id: string; nome: string; municipio: string; rio: string | null; nivel?: number | null; ocupacao_pct?: number | null; medido_em: string | null };

const escaparHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const numeroBr = (v: number, casas: number) => v.toFixed(casas).replace('.', ',');
const horaBr = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

async function pagina(env: Env, request: Request, caminho: string, id?: string): Promise<Response> {
  // Sem repassar os cabeçalhos do navegador: a página tem dados embutidos e não pode voltar como "não mudou" (304).
  const asset = await env.ASSETS.fetch(new Request(new URL(caminho, request.url)));
  if (!asset.ok) return asset;
  let dados = '';
  try {
    dados = await textoAgora(env);
  } catch (e) {
    console.log(JSON.stringify({ rota: caminho, erro: String(e) }));
  }

  let titulo: string | null = null;
  let descricao: string | null = null;
  if (id && dados) {
    const d = JSON.parse(dados) as { estacoes: EstacaoResumo[]; barragens: EstacaoResumo[] };
    const e = d.estacoes.find((x) => x.id === id) ?? d.barragens.find((x) => x.id === id);
    if (e) {
      const valor =
        e.nivel != null ? `${numeroBr(e.nivel, 2)} m` : e.ocupacao_pct != null ? `${numeroBr(e.ocupacao_pct, 1)}% de ocupação` : 'sem leitura';
      titulo = `${e.nome}: ${valor} · Nível Rio`;
      descricao = `${e.nome} (${e.municipio}${e.rio ? `, ${e.rio}` : ''}): ${valor}${e.medido_em ? ` em ${horaBr(e.medido_em)}` : ''}. Nível, tendência e gráficos das últimas horas e dias.`;
    }
  }

  const rw = new HTMLRewriter();
  if (titulo) {
    rw.on('title', { element: (el) => void el.setInnerContent(titulo) });
    rw.on('meta[property="og:title"]', { element: (el) => void el.setAttribute('content', titulo) });
  }
  if (descricao) {
    rw.on('meta[name="description"]', { element: (el) => void el.setAttribute('content', descricao) });
    rw.on('meta[property="og:description"]', { element: (el) => void el.setAttribute('content', descricao) });
  }
  if (dados)
    rw.on('head', {
      element: (el) =>
        void el.append(`<script id="dados-iniciais" type="application/json">${dados.replace(/</g, '\\u003c')}</script>`, { html: true }),
    });
  const r = rw.transform(asset);
  const h = new Headers(r.headers);
  h.set('cache-control', 'public, max-age=30');
  h.delete('etag');
  return new Response(r.body, { status: 200, headers: h });
}

function naoEncontrada(): Response {
  return new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Estação não encontrada · Nível Rio</title><body style="font:16px system-ui;margin:40px 16px"><p>Estação não encontrada.</p><p><a href="/">Voltar para o Nível Rio</a></p>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
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
      // Leituras e o histórico das comportas no período (com o estado de cada uma no começo dele).
      const [leituras, antes, mudancas] = await env.DB.batch([
        env.DB.prepare(
          `SELECT medido_em AS t, montante_m AS m, ocupacao_pct AS o FROM leituras_barragem
           WHERE barragem_id = ? AND medido_em >= ? ORDER BY medido_em`,
        ).bind(id, de),
        env.DB.prepare(
          `SELECT comporta, aberta, MAX(desde) AS desde FROM comportas WHERE barragem_id = ? AND desde < ? GROUP BY comporta`,
        ).bind(id, de),
        env.DB.prepare(`SELECT comporta, aberta, desde FROM comportas WHERE barragem_id = ? AND desde >= ? ORDER BY desde`).bind(id, de),
      ]);
      const r = leituras.results as Array<{ t: number; m: number | null; o: number | null }>;
      const comportas = new Map<string, Array<[number, number]>>();
      for (const c of [...(antes.results as Array<{ comporta: string; aberta: number; desde: number }>), ...(mudancas.results as Array<{ comporta: string; aberta: number; desde: number }>)]) {
        const lista = comportas.get(c.comporta) ?? [];
        lista.push([c.desde, c.aberta]);
        comportas.set(c.comporta, lista);
      }
      return JSON.stringify({
        id,
        horas,
        t: r.map((x) => x.t),
        montante_m: r.map((x) => x.m),
        ocupacao_pct: r.map((x) => x.o),
        // Para cada comporta: [horário, 1 aberta / 0 fechada] a cada mudança. O primeiro pode ser anterior ao período.
        comportas: [...comportas]
          .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
          .map(([nome, mudancas]) => ({ nome, mudancas })),
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
    const [coletas, contagem, importacao, fontes, ultimosErros, picos, picosTotal, avisos] = await env.DB.batch([
      env.DB.prepare(
        `SELECT fonte, COUNT(*) AS execucoes, SUM(erro IS NOT NULL) AS erros, SUM(leituras_novas) AS novas, MAX(inicio) AS ultima
         FROM coletas WHERE inicio >= ? GROUP BY fonte`,
      ).bind(Math.floor(Date.now() / 1000) - 86_400),
      env.DB.prepare(`SELECT (SELECT COUNT(*) FROM coletas) AS coletas`),
      env.DB.prepare(`SELECT valor FROM controle WHERE chave = 'importacao'`),
      env.DB.prepare(`SELECT id, nome, ativa, ultimo_sucesso, ultimo_erro, ultimo_erro_em FROM fontes`),
      env.DB.prepare(`SELECT fonte, inicio, erro FROM coletas WHERE inicio >= ? AND erro IS NOT NULL ORDER BY inicio DESC LIMIT 10`).bind(
        Math.floor(Date.now() / 1000) - 86_400,
      ),
      env.DB.prepare(
        `SELECT d.estacao_id, e.nome, d.medido_em, d.nivel_m, d.descartado_em
         FROM descartes d JOIN estacoes e ON e.id = d.estacao_id AND e.ativa = 1
         ORDER BY d.descartado_em DESC, d.medido_em DESC LIMIT 10`,
      ),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM descartes d JOIN estacoes e ON e.id = d.estacao_id AND e.ativa = 1`),
      env.DB.prepare(`SELECT criado_em, tipo, texto, telegram FROM avisos ORDER BY id DESC LIMIT 10`),
    ]);
    const segredos = env as unknown as Record<string, string | undefined>;
    const quando = (t: unknown) => (typeof t === 'number' ? isoDeUnix(t) : null);
    const imp = (importacao.results[0] as { valor?: string } | undefined)?.valor;
    return JSON.stringify({
      agora: new Date().toISOString(),
      versao: env.VERSAO,
      coletor: {
        ultimas_24h: (coletas.results as Array<Record<string, number | string>>).map((c) => ({ ...c, ultima: isoDeUnix(c.ultima as number) })),
        fontes: (fontes.results as Array<Record<string, unknown>>).map((f) => ({
          ...f,
          ultimo_sucesso: quando(f.ultimo_sucesso),
          ultimo_erro_em: quando(f.ultimo_erro_em),
        })),
        ultimos_erros: (ultimosErros.results as Array<Record<string, unknown>>).map((e) => ({ ...e, inicio: quando(e.inicio) })),
        importacao_passo_zero: imp ? JSON.parse(imp) : null,
        avisos: {
          telegram: { bot: !!segredos.TELEGRAM_TOKEN, canal: !!segredos.TELEGRAM_CANAL, admin: !!segredos.TELEGRAM_ADMIN },
          ultimos: (avisos.results as Array<Record<string, unknown>>).map((a) => ({ ...a, criado_em: quando(a.criado_em), texto: String(a.texto).split('\n')[0] })),
        },
        picos_descartados: {
          total: (picosTotal.results[0] as { n: number }).n,
          ultimos: (picos.results as Array<Record<string, unknown>>).map((p) => ({
            ...p,
            medido_em: quando(p.medido_em),
            descartado_em: quando(p.descartado_em),
          })),
        },
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
      if (url.pathname === '/') return await pagina(env, request, '/');
      const pag = url.pathname.match(/^\/estacao\/([a-z0-9-]+)\/?$/);
      if (pag) return POR_ID.has(pag[1]) ? await pagina(env, request, '/estacao', pag[1]) : naoEncontrada();
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
  //   xx:03, xx:08, ...  monta o resumo do site (/api/agora) e confere se o catálogo mudou;
  //                      em xx:13 e xx:43, no lugar dele, os gráficos de 24 h da tela inicial
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
        if (minuto === 13 || minuto === 43) await atualizarGraficos(env.DB);
        else {
          await sincronizarCatalogo(env.DB);
          await atualizarAgora(env.DB, env);
        }
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
