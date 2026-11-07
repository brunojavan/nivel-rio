// O que cada parser devolve. Horários em segundos UTC; níveis em metros.

export type Leitura = { estacao: string; t: number; nivel: number };

export type LeituraBarragem = {
  barragem: string;
  t: number;
  montante: number | null; // nível do reservatório (altitude)
  jusante: number | null; // nível do rio logo abaixo
  ocupacao: number | null; // %
  volume: number | null; // hm³
  vertido: number | null;
};

export type EstadoComporta = { barragem: string; comporta: string; t: number; aberta: 0 | 1 };

export type Cotas = { estacao: string; atencao: number | null; alerta: number | null; emergencia: number | null };

export type Descarte = { estacao: string; t: number | null; valor: unknown; motivo: string };

export type Resultado = {
  leituras: Leitura[];
  barragens: LeituraBarragem[];
  comportas: EstadoComporta[];
  cotas: Cotas[];
  descartes: Descarte[];
};

export function resultadoVazio(): Resultado {
  return { leituras: [], barragens: [], comportas: [], cotas: [], descartes: [] };
}

// Valor que o sensor com defeito manda no lugar do nível (visto em Gaspar e Lontras, 7 nov 2026).
const SENTINELA = 21474836;

// Confere um nível. Devolve o valor arredondado em milímetros ou o motivo do descarte.
// "sem valor" não conta como descarte: a estação só não mandou aquele dado.
export function conferirNivel(v: unknown, permiteNegativo = false): { nivel: number } | { motivo: string } {
  if (v === null || v === undefined || v === '') return { motivo: 'sem valor' };
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return { motivo: 'sem valor' };
  if (n >= SENTINELA || Math.abs(n) > 10_000) return { motivo: 'valor de sensor com defeito' };
  if (n < 0 && !permiteNegativo) return { motivo: 'negativo' };
  return { nivel: Math.round(n * 1000) / 1000 };
}

export function numeroOuNulo(v: unknown, casas = 3): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || Math.abs(n) >= SENTINELA) return null;
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}
