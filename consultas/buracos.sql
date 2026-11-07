-- Critério de pronto da fase 1: 72 horas sem buraco maior que 20 minutos nas estações ativas.
-- Uso (só para conferir; não roda sozinho):
--   npx wrangler d1 execute nivel-rio --remote --command "$(grep -v '^--' consultas/buracos.sql)"
--   (com --file o Wrangler não mostra o resultado)
-- Blumenau (AlertaBlu) mede de hora em hora: para ela, o intervalo normal é de 60 minutos.
-- Lê perto de 40 mil linhas quando as 72 horas estiverem completas (72 h de todas as estações). O plano grátis permite 5 milhões por dia.
WITH l AS MATERIALIZED (
  SELECT estacao_id, medido_em,
         medido_em - LAG(medido_em) OVER (PARTITION BY estacao_id ORDER BY medido_em) AS buraco
  FROM leituras
  WHERE estacao_id IN (SELECT id FROM estacoes WHERE ativa = 1 AND tipo = 'rio')
    AND medido_em >= unixepoch() - 72 * 3600
)
SELECT estacao_id,
       COUNT(*) AS leituras,
       datetime(MIN(medido_em), 'unixepoch') AS primeira,
       MAX(buraco) / 60 AS maior_buraco_min,
       SUM(buraco > 1200) AS buracos_acima_20min,
       (unixepoch() - MAX(medido_em)) / 60 AS min_desde_ultima
FROM l
GROUP BY estacao_id
ORDER BY maior_buraco_min DESC;

-- Onde estão os buracos acima de 20 minutos (horário UTC):
-- WITH l AS (SELECT estacao_id, medido_em, medido_em - LAG(medido_em) OVER (PARTITION BY estacao_id ORDER BY medido_em) AS buraco
--            FROM leituras WHERE estacao_id = 'rio-do-sul' AND medido_em >= unixepoch() - 72 * 3600)
-- SELECT datetime(medido_em - buraco, 'unixepoch') AS de, datetime(medido_em, 'unixepoch') AS ate, buraco / 60 AS minutos
-- FROM l WHERE buraco > 1200;
