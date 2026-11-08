// Avisos (fase 4): mudança de faixa, subida rápida, comporta que abre ou fecha, fonte fora do ar.
//
// Roda junto com o resumo do site (de 5 em 5 minutos), sobre o próprio resumo: não lê leituras a mais.
// Cada aviso fica guardado na tabela avisos, aparece no site e, quando o bot do Telegram estiver
// configurado (segredos TELEGRAM_TOKEN e TELEGRAM_CANAL, e TELEGRAM_ADMIN para falhas), vai para o Telegram.
//
// Para não disparar à toa:
// - toda mudança precisa aparecer em duas avaliações seguidas (5 minutos), o que deixa de fora o pico de
//   sensor que ainda não foi apagado (src/picos.ts apaga quando chega a leitura seguinte);
// - para descer de faixa, o nível precisa ficar 10 cm abaixo da cota (senão um rio parado em cima da cota
//   mandaria um aviso a cada oscilação);
// - subida rápida avisa no máximo uma vez a cada 3 horas por estação;
// - na primeira execução só se anota a situação, sem avisar.

export type Faixa = 'normal' | 'atencao' | 'alerta' | 'emergencia';
const ORDEM: Record<Faixa, number> = { normal: 0, atencao: 1, alerta: 2, emergencia: 3 };
const NOME: Record<Faixa, string> = { normal: 'normal', atencao: 'atenção', alerta: 'alerta', emergencia: 'emergência' };
const BOLA: Record<Faixa, string> = { normal: '🟢', atencao: '🟡', alerta: '🟠', emergencia: '🔴' };

export const MARGEM_DESCIDA_M = 0.1;
export const CONFIRMAR_S = 240;
export const SUBIDA_CMH = 30;
// Perto da foz a maré sozinha faz o rio subir até perto de 47 cm/h (Itajaí, 7 nov 2026).
export const SUBIDA_CMH_FOZ = 50;
export const REPETIR_SUBIDA_S = 3 * 3600;
export const FONTE_FORA_S = 3600;
const SITE = 'https://nivel-rio.nivel-rio.workers.dev';

type Cotas = { atencao: number | null; alerta: number | null; emergencia: number | null } | null;
type Ponto = { medido_em: string; nivel: number } | null;
export type EstacaoResumo = {
  id: string; nome: string; municipio: string; referencia: string; situacao: string; intervalo_s: number;
  nivel: number | null; medido_em: string | null; h1: Ponto; cotas: Cotas;
};
export type BarragemResumo = { id: string; nome: string; municipio: string; comportas: Array<{ nome: string; aberta: boolean; desde: string }> };
export type FonteResumo = { id: string; nome: string; ultimo_sucesso: string | null };
export type Resumo = { estacoes: EstacaoResumo[]; barragens: BarragemResumo[]; fontes: FonteResumo[] };

export type EstadoAlertas = {
  estacoes: Record<string, { faixa?: Faixa; pendente?: { faixa: Faixa; visto: number }; subida_vista?: number; subida_avisada?: number }>;
  comportas: Record<string, { aberta: boolean; pendente?: number }>;
  fontes: Record<string, { fora: boolean }>;
};

export type Aviso = { tipo: 'faixa' | 'subida' | 'comporta' | 'fonte'; estacao_id: string | null; faixa: Faixa | null; texto: string; publico: boolean };

export const estadoVazio = (): EstadoAlertas => ({ estacoes: {}, comportas: {}, fontes: {} });

