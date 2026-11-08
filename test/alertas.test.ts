// Avisos da fase 4: regras soltas e a simulação com os dados reais da cheia de 7 nov 2026.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { avaliar, type Aviso, type EstacaoResumo, type EstadoAlertas, type Resumo } from '../src/alertas';

const iso = (t: number) => new Date(t * 1000).toISOString();
const T0 = Date.parse('2026-11-07T12:00:00Z') / 1000;

function estacao(nivel: number, t: number, h1: number | null, extra: Partial<EstacaoResumo> = {}): EstacaoResumo {
  return {
    id: 'blumenau', nome: 'Blumenau', municipio: 'Blumenau', referencia: 'regua', situacao: 'ativa', intervalo_s: 300,
    nivel, medido_em: iso(t), h1: h1 == null ? null : { medido_em: iso(t - 3600), nivel: h1 },
    cotas: { atencao: 4, alerta: 6, emergencia: 8 }, ...extra,
  };
}
const resumo = (estacoes: EstacaoResumo[], extra: Partial<Resumo> = {}): Resumo => ({ estacoes, barragens: [], fontes: [], ...extra });

// Roda uma sequência de avaliações de 5 em 5 minutos e devolve os avisos.
function rodar(passos: Array<(t: number) => Resumo>, inicio = T0): { avisos: Aviso[]; estado: EstadoAlertas | null } {
  let estado: EstadoAlertas | null = null;
  const avisos: Aviso[] = [];
  passos.forEach((p, i) => {
    const t = inicio + i * 300;
    const r = avaliar(estado, p(t), t);
    estado = r.estado;
    avisos.push(...r.avisos);
  });
  return { avisos, estado };
}

describe('avisos: regras', () => {
  it('na primeira execução só anota, sem avisar', () => {
    const r = avaliar(null, resumo([estacao(7, T0, 6.5)]), T0);
    expect(r.avisos).toEqual([]);
    expect(r.estado.estacoes.blumenau.faixa).toBe('alerta');
  });

  it('mudança de faixa só avisa na segunda avaliação seguida, e uma vez', () => {
    const { avisos } = rodar([
      (t) => resumo([estacao(5.9, t, 5.8)]),
      (t) => resumo([estacao(6.05, t, 5.9)]), // primeira vez acima de 6: ainda não avisa
      (t) => resumo([estacao(6.1, t, 5.95)]), // confirmou
      (t) => resumo([estacao(6.15, t, 6.0)]),
      (t) => resumo([estacao(6.2, t, 6.05)]),
    ]);
    expect(avisos.map((a) => [a.tipo, a.faixa])).toEqual([['faixa', 'alerta']]);
    expect(avisos[0].texto).toMatch(/^🟠 Blumenau entrou em ALERTA: 6,10 m às \d\d:\d\d \(cota de alerta: 6,00 m\)\. Subindo 15 cm\/h\./);
  });

  it('pico de uma leitura só (que some na coleta seguinte) não avisa', () => {
    const { avisos } = rodar([
      (t) => resumo([estacao(5.5, t, 5.5)]),
      (t) => resumo([estacao(8.4, t, 5.5)]), // pico: some na seguinte
      (t) => resumo([estacao(5.5, t, 5.5)]),
      (t) => resumo([estacao(5.5, t, 5.5)]),
    ]);
    expect(avisos).toEqual([]);
  });

  it('nível parado em cima da cota não fica avisando (margem de 10 cm para descer)', () => {
    const niveis = [6.02, 6.03, 5.98, 6.01, 5.97, 6.02, 5.95, 5.99, 6.0, 5.96, 5.94, 5.93];
    const { avisos } = rodar([(t) => resumo([estacao(5.5, t, 5.5)]), ...niveis.map((n) => (t: number) => resumo([estacao(n, t, n)]))]);
    expect(avisos.filter((a) => a.tipo === 'faixa').map((a) => a.faixa)).toEqual(['alerta']);
    // Só desce de faixa abaixo de 5,90.
    const desce = rodar([(t) => resumo([estacao(6.1, t, 6.1)]), (t) => resumo([estacao(5.85, t, 5.9)]), (t) => resumo([estacao(5.84, t, 5.9)])]);
    expect(desce.avisos.map((a) => a.faixa)).toEqual(['atencao']);
    expect(desce.avisos[0].texto).toMatch(/voltou para ATENÇÃO/);
  });

  it('subida rápida: 30 cm/h no vale, 50 cm/h na foz (maré), no máximo uma vez a cada 3 h', () => {
    const vale = rodar(Array.from({ length: 40 }, () => (t: number) => resumo([estacao(3, t, 2.6, { cotas: null })])));
    expect(vale.avisos.filter((a) => a.tipo === 'subida').length).toBe(2); // 40 avaliações = 3 h 15 min
    const foz = rodar(Array.from({ length: 6 }, () => (t: number) => resumo([estacao(1.5, t, 1.1, { id: 'itajai-cepsul', nome: 'Itajaí, CEPSUL', municipio: 'Itajaí', cotas: null })])));
    expect(foz.avisos).toEqual([]);
  });

  it('estação atrasada não muda de faixa nem avisa', () => {
    const { avisos } = rodar([
      (t) => resumo([estacao(5.5, t, 5.5)]),
      (t) => resumo([estacao(7, t - 3600, 6)]),
      (t) => resumo([estacao(7, t - 3900, 6)]),
    ]);
    expect(avisos).toEqual([]);
  });

  it('comporta que abre e fonte que sai do ar e volta', () => {
    const barragem = (aberta: boolean) => ({ id: 'barragem-oeste', nome: 'Barragem Oeste', municipio: 'Taió', comportas: [{ nome: 'C1', aberta, desde: iso(T0) }] });
    const fonte = (t: number, ok: number) => ({ id: 'itajai', nome: 'Defesa Civil de Itajaí', ultimo_sucesso: iso(t - ok) });
    const { avisos } = rodar([
      (t) => resumo([], { barragens: [barragem(false)], fontes: [fonte(t, 60)] }),
      (t) => resumo([], { barragens: [barragem(true)], fontes: [fonte(t, 3700)] }),
      (t) => resumo([], { barragens: [barragem(true)], fontes: [fonte(t, 4000)] }),
      (t) => resumo([], { barragens: [barragem(true)], fontes: [fonte(t, 60)] }),
    ]);
    expect(avisos.map((a) => a.texto.split('\n')[0])).toEqual([
      expect.stringMatching(/^⚠️ Defesa Civil de Itajaí sem responder desde/),
      expect.stringMatching(/^🚧 Barragem Oeste \(Taió\): comporta C1 ABRIU/),
      '✅ Defesa Civil de Itajaí voltou a responder.',
    ]);
  });
});

