-- Fase 1: controle da importação do histórico baixado pelo passo zero para o banco definitivo.
-- importado: NULL = falta importar; 0 = estação fora do catálogo; n = linhas gravadas.
ALTER TABLE fila_historico ADD COLUMN importado INTEGER;
CREATE INDEX fila_importar ON fila_historico (situacao, importado, inicio);
