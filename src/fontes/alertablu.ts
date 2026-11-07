// AlertaBlu (Defesa Civil de Blumenau): nível oficial de hora em hora, com série de 24 horas.
// O relógio do servidor de Blumenau anda atrasado; o horário vem de cada leitura (horaLeitura).
import { principaisDaFonte } from '../catalogo';
import { paraUnix } from '../tempo';
import { conferirNivel, resultadoVazio, type Resultado } from './tipos';

type Condicao = { condicao?: string; nivel?: number; tipo?: string };

export function lerAlertaBlu(texto: string): Resultado {
  const d = JSON.parse(texto);
  const niveis: Array<{ nivel?: unknown; horaLeitura?: string }> | undefined = d?.niveis;
  if (!Array.isArray(niveis)) throw new Error('resposta sem niveis');

  const r = resultadoVazio();
  const est = principaisDaFonte('alertablu').get('nivel_oficial');
  if (!est) return r;

  for (const n of niveis) {
    const t = paraUnix(n.horaLeitura, 'Z');
    if (t === null) continue;
    const c = conferirNivel(n.nivel);
    if ('nivel' in c) r.leituras.push({ estacao: est.id, t, nivel: c.nivel });
    else if (c.motivo !== 'sem valor') r.descartes.push({ estacao: est.id, t, valor: n.nivel, motivo: c.motivo });
  }

  // Cotas oficiais de Blumenau, na própria resposta: Atenção, Alerta e Alerta Máximo.
  const cond: Condicao[] = Array.isArray(d.condicoes) ? d.condicoes : [];
  const cota = (nome: string) => cond.find((c) => c.tipo === 'nvl' && c.condicao === nome)?.nivel ?? null;
  const cotas = { atencao: cota('Atenção'), alerta: cota('Alerta'), emergencia: cota('Alerta Máximo') };
  if (cotas.atencao !== null || cotas.alerta !== null || cotas.emergencia !== null) r.cotas.push({ estacao: est.id, ...cotas });
  return r;
}
