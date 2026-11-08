// Testa a gravação num D1 local (o mesmo motor da Cloudflare, sem tocar no banco de verdade).
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { montarAgora } from '../src/agora';
import { gravar } from '../src/banco';
import { sincronizarCatalogo } from '../src/catalogo';
import { lerAlertaBlu } from '../src/fontes/alertablu';
import { lerEstadoAoVivo, lerHistoricoEstado } from '../src/fontes/estado';
import { lerItajai } from '../src/fontes/itajai';
import type { Resultado } from '../src/fontes/tipos';
import { paraUnix } from '../src/tempo';

const amostra = (nome: string) => gunzipSync(readFileSync(`amostras/2026-11-07/${nome}`)).toString('utf8');

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let db: D1Database;

async function aplicarMigracoes(d: D1Database, pasta: string) {
  for (const arq of readdirSync(pasta).sort()) {
    const sql = readFileSync(`${pasta}/${arq}`, 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    for (const cmd of sql.split(/;\s*\n/).map((c) => c.trim()).filter(Boolean)) await d.prepare(cmd).run();
  }
}

beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({ persist: false });
  db = proxy.env.DB;
  await aplicarMigracoes(db, 'migrations');
  expect(await sincronizarCatalogo(db)).toBe(true);
  expect(await sincronizarCatalogo(db)).toBe(false);
}, 30_000);

afterAll(async () => {
  await proxy?.dispose();
});

const T0 = paraUnix('2026-11-07T21:00:00Z')!;

describe('gravação', () => {
  const estado = lerEstadoAoVivo(amostra('estado-tags-data.json.gz'));

  it('grava o resumo do Estado uma vez e não duplica na coleta seguinte', async () => {
    const g1 = await gravar(db, estado, 'estado', 'medicao', T0);
    expect(g1.leituras).toBe(estado.leituras.length);
    expect(g1.barragens).toBe(3);
    expect(g1.comportas).toBe(15); // Oeste 7, Sul 5, Norte 3
    const g2 = await gravar(db, estado, 'estado', 'medicao', T0 + 300);
    expect(g2).toEqual({ leituras: 0, barragens: 0, comportas: 0, cotas: 0, linhas_gravadas: 0, picos: 0 });
  });

  it('grava comporta só quando muda', async () => {
    const mudou: Resultado = {
      ...estado,
      leituras: [],
      barragens: [],
      comportas: estado.comportas.map((c) => (c.barragem === 'barragem-oeste' && c.comporta === 'C1' ? { ...c, t: c.t + 600, aberta: 1 } : { ...c, t: c.t + 600 })),
    };
    expect((await gravar(db, mudou, 'estado', 'medicao', T0)).comportas).toBe(1);
    expect((await gravar(db, mudou, 'estado', 'medicao', T0)).comportas).toBe(0);
  });

  it('tapa-buraco não grava ponto a menos de 5 min de uma leitura existente', async () => {
    const t = estado.leituras.find((l) => l.estacao === 'rio-do-sul')!.t;
    const hist: Resultado = {
      leituras: [
        { estacao: 'rio-do-sul', t: t - 100, nivel: 8.5 }, // perto da leitura ao vivo: fica de fora
        { estacao: 'rio-do-sul', t: t - 1200, nivel: 8.4 }, // buraco: entra
        { estacao: 'rio-do-sul', t: t - 1800, nivel: 8.3 }, // buraco: entra
      ],
      barragens: [],
      comportas: [],
      cotas: [],
      descartes: [],
    };
    expect((await gravar(db, hist, 'estado', 'tapa-buraco', T0)).leituras).toBe(2);
    expect((await gravar(db, hist, 'estado', 'tapa-buraco', T0)).leituras).toBe(0);
  });

  it('o histórico real do Estado entra inteiro quando não há leitura ao vivo no período', async () => {
    const r = lerHistoricoEstado(amostra('estado-historico-DCSC-00013.json.gz'), 'DCSC-00013');
    expect((await gravar(db, r, 'estado', 'tapa-buraco', T0)).leituras).toBe(144);
  });

  it('grava as cotas só quando mudam', async () => {
    const itajai = lerItajai(amostra('itajai-app.json.gz'));
    const g1 = await gravar(db, itajai, 'itajai', 'medicao', T0);
    expect(g1.cotas).toBe(14);
    expect(g1.leituras).toBe(itajai.leituras.length);
    expect((await gravar(db, itajai, 'itajai', 'medicao', T0 + 300)).cotas).toBe(0);
    const mudou = { ...itajai, cotas: itajai.cotas.map((c) => (c.estacao === 'itajai-cepsul' ? { ...c, alerta: 1.7 } : c)) };
    expect((await gravar(db, mudou, 'itajai', 'medicao', T0 + 600)).cotas).toBe(1);
    await gravar(db, lerAlertaBlu(amostra('alertablu-nivel-oficial.json.gz')), 'alertablu', 'medicao', T0);
  });

  it('apaga o pico quando chega a leitura seguinte, guarda em descartes e não deixa voltar', async () => {
    const r = (pares: Array<[string, number]>): Resultado => ({
      leituras: pares.map(([h, nivel]) => ({ estacao: 'ascurra', t: paraUnix(h, 'Z')!, nivel })),
      barragens: [],
      comportas: [],
      cotas: [],
      descartes: [],
    });
    const contar = async () =>
      (await db.prepare(`SELECT COUNT(*) AS n FROM leituras WHERE estacao_id = 'ascurra' AND medido_em < ?`).bind(T0 - 86_400).first<{ n: number }>())!.n;

    // Ascurra, 4 nov: a queda de 2,26 m chega sozinha e ainda não dá para julgar.
    const g1 = await gravar(db, r([['2026-11-04T09:30:00', 6.82], ['2026-11-04T09:40:00', 6.83], ['2026-11-04T09:50:00', 4.57]]), 'estado', 'medicao', T0);
    expect([g1.leituras, g1.picos]).toEqual([3, 0]);
    // Na leitura seguinte o nível volta: a queda sai.
    const g2 = await gravar(db, r([['2026-11-04T10:00:00', 6.85]]), 'estado', 'medicao', T0);
    expect([g2.leituras, g2.picos]).toEqual([1, 1]);
    expect(await contar()).toBe(3);
    const d = await db.prepare(`SELECT nivel_m, motivo FROM descartes WHERE estacao_id = 'ascurra'`).all();
    expect(d.results).toEqual([{ nivel_m: 4.57, motivo: 'pico' }]);
    // A mesma leitura vista de novo (série de 12 h, histórico do Estado) não volta.
    expect((await gravar(db, r([['2026-11-04T09:50:00', 4.57]]), 'estado', 'medicao', T0)).leituras).toBe(0);
    expect((await gravar(db, r([['2026-11-04T09:50:00', 4.57]]), 'estado', 'tapa-buraco', T0)).leituras).toBe(0);
    expect(await contar()).toBe(3);
  });
});

