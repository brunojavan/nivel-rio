-- /api/status resume as coletas das últimas 24 horas. Sem este índice, a consulta varreria o log inteiro,
-- que cresce perto de 1.500 linhas por dia.
CREATE INDEX coletas_inicio ON coletas (inicio);
