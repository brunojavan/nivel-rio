-- Leituras apagadas por defeito do sensor (hoje, só picos: src/picos.ts). Ficam guardadas para conferência
-- e para a mesma leitura não voltar a entrar pela série de Itajaí ou pelo histórico do Estado.
CREATE TABLE descartes (
  estacao_id TEXT NOT NULL,
  medido_em INTEGER NOT NULL,
  nivel_m REAL NOT NULL,
  fonte TEXT NOT NULL,
  motivo TEXT NOT NULL,
  descartado_em INTEGER NOT NULL,
  PRIMARY KEY (estacao_id, medido_em)
) WITHOUT ROWID;

CREATE INDEX descartes_quando ON descartes (descartado_em);