const segundos = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const num = (v: number, casas = 2) => v.toFixed(casas).replace('.', ',');
const horaBr = (t: number) => new Date(t * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

export function faixaDe(nivel: number, c: NonNullable<Cotas>): Faixa {
  if (c.emergencia != null && nivel >= c.emergencia) return 'emergencia';
  if (c.alerta != null && nivel >= c.alerta) return 'alerta';
  if (c.atencao != null && nivel >= c.atencao) return 'atencao';
  return 'normal';
}
const cotaDe = (f: Faixa, c: NonNullable<Cotas>) => (f === 'normal' ? null : c[f]);

// Subida em cm/h comparada com a leitura de cerca de 1 hora antes (a mesma conta do site).
export function cmPorHora(e: EstacaoResumo): number | null {
  if (e.nivel == null || !e.h1 || !e.medido_em) return null;
  const horas = (Date.parse(e.medido_em) - Date.parse(e.h1.medido_em)) / 3_600_000;
  if (horas < 0.66 || horas > 1.75) return null;
  return ((e.nivel - e.h1.nivel) * 100) / horas;
}

function atrasada(e: { medido_em: string | null; intervalo_s: number }, agora: number) {
  return !e.medido_em || agora - segundos(e.medido_em) > 2 * e.intervalo_s + 120;
}

const foz = (e: EstacaoResumo) => e.municipio === 'Itajaí';

export function avaliar(anterior: EstadoAlertas | null, r: Resumo, agora: number): { estado: EstadoAlertas; avisos: Aviso[] } {
  const primeira = !anterior;
  const estado: EstadoAlertas = anterior ? structuredClone(anterior) : estadoVazio();
  const avisos: Aviso[] = [];

  for (const e of r.estacoes) {
    if (e.situacao !== 'ativa' || e.nivel == null || atrasada(e, agora)) continue;
    const s = (estado.estacoes[e.id] ??= {});
    const link = `${SITE}/estacao/${e.id}`;
    const quando = horaBr(segundos(e.medido_em!));

    // Faixa.
    if (e.cotas && e.referencia !== 'altitude') {
      const atual = faixaDe(e.nivel, e.cotas);
      if (!s.faixa || primeira) {
        s.faixa = atual;
      } else {
        let alvo = atual;
        const cotaAnterior = cotaDe(s.faixa, e.cotas);
        if (ORDEM[atual] < ORDEM[s.faixa] && cotaAnterior != null && e.nivel >= cotaAnterior - MARGEM_DESCIDA_M) alvo = s.faixa;
        if (alvo === s.faixa) delete s.pendente;
        else if (s.pendente?.faixa === alvo && agora - s.pendente.visto >= CONFIRMAR_S) {
          const sobe = ORDEM[alvo] > ORDEM[s.faixa];
          const cota = cotaDe(alvo, e.cotas);
          const v = cmPorHora(e);
          const ritmo = v != null && Math.abs(v) >= 2 ? ` ${v > 0 ? 'Subindo' : 'Descendo'} ${num(Math.abs(v), 0)} cm/h.` : '';
          const texto = sobe
            ? `${BOLA[alvo]} ${e.nome} entrou em ${NOME[alvo].toUpperCase()}: ${num(e.nivel)} m às ${quando} (cota de ${NOME[alvo]}: ${num(cota!)} m).${ritmo}`
            : alvo === 'normal'
              ? `${BOLA.normal} ${e.nome} saiu da faixa de ${NOME[s.faixa]}: ${num(e.nivel)} m às ${quando}.${ritmo}`
              : `${BOLA[alvo]} ${e.nome} voltou para ${NOME[alvo].toUpperCase()}: ${num(e.nivel)} m às ${quando}.${ritmo}`;
          avisos.push({ tipo: 'faixa', estacao_id: e.id, faixa: alvo, texto: `${texto}\n${link}`, publico: true });
          s.faixa = alvo;
          delete s.pendente;
        } else if (s.pendente?.faixa !== alvo) s.pendente = { faixa: alvo, visto: agora };
      }
    }

    // Subida rápida.
    const v = cmPorHora(e);
    const limite = foz(e) ? SUBIDA_CMH_FOZ : SUBIDA_CMH;
    if (v != null && v >= limite) {
      if (s.subida_vista == null) s.subida_vista = agora;
      else if (agora - s.subida_vista >= CONFIRMAR_S && (s.subida_avisada == null || agora - s.subida_avisada >= REPETIR_SUBIDA_S)) {
        if (!primeira)
          avisos.push({
            tipo: 'subida', estacao_id: e.id, faixa: null, publico: true,
            texto: `⬆️ ${e.nome} sobe rápido: +${num(v, 0)} cm na última hora, ${num(e.nivel)} m às ${quando}.\n${link}`,
          });
        s.subida_avisada = agora;
      }
    } else delete s.subida_vista;
  }

  // Comportas (o resumo já traz só o estado atual de cada uma).
  for (const b of r.barragens) {
    for (const c of b.comportas) {
      const chave = `${b.id}/${c.nome}`;
      const s = estado.comportas[chave];
      if (!s || primeira) { estado.comportas[chave] = { aberta: c.aberta }; continue; }
      if (s.aberta === c.aberta) { delete s.pendente; continue; }
      if (s.pendente == null) { s.pendente = agora; continue; }
      if (agora - s.pendente < CONFIRMAR_S) continue;
      avisos.push({
        tipo: 'comporta', estacao_id: b.id, faixa: null, publico: true,
        texto: `🚧 ${b.nome} (${b.municipio}): comporta ${c.nome} ${c.aberta ? 'ABRIU' : 'FECHOU'} (registrado às ${horaBr(segundos(c.desde))}).\n${SITE}/estacao/${b.id}`,
      });
      estado.comportas[chave] = { aberta: c.aberta };
    }
  }

  // Fontes.
  for (const f of r.fontes) {
    const fora = !f.ultimo_sucesso || agora - segundos(f.ultimo_sucesso) > FONTE_FORA_S;
    const s = estado.fontes[f.id];
    if (!s || primeira) { estado.fontes[f.id] = { fora }; continue; }
    if (s.fora === fora) continue;
    avisos.push({
      tipo: 'fonte', estacao_id: null, faixa: null, publico: true,
      texto: fora
        ? `⚠️ ${f.nome} sem responder desde ${f.ultimo_sucesso ? horaBr(segundos(f.ultimo_sucesso)) : 'o início'}. As estações dessa fonte podem aparecer atrasadas no site.`
        : `✅ ${f.nome} voltou a responder.`,
    });
    s.fora = fora;
  }

  return { estado, avisos };
}

// Envia para o Telegram. Sem os segredos, não faz nada (os avisos ficam só no site).
export async function enviarTelegram(env: Env, texto: string, chat: string): Promise<string> {
  const token = (env as unknown as Record<string, string | undefined>).TELEGRAM_TOKEN;
  if (!token || !chat) return 'sem bot';
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok ? 'ok' : `HTTP ${r.status}`;
  } catch (e) {
    return String(e).slice(0, 100);
  }
}

