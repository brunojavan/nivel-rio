// Defesa Civil de Itajaí: app.json com as 11 estações da cidade e uma série de 12 horas.
import { principaisDaFonte } from '../catalogo';
import { paraUnix } from '../tempo';
import { conferirNivel, numeroOuNulo, resultadoVazio, type Resultado } from './tipos';

type Ponto = { medido_em?: string; nivel_rio_m?: unknown };
type Rio = Ponto & { codigo?: string; serie_12_h?: Ponto[]; atencao_m?: unknown; alerta_m?: unknown; emergencia_m?: unknown };

// O arquivo de Itajaí também copia Rio do Sul, Brusque e Blumenau. As leituras dessas cópias ficam de fora
// (a maior parte dos pontos é média dos vizinhos), mas as cotas que Itajaí usa para elas são guardadas.
const COPIAS: Record<string, string> = { 'DCSC-00013': 'rio-do-sul', 'DCSC-00019': 'brusque', PADKND: 'blumenau' };

export function lerItajai(texto: string): Resultado {
  const rios: Rio[] | undefined = JSON.parse(texto)?.dados?.rios;
  if (!Array.isArray(rios)) throw new Error('resposta sem dados.rios');

  const estacoes = principaisDaFonte('itajai');
  const r = resultadoVazio();

  for (const rio of rios) {
    const codigo = rio.codigo ?? '';
    const est = estacoes.get(codigo);
    const id = est?.id ?? COPIAS[codigo];
    if (!id) continue;

    const cotas = { atencao: numeroOuNulo(rio.atencao_m), alerta: numeroOuNulo(rio.alerta_m), emergencia: numeroOuNulo(rio.emergencia_m) };
    if (cotas.atencao !== null || cotas.alerta !== null || cotas.emergencia !== null) r.cotas.push({ estacao: id, ...cotas });

    if (!est) continue;
    const vistos = new Set<number>();
    for (const p of [...(rio.serie_12_h ?? []), rio]) {
      const t = paraUnix(p.medido_em, 'Z');
      if (t === null || vistos.has(t)) continue;
      vistos.add(t);
      // Perto da foz o rio sofre maré; um nível pouco abaixo de zero é possível.
      const c = conferirNivel(p.nivel_rio_m, true);
      if ('nivel' in c) r.leituras.push({ estacao: est.id, t, nivel: c.nivel });
      else if (c.motivo !== 'sem valor') r.descartes.push({ estacao: est.id, t, valor: p.nivel_rio_m, motivo: c.motivo });
    }
  }
  return r;
}
