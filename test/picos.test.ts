// Picos de sensor, com as sequências reais vistas no banco em nov 2026 (horário UTC).
import { describe, expect, it } from 'vitest';
import { acharPicos, type Ponto } from '../src/picos';
import { paraUnix } from '../src/tempo';

const serie = (pares: Array<[string, number]>): Ponto[] => pares.map(([h, n]) => ({ t: paraUnix(h, 'Z')!, n }));
const valores = (p: Ponto[]) => p.map((x) => x.n);

describe('picos', () => {
  it('Rio do Sul, 5 nov: queda de 1,19 m numa leitura só', () => {
    const s = serie([
      ['2026-11-05T07:40:00', 8.04],
      ['2026-11-05T07:50:00', 8.03],
      ['2026-11-05T08:00:00', 6.84],
      ['2026-11-05T08:10:00', 7.86],
      ['2026-11-05T08:20:00', 7.87],
    ]);
    expect(valores(acharPicos(s))).toEqual([6.84]);
  });

  it('Ascurra, 4 nov: queda de 2,26 m', () => {
    const s = serie([
      ['2026-11-04T09:30:00', 6.82],
      ['2026-11-04T09:40:00', 6.83],
      ['2026-11-04T09:50:00', 4.57],
      ['2026-11-04T10:00:00', 6.85],
      ['2026-11-04T10:10:00', 6.88],
    ]);
    expect(valores(acharPicos(s))).toEqual([4.57]);
  });

  it('Ilhota, 1 nov: quedas seguidas durante meia hora', () => {
    const s = serie([
      ['2026-11-01T14:20:00', 9.31],
      ['2026-11-01T14:30:00', 4.69],
      ['2026-11-01T14:40:00', 9.28],
      ['2026-11-01T14:50:00', 3.31],
      ['2026-11-01T15:00:00', 8.01],
      ['2026-11-01T15:10:00', 9.3],
      ['2026-11-01T15:20:00', 9.26],
    ]);
    expect(valores(acharPicos(s))).toEqual([4.69, 3.31, 8.01]);
  });

  it('Benedito Novo, 5 nov: oscilação abaixo de 1 m fica', () => {
    const s = serie([
      ['2026-11-05T09:40:00', 3.93],
      ['2026-11-05T09:50:00', 4.52],
      ['2026-11-05T10:00:00', 3.71],
      ['2026-11-05T10:10:00', 3.88],
      ['2026-11-05T10:20:00', 4.48],
      ['2026-11-05T10:30:00', 4.28],
    ]);
    expect(acharPicos(s)).toEqual([]);
  });

  it('subida rápida que não volta (enxurrada) fica', () => {
    const s = serie([
      ['2026-11-05T10:00:00', 2.0],
      ['2026-11-05T10:05:00', 3.2],
      ['2026-11-05T10:10:00', 4.1],
      ['2026-11-05T10:15:00', 4.6],
      ['2026-11-05T10:20:00', 4.8],
      ['2026-11-05T10:25:00', 4.9],
      ['2026-11-05T10:30:00', 4.9],
      ['2026-11-05T10:35:00', 4.8],
    ]);
    expect(acharPicos(s)).toEqual([]);
  });

  it('subida e descida de mais de 1 m em mais de 30 minutos fica', () => {
    const s = serie([
      ['2026-11-05T10:00:00', 2.0],
      ['2026-11-05T10:10:00', 3.5],
      ['2026-11-05T10:20:00', 3.6],
      ['2026-11-05T10:30:00', 3.4],
      ['2026-11-05T10:40:00', 2.1],
    ]);
    expect(acharPicos(s)).toEqual([]);
  });

  it('a última leitura, ainda sem a seguinte, fica até a próxima coleta', () => {
    const antes = serie([
      ['2026-11-05T07:50:00', 8.03],
      ['2026-11-05T07:55:00', 8.03],
      ['2026-11-05T08:00:00', 6.84],
    ]);
    expect(acharPicos(antes)).toEqual([]);
    const depois = [...antes, ...serie([['2026-11-05T08:05:00', 8.02]])];
    expect(valores(acharPicos(depois))).toEqual([6.84]);
  });

  it('salto depois de um buraco de mais de 30 minutos não é pico', () => {
    const s = serie([
      ['2026-11-05T07:00:00', 8.0],
      ['2026-11-05T08:00:00', 6.5],
      ['2026-11-05T08:10:00', 8.0],
    ]);
    // 6,5 está a 60 min da leitura de antes: não dá para julgar. 8,0 em seguida é salto de volta, mas
    // 6,5 passou a ser a referência e o 8,0 seguinte não volta para ela: nada é apagado.
    expect(acharPicos(s)).toEqual([]);
  });

  it('Blumenau, de hora em hora: nunca entra', () => {
    const s = serie([
      ['2026-11-07T20:00:00', 7.54],
      ['2026-11-07T21:00:00', 9.0],
      ['2026-11-07T22:00:00', 7.9],
    ]);
    expect(acharPicos(s)).toEqual([]);
  });
});
