// Resumo que a tela inicial usa (/api/agora). É montado pelo coletor depois de cada coleta e guardado
// pronto no banco, então cada visita lê uma linha só.
import { prepararAlertas, type Resumo } from './alertas';
import { ESTACOES, intervaloEsperado, POR_ID, type Fonte } from './catalogo';
import { isoDeUnix } from './tempo';

const RIOS = ESTACOES.filter((e) => e.tipo === 'rio');
const BARRAGENS = ESTACOES.filter((e) => e.tipo === 'barragem');

type Ponto = { medido_em: string; nivel: number };
type Cotas = { atencao: number | null; alerta: number | null; emergencia: number | null; fonte: string; desde: string };

function ponto(json: string | null): Ponto | null {
  if (!json) return null;
  const [t, n] = JSON.parse(json) as [number, number];
  return { medido_em: isoDeUnix(t), nivel: n };
}

// Nomes das fontes para mostrar no site.
export const NOMES_FONTES: Record<Fonte, string> = {
  estado: 'Defesa Civil de SC',
  itajai: 'Defesa Civil de Itajaí',
  alertablu: 'AlertaBlu (Defesa Civil de Blumenau)',
  asthon: 'Asthon',
};

export async function montarAgora(db: D1Database): Promise<Record<string, unknown>> {
  return (await montarComEstado(db)).resumo;
}

