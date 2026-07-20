/*
  Conferência e atualização: codigoFuncionarioErp em funcionarios
  a partir de producao_etapas_resumo (codFuncSaida + funcSaida).

  Regras:
  - Match por unidade + nome normalizado (maiúsculas, trim, espaços colapsados).
  - codigoFuncionarioErp é único por (unidade, codigo) — índice uq_funcionario_unidade_codigo_erp.
  - Atualização segura só quando há 1 funcionário x 1 código ERP por unidade/nome.

  Ajuste :unidade abaixo se quiser restringir (ex.: 'INHUMAS', 'NERÓPOLIS', 'UBERABA').
  Execute primeiro as consultas 1–4; só depois a 5 (UPDATE), preferencialmente em transação.
*/

-- ---------------------------------------------------------------------------
-- 0) Funcionários distintos no ERP (base do seu SELECT, com unidade)
-- ---------------------------------------------------------------------------
SELECT
  p.unidade,
  p."codFuncSaida" AS cod_erp,
  trim(p."funcSaida") AS func_saida_erp,
  count(*) AS qtd_linhas_resumo
FROM producao_etapas_resumo p
WHERE p."funcSaida" IS NOT NULL
  AND trim(p."funcSaida") <> ''
  AND p."codFuncSaida" IS NOT NULL
  -- AND p.unidade = 'INHUMAS'
GROUP BY p.unidade, p."codFuncSaida", trim(p."funcSaida")
ORDER BY p.unidade, trim(p."funcSaida");

-- ---------------------------------------------------------------------------
-- 1) Preview principal: ERP x funcionarios (match por nome)
-- ---------------------------------------------------------------------------
WITH erp_func AS (
  SELECT
    p.unidade,
    p."codFuncSaida" AS cod_erp,
    trim(p."funcSaida") AS func_saida_erp,
    upper(trim(regexp_replace(trim(p."funcSaida"), '\s+', ' ', 'g'))) AS nome_norm
  FROM producao_etapas_resumo p
  WHERE p."funcSaida" IS NOT NULL
    AND trim(p."funcSaida") <> ''
    AND p."codFuncSaida" IS NOT NULL
    -- AND p.unidade = 'INHUMAS'
  GROUP BY 1, 2, 3, 4
),
func AS (
  SELECT
    f.id,
    f.unidade,
    f.nome,
    f."codigoFuncionarioErp" AS cod_atual,
    f."dataDemissao",
    f.ativo,
    upper(trim(regexp_replace(trim(f.nome), '\s+', ' ', 'g'))) AS nome_norm
  FROM funcionarios f
  -- WHERE f.unidade = 'INHUMAS'
),
pares AS (
  SELECT
    e.unidade,
    e.cod_erp,
    e.func_saida_erp,
    e.nome_norm AS nome_erp_norm,
    f.id AS funcionario_id,
    f.nome AS funcionario_nome,
    f.cod_atual,
    f."dataDemissao",
    f.ativo,
    count(*) OVER (PARTITION BY e.unidade, e.nome_norm) AS qtd_func_mesmo_nome,
    count(*) OVER (PARTITION BY e.unidade, e.cod_erp) AS qtd_nomes_mesmo_cod_erp,
    count(*) OVER (PARTITION BY f.id) AS qtd_cod_erp_no_funcionario
  FROM erp_func e
  INNER JOIN func f
    ON f.unidade = e.unidade
   AND f.nome_norm = e.nome_norm
)
SELECT
  unidade,
  cod_erp,
  func_saida_erp,
  funcionario_id,
  funcionario_nome,
  cod_atual AS codigo_erp_atual,
  "dataDemissao",
  ativo,
  CASE
    WHEN qtd_func_mesmo_nome > 1 THEN 'MULTIPLOS_FUNCIONARIOS_MESMO_NOME'
    WHEN qtd_cod_erp_no_funcionario > 1 THEN 'MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO'
    WHEN qtd_nomes_mesmo_cod_erp > 1 THEN 'MULTIPLOS_NOMES_MESMO_COD_ERP'
    WHEN cod_atual IS NULL THEN 'PREENCHER'
    WHEN cod_atual = cod_erp THEN 'OK_JA_CORRETO'
    ELSE 'CONFLITO_CODIGO_DIFERENTE'
  END AS situacao,
  qtd_func_mesmo_nome,
  qtd_cod_erp_no_funcionario,
  qtd_nomes_mesmo_cod_erp
