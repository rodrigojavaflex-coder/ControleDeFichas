/*
  Diagnóstico Firebird — importação producao_etapas_resumo (RN-PCP-001)
  Rode no MESMO banco/cdfil que o agente INHUMAS (cdfil = 2).

  Ajuste :cdfil, :data_ini, :data_fim, :nrrqu, :formula se necessário.
  Caso referência: requisição 97875, fórmula 9, jul/2026.
*/

-- ---------------------------------------------------------------------------
-- 0) Parâmetros (substitua nos blocos ou use variáveis do seu cliente SQL)
-- cdfil = 2, nrrqu = 97875, formula = '9'
-- data_ini = '2026-07-01', data_fim = '2026-07-31'
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1) Movimentos brutos (você já viu COUNT = 13)
-- ---------------------------------------------------------------------------
SELECT
  p.data,
  p.hora,
  TRIM(p.cdetapa) AS cdetapa,
  p.tppcp,
  TRIM(p.cdopera) AS cdopera,
  TRIM(CAST(p.cdusu AS VARCHAR(32))) AS cdusu,
  TRIM(p.serier) AS formula
FROM fc12500 p
WHERE p.cdfil = 2
  AND p.nrrqu = 97875
  AND TRIM(p.serier) = '9'
  AND p.data BETWEEN '2026-07-01' AND '2026-07-31'
ORDER BY p.data, p.hora, p.cdetapa, p.tppcp;

-- ---------------------------------------------------------------------------
-- 2) Fórmula entra no filtro do período? (formula_touch do agente)
-- ---------------------------------------------------------------------------
SELECT DISTINCT
  t.cdfil,
  t.nrrqu,
  TRIM(t.serier) AS formula
FROM fc12500 t
WHERE t.cdfil = 2
  AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  AND t.nrrqu = 97875
  AND TRIM(t.serier) = '9';

-- ---------------------------------------------------------------------------
-- 3) Linhas STAGE (todos cdetapa/tppcp da fórmula após expandir formula_touch)
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS qtd_stage
FROM (
  SELECT DISTINCT
    p.cdfil,
    p.nrrqu,
    p.serier,
    p.cdetapa,
    p.tppcp
  FROM fc12500 p
  INNER JOIN (
    SELECT DISTINCT
      t.cdfil,
      t.nrrqu,
      TRIM(t.serier) AS serier
    FROM fc12500 t
    WHERE t.cdfil = 2
      AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  ) formula_touch
    ON formula_touch.cdfil = p.cdfil
   AND formula_touch.nrrqu = p.nrrqu
   AND formula_touch.serier = TRIM(p.serier)
  WHERE p.cdfil = 2
    AND p.nrrqu = 97875
    AND TRIM(p.serier) = '9'
) x;

SELECT DISTINCT
  TRIM(p.cdetapa) AS cdetapa,
  p.tppcp
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
  AND TRIM(p.serier) = '9'
ORDER BY 1, 2;

-- ---------------------------------------------------------------------------
-- 4) Onde some linha: INNER JOIN evt_ent (exige 1º cdopera = '01' por tppcp)
-- ---------------------------------------------------------------------------
SELECT
  TRIM(stage.cdetapa) AS cdetapa,
  stage.tppcp,
  CASE WHEN evt_ent.data_entrada IS NULL THEN 'SEM 01' ELSE 'OK' END AS entrada
FROM (
  SELECT DISTINCT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp
  FROM fc12500 p
  INNER JOIN (
    SELECT DISTINCT t.cdfil, t.nrrqu, TRIM(t.serier) AS serier
    FROM fc12500 t
    WHERE t.cdfil = 2 AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  ) formula_touch
    ON formula_touch.cdfil = p.cdfil
   AND formula_touch.nrrqu = p.nrrqu
   AND formula_touch.serier = TRIM(p.serier)
  WHERE p.cdfil = 2 AND p.nrrqu = 97875 AND TRIM(p.serier) = '9'
) stage
LEFT JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp, p.data AS data_entrada
  FROM fc12500 p
  WHERE p.cdopera = '01' AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp AND p_ant.cdopera = '01'
        AND (p_ant.data < p.data OR (p_ant.data = p.data AND p_ant.hora < p.hora))
    )
) evt_ent
  ON evt_ent.cdfil = stage.cdfil AND evt_ent.nrrqu = stage.nrrqu
 AND TRIM(evt_ent.serier) = TRIM(stage.serier)
 AND evt_ent.cdetapa = stage.cdetapa AND evt_ent.tppcp = stage.tppcp
ORDER BY 1, 2;

-- ---------------------------------------------------------------------------
-- 5) fc12100 — antes era INNER JOIN; sem linha aqui eliminava TUDO no agente antigo
-- ---------------------------------------------------------------------------
SELECT
  req.cdfil,
  req.nrrqu,
  TRIM(req.serier) AS formula,
  req.volume,
  TRIM(req.nomepa) AS paciente
FROM fc12100 req
WHERE req.cdfil = 2
  AND req.nrrqu = 97875;

-- Compare serier exato (espaços):
SELECT
  req.serier AS serier_raw,
  TRIM(req.serier) AS serier_trim,
  CHAR_LENGTH(req.serier) AS len
FROM fc12100 req
WHERE req.cdfil = 2 AND req.nrrqu = 97875;

