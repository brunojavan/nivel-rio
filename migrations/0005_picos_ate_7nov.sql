-- Picos que já estavam no banco quando a conferência de picos entrou (src/picos.ts, 7 nov 2026).
-- Achados com a mesma regra sobre todas as leituras gravadas até então:
--   ascurra      2026-11-04 09:50 UTC  4.57 m
--   ilhota       2026-11-01 14:50 UTC  3.31 m
--   ilhota       2026-11-01 15:00 UTC  8.01 m
--   lontras      2026-11-06 15:40 UTC  0 m
--   lontras      2026-11-06 17:10 UTC  6.28 m
--   lontras      2026-11-06 18:10 UTC  4.25 m
--   lontras      2026-11-06 19:00 UTC  1.39 m
--   lontras      2026-11-06 19:10 UTC  2.29 m
--   lontras      2026-11-06 21:10 UTC  6.28 m
--   lontras      2026-11-06 21:30 UTC  2.83 m
--   lontras      2026-11-06 22:10 UTC  4.59 m
--   lontras      2026-11-07 01:30 UTC  0.39 m
--   rio-do-sul   2026-11-05 08:00 UTC  6.84 m
-- Lontras está marcada "sensor com defeito" no catálogo e não aparece no site.
INSERT OR IGNORE INTO descartes (estacao_id, medido_em, nivel_m, fonte, motivo, descartado_em)
SELECT estacao_id, medido_em, nivel_m, fonte, 'pico', unixepoch() FROM leituras
WHERE (estacao_id, medido_em) IN (VALUES
  ('ascurra', 1793785800),
  ('ilhota', 1793544600),
  ('ilhota', 1793545200),
  ('lontras', 1793979600),
  ('lontras', 1793985000),
  ('lontras', 1793988600),
  ('lontras', 1793991600),
  ('lontras', 1793992200),
  ('lontras', 1793999400),
  ('lontras', 1794000600),
  ('lontras', 1794003000),
  ('lontras', 1794015000),
  ('rio-do-sul', 1793865600)
);

DELETE FROM leituras
WHERE (estacao_id, medido_em) IN (SELECT estacao_id, medido_em FROM descartes);
