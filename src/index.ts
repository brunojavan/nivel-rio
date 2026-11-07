import { coletarAlertaBlu, coletarEstado, coletarItajai, passoHistorico } from './passo-zero';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30' };

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), { status, headers: JSON_HEADERS });
}

async function status(env: Env): Promise<Response> {
  const [resumo, fila, criada] = await env.BRUTOS.batch([
    env.BRUTOS.prepare(`SELECT * FROM resumo ORDER BY fonte`),
    env.BRUTOS.prepare(`SELECT situacao, COUNT(*) AS janelas, SUM(itens) AS itens FROM fila_historico GROUP BY situacao`),
    env.BRUTOS.prepare(`SELECT valor FROM controle WHERE chave = 'fila_criada'`),
  ]);
  const principal = await env.DB.prepare(`SELECT COUNT(*) AS fontes FROM fontes`).run();
  const valorFila = (criada.results[0] as { valor?: string } | undefined)?.valor;

  return json({
    agora: new Date().toISOString(),
    versao: env.VERSAO,
    passo_zero: {
      fontes: resumo.results,
      historico: {
        fila: valorFila ? JSON.parse(valorFila) : null,
        situacoes: fila.results,
      },
      banco_bytes: resumo.meta.size_after,
    },
    banco_principal: {
      bytes: principal.meta.size_after,
      fontes: (principal.results[0] as { fontes: number }).fontes,
    },
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'GET') return json({ erro: 'método não permitido' }, 405);
    if (url.pathname === '/api/status') return status(env);
    return json({ erro: 'não encontrado' }, 404);
  },

  // Roda a cada minuto. Cada fonte fica numa execução separada, por causa do limite de 10 ms de CPU.
  //   xx:02, xx:07, xx:12 ...  resumo ao vivo do Estado (estações e barragens)
  //   xx:04 e xx:34            Itajaí (série de 12 h)
  //   xx:14 e xx:44            AlertaBlu (nível oficial de Blumenau, série de 24 h)
  //   demais minutos           download do histórico do Estado, até a fila acabar
  async scheduled(controller, env): Promise<void> {
    const minuto = new Date(controller.scheduledTime).getUTCMinutes();
    const agora = new Date().toISOString();
    if (minuto % 5 === 2) await coletarEstado(env, agora);
    else if (minuto === 4 || minuto === 34) await coletarItajai(env, agora);
    else if (minuto === 14 || minuto === 44) await coletarAlertaBlu(env, agora);
    else await passoHistorico(env, agora);
  },
} satisfies ExportedHandler<Env>;
