# Validação caixa × visitação — Marcos jul/2026

Cruzamento do PDF Fórmula Certa (9999/99 Marcos, 01–31/07/2026) com o Firebird local (`bancofc.ib`) e com a sync de fechamento de caixa no PostgreSQL.

**Fonte do recebido:** `FC17000.VRLIQ` → `caixa_requisicoes_pagas.valor_pago_requisicao`. O PDF **não** é a regra (mistura bruto/pago). Uberaba entra na visitação (indicação) e **não** está no PDF.

## Buracos da sync (itens no PG, pagas ausentes)

| Unidade | Data | Firebird FC17000 | PG `caixa_requisicoes_pagas` | PG itens `REQUISICAO` |
|---------|------|------------------|------------------------------|------------------------|
| INHUMAS | 20/07/2026 | 26 / R$ 5.421,18 | **0** | 28 |
| NERÓPOLIS | 27/07/2026 | 12 / R$ 2.799,31 | **0** | 13 |
| NERÓPOLIS | 29/07/2026 | 11 / R$ 2.433,61 | **0** | 11 |
| NERÓPOLIS | 30/07/2026 | 34 / R$ 5.068,91 | **0** | 34 |
| NERÓPOLIS | 31/07/2026 | 8 / R$ 1.294,97 | **0** | 8 |

Requisições do PDF nesses dias (ex.: 97357, 97497, 97554… em 20/07; 26782 em 29/07; 26633/26765/26844 em 30/07) existem no Firebird e no cupom PG, mas **sem linha paga** — a grade de visitação não credita o CRM.

**Reimportar** em Fechamento de Caixa → Buscar caixa ERP: Inhumas **20/07**; Nerópolis **27, 29, 30 e 31/07**. Também Inhumas **21/07** (CRM da 97640).

## Ajuste de código (já aplicado)

Se o agente devolver 0 requisições pagas e o mesmo segmento tiver itens `REQUISICAO`, o backend **não** apaga mais `caixa_requisicoes_pagas` do período (RN-CXA-003).

## CRM 97640

Firebird série 0: **23892 Leandro**, cupom 79414, pago R$ 90. PostgreSQL: **35787 Danillo**. Reimport do dia corrige se o agente atual priorizar série `0`.

## Demais dias de julho

Inhumas e Nerópolis: contagem FC17000 = PG pagas **igual** nos demais dias úteis. Inhumas 30/07: PG 59 vs Firebird 56 (janela DTEFE ou DTOPE do cupom).
