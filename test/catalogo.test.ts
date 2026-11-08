import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

type Estacao = {
  id: string;
  nome: string;
  tipo: string;
  rio?: string;
  municipio: string;
  latitude?: number;
  longitude?: number;
  ordem?: number;
  referencia: string;
  principal: boolean;
  fonte_principal: string;
  fonte_reserva?: string;
  codigos: Record<string, string>;
  situacao: string;
  conferir: string[];
};

const catalogo: { estacoes: Estacao[] } = JSON.parse(readFileSync('catalogo/estacoes.json', 'utf8'));
const estacoes = catalogo.estacoes;

function amostra(nome: string) {
  return JSON.parse(gunzipSync(readFileSync(`amostras/2026-11-07/${nome}`)).toString('utf8'));
}

describe('catálogo de estações', () => {
  it('não tem chave repetida (no JSON, a segunda apagaria a primeira sem aviso)', () => {
    const texto = readFileSync('catalogo/estacoes.json', 'utf8');
    for (const bloco of texto.split(/\n    \{/)) {
      const chaves = [...bloco.matchAll(/^      "([a-z_]+)":/gm)].map((m) => m[1]);
      expect(chaves.length, bloco.slice(0, 60)).toBe(new Set(chaves).size);
    }
  });

  it('toda estação tem coordenadas, para aparecer no mapa', () => {
    for (const e of estacoes) {
      expect(e.latitude, e.id).toBeTypeOf('number');
      expect(e.longitude, e.id).toBeTypeOf('number');
    }
  });

  it('tem ids únicos, em minúsculas e com hífen', () => {
    const ids = estacoes.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('usa só valores conhecidos nos campos fechados', () => {
    const fontes = ['estado', 'itajai', 'alertablu', 'asthon'];
    for (const e of estacoes) {
      expect(['rio', 'barragem']).toContain(e.tipo);
      expect(['regua', 'altitude', 'a-confirmar']).toContain(e.referencia);
      expect(fontes).toContain(e.fonte_principal);
      if (e.fonte_reserva) expect(fontes).toContain(e.fonte_reserva);
      expect(e.codigos[e.fonte_principal], `${e.id} sem código na fonte principal`).toBeTruthy();
    }
  });

  it('tem coordenadas dentro da bacia do Itajaí', () => {
    for (const e of estacoes) {
      if (e.latitude === undefined) continue;
      expect(e.latitude, e.id).toBeGreaterThan(-28.0);
      expect(e.latitude, e.id).toBeLessThan(-26.4);
      expect(e.longitude, e.id).toBeGreaterThan(-50.4);
      expect(e.longitude, e.id).toBeLessThan(-48.5);
    }
  });

  it('não repete a ordem dentro do mesmo rio', () => {
    const vistos = new Set<string>();
    for (const e of estacoes) {
      if (e.ordem === undefined || !e.rio) continue;
      const chave = `${e.tipo}|${e.rio}|${e.ordem}`;
      expect(vistos.has(chave), `ordem repetida: ${chave}`).toBe(false);
      vistos.add(chave);
    }
  });

  it('só usa códigos do Estado que existem na resposta real', () => {
    const codigos = new Set(
      amostra('estado-tags-data.json.gz').data.tags_data.qualle_meteorologia.map((e: { codigo: string }) => e.codigo),
    );
    for (const e of estacoes) if (e.codigos.estado) expect(codigos.has(e.codigos.estado), e.id).toBe(true);
  });

  it('só usa códigos de Itajaí que existem na resposta real', () => {
    const codigos = new Set(amostra('itajai-app.json.gz').dados.rios.map((r: { codigo: string }) => r.codigo));
    for (const e of estacoes) if (e.codigos.itajai) expect(codigos.has(e.codigos.itajai), e.id).toBe(true);
  });
});
