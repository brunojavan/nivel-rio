-- Fase 1.

-- Estado interno do coletor (ex.: até quando cada estação foi conferida no histórico do Estado).
CREATE TABLE controle (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Respostas prontas da API, montadas pelo coletor depois de cada coleta.
-- O site lê uma linha só, não importa quantas pessoas estejam olhando
-- (o plano grátis do D1 permite 5 milhões de linhas lidas por dia).
CREATE TABLE instantaneo (
  chave TEXT PRIMARY KEY,
  gerado_em INTEGER NOT NULL,
  json TEXT NOT NULL
);

-- A Asthon (Rio do Sul) entra só na fase 2.
UPDATE fontes SET ativa = 0 WHERE id = 'asthon';