FROM pares
ORDER BY
  CASE situacao
    WHEN 'PREENCHER' THEN 1
    WHEN 'CONFLITO_CODIGO_DIFERENTE' THEN 2
    WHEN 'MULTIPLOS_FUNCIONARIOS_MESMO_NOME' THEN 3
    WHEN 'MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO' THEN 4
    WHEN 'MULTIPLOS_NOMES_MESMO_COD_ERP' THEN 5
    WHEN 'OK_JA_CORRETO' THEN 6
  END,
  unidade,
  func_saida_erp;

-- ---------------------------------------------------------------------------
-- 2) Resumo por situação
-- ---------------------------------------------------------------------------
WITH erp_func AS (
  SELECT
    p.unidade,
    p."codFuncSaida" AS cod_erp,
    trim(p."funcSaida") AS func_saida_erp,
    upper(trim(regexp_replace(trim(p."funcSaida"), '\s+', ' ', 'g'))) AS nome_norm
  FROM producao_etapas_resumo p
  WHERE p."funcSaida" IS NOT NULL
    AND trim(p."funcSaida") <> ''
    AND p."codFuncSaida" IS NOT NULL
  GROUP BY 1, 2, 3, 4
),
func AS (
  SELECT
    f.id,
    f.unidade,
    f.nome,
    f."codigoFuncionarioErp" AS cod_atual,
    upper(trim(regexp_replace(trim(f.nome), '\s+', ' ', 'g'))) AS nome_norm
  FROM funcionarios f
),
pares AS (
  SELECT
    e.unidade,
    e.cod_erp,
    e.nome_norm,
    f.id AS funcionario_id,
    f.cod_atual,
    count(*) OVER (PARTITION BY e.unidade, e.nome_norm) AS qtd_func_mesmo_nome,
    count(*) OVER (PARTITION BY e.unidade, e.cod_erp) AS qtd_nomes_mesmo_cod_erp,
    count(*) OVER (PARTITION BY f.id) AS qtd_cod_erp_no_funcionario
  FROM erp_func e
  INNER JOIN func f
    ON f.unidade = e.unidade
   AND f.nome_norm = e.nome_norm
)
SELECT
  CASE
    WHEN qtd_func_mesmo_nome > 1 THEN 'MULTIPLOS_FUNCIONARIOS_MESMO_NOME'
    WHEN qtd_cod_erp_no_funcionario > 1 THEN 'MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO'
    WHEN qtd_nomes_mesmo_cod_erp > 1 THEN 'MULTIPLOS_NOMES_MESMO_COD_ERP'
    WHEN cod_atual IS NULL THEN 'PREENCHER'
    WHEN cod_atual = cod_erp THEN 'OK_JA_CORRETO'
    ELSE 'CONFLITO_CODIGO_DIFERENTE'
  END AS situacao,
  count(*) AS qtd
FROM pares
GROUP BY 1
ORDER BY qtd DESC;

-- ---------------------------------------------------------------------------
-- 3) ERP sem funcionário correspondente (nome não encontrado no cadastro)
-- ---------------------------------------------------------------------------
WITH erp_func AS (
  SELECT
    p.unidade,
    p."codFuncSaida" AS cod_erp,
    trim(p."funcSaida") AS func_saida_erp,
    upper(trim(regexp_replace(trim(p."funcSaida"), '\s+', ' ', 'g'))) AS nome_norm
  FROM producao_etapas_resumo p
  WHERE p."funcSaida" IS NOT NULL
    AND trim(p."funcSaida") <> ''
    AND p."codFuncSaida" IS NOT NULL
  GROUP BY 1, 2, 3, 4
),
func AS (
  SELECT DISTINCT
    f.unidade,
    upper(trim(regexp_replace(trim(f.nome), '\s+', ' ', 'g'))) AS nome_norm
  FROM funcionarios f
)
SELECT
  e.unidade,
  e.cod_erp,
  e.func_saida_erp
FROM erp_func e
LEFT JOIN func f
  ON f.unidade = e.unidade
 AND f.nome_norm = e.nome_norm
WHERE f.nome_norm IS NULL
ORDER BY e.unidade, e.func_saida_erp;

-- ---------------------------------------------------------------------------
-- 4) Funcionários ativos sem código ERP e sem match exato no resumo
--    (candidatos a cadastro manual ou revisão de nome)
-- ---------------------------------------------------------------------------
WITH erp_func AS (
  SELECT DISTINCT
    p.unidade,
    upper(trim(regexp_replace(trim(p."funcSaida"), '\s+', ' ', 'g'))) AS nome_norm
  FROM producao_etapas_resumo p
  WHERE p."funcSaida" IS NOT NULL
    AND trim(p."funcSaida") <> ''
    AND p."codFuncSaida" IS NOT NULL
),
func AS (
  SELECT
    f.id,
    f.unidade,
    f.nome,
    f."codigoFuncionarioErp",
    f."dataDemissao",
    upper(trim(regexp_replace(trim(f.nome), '\s+', ' ', 'g'))) AS nome_norm
  FROM funcionarios f
  WHERE f."codigoFuncionarioErp" IS NULL
)
SELECT
  f.id,
  f.unidade,
  f.nome,
  f."dataDemissao"
