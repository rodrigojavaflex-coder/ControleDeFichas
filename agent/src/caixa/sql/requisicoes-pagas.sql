/* Referência: requisições FC17000 — parametrizado no DatabaseService.buildCaixaRequisicoesPagasQuery */
/* Firebird 2.5: sem CTE; JOIN no conjunto NRRQU do dia (IN/EXISTS em FC12100 é lento). */
/* Universo: dtefe no período UNION nrrqu no cupom (nrrqu > 0). PK FC17000 = (cdfil, nrrqu). */
/* NRORC/CRM agregado: FC12100 só nas NRRQU do dia. valor_formulas = SUM(PRCOBR) * LEAST(1, VRLIQ/VRRQU). */
/* Prescritor agregado: FC12100 (serier='0') + FC04000 — LEFT JOIN, não altera valores de caixa */
/* Próximo: linhas por SERIER em caixa_requisicao_formula (RN-CXA-003 / RN-VIS-008).
 * Query em DatabaseService.buildCaixaRequisicaoFormulasQuery; anexa em formulas[]. */