-- ---------------------------------------------------------------------------
-- 6) Prévia IMPORT por etapa (mesma fórmula 97875-9) — merge tppcp manual depois
-- ---------------------------------------------------------------------------
SELECT
  stage.cdfil AS filial,
  stage.nrrqu AS requisicao,
  TRIM(stage.serier) AS formula,
  TRIM(stage.cdetapa) AS cod_etapa,
  TRIM(e.descricao) AS etapa,
  e.posicao AS posicao_etapa,
  evt_ent.data_entrada,
  evt_ent.hora_entrada,
  evt_sai.data_saida AS data_saida_02,
  evt_sai.hora_saida AS hora_saida_02,
  (
    SELECT FIRST 1 TRIM(p_enc.cdopera)
    FROM fc12500 p_enc
    WHERE p_enc.cdfil = stage.cdfil AND p_enc.nrrqu = stage.nrrqu
      AND p_enc.serier = stage.serier AND p_enc.cdetapa = stage.cdetapa
      AND p_enc.tppcp = stage.tppcp AND TRIM(p_enc.cdopera) <> '01'
    ORDER BY p_enc.data, p_enc.hora
  ) AS primeiro_encerramento_nao_01,
  TRIM(evt_ult.ult_cdopera) AS ult_cdopera
FROM (
  SELECT DISTINCT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp
  FROM fc12500 p
  INNER JOIN (
    SELECT DISTINCT t.cdfil, t.nrrqu, TRIM(t.serier) AS serier
    FROM fc12500 t
    WHERE t.cdfil = 2 AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  ) formula_touch
    ON formula_touch.cdfil = p.cdfil
   AND formula_touch.nrrqu = p.nrrqu
   AND formula_touch.serier = TRIM(p.serier)
  WHERE p.cdfil = 2 AND p.nrrqu = 97875 AND TRIM(p.serier) = '9'
) stage
INNER JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp,
         p.data AS data_entrada, p.hora AS hora_entrada
  FROM fc12500 p
  WHERE p.cdopera = '01' AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp AND p_ant.cdopera = '01'
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
  WHERE p.cdopera = '02' AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp AND p_ant.cdopera = '02'
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

-- ---------------------------------------------------------------------------
-- 7) Teste query COMPLETA do agente (pode falhar se SIMILAR TO / subquery pesada)
--    Se falhar aqui, o agente também falha — copie a mensagem de erro.
-- ---------------------------------------------------------------------------
-- Execute o POST do agente ou compare log "Erro ao consultar banco: ..."

-- ---------------------------------------------------------------------------
-- 8) serier bruto vs normalizado (9 vs 09 quebra INNER JOIN evt_ent no agente)
-- ---------------------------------------------------------------------------
SELECT
  p.serier AS serier_raw,
  TRIM(p.serier) AS serier_trim,
  CAST(CAST(NULLIF(TRIM(CAST(p.serier AS VARCHAR(32))), '') AS INTEGER) AS VARCHAR(20)) AS serier_norm,
  COUNT(*) AS movimentos
FROM fc12500 p
WHERE p.cdfil = 2
  AND p.nrrqu = 97875
GROUP BY 1, 2, 3
ORDER BY 3, 1;

-- ---------------------------------------------------------------------------
-- 9) Agregado por cod_etapa (como fica após merge no backend — vários tppcp → 1 linha)
-- ---------------------------------------------------------------------------
SELECT
  TRIM(stage.cdetapa) AS cod_etapa,
  MIN(TRIM(e.descricao)) AS etapa,
  MIN(e.posicao) AS posicao_etapa,
  MIN(evt_ent.data_entrada) AS data_entrada,
  MIN(evt_sai.data_saida) AS data_saida_02
FROM (
  SELECT DISTINCT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp
  FROM fc12500 p
  INNER JOIN (
    SELECT DISTINCT t.cdfil, t.nrrqu, TRIM(t.serier) AS serier
    FROM fc12500 t
    WHERE t.cdfil = 2 AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  ) formula_touch
    ON formula_touch.cdfil = p.cdfil
   AND formula_touch.nrrqu = p.nrrqu
   AND formula_touch.serier = TRIM(p.serier)
  WHERE p.cdfil = 2 AND p.nrrqu = 97875 AND TRIM(p.serier) = '9'
) stage
INNER JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp, p.data AS data_entrada
  FROM fc12500 p
  WHERE p.cdopera = '01' AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp AND p_ant.cdopera = '01'
        AND (p_ant.data < p.data OR (p_ant.data = p.data AND p_ant.hora < p.hora))
    )
) evt_ent
  ON evt_ent.cdfil = stage.cdfil AND evt_ent.nrrqu = stage.nrrqu
 AND TRIM(evt_ent.serier) = TRIM(stage.serier)
 AND evt_ent.cdetapa = stage.cdetapa AND evt_ent.tppcp = stage.tppcp
LEFT JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp, p.data AS data_saida
  FROM fc12500 p
  WHERE p.cdopera = '02' AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp AND p_ant.cdopera = '02'
        AND (p_ant.data < p.data OR (p_ant.data = p.data AND p_ant.hora < p.hora))
    )
) evt_sai
  ON evt_sai.cdfil = stage.cdfil AND evt_sai.nrrqu = stage.nrrqu
 AND TRIM(evt_sai.serier) = TRIM(stage.serier)
 AND evt_sai.cdetapa = stage.cdetapa AND evt_sai.tppcp = stage.tppcp
LEFT JOIN fc12540 e ON e.cdetapa = stage.cdetapa AND e.tppcp = stage.tppcp
GROUP BY TRIM(stage.cdetapa)
ORDER BY MIN(e.posicao);
