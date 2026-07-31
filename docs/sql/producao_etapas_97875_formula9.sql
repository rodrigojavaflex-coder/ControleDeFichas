/*
  Requisição 97875, fórmula 9 — por que some no import do agente?
  Banco/cdfil: INHUMAS = 2 | Período import jul/2026

  IMPORTANTE — 13 movimentos x 4 linhas no SQL do agente:
  - FC12500: cada lançamento PCP (01 entrada, 02 saída, 03 retorno…) = MOVIMENTO.
  - Import (producao_etapas_resumo): 1 LINHA por requisicao + formula + cod_etapa
    (merge de tppcp; vários movimentos viram um resumo por etapa).
  - Para 97875-9, 13 movimentos e 4 linhas (01, 65, 66, 69) no SELECT do agente
    é o comportamento ESPERADO se o Firebird/agents estiver correto.
  - Se o PostgreSQL não tiver essas 4 linhas, o problema não é “faltou movimento”,
    e sim agente não enviou ou upsert não gravou — ver log backend formula9=4.

  Ordem sugerida: blocos A → F. Bloco E/F com 4 linhas = OK no Firebird.

  Query completa do agente (jul/2026): docs/sql/producao_etapas_resumo_agente.sql
*/

-- ===========================================================================
-- A) Movimentos da fórmula 9 no período
-- ===========================================================================
SELECT
  p.data,
  p.hora,
  p.serier AS serier_raw,
  TRIM(p.serier) AS formula_trim,
  TRIM(p.cdetapa) AS cdetapa,
  p.tppcp,
  TRIM(p.cdopera) AS cdopera
FROM fc12500 p
WHERE p.cdfil = 2
  AND p.nrrqu = 97875
  AND TRIM(p.serier) IN ('9', '09')
  AND p.data BETWEEN '2026-07-01' AND '2026-07-31'
ORDER BY p.data, p.hora, p.cdetapa, p.tppcp;

-- ===========================================================================
-- B) Entra no formula_touch? (sem isso a fórmula 9 nem expande no STAGE)
-- ===========================================================================
SELECT DISTINCT
  t.nrrqu,
  t.serier AS serier_raw,
  TRIM(t.serier) AS formula_touch_key
FROM fc12500 t
WHERE t.cdfil = 2
  AND t.nrrqu = 97875
  AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  AND TRIM(t.serier) IN ('9', '09');

-- Todas as fórmulas da req no touch (compare 0..9)
SELECT DISTINCT TRIM(t.serier) AS formula
FROM fc12500 t
WHERE t.cdfil = 2
  AND t.nrrqu = 97875
  AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
ORDER BY 1;

-- ===========================================================================
-- C) fc12100 — LEFT JOIN no agente; só afeta paciente/volume, não exclui linha
-- ===========================================================================
SELECT
  req.serier AS serier_raw,
  TRIM(req.serier) AS formula_trim,
  req.volume,
  TRIM(req.nomepa) AS paciente
FROM fc12100 req
WHERE req.cdfil = 2
  AND req.nrrqu = 97875
  AND TRIM(req.serier) IN ('9', '09');

-- ===========================================================================
-- D) STAGE + evt_ent (INNER JOIN) — linha some se não houver 1º '01'/'1' no tppcp
-- ===========================================================================
SELECT
  TRIM(stage.cdetapa) AS cdetapa,
  stage.tppcp,
  TRIM(stage.serier) AS formula,
  CASE WHEN evt_ent.data_entrada IS NULL THEN 'SEM 01' ELSE 'OK' END AS entrada
FROM (
  SELECT DISTINCT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp
  FROM fc12500 p
  INNER JOIN (
    SELECT DISTINCT t.cdfil, t.nrrqu, TRIM(t.serier) AS serier
    FROM fc12500 t
    WHERE t.cdfil = 2
      AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  ) formula_touch
    ON formula_touch.cdfil = p.cdfil
   AND formula_touch.nrrqu = p.nrrqu
   AND formula_touch.serier = TRIM(p.serier)
  WHERE p.cdfil = 2
    AND p.nrrqu = 97875
    AND TRIM(p.serier) IN ('9', '09')
) stage
LEFT JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp, p.data AS data_entrada
  FROM fc12500 p
  WHERE TRIM(p.cdopera) IN ('01', '1')
    AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp
        AND TRIM(p_ant.cdopera) IN ('01', '1')
        AND (p_ant.data < p.data OR (p_ant.data = p.data AND p_ant.hora < p.hora))
    )
) evt_ent
  ON evt_ent.cdfil = stage.cdfil AND evt_ent.nrrqu = stage.nrrqu
 AND TRIM(evt_ent.serier) = TRIM(stage.serier)
 AND evt_ent.cdetapa = stage.cdetapa AND evt_ent.tppcp = stage.tppcp
ORDER BY 1, 2;