// O resumo e, na mesma ida ao banco, o estado dos avisos (fase 4).
async function montarComEstado(db: D1Database): Promise<{ resumo: Record<string, unknown>; estadoAlertas: string | null }> {
  const ids = JSON.stringify(RIOS.map((e) => e.id));
  const bids = JSON.stringify(BARRAGENS.map((e) => e.id));
  const [ultimas, barragens, comportas, cotas, fontes, avisos, estadoAlertas] = await db.batch([
    // Última leitura de cada estação e as leituras de 1 e 3 horas antes dela (para a tendência).
    db
      .prepare(
        `WITH u AS (
           SELECT e.value AS id, (SELECT MAX(medido_em) FROM leituras WHERE estacao_id = e.value) AS t FROM json_each(?1) e
         )
         SELECT u.id, u.t, l.nivel_m AS nivel, l.fonte,
           (SELECT json_array(medido_em, nivel_m) FROM leituras
             WHERE estacao_id = u.id AND medido_em <= u.t - 3600 ORDER BY medido_em DESC LIMIT 1) AS h1,
           (SELECT json_array(medido_em, nivel_m) FROM leituras
             WHERE estacao_id = u.id AND medido_em <= u.t - 10800 ORDER BY medido_em DESC LIMIT 1) AS h3
         FROM u JOIN leituras l ON l.estacao_id = u.id AND l.medido_em = u.t`,
      )
      .bind(ids),
    db
      .prepare(
        `SELECT b.*,
           (SELECT json_array(medido_em, ocupacao_pct) FROM leituras_barragem
             WHERE barragem_id = b.barragem_id AND ocupacao_pct IS NOT NULL AND medido_em <= b.medido_em - 3600
             ORDER BY medido_em DESC LIMIT 1) AS h1
         FROM json_each(?1) e
         JOIN leituras_barragem b ON b.barragem_id = e.value
           AND b.medido_em = (SELECT MAX(medido_em) FROM leituras_barragem WHERE barragem_id = e.value)`,
      )
      .bind(bids),
    // Estado atual de cada comporta e desde quando. "registro_desde" é a primeira vez que o projeto viu a comporta:
    // se "desde" for igual, a comporta já estava assim antes de o registro começar.
    db.prepare(
      `SELECT c.barragem_id, c.comporta, c.aberta, c.desde,
         (SELECT MIN(desde) FROM comportas WHERE barragem_id = c.barragem_id AND comporta = c.comporta) AS registro_desde
       FROM comportas c
       WHERE c.desde = (SELECT MAX(desde) FROM comportas WHERE barragem_id = c.barragem_id AND comporta = c.comporta)`,
    ),
    db.prepare(
      `SELECT c.* FROM cotas c
       WHERE c.valida_desde = (SELECT MAX(valida_desde) FROM cotas WHERE estacao_id = c.estacao_id AND fonte = c.fonte)`,
    ),
    db.prepare(`SELECT id, nome, ultimo_sucesso, ultimo_erro, ultimo_erro_em FROM fontes WHERE ativa = 1`),
    // Avisos públicos das últimas 24 h (fase 4), para o site.
    db.prepare(`SELECT criado_em, tipo, estacao_id, faixa, texto FROM avisos WHERE criado_em >= ? AND publico = 1 ORDER BY id DESC LIMIT 30`).bind(
      Math.floor(Date.now() / 1000) - 86_400,
    ),
    db.prepare(`SELECT valor FROM controle WHERE chave = 'alertas'`),
  ]);

  // Cotas: vale a da fonte principal da estação; sem ela, a de outra fonte (com a origem indicada).
  const cotasPorEstacao = new Map<string, Cotas>();
  for (const c of cotas.results as Array<Record<string, number | string | null>>) {
    const id = c.estacao_id as string;
    const principal = POR_ID.get(id)?.fonte_principal === c.fonte;
    if (cotasPorEstacao.has(id) && !principal) continue;
    cotasPorEstacao.set(id, {
      atencao: c.atencao_m as number | null,
      alerta: c.alerta_m as number | null,
      emergencia: c.emergencia_m as number | null,
      fonte: NOMES_FONTES[c.fonte as Fonte] ?? String(c.fonte),
      desde: isoDeUnix(c.valida_desde as number),
    });
  }

  const porId = new Map((ultimas.results as Array<{ id: string; t: number; nivel: number; fonte: string; h1: string | null; h3: string | null }>).map((u) => [u.id, u]));
  const estacoes = RIOS.map((e) => {
    const u = porId.get(e.id);
    return {
      id: e.id,
      nome: e.nome,
      rio: e.rio ?? null,
      municipio: e.municipio,
      latitude: e.latitude ?? null,
      longitude: e.longitude ?? null,
      ordem: e.ordem ?? null,
      principal: e.principal,
      referencia: e.referencia,
      a_conferir: e.conferir,
      situacao: e.situacao,
      intervalo_s: intervaloEsperado(e),
      fonte: NOMES_FONTES[e.fonte_principal],
      nivel: u?.nivel ?? null,
      medido_em: u ? isoDeUnix(u.t) : null,
      h1: ponto(u?.h1 ?? null),
      h3: ponto(u?.h3 ?? null),
      cotas: cotasPorEstacao.get(e.id) ?? null,
      observacao: e.observacao ?? null,
    };
  });

  const comportasPor = new Map<string, Array<{ nome: string; aberta: boolean; desde: string; desde_inicio_registro: boolean }>>();
  for (const c of comportas.results as Array<{ barragem_id: string; comporta: string; aberta: number; desde: number; registro_desde: number }>) {
    const lista = comportasPor.get(c.barragem_id) ?? [];
    lista.push({ nome: c.comporta, aberta: c.aberta === 1, desde: isoDeUnix(c.desde), desde_inicio_registro: c.desde === c.registro_desde });
    comportasPor.set(c.barragem_id, lista);
  }

  const bPor = new Map((barragens.results as Array<Record<string, number | string | null>>).map((b) => [b.barragem_id as string, b]));
  const listaBarragens = BARRAGENS.map((e) => {
    const b = bPor.get(e.id);
    return {
      id: e.id,
      nome: e.nome,
      rio: e.rio ?? null,
      municipio: e.municipio,
      latitude: e.latitude ?? null,
      longitude: e.longitude ?? null,
      intervalo_s: intervaloEsperado(e),
      observacao: e.observacao ?? null,
      medido_em: b ? isoDeUnix(b.medido_em as number) : null,
      montante_m: (b?.montante_m as number | null) ?? null,
      jusante_m: (b?.jusante_m as number | null) ?? null,
      ocupacao_pct: (b?.ocupacao_pct as number | null) ?? null,
      volume_hm3: (b?.volume_hm3 as number | null) ?? null,
      vertido_m: (b?.vertido_m as number | null) ?? null,
      h1: ponto((b?.h1 as string | null) ?? null),
      comportas: (comportasPor.get(e.id) ?? []).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
    };
  });

  const resumo = {
    gerado_em: new Date().toISOString(),
    estacoes,
    barragens: listaBarragens,
    fontes: (fontes.results as Array<Record<string, string | number | null>>).map((f) => ({
      id: f.id,
      nome: f.nome,
      ultimo_sucesso: typeof f.ultimo_sucesso === 'number' ? isoDeUnix(f.ultimo_sucesso) : null,
      ultimo_erro: f.ultimo_erro,
      ultimo_erro_em: typeof f.ultimo_erro_em === 'number' ? isoDeUnix(f.ultimo_erro_em) : null,
    })),
    avisos: (avisos.results as Array<{ criado_em: number; tipo: string; estacao_id: string | null; faixa: string | null; texto: string }>).map((a) => ({
      ...a,
      criado_em: isoDeUnix(a.criado_em),
      texto: a.texto.split('\n')[0], // sem o link, que no site não faz falta
    })),
  };
  return { resumo, estadoAlertas: (estadoAlertas.results[0] as { valor: string } | undefined)?.valor ?? null };
}

// Monta o resumo e grava. Com o env, avalia também os avisos (fase 4) e já põe os novos no resumo.
export async function atualizarAgora(db: D1Database, env?: Env): Promise<string> {
  const { resumo, estadoAlertas } = await montarComEstado(db);
  let cmds: D1PreparedStatement[] = [];
  if (env) {
    try {
      const r = await prepararAlertas(env, resumo as unknown as Resumo, estadoAlertas);
      cmds = r.cmds;
      const lista = resumo.avisos as Array<Record<string, unknown>>;
      const agora = new Date().toISOString();
      for (const a of r.avisos.filter((x) => x.publico).reverse())
        lista.unshift({ criado_em: agora, tipo: a.tipo, estacao_id: a.estacao_id, faixa: a.faixa, texto: a.texto.split('\n')[0] });
    } catch (e) {
      console.log(JSON.stringify({ alertas: String(e) }));
    }
  }
  const json = JSON.stringify(resumo);
  // Avisos, estado dos avisos e resumo numa ida só ao banco.
  await db.batch([
    ...cmds,
    db.prepare(`INSERT OR REPLACE INTO instantaneo (chave, gerado_em, json) VALUES ('agora', ?, ?)`).bind(Math.floor(Date.now() / 1000), json),
  ]);
  return json;
}