// Simulação: as leituras reais de 5 a 8 nov 2026, avaliadas de 5 em 5 minutos como o coletor faz.
describe('avisos: simulação com a cheia de 7 nov 2026', () => {
  const cheia = JSON.parse(gunzipSync(readFileSync('amostras/2026-11-08/cheia-7nov.json.gz')).toString('utf8')) as {
    cotas: Record<string, Record<string, { atencao: number; alerta: number; emergencia: number }>>;
    series: Record<string, Array<[number, number]>>;
  };
  const principal = (id: string) => (id === 'blumenau' ? 'alertablu' : 'itajai');
  const intervalo = (id: string) => (id === 'blumenau' ? 3600 : id.startsWith('itajai') ? 600 : 300);

  function resumoEm(t: number): Resumo {
    const estacoes: EstacaoResumo[] = [];
    for (const [id, serie] of Object.entries(cheia.series)) {
      let i = serie.length - 1;
      while (i >= 0 && serie[i][0] > t) i--;
      if (i < 0) continue;
      const [tu, nu] = serie[i];
      let j = i;
      while (j >= 0 && serie[j][0] > tu - 3600) j--;
      estacoes.push({
        id, nome: id, municipio: id.startsWith('itajai') ? 'Itajaí' : id, referencia: 'regua', situacao: 'ativa', intervalo_s: intervalo(id),
        nivel: nu, medido_em: iso(tu), h1: j >= 0 ? { medido_em: iso(serie[j][0]), nivel: serie[j][1] } : null,
        cotas: cheia.cotas[id][principal(id)],
      });
    }
    return { estacoes, barragens: [], fontes: [] };
  }

  const inicio = Date.parse('2026-11-05T00:00:00Z') / 1000;
  const fim = Math.max(...Object.values(cheia.series).map((s) => s[s.length - 1][0]));
  let estado: EstadoAlertas | null = null;
  const avisos: Array<Aviso & { t: number }> = [];
  for (let t = inicio; t <= fim; t += 300) {
    const r = avaliar(estado, resumoEm(t), t);
    estado = r.estado;
    avisos.push(...r.avisos.map((a) => ({ ...a, t })));
  }
  if (process.env.MOSTRAR_AVISOS) for (const a of avisos) console.log(new Date(a.t * 1000).toISOString().slice(5, 16), a.texto.split('\n')[0]);
  const faixas = (id: string) => avisos.filter((a) => a.tipo === 'faixa' && a.estacao_id === id).map((a) => a.faixa);

  it('Blumenau sobe de faixa em faixa até a emergência, sem repetir', () => {
    // A série do AlertaBlu começa em 6 nov, 23h UTC, com 3,48 m (abaixo da atenção, 4 m).
    expect(faixas('blumenau')).toEqual(['atencao', 'alerta', 'emergencia']);
  });

  it('Rio do Sul entra em emergência', () => {
    expect(faixas('rio-do-sul')).toContain('emergencia');
  });

  it('nenhuma estação recebe o mesmo aviso de faixa duas vezes seguidas', () => {
    for (const id of Object.keys(cheia.series)) {
      const f = faixas(id);
      for (let i = 1; i < f.length; i++) expect(f[i], `${id}: ${f.join(' → ')}`).not.toBe(f[i - 1]);
    }
  });

  it('volume de avisos razoável para três dias de cheia', () => {
    const porEstacao = new Map<string, number>();
    for (const a of avisos) porEstacao.set(a.estacao_id ?? '', (porEstacao.get(a.estacao_id ?? '') ?? 0) + 1);
    for (const [id, n] of porEstacao) expect(n, id).toBeLessThanOrEqual(8);
  });
});
