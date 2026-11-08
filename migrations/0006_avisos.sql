-- Avisos da fase 4 (src/alertas.ts): mudança de faixa, subida rápida, comporta, fonte fora do ar.
-- "telegram" guarda o resultado do envio: 'sem bot' enquanto o bot não estiver configurado.
CREATE TABLE avisos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  criado_em INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  estacao_id TEXT,
  faixa TEXT,
  texto TEXT NOT NULL,
  publico INTEGER NOT NULL,
  telegram TEXT
);

CREATE INDEX avisos_criado ON avisos (criado_em);
