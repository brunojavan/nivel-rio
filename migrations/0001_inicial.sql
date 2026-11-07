-- Banco definitivo do Nível Rio.
-- Horários sempre em UTC, guardados como segundos desde 1970 (unix), para ocupar menos espaço.
-- O plano gratuito do D1 limita cada banco a 500 MB.

CREATE TABLE fontes (
  id TEXT PRIMARY KEY,            -- estado | itajai | alertablu | asthon | cemaden
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  ativa INTEGER NOT NULL DEFAULT 1,
  ultimo_sucesso INTEGER,
  ultimo_erro TEXT,
  ultimo_erro_em INTEGER
);

INSERT INTO fontes (id, nome, url) VALUES
  ('estado',    'Defesa Civil de SC (Rede Integrada de Monitoramento)', 'https://monitoramento.defesacivil.sc.gov.br/graphql'),
  ('itajai',    'Defesa Civil de Itajaí',                               'https://monitoramento.defesacivil.itajai.sc.gov.br/data/current/app.json'),
  ('alertablu', 'AlertaBlu (Defesa Civil de Blumenau)',                 'https://defesacivil.blumenau.sc.gov.br/static/data/nivel_oficial.json'),
  ('asthon',    'Asthon (Rio do Sul)',                                  'https://public.asthon.com.br');

-- Espelho do catálogo do repositório (catalogo/estacoes.json). O arquivo é a referência.
CREATE TABLE estacoes (
  id TEXT PRIMARY KEY,            -- id próprio, ex.: rio-do-sul
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,             -- rio | barragem
  rio TEXT,
  municipio TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  ordem INTEGER,                  -- posição rio abaixo dentro do mesmo rio (1 = mais a montante)
  referencia TEXT NOT NULL,       -- regua | altitude | a-confirmar
  fonte_principal TEXT REFERENCES fontes (id),
  fonte_reserva TEXT REFERENCES fontes (id),
  codigos TEXT NOT NULL DEFAULT '{}',  -- JSON: {"estado":"DCSC-00013","itajai":"DC01"}
  ativa INTEGER NOT NULL DEFAULT 1,
  observacao TEXT
);

-- Cotas de atenção, alerta e emergência, com a data em que passaram a valer e de onde vieram.
CREATE TABLE cotas (
  estacao_id TEXT NOT NULL REFERENCES estacoes (id),
  fonte TEXT NOT NULL REFERENCES fontes (id),
  valida_desde INTEGER NOT NULL,
  atencao_m REAL,
  alerta_m REAL,
  emergencia_m REAL,
  PRIMARY KEY (estacao_id, fonte, valida_desde)
);

-- Uma leitura por estação e horário de medição. A mesma leitura vista em várias coletas é gravada uma vez.
CREATE TABLE leituras (
  estacao_id TEXT NOT NULL,
  medido_em INTEGER NOT NULL,
  nivel_m REAL NOT NULL,
  fonte TEXT NOT NULL,
  PRIMARY KEY (estacao_id, medido_em)
) WITHOUT ROWID;

CREATE TABLE leituras_barragem (
  barragem_id TEXT NOT NULL,
  medido_em INTEGER NOT NULL,
  montante_m REAL,                -- nível do reservatório
  jusante_m REAL,                 -- nível do rio logo abaixo
  ocupacao_pct REAL,
  volume_hm3 REAL,
  vertido_m REAL,
  fonte TEXT NOT NULL,
  PRIMARY KEY (barragem_id, medido_em)
) WITHOUT ROWID;

-- Grava só quando o estado de uma comporta muda.
CREATE TABLE comportas (
  barragem_id TEXT NOT NULL,
  comporta TEXT NOT NULL,         -- C1, C2, ...
  desde INTEGER NOT NULL,         -- primeira coleta em que este estado apareceu
  aberta INTEGER NOT NULL,        -- 0 fechada, 1 aberta
  fonte TEXT NOT NULL,
  PRIMARY KEY (barragem_id, comporta, desde)
) WITHOUT ROWID;

-- Log de cada execução do coletor.
CREATE TABLE coletas (
  id INTEGER PRIMARY KEY,
  fonte TEXT NOT NULL,
  inicio INTEGER NOT NULL,
  duracao_ms INTEGER,
  leituras_novas INTEGER,
  descartadas INTEGER,
  erro TEXT
);
CREATE INDEX coletas_fonte_inicio ON coletas (fonte, inicio);
