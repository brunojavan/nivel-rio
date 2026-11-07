// Importação do passo zero, num D1 local: respostas ao vivo primeiro, depois o histórico, pulando as
// estações fora do catálogo e respeitando o limite diário de linhas gravadas.
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { sincronizarCatalogo } from '../src/catalogo';
import { importarPassoZero, ORCAMENTO_DIA } from '../src/importacao';

const arquivo = (nome: string) => new Uint8Array(readFileSync(`amostras/2026-11-07/${nome}`)); // já em gzip

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;

async function aplicarMigracoes(d: D1Database, pasta: string) {
  for (const arq of readdirSync(pasta).sort()) {
    const sql = readFileSync(`${pasta}/${arq}`, 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    for (const cmd of sql.split(/;\s*\n/).map((c) => c.trim()).filter(Boolean)) await d.prepare(cmd).run();
  }
}

async function bruto(fonte: string, chave: string | null, coletadoEm: string, gz: Uint8Array | null, erro: string | null = null) {
  const r = await env.BRUTOS.prepare(
    `INSERT INTO brutos (fonte, chave, coletado_em, status_http, gzip, erro) VALUES (?, ?, ?, 200, ?, ?) RETURNING id`,
  )
    .bind(fonte, chave, coletadoEm, gz, erro)
    .first<{ id: number }>();
  return r!.id;
}

async function situacao() {
  const r = await env.DB.prepare(`SELECT valor FROM controle WHERE chave = 'importacao'`).first<{ valor: string }>();
  return r ? JSON.parse(r.valor) : null;
}

beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({ persist: false });
  env = proxy.env;
  await aplicarMigracoes(env.DB, 'migrations');
  await aplicarMigracoes(env.BRUTOS, 'migrations-brutos');
  await sincronizarCatalogo(env.DB);

  await bruto('estado', null, '2026-11-07T20:47:00.000Z', arquivo('estado-tags-data.json.gz'));
  await bruto('estado', null, '2026-11-07T20:52:00.000Z', null, 'HTTP 502'); // erro: não importa
  await bruto('itajai', null, '2026-11-07T20:44:00.000Z', arquivo('itajai-app.json.gz'));
  await bruto('alertablu', null, '2026-11-07T20:44:00.000Z', arquivo('alertablu-nivel-oficial.json.gz'));

  const h = await bruto('estado-historico', 'DCSC-00013 x', '2026-11-07T21:00:00.000Z', arquivo('estado-historico-DCSC-00013.json.gz'));
  const fora = await bruto('estado-historico', 'DCSC-00099 x', '2026-11-07T21:01:00.000Z', arquivo('estado-historico-DCSC-00013.json.gz'));
  await env.BRUTOS.batch([
    env.BRUTOS.prepare(`INSERT INTO fila_historico (codigo, inicio, fim, situacao, bruto_id) VALUES ('DCSC-00013', '2026-08-29T03:00:00.000Z', '2026-09-05T03:00:00.000Z', 'feito', ?)`).bind(h),
    env.BRUTOS.prepare(`INSERT INTO fila_historico (codigo, inicio, fim, situacao, bruto_id) VALUES ('DCSC-00099', '2026-09-05T03:00:00.000Z', '2026-09-12T03:00:00.000Z', 'feito', ?)`).bind(fora),
    env.BRUTOS.prepare(`INSERT INTO fila_historico (codigo, inicio, fim, situacao) VALUES ('DCSC-00013', '2026-09-05T03:00:00.000Z', '2026-09-12T03:00:00.000Z', 'pendente')`),
  ]);
}, 30_000);

afterAll(async () => {
  await proxy?.dispose();
});

describe('importação do passo zero', () => {
  it('importa as respostas ao vivo, uma por execução, pulando as que deram erro', async () => {
    expect(await importarPassoZero(env)).toBe(true); // estado
    expect(await importarPassoZero(env)).toBe(true); // itajai
    expect(await importarPassoZero(env)).toBe(true); // alertablu
    const s = await situacao();
    expect(s.respostas).toBe(3);
    expect(s.cursor).toEqual({ estado: '2026-11-07T20:47:00.000Z', itajai: '2026-11-07T20:44:00.000Z', alertablu: '2026-11-07T20:44:00.000Z' });
    const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM comportas`).first<{ n: number }>();
    expect(n!.n).toBe(15);
  });

  it('depois importa o histórico, pulando a estação fora do catálogo', async () => {
    expect(await importarPassoZero(env)).toBe(false); // não sobrou resposta ao vivo: marca e segue
    expect((await situacao()).ao_vivo_ok).toBe(true);
    expect(await importarPassoZero(env)).toBe(true);
    const s = await situacao();
    expect(s.janelas).toBe(1);
    const fila = await env.BRUTOS.prepare(`SELECT codigo, importado FROM fila_historico WHERE situacao = 'feito' ORDER BY codigo`).all();
    expect(fila.results).toEqual([
      { codigo: 'DCSC-00013', importado: 144 },
      { codigo: 'DCSC-00099', importado: 0 },
    ]);
    const l = await env.DB.prepare(`SELECT COUNT(*) AS n FROM leituras WHERE estacao_id = 'rio-do-sul' AND medido_em <= ?`)
      .bind(Date.parse('2026-09-02T00:00:00Z') / 1000)
      .first<{ n: number }>();
    expect(l!.n).toBe(144);
  });

  it('só termina quando a fila do passo zero também acabou', async () => {
    expect(await importarPassoZero(env)).toBe(false);
    expect((await situacao()).terminou_em).toBeNull();
    await env.BRUTOS.prepare(`UPDATE fila_historico SET situacao = 'indisponivel' WHERE situacao = 'pendente'`).run();
    await importarPassoZero(env);
    expect((await situacao()).terminou_em).toBeTypeOf('string');
  });

  it('para quando passa do limite diário de linhas', async () => {
    const s = await situacao();
    await env.DB.prepare(`UPDATE controle SET valor = ? WHERE chave = 'importacao'`)
      .bind(JSON.stringify({ ...s, terminou_em: null, linhas_dia: ORCAMENTO_DIA }))
      .run();
    expect(await importarPassoZero(env)).toBe(false);
  });
});