describe('resumo da tela inicial', () => {
  it('monta nível, tendência, cotas e barragens', async () => {
    const a = (await montarAgora(db)) as any;
    const est = (id: string) => a.estacoes.find((e: any) => e.id === id);

    expect(est('rio-do-sul')).toMatchObject({ nivel: 8.58, medido_em: '2026-11-07T20:46:15Z' });
    expect(est('rio-do-sul').h1.nivel).toBeTypeOf('number'); // veio do histórico gravado acima
    // Rio do Sul não tem cota no Estado: usa a que Itajaí publica, com a origem indicada.
    expect(est('rio-do-sul').cotas).toMatchObject({ atencao: 5, alerta: 6, emergencia: 7, fonte: 'Defesa Civil de Itajaí' });
    // Blumenau: cota oficial do AlertaBlu, não a cópia de Itajaí.
    expect(est('blumenau')).toMatchObject({ nivel: 7.54, cotas: { atencao: 4, alerta: 6, emergencia: 8, fonte: 'AlertaBlu (Defesa Civil de Blumenau)' } });
    expect(est('itajai-cepsul').cotas.alerta).toBe(1.7);
    expect(est('gaspar').nivel).toBeNull();

    const oeste = a.barragens.find((b: any) => b.id === 'barragem-oeste');
    expect(oeste).toMatchObject({ montante_m: 355.94, ocupacao_pct: 47.55 });
    expect(oeste.comportas.find((c: any) => c.nome === 'C1')).toMatchObject({ aberta: true, desde_inicio_registro: false });
    expect(oeste.comportas.find((c: any) => c.nome === 'C2')).toMatchObject({ aberta: false, desde_inicio_registro: true });
    expect(a.fontes.map((f: any) => f.id).sort()).toEqual(['alertablu', 'estado', 'itajai']);
  });
});
