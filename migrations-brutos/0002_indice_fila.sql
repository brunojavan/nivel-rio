-- A fila do histórico era varrida inteira a cada minuto (cerca de 2 mil linhas lidas por execução).
-- O plano grátis do D1 permite 5 milhões de linhas lidas por dia na conta toda.
-- Com este índice, achar a próxima janela lê uma linha só.
-- Janelas com erro voltam para "pendente" enquanto houver tentativas; "erro" passa a ser definitivo.
UPDATE fila_historico SET situacao = 'pendente' WHERE situacao = 'erro' AND tentativas < 5;
CREATE INDEX fila_situacao_inicio ON fila_historico (situacao, inicio, codigo);
