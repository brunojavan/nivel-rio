import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gunzip, gzip } from '../src/gzip';

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

describe('gzip', () => {
  it('comprime e descomprime sem perder nada', async () => {
    const original = new TextEncoder().encode(JSON.stringify({ nivel: 8.58, texto: 'Itajaí-Açu '.repeat(500) }));
    const comprimido = await gzip(original);
    expect(comprimido.byteLength).toBeLessThan(original.byteLength / 5);
    expect(await gunzip(comprimido)).toEqual(original);
  });
});
