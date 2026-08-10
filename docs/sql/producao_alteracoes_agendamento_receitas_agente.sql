-- RN-PCP-012: remarcação de retirada (agendamento) — espelho do agente
-- Parâmetros: :start, :end (DATE YYYY-MM-DD), filial via parse do evento REQUISICAO:
-- Índice recomendado: IX_FC01M20_DATA (DATA)

SELECT
  m.data AS data_alteracao,
  m.hora AS hora_alteracao,
  TRIM(m.cdusu) AS cdusu,
  m.evento AS evento
FROM fc01m20 m
WHERE m.data BETWEEN CAST(:start AS DATE) AND CAST(:end AS DATE)
  AND m.classificacao = 'ALTERACAO'
  AND m.modulo = 'RECEITAS'
  AND m.evento CONTAINING 'REQUISICAO:'
  AND m.evento CONTAINING 'AGENDAMENTO'
ORDER BY m.data, m.hora;

-- Confirmação: EXISTS em fc12100 + retirada atual
-- SELECT COALESCE(req.dtret, req.dtentr), req.hrret FROM fc12100 req
-- WHERE req.cdfil = :cdfil AND req.nrrqu = :nrrqu
--   AND CAST(TRIM(req.serier) AS INTEGER) = :formula_int;
