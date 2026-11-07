// Coletor da fase 1: baixa, interpreta e grava. Uma fonte por execução, por causa do limite de CPU.
import CONSULTA_TAGS from './consultas/estado-tags-data.graphql';
import CONSULTA_HISTORICO from './consultas/estado-historico.graphql';
import { gravar, gravarControle, lerControle, registrarColeta } from './banco';
import { guardarBruto } from './brutos';
import { principaisDaFonte } from './catalogo';
import { lerAlertaBlu } from './fontes/alertablu';
import { lerEstadoAoVivo, lerHistoricoEstado } from './fontes/estado';
import { lerItajai } from './fontes/itajai';
import type { Descarte, Resultado } from './fontes/tipos';
import { baixar, postGraphql, URL_ALERTABLU, URL_ESTADO, URL_ITAJAI, type Resposta } from './rede';

const decoder = new TextDecoder();

type FonteAoVivo = 'estado' | 'itajai' | 'alertablu';

const FONTES: Record<FonteAoVivo, { url: string; init?: RequestInit; ler: (texto: string) => Resultado }> = {
  estado: { url: URL_ESTADO, init: postGraphql('Tags_data', {}, CONSULTA_TAGS), ler: lerEstadoAoVivo },
  itajai: { url: URL_ITAJAI, ler: lerItajai },
  alertablu: { url: URL_ALERTABLU, ler: lerAlertaBlu },
};

function interpretar(r: Resposta, ler: (texto: string) => Resultado): { resultado: Resultado | null; erro: string | null } {
  if (r.erro || !r.corpo) return { resultado: null, erro: r.erro ?? 'resposta vazia' };
  try {
    const resultado = ler(decoder.decode(r.corpo));
    if (!resultado.leituras.length && !resultado.barragens.length) return { resultado, erro: 'nenhuma leitura reconhecida' };
    return { resultado, erro: null };
  } catch (e) {
    return { resultado: null, erro: 'parser: ' + String(e).slice(0, 300) };
  }
}

function logarDescartes(fonte: string, descartes: Descarte[]) {
  if (descartes.length) console.log(JSON.stringify({ fonte, descartes: descartes.slice(0, 20) }));
}

// Devolve true quando gravou alguma coisa nova (o resumo do site precisa ser refeito).
export async function coletar(env: Env, fonte: FonteAoVivo): Promise<boolean> {
  const inicio = Math.floor(Date.now() / 1000);
  const cfg = FONTES[fonte];
  const r = await baixar(cfg.url, cfg.init);
  const { resultado, erro } = interpretar(r, cfg.ler);

  let novas = 0;
  if (resultado && !erro) {
    const g = await gravar(env.DB, resultado, fonte, 'medicao', inicio);
    novas = g.leituras + g.barragens + g.comportas + g.cotas;
    logarDescartes(fonte, resultado.descartes);
  } else {
    // Guarda a resposta como veio, para investigar.
    await guardarBruto(env, fonte, null, new Date(inicio * 1000).toISOString(), r, erro);
    console.log(JSON.stringify({ fonte, erro }));
  }
  await registrarColeta(env.DB, {
    fonte,
    inicio,
    duracao_ms: Date.now() - inicio * 1000,
    novas,
    descartadas: resultado?.descartes.length ?? 0,
    erro,
  });
  return novas > 0;
}

// Tapa-buraco: o histórico do Estado (passos de 10 min) cobre as horas em que a coleta ao vivo falhou.
// Cada execução confere algumas estações, sempre as que estão há mais tempo sem conferência; com 3 por
// execução, a cada 5 minutos, cada estação é conferida perto de uma vez por hora.
// Na primeira vez, cada estação busca os últimos 7 dias, para o site já abrir com uma semana de gráfico.
const ESTACOES_POR_EXECUCAO = 3;
const PRIMEIRA_JANELA_S = 7 * 86_400;
const MARGEM_S = 2 * 3600;

export async function tapaBuraco(env: Env): Promise<void> {
  const agora = Math.floor(Date.now() / 1000);
  const conferido = (await lerControle<Record<string, number>>(env.DB, 'tapa_buraco')) ?? {};
  const codigos = [...principaisDaFonte('estado').keys()]
    .sort((a, b) => (conferido[a] ?? 0) - (conferido[b] ?? 0))
    .slice(0, ESTACOES_POR_EXECUCAO);

  // Baixa as estações em paralelo e grava tudo numa ida só ao banco (cada ida ao banco também gasta CPU).
  const respostas = await Promise.all(
    codigos.map(async (codigo) => {
      const de = conferido[codigo] ? Math.max(conferido[codigo] - MARGEM_S, agora - PRIMEIRA_JANELA_S) : agora - PRIMEIRA_JANELA_S;
      const r = await baixar(
        URL_ESTADO,
        postGraphql(
          'Historic',
          { stationCode: codigo, startDate: new Date(de * 1000).toISOString(), endDate: new Date(agora * 1000).toISOString(), interval: null },
          CONSULTA_HISTORICO,
        ),
      );
      return { codigo, ms: r.ms, ...interpretar(r, (texto) => lerHistoricoEstado(texto, codigo)) };
    }),
  );

  const junto: Resultado = { leituras: [], barragens: [], comportas: [], cotas: [], descartes: [] };
  const erros: string[] = [];
  for (const r of respostas) {
    if (r.resultado && !r.erro) {
      junto.leituras.push(...r.resultado.leituras);
      junto.barragens.push(...r.resultado.barragens);
      junto.descartes.push(...r.resultado.descartes);
      conferido[r.codigo] = agora;
    } else if (r.erro === 'nenhuma leitura reconhecida') {
      conferido[r.codigo] = agora; // estação sem dado no período (ex.: sensor parado); tenta de novo na próxima volta
    } else {
      erros.push(`${r.codigo}: ${r.erro}`);
    }
  }
  const g = await gravar(env.DB, junto, 'estado', 'tapa-buraco', agora);
  if (erros.length) console.log(JSON.stringify({ fonte: 'estado-historico', erros }));
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO coletas (fonte, inicio, duracao_ms, leituras_novas, descartadas, erro) VALUES (?, ?, ?, ?, ?, ?)`).bind(
      'estado-historico',
      agora,
      Math.max(...respostas.map((r) => r.ms)),
      g.leituras + g.barragens,
      junto.descartes.length,
      erros.length ? erros.join('; ').slice(0, 500) : null,
    ),
    gravarControle(env.DB, 'tapa_buraco', conferido),
  ]);
}
