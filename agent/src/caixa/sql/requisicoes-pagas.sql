/* Referência: requisições FC17000 — parametrizado no DatabaseService.buildCaixaRequisicoesPagasQuery */
/* Firebird 2.5: sem CTE; JOIN no conjunto NRRQU do dia (IN/EXISTS em FC12100 é lento). */
/* Universo: dtefe >= início AND < fim+1 dia UNION nrrqu no cupom (nrrqu > 0). PK FC17000 = (cdfil, nrrqu). */
/* DTEFE pode ser DATE ou TIMESTAMP: BETWEEN mesmo dia só pega meia-noite. DTOPE (DATE) continua BETWEEN. */
/* Grava tipo_requisicao (TPRQU), valor_saldo (VRSDO) e valor_formulas. */
/* Prescritor agregado: FC12100 (serier='0') + FC04000 — LEFT JOIN, não altera valores de caixa */
/* Próximo: linhas por SERIER em caixa_requisicao_formula (RN-CXA-003 / RN-VIS-008).
 * Query em DatabaseService.buildCaixaRequisicaoFormulasQuery; anexa em formulas[]. */
