// Acesso às fontes.
export const URL_ESTADO = 'https://monitoramento.defesacivil.sc.gov.br/graphql';
export const URL_ITAJAI = 'https://monitoramento.defesacivil.itajai.sc.gov.br/data/current/app.json';
export const URL_ALERTABLU = 'https://defesacivil.blumenau.sc.gov.br/static/data/nivel_oficial.json';

const USER_AGENT = 'nivel-rio/0.2 (+https://github.com/brunojavan/nivel-rio)';
const TIMEOUT_MS = 25_000;

export type Resposta = { status: number | null; corpo: Uint8Array | null; ms: number; erro: string | null };

export async function baixar(url: string, init: RequestInit = {}): Promise<Resposta> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      ...init,
      headers: { 'user-agent': USER_AGENT, accept: 'application/json', ...(init.headers as Record<string, string>) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const corpo = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, corpo, ms: Date.now() - t0, erro: r.ok ? null : `HTTP ${r.status}` };
  } catch (e) {
    return { status: null, corpo: null, ms: Date.now() - t0, erro: String(e) };
  }
}

export function postGraphql(operationName: string, variables: Record<string, unknown>, query: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operationName, variables, query }),
  };
}
