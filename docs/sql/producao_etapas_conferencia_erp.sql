/*
  Conferência: relatório ERP x importação producao_etapas_resumo

  Filiais: INHUMAS = 2, NERÓPOLIS = 4 (validação soma ambas quando comparar ao ERP).
  RN-PCP-001: entrada e saída usam o PRIMEIRO movimento cronológico (01 / 02).
  RN-PCP-004: divergências vs ERP e roteiro de decisão com gestão — docs/regras-negocio.md

  Ajuste :data_ini, :data_fim, :cdfun ou nome do funcionário antes de executar.
*/

-- ---------------------------------------------------------------------------
-- 1) Movimentos de SAÍDA (02) no período — visão "relatório por saída no mês"
-- ---------------------------------------------------------------------------
SELECT
  p.cdfil,
  p.nrrqu,
  TRIM(p.serier) AS formula,
  TRIM(p.cdetapa) AS cod_etapa,
  p.tppcp,
  TRIM(e.descricao) AS etapa,
  p.data AS data_saida_mov,
  p.cdfun,
  COALESCE(
    TRIM(f.nomefun),
    (
      SELECT FIRST 1 TRIM(fb.nomefun)
      FROM fc08000 fb
      WHERE fb.cdfun = p.cdfun AND COALESCE(p.cdfun, 0) > 0
      ORDER BY
        CASE WHEN COALESCE(p.cdcon, 0) > 0 AND fb.cdcon = p.cdcon THEN 0 ELSE 1 END,
        fb.cdcon
    )
  ) AS func_saida
FROM fc12500 p
LEFT JOIN fc12540 e
  ON e.cdetapa = p.cdetapa AND e.tppcp = p.tppcp
LEFT JOIN fc08000 f
  ON f.cdfun = p.cdfun AND f.cdcon = p.cdcon
WHERE p.cdfil IN (2, 4)
  AND p.cdopera = '02'
  AND p.data BETWEEN '2026-06-01' AND '2026-06-30'
  AND UPPER(TRIM(e.descricao)) = 'FORMULA ESPECIAL'
  AND UPPER(COALESCE(
    TRIM(f.nomefun),
    (SELECT FIRST 1 TRIM(fb.nomefun) FROM fc08000 fb WHERE fb.cdfun = p.cdfun ORDER BY fb.cdcon)
  )) CONTAINING 'NOEMI PALHARES'
ORDER BY p.nrrqu, p.serier, p.data, p.hora;

-- ---------------------------------------------------------------------------
-- 2) Regras da importação (RN-PCP-001): 1ª saída = data + funcionário
--    Compare contagem com o PostgreSQL (deve aproximar o ERP)
--    Exemplo: INGRIDHY cdfun = 136
-- ---------------------------------------------------------------------------
SELECT
  UPPER(TRIM(e.descricao)) AS etapa,
  COUNT(*) AS qtd_importacao
