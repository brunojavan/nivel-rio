// Catálogo de estações (catalogo/estacoes.json), embutido no Worker na hora de publicar.
import dados from '../catalogo/estacoes.json';

export type Fonte = 'estado' | 'itajai' | 'alertablu' | 'asthon';

export type Estacao = {
  id: string;
  nome: string;
  tipo: 'rio' | 'barragem';
  rio?: string | null;
  municipio: string;
  latitude?: number;
  longitude?: number;
  ordem?: number;
  referencia: 'regua' | 'altitude' | 'a-confirmar';
  principal: boolean;
  fonte_principal: Fonte;
  fonte_reserva?: Fonte;
  codigos: Partial<Record<Fonte, string>>;
  situacao: string;
  conferir: string[];
  observacao?: string;
};

export const ESTACOES = (dados as { estacoes: Estacao[] }).estacoes;

export const POR_ID = new Map(ESTACOES.map((e) => [e.id, e]));

// Código da estação numa fonte → estação do catálogo. Só as que usam essa fonte como principal.
export function principaisDaFonte(fonte: Fonte): Map<string, Estacao> {
  const m = new Map<string, Estacao>();
  for (const e of ESTACOES) {
    const codigo = e.codigos[fonte];
    if (codigo && e.fonte_principal === fonte) m.set(codigo, e);
  }
  return m;
}

// Intervalo normal entre duas medições, para o site avisar quando o dado está atrasado.
export function intervaloEsperado(e: Estacao): number {
  if (e.id === 'barragem-norte') return 12 * 3600; // leitura manual, às 7h e às 17h
  if (e.fonte_principal === 'alertablu') return 3600;
  // Itajaí mede de 10 em 10 min, mas publica cada leitura 10 a 14 min depois (visto em 8 nov 2026); com a
  // coleta de 5 em 5 min, uma leitura normal chega a ter perto de 29 min. Com 15 min, o aviso sai aos 32.
  if (e.fonte_principal === 'itajai') return 900;
  return 300; // Estado: o sensor manda a cada minuto e o coletor lê a cada 5
}

// O banco guarda uma cópia do catálogo (tabela estacoes). O arquivo é a referência: quando ele muda,
// o coletor atualiza a cópia na execução seguinte. A versão é uma soma simples do conteúdo.
function soma(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
export const VERSAO_CATALOGO = soma(JSON.stringify(ESTACOES));

export async function sincronizarCatalogo(db: D1Database): Promise<boolean> {
  const v = await db.prepare(`SELECT valor FROM controle WHERE chave = 'catalogo'`).first<{ valor: string }>();
  if (v && JSON.parse(v.valor) === VERSAO_CATALOGO) return false;
  const linhas = ESTACOES.map((e) => [
    e.id,
    e.nome,
    e.tipo,
    e.rio ?? null,
    e.municipio,
    e.latitude ?? null,
    e.longitude ?? null,
    e.ordem ?? null,
    e.referencia,
    e.fonte_principal,
    e.fonte_reserva ?? null,
    JSON.stringify(e.codigos),
    e.situacao === 'ativa' ? 1 : 0,
    e.observacao ?? null,
  ]);
  await db.batch([
    db.prepare(`UPDATE estacoes SET ativa = 0 WHERE id NOT IN (SELECT json_extract(value, '$[0]') FROM json_each(?))`).bind(JSON.stringify(linhas)),
    db
      .prepare(
        `INSERT INTO estacoes (id, nome, tipo, rio, municipio, latitude, longitude, ordem, referencia,
                               fonte_principal, fonte_reserva, codigos, ativa, observacao)
         SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]'),
                json_extract(value, '$[4]'), json_extract(value, '$[5]'), json_extract(value, '$[6]'), json_extract(value, '$[7]'),
                json_extract(value, '$[8]'), json_extract(value, '$[9]'), json_extract(value, '$[10]'), json_extract(value, '$[11]'),
                json_extract(value, '$[12]'), json_extract(value, '$[13]')
         FROM json_each(?1) WHERE 1
         ON CONFLICT (id) DO UPDATE SET nome = excluded.nome, tipo = excluded.tipo, rio = excluded.rio, municipio = excluded.municipio,
           latitude = excluded.latitude, longitude = excluded.longitude, ordem = excluded.ordem, referencia = excluded.referencia,
           fonte_principal = excluded.fonte_principal, fonte_reserva = excluded.fonte_reserva, codigos = excluded.codigos,
           ativa = excluded.ativa, observacao = excluded.observacao`,
      )
      .bind(JSON.stringify(linhas)),
    db.prepare(`INSERT OR REPLACE INTO controle (chave, valor) VALUES ('catalogo', ?)`).bind(JSON.stringify(VERSAO_CATALOGO)),
  ]);
  return true;
}
