import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { lerAlertaBlu } from '../src/fontes/alertablu';
import { lerEstadoAoVivo, lerHistoricoEstado } from '../src/fontes/estado';
import { lerItajai } from '../src/fontes/itajai';
import { paraUnix } from '../src/tempo';

const amostra = (nome: string) => gunzipSync(readFileSync(`amostras/2026-11-07/${nome}`)).toString('utf8');
const iso = (t: number) => new Date(t * 1000).toISOString();

describe('horários', () => {
  it('trata horário sem fuso como Brasília', () => {
    expect(iso(paraUnix('2026-08-31T21:10:00.000')!)).toBe('2026-09-01T00:10:00.000Z');
  });
  it('respeita o fuso quando ele vem escrito', () => {
    expect(iso(paraUnix('2026-11-07T20:00:00.000Z')!)).toBe('2026-11-07T20:00:00.000Z');
    expect(iso(paraUnix('2026-11-07T20:31:35.818000+00:00')!)).toBe('2026-11-07T20:31:35.000Z');
  });
  it('recusa texto que não é data', () => {
    expect(paraUnix('ontem')).toBeNull();
    expect(paraUnix(null)).toBeNull();
  });
});

describe('Estado, resumo ao vivo', () => {
  const r = lerEstadoAoVivo(amostra('estado-tags-data.json.gz'));
  const leitura = (id: string) => r.leituras.find((l) => l.estacao === id);

  it('lê o nível e o horário de cada estação', () => {
    expect(leitura('rio-do-sul')).toEqual({ estacao: 'rio-do-sul', t: paraUnix('2026-11-07T20:46:15.190+00:00'), nivel: 8.58 });
    expect(leitura('brusque')?.nivel).toBe(5.4);
    expect(r.leituras.length).toBeGreaterThan(25);
  });

  it('descarta o valor de sensor com defeito (Gaspar e Lontras)', () => {
    expect(leitura('gaspar')).toBeUndefined();
    expect(leitura('lontras')).toBeUndefined();
    expect(r.descartes.map((d) => d.estacao).sort()).toEqual(['gaspar', 'lontras']);
  });

  it('não usa o Estado para estações de outra fonte principal', () => {
    expect(leitura('blumenau')).toBeUndefined();
    expect(leitura('itajai-cepsul')).toBeUndefined();
  });

  it('lê as três barragens', () => {
    expect(r.barragens.map((b) => b.barragem).sort()).toEqual(['barragem-norte', 'barragem-oeste', 'barragem-sul']);
    const oeste = r.barragens.find((b) => b.barragem === 'barragem-oeste')!;
    expect(oeste).toMatchObject({ montante: 355.94, jusante: 7.96, ocupacao: 47.55, vertido: 0 });
    const norte = r.barragens.find((b) => b.barragem === 'barragem-norte')!;
    expect(norte).toMatchObject({ montante: 274.75, jusante: null, t: paraUnix('2026-11-07T20:00:00Z') });
  });

  it('lê o estado de cada comporta habilitada', () => {
    const oeste = r.comportas.filter((c) => c.barragem === 'barragem-oeste');
    expect(oeste.map((c) => c.comporta)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']);
    expect(oeste.every((c) => c.aberta === 0)).toBe(true);
    const norte = r.comportas.filter((c) => c.barragem === 'barragem-norte');
    expect(norte.map((c) => [c.comporta, c.aberta])).toEqual([['G1', 1], ['T258', 0], ['264', 1]]);
  });

  it('recusa uma resposta fora do formato', () => {
    expect(() => lerEstadoAoVivo('{"data":null}')).toThrow();
  });
});

describe('Estado, histórico', () => {
  it('lê os pontos de 10 min somando 3 horas ao horário', () => {
    const r = lerHistoricoEstado(amostra('estado-historico-DCSC-00013.json.gz'), 'DCSC-00013');
    expect(r.leituras.length).toBe(144);
    expect(r.leituras[0]).toEqual({ estacao: 'rio-do-sul', t: paraUnix('2026-09-01T00:10:00Z'), nivel: 6.06 });
  });

  it('lê barragem só nos pontos que têm nível', () => {
    const texto = JSON.stringify({
      data: {
        historic: {
          items: [
            { ts: '2026-11-07T17:50:00.000', codigo: 'DCSC-00040', barramento_cota_base: 339 },
            { ts: '2026-11-07T18:00:00.000', codigo: 'DCSC-00040', barramento_nivel: 355.97, barramento_porc: 47.76 },
          ],
        },
      },
    });
    const r = lerHistoricoEstado(texto, 'DCSC-00040');
    expect(r.barragens).toEqual([
      { barragem: 'barragem-oeste', t: paraUnix('2026-11-07T21:00:00Z'), montante: 355.97, jusante: null, ocupacao: 47.76, volume: null, vertido: null },
    ]);
  });

  it('aceita o horário com Z da Barragem Norte', () => {
    const texto = '{"data":{"historic":{"items":[{"timestamp":"2026-11-07T20:00:00.000Z","barramento_nivel":274.75,"barramento_porc":16.45}]}}}';
    expect(lerHistoricoEstado(texto, 'DCSC-00042').barragens[0].t).toBe(paraUnix('2026-11-07T20:00:00Z'));
  });

  it('acusa o bloqueio de mais de 90 dias', () => {
    expect(() => lerHistoricoEstado('{"errors":[{"message":"Operação bloqueada."}],"data":{"historic":null}}', 'DCSC-00013')).toThrow(
      'Operação bloqueada',
    );
  });
});

describe('Itajaí', () => {
  const r = lerItajai(amostra('itajai-app.json.gz'));

  it('lê a série de 12 h das 11 estações da cidade, sem repetir horário', () => {
    const ids = new Set(r.leituras.map((l) => l.estacao));
    expect(ids.size).toBe(11);
    const cepsul = r.leituras.filter((l) => l.estacao === 'itajai-cepsul');
    expect(cepsul.length).toBe(70);
    expect(new Set(cepsul.map((l) => l.t)).size).toBe(cepsul.length);
    expect(cepsul.at(-1)).toEqual({ estacao: 'itajai-cepsul', t: paraUnix('2026-11-07T20:31:35Z'), nivel: 0.61 });
  });

  it('deixa de fora as leituras copiadas de Rio do Sul, Brusque e Blumenau', () => {
    expect(r.leituras.some((l) => ['rio-do-sul', 'brusque', 'blumenau'].includes(l.estacao))).toBe(false);
  });

  it('guarda as cotas, inclusive as que Itajaí usa para as cópias', () => {
    expect(r.cotas.find((c) => c.estacao === 'itajai-cepsul')).toEqual({ estacao: 'itajai-cepsul', atencao: 1.21, alerta: 1.61, emergencia: 1.75 });
    expect(r.cotas.find((c) => c.estacao === 'rio-do-sul')).toEqual({ estacao: 'rio-do-sul', atencao: 5, alerta: 6, emergencia: 7 });
  });
});

describe('AlertaBlu', () => {
  const r = lerAlertaBlu(amostra('alertablu-nivel-oficial.json.gz'));

  it('lê o nível oficial de hora em hora de Blumenau', () => {
    expect(r.leituras.length).toBeGreaterThanOrEqual(24);
    expect(r.leituras.every((l) => l.estacao === 'blumenau')).toBe(true);
    expect(r.leituras.at(-1)).toEqual({ estacao: 'blumenau', t: paraUnix('2026-11-07T20:00:00Z'), nivel: 7.54 });
  });

  it('lê as cotas oficiais de Blumenau', () => {
    expect(r.cotas).toEqual([{ estacao: 'blumenau', atencao: 4, alerta: 6, emergencia: 8 }]);
  });
});