FROM (
  SELECT DISTINCT
    stage.cdfil,
    stage.nrrqu,
    TRIM(stage.serier) AS formula,
    TRIM(stage.cdetapa) AS cod_etapa,
    stage.tppcp
  FROM (
    SELECT DISTINCT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp
    FROM fc12500 p
    WHERE p.cdfil IN (2, 4)
      AND p.data BETWEEN '2026-06-01' AND '2026-06-30'
  ) stage
  INNER JOIN (
    SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp
    FROM fc12500 p
    WHERE p.cdopera = '01' AND p.cdfil IN (2, 4)
      AND NOT EXISTS (
        SELECT 1 FROM fc12500 p_ant
        WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
          AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
          AND p_ant.tppcp = p.tppcp AND p_ant.cdopera = '01'
          AND (p_ant.data < p.data OR (p_ant.data = p.data AND p_ant.hora < p.hora))
      )
  ) evt_ent
    ON evt_ent.cdfil = stage.cdfil AND evt_ent.nrrqu = stage.nrrqu
   AND evt_ent.serier = stage.serier AND evt_ent.cdetapa = stage.cdetapa
   AND evt_ent.tppcp = stage.tppcp
  INNER JOIN fc12100 req
    ON req.cdfil = stage.cdfil AND req.nrrqu = stage.nrrqu AND req.serier = stage.serier
  INNER JOIN (
    SELECT
      p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp,
      p.data AS data_saida,
      p.cdfun,
      COALESCE(
        TRIM(f.nomefun),
        (SELECT FIRST 1 TRIM(fb.nomefun) FROM fc08000 fb
         WHERE fb.cdfun = p.cdfun AND COALESCE(p.cdfun, 0) > 0
         ORDER BY CASE WHEN COALESCE(p.cdcon, 0) > 0 AND fb.cdcon = p.cdcon THEN 0 ELSE 1 END, fb.cdcon)
      ) AS func_saida
    FROM fc12500 p
    LEFT JOIN fc08000 f ON f.cdfun = p.cdfun AND f.cdcon = p.cdcon
    WHERE p.cdopera = '02' AND p.cdfil IN (2, 4)
      AND NOT EXISTS (
        SELECT 1 FROM fc12500 p_ant
        WHERE p_ant.cdfil = p.cdfil AND p_ant.nrrqu = p.nrrqu
          AND p_ant.serier = p.serier AND p_ant.cdetapa = p.cdetapa
          AND p_ant.tppcp = p.tppcp AND p_ant.cdopera = '02'
          AND (p_ant.data < p.data OR (p_ant.data = p.data AND p_ant.hora < p.hora))
      )
  ) evt_sai
    ON evt_sai.cdfil = stage.cdfil AND evt_sai.nrrqu = stage.nrrqu
   AND evt_sai.serier = stage.serier AND evt_sai.cdetapa = stage.cdetapa
   AND evt_sai.tppcp = stage.tppcp
  LEFT JOIN fc12540 e
    ON e.cdetapa = stage.cdetapa AND e.tppcp = stage.tppcp
  WHERE evt_sai.data_saida BETWEEN '2026-06-01' AND '2026-06-30'
    AND evt_sai.cdfun = 136
    AND UPPER(TRIM(e.descricao)) IN (
      'DERMATO INHUMAS', 'ENCAPS INHUMAS', 'PESO MEDIO', 'ROT INHUMAS'
    )
) x
LEFT JOIN fc12540 e
  ON e.cdetapa = x.cod_etapa
GROUP BY UPPER(TRIM(e.descricao))
ORDER BY 1;

-- ---------------------------------------------------------------------------
-- 3) Divergências: saída no mês (movimento) mas importação exclui ou data 1ª saída fora do mês
-- ---------------------------------------------------------------------------
SELECT
  mov.cdfil,
  UPPER(TRIM(e.descricao)) AS etapa,
  mov.nrrqu,
  TRIM(mov.serier) AS formula,
  mov.data AS saida_mov_jun,
  mov.cdfun AS cdfun_mov_jun,
  prim.data_saida AS data_importacao,
  prim.cdfun AS cdfun_importacao,
  CASE WHEN ent.nrrqu IS NULL THEN 'SEM_ENTRADA_01' ELSE 'OK' END AS entrada,
  CASE WHEN req.nrrqu IS NULL THEN 'SEM_FC12100' ELSE 'OK' END AS formula_fc12100
FROM fc12500 mov
LEFT JOIN fc12540 e
  ON e.cdetapa = mov.cdetapa AND e.tppcp = mov.tppcp
LEFT JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp, p.data AS data_saida, p.cdfun
  FROM fc12500 p
  WHERE p.cdopera = '02' AND p.cdfil IN (2, 4)
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p2
      WHERE p2.cdfil = p.cdfil AND p2.nrrqu = p.nrrqu AND p2.serier = p.serier
        AND p2.cdetapa = p.cdetapa AND p2.tppcp = p.tppcp AND p2.cdopera = '02'
        AND (p2.data < p.data OR (p2.data = p.data AND p2.hora < p.hora))
    )
) prim
  ON prim.cdfil = mov.cdfil AND prim.nrrqu = mov.nrrqu
 AND prim.serier = mov.serier AND prim.cdetapa = mov.cdetapa AND prim.tppcp = mov.tppcp