// Avalia, grava os avisos e o estado, e manda para o Telegram quando houver bot.
export async function processarAlertas(env: Env, resumo: Resumo): Promise<Aviso[]> {
  const agora = Math.floor(Date.now() / 1000);
  const linha = await env.DB.prepare(`SELECT valor FROM controle WHERE chave = 'alertas'`).first<{ valor: string }>();
  const { estado, avisos } = avaliar(linha ? (JSON.parse(linha.valor) as EstadoAlertas) : null, resumo, agora);

  const segredos = env as unknown as Record<string, string | undefined>;
  const resultados: string[] = [];
  for (const a of avisos) {
    let r = a.publico ? await enviarTelegram(env, a.texto, segredos.TELEGRAM_CANAL ?? '') : 'sem bot';
    // Fonte fora do ar também vai para o responsável.
    if (a.tipo === 'fonte' && segredos.TELEGRAM_ADMIN) r = `${r}; admin ${await enviarTelegram(env, a.texto, segredos.TELEGRAM_ADMIN)}`;
    resultados.push(r);
  }

  const cmds = [env.DB.prepare(`INSERT OR REPLACE INTO controle (chave, valor) VALUES ('alertas', ?)`).bind(JSON.stringify(estado))];
  if (avisos.length)
    cmds.push(
      env.DB.prepare(
        `INSERT INTO avisos (criado_em, tipo, estacao_id, faixa, texto, publico, telegram)
         SELECT ?1, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]'),
                json_extract(value, '$[4]'), json_extract(value, '$[5]')
         FROM json_each(?2)`,
      ).bind(agora, JSON.stringify(avisos.map((a, i) => [a.tipo, a.estacao_id, a.faixa, a.texto, a.publico ? 1 : 0, resultados[i]]))),
    );
  await env.DB.batch(cmds);
  if (avisos.length) console.log(JSON.stringify({ avisos: avisos.map((a) => a.texto.split('\n')[0]) }));
  return avisos;
}
