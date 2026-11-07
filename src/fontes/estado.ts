// Defesa Civil de SC: resumo ao vivo (Tags_data) e histórico (Historic).
import { principaisDaFonte } from '../catalogo';
import { paraUnix } from '../tempo';
import { conferirNivel, numeroOuNulo, resultadoVazio, type Resultado } from './tipos';

type Valor = { value?: unknown } | null | undefined;
type Comporta = { estado?: Valor; habilitada?: Valor; nome?: Valor } | null | undefined;
type EstacaoAoVivo = {
  codigo?: string;
  timestamp?: string;
  data?: {
    rio?: { rio_nivel?: Valor; homologacao?: { relacao?: { valido?: Valor } } } | null;
    barramento?: {
      nivel?: { percentual?: Valor; montante?: Valor; jusante?: Valor; vertido?: Valor };
      capacidade?: { atual?: Valor; maxima?: Valor };
      comportas?: Record<string, Comporta>;
    } | null;
  } | null;
};

const v = (x: Valor) => x?.value;

// Resumo ao vivo: uma consulta traz todas as estações de SC, com o horário em que cada uma mediu.
export function lerEstadoAoVivo(texto: string): Resultado {
  const lista: EstacaoAoVivo[] | undefined = JSON.parse(texto)?.data?.tags_data?.qualle_meteorologia;
  if (!Array.isArray(lista)) throw new Error('resposta sem data.tags_data.qualle_meteorologia');

  const estacoes = principaisDaFonte('estado');
  const r = resultadoVazio();

  for (const s of lista) {
    const est = s.codigo ? estacoes.get(s.codigo) : undefined;
    if (!est) continue;
    const t = paraUnix(s.timestamp, 'Z');
    if (t === null) {
      r.descartes.push({ estacao: est.id, t: null, valor: s.timestamp, motivo: 'horário inválido' });
      continue;
    }

    if (est.tipo === 'barragem') {
      const b = s.data?.barramento;
      if (!b) continue;
      const montante = conferirNivel(v(b.nivel?.montante));
      const jusante = numeroOuNulo(v(b.nivel?.jusante));
      const leitura = {
        barragem: est.id,
        t,
        montante: 'nivel' in montante ? montante.nivel : null,
        // A Barragem Norte manda 0 no lugar do nível a jusante, que ela não mede.
        jusante: jusante === 0 ? null : jusante,
        ocupacao: numeroOuNulo(v(b.nivel?.percentual), 2),
        volume: numeroOuNulo(v(b.capacidade?.atual), 3),
        vertido: numeroOuNulo(v(b.nivel?.vertido)),
      };
      if (leitura.montante !== null || leitura.ocupacao !== null) r.barragens.push(leitura);
      else r.descartes.push({ estacao: est.id, t, valor: v(b.nivel?.montante), motivo: 'barragem sem nível' });

      for (let i = 1; i <= 10; i++) {
        const c = b.comportas?.[`comporta_${i}`];
        if (!c || v(c.habilitada) !== 1) continue;
        const estado = v(c.estado);
        if (estado !== 0 && estado !== 1) continue;
        const nome = v(c.nome);
        r.comportas.push({ barragem: est.id, comporta: typeof nome === 'string' && nome ? nome : `C${i}`, t, aberta: estado });
      }
      continue;
    }

    const rio = s.data?.rio;
    const valido = v(rio?.homologacao?.relacao?.valido);
    const c = conferirNivel(v(rio?.rio_nivel));
    if ('motivo' in c) {
      if (c.motivo !== 'sem valor') r.descartes.push({ estacao: est.id, t, valor: v(rio?.rio_nivel), motivo: c.motivo });
    } else if (valido === false) {
      r.descartes.push({ estacao: est.id, t, valor: c.nivel, motivo: 'marcado como inválido pelo Estado' });
    } else {
      r.leituras.push({ estacao: est.id, t, nivel: c.nivel });
    }
  }
  return r;
}

type ItemHistorico = {
  ts?: string;
  timestamp?: string;
  rio_nivel?: unknown;
  barramento_nivel?: unknown;
  barramento_porc?: unknown;
};

// Histórico de uma estação (passos de 10 min). O horário vem em Brasília sem fuso; a Barragem Norte
// manda com "Z". paraUnix trata os dois casos.
export function lerHistoricoEstado(texto: string, codigo: string): Resultado {
  const d = JSON.parse(texto);
  if (d?.errors?.length) throw new Error('GraphQL: ' + JSON.stringify(d.errors).slice(0, 300));
  const itens: ItemHistorico[] | undefined = d?.data?.historic?.items;
  if (!Array.isArray(itens)) throw new Error('resposta sem data.historic.items');

  const est = principaisDaFonte('estado').get(codigo);
  const r = resultadoVazio();
  if (!est) return r;

  for (const it of itens) {
    const t = paraUnix(it.ts ?? it.timestamp);
    if (t === null) continue;
    if (est.tipo === 'barragem') {
      const montante = conferirNivel(it.barramento_nivel);
      const ocupacao = numeroOuNulo(it.barramento_porc, 2);
      if ('nivel' in montante || ocupacao !== null)
        r.barragens.push({
          barragem: est.id,
          t,
          montante: 'nivel' in montante ? montante.nivel : null,
          jusante: null,
          ocupacao,
          volume: null,
          vertido: null,
        });
      continue;
    }
    const c = conferirNivel(it.rio_nivel);
    if ('nivel' in c) r.leituras.push({ estacao: est.id, t, nivel: c.nivel });
    else if (c.motivo !== 'sem valor') r.descartes.push({ estacao: est.id, t, valor: it.rio_nivel, motivo: c.motivo });
  }
  return r;
}