-- ===========================================================================
-- E) Quantas linhas o agente geraria só para 97875-9 (mesma regra INNER evt_ent)
-- ===========================================================================
SELECT COUNT(*) AS linhas_agente_97875_f9
FROM (
  SELECT DISTINCT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp
  FROM fc12500 p
  INNER JOIN (
    SELECT DISTINCT t.cdfil, t.nrrqu, TRIM(t.serier) AS serier
    FROM fc12500 t
    WHERE t.cdfil = 2
      AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  ) formula_touch
    ON formula_touch.cdfil = p.cdfil
   AND formula_touch.nrrqu = p.nrrqu
   AND formula_touch.serier = TRIM(p.serier)
  WHERE p.cdfil = 2
    AND p.nrrqu = 97875
    AND TRIM(p.serier) IN ('9', '09')
) stage
INNER JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp
  FROM fc12500 p
  WHERE TRIM(p.cdopera) IN ('01', '1') AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp
        AND TRIM(p_ant.cdopera) IN ('01', '1')
        AND (p_ant.data < p.data OR (p_ant.data = p.data AND p_ant.hora < p.hora))
    )
) evt_ent
  ON evt_ent.cdfil = stage.cdfil AND evt_ent.nrrqu = stage.nrrqu
 AND TRIM(evt_ent.serier) = TRIM(stage.serier)
 AND evt_ent.cdetapa = stage.cdetapa AND evt_ent.tppcp = stage.tppcp;

-- ===========================================================================
-- F) Prévia import (97875-9) — espelho simplificado do SELECT do agente
-- ===========================================================================
SELECT
  stage.nrrqu AS requisicao,
  TRIM(stage.serier) AS formula,
  TRIM(stage.cdetapa) AS cod_etapa,
  TRIM(e.descricao) AS etapa,
  evt_ent.data_entrada,
  evt_ent.hora_entrada,
  evt_sai.data_saida AS data_saida_02,
  TRIM(evt_ult.ult_cdopera) AS ult_cdopera
FROM (
  SELECT DISTINCT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp
  FROM fc12500 p
  INNER JOIN (
    SELECT DISTINCT t.cdfil, t.nrrqu, TRIM(t.serier) AS serier
    FROM fc12500 t
    WHERE t.cdfil = 2
      AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  ) formula_touch
    ON formula_touch.cdfil = p.cdfil
   AND formula_touch.nrrqu = p.nrrqu
   AND formula_touch.serier = TRIM(p.serier)
  WHERE p.cdfil = 2
    AND p.nrrqu = 97875
    AND TRIM(p.serier) IN ('9', '09')
) stage
INNER JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp,
         p.data AS data_entrada, p.hora AS hora_entrada
  FROM fc12500 p
  WHERE TRIM(p.cdopera) IN ('01', '1') AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp AND TRIM(p_ant.cdopera) IN ('01', '1')
        AND (p_ant.data < p.data OR (p_ant.data = p.data AND p_ant.hora < p.hora))
    )
) evt_ent
  ON evt_ent.cdfil = stage.cdfil AND evt_ent.nrrqu = stage.nrrqu
 AND TRIM(evt_ent.serier) = TRIM(stage.serier)
 AND evt_ent.cdetapa = stage.cdetapa AND evt_ent.tppcp = stage.tppcp
LEFT JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp,
         p.data AS data_saida, p.hora AS hora_saida
  FROM fc12500 p
  WHERE TRIM(p.cdopera) IN ('02', '2') AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp AND TRIM(p_ant.cdopera) IN ('02', '2')
        AND (p_ant.data < p.data OR (p_ant.data = p.data AND p_ant.hora < p.hora))
    )
) evt_sai
  ON evt_sai.cdfil = stage.cdfil AND evt_sai.nrrqu = stage.nrrqu
 AND TRIM(evt_sai.serier) = TRIM(stage.serier)
 AND evt_sai.cdetapa = stage.cdetapa AND evt_sai.tppcp = stage.tppcp
LEFT JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp,
         TRIM(p.cdopera) AS ult_cdopera
  FROM fc12500 p
  WHERE p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p2
      WHERE p2.cdfil = p.cdfil AND p2.nrrqu = p.nrrqu
        AND p2.serier = p.serier AND p2.cdetapa = p.cdetapa
        AND p2.tppcp = p.tppcp
        AND (p2.data > p.data OR (p2.data = p.data AND p2.hora > p.hora))
    )
) evt_ult
  ON evt_ult.cdfil = stage.cdfil AND evt_ult.nrrqu = stage.nrrqu
 AND TRIM(evt_ult.serier) = TRIM(stage.serier)
 AND evt_ult.cdetapa = stage.cdetapa AND evt_ult.tppcp = stage.tppcp
LEFT JOIN fc12540 e
  ON e.cdetapa = stage.cdetapa AND e.tppcp = stage.tppcp
ORDER BY e.posicao, stage.cdetapa, stage.tppcp;

-- ===========================================================================
-- G) Filtro no SQL COMPLETO do agente (jul/2026)
--    Abra docs/sql/producao_etapas_resumo_agente.sql e acrescente ANTES do ORDER BY:
--
--    WHERE stage.nrrqu = 97875
--      AND TRIM(stage.serier) IN ('9', '09')
--
--    Ou rode COUNT(*) envolvendo aquele SELECT inteiro com o mesmo WHERE.
-- ===========================================================================