FROM func f
LEFT JOIN erp_func e
  ON e.unidade = f.unidade
 AND e.nome_norm = f.nome_norm
WHERE e.nome_norm IS NULL
ORDER BY f.unidade, f.nome;

-- ---------------------------------------------------------------------------
-- 5) UPDATE seguro — somente match único e codigoFuncionarioErp ainda NULL
--    Passo A: prévia. Passo B: UPDATE (descomente). Use BEGIN/ROLLBACK para testar.
-- ---------------------------------------------------------------------------

-- 5A) Prévia do que será atualizado
WITH erp_func AS (
  SELECT
    p.unidade,
    p."codFuncSaida" AS cod_erp,
    upper(trim(regexp_replace(trim(p."funcSaida"), '\s+', ' ', 'g'))) AS nome_norm
  FROM producao_etapas_resumo p
  WHERE p."funcSaida" IS NOT NULL
    AND trim(p."funcSaida") <> ''
    AND p."codFuncSaida" IS NOT NULL
    -- AND p.unidade = 'INHUMAS'
  GROUP BY 1, 2, 3
),
func AS (
  SELECT
    f.id,
    f.unidade,
    f.nome,
    f."codigoFuncionarioErp" AS cod_atual,
    upper(trim(regexp_replace(trim(f.nome), '\s+', ' ', 'g'))) AS nome_norm
  FROM funcionarios f
  WHERE f."codigoFuncionarioErp" IS NULL
),
pares AS (
  SELECT
    f.id AS funcionario_id,
    e.cod_erp,
    f.unidade,
    f.nome,
    count(*) OVER (PARTITION BY e.unidade, e.nome_norm) AS qtd_func_mesmo_nome,
    count(*) OVER (PARTITION BY f.id) AS qtd_cod_erp_no_funcionario,
    count(*) OVER (PARTITION BY e.unidade, e.cod_erp) AS qtd_nomes_mesmo_cod_erp
  FROM erp_func e
  INNER JOIN func f
    ON f.unidade = e.unidade
   AND f.nome_norm = e.nome_norm
)
SELECT
  funcionario_id,
  unidade,
  nome,
  cod_erp AS novo_codigo_erp
FROM pares
WHERE qtd_func_mesmo_nome = 1
  AND qtd_cod_erp_no_funcionario = 1
  AND qtd_nomes_mesmo_cod_erp = 1
ORDER BY unidade, nome;

-- 5B) UPDATE (descomente após validar a prévia 5A)
/*
BEGIN;

WITH erp_func AS (
  SELECT
    p.unidade,
    p."codFuncSaida" AS cod_erp,
    upper(trim(regexp_replace(trim(p."funcSaida"), '\s+', ' ', 'g'))) AS nome_norm
  FROM producao_etapas_resumo p
  WHERE p."funcSaida" IS NOT NULL
    AND trim(p."funcSaida") <> ''
    AND p."codFuncSaida" IS NOT NULL
  GROUP BY 1, 2, 3
),
func AS (
  SELECT
    f.id,
    f.unidade,
    upper(trim(regexp_replace(trim(f.nome), '\s+', ' ', 'g'))) AS nome_norm
  FROM funcionarios f
  WHERE f."codigoFuncionarioErp" IS NULL
),
pares AS (
  SELECT
    f.id AS funcionario_id,
    e.cod_erp,
    count(*) OVER (PARTITION BY e.unidade, e.nome_norm) AS qtd_func_mesmo_nome,
    count(*) OVER (PARTITION BY f.id) AS qtd_cod_erp_no_funcionario,
    count(*) OVER (PARTITION BY e.unidade, e.cod_erp) AS qtd_nomes_mesmo_cod_erp
  FROM erp_func e
  INNER JOIN func f
    ON f.unidade = e.unidade
   AND f.nome_norm = e.nome_norm
),
atualizaveis AS (
  SELECT funcionario_id, cod_erp
  FROM pares
  WHERE qtd_func_mesmo_nome = 1
    AND qtd_cod_erp_no_funcionario = 1
    AND qtd_nomes_mesmo_cod_erp = 1
)
UPDATE funcionarios f
SET "codigoFuncionarioErp" = a.cod_erp
FROM atualizaveis a
WHERE f.id = a.funcionario_id
  AND f."codigoFuncionarioErp" IS NULL;

-- ROLLBACK;
COMMIT;
*/
