/*
  SQL espelho do agente — POST /api/v1/producao/etapas-resumo (modo período)
  Fonte: agent/src/database/database.service.ts → buildProducaoEtapasResumoQuery

  Parâmetros na ordem do node-firebird (7 placeholders):
    ?1 = cdfil / unit (formula_touch)
    ?2 = data_inicio (formula_touch)
    ?3 = data_fim   (formula_touch)
    ?4 = cdfil (stage WHERE)
    ?5 = cdfil (evt_ent)
    ?6 = cdfil (evt_sai)
    ?7 = cdfil (evt_ult)

  v3 (2026-07): serier_int só em formula_touch + fc12100; demais joins serier bruto; sem ORDER BY no Firebird.
  Para testar um bloco menor, ajuste formula_touch: BETWEEN '2026-07-01' AND '2026-07-07'.

  Medir tempo (ISQL / FlameRobin):
    SET STATS ON;
    -- cole o SELECT abaixo
*/

/* Opcional: só contar linhas (mais leve para 1º teste de tempo) */
-- SELECT COUNT(*) FROM ( ... SELECT principal ... ) q;

SELECT
  stage.cdfil                                               AS filial,
  stage.nrrqu                                               AS requisicao,
  CAST(CAST(TRIM(stage.serier) AS INTEGER) AS VARCHAR(10))  AS formula,
  TRIM(stage.cdetapa)                                       AS cod_etapa,
  TRIM(e.descricao)                                         AS etapa,
  e.posicao                                                 AS posicao_etapa,
  evt_ent.usuario_entrada                                   AS usuario_entrada,
  evt_sai.usuario_saida                                     AS usuario_saida,
  evt_ent.data_entrada                                      AS data_entrada,
  evt_ent.hora_entrada                                      AS hora_entrada,
  COALESCE(
    evt_sai.data_saida,
    (
      SELECT FIRST 1 p_enc.data
      FROM fc12500 p_enc
      WHERE p_enc.cdfil = stage.cdfil
        AND p_enc.nrrqu = stage.nrrqu
        AND p_enc.serier = stage.serier
        AND p_enc.cdetapa = stage.cdetapa
        AND p_enc.tppcp = stage.tppcp
        AND TRIM(p_enc.cdopera) NOT IN ('01', '1')
      ORDER BY p_enc.data, p_enc.hora
    )
  )                                                         AS data_saida,
  COALESCE(
    evt_sai.hora_saida,
    (
      SELECT FIRST 1 p_enc.hora
      FROM fc12500 p_enc
      WHERE p_enc.cdfil = stage.cdfil
        AND p_enc.nrrqu = stage.nrrqu
        AND p_enc.serier = stage.serier
        AND p_enc.cdetapa = stage.cdetapa
        AND p_enc.tppcp = stage.tppcp
        AND TRIM(p_enc.cdopera) NOT IN ('01', '1')
      ORDER BY p_enc.data, p_enc.hora
    )
  )                                                         AS hora_saida,
  CASE
    WHEN TRIM(evt_ult.ult_cdopera) IN ('01', '1') THEN 1
    ELSE 0
  END                                                       AS em_andamento_fila,
  evt_ult.usuario_entrada_fila                              AS usuario_entrada_fila,
  evt_ult.data_entrada_fila                                 AS data_entrada_fila,
  evt_ult.hora_entrada_fila                                 AS hora_entrada_fila,
  CASE
    WHEN evt_ent.data_entrada IS NOT NULL
     AND evt_sai.data_saida IS NOT NULL
     AND evt_ent.hora_entrada IS NOT NULL
     AND evt_sai.hora_saida IS NOT NULL
    THEN DATEDIFF(
      MINUTE FROM
      DATEADD(
        MINUTE,
        EXTRACT(HOUR FROM evt_ent.hora_entrada) * 60
        + EXTRACT(MINUTE FROM evt_ent.hora_entrada),
        CAST(evt_ent.data_entrada AS TIMESTAMP)
      )
      TO
      DATEADD(
        MINUTE,
        EXTRACT(HOUR FROM evt_sai.hora_saida) * 60
        + EXTRACT(MINUTE FROM evt_sai.hora_saida),
        CAST(evt_sai.data_saida AS TIMESTAMP)
      )
    )
    ELSE NULL
  END                                                       AS tempo_etapa,
  TRIM(ff.forma_farmaceutica)                               AS forma_farmaceutica,
  req.volume                                                AS quantidade,
  TRIM(req.univol)                                          AS unidade_medida,
  TRIM(req.nomepa)                                          AS paciente,
  COALESCE(req.dtret, req.dtentr)                            AS data_retirada,
  req.hrret                                                 AS hora_retirada
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
      CAST(TRIM(t.serier) AS INTEGER) AS serier_int
    FROM fc12500 t
    WHERE t.cdfil = 2
      AND t.data BETWEEN '2026-07-01' AND '2026-07-31'
  ) formula_touch
    ON formula_touch.cdfil = p.cdfil
   AND formula_touch.nrrqu = p.nrrqu
   AND CAST(TRIM(p.serier) AS INTEGER) = formula_touch.serier_int
  WHERE p.cdfil = 2
) stage
INNER JOIN (
  SELECT
    p.cdfil,
    p.nrrqu,
    p.serier,
    p.cdetapa,
    p.tppcp,
    CASE
      WHEN NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') IS NOT NULL
       AND NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') SIMILAR TO '[0-9]+'
      THEN CAST(NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') AS INTEGER)
      ELSE NULL
    END AS usuario_entrada,
    p.data AS data_entrada,
    p.hora AS hora_entrada
  FROM fc12500 p
  WHERE TRIM(p.cdopera) IN ('01', '1')
    AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1
      FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil
        AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier
        AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp
        AND TRIM(p_ant.cdopera) IN ('01', '1')
        AND (
          p_ant.data < p.data
          OR (p_ant.data = p.data AND p_ant.hora < p.hora)
          OR (
            p_ant.data = p.data
            AND p_ant.hora = p.hora
            AND (
              CASE
                WHEN NULLIF(TRIM(CAST(p_ant.cdusu AS VARCHAR(32))), '') IS NOT NULL
                 AND NULLIF(TRIM(CAST(p_ant.cdusu AS VARCHAR(32))), '') SIMILAR TO '[0-9]+'
                THEN CAST(NULLIF(TRIM(CAST(p_ant.cdusu AS VARCHAR(32))), '') AS INTEGER)
                ELSE 0
              END
            ) > (
              CASE
                WHEN NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') IS NOT NULL
                 AND NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') SIMILAR TO '[0-9]+'
                THEN CAST(NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') AS INTEGER)
                ELSE 0
              END
            )
          )
        )
    )
) evt_ent
  ON evt_ent.cdfil = stage.cdfil
 AND evt_ent.nrrqu = stage.nrrqu
 AND evt_ent.serier = stage.serier
 AND evt_ent.cdetapa = stage.cdetapa
 AND evt_ent.tppcp = stage.tppcp
LEFT JOIN (
  SELECT
    p.cdfil,
    p.nrrqu,
    p.serier,
    p.cdetapa,
    p.tppcp,
    CASE
      WHEN NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') IS NOT NULL
       AND NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') SIMILAR TO '[0-9]+'
      THEN CAST(NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') AS INTEGER)
      ELSE NULL
    END AS usuario_saida,
    p.data AS data_saida,
    p.hora AS hora_saida
  FROM fc12500 p
  WHERE TRIM(p.cdopera) IN ('02', '2')
    AND p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1
      FROM fc12500 p_ant
      WHERE p_ant.cdfil = p.cdfil
        AND p_ant.nrrqu = p.nrrqu
        AND p_ant.serier = p.serier
        AND p_ant.cdetapa = p.cdetapa
        AND p_ant.tppcp = p.tppcp
        AND TRIM(p_ant.cdopera) IN ('02', '2')
        AND (
          p_ant.data < p.data
          OR (p_ant.data = p.data AND p_ant.hora < p.hora)
          OR (
            p_ant.data = p.data
            AND p_ant.hora = p.hora
            AND (
              CASE
                WHEN NULLIF(TRIM(CAST(p_ant.cdusu AS VARCHAR(32))), '') IS NOT NULL
                 AND NULLIF(TRIM(CAST(p_ant.cdusu AS VARCHAR(32))), '') SIMILAR TO '[0-9]+'
                THEN CAST(NULLIF(TRIM(CAST(p_ant.cdusu AS VARCHAR(32))), '') AS INTEGER)
                ELSE 0
              END
            ) > (
              CASE
                WHEN NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') IS NOT NULL
                 AND NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') SIMILAR TO '[0-9]+'
                THEN CAST(NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') AS INTEGER)
                ELSE 0
              END
            )
          )
        )
    )
) evt_sai
  ON evt_sai.cdfil = stage.cdfil
 AND evt_sai.nrrqu = stage.nrrqu
 AND evt_sai.serier = stage.serier
 AND evt_sai.cdetapa = stage.cdetapa
 AND evt_sai.tppcp = stage.tppcp
LEFT JOIN (
  SELECT
    p.cdfil,
    p.nrrqu,
    p.serier,
    p.cdetapa,
    p.tppcp,
    TRIM(p.cdopera) AS ult_cdopera,
    CASE
      WHEN TRIM(p.cdopera) IN ('01', '1') THEN
        CASE
          WHEN NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') IS NOT NULL
           AND NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') SIMILAR TO '[0-9]+'
          THEN CAST(NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') AS INTEGER)
          ELSE NULL
        END
      ELSE NULL
    END AS usuario_entrada_fila,
    CASE WHEN TRIM(p.cdopera) IN ('01', '1') THEN p.data ELSE NULL END AS data_entrada_fila,
    CASE WHEN TRIM(p.cdopera) IN ('01', '1') THEN p.hora ELSE NULL END AS hora_entrada_fila
  FROM fc12500 p
  WHERE p.cdfil = 2
    AND NOT EXISTS (
      SELECT 1
      FROM fc12500 p2
      WHERE p2.cdfil = p.cdfil
        AND p2.nrrqu = p.nrrqu
        AND p2.serier = p.serier
        AND p2.cdetapa = p.cdetapa
        AND p2.tppcp = p.tppcp
        AND (
          p2.data > p.data
          OR (p2.data = p.data AND p2.hora > p.hora)
          OR (
            p2.data = p.data
            AND p2.hora = p.hora
            AND (
              CASE
                WHEN NULLIF(TRIM(CAST(p2.cdusu AS VARCHAR(32))), '') IS NOT NULL
                 AND NULLIF(TRIM(CAST(p2.cdusu AS VARCHAR(32))), '') SIMILAR TO '[0-9]+'
                THEN CAST(NULLIF(TRIM(CAST(p2.cdusu AS VARCHAR(32))), '') AS INTEGER)
                ELSE 0
              END
            ) > (
              CASE
                WHEN NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') IS NOT NULL
                 AND NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') SIMILAR TO '[0-9]+'
                THEN CAST(NULLIF(TRIM(CAST(p.cdusu AS VARCHAR(32))), '') AS INTEGER)
                ELSE 0
              END
            )
          )
        )
    )
) evt_ult
  ON evt_ult.cdfil = stage.cdfil
 AND evt_ult.nrrqu = stage.nrrqu
 AND evt_ult.serier = stage.serier
 AND evt_ult.cdetapa = stage.cdetapa
 AND evt_ult.tppcp = stage.tppcp
LEFT JOIN fc12100 req
  ON req.cdfil  = stage.cdfil
 AND req.nrrqu  = stage.nrrqu
 AND CAST(TRIM(req.serier) AS INTEGER) = CAST(TRIM(stage.serier) AS INTEGER)
LEFT JOIN fc12540 e
  ON e.cdetapa = stage.cdetapa
 AND e.tppcp   = stage.tppcp
LEFT JOIN fc12004 ff
  ON ff.codigo = req.tpformafarma;

-- Filtro rápido req. 97875 / fórmula 9 (wrap: SELECT * FROM ( ... ) q WHERE ...):
-- WHERE q.requisicao = 97875 AND q.formula = '9'