LEFT JOIN (
  SELECT DISTINCT cdfil, nrrqu, serier, cdetapa, tppcp
  FROM fc12500 WHERE cdopera = '01' AND cdfil IN (2, 4)
) ent
  ON ent.cdfil = mov.cdfil AND ent.nrrqu = mov.nrrqu
 AND ent.serier = mov.serier AND ent.cdetapa = mov.cdetapa AND ent.tppcp = mov.tppcp
LEFT JOIN fc12100 req
  ON req.cdfil = mov.cdfil AND req.nrrqu = mov.nrrqu AND req.serier = mov.serier
WHERE mov.cdfil IN (2, 4)
  AND mov.cdopera = '02'
  AND mov.cdfun = 136
  AND mov.data BETWEEN '2026-06-01' AND '2026-06-30'
  AND UPPER(TRIM(e.descricao)) IN ('ENCAPS INHUMAS', 'ROT INHUMAS')
  AND (
    ent.nrrqu IS NULL
    OR req.nrrqu IS NULL
    OR prim.data_saida NOT BETWEEN '2026-06-01' AND '2026-06-30'
    OR COALESCE(prim.cdfun, 0) <> mov.cdfun
  )
ORDER BY etapa, mov.cdfil, mov.nrrqu;

-- ---------------------------------------------------------------------------
-- 4) Colisão de upsert (mesmo cod_etapa, tppcp diferente — PostgreSQL guarda só 1)
-- ---------------------------------------------------------------------------
SELECT
  p.cdfil,
  p.nrrqu,
  TRIM(p.serier) AS formula,
  TRIM(p.cdetapa) AS cod_etapa,
  COUNT(DISTINCT p.tppcp) AS qtd_tppcp
FROM fc12500 p
LEFT JOIN fc12540 e ON e.cdetapa = p.cdetapa AND e.tppcp = p.tppcp
WHERE p.cdfil IN (2, 4)
  AND p.data BETWEEN '2026-06-01' AND '2026-06-30'
  AND UPPER(TRIM(e.descricao)) = 'FORMULA ESPECIAL'
GROUP BY 1, 2, 3, 4
HAVING COUNT(DISTINCT p.tppcp) > 1;

-- ---------------------------------------------------------------------------
-- 5) PESO MEDIO (−1): INGRIDHY saiu em jun, mas 1ª saída da etapa é de outro cdfun
-- ---------------------------------------------------------------------------
SELECT
  mov.cdfil,
  mov.nrrqu,
  TRIM(mov.serier) AS formula,
  mov.data AS saida_mov_jun,
  mov.cdfun AS cdfun_mov_jun,
  prim.data_saida AS data_1a_saida,
  prim.cdfun AS cdfun_1a_saida,
  CASE WHEN ent.nrrqu IS NULL THEN 'SEM_ENTRADA_01' ELSE 'OK' END AS entrada,
  CASE WHEN req.nrrqu IS NULL THEN 'SEM_FC12100' ELSE 'OK' END AS formula_fc12100
FROM fc12500 mov
LEFT JOIN fc12540 e
  ON e.cdetapa = mov.cdetapa AND e.tppcp = mov.tppcp
LEFT JOIN (
  SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp, p.data AS data_saida, p.cdfun
  FROM fc12500 p
  WHERE p.cdopera = '02' AND p.cdfil IN (2, 4)
    AND NOT EXISTS (
      SELECT 1 FROM fc12500 p2
      WHERE p2.cdfil = p.cdfil AND p2.nrrqu = p.nrrqu AND p2.serier = p.serier
        AND p2.cdetapa = p.cdetapa AND p2.tppcp = p.tppcp AND p2.cdopera = '02'
        AND (p2.data < p.data OR (p2.data = p.data AND p2.hora < p.hora))
    )
) prim
  ON prim.cdfil = mov.cdfil AND prim.nrrqu = mov.nrrqu
 AND prim.serier = mov.serier AND prim.cdetapa = mov.cdetapa AND prim.tppcp = mov.tppcp
