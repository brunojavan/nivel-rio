-- Passo zero: guarda as respostas das fontes do jeito que vieram, comprimidas em gzip.
-- Nada aqui é interpretado. O coletor da fase 1 lê estes dados e importa para o banco definitivo.

CREATE TABLE brutos (
  id INTEGER PRIMARY KEY,
  fonte TEXT NOT NULL,          -- estado | itajai | alertablu | estado-historico
  chave TEXT,                   -- só no histórico: "DCSC-00013 2026-09-01T03:00:00.000Z"
  coletado_em TEXT NOT NULL,    -- UTC, ISO 8601 (horário da coleta, não da medição)
  status_http INTEGER,
  duracao_ms INTEGER,
  bytes INTEGER,                -- tamanho original, antes do gzip
  bytes_gz INTEGER,
  gzip BLOB,                    -- corpo da resposta comprimido; vazio quando deu erro
  erro TEXT
);
CREATE INDEX brutos_fonte_coletado ON brutos (fonte, coletado_em);

-- Resumo por fonte, para a página de teste não precisar varrer a tabela inteira.
CREATE TABLE resumo (
  fonte TEXT PRIMARY KEY,
  coletas INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  bytes_gz INTEGER NOT NULL DEFAULT 0,
  ultima_coleta TEXT,
  ultimo_sucesso TEXT,
  ultimo_erro TEXT,
  ultimo_erro_em TEXT
);

-- Fila do download único do histórico do Estado (janelas de 7 dias por estação).
CREATE TABLE fila_historico (
  codigo TEXT NOT NULL,         -- código da estação no Estado, ex.: DCSC-00013
  inicio TEXT NOT NULL,         -- UTC, ISO 8601
  fim TEXT NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'pendente',  -- pendente | feito | erro
  tentativas INTEGER NOT NULL DEFAULT 0,
  itens INTEGER,
  bruto_id INTEGER,
  atualizado_em TEXT,
  PRIMARY KEY (codigo, inicio)
);

CREATE TABLE controle (
  chave TEXT PRIMARY KEY,
  valor TEXT
);
