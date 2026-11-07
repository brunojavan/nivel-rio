import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { gunzip, gzip } from '../src/gzip';
import { conferirHistorico } from '../src/historico';

describe('consultas do Estado', () => {
  // O Estado só aceita a consulta que o próprio site dele faz. Se alguém editar o arquivo
  // sem querer, o coletor para. Este teste pega o caso mais comum: o arquivo trocado ou cortado.
  it('mantém a consulta Tags_data inteira', () => {
    const q = readFileSync('src/consultas/estado-tags-data.graphql', 'utf8');
    expect(q.startsWith('query Tags_data {')).toBe(true);
    expect(q).toContain('tags_data(clients: ["secretaria-de-defesa-civil"])');
    expect(q).toContain('barramento');
    expect(q.length).toBe(13225);
  });

  it('mantém a consulta Historic', () => {
    const q = readFileSync('src/consultas/estado-historico.graphql', 'utf8');
    expect(q.startsWith('query Historic($stationCode: String!')).toBe(true);
    expect(q).toContain('client: "secretaria-de-defesa-civil"');
  });
});

describe('conferência do histórico', () => {
  const amostra = new Uint8Array(gunzipSync(readFileSync('amostras/2026-11-07/estado-historico-DCSC-00013.json.gz')));

  it('conta as leituras sem ler o JSON inteiro e bate com a leitura completa', () => {
    const completo = JSON.parse(new TextDecoder().decode(amostra)).data.historic.items.length;
    expect(conferirHistorico(amostra)).toEqual({ erro: null, itens: completo });
  });

  it('reconhece o bloqueio de consultas com mais de 90 dias', () => {
    const bloqueio = new TextEncoder().encode(
      '{"errors":[{"message":"Operação bloqueada.","extensions":{"code":"INTERNAL_SERVER_ERROR"}}],"data":{"historic":null}}',
    );
    expect(conferirHistorico(bloqueio).erro).toContain('Operação bloqueada');
  });

  it('conta respostas pequenas mesmo sem o campo ts (Barragem Norte)', () => {
    const pequeno = new TextEncoder().encode('{"data":{"historic":{"items":[{"codigo":"DCSC-00042"},{"codigo":"DCSC-00042"}]}}}');
    expect(conferirHistorico(pequeno)).toEqual({ erro: null, itens: 2 });
  });
});

describe('gzip', () => {
  it('comprime e descomprime sem perder nada', async () => {
    const original = new TextEncoder().encode(JSON.stringify({ nivel: 8.58, texto: 'Itajaí-Açu '.repeat(500) }));
    const comprimido = await gzip(original);
    expect(comprimido.byteLength).toBeLessThan(original.byteLength / 5);
    expect(await gunzip(comprimido)).toEqual(original);
  });
});