LEFT JOIN (
  SELECT DISTINCT cdfil, nrrqu, serier, cdetapa, tppcp
  FROM fc12500
  WHERE cdopera = '01' AND cdfil IN (2, 4)
) ent
  ON ent.cdfil = mov.cdfil AND ent.nrrqu = mov.nrrqu
 AND ent.serier = mov.serier AND ent.cdetapa = mov.cdetapa AND ent.tppcp = mov.tppcp
LEFT JOIN fc12100 req
  ON req.cdfil = mov.cdfil AND req.nrrqu = mov.nrrqu AND req.serier = mov.serier
WHERE mov.cdfil IN (2, 4)
  AND mov.cdopera = '02'
  AND mov.cdfun = 136
  AND mov.data BETWEEN '2026-06-01' AND '2026-06-30'
  AND UPPER(TRIM(e.descricao)) = 'PESO MEDIO'
  AND COALESCE(prim.cdfun, 0) <> 136
ORDER BY mov.cdfil, mov.nrrqu, formula;

-- ---------------------------------------------------------------------------
-- 6) ROT (−7): resumo por motivo de divergência ERP x importação
-- ---------------------------------------------------------------------------
SELECT motivo, COUNT(*) AS qtd
FROM (
  SELECT
    CASE
      WHEN ent.nrrqu IS NULL THEN 'SEM_ENTRADA_01'
      WHEN req.nrrqu IS NULL THEN 'SEM_FC12100'
      WHEN prim.data_saida NOT BETWEEN '2026-06-01' AND '2026-06-30' THEN 'DATA_1A_SAIDA_FORA_JUN'
      WHEN COALESCE(prim.cdfun, 0) <> 136 THEN 'FUNC_1A_SAIDA_DIFERENTE'
      ELSE 'OUTRO'
    END AS motivo
  FROM fc12500 mov
  LEFT JOIN fc12540 e
    ON e.cdetapa = mov.cdetapa AND e.tppcp = mov.tppcp
  LEFT JOIN (
    SELECT p.cdfil, p.nrrqu, p.serier, p.cdetapa, p.tppcp, p.data AS data_saida, p.cdfun
    FROM fc12500 p
    WHERE p.cdopera = '02' AND p.cdfil IN (2, 4)
      AND NOT EXISTS (
        SELECT 1 FROM fc12500 p2
        WHERE p2.cdfil = p.cdfil AND p2.nrrqu = p.nrrqu AND p2.serier = p.serier
          AND p2.cdetapa = p.cdetapa AND p2.tppcp = p.tppcp AND p2.cdopera = '02'
          AND (p2.data < p.data OR (p2.data = p.data AND p2.hora < p.hora))
      )
  ) prim
    ON prim.cdfil = mov.cdfil AND prim.nrrqu = mov.nrrqu
   AND prim.serier = mov.serier AND prim.cdetapa = mov.cdetapa AND prim.tppcp = mov.tppcp
  LEFT JOIN (
    SELECT DISTINCT cdfil, nrrqu, serier, cdetapa, tppcp
    FROM fc12500
    WHERE cdopera = '01' AND cdfil IN (2, 4)
  ) ent
    ON ent.cdfil = mov.cdfil AND ent.nrrqu = mov.nrrqu
   AND ent.serier = mov.serier AND ent.cdetapa = mov.cdetapa AND ent.tppcp = mov.tppcp
  LEFT JOIN fc12100 req
    ON req.cdfil = mov.cdfil AND req.nrrqu = mov.nrrqu AND req.serier = mov.serier
  WHERE mov.cdfil IN (2, 4)
    AND mov.cdopera = '02'
    AND mov.cdfun = 136
    AND mov.data BETWEEN '2026-06-01' AND '2026-06-30'
    AND UPPER(TRIM(e.descricao)) = 'ROT INHUMAS'
    AND (
      ent.nrrqu IS NULL
      OR req.nrrqu IS NULL
      OR prim.data_saida NOT BETWEEN '2026-06-01' AND '2026-06-30'
      OR COALESCE(prim.cdfun, 0) <> 136
    )
) x
GROUP BY motivo
ORDER BY qtd DESC;
