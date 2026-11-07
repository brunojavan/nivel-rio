// Horários: tudo vira segundos desde 1970 (UTC) antes de ir para o banco.

// O histórico do Estado devolve o horário de Brasília sem indicar o fuso ("2026-08-31T21:10:00.000").
// Quando o texto não traz fuso, vale o de Brasília. Quando traz ("Z" ou "+00:00"), vale o que está escrito.
const TEM_FUSO = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

export function paraUnix(texto: unknown, fusoPadrao = '-03:00'): number | null {
  if (typeof texto !== 'string' || texto.length < 16) return null;
  const ms = Date.parse(TEM_FUSO.test(texto) ? texto : texto + fusoPadrao);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function isoDeUnix(t: number): string {
  return new Date(t * 1000).toISOString().replace('.000Z', 'Z');
}
